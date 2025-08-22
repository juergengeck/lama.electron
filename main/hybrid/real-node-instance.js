/**
 * REAL Node.js ONE.CORE Instance with Internet of Me (IoM)
 * Full archive storage with Node.js capabilities
 */

const path = require('path')
const fs = require('fs').promises

class RealNodeInstance {
  constructor() {
    this.initialized = false
    this.user = null
    this.ownerId = null
    this.leuteModel = null
    this.iomManager = null
    this.authenticator = null
    this.nodeSettings = null
    this.iomSettings = null
  }

  async initialize(user, credential) {
    if (this.initialized) {
      console.log('[RealNode] Already initialized')
      return
    }
    
    // Prevent double initialization
    if (this.initializing) {
      console.log('[RealNode] Already initializing, waiting...')
      while (this.initializing) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return
    }
    
    this.initializing = true
    console.log('[RealNode] Initializing Node.js ONE.CORE with MultiUser...')
    
    try {
      // Load Node.js platform
      console.log('[RealNode] Loading Node.js platform...')
      await import('../../electron-ui/node_modules/@refinio/one.core/lib/system/load-nodejs.js')
      
      // Import required modules
      const { default: MultiUser } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/Authenticator/MultiUser.js')
      const { default: LeuteModel } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/Leute/LeuteModel.js')
      const { default: ChannelManager } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/ChannelManager.js')
      const { default: IoMManager } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/IoM/IoMManager.js')
      const { default: RecipesStable } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/recipes/recipes-stable.js')
      const { default: RecipesExperimental } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/recipes/recipes-experimental.js')
      const { ReverseMapsStable } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/recipes/reversemaps-stable.js')
      const { ReverseMapsExperimental } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/recipes/reversemaps-experimental.js')
      
      // Store user
      this.user = user
      
      // Create data directory
      const dataDir = path.join(process.cwd(), 'one-data-node', user.id)
      await fs.mkdir(dataDir, { recursive: true })
      
      console.log('[RealNode] Creating MultiUser instance with directory:', dataDir)
      
      // Create MultiUser instance - it handles all instance creation internally
      this.authenticator = new MultiUser({
        directory: dataDir,
        recipes: [...RecipesStable, ...RecipesExperimental],
        reverseMaps: new Map([
          ...ReverseMapsStable,
          ...ReverseMapsExperimental
        ])
      })
      
      // Register or login user - Node instance has different name than browser
      const email = user.email || `${user.name}@lama.local`
      // IMPORTANT: Node instance needs a different name than browser instance
      const instanceName = `node-${user.name}`  // Different from browser's `lama-${username}`
      // Use a proper password string, not the credential object
      const secret = typeof credential === 'string' ? credential : 'default-password'
      
      const isRegistered = await this.authenticator.isRegistered(email, instanceName)
      
      if (!isRegistered) {
        console.log('[RealNode] Registering new instance...')
        await this.authenticator.register(email, secret, instanceName)
      } else {
        console.log('[RealNode] Logging in to existing instance...')
        await this.authenticator.login(email, secret, instanceName)
      }
      
      // Complete initialization after authentication (same as browser instance)
      await this.completeInitializationAfterAuth(user)
      
      this.initialized = true
      this.initializing = false
      console.log('[RealNode] ✅ Node.js ONE.CORE with IoM initialized!')
      
    } catch (error) {
      console.error('[RealNode] Initialization failed:', error)
      this.initializing = false
      throw error
    }
  }

  async completeInitializationAfterAuth(user) {
    console.log('[RealNode] Completing initialization after authentication...')
    
    // Get the instance owner ID (same approach as browser)
    const { getInstanceOwnerIdHash } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/instance.js')
    this.ownerId = getInstanceOwnerIdHash()
    console.log('[RealNode] Instance owner ID:', this.ownerId)
    
    // Store user
    this.user = user
    
    // Initialize models (same approach as browser)
    await this.initializeModels()
    
    // Initialize Settings stores
    await this.initializeSettings()
    
    console.log('[RealNode] Post-auth initialization complete')
  }
  
