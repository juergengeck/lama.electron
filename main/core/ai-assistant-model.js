/**
 * AI Assistant Model for managing AI interactions
 * This class handles AI personas, LLM objects, and message processing
 */

import electron from 'electron'
const { BrowserWindow } = electron

export class AIAssistantModel {
  constructor(nodeOneCore) {
    this.nodeOneCore = nodeOneCore
    this.llmManager = null
    this.llmObjectManager = null
    this.isInitialized = false
    this.topicModelMap = new Map()
    
    // Cache for AI contacts - modelId -> personId
    this.aiContacts = new Map()
  }

  /**
   * Pre-initialize connections to LLM services
   * This is called early to warm up connections before user needs them
   */
  async init() {
    console.log('[AIAssistantModel] Pre-warming LLM connections...')
    
    try {
      // Get the LLM manager if available
      const { default: llmManager } = await import('../services/llm-manager.js')
      if (llmManager) {
        this.llmManager = llmManager
        
        // Pre-warm Ollama connection by checking if it's available
        if (llmManager.checkOllama) {
          llmManager.checkOllama().then(available => {
            if (available) {
              console.log('[AIAssistantModel] ✅ Ollama connection pre-warmed')
            }
          }).catch(() => {
            // Silently fail - Ollama might not be running
          })
        }
        
        // Pre-warm LM Studio connection
        if (llmManager.checkLMStudio) {
          llmManager.checkLMStudio().then(available => {
            if (available) {
              console.log('[AIAssistantModel] ✅ LM Studio connection pre-warmed')
            }
          }).catch(() => {
            // Silently fail - LM Studio might not be running
          })
        }
      }
    } catch (error) {
      console.log('[AIAssistantModel] Could not pre-warm connections:', error.message)
    }
  }

  /**
   * Initialize the AI Assistant Model
   */
  async initialize(llmManager) {
    console.log('[AIAssistantModel] Initializing...')
    
    // Only set llmManager if we don't already have it from init()
    if (!this.llmManager) {
      this.llmManager = llmManager
    }
    
    // Import and create LLMObjectManager
    const LLMObjectManager = (await import('./llm-object-manager.js')).default
    this.llmObjectManager = new LLMObjectManager(this.nodeOneCore)
    console.log('[AIAssistantModel] Created LLMObjectManager')
    
    this.isInitialized = true
    console.log('[AIAssistantModel] ✅ Initialized')
    
    // Scan existing conversations for AI participants and register them
    await this.scanExistingConversations()
  }
  
  /**
   * Scan existing conversations for AI participants and register them as AI topics
   */
  async scanExistingConversations() {
    console.log('[AIAssistantModel] Scanning existing conversations for AI participants...')
    
    if (!this.nodeOneCore.topicModel || !this.llmObjectManager) {
      console.log('[AIAssistantModel] Cannot scan - missing dependencies')
      return
    }
    
    try {
      // Get all topics from the TopicModel
      const allTopics = await this.nodeOneCore.topicModel.topics.all()
      console.log(`[AIAssistantModel] Found ${allTopics.length} topics to scan`)
      
      let aiTopicCount = 0
      
      for (const topic of allTopics) {
        try {
          // Enter the topic room to check messages
          const topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(topic.id)
          const messages = await topicRoom.retrieveAllMessages()
          
          // Check if any message is from an AI participant
          let hasAIParticipant = false
          let aiModelId = null
          
          for (const message of messages) {
            const senderId = message.data?.sender || message.author
            if (senderId && this.llmObjectManager.isLLMPerson(senderId)) {
              hasAIParticipant = true
              
              // Find the model for this AI person
              const llmObjects = this.llmObjectManager.getAllLLMObjects()
              const llmObject = llmObjects.find(obj => 
                obj.personId && obj.personId.toString() === senderId.toString()
              )
              
              if (llmObject) {
                aiModelId = llmObject.modelId
                break
              }
            }
          }
          
          if (hasAIParticipant && aiModelId) {
            console.log(`[AIAssistantModel] Registering AI topic ${topic.id} for model ${aiModelId}`)
            this.registerAITopic(topic.id, aiModelId)
            aiTopicCount++
          }
        } catch (error) {
          console.warn(`[AIAssistantModel] Could not scan topic ${topic.id}:`, error.message)
        }
      }
      
      console.log(`[AIAssistantModel] ✅ Scanned ${allTopics.length} topics, registered ${aiTopicCount} as AI topics`)
    } catch (error) {
      console.error('[AIAssistantModel] Error scanning existing conversations:', error)
    }
  }

  /**
   * Register an AI topic
   */
  registerAITopic(topicId, modelId) {
    console.log(`[AIAssistantModel] Registered AI topic: ${topicId} with model: ${modelId}`)
    this.topicModelMap.set(topicId, modelId)
  }

