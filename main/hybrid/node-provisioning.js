/**
 * Node Instance Provisioning
 * Receives provisioning from browser instance and initializes
 */

const { ipcMain } = require('electron')
const realNodeInstance = require('./real-node-instance')
const stateManager = require('../state/manager')

class NodeProvisioning {
  constructor() {
    this.provisioned = false
    this.credential = null
    this.user = null
  }

  initialize() {
    // Listen for provisioning requests from browser
    ipcMain.handle('provision:node', async (event, provisioningData) => {
      return await this.provision(provisioningData)
    })
    
    console.log('[NodeProvisioning] Listening for provisioning requests')
  }

  async provision(provisioningData) {
    console.log('[NodeProvisioning] Received provisioning request')
    
    // Check if already provisioned
    if (this.provisioned) {
      console.log('[NodeProvisioning] Node already provisioned, returning existing instance')
      return {
        success: true,
        nodeId: this.user?.id || 'node-' + Date.now(),
        endpoint: 'ws://localhost:8765'
      }
    }
    
    // Check if currently provisioning (prevent duplicate calls)
    if (this.isProvisioning) {
      console.log('[NodeProvisioning] Already provisioning, waiting...')
      while (this.isProvisioning) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return {
        success: true,
        nodeId: this.user?.id || 'node-' + Date.now(),
        endpoint: 'ws://localhost:8765'
      }
    }
    
    this.isProvisioning = true
    
    try {
      // Validate credential
      if (!this.validateCredential(provisioningData?.credential)) {
        throw new Error('Invalid provisioning credential')
      }
      
      // Store credential and user
      this.credential = provisioningData.credential
      this.user = provisioningData.user
      
      // Update state manager with authenticated user
      stateManager.setUser({
        id: this.user.id,
        name: this.user.name,
        email: this.user.email || `${this.user.name}@lama.local`
      })
      console.log('[NodeProvisioning] Updated state manager with user:', this.user.name)
      
      // Initialize Node instance with provisioned identity
      await this.initializeNodeInstance(provisioningData)
      
      // Mark as provisioned
      this.provisioned = true
      this.isProvisioning = false
      
      console.log('[NodeProvisioning] Node instance provisioned successfully')
      
      // Start CHUM sync to browser
      const chumSync = require('../services/chum-sync')
      await chumSync.initialize()
      console.log('[NodeProvisioning] CHUM sync started')
      
      return {
        success: true,
        nodeId: realNodeInstance.getOwnerId() || 'node-' + Date.now(),
        endpoint: 'ws://localhost:8765'
      }
      
    } catch (error) {
      console.error('[NodeProvisioning] Provisioning failed:', error)
      this.isProvisioning = false
      return {
        success: false,
        error: error.message
      }
    }
  }

  validateCredential(credential) {
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

  async initializeNodeInstance(provisioningData) {
    const { credential, user, config } = provisioningData || {}
    
    console.log('[NodeProvisioning] Initializing Node instance for user:', user?.name || 'undefined')
    
    // Initialize ONE.CORE with provisioned identity
    await realNodeInstance.initialize(user, credential)
    
    // Store user data
    await realNodeInstance.setState('identity.user', {
      id: user.id,
      name: user.name,
      email: user.email || `${user.name}@lama.local`,
      provisionedAt: new Date().toISOString(),
      provisionedBy: credential.issuer.id
    })
    
    // Store provisioning credential
    await realNodeInstance.setState('provisioning.credential', credential)
    
    // Configure based on provisioning
    await this.configureNodeInstance(config)
    
    // User objects not needed - Settings datatype handles all state
  }

  async configureNodeInstance(config) {
    console.log('[NodeProvisioning] Configuring Node instance:', config)
    
    // Set storage role
    await realNodeInstance.setState('config.storageRole', config.storageRole)
    
    // Enable capabilities
    for (const capability of config.capabilities) {
      await this.enableCapability(capability)
    }
    
    // Configure CHUM sync endpoint
    if (config.syncEndpoint) {
      await realNodeInstance.setState('config.syncEndpoint', config.syncEndpoint)
    }
  }

  async enableCapability(capability) {
    switch (capability) {
      case 'llm':
        // Initialize LLM worker (worker file will be added later)
        // const LLMWorker = require('../workers/llm-worker')
        await realNodeInstance.setState('capabilities.llm', {
          enabled: true,
          worker: 'llm-worker',
          models: ['gpt-3.5-turbo', 'llama-2']
        })
        break
        
      case 'files':
        // Enable file import/export
        await realNodeInstance.setState('capabilities.files', {
          enabled: true,
          importPath: './imports',
          exportPath: './exports'
        })
        break
        
      case 'network':
        // Enable full network access
        await realNodeInstance.setState('capabilities.network', {
          enabled: true,
          protocols: ['http', 'https', 'ws', 'wss']
        })
        break
    }
  }

  async createUserObjects(user) {
    console.log('[NodeProvisioning] Creating user objects in ONE.CORE')
    
    // User object already created in initialization
    
    // Create welcome conversation
    const welcomeConversation = await realNodeInstance.createConversation(
      'system',
      ['system', user.id],
      'Welcome to LAMA'
    )
    
    // Create welcome message
    await realNodeInstance.createMessage(
      welcomeConversation.hash || welcomeConversation.id,
      `Welcome to LAMA, ${user.name}! Your Node instance has been provisioned and is ready to use.`,
      { sender: 'system' }
    )
    
    console.log('[NodeProvisioning] User objects created')
  }

  async deprovision() {
    console.log('[NodeProvisioning] Deprovisioning Node instance...')
    
    if (!this.provisioned) {
      return { success: true, message: 'Not provisioned' }
    }
    
    try {
      // Shutdown Node instance
      await realNodeInstance.shutdown()
      
      // Clear provisioning data
      this.provisioned = false
      this.credential = null
      this.user = null
      
      // Clear storage (optional - for full reset)
      const fs = require('fs').promises
      const path = require('path')
      const dataPath = path.join(process.cwd(), 'one-data-node')
      
      try {
        await fs.rm(dataPath, { recursive: true, force: true })
        console.log('[NodeProvisioning] Cleared Node data')
      } catch (error) {
        console.error('[NodeProvisioning] Failed to clear data:', error)
      }
      
      return { success: true }
      
    } catch (error) {
      console.error('[NodeProvisioning] Deprovision failed:', error)
      return { success: false, error: error.message }
    }
  }

  isProvisioned() {
    return this.provisioned
  }

  getUser() {
    return this.user
  }

  getCredential() {
    return this.credential
  }
}

// Export singleton
module.exports = new NodeProvisioning()