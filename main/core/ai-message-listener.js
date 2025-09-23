/**
 * AI Message Listener for Node.js instance
 * 
 * Based on LAMA's messageListener.ts, adapted for Node.js
 * Sets up channel listeners to detect new messages in AI topics
 * and trigger AI response generation.
 */

import { createAIMessage } from '../utils/message-utils.js'

class AIMessageListener {
  constructor(channelManager, llmManager) {
    this.channelManager = channelManager
    this.llmManager = llmManager
    this.aiAssistantModel = null // Will be set after AIAssistantModel is initialized
    this.unsubscribe = null
    this.debounceTimers = new Map()
    this.topicModelMap = new Map() // Track topic->model mappings like LAMA
    this.DEBOUNCE_MS = 800 // Increased delay to ensure user message displays first
  }
  
  /**
   * Set the AI Assistant Model reference
   */
  setAIAssistantModel(aiAssistantModel) {
    this.aiAssistantModel = aiAssistantModel
    console.log('[AIMessageListener] AI Assistant Model reference set')
  }

  /**
   * Start listening for messages in AI topics
   */
  async start() {
    console.log('[AIMessageListener] Starting message listener...')
    
    if (!this.channelManager) {
      console.error('[AIMessageListener] Cannot start - channelManager is undefined')
      return
    }
    
    if (!this.channelManager.onUpdated) {
      console.error('[AIMessageListener] Cannot start - channelManager.onUpdated is undefined')
      console.log('[AIMessageListener] Available channelManager methods:', Object.keys(this.channelManager))
      return
    }
    
    console.log('[AIMessageListener] Setting up channel update listener...')
    
    // No need to join - channel manager listener handles messages
    
    // Set up channel update listener - onUpdated is a function that takes a callback
    console.log('[AIMessageListener] 🎯🎯🎯 NODE: Registering channelManager.onUpdated callback')
    
    // Get instance to check our owner ID
    let ownerId;
    try {
      const nodeCore = await import('./node-one-core.js')
      ownerId = nodeCore.default?.ownerId || nodeCore.instance?.ownerId
    } catch (e) {
      console.log('[AIMessageListener] Could not get owner ID:', e.message)
    }
    console.log(`[AIMessageListener] Node owner ID: ${ownerId?.substring(0, 8)}`)
    
    // Check what channels we know about
    try {
      const channels = await this.channelManager.getMatchingChannelInfos({})
      console.log(`[AIMessageListener] Known channels at startup:`, channels.map(c => ({
        id: c.id,
        owner: c.owner?.substring(0, 8),
        isOurChannel: c.owner === ownerId
      })))
      
      // Check if ChannelManager is properly subscribed
      console.log('[AIMessageListener] 🔍 Checking ChannelManager subscription state...')
      if (channels.length === 0) {
        console.warn('[AIMessageListener] ⚠️ No channels found - CHUM sync may not be working!')
      }
    } catch (err) {
      console.log('[AIMessageListener] Could not get channels:', err)
    }
    
    // Add periodic check for channels
    setInterval(async () => {
      try {
        const channels = await this.channelManager.getMatchingChannelInfos({})
        console.log(`[AIMessageListener] 📊 Periodic channel check - found ${channels.length} channels`)
        if (channels.length > 0) {
          console.log('[AIMessageListener] Channel IDs:', channels.map(c => c.id))
        }
      } catch (err) {
        console.error('[AIMessageListener] Periodic check failed:', err)
      }
    }, 10000) // Check every 10 seconds
    
    // Use onUpdated as a function like other parts of the codebase
    this.unsubscribe = this.channelManager.onUpdated(async (
      channelInfoIdHash,
      channelId, 
      channelOwner,
      timeOfEarliestChange,
      data
    ) => {
      console.log('[AIMessageListener] 🔔🔔🔔 NODE: Channel update received!', {
        channelId,
        channelOwner: channelOwner?.substring(0, 8),
        isOurChannel: channelOwner === ownerId,
        nodeOwner: ownerId?.substring(0, 8),
        dataLength: data?.length,
        timeOfEarliestChange
      })
      // Debounce frequent updates
      const existingTimer = this.debounceTimers.get(channelId)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }
      
      const timerId = setTimeout(async () => {
        this.debounceTimers.delete(channelId)
        
        // Check if this is an AI topic first to avoid unnecessary processing
        const isAI = this.isAITopic(channelId)
        if (!isAI) {
          // Skip non-AI topics silently
          return
        }
        
        // Only log and process AI topics
        console.log(`[AIMessageListener] 📢 AI topic update: ${channelId}`)
        console.log(`[AIMessageListener] Data entries: ${data ? data.length : 0}`)
        
        try {
          // Process the channel update for AI topic
          await this.handleChannelUpdate(channelId, {
            channelId,
            isChannelUpdate: true,
            timeOfEarliestChange,
            data
          })
        } catch (error) {
          console.error(`[AIMessageListener] Error processing channel update:`, error)
        }
      }, this.DEBOUNCE_MS)
      
      this.debounceTimers.set(channelId, timerId)
    })
    
