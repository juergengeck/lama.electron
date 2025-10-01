/**
 * IPC handlers for word cloud settings operations
 *
 * Provides browser access to word cloud settings stored in ONE.core
 */
import { wordCloudSettingsManager } from '../../core/one-ai/storage/word-cloud-settings-manager.js';
/**
 * Get word cloud settings for the current user
 */
export async function getWordCloudSettings(nodeOneCore) {
    try {
        if (!nodeOneCore.leuteModel) {
            throw new Error('User not authenticated - node not provisioned');
        }
        const me = await nodeOneCore.leuteModel.me();
        const creatorId = me.idHash;
        const settings = await wordCloudSettingsManager.getSettings(creatorId);
        console.log('[WordCloudSettings IPC] Retrieved settings:', settings);
        return {
            success: true,
            settings
        };
    }
    catch (error) {
        console.error('[WordCloudSettings IPC] Error getting settings:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
/**
 * Update word cloud settings for the current user
 */
export async function updateWordCloudSettings(nodeOneCore, updates) {
    try {
        if (!nodeOneCore.leuteModel) {
            throw new Error('User not authenticated - node not provisioned');
        }
        const me = await nodeOneCore.leuteModel.me();
        const creatorId = me.idHash;
        const settings = await wordCloudSettingsManager.updateSettings(creatorId, updates);
        console.log('[WordCloudSettings IPC] Updated settings:', settings);
        return {
            success: true,
            settings
        };
    }
    catch (error) {
        console.error('[WordCloudSettings IPC] Error updating settings:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
/**
 * Reset word cloud settings to defaults for the current user
 */
export async function resetWordCloudSettings(nodeOneCore) {
    try {
        if (!nodeOneCore.leuteModel) {
            throw new Error('User not authenticated - node not provisioned');
        }
        const me = await nodeOneCore.leuteModel.me();
        const creatorId = me.idHash;
        // Reset by updating with all default values
        const { DEFAULT_WORD_CLOUD_SETTINGS } = await import('../../core/one-ai/storage/word-cloud-settings-manager.js');
        const settings = await wordCloudSettingsManager.updateSettings(creatorId, DEFAULT_WORD_CLOUD_SETTINGS);
        console.log('[WordCloudSettings IPC] Reset settings to defaults:', settings);
        return {
            success: true,
            settings
        };
    }
    catch (error) {
        console.error('[WordCloudSettings IPC] Error resetting settings:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
