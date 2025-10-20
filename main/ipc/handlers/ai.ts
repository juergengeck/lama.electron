/**
 * AI IPC Handlers (Thin Adapter)
 *
 * Maps Electron IPC calls to AIAssistantHandler methods.
 * Uses the refactored AIAssistantHandler from nodeOneCore.aiAssistantModel
 */

import nodeOneCore from '../../core/node-one-core.js';
import llmManager from '../../services/llm-manager.js';
import type { IpcMainInvokeEvent } from 'electron';
import electron from 'electron';
const { BrowserWindow } = electron;

/**
 * Get the AIAssistantHandler from nodeOneCore
 * This uses the refactored architecture with platform abstraction
 */
function getAIHandler() {
  if (!nodeOneCore.aiAssistantModel) {
    throw new Error('AI Assistant Handler not initialized - ONE.core not provisioned');
  }
  return nodeOneCore.aiAssistantModel;
}

/**
 * Thin IPC adapter - maps ipcMain.handle() calls to handler methods
 */
const aiHandlers = {
  /**
   * Chat with AI (with streaming support)
   */
  async chat(
    event: IpcMainInvokeEvent,
    { messages, modelId, stream = false, topicId }: {
      messages: Array<{ role: string; content: string }>;
      modelId?: string;
      stream?: boolean;
      topicId?: string;
    }
  ) {
    // Delegate to llmManager for chat operations
    const model = modelId || llmManager.getDefaultModel()?.id;
    if (!model) {
      return { success: false, error: 'No model specified or default model set' };
    }

    try {
      const response = await llmManager.chat(messages, model, {
        onStream: stream ? (chunk: string) => {
          event.sender.send('ai:stream', { chunk, topicId });
        } : undefined
      });

      return {
        success: true,
        data: {
          response: response,
          modelId: model,
          streamed: stream
        }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get available AI models
   */
  async getModels(event: IpcMainInvokeEvent) {
    try {
      const models = llmManager.getAvailableModels();
      const defaultModelId = llmManager.getDefaultModel()?.id || null;

      return {
        success: true,
        models: models.map(m => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          isLoaded: m.isLoaded || false,
          isDefault: m.id === defaultModelId
        })),
        defaultModelId
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Set default AI model
   */
  async setDefaultModel(
    event: IpcMainInvokeEvent,
    { modelId }: { modelId: string }
  ) {
    try {
      const success = llmManager.setDefaultModel(modelId);
      if (success && nodeOneCore.aiAssistantModel) {
        await nodeOneCore.aiAssistantModel.setDefaultModel(modelId);
      }
      return success;
    } catch (error: any) {
      console.error('[AI IPC] setDefaultModel error:', error);
      return false;
    }
  },

  /**
   * Set API key for a provider
   */
  async setApiKey(
    event: IpcMainInvokeEvent,
    { provider, apiKey }: { provider: string; apiKey: string }
  ) {
    // Store API key via nodeOneCore
    try {
      await nodeOneCore.secureStore(provider + '_api_key', apiKey);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get available MCP tools
   */
  async getTools(event: IpcMainInvokeEvent) {
    try {
      const tools = llmManager.getMCPTools();
      return {
        success: true,
        tools: Array.from(tools.values())
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Execute an MCP tool
   */
  async executeTool(
    event: IpcMainInvokeEvent,
    { toolName, parameters }: { toolName: string; parameters: any }
  ) {
    try {
      const result = await llmManager.executeMCPTool(toolName, parameters);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Initialize LLM manager
   */
  async initializeLLM(event: IpcMainInvokeEvent) {
    try {
      await llmManager.init();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Debug MCP tools registration
   */
  async debugTools(event: IpcMainInvokeEvent) {
    return {
      success: true,
      toolCount: llmManager.getMCPTools().size,
      tools: Array.from(llmManager.getMCPTools().keys())
    };
  },

  /**
   * Get or create AI contact for a model
   */
  async getOrCreateContact(
    event: IpcMainInvokeEvent,
    { modelId }: { modelId: string }
  ) {
    try {
      const handler = getAIHandler();
      const personId = await handler.ensureAIContactForModel(modelId);
      return { success: true, personId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Test an API key with the provider
   */
  async testApiKey(
    event: IpcMainInvokeEvent,
    { provider, apiKey }: { provider: string; apiKey: string }
  ) {
    // TODO: Implement API key testing for each provider
    return { success: true, valid: true };
  },

  /**
   * Get the default model ID from AI settings
   */
  'ai:getDefaultModel': async (event: IpcMainInvokeEvent): Promise<string | null> => {
    return llmManager.getDefaultModel()?.id || null;
  },

  /**
   * Ensure default AI chats exist when user navigates to chat view
   * This is called lazily when the chat view is accessed, not during model selection
   * DELEGATES to AIAssistantHandler
   */
  'ai:ensureDefaultChats': async (event: IpcMainInvokeEvent) => {
    try {
      const handler = getAIHandler();
      await handler.ensureDefaultChats();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Discover Claude models from Anthropic API
   * Called after API key is saved to dynamically register available models
   */
  async discoverClaudeModels(
    event: IpcMainInvokeEvent,
    params?: { apiKey?: string }
  ) {
    try {
      await llmManager.discoverClaudeModels();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

export default aiHandlers;