    console.log('[AIMessageListener] Message listener started successfully')
  }
  
  /**
   * Stop listening for messages
   */
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
      console.log('[AIMessageListener] Polling stopped')
    }
    
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
      console.log('[AIMessageListener] Message listener stopped')
    }
    
    // Clear all timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()
  }
  
  /**
   * Register a topic as an AI topic with model mapping
   */
  registerAITopic(topicId, modelId) {
    this.topicModelMap.set(topicId, modelId)
    console.log(`[AIMessageListener] Registered AI topic: ${topicId} with model: ${modelId}`)
    console.log(`[AIMessageListener] Topic model map now has ${this.topicModelMap.size} entries`)
  }
  
  /**
   * Check if a topic is an AI topic
   */
  isAITopic(topicId) {
    // Default channel always has AI participation
    if (topicId === 'default') {
      return true
    }
    
    // First check local map
    if (this.topicModelMap.has(topicId)) {
      return true
    }
    
    // Also check AIAssistantModel's map if available
    if (this.aiAssistantModel && this.aiAssistantModel.isAITopic) {
      return this.aiAssistantModel.isAITopic(topicId)
    }
    
    return false
  }
  
  /**
   * Decide if AI should respond to a message
   * This is where AI intelligence comes in - for now simple rules
   */
  shouldAIRespond(channelId, message) {
    // Always respond in lama channel
    if (channelId === 'lama') return true
    
    // Could add more logic here:
    // - Check if message mentions AI
    // - Check if it's a question
    // - Check conversation context
    // - Check if AI is explicitly asked to respond
    
    // For now, respond to all messages in channels we're monitoring
    return true
  }
  
  /**
   * Handle channel update - check if AI should respond
   */
  async handleChannelUpdate(channelId, updateInfo) {
    console.log(`[AIMessageListener] Processing channel update for ${channelId}`)
    
    // Get the TopicModel from the core instance
    let topicModel;
    try {
      const nodeCore = await import('./node-one-core.js')
      // The default export IS the instance
      topicModel = nodeCore.default?.topicModel
      
      if (!topicModel) {
        console.log('[AIMessageListener] TopicModel not on default, checking instance export...')
        topicModel = nodeCore.instance?.topicModel
      }
    } catch (e) {
      console.error('[AIMessageListener] Error importing node-one-core:', e)
      return
    }
    
    if (!topicModel) {
      console.error('[AIMessageListener] TopicModel not available - instance:', !!nodeCore.default, 'topicModel:', !!topicModel)
      return
    }
    
    try {
      // Enter the topic room to send messages
      const topicRoom = await topicModel.enterTopicRoom(channelId)
      if (!topicRoom) {
        console.error(`[AIMessageListener] Could not enter topic room ${channelId}`)
        return
      }
      
      // Get all messages from the topic
      const messages = await topicRoom.retrieveAllMessages()
      console.log(`[AIMessageListener] Found ${messages.length} messages in topic`)
      
      // If this is a new topic with no messages, skip processing
      // The welcome message is handled by chat.js when getMessages is called
      if (messages.length === 0) {
        console.log(`[AIMessageListener] Empty topic ${channelId} - skipping (welcome handled by chat.js)`)
        return
      }
      
      // Find the last user message that needs a response
      let lastUserMessage = null
      let lastAIMessage = null
      
      // Look for the most recent message
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1]
        const messageText = lastMessage.data?.text
        const messageSender = lastMessage.data?.sender || lastMessage.author
        
        // Only process if:
        // 1. It's not from an AI (avoid responding to own messages)
        // 2. It has actual text content
        // 3. It's recent (within last few seconds to avoid old messages)
        const messageAge = Date.now() - new Date(lastMessage.creationTime).getTime()
        const isRecent = messageAge < 10000 // 10 seconds
        
        const isFromAI = this.isAIMessage(lastMessage)
        console.log(`[AIMessageListener] Last message from ${messageSender?.toString().substring(0, 8)}...: isAI=${isFromAI}, text="${messageText?.substring(0, 50)}..."`)
        
        if (!isFromAI && messageText && messageText.trim() && isRecent) {
          console.log(`[AIMessageListener] Found recent user message: "${messageText}"`)
          
          // Delegate to AIAssistantModel for processing
          console.log(`[AIMessageListener] Delegating to AIAssistantModel for processing`)
          await this.aiAssistantModel.processMessage(channelId, messageText, messageSender)
        } else if (isFromAI) {
          console.log(`[AIMessageListener] ✅ Correctly ignoring AI message from ${messageSender?.toString().substring(0, 8)}...`)
        }
      }
    } catch (error) {
      console.error(`[AIMessageListener] Error handling channel update:`, error)
    }
  }
  
  /**
   * Check if a message is from an AI
   */
  isAIMessage(message) {
    // Check if the sender is an AI contact
    const sender = message.data?.sender || message.author
    if (!sender) return false
    
    // Use AI Assistant Model's isAIPerson method
    if (this.aiAssistantModel) {
      return this.aiAssistantModel.isAIPerson(sender)
    }
    
    throw new Error('AIAssistantModel not available - cannot determine if person is AI')
  }
  
  /**
   * Process a user message and generate AI response
   * @deprecated - Use AIAssistantModel.processMessage instead
   */
  async processUserMessage(topicMessages, message, channelId, topicRoom) {
    // This method is deprecated - all processing should go through AIAssistantModel
    const messageText = message.data?.text || message.text
    const messageSender = message.data?.sender || message.author
    console.log(`[AIMessageListener] DEPRECATED: processUserMessage called, delegating to AIAssistantModel`)
    return this.aiAssistantModel.processMessage(channelId, messageText, messageSender)
  }
  
  /**
   * Legacy method content - kept for reference
   * The actual logic has been moved to AIAssistantModel.processMessage
   */
  async _legacyProcessUserMessage() {
    // Original implementation moved to AIAssistantModel
    // This method is kept for reference only
  }
}

export default AIMessageListener;