  /**
   * Check if a topic is an AI topic
   */
  isAITopic(topicId) {
    return this.topicModelMap.has(topicId)
  }

  /**
   * Get the model ID for a topic
   */
  getModelIdForTopic(topicId) {
    return this.topicModelMap.get(topicId) || null
  }

  /**
   * Process a message for AI response
   */
  async processMessage(topicId, message, senderId) {
    console.log(`[AIAssistantModel] Processing message for topic ${topicId}: "${message}"`)
    
    try {
      // Get the model ID for this topic
      const modelId = this.topicModelMap.get(topicId)
      if (!modelId) {
        console.log('[AIAssistantModel] No AI model registered for this topic')
        return null
      }
      
      // Get the AI person ID for this model
      const aiPersonId = await this.ensureAIContactForModel(modelId)
      if (!aiPersonId) {
        console.error('[AIAssistantModel] Could not get AI person ID')
        return null
      }
      
      // Check if the message is from the AI itself
      if (senderId === aiPersonId || (senderId && aiPersonId && senderId.toString() === aiPersonId.toString())) {
        console.log('[AIAssistantModel] Message is from AI, skipping response')
        return null
      }
      
      // Get the topic room
      const topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(topicId)
      
      // Get conversation history
      const messages = await topicRoom.retrieveAllMessages()
      
      // Build message history with proper role detection
      const history = []
      
      // Get last 10 messages for context
      const recentMessages = messages.slice(-10)
      for (const msg of recentMessages) {
        const text = msg.data?.text || msg.text
        const msgSender = msg.data?.sender || msg.author
        
        if (text && text.trim()) {
          // Check if sender is AI using our isAIPerson method
          const isAI = this.isAIPerson(msgSender)
          history.push({
            role: isAI ? 'assistant' : 'user',
            content: text
          })
        }
      }
      
      // Add the new message if not already in history
      const lastHistoryMsg = history[history.length - 1]
      if (!lastHistoryMsg || lastHistoryMsg.content !== message) {
        history.push({
          role: 'user',
          content: message
        })
      }
      
      console.log(`[AIAssistantModel] Sending ${history.length} messages to LLM`)
      
      // Generate message ID for streaming
      const messageId = `ai-${Date.now()}`
      const conversationId = topicId
      let fullResponse = ''
      
      // Send thinking indicator to UI
      const windows = BrowserWindow.getAllWindows()
      for (const window of windows) {
        window.webContents.send('message:thinking', {
          conversationId,
          messageId,
          senderId: aiPersonId,
          isAI: true
        })
      }
      
      // Get AI response with streaming support
      const response = await this.llmManager.chat(history, modelId, {
        onStream: (chunk) => {
          fullResponse += chunk
          
          // Send streaming updates to UI
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('message:stream', {
              conversationId,
              messageId,
              chunk,
              partial: fullResponse,
              senderId: aiPersonId,
              isAI: true
            })
          }
        }
      })
      
      if (response) {
        // Send the response to the topic
        await topicRoom.sendMessage(response, aiPersonId)
        console.log(`[AIAssistantModel] Sent AI response to topic ${topicId}`)
        
        // Notify UI about the complete message
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('message:updated', {
            conversationId,
            message: {
              id: messageId,
              conversationId,
              text: response,
              senderId: aiPersonId,
              isAI: true,
              timestamp: new Date().toISOString(),
              status: 'sent'
            }
          })
        }
        
        return response
      }
      
