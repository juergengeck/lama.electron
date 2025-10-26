/**
 * AI Assistant Handler Adapter
 *
 * Creates and initializes the refactored AIAssistantHandler from lama.core
 * with Electron-specific dependencies. This replaces the monolithic
 * ai-assistant-model.ts with the new component-based architecture.
 *
 * Usage:
 *   import { aiAssistantHandler } from './ai-assistant-handler-adapter.js';
 *   await aiAssistantHandler.init();
 */

import { AIAssistantHandler } from '@lama/core/handlers/AIAssistantHandler.js';
import { ElectronLLMPlatform } from '../../adapters/electron-llm-platform.js';
import { AISettingsManager } from './ai-settings-manager.js';
import type { NodeOneCore } from '../types/one-core.js';
import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { getIdObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { createDefaultKeys, hasDefaultKeys } from '@refinio/one.core/lib/keychain/keychain.js';
import electron from 'electron';
const { BrowserWindow } = electron;

let handlerInstance: AIAssistantHandler | null = null;

/**
 * Create AIAssistantHandler instance with Electron dependencies
 * Call this after nodeOneCore is initialized
 */
export function createAIAssistantHandler(nodeOneCore: NodeOneCore, llmManager: any): AIAssistantHandler {
  if (handlerInstance) {
    console.log('[AIAssistantAdapter] Using existing handler instance');
    return handlerInstance;
  }

  console.log('[AIAssistantAdapter] Creating new AIAssistantHandler...');

  // Get main window for platform events
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (!mainWindow) {
    throw new Error('[AIAssistantAdapter] No main window available for platform events');
  }

  // Create Electron platform adapter
  const platform = new ElectronLLMPlatform(mainWindow);

  // Create settings persistence manager
  const settingsPersistence = new AISettingsManager(nodeOneCore);

  // Create handler with all dependencies
  handlerInstance = new AIAssistantHandler({
    oneCore: nodeOneCore,
    channelManager: nodeOneCore.channelManager,
    topicModel: nodeOneCore.topicModel,
    leuteModel: nodeOneCore.leuteModel,
    llmManager: llmManager,
    platform: platform,
    stateManager: undefined, // Optional - not currently used
    llmObjectManager: (nodeOneCore as any).llmObjectManager,
    contextEnrichmentService: (nodeOneCore as any).contextEnrichmentService,
    topicAnalysisModel: (nodeOneCore as any).topicAnalysisModel,
    topicGroupManager: (nodeOneCore as any).topicGroupManager,
    settingsPersistence: settingsPersistence,
    storageDeps: {
      storeVersionedObject,
      getIdObject,
      createDefaultKeys,
      hasDefaultKeys
    }
  });

  console.log('[AIAssistantAdapter] AIAssistantHandler created');
  return handlerInstance;
}

/**
 * Initialize the AI assistant handler
 * Call this after nodeOneCore is provisioned
 */
export async function initializeAIAssistantHandler(
  nodeOneCore: NodeOneCore,
  llmManager: any
): Promise<AIAssistantHandler> {
  const handler = createAIAssistantHandler(nodeOneCore, llmManager);

  console.log('[AIAssistantAdapter] Initializing AIAssistantHandler...');
  await handler.init();

  console.log('[AIAssistantAdapter] ✅ AIAssistantHandler initialized');
  return handler;
}

/**
 * Get the current handler instance
 * Throws if handler hasn't been created yet
 */
export function getAIAssistantHandler(): AIAssistantHandler {
  if (!handlerInstance) {
    throw new Error('[AIAssistantAdapter] AIAssistantHandler not initialized - call initializeAIAssistantHandler() first');
  }
  return handlerInstance;
}

/**
 * Reset handler instance (for testing)
 */
export function resetAIAssistantHandler(): void {
  handlerInstance = null;
}
