/**
 * AI/LLM IPC Handlers
 * Handles all AI-related IPC calls from renderer
 */

import llmManager from '../../services/llm-manager.js';
import stateManager from '../../state/manager.js';

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
    console.log('[AIHandler] Set default model:', modelId)
    
    try {
      if (!llmManager.isInitialized) {
        await llmManager.init()
      }
      
      const model = llmManager.getModel(modelId)
      if (!model) {
        throw new Error(`Model ${modelId} not found`)
      }
      
      llmManager.defaultModelId = modelId
      
      // Save to state
      stateManager.setState('ai.defaultModelId', modelId)
      
      return {
        success: true,
        data: { modelId }
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
  }
}

export default aiHandlers