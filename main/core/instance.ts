/**
 * ONE.CORE Instance Management
 * Handles the core ONE instance lifecycle
 */

class InstanceManager {
  public instance: any;
  public storage: any;
  public initialized: any;

  Instance: any;
  StorageVersionedObjects: any;
  createRandomKeys: any;
  constructor() {

    this.instance = null
    this.storage = null
    this.initialized = false
}

  async initialize(): Promise<any> {
    if (this.initialized) {
      return this.instance
    }

    console.log('[InstanceManager] Initializing ONE.CORE...')
    
    try {
      // Load ONE.CORE modules
      await import('@refinio/one.core/lib/system/load-nodejs.js')

      const { initInstance, getInstanceIdHash } = await import('@refinio/one.core/lib/instance.js')
      const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
      const { createKeyPair } = await import('@refinio/one.core/lib/crypto/encryption.js')
      const { createSignKeyPair } = await import('@refinio/one.core/lib/crypto/sign.js')

      // Storage is handled internally by ONE.core, no need to initialize separately

      // Initialize instance using initInstance function
      // Note: This is a placeholder - actual initialization should use proper parameters
      this.instance = await initInstance({
        name: 'default-instance',
        email: 'user@example.com',
        secret: 'default-secret',
        directory: process.env.ONE_STORAGE_DIR || './one-storage'
      })

      this.initialized = true
      console.log('[InstanceManager] ONE.CORE initialized successfully')

      return this.instance
    } catch (error) {
      console.error('[InstanceManager] Failed to initialize:', error)
      throw error
    }
  }

  async shutdown(): Promise<any> {
    if (this.instance) {
      // Cleanup operations
      this.instance = null
      this.storage = null
      this.initialized = false
    }
  }

  getInstance(): any {
    if (!this.initialized) {
      throw new Error('Instance not initialized. Call initialize() first.')
    }
    return this.instance
  }

  getStorage(): any {
    if (!this.initialized) {
      throw new Error('Storage not initialized. Call initialize() first.')
    }
    return this.storage
  }
}

export default new InstanceManager()