      return null
    } catch (error) {
      console.error('[AIAssistantModel] Error processing message:', error)
      return null
    }
  }

  /**
   * Get or create person ID for a model
   */
  async getOrCreatePersonIdForModel(model) {
    return await this.ensureAIContactForModel(model.id)
  }

  /**
   * Create an AI contact using standard LeuteModel flow
   * Only adds AI-specific tracking via LLMObjectManager
   */
  async createAIContact(modelId, displayName) {
    console.log(`[AIAssistantModel] Setting up AI contact for ${displayName} (${modelId})`)
    
    const leuteModel = this.nodeOneCore.leuteModel
    if (!leuteModel) {
      console.error('[AIAssistantModel] LeuteModel not available')
      return null
    }

    // Check cache first
    const cached = this.aiContacts.get(modelId)
    if (cached) {
      console.log(`[AIAssistantModel] Using cached contact for ${modelId}: ${cached.toString().substring(0, 8)}...`)
      return cached
    }

    try {
      // Create Person object (ONE.core handles deduplication)
      const email = `${modelId.replace(/[^a-zA-Z0-9]/g, '_')}@ai.local`
      const personData = {
        $type$: 'Person',
        email: email,
        name: displayName
      }
      
      const { storeIdObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
      const result = await storeIdObject(personData)
      const personIdHash = typeof result === 'object' && result.idHash ? result.idHash : result
      console.log(`[AIAssistantModel] Person ID: ${personIdHash.toString().substring(0, 8)}...`)
      
      // Ensure keys exist for this person
      const { createDefaultKeys, hasDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js')
      if (!(await hasDefaultKeys(personIdHash))) {
        await createDefaultKeys(personIdHash)
        console.log(`[AIAssistantModel] Created cryptographic keys`)
      }
      
      // Check if this person is already in contacts
      const others = await leuteModel.others()
      let alreadyInContacts = false
      
      for (const someone of others) {
        try {
          const existingPersonId = await someone.mainIdentity()
          if (existingPersonId.toString() === personIdHash.toString()) {
            alreadyInContacts = true
            console.log(`[AIAssistantModel] AI contact already exists in contacts`)
            break
          }
        } catch (err) {
          // Continue checking
        }
      }
      
      // If not in contacts, create Profile and Someone
      if (!alreadyInContacts) {
        
        // Create new Profile and Someone using proper SomeoneModel API
        const ProfileModel = (await import('@refinio/one.models/lib/models/Leute/ProfileModel.js')).default
        const SomeoneModel = (await import('@refinio/one.models/lib/models/Leute/SomeoneModel.js')).default
        const myId = await leuteModel.myMainIdentity()
        
        const profile = await ProfileModel.constructWithNewProfile(
          personIdHash,
          myId,
          'default'
        )
        
        profile.personDescriptions.push({
          $type$: 'PersonName',
          name: displayName
        })
        
        await profile.saveAndLoad()
        console.log(`[AIAssistantModel] Created profile: ${profile.idHash.toString().substring(0, 8)}...`)
        
        // Create Someone using storeVersionedObject (idempotent)
        const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
        
        const newSomeone = {
          $type$: 'Someone',
          someoneId: modelId,
          mainProfile: profile.idHash,
          identities: new Map([[personIdHash, new Set([profile.idHash])]])
        }
        
        const result = await storeVersionedObject(newSomeone)
        console.log(`[AIAssistantModel] Created/found Someone: ${result.idHash.toString().substring(0, 8)}...`)
        
        await leuteModel.addSomeoneElse(result.idHash)
        console.log(`[AIAssistantModel] Added to contacts: ${result.idHash.toString().substring(0, 8)}...`)
      }
      
      // AI-SPECIFIC: Cache the person ID and register with LLMObjectManager
      this.aiContacts.set(modelId, personIdHash)
      
      if (this.llmObjectManager) {
        this.llmObjectManager.cacheAIPersonId(modelId, personIdHash)
        console.log(`[AIAssistantModel] Registered AI person with LLMObjectManager`)
      }
      
      console.log(`[AIAssistantModel] ✅ AI contact ready: ${personIdHash.toString().substring(0, 8)}...`)
      return personIdHash
      
    } catch (error) {
      console.error('[AIAssistantModel] Failed to create AI contact:', error)
      return null
    }
  }

  /**
   * Get person ID for a model
   */
  getPersonIdForModel(modelId) {
    return this.aiContacts.get(modelId) || null
  }

  /**
   * Check if a person ID is an AI person
   */
  isAIPerson(personId) {
    if (!personId) return false
    
    // Check if this person ID is in our AI contacts cache
    for (const [modelId, aiPersonId] of this.aiContacts) {
      if (aiPersonId === personId || (aiPersonId && aiPersonId.toString() === personId.toString())) {
        return true
      }
    }
    
    // Also check with LLMObjectManager if available
    if (this.llmObjectManager) {
      return this.llmObjectManager.isLLMPerson(personId)
    }
    
    return false
  }

  /**
   * Ensure AI contact exists for a specific model
   */
  async ensureAIContactForModel(modelId) {
    // Check cache first
    const existingContact = this.getPersonIdForModel(modelId)
    if (existingContact) {
      return existingContact
    }
    
    // Find the model details
    const models = this.llmManager.getAvailableModels()
    const model = models.find(m => m.id === modelId)
    
    if (!model) {
      throw new Error(`Model ${modelId} not found in available models`)
    }
    
    // Create contact (idempotent due to storeVersionedObject)
    const personId = await this.createAIContact(model.id, model.name)
    
    if (!personId) {
      throw new Error(`Failed to create AI contact for model ${modelId}`)
    }
    
    return personId
  }

  /**
   * Handle a new topic creation by sending a welcome message
   */
  async handleNewTopic(channelId, topicRoom) {
    const startTime = Date.now()
    console.log(`[AIAssistantModel] 🎯 Handling new topic: ${channelId} at ${new Date().toISOString()}`)
    
    try {
      // Get the default AI model
      const modelStartTime = Date.now()
      const model = this.getDefaultModel()
      if (!model) {
        throw new Error('No AI model available')
      }
      console.log(`[AIAssistantModel] ⏱️ Model selection took ${Date.now() - modelStartTime}ms`)
      
      // Register this as an AI topic
      this.registerAITopic(channelId, model.id || model.name)
      
      // Get or create the AI person ID for this model
      const personStartTime = Date.now()
      const aiPersonId = await this.getOrCreatePersonIdForModel(model)
      if (!aiPersonId) {
        console.error('[AIAssistantModel] Could not get AI person ID')
        return
      }
      console.log(`[AIAssistantModel] ⏱️ AI person creation took ${Date.now() - personStartTime}ms`)
      
      // Send thinking indicator to UI
      const { BrowserWindow } = await import('electron')
      const messageId = `ai-${Date.now()}`
      const windows = BrowserWindow.getAllWindows()
      for (const window of windows) {
        window.webContents.send('message:thinking', {
          conversationId: channelId,
          messageId,
          isAI: true
        })
      }
      
      // Generate welcome message from LLM
      const messages = [
        { role: 'system', content: `You are a helpful AI assistant starting a new conversation. Generate a brief, friendly welcome message. Be warm and approachable. Keep it under 2 sentences.` },
        { role: 'user', content: `Generate a welcome message for a new chat conversation.` }
      ]
      
      const llmStartTime = Date.now()
      console.log(`[AIAssistantModel] 📡 Requesting welcome message from ${model.id} at ${new Date().toISOString()}`)
      const response = await this.llmManager.chat(messages, model.id)
      const welcomeMessage = response
      console.log(`[AIAssistantModel] ⏱️ LLM response took ${Date.now() - llmStartTime}ms`)
      console.log(`[AIAssistantModel] Generated welcome: "${welcomeMessage}"`)
      
      // Send the welcome message to the topic
      const sendStartTime = Date.now()
      await topicRoom.sendMessage(welcomeMessage, aiPersonId)
      console.log(`[AIAssistantModel] ⏱️ Message send took ${Date.now() - sendStartTime}ms`)
      console.log(`[AIAssistantModel] ✅ Welcome message sent to topic ${channelId}`)
      console.log(`[AIAssistantModel] ⏱️ TOTAL handleNewTopic time: ${Date.now() - startTime}ms`)
      
      // Notify UI about the complete message
      for (const window of windows) {
        window.webContents.send('message:updated', { 
          conversationId: channelId,
          message: {
            id: messageId,
            conversationId: channelId,
            text: welcomeMessage,
            senderId: aiPersonId,
            isAI: true,
            timestamp: new Date().toISOString(),
            status: 'sent'
          }
        })
      }
      
    } catch (error) {
      console.error('[AIAssistantModel] Error handling new topic:', error)
    }
  }

  /**
   * Get the default AI model
   */
  getDefaultModel() {
    console.log('[AIAssistantModel] 🔍 getDefaultModel called')
    
    if (!this.llmManager) {
      console.warn('[AIAssistantModel] ❌ LLMManager not available')
      return null
    }
    
    // Use the user's selected default model
    const selectedModelId = this.llmManager.defaultModelId
    const models = this.llmManager.getAvailableModels()
    
    if (selectedModelId) {
      const selectedModel = models.find(m => m.id === selectedModelId)
      if (selectedModel) {
        console.log(`[AIAssistantModel] Using user's selected model: ${selectedModelId}`)
        return selectedModel
      }
    }
    
    // Fallback to first available model
    if (models.length > 0) {
      console.log(`[AIAssistantModel] No default set, using first model: ${models[0].id}`)
      return models[0]
    }
    
    throw new Error('No AI models available')
  }

  /**
   * Set up AI contacts for all available models
   */
  async setupAIContacts(models) {
    console.log(`[AIAssistantModel] Setting up ${models.length} AI contacts...`)
    
    const createdContacts = []
    
    for (const model of models) {
      try {
        const personId = await this.createAIContact(model.id, model.name)
        if (personId) {
          createdContacts.push({
            modelId: model.id,
            personId: personId,
            name: model.name
          })
        }
      } catch (error) {
        console.error(`[AIAssistantModel] Failed to create contact for ${model.name}:`, error)
      }
    }
    
    console.log(`[AIAssistantModel] ✅ Set up ${createdContacts.length} AI contacts`)
    return createdContacts
  }

  /**
   * Get all AI contacts that have been set up
   * This is AI-specific tracking, not general contact management
   */
  getAllContacts() {
    return Array.from(this.aiContacts.entries()).map(([modelId, personId]) => {
      const models = this.llmManager?.getAvailableModels() || []
      const model = models.find(m => m.id === modelId)
      return {
        modelId,
        personId,
        name: model?.name || modelId
      }
    })
  }

}

export default AIAssistantModel