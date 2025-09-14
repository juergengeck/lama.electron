/**
 * AI Polling Message Listener
 * Polls for new messages instead of relying on channel updates
 * More reliable for single-instance architecture
 */

class AIPollingListener {
  constructor(topicModel, channelManager, llmManager, aiAssistantModel) {
    this.topicModel = topicModel
    this.channelManager = channelManager
    this.llmManager = llmManager
    this.aiAssistantModel = aiAssistantModel
    
    this.pollInterval = null
    this.isListening = false
    this.lastMessageIds = new Map() // Track last seen message per channel
    this.POLL_INTERVAL_MS = 2000 // Poll every 2 seconds
  }

  /**
   * Start polling for messages
   */
  start() {
    if (this.isListening) {
      console.log('[AIPollingListener] Already listening')
      return
    }
    
    console.log('[AIPollingListener] Starting message polling...')
    this.isListening = true
    
    // Start polling
    this.pollInterval = setInterval(() => this.pollChannels(), this.POLL_INTERVAL_MS)
    
    // Do initial poll
    this.pollChannels()
    
    console.log('[AIPollingListener] ✅ Polling started')
  }
  
  /**
   * Stop polling
   */
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
    this.isListening = false
    console.log('[AIPollingListener] Stopped')
  }
  
  /**
   * Poll all channels for new messages
   */
  async pollChannels() {
    try {
      // Get all channels
      const channels = await this.channelManager.getMatchingChannelInfos({})
      
      for (const channel of channels) {
        await this.checkChannelForNewMessages(channel.id)
      }
    } catch (error) {
      console.error('[AIPollingListener] Error polling channels:', error)
    }
  }
  
  /**
   * Check a specific channel for new messages
   */
  async checkChannelForNewMessages(channelId) {
    try {
      // Enter the topic room
      const topicRoom = await this.topicModel.enterTopicRoom(channelId)
      if (!topicRoom) return
      
      // Get all messages
      const messages = await topicRoom.retrieveAllMessages()
      if (!messages || messages.length === 0) return
      
      // Get the last message
      const lastMessage = messages[messages.length - 1]
      if (!lastMessage || !lastMessage.data?.text) return
      
      // Check if we've seen this message before
      const lastSeenId = this.lastMessageIds.get(channelId)
      const currentId = lastMessage.id || lastMessage.channelEntryHash || `${lastMessage.data.text}-${lastMessage.creationTime}`
      
      if (lastSeenId === currentId) {
        // Already processed this message
        return
      }
      
      // Update last seen ID
      this.lastMessageIds.set(channelId, currentId)
      
      // Check if this is from an AI (don't respond to our own messages)
      if (this.isAIMessage(lastMessage)) {
        return
      }
      
      // Check if the message is recent (within last 30 seconds)
      const messageAge = Date.now() - new Date(lastMessage.creationTime).getTime()
      if (messageAge > 30000) {
        // Too old, probably from before we started
        return
      }
      
      console.log(`[AIPollingListener] 🆕 New message detected in ${channelId}: "${lastMessage.data.text.substring(0, 50)}..."`)
      
      // Process the message
      await this.processUserMessage(topicRoom, lastMessage, channelId)
      
    } catch (error) {
      // Silently ignore errors for non-existent topics and channels
      // These are expected for channels that exist in ChannelManager but not as topics
    }
  }
  
  /**
   * Check if a message is from an AI
   */
  isAIMessage(message) {
    const sender = message.data?.sender || message.author
    if (!sender) return false
    
    // Get all AI person IDs
    if (this.aiAssistantModel) {
      const aiContacts = this.aiAssistantModel.getAllContacts()
      return aiContacts.some(contact => contact.personId === sender)
    }
    
    return false
  }
  
  /**
   * Process a user message and generate AI response
   */
  async processUserMessage(topicRoom, message, channelId) {
    const messageText = message.data?.text || message.text
    console.log(`[AIPollingListener] Processing message: "${messageText}"`)
    
    if (!this.llmManager) {
      console.error('[AIPollingListener] LLMManager not available')
      return
    }
    
    try {
      // Default to Ollama model
      const modelId = 'ollama:gpt-oss'
      
      // Build simple context
      const messages = [{
        role: 'user',
        content: messageText
      }]
      
      console.log(`[AIPollingListener] Generating AI response with ${modelId}...`)
      
      // Generate AI response
      const response = await this.llmManager.chat(messages, modelId)
      
      if (response) {
        console.log(`[AIPollingListener] AI response generated: "${response.substring(0, 50)}..."`)
        
        // Get the AI's personId for this model
        let aiPersonId = null
        if (this.aiAssistantModel) {
          aiPersonId = this.aiAssistantModel.getPersonIdForModel(modelId)
        }
        
        if (!aiPersonId) {
          console.error(`[AIPollingListener] No personId found for model ${modelId}`)
          return
        }
        
        // Send the AI response
        await topicRoom.sendMessage(
          response,
          aiPersonId,
          undefined
        )
        
        console.log(`[AIPollingListener] ✅ AI response sent to channel ${channelId}`)
      }
    } catch (error) {
      console.error(`[AIPollingListener] Error generating AI response:`, error)
    }
  }
}

export default AIPollingListener