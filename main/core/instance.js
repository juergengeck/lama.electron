/**
 * ONE.CORE Instance Management
 * Handles the core ONE instance lifecycle
 */

class InstanceManager {
  constructor() {
    this.instance = null
    this.storage = null
    this.initialized = false
  }

  async initialize() {
    if (this.initialized) {
      return this.instance
    }

    console.log('[InstanceManager] Initializing ONE.CORE...')
    
    try {
      // Load ONE.CORE modules
      await import('@refinio/one.core/lib/system/load-nodejs.js')
      
      const { Instance } = await import('@refinio/one.core/lib/instance.js')
      const { StorageVersionedObjects } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
      const { createRandomKeys } = await import('@refinio/one.core/lib/crypto/encryption.js')
      
      // Initialize storage
      this.storage = new StorageVersionedObjects()
      
      // Create instance with keys
      const keys = await createRandomKeys()
      this.instance = new Instance({
        keys,
        storage: this.storage
      })
      
      this.initialized = true
      console.log('[InstanceManager] ONE.CORE initialized successfully')
      
      return this.instance
    } catch (error) {
      console.error('[InstanceManager] Failed to initialize:', error)
      throw error
    }
  }

  async shutdown() {
    if (this.instance) {
      // Cleanup operations
      this.instance = null
      this.storage = null
      this.initialized = false
    }
  }

  getInstance() {
    if (!this.initialized) {
      throw new Error('Instance not initialized. Call initialize() first.')
    }
    return this.instance
  }

  getStorage() {
    if (!this.initialized) {
      throw new Error('Storage not initialized. Call initialize() first.')
    }
    return this.storage
  }
}

export default new InstanceManager()