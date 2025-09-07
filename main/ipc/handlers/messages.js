/**
 * Dedicated Message Handlers for Browser-Node.js sync
 * Handles message operations between browser UI and Node ONE.core
 */

import nodeOneCore from '../../core/node-one-core.js';
import nodeProvisioning from '../../hybrid/node-provisioning.js';
import stateManager from '../../state/manager.js';

const messageHandlers = {
  /**
   * Send message through Node's TopicModel/ChannelManager
   * This ensures messages are properly stored in ONE.core and can sync via CHUM
   */
  async sendMessage(event, { topicId, content, attachments = [] }) {
    console.log('[MessageHandler] Send message to topic:', topicId)
    
    try {
      // Verify Node is provisioned
      if (!nodeProvisioning.isProvisioned()) {
        throw new Error('Node not provisioned - user must log in first')
      }
      
      if (!nodeOneCore.topicModel) {
        throw new Error('TopicModel not initialized')
      }
      
      // Get or create topic room
      let topicRoom
      try {
        topicRoom = await nodeOneCore.topicModel.enterTopicRoom(topicId)
      } catch (error) {
        console.log('[MessageHandler] Topic does not exist, creating:', topicId)
        
        // Create the topic
        await nodeOneCore.topicModel.createGroupTopic(
          topicId,           // Topic name
          topicId,           // Topic ID  
          nodeOneCore.ownerId // Channel owner
        )
        
        // Create the channel for messaging
        if (nodeOneCore.channelManager) {
          await nodeOneCore.channelManager.createChannel(topicId, nodeOneCore.ownerId)
          console.log('[MessageHandler] Channel created for topic:', topicId)
        }
        
        topicRoom = await nodeOneCore.topicModel.enterTopicRoom(topicId)
      }
      
      if (!topicRoom) {
        throw new Error('Failed to access topic room')
      }
      
      // Send message through TopicRoom
      // TopicRoom.sendMessage(text, author, channelOwner)
      // undefined author = use my main identity
      // channelOwner = who owns the channel (for proper routing)
      const channelOwner = nodeOneCore.ownerId
      
      if (attachments && attachments.length > 0) {
        // Handle attachments
        const attachmentHashes = attachments.map(att => att.hash)
        await topicRoom.sendMessageWithAttachmentAsHash(
          content,
          attachmentHashes,
          undefined,      // author (undefined = use my identity)
          channelOwner    // channel owner
        )
      } else {
        // Plain text message
        await topicRoom.sendMessage(
          content,
          undefined,      // author (undefined = use my identity)  
          channelOwner    // channel owner
        )
      }
      
      console.log('[MessageHandler] Message sent successfully to topic:', topicId)
      
      // Return success
      return {
        success: true,
        topicId,
        timestamp: new Date().toISOString()
      }
      
    } catch (error) {
      console.error('[MessageHandler] Error sending message:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },
  
  /**
   * Get messages from Node's TopicModel
   * Retrieves messages stored in ONE.core channels
   */
  async getMessages(event, { topicId, limit = 100 }) {
    console.log('[MessageHandler] Get messages for topic:', topicId)
    
    try {
      // Check if Node is provisioned
      if (!nodeProvisioning.isProvisioned() || !nodeOneCore.topicModel) {
        console.log('[MessageHandler] Node not ready, returning empty messages')
        return {
          success: true,
          messages: [],
          topicId
        }
      }
      
      // Try to enter the topic room
      let topicRoom
      try {
        topicRoom = await nodeOneCore.topicModel.enterTopicRoom(topicId)
      } catch (error) {
        console.log('[MessageHandler] Topic does not exist:', topicId)
        
        // Try to create it
        try {
          await nodeOneCore.topicModel.createGroupTopic(
            topicId,
            topicId,
            nodeOneCore.ownerId
          )
          
          if (nodeOneCore.channelManager) {
            await nodeOneCore.channelManager.createChannel(topicId, nodeOneCore.ownerId)
          }
          
          topicRoom = await nodeOneCore.topicModel.enterTopicRoom(topicId)
        } catch (createError) {
          console.log('[MessageHandler] Could not create topic, returning empty')
          return {
            success: true,
            messages: [],
            topicId
          }
        }
      }
      
      if (!topicRoom) {
        return {
          success: true,
          messages: [],
          topicId
        }
      }
      
      // Retrieve all messages from the topic
      const rawMessages = await topicRoom.retrieveAllMessages()
      console.log(`[MessageHandler] Retrieved ${rawMessages.length} raw messages`)
      
      // Filter for valid ChatMessage objects
      const validMessages = rawMessages.filter(msg => {
        // ChatMessage objects have data.text field
        return msg.data?.text && typeof msg.data.text === 'string' && msg.data.text.trim() !== ''
      })
      
      console.log(`[MessageHandler] Filtered to ${validMessages.length} valid messages`)
      
      // Transform to UI format
      const messages = validMessages.map(msg => ({
        id: msg.id || msg.channelEntryHash || `msg-${Date.now()}-${Math.random()}`,
        content: msg.data?.text || '',
        senderId: msg.data?.sender || msg.data?.author || msg.author || nodeOneCore.ownerId,
        timestamp: msg.creationTime || Date.now(),
        attachments: msg.data?.blobs || []
      }))
      
      // Apply limit (get most recent messages)
      const limitedMessages = messages.slice(-limit)
      
      return {
        success: true,
        messages: limitedMessages,
        topicId,
        hasMore: messages.length > limit
      }
      
    } catch (error) {
      console.error('[MessageHandler] Error getting messages:', error)
      return {
        success: false,
        error: error.message,
        messages: [],
        topicId
      }
    }
  },
  
  /**
   * Subscribe to message updates for a topic
   * Sets up real-time updates when new messages arrive via CHUM
   */
  async subscribeToTopic(event, { topicId }) {
    console.log('[MessageHandler] Subscribe to topic:', topicId)
    
    try {
      if (!nodeOneCore.channelManager) {
        throw new Error('ChannelManager not initialized')
      }
      
      // Set up channel listener for this specific topic
      const listener = async (channelInfoIdHash, channelId, channelOwner, timeOfEarliestChange, data) => {
        if (channelId === topicId) {
          console.log(`[MessageHandler] New data in topic ${topicId}:`, data.length, 'items')
          
          // Notify the browser about the update
          event.sender.send('message:updated', { 
            topicId,
            updateCount: data.length
          })
        }
      }
      
      // Register the listener
      nodeOneCore.channelManager.onUpdated(listener)
      
      // Store listener reference for cleanup
      if (!messageHandlers._listeners) {
        messageHandlers._listeners = new Map()
      }
      messageHandlers._listeners.set(topicId, listener)
      
      console.log('[MessageHandler] Subscribed to topic:', topicId)
      
      return {
        success: true,
        topicId,
        subscribed: true
      }
      
    } catch (error) {
      console.error('[MessageHandler] Error subscribing to topic:', error)
      return {
        success: false,
        error: error.message,
        topicId
      }
    }
  },
  
  /**
   * Unsubscribe from topic updates
   */
  async unsubscribeFromTopic(event, { topicId }) {
    console.log('[MessageHandler] Unsubscribe from topic:', topicId)
    
    if (messageHandlers._listeners && messageHandlers._listeners.has(topicId)) {
      // Remove the listener (would need channelManager to support removal)
      messageHandlers._listeners.delete(topicId)
      
      return {
        success: true,
        topicId,
        subscribed: false
      }
    }
    
    return {
      success: true,
      topicId,
      subscribed: false
    }
  },
  
  /**
   * Create a new topic/conversation
   */
  async createTopic(event, { topicId, name, participants = [] }) {
    console.log('[MessageHandler] Create topic:', topicId)
    
    try {
      if (!nodeOneCore.topicModel || !nodeOneCore.channelManager) {
        throw new Error('TopicModel or ChannelManager not initialized')
      }
      
      // Create the topic
      const topic = await nodeOneCore.topicModel.createGroupTopic(
        name || topicId,    // Topic name
        topicId,            // Topic ID
        nodeOneCore.ownerId // Channel owner
      )
      
      // Create the channel for messaging
      await nodeOneCore.channelManager.createChannel(topicId, nodeOneCore.ownerId)
      
      console.log('[MessageHandler] Topic created:', topic.id)
      
      // Add participants if specified
      if (participants.length > 0) {
        // Grant access to participants
        const { createAccess } = await import('@refinio/one.core/lib/access.js')
        const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')
        
        // Get channel info
        const channelInfos = await nodeOneCore.channelManager.getMatchingChannelInfos({
          channelId: topicId
        })
        
        for (const channelInfo of channelInfos) {
          await createAccess([{
            id: channelInfo.idHash,
            person: participants,
            group: [],
            mode: SET_ACCESS_MODE.ADD
          }])
        }
        
        console.log('[MessageHandler] Access granted to participants:', participants.length)
      }
      
      return {
        success: true,
        topicId: topic.id,
        name: name || topicId
      }
      
    } catch (error) {
      console.error('[MessageHandler] Error creating topic:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default messageHandlers