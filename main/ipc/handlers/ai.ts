/**
 * AI IPC Handlers (Thin Adapter)
 *
 * Maps Electron IPC calls to AIAssistantHandler methods.
 * Uses the refactored AIAssistantHandler from nodeOneCore.aiAssistantModel
 */

import nodeOneCore from '../../core/node-one-core.js';
import llmManager from '../../services/llm-manager-singleton.js';
import mcpManager from '../../services/mcp-manager.js';
import { SettingsStore } from '@refinio/one.core/lib/system/settings-store.js';
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
    if (!modelId) {
      return { success: false, error: 'Model ID is required' };
    }

    try {
      const response = await llmManager.chat(messages, modelId, {
        onStream: stream ? (chunk: string) => {
          event.sender.send('ai:stream', { chunk, topicId });
        } : undefined
      });

      return {
        success: true,
        data: {
          response: response,
          modelId: modelId,
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

      return {
        success: true,
        models: models.map(m => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          isLoaded: m.isLoaded || false
        }))
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Set default AI model
   * Note: LLMManager doesn't have default model concept, so this just validates the model exists
   */
  async setDefaultModel(
    event: IpcMainInvokeEvent,
    { modelId }: { modelId: string }
  ) {
    try {
      console.log(`[AI IPC] Setting default model: ${modelId}`);
      const handler = getAIHandler();
      await handler.setDefaultModel(modelId);
      console.log(`[AI IPC] ✅ Default model set successfully: ${modelId}`);
      return true;
    } catch (error: any) {
      console.error('[AI IPC] ❌ setDefaultModel error:', error);
      console.error('[AI IPC] ❌ Error stack:', error.stack);
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
    // Store API key via SettingsStore
    try {
      await SettingsStore.setItem(provider + '_api_key', apiKey);
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
      const tools = llmManager.mcpTools;
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
      const result = await mcpManager.executeTool(toolName, parameters, {});
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
      toolCount: llmManager.mcpTools.size,
      tools: Array.from(llmManager.mcpTools.keys())
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
    try {
      // Get from AIAssistantHandler which loads from AISettingsManager
      if (nodeOneCore.aiAssistantModel?.getDefaultModel) {
        const model = nodeOneCore.aiAssistantModel.getDefaultModel();
        if (model) {
          // Model can be string or object with id property
          const modelId = typeof model === 'string' ? model : model.id;
          // CRITICAL: Return null if modelId is undefined or empty
          // This ensures ModelOnboarding shows when no model is configured
          return modelId || null;
        }
      }
      return null;
    } catch (error: any) {
      console.error('[AI IPC] Error getting default model:', error);
      return null;
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
  },

  /**
   * Stop all active streaming requests
   */
  async stopStreaming(event: IpcMainInvokeEvent) {
    try {
      console.log('[AI IPC] Stopping all active streams');
      // Import dynamically to avoid circular dependencies
      const { cancelAllOllamaRequests } = await import('../../services/ollama.js');
      cancelAllOllamaRequests();
      return { success: true };
    } catch (error: any) {
      console.error('[AI IPC] Failed to stop streaming:', error);
      return { success: false, error: error.message };
    }
  }
};

export default aiHandlers;
