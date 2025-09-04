/**
 * Chat IPC Handlers
 */

import stateManager from '../../state/manager.js';
import instanceManager from '../../core/instance.js';
import nodeProvisioning from '../../hybrid/node-provisioning.js';
import nodeOneCore from '../../core/node-one-core.js';

const chatHandlers = {
  async sendMessage(event, { conversationId, text, attachments = [] }) {
    console.log('[ChatHandler] Send message:', { conversationId, text })
    
    try {
      // Check if node is provisioned and has TopicModel
      if (!nodeProvisioning.isProvisioned()) {
        throw new Error('Node not provisioned')
      }
      
      if (!nodeOneCore.topicModel) {
        throw new Error('TopicModel not initialized')
      }
      
      const userId = stateManager.getState('user.id')
      if (!userId) {
        throw new Error('User not authenticated')
      }
      
      // Get or create topic room for the conversation
      let topicRoom
      try {
        topicRoom = await nodeOneCore.topicModel.enterTopicRoom(conversationId)
      } catch (error) {
        // Topic doesn't exist, create it
        console.log('[ChatHandler] Topic does not exist, creating:', conversationId)
        await nodeOneCore.topicModel.createGroupTopic(conversationId, conversationId, nodeOneCore.ownerId)
        
        // CRITICAL: Also create the channel so we can post messages
        if (nodeOneCore.channelManager) {
          try {
            console.log('[ChatHandler] Creating channel for new topic')
            await nodeOneCore.channelManager.createChannel(conversationId, nodeOneCore.ownerId)
            console.log('[ChatHandler] Channel created successfully')
            
            // Grant IoM group access for sync between local instances
            if (nodeOneCore.iomGroup) {
              const { createAccess } = await import('@refinio/one.core/lib/access.js')
              const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')
              const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/util/object.js')
              
              const channelInfoHash = await calculateIdHashOfObj({
                $type$: 'ChannelInfo',
                id: conversationId,
                owner: nodeOneCore.ownerId
              })
              
              await createAccess([{
                id: channelInfoHash,
                person: [],
                group: [nodeOneCore.iomGroup.groupIdHash],
                mode: SET_ACCESS_MODE.ADD
              }])
              
              console.log('[ChatHandler] IoM group access granted for channel:', conversationId)
            }
          } catch (channelErr) {
            console.log('[ChatHandler] Channel creation result:', channelErr?.message || 'May already exist')
          }
        }
        
        topicRoom = await nodeOneCore.topicModel.enterTopicRoom(conversationId)
      }
      
      // Send message through TopicModel (this syncs via ChannelManager)
      // TopicRoom.sendMessage expects (message, author, channelOwner)
      // undefined author means "use my main identity"
      // undefined channelOwner means "use my channel"
      await topicRoom.sendMessage(text, undefined, undefined)
      
      // Create message object for UI
      const message = {
        id: `msg-${Date.now()}`,
        conversationId,
        text,
        attachments,
        sender: userId,
        timestamp: new Date().toISOString(),
        status: 'sent'
      }
      
      // Add to state for UI
      stateManager.addMessage(conversationId, message)
      
      // Notify renderer
      event.sender.send('chat:messageSent', message)
      
      return {
        success: true,
        data: message
      }
    } catch (error) {
      console.error('[ChatHandler] Error sending message:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  async getMessages(event, { conversationId, limit = 50, offset = 0 }) {
    console.log('[ChatHandler] Get messages:', { conversationId, limit, offset })
    
    try {
      // Check if node is provisioned
      if (!nodeProvisioning.isProvisioned() || !nodeOneCore.topicModel) {
        // Fallback to state manager if not ready
        const messages = stateManager.getMessages(conversationId) || []
        const paginated = messages.slice(offset, offset + limit)
        return {
          success: true,
          data: {
            messages: paginated,
            total: messages.length,
            hasMore: offset + limit < messages.length
          }
        }
      }
      
      // Get messages from TopicModel
      let topicRoom
      try {
        topicRoom = await nodeOneCore.topicModel.enterTopicRoom(conversationId)
      } catch (error) {
        // Topic doesn't exist yet
        return {
          success: true,
          data: {
            messages: [],
            total: 0,
            hasMore: false
          }
        }
      }
      
      // Get messages from the topic room
      const messages = await topicRoom.getRecentMessages(limit, offset)
      
      // Transform messages to UI format
      const formattedMessages = messages.map(msg => ({
        id: msg.hash || msg.id,
        conversationId,
        text: msg.text || msg.content,
        sender: msg.sender || msg.author,
        timestamp: msg.timestamp || new Date().toISOString(),
        status: 'received'
      }))
      
      const paginated = formattedMessages
      
      return {
        success: true,
        data: {
          messages: paginated,
          total: messages.length,
          hasMore: offset + limit < messages.length
        }
      }
    } catch (error) {
      console.error('[ChatHandler] Error getting messages:', error)
      return {
        success: false,
        error: error.message,
        data: {
          messages: [],
          total: 0,
          hasMore: false
        }
      }
    }
  },

  async createConversation(event, { type = 'direct', participants = [], name = null }) {
    console.log('[ChatHandler] Create conversation:', { type, participants, name })
    
    try {
      // Get user from state manager (set during browser authentication)
      let userId = stateManager.getState('user.id')
      
      // If not in state manager but node is provisioned, get from node
      if (!userId && nodeProvisioning.isProvisioned()) {
        const user = nodeProvisioning.getUser()
        userId = user?.id || nodeOneCore.ownerId
        
        // Update state manager for consistency
        if (user) {
          stateManager.setUser(user)
        }
      }
      
      if (!userId) {
        throw new Error('User not authenticated')
      }
      
      // Create conversation locally for now
      let topicId
      if (type === 'direct' && participants.length === 1) {
        const sortedIds = [userId, participants[0]].sort()
        topicId = `${sortedIds[0]}<->${sortedIds[1]}`
      } else {
        topicId = `topic-${Date.now()}`
      }
      
      const conversation = {
        id: topicId,
        type,
        participants: [userId, ...participants],
        name: name || `Conversation ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
        lastMessage: null,
        lastMessageAt: null,
        unreadCount: 0
      }
      
      // TODO: Create in TopicModel when properly initialized
      // if (nodeOneCore.topicModel) {
      //   await nodeOneCore.topicModel.createTopic({type, participants, name})
      // }
      
      // Add to state for UI
      stateManager.addConversation(conversation)
      
      // Initialize empty message array for this conversation
      const messages = stateManager.getState('messages')
      if (!messages.has(conversation.id)) {
        messages.set(conversation.id, [])
        stateManager.setState('messages', messages)
      }
      
      // Notify renderer
      event.sender.send('chat:conversationCreated', conversation)
      
      return {
        success: true,
        data: conversation
      }
    } catch (error) {
      console.error('[ChatHandler] Error creating conversation:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  async getConversations(event, { limit = 20, offset = 0 } = {}) {
    console.log('[ChatHandler] Get conversations')
    
    try {
      const conversationsMap = stateManager.getState('conversations')
      const conversations = conversationsMap ? Array.from(conversationsMap.values()) : []
      
      // Sort by last message time (most recent first)
      conversations.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
        return bTime - aTime
      })
      
      // Apply pagination
      const paginated = conversations.slice(offset, offset + limit)
      
      return {
        success: true,
        data: {
          conversations: paginated,
          total: conversations.length,
          hasMore: offset + limit < conversations.length
        }
      }
    } catch (error) {
      console.error('[ChatHandler] Error getting conversations:', error)
      return {
        success: false,
        error: error.message,
        data: {
          conversations: [],
          total: 0,
          hasMore: false
        }
      }
    }
  },

  async getConversation(event, { conversationId }) {
    console.log('[ChatHandler] Get conversation:', conversationId)
    
    const conversations = stateManager.getState('conversations')
    const conversation = conversations.get(conversationId)
    
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`)
    }
    
    return conversation
  }
}

export default chatHandlers