  async initializeModels() {
    try {
      const { getInstanceOwnerIdHash } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/instance.js')
      const ownerId = getInstanceOwnerIdHash()
      
      if (ownerId) {
        console.log('[RealNode] Instance has owner:', ownerId)
        
        // Check if MultiUser has a LeuteModel we can use (same as browser)
        if (this.authenticator && this.authenticator.leuteModel) {
          console.log('[RealNode] Using LeuteModel from MultiUser')
          this.leuteModel = this.authenticator.leuteModel
        } else {
          console.log('[RealNode] Creating new LeuteModel...')
          const { default: LeuteModel } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/Leute/LeuteModel.js')
          this.leuteModel = new LeuteModel()
          await this.leuteModel.init()
        }
        
        console.log('[RealNode] ✅ LeuteModel initialized!')
        
        // Initialize IoM Manager only if we have LeuteModel
        console.log('[RealNode] Setting up Internet of Me (IoM)...')
        const { default: IoMManager } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/IoM/IoMManager.js')
        const commServerUrl = process.env.COMM_SERVER_URL || 'wss://comm.refinio.one'
        this.iomManager = new IoMManager(this.leuteModel, commServerUrl)
        
        // Initialize IoM
        await this.iomManager.init()
        
        // Create IoM group
        const iomGroup = await this.iomManager.iomGroup()
        console.log('[RealNode] IoM group created:', iomGroup.groupIdHash)
        
        // Give main identity ability to define trusted keys
        const myMainId = await this.leuteModel.myMainIdentity()
        await this.leuteModel.trust.certify(
          'RightToDeclareTrustedKeysForEverybodyCertificate',
          { beneficiary: myMainId }
        )
        
        // Initialize ChannelManager for communication
        console.log('[RealNode] Initializing ChannelManager...')
        const { default: ChannelManager } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/ChannelManager.js')
        this.channelManager = new ChannelManager()
        await this.channelManager.init()
        console.log('[RealNode] ✅ ChannelManager initialized!')
        
        // Initialize TopicModel for chat/messaging
        console.log('[RealNode] Initializing TopicModel...')
        const { default: TopicModel } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/chat/TopicModel.js')
        this.topicModel = new TopicModel()
        await this.topicModel.init()
        console.log('[RealNode] ✅ TopicModel initialized!')
        
        // Initialize CommServerConnector for WebSocket relay
        console.log('[RealNode] Initializing CommServer connection...')
        const { default: CommServerConnector } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/network/CommServerConnector.js')
        this.commServer = new CommServerConnector(commServerUrl)
        await this.commServer.connect()
        console.log('[RealNode] ✅ Connected to CommServer!')
      } else {
        console.log('[RealNode] No instance owner, models not initialized')
      }
      
    } catch (error) {
      console.error('[RealNode] Failed to initialize models:', error)
      throw error
    }
  }
  
  async initializeSettings() {
    try {
      // Import and use the Settings model properly (same as browser)
      const { default: PropertyTreeStore } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/SettingsModel.js')
      
      // Create node-specific settings store
      this.nodeSettings = new PropertyTreeStore(`node-settings-${this.ownerId || 'default'}`)
      await this.nodeSettings.init()
      
      // Set default node settings
      await this.nodeSettings.setValue('instance.type', 'node')
      await this.nodeSettings.setValue('instance.id', `node-${this.ownerId || Date.now()}`)
      await this.nodeSettings.setValue('theme', 'dark')
      await this.nodeSettings.setValue('language', 'en')
      await this.nodeSettings.setValue('notifications', 'true')
      await this.nodeSettings.setValue('storage.role', 'archive')
      await this.nodeSettings.setValue('sync.enabled', 'true')
      
      // Create shared IoM settings store
      this.iomSettings = new PropertyTreeStore('iom-shared-settings')
      await this.iomSettings.init()
      
      // Set shared IoM settings
      await this.iomSettings.setValue('iom.group', this.iomManager ? 'initialized' : 'pending')
      await this.iomSettings.setValue('iom.owner', this.user.id)
      await this.iomSettings.setValue('iom.browser.connected', 'false')
      await this.iomSettings.setValue('iom.node.connected', 'true')
      
      console.log('[RealNode] Settings stores initialized and shared in IoM')
      
    } catch (error) {
      console.error('[RealNode] Failed to initialize settings:', error)
      throw error
    }
  }

  async createObject(obj) {
    if (!this.initialized) {
      throw new Error('Instance not initialized')
    }
    
    // Use ONE.CORE storage functions directly since MultiUser manages the instance
    const { storeVersionedObject } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/storage-versioned-objects.js')
    return await storeVersionedObject(obj)
  }

  async getObjects(query) {
    if (!this.initialized) {
      throw new Error('Instance not initialized')
    }
    
    // Use ONE.CORE storage functions directly
    const { getObjectsByType } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/storage-unversioned-objects.js')
    return await getObjectsByType(query.type || query.$type$)
  }

  async setState(path, value) {
    if (!this.nodeSettings) {
      console.warn('[RealNode] Cannot set state - settings not initialized')
      return
    }
    
    // Use the Settings datatype we already have (same as browser)
    await this.nodeSettings.setValue(path, JSON.stringify(value))
  }

  async getState(path) {
    if (!this.nodeSettings) {
      return undefined
    }
    
    // Get from Settings datatype (same as browser)
    const value = this.nodeSettings.getValue(path)
    if (value) {
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }
    return undefined
  }

