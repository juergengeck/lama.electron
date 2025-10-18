import type { ConnectionsModel } from '@refinio/one.models/lib/models/index.js';
/**
 * Node Instance Provisioning
 * Receives provisioning from browser instance and initializes
 */

import electron from 'electron';
const { ipcMain } = electron;
import nodeOneCore from '../core/node-one-core.js';
import stateManager from '../state/manager.js';

class NodeProvisioning {
  public user: any;

  commServerUrl: any;
  provisioned: boolean | undefined;
  constructor() {

    this.user = null
}

  initialize(): any {
    // Listen for provisioning requests from browser
    ipcMain.handle('provision:node', async (event, provisioningData) => {
      console.log('[NodeProvisioning] IPC handler invoked with:', JSON.stringify(provisioningData))
      const result = await this.provision(provisioningData)
      console.log('[NodeProvisioning] IPC returning result:', JSON.stringify(result))
      return result
    })
    
    console.log('[NodeProvisioning] Listening for provisioning requests')
  }

  async provision(provisioningData: any): Promise<any> {
    console.log('[NodeProvisioning] Received provisioning request')
    
    // Check if Node is actually initialized WITH an owner ID
    const nodeInfo = nodeOneCore.getInfo()
    if (nodeInfo.initialized && nodeInfo.ownerId) {
      console.log('[NodeProvisioning] Node already fully initialized')
      
      // Create profile with OneInstanceEndpoint for browser to discover
      console.log('[NodeProvisioning] Creating profile with OneInstanceEndpoint for browser discovery')
      
      try {
        const { getInstanceIdHash } = await import('@refinio/one.core/lib/instance.js')
        const { getDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js')
        const { default: ProfileModel } = await import('@refinio/one.models/lib/models/Leute/ProfileModel.js')
        
        const instanceId = getInstanceIdHash()
        const personId = nodeInfo.ownerId
        
        // Create the OneInstanceEndpoint for the Node
        const personKeys = await getDefaultKeys(personId)
        const instanceKeys = await getDefaultKeys(instanceId)
        
        // Get commServerUrl from nodeOneCore directly
        const commServerUrl = (nodeOneCore as any).commServerUrl || 'wss://comm10.dev.refinio.one'
        
        const endpoint = {
          $type$: 'OneInstanceEndpoint' as const,
          personId: personId,
          instanceId: instanceId,
          personKeys: personKeys,
          instanceKeys: instanceKeys,
          url: commServerUrl  // Use configured commserver URL
        }
        
        // Get or create profile for the Node's owner
        const me = await nodeOneCore.leuteModel.me()
        console.log('[NodeProvisioning] Getting main profile for Node person:', personId)
        let profile = await me.mainProfile()
        
        if (!profile) {
          // Create profile on-the-fly
          console.log('[NodeProvisioning] No existing profile found, creating new one...')
          profile = await ProfileModel.constructWithNewProfile(personId, personId, 'default')
          console.log('[NodeProvisioning] Created new profile for Node instance:', profile.idHash)
        } else {
          console.log('[NodeProvisioning] Using existing profile:', profile.idHash)
        }
        
        // Ensure communicationEndpoints array exists
        if (!profile.communicationEndpoints) {
          profile.communicationEndpoints = []
          console.log('[NodeProvisioning] Initialized empty communicationEndpoints array')
        } else {
          console.log('[NodeProvisioning] Existing communicationEndpoints:', profile.communicationEndpoints.length, 'endpoints')
        }
        
        // Add or update the endpoint
        const existingIndex = profile.communicationEndpoints.findIndex(
          (ep: any) => ep.$type$ === 'OneInstanceEndpoint' && ep.instanceId === instanceId
        )
        
        if (existingIndex >= 0) {
          profile.communicationEndpoints[existingIndex] = endpoint
          console.log('[NodeProvisioning] Updated existing OneInstanceEndpoint at index:', existingIndex)
        } else {
          profile.communicationEndpoints.push(endpoint)
          console.log('[NodeProvisioning] Added new OneInstanceEndpoint to profile')
          console.log('[NodeProvisioning] Total endpoints now:', profile.communicationEndpoints.length)
        }
        
        console.log('[NodeProvisioning] Saving profile with endpoint...')
        await profile.saveAndLoad()
        console.log('[NodeProvisioning] ✅ Profile saved successfully with OneInstanceEndpoint')
        console.log('[NodeProvisioning] Node person ID:', personId?.substring(0, 8))
        console.log('[NodeProvisioning] Endpoint URL:', endpoint.url)
        
      } catch (error) {
        console.error('[NodeProvisioning] Failed to create profile with endpoint:', error)
      }
      
      // Create pairing invitation using the Node's own pairing manager
      let pairingInvite = null
      try {
        if (nodeOneCore.connectionsModel && nodeOneCore.connectionsModel.pairing) {
          console.log('[NodeProvisioning] Creating pairing invitation for browser connection...')
          
          // Use the proper API - let the Node instance create its own invitation
          const invitation = await nodeOneCore.connectionsModel.pairing.createInvitation()

          // Use CommServer for pairing
          pairingInvite = invitation  // Don't override URL, use what the invitation provides
          
          console.log('[NodeProvisioning] Created pairing invitation for already-initialized Node')
          console.log('[NodeProvisioning] Pairing token:', pairingInvite.token)
        }
      } catch (error) {
        console.error('[NodeProvisioning] Failed to create pairing invitation:', error)
      }
      
      console.log('[NodeProvisioning] IPC returning result:', JSON.stringify({
        success: true,
        nodeId: nodeInfo.ownerId,
        endpoint: (nodeOneCore as any).commServerUrl || 'wss://comm10.dev.refinio.one',
        pairingInvite: pairingInvite
      }, null, 2))
      
      return {
        success: true,
        nodeId: nodeInfo.ownerId,
        endpoint: (nodeOneCore as any).commServerUrl || 'wss://comm10.dev.refinio.one',
        pairingInvite: pairingInvite  // Include pairing invitation
      }
    } else if (nodeInfo.initialized && !nodeInfo.ownerId) {
      console.log('[NodeProvisioning] Node initialized but no owner ID yet, re-initializing...')
      // Continue with initialization
    }
    
    try {
      // Simple validation - just need username and password
      if (!provisioningData?.user?.name || !provisioningData?.user?.password) {
        throw new Error('Username and password required for provisioning')
      }
      
      // If we're already provisioning, don't start another one
      if (this.user && this.user.name === provisioningData.user.name) {
        console.log('[NodeProvisioning] Already provisioning for user:', provisioningData.user.name)
        throw new Error('Provisioning already in progress')
      }
      
      // Store user info (ID will be set after ONE.core initialization)
      this.user = provisioningData.user
      
      // Update state manager with authenticated user (ID will be updated after init)
      stateManager.setUser({
        id: this.user.id || null, // ID comes from ONE.core after init
        name: this.user.name,
        email: this.user.email || `${this.user.name}@lama.local`
      })
      console.log('[NodeProvisioning] Updated state manager with user:', this.user.name)
      
      // Initialize Node instance with provisioned identity
      await this.initializeNodeInstance(provisioningData)
      
      console.log('[NodeProvisioning] Node instance provisioned successfully')
      
      // Create pairing invitation using the Node's own pairing manager
      // This is the PROPER way - let the instance create its own invitation
      let pairingInvite = null
      try {
        if (nodeOneCore.connectionsModel && nodeOneCore.connectionsModel.pairing) {
          console.log('[NodeProvisioning] Creating pairing invitation through Node\'s pairing manager...')

          // Use the proper API - let the Node instance create its own invitation
          // This ensures the invitation is properly registered with the correct keys
          const invitation = await nodeOneCore.connectionsModel.pairing.createInvitation()
          
          // Use commserver URL from nodeOneCore for the invitation
          pairingInvite = {
            ...invitation,
            url: (nodeOneCore as any).commServerUrl || 'wss://comm10.dev.refinio.one'  // Use configured commserver URL
          }
          
          console.log('[NodeProvisioning] PAIRING INVITATION:', JSON.stringify(pairingInvite, null, 2))
          console.log('[NodeProvisioning] Created invitation through proper API with token:', pairingInvite.token)
          console.log('[NodeProvisioning] Pairing invitation ready at:', pairingInvite.url)
        }
      } catch (error) {
        console.error('[NodeProvisioning] Failed to create pairing invitation:', error)
      }
      
      // Profile and endpoint creation handled in initializeNodeInstance now
      // No need to duplicate here
      
      // Register browser instance for federation if info provided
      if (provisioningData.browserInstance) {
        console.log('[NodeProvisioning] Registering browser instance for federation...')
        try {
          await nodeOneCore.federationAPI.registerBrowserInstance(provisioningData.browserInstance)
          console.log('[NodeProvisioning] Browser instance registered with contact and endpoint')
        } catch (error) {
          console.error('[NodeProvisioning] Failed to register browser instance:', error)
        }
      }
      
      // CHUM sync is handled automatically by ONE.core when instances are connected via IoM
      console.log('[NodeProvisioning] CHUM sync handled by ONE.core automatically')
      
      // Get the actual owner ID from the initialized Node instance
      const nodeOwnerId = nodeOneCore.ownerId || nodeOneCore.getInfo().ownerId
      
      // Update state manager with the actual owner ID
      if (nodeOwnerId) {
        stateManager.setUser({
          id: nodeOwnerId,
          name: this.user.name,
          email: this.user.email || `${this.user.name}@lama.local`
        })
      }
      
      // Skip AI contact setup during provisioning - will be done on-demand
      // This saves significant initialization time

      return {
        success: true,
        nodeId: nodeOwnerId || 'node-' + Date.now(),
        endpoint: (nodeOneCore as any).commServerUrl || 'wss://comm10.dev.refinio.one',
        pairingInvite: pairingInvite  // Include pairing invitation
      }
      
    } catch (error) {
      console.error('[NodeProvisioning] Provisioning failed:', error)
      // Reset state on failure
      this.user = null
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  validateCredential(credential: any): any {
    // Validate credential structure
    if (!credential || !credential.credentialSubject) {
      return false
    }
    
    // Check credential type
    if (!credential.type?.includes('NodeProvisioningCredential')) {
      return false
    }
    
    // Check expiration
    const expiry = new Date(credential.expirationDate)
    if (expiry < new Date()) {
      console.error('[NodeProvisioning] Credential expired')
      return false
    }
    
    // In production, verify cryptographic proof
    // For now, accept if structure is valid
    return true
  }

  async initializeNodeInstance(provisioningData: any): Promise<any> {
    const { user } = provisioningData || {}
    
    console.log('[NodeProvisioning] Initializing Node instance for user:', user?.name)
    
    // Check if Node is already initialized
    const currentInfo = nodeOneCore.getInfo()
    if (currentInfo.initialized) {
      console.log('[NodeProvisioning] Node already initialized')
      return
    }
    
    // Initialize Node.js with same credentials as browser
    const username = user.name
    const password = user.password
    
    if (!username || !password) {
      throw new Error('Username and password required for Node initialization')
    }
    
    console.log('[NodeProvisioning] Initializing Node.js with username:', username)
    const result = await nodeOneCore.initialize(username, password)
    if (!result.success) {
      // If it's a decryption error, it means passwords don't match
      if (result.error && result.error.includes('CYENC-SYMDEC')) {
        throw new Error('Password mismatch between browser and Node instances. Please use the same password.')
      }
      throw new Error(`Failed to initialize Node.js ONE.core instance: ${result.error}`)
    }

    console.log('[NodeProvisioning] Node.js ONE.core initialized with ID:', result.ownerId)

    // Initialize memory tools with NodeOneCore reference
    try {
      const { default: mcpManager } = await import('./mcp-manager.js')
      mcpManager.setNodeOneCore(nodeOneCore)
      console.log('[NodeProvisioning] Memory tools initialized with NodeOneCore')
    } catch (error) {
      console.warn('[NodeProvisioning] Failed to initialize memory tools:', error)
    }

    // Skip heavy configuration during init - use minimal setup
    // Full capabilities can be enabled on-demand
  }


  async configureNodeInstance(config: any): Promise<any> {
    // Minimal configuration for fast startup
    // Only set essential config, skip heavy operations
    if (!config) {
      config = {
        storageRole: 'archive',
        syncEndpoint: 'ws://localhost:8765'
      }
    }
    
    // Just set basic config without heavy capability initialization
    await nodeOneCore.setState('config.storageRole', config?.storageRole || 'archive')
    await nodeOneCore.setState('config.syncEndpoint', config.syncEndpoint)
  }

  async enableCapability(capability: any): Promise<any> {
    console.log('[NodeProvisioning] Enabling capability:', capability)
    
    switch (capability) {
      case 'llm':
        // Initialize LLM capability - integrate with main process LLMManager
        const { default: llmManager } = await import('../services/llm-manager.js')
        const availableModels: any[] = llmManager.getAvailableModels().map((m: any) => m.id)

        await nodeOneCore.setState('capabilities.llm', {
          enabled: true,
          provider: 'main-process',
          models: availableModels,
          defaultModel: (llmManager as any).defaultModelId,
          integration: 'lama-llm-manager'
        })
        console.log('[NodeProvisioning] LLM capability enabled with main process integration')
        break
        
      case 'files':
        // Enable file import/export capability
        await nodeOneCore.setState('capabilities.files', {
          enabled: true,
          storageType: 'file-system',
          importPath: './imports',
          exportPath: './exports',
          blobStorage: 'OneDB/blobs/'
        })
        console.log('[NodeProvisioning] File storage capability enabled')
        break
        
      case 'network':
        // Enable full network access via ConnectionsModel
        await nodeOneCore.setState('capabilities.network', {
          enabled: true,
          protocols: ['http', 'https', 'ws', 'wss', 'udp'],
          p2pEnabled: true,
          commServerUrl: 'wss://comm10.dev.refinio.one',
          directConnections: true,
          iomServer: {
            enabled: true,
            port: 8765
          }
        })
        console.log('[NodeProvisioning] Network capability enabled via ConnectionsModel')
        break
        
      case 'storage':
        // Enable archive storage role
        await nodeOneCore.setState('capabilities.storage', {
          enabled: true,
          role: 'archive',
          persistent: true,
          location: 'OneDB/',
          unlimited: true
        })
        console.log('[NodeProvisioning] Archive storage capability enabled')
        break
    }
  }

  reset(): any {
    // Reset provisioning state
    this.user = null
    console.log('[NodeProvisioning] Reset provisioning state')
  }

  async createUserObjects(user: any): Promise<any> {
    // User objects already created in initialization
  }

  async deprovision(): Promise<any> {
    console.log('[NodeProvisioning] Deprovisioning Node instance...')
    
    try {
      // Shutdown Node instance if initialized
      if (nodeOneCore.getInfo().initialized) {
        await nodeOneCore.shutdown()
      }
      
      // Clear user data
      this.user = null

      // Clear storage (optional - for full reset)
      const fs = (await import('fs')).promises
      const path = await import('path')
      const dataPath = path.join(process.cwd(), 'OneDB')
      
      try {
        await fs.rm(dataPath, { recursive: true, force: true })
        console.log('[NodeProvisioning] Cleared Node data')
      } catch (error) {
        console.error('[NodeProvisioning] Failed to clear data:', error)
      }
      
      return { success: true }
      
    } catch (error) {
      console.error('[NodeProvisioning] Deprovision failed:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  isProvisioned(): any {
    return nodeOneCore.getInfo().initialized
  }

  getUser(): any {
    return this.user
  }
}

// Export singleton
export default new NodeProvisioning()