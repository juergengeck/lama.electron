/**
 * Word Cloud Settings IPC Handlers (Thin Adapter)
 *
 * Maps Electron IPC calls to WordCloudSettingsHandler methods.
 * Business logic lives in ../../../lama.core/handlers/WordCloudSettingsHandler.ts
 */

import { WordCloudSettingsHandler } from '@lama/core/handlers/WordCloudSettingsHandler.js';
import { wordCloudSettingsManager, DEFAULT_WORD_CLOUD_SETTINGS } from '@lama/core/one-ai/storage/word-cloud-settings-manager.js';
import type { IpcMainInvokeEvent } from 'electron';

// Singleton handler instance
let wordCloudSettingsHandler: WordCloudSettingsHandler | null = null;

/**
 * Get handler instance (creates on first use)
 */
function getHandler(nodeOneCore: any): WordCloudSettingsHandler {
  if (!wordCloudSettingsHandler) {
    wordCloudSettingsHandler = new WordCloudSettingsHandler(
      nodeOneCore,
      wordCloudSettingsManager,
      DEFAULT_WORD_CLOUD_SETTINGS
    );
  }
  return wordCloudSettingsHandler;
}

/**
 * Get word cloud settings for the current user
 */
export async function getWordCloudSettings(nodeOneCore: any) {
    return await getHandler(nodeOneCore).getWordCloudSettings({});
}

/**
 * Update word cloud settings for the current user
 */
export async function updateWordCloudSettings(nodeOneCore: any, updates: any) {
    return await getHandler(nodeOneCore).updateWordCloudSettings({ updates });
}

/**
 * Reset word cloud settings to defaults for the current user
 */
export async function resetWordCloudSettings(nodeOneCore: any) {
    return await getHandler(nodeOneCore).resetWordCloudSettings({});
}