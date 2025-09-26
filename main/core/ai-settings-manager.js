/**
 * AI Settings Manager
 * Manages persistent AI settings including default model selection
 * Stores settings as versioned ONE.core objects to maintain history
 */

import { storeVersionedObject, getObjectByIdHash } from '@refinio/one.core/lib/storage-versioned-objects.js'
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js'

/**
 * Default AI settings
 */
export const DEFAULT_AI_SETTINGS = {
  defaultModelId: null,
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: 'You are LAMA, a private AI assistant with access to all of the owner\'s conversations.',
  streamResponses: true,
  autoSummarize: true,
  enableMCP: true
}

/**
 * Create AI settings object
 * Uses versioned objects to maintain settings history
 */
export function createAISettings() {
  return {
    $type$: 'GlobalLLMSettings',
    defaultProvider: 'ollama',
    autoSelectBestModel: false,
    preferredModelIds: [],
    defaultModelId: DEFAULT_AI_SETTINGS.defaultModelId,
    temperature: DEFAULT_AI_SETTINGS.temperature,
    maxTokens: DEFAULT_AI_SETTINGS.maxTokens,
    systemPrompt: DEFAULT_AI_SETTINGS.systemPrompt,
    streamResponses: DEFAULT_AI_SETTINGS.streamResponses,
    autoSummarize: DEFAULT_AI_SETTINGS.autoSummarize,
    enableMCP: DEFAULT_AI_SETTINGS.enableMCP
  }
}

/**
 * Type guard for AI settings
 */
function isAISettings(obj) {
  return obj && obj.$type$ === 'GlobalLLMSettings'
}

export class AISettingsManager {
  constructor(nodeOneCore) {
    this.nodeOneCore = nodeOneCore
  }

  /**
   * Get settings ID hash - GlobalLLMSettings has no ID properties,
   * so all instances have the same ID hash (singleton pattern)
   */
  async getSettingsIdHash() {
    const idHash = await calculateIdHashOfObj({
      $type$: 'GlobalLLMSettings'
    })
    return idHash
  }

  /**
   * Get or create AI settings object
   */
  async getSettings() {
    try {
      const idHash = await this.getSettingsIdHash()

      // Try to get existing settings
      try {
        const result = await getObjectByIdHash(idHash)
        if (result && isAISettings(result.obj)) {
          console.log('[AISettingsManager] Found existing settings')
          return result.obj
        }
      } catch (error) {
        // Settings don't exist yet, will create below
        console.log('[AISettingsManager] No existing settings found, creating defaults')
      }

      // Create and store default settings
      const defaultSettings = createAISettings()
      const storeResult = await storeVersionedObject(defaultSettings)

      console.log('[AISettingsManager] Created default settings')
      return storeResult.obj
    } catch (error) {
      console.error('[AISettingsManager] Error getting settings:', error)
      // Return defaults without storing
      return createAISettings()
    }
  }

  /**
   * Update the default model ID
   * Creates a new version of the settings
   */
  async setDefaultModelId(modelId) {
    try {
      console.log('[AISettingsManager] Setting default model ID:', modelId)

      // Get current settings
      const settings = await this.getSettings()
      if (!settings) {
        console.error('[AISettingsManager] No settings available')
        return false
      }

      // Create new version with updated model ID
      const updatedSettings = {
        ...settings,
        defaultModelId: modelId
      }

      // Remove metadata that shouldn't be in new version
      delete updatedSettings.idHash
      delete updatedSettings.hash
      delete updatedSettings.$prevVersionHash$

      // Store new version
      const result = await storeVersionedObject(updatedSettings)

      console.log('[AISettingsManager] Updated settings with model:', modelId)
      return true
    } catch (error) {
      console.error('[AISettingsManager] Error updating default model ID:', error)
      return false
    }
  }

  /**
   * Get the default model ID
   */
  async getDefaultModelId() {
    const settings = await this.getSettings()
    return settings?.defaultModelId || null
  }

  /**
   * Update AI settings with partial updates
   * Creates a new version of the settings
   */
  async updateSettings(updates) {
    try {
      // Get current settings
      const currentSettings = await this.getSettings()
      if (!currentSettings) {
        console.error('[AISettingsManager] No settings available')
        return null
      }

      // Create new version with updates
      const updatedSettings = {
        ...currentSettings,
        ...updates
      }

      // Remove metadata that shouldn't be in new version
      delete updatedSettings.idHash
      delete updatedSettings.hash
      delete updatedSettings.$prevVersionHash$

      // Store new version
      const result = await storeVersionedObject(updatedSettings)

      console.log('[AISettingsManager] Updated settings')
      return result.obj
    } catch (error) {
      console.error('[AISettingsManager] Error updating settings:', error)
      throw error
    }
  }

  /**
   * Get settings history
   * Returns the current version from storage
   */
  async getSettingsHistory() {
    try {
      // For now, just return current settings
      // TODO: Implement version history traversal if needed
      const settings = await this.getSettings()
      return settings ? [settings] : []
    } catch (error) {
      console.error('[AISettingsManager] Error getting settings history:', error)
      return []
    }
  }
}