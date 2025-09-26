/**
 * AI/LLM IPC Handlers
 * Handles all AI-related IPC calls from renderer
 */

import llmManager from '../../services/llm-manager.js';
import stateManager from '../../state/manager.js';
import nodeOneCore from '../../core/node-one-core.js';

const aiHandlers = {
  async chat(event, { messages, modelId, stream = false }) {
    console.log('[AIHandler] Chat request with', messages.length, 'messages, streaming:', stream)
    
    try {
      // Ensure LLM manager is initialized
      if (!llmManager.isInitialized) {
        await llmManager.init()
      }
      
      if (stream) {
        // Streaming mode - send chunks via IPC events
        let fullResponse = ''
        const response = await llmManager.chat(messages, modelId, {
          onStream: (chunk) => {
            fullResponse += chunk
            // Send streaming chunk to renderer
            event.sender.send('ai:stream-chunk', {
              chunk,
              partial: fullResponse
            })
          }
        })
        
        // Send final complete message
        event.sender.send('ai:stream-complete', {
          response,
          modelId: modelId || llmManager.defaultModelId
        })
        
        return {
          success: true,
          data: {
            response,
            modelId: modelId || llmManager.defaultModelId,
            streamed: true
          }
        }
      } else {
        // Non-streaming mode - wait for full response
        const response = await llmManager.chat(messages, modelId)
        console.log('[AIHandler] Got response:', response?.substring(0, 100) + '...')
        
        const result = {
          success: true,
          data: {
            response,
            modelId: modelId || llmManager.defaultModelId
          }
        }
        
        console.log('[AIHandler] Returning result:', result.success, 'with response length:', response?.length)
        return result
      }
    } catch (error) {
      console.error('[AIHandler] Chat error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  async getModels(event) {
    console.log('[AIHandler] Get models request')
    
    try {
      if (!llmManager.isInitialized) {
        await llmManager.init()
      }
      
      const models = llmManager.getModels()
      const defaultModel = llmManager.getDefaultModel()
      
      return {
        success: true,
        data: {
          models,
          defaultModelId: defaultModel?.id
        }
      }
    } catch (error) {
      console.error('[AIHandler] Get models error:', error)
      return {
        success: false,
        error: error.message,
        data: {
          models: [],
          defaultModelId: null
        }
      }
    }
  },

  async setDefaultModel(event, { modelId }) {
    console.log('[AIHandler] ==========================================')
    console.log('[AIHandler] SET DEFAULT MODEL CALLED')
    console.log('[AIHandler] Model ID:', modelId)
    console.log('[AIHandler] ==========================================')

    // Chat creation moved to ensureDefaultChats handler

    try {
      if (!llmManager.isInitialized) {
        await llmManager.init()
      }
      
      const model = llmManager.getModel(modelId)
      if (!model) {
        throw new Error(`Model ${modelId} not found`)
      }

      // AI Assistant is the single source of truth for default model
      console.log('[AIHandler] Creating AI contact for newly selected model:', modelId)
      await nodeOneCore.aiAssistantModel.createAIContact(modelId, model.name)

      // Set default model through AI Assistant
      await nodeOneCore.aiAssistantModel.setDefaultModel(modelId)

      // Don't create chats here - wait for user to navigate to chat view
      console.log('[AIHandler] Model set successfully, chats will be created when accessed')

      // Notify all windows that the model has changed
      const { BrowserWindow } = await import('electron')
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('ai:defaultModelChanged', { modelId, modelName: model.name })
      })

      return {
        success: true,
        modelId,
        modelName: model.name
      }
    } catch (error) {
      console.error('[AIHandler] Set default model error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  async setApiKey(event, { provider, apiKey }) {
    console.log('[AIHandler] Set API key for:', provider)
    
    try {
      if (!llmManager.isInitialized) {
        await llmManager.init()
      }
      
      await llmManager.setApiKey(provider, apiKey)
      
      // Store securely (implement proper encryption)
      stateManager.setState(`ai.apiKeys.${provider}`, apiKey)
      
      return {
        success: true,
        data: { provider }
      }
    } catch (error) {
      console.error('[AIHandler] Set API key error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  async getTools(event) {
    console.log('[AIHandler] Get MCP tools request')
    
    try {
      if (!llmManager.isInitialized) {
        await llmManager.init()
      }
      
      const tools = Array.from(llmManager.mcpTools.values())
      
      return {
        success: true,
        data: {
          tools,
          count: tools.length
        }
      }
    } catch (error) {
      console.error('[AIHandler] Get tools error:', error)
      return {
        success: false,
        error: error.message,
        data: {
          tools: [],
          count: 0
        }
      }
    }
  },

  async executeTool(event, { toolName, parameters }) {
    console.log('[AIHandler] Execute tool:', toolName)
    
    try {
      if (!llmManager.isInitialized) {
        await llmManager.init()
      }
      
      // Use mcpManager through llmManager
      const { default: mcpManager } = await import('../../services/mcp-manager.js')
      const result = await mcpManager.executeTool(toolName, parameters)
      
      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('[AIHandler] Tool execution error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  async initializeLLM(event) {
    console.log('[AIHandler] Initialize LLM request')
    
    try {
      if (llmManager.isInitialized) {
        return {
          success: true,
          data: {
            initialized: true,
            modelCount: llmManager.models.size,
            toolCount: llmManager.mcpTools.size
          }
        }
      }
      
      await llmManager.init()
      
      return {
        success: true,
        data: {
          initialized: true,
          modelCount: llmManager.models.size,
          toolCount: llmManager.mcpTools.size
        }
      }
    } catch (error) {
      console.error('[AIHandler] Initialize error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  async debugTools(event) {
    console.log('[AIHandler] Debug tools request')
    
    try {
      const debugInfo = llmManager.debugToolsState()
      return {
        success: true,
        data: debugInfo
      }
    } catch (error) {
      console.error('[AIHandler] Debug tools error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  async getOrCreateContact(event, { modelId }) {
    console.log('[AIHandler] Get or create AI contact for model:', modelId)
    
    try {
      // Get the node instance
      const { default: nodeProvisioning } = await import('../../services/node-provisioning.js')
      const nodeOneCore = nodeProvisioning.getNodeInstance()
      
      if (!nodeOneCore || !nodeOneCore.aiAssistantModel) {
        throw new Error('AI system not initialized')
      }
      
      // Ensure the AI contact exists for this model
      const personId = await nodeOneCore.aiAssistantModel.ensureAIContactForModel(modelId)
      
      if (!personId) {
        throw new Error(`Failed to create AI contact for model ${modelId}`)
      }
      
      return {
        success: true,
        data: {
          personId: personId.toString(),
          modelId
        }
      }
    } catch (error) {
      console.error('[AIHandler] Get/create AI contact error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Test an API key with the provider
   */
  async testApiKey(event, { provider, apiKey }) {
    console.log(`[AIHandler] Testing ${provider} API key`)
    
    try {
      if (!llmManager.isInitialized) {
        await llmManager.init()
      }
      
      // Test the API key based on provider
      let isValid = false
      
      if (provider === 'anthropic') {
        // Test Claude API key
        isValid = await llmManager.testClaudeApiKey(apiKey)
      } else if (provider === 'openai') {
        // Test OpenAI API key  
        isValid = await llmManager.testOpenAIApiKey(apiKey)
      } else {
        throw new Error(`Unknown provider: ${provider}`)
      }
      
      return {
        success: isValid,
        data: { valid: isValid }
      }
    } catch (error) {
      console.error('[AIHandler] Test API key error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Get the default model ID from AI settings
   */
  'ai:getDefaultModel': async (event) => {
    try {
      const nodeOneCore = getNodeOneCoreInstance()

      if (!nodeOneCore?.aiSettingsManager) {
        console.log('[AIHandler] AI settings manager not available')
        return null
      }

      const modelId = await nodeOneCore.aiSettingsManager.getDefaultModelId()
      console.log('[AIHandler] Default model ID:', modelId)
      return modelId
    } catch (error) {
      console.error('[AIHandler] Error getting default model:', error)
      return null
    }
  },

  /**
   * Ensure default AI chats exist when user navigates to chat view
   * This is called lazily when the chat view is accessed, not during model selection
   */
  'ai:ensureDefaultChats': async (event) => {
    try {
      const nodeOneCore = getNodeOneCoreInstance()

      if (!nodeOneCore?.initialized) {
        console.log('[AIHandler] Node not initialized')
        return { success: false, error: 'Node not initialized' }
      }

      // Get the default model
      const modelId = await nodeOneCore.aiAssistantModel.getDefaultModel()
      if (!modelId) {
        console.log('[AIHandler] No default model set')
        return { success: false, error: 'No default model set' }
      }

      // Get the AI participant for this model
      const aiContacts = nodeOneCore.aiAssistantModel.getAllContacts()
      const aiParticipant = aiContacts.find(c => c.modelId === modelId)
      if (!aiParticipant) {
        console.error('[AIHandler] No AI contact found for model:', modelId)
        return {
          success: false,
          error: 'No AI contact found for model: ' + modelId
        }
      }
      const aiParticipantId = aiParticipant.personId
      console.log('[AIHandler] AI participant ID:', aiParticipantId.substring(0, 8))

      // Helper function to ensure topic exists with proper participants
      const ensureTopicWithParticipants = async (name, topicId, participants) => {
        let isNewTopic = false

        try {
          const existing = await nodeOneCore.topicModel.topics.queryById(topicId)
          if (existing) {
            console.log(`[AIHandler] ${name} topic already exists`)

            // Check if topic has messages
            console.log(`[AIHandler] Entering topic room for ${name} (${topicId}) to check messages...`)
            const topicRoom = await nodeOneCore.topicModel.enterTopicRoom(topicId)
            console.log(`[AIHandler] Retrieving all messages for ${name}...`)
            const messages = await topicRoom.retrieveAllMessages()
            console.log(`[AIHandler] Found ${messages.length} messages in ${name} topic`)

            if (messages.length === 0) {
              console.log(`[AIHandler] ${name} topic exists but is empty, will send welcome`)
              // For Hi topic, return 'empty' to indicate it needs static welcome
              // For LAMA topic, return true for AI welcome
              return topicId === 'hi' ? 'empty' : true
            }

            console.log(`[AIHandler] ${name} topic has ${messages.length} messages, no welcome needed`)
            return false // Has messages, no welcome needed
          }
        } catch (e) {
          // Topic doesn't exist, create it
          isNewTopic = true
        }

        console.log(`[AIHandler] Creating ${name} topic with AI participant`)
        await nodeOneCore.topicGroupManager.createGroupTopic(name, topicId, participants)
        console.log(`[AIHandler] ${name} topic created with AI participant`)

        // For Hi topic, we need to track if it was newly created for static message
        if (topicId === 'hi') {
          return isNewTopic ? 'new' : false // Return 'new' if just created
        }
        return true // LAMA new topic needs welcome
      }

      // Create/ensure Hi chat
      const hiNeedsWelcome = await ensureTopicWithParticipants('Hi', 'hi', [aiParticipantId])

      // Create/ensure LAMA chat
      const lamaNeedsWelcome = await ensureTopicWithParticipants('LAMA', 'lama', [aiParticipantId])

      // Ensure LLM is ready before sending welcome messages
      if (hiNeedsWelcome || lamaNeedsWelcome) {
        console.log('[AIHandler] Pre-warming LLM connection...')
        await llmManager.preWarmConnection()
      }

      // Send welcome messages to chats that need them
      if (hiNeedsWelcome === 'new' || hiNeedsWelcome === 'empty') {
        try {
          console.log(`[AIHandler] Sending static welcome message to Hi chat (${hiNeedsWelcome})`)
          const hiTopicRoom = await nodeOneCore.topicModel.enterTopicRoom('hi')

          // Send static welcome message (not LLM-generated)
          const staticWelcome = `Hi! I'm LAMA, your local AI assistant.

You can make me your own, give me a name of your choice, give me a persistent identity.

We treat LLM as first-class citizens - they're communication peers just like people - and I will manage their learnings for you.
You can immediately start using the app right here in this chat, or create new conversations with LLM or your friends and other contacts.

The LAMA chat below is my memory. You can configure its visibility in Settings. All I learn from your conversations gets stored there for context, and is fully transparent for you. Nobody else can see this content.

You can also access, share, or delete what I know in Settings, in the Data section.

What can I help you with today?`

          // Send message with AI participant as sender
          await hiTopicRoom.sendMessage(staticWelcome, aiParticipantId)

          // Verify the message was sent
          const hiMessages = await hiTopicRoom.retrieveAllMessages()
          console.log(`[AIHandler] After sending welcome, Hi chat has ${hiMessages.length} messages`)
          if (hiMessages.length > 0) {
            console.log('[AIHandler] First Hi message:', hiMessages[0].data?.text || hiMessages[0].text)
          }
        } catch (error) {
          console.error('[AIHandler] Failed to send Hi welcome:', error)
        }
      }

      if (lamaNeedsWelcome) {
        try {
          console.log('[AIHandler] Sending welcome message to LAMA chat')
          const lamaTopicRoom = await nodeOneCore.topicModel.enterTopicRoom('lama')
          nodeOneCore.aiAssistantModel.registerAITopic('lama', modelId)
          await nodeOneCore.aiAssistantModel.handleNewTopic('lama', lamaTopicRoom)

          // Verify the message was sent
          const lamaMessages = await lamaTopicRoom.retrieveAllMessages()
          console.log(`[AIHandler] After sending welcome, LAMA chat has ${lamaMessages.length} messages`)
          if (lamaMessages.length > 0) {
            console.log('[AIHandler] First LAMA message:', lamaMessages[0].data?.text || lamaMessages[0].text)
          }
        } catch (error) {
          console.error('[AIHandler] Failed to send LAMA welcome:', error)
        }
      }

      return {
        success: true,
        topics: {
          hi: 'hi',
          lama: 'lama'
        },
        created: {
          hi: hiNeedsWelcome === 'new',
          lama: lamaNeedsWelcome
        }
      }
    } catch (error) {
      console.error('[AIHandler] Ensure default chats error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default aiHandlers
