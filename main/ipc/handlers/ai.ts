/**
 * AI IPC Handlers (Thin Adapter)
 *
 * Maps Electron IPC calls to AIHandler methods.
 * Business logic lives in ../../../lama.core/handlers/AIHandler.ts
 */

import { AIHandler } from '@lama/core/handlers/AIHandler.js';
import llmManager from '../../services/llm-manager.js';
import stateManager from '../../state/manager.js';
import nodeOneCore from '../../core/node-one-core.js';
import type { IpcMainInvokeEvent } from 'electron';
import electron from 'electron';
const { BrowserWindow } = electron;

// Create handler instance with Electron-specific dependencies
const aiHandler = new AIHandler(
  llmManager as any,
  nodeOneCore.aiAssistantModel as any,
  nodeOneCore.topicModel as any,
  nodeOneCore,
  stateManager
);

// Initialize handler with models after nodeOneCore is ready
if (nodeOneCore.initialized) {
  aiHandler.setModels(
    llmManager as any,
    nodeOneCore.aiAssistantModel as any,
    nodeOneCore.topicModel as any,
    nodeOneCore,
    stateManager
  );
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
    return await aiHandler.chat(
      { messages, modelId, stream, topicId },
      event.sender
    );
  },

  /**
   * Get available AI models
   */
  async getModels(event: IpcMainInvokeEvent) {
    return await aiHandler.getModels({});
  },

  /**
   * Set default AI model
   */
  async setDefaultModel(
    event: IpcMainInvokeEvent,
    { modelId }: { modelId: string }
  ) {
    return await aiHandler.setDefaultModel({ modelId }, BrowserWindow);
  },

  /**
   * Set API key for a provider
   */
  async setApiKey(
    event: IpcMainInvokeEvent,
    { provider, apiKey }: { provider: string; apiKey: string }
  ) {
    return await aiHandler.setApiKey({ provider, apiKey });
  },

  /**
   * Get available MCP tools
   */
  async getTools(event: IpcMainInvokeEvent) {
    return await aiHandler.getTools({});
  },

  /**
   * Execute an MCP tool
   */
  async executeTool(
    event: IpcMainInvokeEvent,
    { toolName, parameters }: { toolName: string; parameters: any }
  ) {
    return await aiHandler.executeTool({ toolName, parameters });
  },

  /**
   * Initialize LLM manager
   */
  async initializeLLM(event: IpcMainInvokeEvent) {
    return await aiHandler.initializeLLM({});
  },

  /**
   * Debug MCP tools registration
   */
  async debugTools(event: IpcMainInvokeEvent) {
    return await aiHandler.debugTools({});
  },

  /**
   * Get or create AI contact for a model
   */
  async getOrCreateContact(
    event: IpcMainInvokeEvent,
    { modelId }: { modelId: string }
  ) {
    return await aiHandler.getOrCreateContact({ modelId }, BrowserWindow);
  },

  /**
   * Test an API key with the provider
   */
  async testApiKey(
    event: IpcMainInvokeEvent,
    { provider, apiKey }: { provider: string; apiKey: string }
  ) {
    return await aiHandler.testApiKey({ provider, apiKey });
  },

  /**
   * Get the default model ID from AI settings
   */
  'ai:getDefaultModel': async (event: IpcMainInvokeEvent): Promise<string | null> => {
    const result = await aiHandler.getDefaultModel();
    return result.success ? (result.model || null) : null;
  },

  /**
   * Ensure default AI chats exist when user navigates to chat view
   * This is called lazily when the chat view is accessed, not during model selection
   * DELEGATES to AIAssistantModel - we do NOT create chats here
   */
  'ai:ensureDefaultChats': async (event: IpcMainInvokeEvent) => {
    return await aiHandler.ensureDefaultChats({});
  },

  /**
   * Discover Claude models from Anthropic API
   * Called after API key is saved to dynamically register available models
   */
  async discoverClaudeModels(
    event: IpcMainInvokeEvent,
    params?: { apiKey?: string }
  ) {
    return await aiHandler.discoverClaudeModels(params || {}, BrowserWindow);
  }
};

export default aiHandlers;
