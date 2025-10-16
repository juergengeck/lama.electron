/**
 * AI/LLM IPC Handlers
 * Handles all AI-related IPC calls from renderer
 */

import llmManager from '../../services/llm-manager.js';
import stateManager from '../../state/manager.js';
import nodeOneCore from '../../core/node-one-core.js';
import type { IpcMainInvokeEvent } from 'electron';

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatParams {
  messages: ChatMessage[];
  modelId?: string;
  stream?: boolean;
  topicId?: string;
}

interface SetDefaultModelParams {
  modelId: string;
}

interface SetApiKeyParams {
  provider: string;
  apiKey: string;
}

interface ExecuteToolParams {
  toolName: string;
  parameters: any;
}

interface GetOrCreateContactParams {
  modelId: string;
}

interface TestApiKeyParams {
  provider: string;
  apiKey: string;
}

interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: any;
}

const aiHandlers = {
  async chat(event: IpcMainInvokeEvent, { messages, modelId, stream = false, topicId }: ChatParams): Promise<IpcResponse> {
    console.log('[AIHandler] Chat request with', messages.length, 'messages, streaming:', stream, 'topicId:', topicId)

    try {
      // Ensure LLM manager is initialized
      if (!llmManager.isInitialized) {
        await llmManager.init()
      }

      if (stream) {
        // Streaming mode - send chunks via IPC events with analysis
        let fullResponse = ''
        const result: any = await llmManager.chatWithAnalysis(messages, modelId, {
          onStream: (chunk: string) => {
            fullResponse += chunk
            // Send streaming chunk to renderer
            event.sender.send('ai:stream-chunk', {
              chunk,
              partial: fullResponse
            })
          }
        })

        // Process analysis in background if available
        if (result.analysis && nodeOneCore.topicAnalysisModel && topicId) {
          setImmediate(async () => {
            try {
              console.log('[AIHandler] Processing analysis in background for topic:', topicId)

              // Process all subjects from analysis
              if (result.analysis.subjects && Array.isArray(result.analysis.subjects)) {
                for (const subject of result.analysis.subjects) {
                  if (subject.isNew) {
                    // Extract keyword terms from keyword objects
                    const keywordTerms = subject.keywords?.map((kw: any) => kw.term || kw) || []

                    // Create subject -> returns subject with idHash
                    const createdSubject = await nodeOneCore.topicAnalysisModel.createSubject(
                      topicId,
                      keywordTerms,
                      subject.name,
                      subject.description,
                      0.8
                    )

                    console.log(`[AIHandler] Created subject: ${subject.name} with ID: ${createdSubject.idHash}`)

                    // Store each keyword with reference to this subject
                    for (const keyword of (subject.keywords || [])) {
                      const term = keyword.term || keyword
                      await nodeOneCore.topicAnalysisModel.addKeywordToSubject(
                        topicId,
                        term,
                        createdSubject.idHash
                      )
                    }

                    console.log(`[AIHandler] Stored ${subject.keywords?.length || 0} keywords for subject: ${subject.name}`)
                  }
                }
              }
            } catch (error) {
              console.error('[AIHandler] Error processing analysis:', error)
            }
          })
        }

        // Send final complete message
        event.sender.send('ai:stream-complete', {
          response: result.response,
          modelId: modelId || (llmManager as any).defaultModelId
        })

        return {
          success: true,
          data: {
            response: result.response,
            modelId: modelId || (llmManager as any).defaultModelId,
            streamed: true
          }
        }
      } else {
        // Non-streaming mode - wait for full response with analysis
        const chatResult: any = await llmManager.chatWithAnalysis(messages, modelId)
        const response = chatResult.response
        const responseStr = String(response || '');
        console.log('[AIHandler] Got response:', responseStr.substring(0, 100) + '...')

        // Process analysis in background if available
        if (chatResult.analysis && nodeOneCore.topicAnalysisModel && topicId) {
          setImmediate(async () => {
            try {
              console.log('[AIHandler] Processing analysis in background for topic:', topicId)

              // Process all subjects from analysis
              if (chatResult.analysis.subjects && Array.isArray(chatResult.analysis.subjects)) {
                for (const subject of chatResult.analysis.subjects) {
                  if (subject.isNew) {
                    // Extract keyword terms from keyword objects
                    const keywordTerms = subject.keywords?.map((kw: any) => kw.term || kw) || []

                    // Create subject -> returns subject with idHash
                    const createdSubject = await nodeOneCore.topicAnalysisModel.createSubject(
                      topicId,
                      keywordTerms,
                      subject.name,
                      subject.description,
                      0.8
                    )

                    console.log(`[AIHandler] Created subject: ${subject.name} with ID: ${createdSubject.idHash}`)

                    // Store each keyword with reference to this subject
                    for (const keyword of (subject.keywords || [])) {
                      const term = keyword.term || keyword
                      await nodeOneCore.topicAnalysisModel.addKeywordToSubject(
                        topicId,
                        term,
                        createdSubject.idHash
                      )
                    }

                    console.log(`[AIHandler] Stored ${subject.keywords?.length || 0} keywords for subject: ${subject.name}`)
                  }
                }
              }
            } catch (error) {
              console.error('[AIHandler] Error processing analysis:', error)
            }
          })
        }

        const result = {
          success: true,
          data: {
            response,
            modelId: modelId || (llmManager as any).defaultModelId
          }
        }

        console.log('[AIHandler] Returning result:', result.success, 'with response length:', responseStr.length)
        return result
      }
    } catch (error) {
      console.error('[AIHandler] Chat error:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  async getModels(event: IpcMainInvokeEvent): Promise<IpcResponse> {
    console.log('[AIHandler] Get models request')

    try {
      if (!llmManager.isInitialized) {
        await llmManager.init()
      }

      const models = llmManager.getAvailableModels()
      // Get default model from AI Assistant Model which is the single source of truth
      const defaultModel = nodeOneCore?.aiAssistantModel?.getDefaultModel()
      const defaultModelId = defaultModel?.id || null

      // Mark models as loaded if they have AI contacts created
      // A model is loaded if it has been initialized with an AI contact (person ID)
      const modelsWithLoadStatus = models.map((model: any) => {
        const hasAIContact = nodeOneCore?.aiAssistantModel?.getPersonIdForModel(model.id) !== null
        return {
          ...model,
          isLoaded: hasAIContact,
          isDefault: model.id === defaultModelId
        }
      })

      return {
        success: true,
        data: {
          models: modelsWithLoadStatus,
          defaultModelId
        }
      }
    } catch (error) {
      console.error('[AIHandler] Get models error:', error)
      return {
        success: false,
        error: (error as Error).message,
        data: {
          models: [],
          defaultModelId: null
        }
      }
    }
  },

  async setDefaultModel(event: IpcMainInvokeEvent, { modelId }: SetDefaultModelParams): Promise<IpcResponse> {
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
        error: (error as Error).message
      }
    }
  },

  async setApiKey(event: IpcMainInvokeEvent, { provider, apiKey }: SetApiKeyParams): Promise<IpcResponse> {
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
        error: (error as Error).message
      }
    }
  },

  async getTools(event: IpcMainInvokeEvent): Promise<IpcResponse> {
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
        error: (error as Error).message,
        data: {
          tools: [],
          count: 0
        }
      }
    }
  },

  async executeTool(event: IpcMainInvokeEvent, { toolName, parameters }: ExecuteToolParams): Promise<IpcResponse> {
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
        error: (error as Error).message
      }
    }
  },

  async initializeLLM(event: IpcMainInvokeEvent): Promise<IpcResponse> {
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
        error: (error as Error).message
      }
    }
  },

  async debugTools(event: IpcMainInvokeEvent): Promise<IpcResponse> {
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
        error: (error as Error).message
      }
    }
  },

  async getOrCreateContact(event: IpcMainInvokeEvent, { modelId }: GetOrCreateContactParams): Promise<IpcResponse> {
    console.log('[AIHandler] Get or create AI contact for model:', modelId)

    try {
      // Use the imported nodeOneCore instance (don't try to get from nodeProvisioning)
      if (!nodeOneCore || !nodeOneCore.aiAssistantModel) {
        throw new Error('AI system not initialized')
      }

      // Ensure the AI contact exists for this model
      const personId = await nodeOneCore.aiAssistantModel.ensureAIContactForModel(modelId)

      if (!personId) {
        throw new Error(`Failed to create AI contact for model ${modelId}`)
      }

      // Emit contacts:updated event to notify UI
      const { BrowserWindow } = await import('electron')
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('contacts:updated')
      })
      console.log('[AIHandler] Emitted contacts:updated event after creating AI contact')

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
        error: (error as Error).message
      }
    }
  },

  /**
   * Test an API key with the provider
   */
  async testApiKey(event: IpcMainInvokeEvent, { provider, apiKey }: TestApiKeyParams): Promise<IpcResponse> {
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
        error: (error as Error).message
      }
    }
  },

  /**
   * Get the default model ID from AI settings
   */
  'ai:getDefaultModel': async (event: IpcMainInvokeEvent): Promise<string | null> => {
    try {
      // Use the imported nodeOneCore instance

      if (!nodeOneCore?.aiAssistantModel) {
        console.log('[AIHandler] AI assistant model not available')
        return null
      }

      // Use the new async method that loads from settings if needed
      const modelId = await nodeOneCore.aiAssistantModel.getDefaultModel()
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
   * DELEGATES to AIAssistantModel - we do NOT create chats here
   */
  'ai:ensureDefaultChats': async (event: IpcMainInvokeEvent): Promise<IpcResponse> => {
    try {
      if (!nodeOneCore?.initialized) {
        console.log('[AIHandler] Node not initialized')
        return { success: false, error: 'Node not initialized' }
      }

      if (!nodeOneCore.aiAssistantModel) {
        console.log('[AIHandler] AIAssistantModel not initialized')
        return { success: false, error: 'AIAssistantModel not initialized' }
      }

      // DELEGATE to AIAssistantModel - it owns default chat creation
      console.log('[AIHandler] Delegating default chat creation to AIAssistantModel')
      await nodeOneCore.aiAssistantModel.ensureDefaultChats()

      return {
        success: true,
        message: 'Default chats ensured by AIAssistantModel'
      }
    } catch (error) {
      console.error('[AIHandler] Ensure default chats error:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  /**
   * Discover Claude models from Anthropic API
   * Called after API key is saved to dynamically register available models
   */
  async discoverClaudeModels(event: IpcMainInvokeEvent, params?: { apiKey?: string }): Promise<IpcResponse> {
    console.log('[AIHandler] Discovering Claude models from API...')

    try {
      if (!llmManager.isInitialized) {
        await llmManager.init()
      }

      // Get API key from params or retrieve from storage
      let apiKey = params?.apiKey

      if (!apiKey) {
        // Try to retrieve from secure storage
        const oneCoreHandlers = await import('./one-core.js')
        const apiKeyResult = await oneCoreHandlers.default.secureRetrieve(event, { key: 'claude_api_key' })

        if (apiKeyResult?.success && apiKeyResult.value) {
          apiKey = apiKeyResult.value
        }
      }

      // Call LLM manager to discover models from API with explicit API key
      await llmManager.discoverClaudeModels(apiKey)

      // Get the updated list of models
      const models = llmManager.getModels()
      const claudeModels = models.filter((m: any) => m.provider === 'anthropic')

      console.log(`[AIHandler] Discovered ${claudeModels.length} Claude models`)

      // Automatically create AI contacts for all discovered Claude models
      if (nodeOneCore?.aiAssistantModel && claudeModels.length > 0) {
        console.log('[AIHandler] Creating AI contacts for discovered Claude models...')

        for (const model of claudeModels) {
          try {
            await nodeOneCore.aiAssistantModel.ensureAIContactForModel(model.id)
            console.log(`[AIHandler] Created AI contact for ${model.name}`)
          } catch (contactError) {
            console.warn(`[AIHandler] Failed to create contact for ${model.name}:`, contactError)
          }
        }

        // Emit contacts:updated event to notify UI
        const { BrowserWindow } = await import('electron')
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('contacts:updated')
        })
        console.log('[AIHandler] Emitted contacts:updated event after creating Claude contacts')
      }

      return {
        success: true,
        data: {
          models: claudeModels,
          count: claudeModels.length
        }
      }
    } catch (error) {
      console.error('[AIHandler] Discover Claude models error:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }
}

export default aiHandlers;