/**
 * ONE.CORE Instance Management
 * Handles the core ONE instance lifecycle
 */
class InstanceManager {
    instance;
    storage;
    initialized;
    Instance;
    StorageVersionedObjects;
    createRandomKeys;
    constructor() {
        this.instance = null;
        this.storage = null;
        this.initialized = false;
    }
    async initialize() {
        if (this.initialized) {
            return this.instance;
        }
        console.log('[InstanceManager] Initializing ONE.CORE...');
        try {
            // Load ONE.CORE modules
            await import('@refinio/one.core/lib/system/load-nodejs.js');
            const { initInstance, getInstanceIdHash } = await import('@refinio/one.core/lib/instance.js');
            const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
            const { createKeys: createRandomKeys } = await import('@refinio/one.core/lib/keychain/keychain.js');
            // Storage is handled internally by ONE.core, no need to initialize separately
            // Initialize instance using initInstance function
            // Note: This is a placeholder - actual initialization should use proper parameters
            this.instance = await initInstance({
                name: 'default-instance',
                email: 'user@example.com',
                secret: 'default-secret',
                directory: process.env.ONE_STORAGE_DIR || './one-storage'
            });
            this.initialized = true;
            console.log('[InstanceManager] ONE.CORE initialized successfully');
            return this.instance;
        }
        catch (error) {
            console.error('[InstanceManager] Failed to initialize:', error);
            throw error;
        }
    }
    async shutdown() {
        if (this.instance) {
            // Cleanup operations
            this.instance = null;
            this.storage = null;
            this.initialized = false;
        }
    }
    getInstance() {
        if (!this.initialized) {
            throw new Error('Instance not initialized. Call initialize() first.');
        }
        return this.instance;
    }
    getStorage() {
        if (!this.initialized) {
            throw new Error('Storage not initialized. Call initialize() first.');
        }
        return this.storage;
    }
}
export default new InstanceManager();
