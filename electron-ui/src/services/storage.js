/**
 * Storage service for ONE platform
 * Uses IPC to communicate with main process
 */
import { ipcClient } from './one-core-client';
/**
 * Initialize ONE platform storage
 */
export async function initOneStorage() {
    console.log('[Storage] Initializing ONE storage via IPC...');
    try {
        // Initialize one.core in the main process
        const initialized = await ipcClient.action('init');
        if (!initialized) {
            console.warn('[Storage] Running in browser mode - using localStorage');
        }
        else {
            console.log('[Storage] ONE storage initialized in main process');
        }
    }
    catch (error) {
        console.error('[Storage] Failed to initialize storage:', error);
        throw error;
    }
}
/**
 * Clear all storage (for development/testing)
 */
export async function clearStorage() {
    console.log('[Storage] Clearing all storage...');
    try {
        // Clear IndexedDB
        if (typeof indexedDB !== 'undefined') {
            const databases = await indexedDB.databases();
            for (const db of databases) {
                if (db.name) {
                    await indexedDB.deleteDatabase(db.name);
                }
            }
        }
        // Clear localStorage
        if (typeof localStorage !== 'undefined') {
            localStorage.clear();
        }
        console.log('[Storage] Storage cleared');
    }
    catch (error) {
        console.error('[Storage] Failed to clear storage:', error);
        throw error;
    }
}
/**
 * Get storage statistics
 */
export async function getStorageStats() {
    const stats = {
        used: 0,
        available: 0,
        databases: []
    };
    try {
        // Get storage estimate
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            stats.used = estimate.usage || 0;
            stats.available = estimate.quota || 0;
        }
        // Get database names
        if (typeof indexedDB !== 'undefined' && 'databases' in indexedDB) {
            const databases = await indexedDB.databases();
            stats.databases = databases.map(db => db.name || 'unnamed').filter(Boolean);
        }
    }
    catch (error) {
        console.error('[Storage] Failed to get storage stats:', error);
    }
    return stats;
}