  async createMessage(conversationId, text, metadata = {}) {
    return await this.createObject({
      type: 'Message',
      conversationId,
      text,
      timestamp: new Date().toISOString(),
      sender: this.user?.id || 'system',
      ...metadata
    })
  }

  async getMessages(conversationId, limit = 50) {
    const messages = await this.getObjects({
      type: 'Message',
      filter: (obj) => obj.conversationId === conversationId
    })
    
    return messages
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-limit)
  }

  async createConversation(type, participants, name) {
    return await this.createObject({
      type: 'Conversation',
      conversationType: type,
      participants,
      name,
      createdAt: new Date().toISOString(),
      createdBy: this.user?.id || 'system'
    })
  }

  async getConversations(limit = 20) {
    const conversations = await this.getObjects({
      type: 'Conversation'
    })
    
    return conversations
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
  }

  // File operations (Node.js specific)
  async importFile(filePath) {
    const content = await fs.readFile(filePath)
    const stats = await fs.stat(filePath)
    
    return await this.createObject({
      type: 'File',
      name: path.basename(filePath),
      content: content.toString('base64'),
      size: stats.size,
      mimeType: this.getMimeType(filePath),
      importedAt: new Date().toISOString(),
      importedBy: this.user?.id || 'system'
    })
  }

  async exportFile(fileHash, outputPath) {
    const file = await this.instance.getObject(fileHash)
    
    if (!file || file.type !== 'File') {
      throw new Error('File not found')
    }
    
    const content = Buffer.from(file.content, 'base64')
    await fs.writeFile(outputPath, content)
    
    return outputPath
  }

  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes = {
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.png': 'image/png',
      '.json': 'application/json',
      '.js': 'application/javascript',
      '.ts': 'application/typescript'
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }

  getOwnerId() {
    return this.ownerId
  }

  getUser() {
    return this.user
  }

  isInitialized() {
    return this.initialized
  }

  getIoMManager() {
    return this.iomManager
  }

  getLeuteModel() {
    return this.leuteModel
  }

  getChannelManager() {
    // LeuteModel manages its own ChannelManager internally
    return this.leuteModel?.channelManager || null
  }

  async getIoMGroup() {
    if (!this.iomManager) {
      throw new Error('IoM Manager not initialized')
    }
    return await this.iomManager.iomGroup()
  }

  async getMyIdentity() {
    if (!this.leuteModel) {
      throw new Error('LeuteModel not initialized')
    }
    return await this.leuteModel.myMainIdentity()
  }

  async getIoMEndpoints() {
    if (!this.leuteModel) {
      throw new Error('LeuteModel not initialized')
    }
    return await this.leuteModel.getInternetOfMeEndpoints()
  }

  getNodeSettings() {
    return this.nodeSettings
  }

  getIoMSettings() {
    return this.iomSettings
  }

  async updateBrowserConnectionStatus(connected) {
    if (this.iomSettings) {
      await this.iomSettings.setValue('iom.browser.connected', connected ? 'true' : 'false')
      await this.iomSettings.setValue('iom.browser.lastUpdate', new Date().toISOString())
    }
  }

  async getSettings(prefix) {
    if (!this.nodeSettings) {
      return {}
    }
    
    // Get all settings with the given prefix
    const settings = {}
    const child = prefix ? this.nodeSettings.getChild(prefix) : this.nodeSettings
    
    // This would need to iterate through the keyValueStore
    // For now, return the child for specific operations
    return child
  }

  async setSetting(key, value) {
    if (!this.nodeSettings) {
      throw new Error('Settings not initialized')
    }
    
    await this.nodeSettings.setValue(key, String(value))
    
    // If it's an IoM-related setting, also update the shared settings
    if (key.startsWith('iom.')) {
      if (this.iomSettings) {
        await this.iomSettings.setValue(key, String(value))
      }
    }
  }

  async getSetting(key) {
    if (!this.nodeSettings) {
      return undefined
    }
    
    const value = this.nodeSettings.getValue(key)
    return value || undefined
  }

  async shutdown() {
    console.log('[RealNode] Shutting down...')
    
    try {
      // Shutdown IoM Manager
      if (this.iomManager) {
        console.log('[RealNode] Shutting down IoM Manager...')
        await this.iomManager.shutdown()
      }
      
      // LeuteModel handles its own ChannelManager internally
      
      // Logout from authenticator
      if (this.authenticator) {
        console.log('[RealNode] Logging out...')
        await this.authenticator.logout()
      }
      
      // Clear owner reference (MultiUser handles instance shutdown through logout)
      this.ownerId = null
    } catch (error) {
      console.error('[RealNode] Error during shutdown:', error)
    }
    
    this.initialized = false
    this.user = null
    this.leuteModel = null
    this.iomManager = null
    this.authenticator = null
    
    console.log('[RealNode] Shutdown complete')
  }
}

// Export singleton
module.exports = new RealNodeInstance()