/**
 * AI Message Listener for Node.js instance
 * 
 * Based on LAMA's messageListener.ts, adapted for Node.js
 * Sets up channel listeners to detect new messages in AI topics
 * and trigger AI response generation.
 */

import { createAIMessage } from '../utils/message-utils.js'

class AIMessageListener {
  constructor(channelManager, llmManager, aiContactManager) {
    this.channelManager = channelManager
    this.llmManager = llmManager
    this.aiContactManager = aiContactManager // To get AI personIds
    this.unsubscribe = null
    this.debounceTimers = new Map()
    this.topicModelMap = new Map() // Track topic->model mappings like LAMA
    this.DEBOUNCE_MS = 200
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
    const { instance } = await import('./node-one-core.js')
    console.log(`[AIMessageListener] Node owner ID: ${instance.ownerId?.substring(0, 8)}`)
    
    // Check what channels we know about
    try {
      const channels = await this.channelManager.getMatchingChannelInfos({})
      console.log(`[AIMessageListener] Known channels at startup:`, channels.map(c => ({
        id: c.id,
        owner: c.owner?.substring(0, 8),
        isOurChannel: c.owner === instance.ownerId
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
        isOurChannel: channelOwner === instance.ownerId,
        nodeOwner: instance.ownerId?.substring(0, 8),
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
        
        // Process ALL channel updates - we'll check for AI participation inside
        console.log(`[AIMessageListener] Channel update for: ${channelId}`)
        console.log(`[AIMessageListener] Data entries: ${data ? data.length : 0}`)
        
        try {
          // Process the channel update
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
    // Check if topic has a model mapping (like LAMA does)
    return this.topicModelMap.has(topicId)
  }
  
  /**
   * Decide if AI should respond to a message
   * This is where AI intelligence comes in - for now simple rules
   */
  shouldAIRespond(channelId, message) {
    // Always respond in default channel
    if (channelId === 'default') return true
    
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
    
    // Get the TopicModel to access the topic
    const { instance } = await import('./node-one-core.js')
    if (!instance?.topicModel) {
      console.error('[AIMessageListener] TopicModel not available')
      return
    }
    
    try {
      // Enter the topic room to send messages
      const topicRoom = await instance.topicModel.enterTopicRoom(channelId)
      if (!topicRoom) {
        console.error(`[AIMessageListener] Could not enter topic room ${channelId}`)
        return
      }
      
      // Get all messages from the topic
      const messages = await topicRoom.retrieveAllMessages()
      console.log(`[AIMessageListener] Found ${messages.length} messages in topic`)
      
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
        
        if (!this.isAIMessage(lastMessage) && messageText && messageText.trim() && isRecent) {
          console.log(`[AIMessageListener] Found recent user message: "${messageText}"`)
          
          // Let AI decide if it should respond (for now, always respond in default channel)
          const shouldRespond = channelId === 'default' || this.shouldAIRespond(channelId, lastMessage)
          
          if (shouldRespond) {
            console.log(`[AIMessageListener] AI will respond to message`)
            await this.processUserMessage(topicRoom, lastMessage)
          }
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
    
    // Get all AI person IDs from the AI contact manager
    if (this.aiContactManager) {
      const aiContacts = this.aiContactManager.getAllContacts()
      return aiContacts.some(contact => contact.personId === sender)
    }
    
    // Fallback: check if sender ID looks like an AI (temporary)
    // AI IDs from logs: ecefa6a33d1bdfb470cd3bb0b86bf4f9d9e316bf55286adf65bbd2fd1487fe6e
    return false
  }
  
  /**
   * Process a user message and generate AI response
   */
  async processUserMessage(topicRoom, message) {
    const messageText = message.data?.text || message.text
    console.log(`[AIMessageListener] Processing user message: "${messageText}"`)
    
    if (!this.llmManager) {
      console.error('[AIMessageListener] LLMManager not available')
      return
    }
    
    try {
      // Default to Ollama model
      const modelId = 'ollama:gpt-oss'
      
      // Build chat history for context
      const messages = [{
        role: 'user',
        content: messageText
      }]
      
      // Generate AI response using proper chat method
      const response = await this.llmManager.chat(messages, modelId)
      
      if (response) {
        // Get the AI's personId for this model
        let aiPersonId = null
        if (this.aiContactManager) {
          aiPersonId = this.aiContactManager.getPersonIdForModel(modelId)
        }
        
        if (!aiPersonId) {
          console.error(`[AIMessageListener] No personId found for model ${modelId}`)
          return
        }
        
        // Send the AI response to the topic room
        // TopicRoom.sendMessage expects (text, author, channelOwner)
        await topicRoom.sendMessage(
          response,
          aiPersonId,
          undefined // Let it use the default channel owner
        )
        
        console.log(`[AIMessageListener] Sent AI response with identity ${aiPersonId.toString().substring(0, 8)}... to topic`)
      }
    } catch (error) {
      console.error(`[AIMessageListener] Error generating AI response:`, error)
    }
  }
}

export default AIMessageListener;