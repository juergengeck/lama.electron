/**
 * Word Cloud Settings Service
 *
 * Provides access to word cloud settings stored in Node.js via IPC
 */

export interface WordCloudSettings {
  maxWordsPerSubject: number;
  relatedWordThreshold: number;
  minWordFrequency: number;
  showSummaryKeywords: boolean;
  fontScaleMin: number;
  fontScaleMax: number;
  colorScheme: string;
  layoutDensity: string;
}

export const DEFAULT_WORD_CLOUD_SETTINGS: WordCloudSettings = {
  maxWordsPerSubject: 20,
  relatedWordThreshold: 0.3,
  minWordFrequency: 2,
  showSummaryKeywords: true,
  fontScaleMin: 0.8,
  fontScaleMax: 2.5,
  colorScheme: 'viridis',
  layoutDensity: 'medium'
};

class WordCloudSettingsService {
  private settings: WordCloudSettings | null = null;
  private listeners: ((settings: WordCloudSettings) => void)[] = [];

  /**
   * Get current settings, loading from backend if needed
   */
  async getSettings(): Promise<WordCloudSettings> {
    if (this.settings) {
      return this.settings;
    }

    try {
      const result = await window.electronAPI.invoke('wordCloudSettings:getSettings');

      if (result.success) {
        this.settings = result.settings;
        return this.settings;
      } else {
        console.error('[WordCloudSettingsService] Failed to get settings:', result.error);
        return DEFAULT_WORD_CLOUD_SETTINGS;
      }
    } catch (error) {
      console.error('[WordCloudSettingsService] Error getting settings:', error);
      return DEFAULT_WORD_CLOUD_SETTINGS;
    }
  }

  /**
   * Update settings in backend and cache
   */
  async updateSettings(updates: Partial<WordCloudSettings>): Promise<WordCloudSettings> {
    try {
      const result = await window.electronAPI.invoke('wordCloudSettings:updateSettings', updates);

      if (result.success) {
        this.settings = result.settings;
        this.notifyListeners(this.settings);
        return this.settings;
      } else {
        console.error('[WordCloudSettingsService] Failed to update settings:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('[WordCloudSettingsService] Error updating settings:', error);
      throw error;
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings(): Promise<WordCloudSettings> {
    try {
      const result = await window.electronAPI.invoke('wordCloudSettings:resetSettings');

      if (result.success) {
        this.settings = result.settings;
        this.notifyListeners(this.settings);
        return this.settings;
      } else {
        console.error('[WordCloudSettingsService] Failed to reset settings:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('[WordCloudSettingsService] Error resetting settings:', error);
      throw error;
    }
  }

  /**
   * Subscribe to settings changes
   */
  subscribe(listener: (settings: WordCloudSettings) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of settings changes
   */
  private notifyListeners(settings: WordCloudSettings): void {
    this.listeners.forEach(listener => {
      try {
        listener(settings);
      } catch (error) {
        console.error('[WordCloudSettingsService] Error in listener:', error);
      }
    });
  }

  /**
   * Clear cached settings (useful for testing or logout)
   */
  clearCache(): void {
    this.settings = null;
  }
}

// Export singleton instance
export const wordCloudSettingsService = new WordCloudSettingsService();