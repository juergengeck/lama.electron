/**
 * LLM Config IPC Handlers (Thin Adapter)
 *
 * Maps Electron IPC calls to LLMConfigHandler methods.
 * Business logic lives in ../../../lama.core/handlers/LLMConfigHandler.ts
 */

import { ipcMain } from 'electron';
import {
  LLMConfigHandler,
  type TestConnectionRequest,
  type TestConnectionResponse,
  type SetOllamaConfigRequest,
  type SetOllamaConfigResponse,
  type GetOllamaConfigRequest,
  type GetOllamaConfigResponse,
  type GetAvailableModelsRequest,
  type GetAvailableModelsResponse,
  type DeleteOllamaConfigRequest,
  type DeleteOllamaConfigResponse,
} from '@lama/core/handlers/LLMConfigHandler.js';
import { testOllamaConnection, fetchOllamaModels } from '../../services/ollama-validator.js';
import {
  encryptToken,
  decryptToken,
  computeBaseUrl,
  isEncryptionAvailable,
} from '../../services/ollama-config-manager.js';
import nodeOneCore from '../../core/node-one-core.js';

// Create handler instance with Electron-specific dependencies
const llmConfigHandler = new LLMConfigHandler(
  nodeOneCore,
  nodeOneCore.aiAssistantModel,
  {
    testOllamaConnection,
    fetchOllamaModels,
  },
  {
    encryptToken,
    decryptToken,
    computeBaseUrl,
    isEncryptionAvailable,
  }
);

/**
 * T012: llm:testOllamaConnection
 * Validate connectivity to Ollama server and fetch available models
 */
export async function handleTestOllamaConnection(
  event: Electron.IpcMainInvokeEvent,
  request: TestConnectionRequest
): Promise<TestConnectionResponse> {
  return await llmConfigHandler.testConnection(request);
}

/**
 * T013: llm:setOllamaConfig
 * Save Ollama configuration to ONE.core storage
 */
export async function handleSetOllamaConfig(
  event: Electron.IpcMainInvokeEvent,
  request: SetOllamaConfigRequest
): Promise<SetOllamaConfigResponse> {
  return await llmConfigHandler.setConfig(request);
}

/**
 * T014: llm:getOllamaConfig
 * Retrieve current active Ollama configuration
 */
export async function handleGetOllamaConfig(
  event: Electron.IpcMainInvokeEvent,
  request: GetOllamaConfigRequest
): Promise<GetOllamaConfigResponse> {
  return await llmConfigHandler.getConfig(request);
}

/**
 * T015: llm:getAvailableModels
 * Fetch models from Ollama server (active config or specified URL)
 */
export async function handleGetAvailableModels(
  event: Electron.IpcMainInvokeEvent,
  request: GetAvailableModelsRequest
): Promise<GetAvailableModelsResponse> {
  return await llmConfigHandler.getAvailableModels(request);
}

/**
 * T016: llm:deleteOllamaConfig
 * Soft-delete an Ollama configuration
 */
export async function handleDeleteOllamaConfig(
  event: Electron.IpcMainInvokeEvent,
  request: DeleteOllamaConfigRequest
): Promise<DeleteOllamaConfigResponse> {
  return await llmConfigHandler.deleteConfig(request);
}

/**
 * Register all IPC handlers
 */
export function registerLlmConfigHandlers() {
  console.log('[IPC] Registering LLM config handlers...');

  ipcMain.handle('llm:testOllamaConnection', handleTestOllamaConnection);
  ipcMain.handle('llm:setOllamaConfig', handleSetOllamaConfig);
  ipcMain.handle('llm:getOllamaConfig', handleGetOllamaConfig);
  ipcMain.handle('llm:getAvailableModels', handleGetAvailableModels);
  ipcMain.handle('llm:deleteOllamaConfig', handleDeleteOllamaConfig);

  console.log('[IPC] ✅ LLM config handlers registered');
}
