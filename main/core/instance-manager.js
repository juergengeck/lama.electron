/**
 * Instance Manager - Manages federated ONE instances
 * Creates OneInstanceEndpoint objects for federation
 */

class InstanceManager {
  constructor(nodeOneCore) {
    this.nodeOneCore = nodeOneCore
    this.instances = new Map()
  }

  /**
   * Create endpoint for the Node.js instance
   * This advertises the Node's direct socket listener
   */
  async createNodeEndpoint() {
    if (!this.nodeOneCore.initialized) {
      throw new Error('Node instance not initialized')
    }

    const { storeUnversionedObject } = await import('../../node_modules/@refinio/one.core/lib/storage-unversioned-objects.js')
    const { getInstanceIdHash } = await import('../../node_modules/@refinio/one.core/lib/instance.js')
    const { getDefaultKeys } = await import('../../node_modules/@refinio/one.core/lib/keychain/keychain.js')
    
    // Get instance and person keys using the proper helpers
    const instanceId = getInstanceIdHash()
    const instanceKeys = await getDefaultKeys(instanceId)
    const personKeys = await getDefaultKeys(this.nodeOneCore.ownerId)
    
    // Create OneInstanceEndpoint object (it's an unversioned object)
    const endpoint = {
      $type$: 'OneInstanceEndpoint',
      personId: this.nodeOneCore.ownerId,
      instanceId: instanceId,
      personKeys: personKeys,  // Hash reference to Keys object
      instanceKeys: instanceKeys,  // Hash reference to Keys object
      url: 'ws://localhost:8765'  // Direct socket listener (singular, not plural)
    }
    
    // Store it as an unversioned object so ConnectionsModel can find it
    const hash = await storeUnversionedObject(endpoint)
    console.log(`[InstanceManager] Created Node endpoint at ws://localhost:8765`)
    
    return hash
  }

  /**
   * Create endpoint for the browser instance
   * Browser creates its own endpoint using helpers
   * We just track it here for federation management
   */
  async createBrowserEndpoint(browserInfo) {
    // Browser should create its own endpoint using createLocalInstanceEndpoint
    // We just note it here for tracking
    console.log('[InstanceManager] Browser endpoint should be created by browser itself')
    return null
  }

  /**
   * Get all known instances
   */
  getInstances() {
    return Array.from(this.instances.values())
  }

  /**
   * Find instance by ID
   */
  getInstance(instanceId) {
    return this.instances.get(instanceId)
  }

  /**
   * Setup federation between browser and Node
   * Node creates its endpoint, browser creates its own
   */
  async setupFederation() {
    console.log('[InstanceManager] Setting up federation - creating Node endpoint...')

    // Create Node's endpoint (advertises ws://localhost:8765)
    const nodeEndpoint = await this.createNodeEndpoint()
    console.log('[InstanceManager] Node endpoint created, advertises ws://localhost:8765')
    
    console.log('[InstanceManager] Federation setup complete')
    return nodeEndpoint
  }
}

export default InstanceManager