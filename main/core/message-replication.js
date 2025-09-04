/**
 * Message Replication between Browser and Node.js ONE.core instances
 * Ensures messages are stored and synced in both instances
 */

import nodeOneCore from './node-one-core.js';
import attachmentService from '../services/attachment-service.js';

class MessageReplication {
  constructor() {
    this.topicRooms = new Map() // topicId -> TopicRoom
    this.syncEnabled = false
  }

  /**
   * Initialize message replication
   */
  async initialize() {
    if (!nodeOneCore.initialized) {
      console.log('[MessageReplication] Node ONE.core not initialized')
      return false
    }

    try {
      // Import required ONE.core modules
      const { default: TopicModel } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/Topics/TopicModel.js')
      const { default: ChannelManager } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/ChannelManager.js')
      
      // Initialize TopicModel for Node instance
      this.topicModel = new TopicModel(nodeOneCore.multiUser)
      await this.topicModel.init()
      
      // Initialize ChannelManager
      this.channelManager = new ChannelManager(nodeOneCore.multiUser)
      await this.channelManager.init()
      
      this.syncEnabled = true
      console.log('[MessageReplication] Initialized successfully')
      return true
      
    } catch (error) {
      console.error('[MessageReplication] Initialization failed:', error)
      return false
    }
  }

  /**
   * Store a message in Node.js ONE.core
   * @param {Object} message - Message data from browser
   * @param {string} topicId - Topic/conversation ID
   */
  async storeMessage(message, topicId) {
    if (!this.syncEnabled) {
      console.warn('[MessageReplication] Not initialized')
      return null
    }

    try {
      console.log(`[MessageReplication] Storing message in topic ${topicId}`)
      
      // Get or create TopicRoom
      let topicRoom = this.topicRooms.get(topicId)
      if (!topicRoom) {
        topicRoom = await this.getOrCreateTopicRoom(topicId)
        this.topicRooms.set(topicId, topicRoom)
      }
      
      // Store message in TopicRoom
      const result = await topicRoom.sendMessage(
        message.content || message.text,
        message.author || message.senderId,
        message.channelOwner
      )
      
      console.log('[MessageReplication] Message stored in Node.js ONE.core')
      
      // Store attachments if present
      if (message.attachments && message.attachments.length > 0) {
        await this.storeAttachments(message.attachments, topicId)
      }
      
      return result
      
    } catch (error) {
      console.error('[MessageReplication] Failed to store message:', error)
      return null
    }
  }

  /**
   * Retrieve messages from Node.js ONE.core
   * @param {string} topicId - Topic/conversation ID
   * @param {number} limit - Max messages to retrieve
   */
  async retrieveMessages(topicId, limit = 100) {
    if (!this.syncEnabled) {
      console.warn('[MessageReplication] Not initialized')
      return []
    }

    try {
      console.log(`[MessageReplication] Retrieving messages from topic ${topicId}`)
      
      // Get or create TopicRoom
      let topicRoom = this.topicRooms.get(topicId)
      if (!topicRoom) {
        topicRoom = await this.getOrCreateTopicRoom(topicId)
        this.topicRooms.set(topicId, topicRoom)
      }
      
      // Retrieve messages
      const messages = await topicRoom.retrieveAllMessages()
      
      // Filter and format messages
      const formattedMessages = messages
        .filter(msg => msg.data?.text || msg.data?.blobs)
        .map(msg => ({
          id: msg.id || msg.channelEntryHash,
          content: msg.data.text,
          senderId: msg.author || msg.data.author,
          timestamp: new Date(msg.timestamp || msg.data.timestamp),
          attachments: msg.data.blobs || []
        }))
        .slice(-limit) // Get last N messages
      
      console.log(`[MessageReplication] Retrieved ${formattedMessages.length} messages`)
      return formattedMessages
      
    } catch (error) {
      console.error('[MessageReplication] Failed to retrieve messages:', error)
      return []
    }
  }

  /**
   * Get or create a TopicRoom
   */
  async getOrCreateTopicRoom(topicId) {
    // Check if it's a person-to-person topic
    if (this.isPersonToPersonTopic(topicId)) {
      // Create P2P topic room
      return await this.topicModel.createPersonToPersonTopicRoom(topicId)
    } else {
      // Create group topic room
      return await this.topicModel.createGroupTopicRoom(topicId)
    }
  }

  /**
   * Check if topic is person-to-person
   */
  isPersonToPersonTopic(topicId) {
    // P2P topics typically have specific ID format
    return topicId.includes('-p2p-') || topicId.length === 64
  }

  /**
   * Store attachments in Node.js ONE.core
   */
  async storeAttachments(attachments, topicId) {
    
    for (const attachment of attachments) {
      try {
        // Store attachment BLOB
        await attachmentService.storeAttachment(
          Buffer.from(attachment.data),
          {
            name: attachment.name,
            type: attachment.type,
            size: attachment.size
          }
        )
        
        console.log(`[MessageReplication] Stored attachment: ${attachment.name}`)
      } catch (error) {
        console.error(`[MessageReplication] Failed to store attachment:`, error)
      }
    }
  }

  /**
   * Sync messages between Browser and Node.js
   * This is called when IoM connection is established
   */
  async syncWithBrowser(browserMessages) {
    if (!this.syncEnabled) {
      await this.initialize()
    }

    console.log(`[MessageReplication] Syncing ${browserMessages.length} messages from browser`)
    
    const results = []
    for (const message of browserMessages) {
      try {
        const result = await this.storeMessage(message, message.topicId)
        results.push({ success: true, messageId: message.id })
      } catch (error) {
        results.push({ success: false, messageId: message.id, error: error.message })
      }
    }
    
    const successful = results.filter(r => r.success).length
    console.log(`[MessageReplication] Synced ${successful}/${browserMessages.length} messages`)
    
    return results
  }

  /**
   * Handle incoming message from browser via IoM
   */
  async handleIncomingMessage(data) {
    const { topicId, message } = data
    
    // Store in Node.js ONE.core
    await this.storeMessage(message, topicId)
    
    // Broadcast to other connected clients
    nodeOneCore.broadcastUpdate('message', {
      topicId,
      message
    })
  }
}

// Singleton
export default new MessageReplication()