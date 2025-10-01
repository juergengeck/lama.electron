/**
 * useWordCloudSettings Hook
 *
 * React hook for managing word cloud settings
 */

import { useState, useEffect, useCallback } from 'react';
import { wordCloudSettingsService, type WordCloudSettings, DEFAULT_WORD_CLOUD_SETTINGS } from '../services/word-cloud-settings-service.js';

export function useWordCloudSettings() {
  const [settings, setSettings] = useState<WordCloudSettings>(DEFAULT_WORD_CLOUD_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        const currentSettings = await wordCloudSettingsService.getSettings();
        setSettings(currentSettings);
      } catch (err) {
        console.error('[useWordCloudSettings] Error loading settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load settings');
        // Keep default settings if loading fails
        setSettings(DEFAULT_WORD_CLOUD_SETTINGS);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();

    // Subscribe to settings changes
    const unsubscribe = wordCloudSettingsService.subscribe(setSettings);

    return unsubscribe;
  }, []);

  // Update settings
  const updateSettings = useCallback(async (updates: Partial<WordCloudSettings>) => {
    try {
      setError(null);
      const updatedSettings = await wordCloudSettingsService.updateSettings(updates);
      // Settings will be updated via subscription
      return updatedSettings;
    } catch (err) {
      console.error('[useWordCloudSettings] Error updating settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update settings');
      throw err;
    }
  }, []);

  // Reset settings
  const resetSettings = useCallback(async () => {
    try {
      setError(null);
      const defaultSettings = await wordCloudSettingsService.resetSettings();
      // Settings will be updated via subscription
      return defaultSettings;
    } catch (err) {
      console.error('[useWordCloudSettings] Error resetting settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
      throw err;
    }
  }, []);

  return {
    settings,
    loading,
    error,
    updateSettings,
    resetSettings
  };
}