import type { ConnectionsModel } from '@refinio/one.models/lib/models/index.js';
/**
 * Instance Manager - Manages federated ONE instances
 * Creates OneInstanceEndpoint objects for federation
 */

class InstanceManager {
  public nodeOneCore: any;
  public instances: any;

  constructor(nodeOneCore: any) {

    this.nodeOneCore = nodeOneCore
    this.instances = new Map()
}

  /**
   * Create endpoint for the Node.js instance
   * This advertises the Node's direct socket listener
   */
  async createNodeEndpoint(): Promise<any> {
    if (!this.nodeOneCore.initialized) {
      throw new Error('Node instance not initialized')
    }

    const { storeUnversionedObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js')
    const { getInstanceIdHash } = await import('@refinio/one.core/lib/instance.js')
    const { getDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js')
    
    // Get instance and person keys using the proper helpers
    const instanceId = getInstanceIdHash()
    const ownerId = this.nodeOneCore.ownerId

    // Validate required IDs
    if (!instanceId) {
      throw new Error('Instance ID not available')
    }
    if (!ownerId) {
      throw new Error('Owner ID not available')
    }

    const instanceKeys = await getDefaultKeys(instanceId)
    const personKeys = await getDefaultKeys(ownerId)
    
    // Create OneInstanceEndpoint object (it's an unversioned object)
    const endpoint = {
      $type$: 'OneInstanceEndpoint' as const,
      personId: ownerId,
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
  async createBrowserEndpoint(browserInfo: any): Promise<any> {
    // Browser should create its own endpoint using createLocalInstanceEndpoint
    // We just note it here for tracking
    console.log('[InstanceManager] Browser endpoint should be created by browser itself')
    return null
  }

  /**
   * Get all known instances
   */
  getInstances(): any {
    return Array.from(this.instances.values())
  }

  /**
   * Find instance by ID
   */
  getInstance(instanceId: any): any {
    return this.instances.get(instanceId)
  }

  /**
   * Setup federation between browser and Node
   * Node creates its endpoint, browser creates its own
   */
  async setupFederation(): Promise<any> {
    console.log('[InstanceManager] Setting up federation - creating Node endpoint...')

    // Create Node's endpoint (advertises ws://localhost:8765)
    const nodeEndpoint = await this.createNodeEndpoint()
    console.log('[InstanceManager] Node endpoint created, advertises ws://localhost:8765')
    
    console.log('[InstanceManager] Federation setup complete')
    return nodeEndpoint
  }
}

export default InstanceManager;