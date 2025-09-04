/**
 * ChannelManager Singleton
 *
 * Ensures only one ChannelManager instance exists throughout the application
 */
import ChannelManagerClass from '@refinio/one.models/lib/models/ChannelManager.js';
let channelManagerInstance = null;
let initPromise = null;
/**
 * Create or get the existing ChannelManager instance
 */
export function createChannelManager(leuteModel) {
    if (channelManagerInstance) {
        console.log('[ChannelManager] Returning existing instance');
        return channelManagerInstance;
    }
    console.log('[ChannelManager] Creating new instance');
    channelManagerInstance = new ChannelManagerClass(leuteModel);
    return channelManagerInstance;
}
/**
 * Initialize the ChannelManager
 */
export async function initializeChannelManager() {
    if (!channelManagerInstance) {
        throw new Error('ChannelManager not created yet');
    }
    if (initPromise) {
        console.log('[ChannelManager] Already initializing, waiting...');
        return initPromise;
    }
    initPromise = (async () => {
        console.log('[ChannelManager] Initializing...');
        await channelManagerInstance.init();
        console.log('[ChannelManager] Initialized successfully');
    })();
    return initPromise;
}
/**
 * Get the ChannelManager instance
 */
export function getChannelManager() {
    return channelManagerInstance;
}
/**
 * Reset the singleton (mainly for testing)
 */
export function resetChannelManager() {
    channelManagerInstance = null;
    initPromise = null;
}
