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
    this.aiTopics = new Set() // Track which topics have AI enabled
    this.DEBOUNCE_MS = 200
  }

  /**
   * Start listening for messages in AI topics
   */
  start() {
    console.log('[AIMessageListener] Starting message listener...')
    
    if (!this.channelManager) {
      console.error('[AIMessageListener] Cannot start - channelManager is undefined')
      return
    }
    
    if (!this.channelManager.onUpdated) {
      console.error('[AIMessageListener] Cannot start - channelManager.onUpdated is undefined')
      return
    }
    
    // Set up channel update listener (following LAMA's pattern)
    this.unsubscribe = this.channelManager.onUpdated.listen(async (
      channelInfoIdHash,
      channelId, 
      channelOwner,
      timeOfEarliestChange,
      data
    ) => {
      // Debounce frequent updates
      const existingTimer = this.debounceTimers.get(channelId)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }
      
      const timerId = setTimeout(async () => {
        this.debounceTimers.delete(channelId)
        
        // Check if this is an AI topic
        if (!this.isAITopic(channelId)) {
          return // Skip non-AI topics
        }
        
        console.log(`[AIMessageListener] AI topic update: ${channelId}`)
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
   * Register a topic as an AI topic
   */
  registerAITopic(topicId, modelId) {
    this.aiTopics.add(topicId)
    console.log(`[AIMessageListener] Registered AI topic: ${topicId} with model: ${modelId}`)
  }
  
  /**
   * Check if a topic is an AI topic
   */
  isAITopic(topicId) {
    // AI topics have specific patterns
    return topicId === 'default' || 
           topicId === 'ai-chat' || 
           topicId.includes('ai-') ||
           this.aiTopics.has(topicId)
  }
  
  /**
   * Handle channel update for an AI topic
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
      // Join the topic to get the room
      const topicRoom = await instance.topicModel.joinTopic(channelId)
      if (!topicRoom) {
        console.error(`[AIMessageListener] Could not join topic ${channelId}`)
        return
      }
      
      // Get recent messages
      const messages = await topicRoom.getRecentMessages(10)
      console.log(`[AIMessageListener] Found ${messages.length} recent messages`)
      
      // Find the last user message that needs a response
      let lastUserMessage = null
      let lastAIMessage = null
      
      for (const msg of messages.reverse()) {
        // Check if message is from AI
        if (this.isAIMessage(msg)) {
          lastAIMessage = msg
        } else if (msg.text && msg.text.trim()) {
          lastUserMessage = msg
        }
        
        // If we found a user message after the last AI message, we need to respond
        if (lastUserMessage && (!lastAIMessage || lastUserMessage.timestamp > lastAIMessage.timestamp)) {
          console.log(`[AIMessageListener] Found user message needing response: "${lastUserMessage.text}"`)
          await this.processUserMessage(topicRoom, lastUserMessage)
          break
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
    // For now, check for known AI names or IDs
    if (!message.from) return false
    
    const aiNames = ['GPT-4', 'Claude', 'Llama', 'Ollama', 'AI Assistant']
    return aiNames.some(name => message.from.includes(name))
  }
  
  /**
   * Process a user message and generate AI response
   */
  async processUserMessage(topicRoom, message) {
    console.log(`[AIMessageListener] Processing user message: "${message.text}"`)
    
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
        content: message.text
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
        
        // Create AI message with proper identity
        const aiMessage = await createAIMessage(
          response,
          aiPersonId,
          undefined, // previousMessageHash
          undefined, // channelIdHash
          topicRoom.topicId,   // topicIdHash
          modelId    // modelId for metadata
        )
        
        // Post message to the AI's channel (proper 1-to-1 pattern)
        await this.channelManager.postToChannel(
          topicRoom.topicId,
          aiMessage,
          aiPersonId // AI posts to its own channel
        )
        
        console.log(`[AIMessageListener] Sent AI response with identity ${aiPersonId.toString().substring(0, 8)}... to topic`)
      }
    } catch (error) {
      console.error(`[AIMessageListener] Error generating AI response:`, error)
    }
  }
}

export default AIMessageListener;