/**
 * Federation API - Implements @refinio/one.api patterns for federated instances
 * Manages contacts with endpoints for proper instance federation
 * Based on refinio.api patterns from https://github.com/juergengeck/refinio.api
 */

class FederationAPI {
  constructor(nodeOneCore) {
    this.nodeOneCore = nodeOneCore
    this.contacts = new Map()
    this.profiles = new Map()
  }

  /**
   * Create a profile for a person (following refinio.api ProfileHandler pattern)
   */
  async createProfile(personId, profileData) {
    const { storeUnversionedObject } = await import('../../node_modules/@refinio/one.core/lib/storage-unversioned-objects.js')
    
    const profile = {
      $type$: 'Profile',
      personId: personId,
      ...profileData
    }
    
    const profileHash = await storeUnversionedObject(profile)
    this.profiles.set(personId, profileHash)
    
    return profileHash
  }

  /**
   * Create a contact with an endpoint
   * This is the proper way to register federated instances
   */
  async createContactWithEndpoint(personId, instanceId, instanceName, urls = []) {
    const { storeUnversionedObject } = await import('../../node_modules/@refinio/one.core/lib/storage-unversioned-objects.js')
    const { getDefaultKeys } = await import('../../node_modules/@refinio/one.core/lib/keychain/keychain.js')
    
    console.log(`[FederationAPI] Creating contact for ${instanceName}...`)
    
    // Get the keys for the person and instance
    const personKeys = await getDefaultKeys(personId)
    const instanceKeys = await getDefaultKeys(instanceId)
    
    // Create OneInstanceEndpoint
    const endpoint = {
      $type$: 'OneInstanceEndpoint',
      personId: personId,
      instanceId: instanceId,
      personKeys: personKeys,
      instanceKeys: instanceKeys,
      url: urls.length > 0 ? urls[0] : undefined  // Use first URL if available
    }
    
    // Store the endpoint
    const endpointHash = await storeUnversionedObject(endpoint)
    console.log(`[FederationAPI] Created OneInstanceEndpoint: ${endpointHash}`)
    
    // LeuteConnectionsModule will automatically discover this endpoint
    // No need for a separate Contact object - the endpoint IS the contact
    
    // Track in memory
    this.contacts.set(instanceId, {
      personId,
      instanceId,
      instanceName,
      endpointHash,
      urls
    })
    
    return {
      endpointHash,
      contact: this.contacts.get(instanceId)
    }
  }

  /**
   * Register the local Node instance
   * Creates its endpoint without a direct URL (CommServer only)
   */
  async registerLocalNode() {
    if (!this.nodeOneCore.initialized) {
      throw new Error('Node not initialized')
    }
    
    const { getInstanceIdHash } = await import('../../node_modules/@refinio/one.core/lib/instance.js')
    const { getDefaultKeys } = await import('../../node_modules/@refinio/one.core/lib/keychain/keychain.js')
    
    const instanceId = getInstanceIdHash()
    const personId = this.nodeOneCore.ownerId
    
    // Create the OneInstanceEndpoint for the Node
    const personKeys = await getDefaultKeys(personId)
    const instanceKeys = await getDefaultKeys(instanceId)
    
    const endpoint = {
      $type$: 'OneInstanceEndpoint',
      personId: personId,
      instanceId: instanceId,
      personKeys: personKeys,
      instanceKeys: instanceKeys
      // No URL - connections will use CommServer
    }
    
    // Get or create the Node's profile and add the endpoint to communicationEndpoints
    const me = await this.nodeOneCore.leuteModel.me()
    let profile = await me.mainProfile()
    
    if (!profile) {
      // Create a default profile if none exists
      const { default: ProfileModel } = await import('@refinio/one.models/lib/models/Leute/ProfileModel.js')
      profile = await ProfileModel.constructWithNewProfile(personId, personId, 'default')
    }
    
    // Add the endpoint to the profile's communicationEndpoints
    if (!profile.communicationEndpoints) {
      profile.communicationEndpoints = []
    }
    
    // Check if endpoint already exists
    const existingEndpoint = profile.communicationEndpoints.find(
      ep => ep.$type$ === 'OneInstanceEndpoint' && ep.instanceId === instanceId
    )
    
    if (!existingEndpoint) {
      profile.communicationEndpoints.push(endpoint)
      await profile.saveAndLoad()
      console.log('[FederationAPI] Added OneInstanceEndpoint to Node profile')
    } else {
      console.log('[FederationAPI] OneInstanceEndpoint already exists in profile')
    }
    
    console.log('[FederationAPI] ✅ Node registered (CommServer only)')
    return { endpoint, profile: profile.idHash }
  }

  /**
   * Register a browser instance
   * Note: ConnectionsModel will handle endpoint discovery automatically
   */
  async registerBrowserInstance(browserInfo) {
    const { personId, instanceId, instanceName } = browserInfo
    
    // Just track it - ConnectionsModel handles the actual endpoint discovery
    this.contacts.set(instanceId, {
      personId,
      instanceId,
      instanceName: instanceName || 'Browser Instance',
      urls: []  // Browser doesn't listen
    })
    
    console.log('[FederationAPI] ✅ Browser instance tracked for federation')
    return { contact: this.contacts.get(instanceId) }
  }

  /**
   * Set up complete federation between browser and Node
   */
  async setupFederation(browserInfo) {
    console.log('[FederationAPI] Setting up federation...')
    
    // Register Node with its socket listener
    const nodeResult = await this.registerLocalNode()
    
    // Register browser if info provided
    let browserResult = null
    if (browserInfo) {
      browserResult = await this.registerBrowserInstance(browserInfo)
    }
    
    console.log('[FederationAPI] ✅ Federation setup complete')
    console.log('[FederationAPI] Node endpoint registered (CommServer only)')
    if (browserResult) {
      console.log('[FederationAPI] Browser endpoint registered')
    }
    console.log('[FederationAPI] LeuteConnectionsModule will automatically discover and connect')
    
    return {
      node: nodeResult,
      browser: browserResult
    }
  }

  /**
   * Get all registered contacts
   */
  getContacts() {
    return Array.from(this.contacts.values())
  }

  /**
   * Find contact by instance ID
   */
  getContact(instanceId) {
    return this.contacts.get(instanceId)
  }
}

export default FederationAPI