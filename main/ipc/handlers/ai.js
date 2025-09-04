/**
 * AI/LLM IPC Handlers
 * Handles all AI-related IPC calls from renderer
 */

import llmManager from '../../services/llm-manager.js';
import stateManager from '../../state/manager.js';

const aiHandlers = {
  async chat(event, { messages, modelId }) {
    console.log('[AIHandler] Chat request with', messages.length, 'messages')
    
    try {
      // Ensure LLM manager is initialized
      if (!llmManager.isInitialized) {
        await llmManager.init()
      }
      
      // Process chat through LLM
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
      
      const tool = llmManager.mcpTools.get(toolName)
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`)
      }
      
      const client = llmManager.mcpClients.get(tool.server)
      if (!client) {
        throw new Error(`MCP server ${tool.server} not connected`)
      }
      
      const result = await client.callTool({
        name: toolName,
        arguments: parameters
      })
      
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
  }
}

export default aiHandlers