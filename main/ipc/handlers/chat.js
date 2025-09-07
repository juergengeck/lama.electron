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
        
        // For default topic, ensure it has the group configuration
        if (conversationId === 'default' && nodeOneCore.topicGroupManager) {
          console.log('[ChatHandler] Ensuring default topic has group participants')
          try {
            // Get or create the conversation group for default topic
            const groupIdHash = await nodeOneCore.topicGroupManager.getOrCreateConversationGroup('default')
            
            // Get the topic object
            const topic = await nodeOneCore.topicModel.topics.queryById('default')
            if (topic) {
              // Add the group to the topic
              await nodeOneCore.topicModel.addGroupToTopic(groupIdHash, topic)
              console.log('[ChatHandler] Added group to default topic')
            }
          } catch (groupError) {
            console.log('[ChatHandler] Could not add group to default topic:', groupError.message)
          }
        }
      } catch (error) {
        // Topic doesn't exist, create it with proper group
        console.log('[ChatHandler] Topic does not exist, creating with group participants:', conversationId)
        
        // Use TopicGroupManager to create topic with proper group
        if (nodeOneCore.topicGroupManager) {
          await nodeOneCore.topicGroupManager.createGroupTopic(conversationId, conversationId)
        } else {
          // Fallback to old method
          await nodeOneCore.topicModel.createGroupTopic(conversationId, conversationId, nodeOneCore.ownerId)
        }
        
        // CRITICAL: Also create the channel so we can post messages
        if (nodeOneCore.channelManager) {
          try {
            console.log('[ChatHandler] Creating channel for new topic')
            await nodeOneCore.channelManager.createChannel(conversationId, nodeOneCore.ownerId)
            console.log('[ChatHandler] Channel created successfully')
            
            // Grant access to browser Person ID for CHUM sync
            const browserPersonId = stateManager.getState('browserPersonId')
            if (browserPersonId) {
              const { createAccess } = await import('@refinio/one.core/lib/access.js')
              const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')
              const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/util/object.js')
              
              const channelInfoHash = await calculateIdHashOfObj({
                $type$: 'ChannelInfo',
                id: conversationId,
                owner: nodeOneCore.ownerId
              })
              
              // Grant direct person-to-person access to browser
              await createAccess([{
                id: channelInfoHash,
                person: [browserPersonId], // Direct access to browser person
                group: [],
                mode: SET_ACCESS_MODE.ADD
              }])
              
              console.log(`[ChatHandler] Granted channel access to browser person: ${browserPersonId.substring(0, 8)}`)
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
      // For proper federation sync, we need to specify the channel owner
      const channelOwner = nodeOneCore.ownerId
      await topicRoom.sendMessage(text, undefined, channelOwner)
      
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
      
      // Notify renderer about the new message
      event.sender.send('chat:messageSent', message)
      
      // Also emit a message update event so UI refreshes from source
      event.sender.send('message:updated', { conversationId })
      
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
        console.log('[ChatHandler] Topic does not exist yet:', conversationId)
        // Topic doesn't exist yet - try to create it with proper group
        try {
          // Use TopicGroupManager to create topic with proper group
          if (nodeOneCore.topicGroupManager) {
            await nodeOneCore.topicGroupManager.createGroupTopic(conversationId, conversationId)
          } else {
            // Fallback to old method
            await nodeOneCore.topicModel.createGroupTopic(conversationId, conversationId, nodeOneCore.ownerId)
          }
          
          // Create the channel too
          if (nodeOneCore.channelManager) {
            await nodeOneCore.channelManager.createChannel(conversationId, nodeOneCore.ownerId)
          }
          
          topicRoom = await nodeOneCore.topicModel.enterTopicRoom(conversationId)
        } catch (createError) {
          console.error('[ChatHandler] Could not create topic:', createError)
          return {
            success: true,
            data: {
              messages: [],
              total: 0,
              hasMore: false
            }
          }
        }
      }
      
      // Get messages from the topic room
      const rawMessages = await topicRoom.retrieveAllMessages()
      console.log('[ChatHandler] Retrieved', rawMessages.length, 'messages from TopicRoom')
      
      // Filter for actual ChatMessage objects - they have data.text
      const validMessages = rawMessages.filter(msg => 
        msg.data?.text && typeof msg.data.text === 'string' && msg.data.text.trim() !== ''
      )
      
      // Transform messages to UI format
      const formattedMessages = validMessages.map(msg => ({
        id: msg.id || msg.channelEntryHash || `msg-${Date.now()}`,
        conversationId,
        text: msg.data?.text || '',
        sender: msg.data?.sender || msg.data?.author || msg.author || nodeOneCore.ownerId,
        timestamp: msg.creationTime ? new Date(msg.creationTime).toISOString() : new Date().toISOString(),
        status: 'received'
      }))
      
      // Apply pagination
      const messages = formattedMessages.slice(offset, offset + limit)
      
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
      
      // Create topic with proper group participants using TopicGroupManager
      if (nodeOneCore.topicGroupManager) {
        try {
          console.log('[ChatHandler] Creating topic with conversation group for:', conversation.id)
          
          // This will create the topic with a group containing browser owner, node owner, and AI
          await nodeOneCore.topicGroupManager.createGroupTopic(
            conversation.name,
            conversation.id
          )
          console.log('[ChatHandler] Created topic with proper group participants')
          
        } catch (error) {
          console.error('[ChatHandler] Error creating topic with group:', error)
          // Fallback to creating channel only
          if (nodeOneCore.channelManager) {
            try {
              await nodeOneCore.channelManager.createChannel(conversation.id, nodeOneCore.ownerId)
            } catch (channelError) {
              console.log('[ChatHandler] Channel might already exist:', channelError.message)
            }
          }
        }
      } else if (nodeOneCore.channelManager) {
        // Fallback if TopicGroupManager not available
        try {
          console.log('[ChatHandler] Creating Node.js channel for conversation:', conversation.id)
          await nodeOneCore.channelManager.createChannel(conversation.id, nodeOneCore.ownerId)
          console.log('[ChatHandler] Created Node.js channel with owner:', nodeOneCore.ownerId)
        } catch (error) {
          console.error('[ChatHandler] Error creating channel in Node.js:', error)
        }
      }
      
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