/**
 * Node.js ONE.core Instance using one.leute.replicant template
 * Proper initialization following the template pattern
 */

// Polyfill WebSocket for Node.js environment
import { WebSocket, WebSocketServer } from 'ws';
global.WebSocket = WebSocket;
global.WebSocketServer = WebSocketServer;

import path from 'path';
import { fileURLToPath } from 'url';
import AIContactManager from './ai-contact-manager.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class NodeOneCore {
  constructor() {
    this.initialized = false
    this.instanceName = null
    this.ownerId = null
    this.leuteModel = null
    this.connectionsModel = null
    this.channelManager = null
    this.topicModel = null
    this.iomManager = null
    this.localWsServer = null
    this.instanceModule = null // Track the instance module
    this.aiContactManager = new AIContactManager(this)
  }

  /**
   * Initialize Node.js ONE.core using the proper template
   */
  async initialize(username, password) {
    if (this.initialized) {
      console.log('[NodeOneCore] Already initialized')
      return { success: true, ownerId: this.ownerId, instanceName: this.instanceName }
    }
    
    // Derive instance name from username
    this.instanceName = `node-${username}`
    console.log(`[NodeOneCore] Initializing for user: ${username}`)
    
    try {
      // Set storage directory
      const storageDir = path.join(process.cwd(), 'one-core-storage', 'node')
      
      // Initialize ONE.core instance with browser credentials
      await this.initOneCoreInstance(username, password, storageDir)
      
      // Set initialized before models so instance manager can work
      this.initialized = true
      
      // Initialize models in proper order
      await this.initializeModels()
      
      console.log(`[NodeOneCore] Initialized successfully`)
      
      return { 
        success: true, 
        ownerId: this.ownerId,
        name: this.instanceName
      }
      
    } catch (error) {
      console.error('[NodeOneCore] Initialization failed:', error)
      this.initialized = false
      
      // Clean up on failure to allow retry
      await this.cleanup()
      
      return { 
        success: false, 
        error: error.message 
      }
    }
  }

  /**
   * Initialize ONE.core instance with browser credentials
   */
  async initOneCoreInstance(username, password, directory) {
    // MUST set base directory BEFORE any other imports
    const { setBaseDirOrName } = await import('../../node_modules/@refinio/one.core/lib/system/storage-base.js')
    setBaseDirOrName(directory)
    
    // Load Node.js platform after directory is set
    await import('../../node_modules/@refinio/one.core/lib/system/system/load-nodejs.js')
    
    // Import required modules
    const { initInstance, closeInstance, getInstanceOwnerIdHash } = await import('../../node_modules/@refinio/one.core/lib/instance.js')
    const { SettingsStore } = await import('../../node_modules/@refinio/one.core/lib/system/settings-store.js')
    const { createRandomString } = await import('../../node_modules/@refinio/one.core/lib/system/crypto-helpers.js')
    const { isString } = await import('../../node_modules/@refinio/one.core/lib/util/type-checks-basic.js')
    
    // Use same credentials as browser
    const instanceName = `node-${username}`
    const email = `${username}@lama.local`
    
    // Check if we're recovering the same instance
    const storedInstanceName = await SettingsStore.getItem('instance')
    const storedEmail = await SettingsStore.getItem('email')
    
    if (storedInstanceName === instanceName && storedEmail === email) {
      console.log('[NodeOneCore] Recovering existing instance for:', username)
    } else {
      console.log('[NodeOneCore] Creating new instance for:', username)
    }
    
    const instanceOptions = {
      name: instanceName,
      email: email,
      secret: password
    }
    
    // Import recipes and reverse maps
    const RecipesStable = await import('../../electron-ui/node_modules/@refinio/one.models/lib/recipes/recipes-stable.js')
    const RecipesExperimental = await import('../../electron-ui/node_modules/@refinio/one.models/lib/recipes/recipes-experimental.js')
    const { ReverseMapsStable, ReverseMapsForIdObjectsStable } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/recipes/reversemaps-stable.js')
    const { ReverseMapsExperimental, ReverseMapsForIdObjectsExperimental } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/recipes/reversemaps-experimental.js')
    const { LamaRecipes } = await import('../recipes/index.js')
    
    // Debug: Log what we're loading
    console.log('[NodeOneCore] Loading recipes:', {
      stable: Array.isArray(RecipesStable.default) ? RecipesStable.default.length : 'not array',
      experimental: Array.isArray(RecipesExperimental.default) ? RecipesExperimental.default.length : 'not array',
      lama: Array.isArray(LamaRecipes) ? LamaRecipes.length : 'not array'
    })
    
    // Get recipes and check for issues
    const stableRecipesRaw = RecipesStable.default || []
    const experimentalRecipesRaw = RecipesExperimental.default || []
    
    // Check for undefined in arrays
    const hasUndefined = (arr, name) => {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === undefined || arr[i] === null) {
          console.warn(`[NodeOneCore] Found undefined recipe at index ${i} in ${name}`)
          return true
        }
      }
      return false
    }
    
    hasUndefined(stableRecipesRaw, 'stable')
    hasUndefined(experimentalRecipesRaw, 'experimental')
    hasUndefined(LamaRecipes, 'lama')
    
    // Filter out any undefined/null recipes and validate
    const stableRecipes = stableRecipesRaw.filter(r => r && typeof r === 'object' && r.name)
    const experimentalRecipes = experimentalRecipesRaw.filter(r => r && typeof r === 'object' && r.name)
    const lamaRecipes = LamaRecipes.filter(r => r && typeof r === 'object' && r.name)
    
    console.log('[NodeOneCore] Filtered recipes:', {
      stable: stableRecipes.length,
      experimental: experimentalRecipes.length,
      lama: lamaRecipes.length
    })
    
    // For now, just use the standard recipes without LAMA recipes
    // to avoid the undefined issue
    const allRecipes = [
      ...stableRecipes,
      ...experimentalRecipes
      // Skip lamaRecipes for now - they're causing issues
    ]
    
    try {
      await initInstance({
        ...instanceOptions,
        directory: directory,
        initialRecipes: allRecipes,
        initiallyEnabledReverseMapTypes: new Map([
          ...(ReverseMapsStable || []),
          ...(ReverseMapsExperimental || [])
        ]),
        initiallyEnabledReverseMapTypesForIdObjects: new Map([
          ...(ReverseMapsForIdObjectsStable || []),
          ...(ReverseMapsForIdObjectsExperimental || [])
        ])
      })
      
      // Store instance info if new
      if (!isString(storedInstanceName) || !isString(storedEmail)) {
        await SettingsStore.setItem('instance', instanceOptions.name)
        await SettingsStore.setItem('email', instanceOptions.email)
      }
      
      // Get owner ID after initialization
      this.ownerId = getInstanceOwnerIdHash()
      this.instanceName = instanceOptions.name
      
      console.log('[NodeOneCore] ONE.core instance initialized successfully')
      console.log('[NodeOneCore] Owner ID:', this.ownerId)
      console.log('[NodeOneCore] Instance name:', this.instanceName)
      
    } catch (e) {
      // Handle decryption errors specifically
      if (e.code === 'CYENC-SYMDEC') {
        console.error('[NodeOneCore] Invalid password - decryption failed')
        throw new Error('Invalid password')
      } else {
        throw e
      }
    }
  }

  /**
   * Initialize models in proper order following template
   */
  async initializeModels() {
    console.log('[NodeOneCore] Initializing models...')
    
    // Define commserver URL for external connections
    const commServerUrl = 'wss://comm10.dev.refinio.one'
    
    // Initialize object events (handle already initialized case)
    const { objectEvents } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/misc/ObjectEventDispatcher.js')
    try {
      await objectEvents.init()
      console.log('[NodeOneCore] ✅ ObjectEventDispatcher initialized')
    } catch (error) {
      // If it's already initialized, that's fine
      if (error.message?.includes('already initialized')) {
        console.log('[NodeOneCore] ObjectEventDispatcher already initialized, continuing...')
      } else {
        throw error
      }
    }
    
    // Initialize LeuteModel with commserver for external connections
    const { default: LeuteModel } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/Leute/LeuteModel.js')
    this.leuteModel = new LeuteModel(commServerUrl, true) // true = create everyone group
    await this.leuteModel.init()
    console.log('[NodeOneCore] ✅ LeuteModel initialized with commserver:', commServerUrl)
    
    // Now that LeuteModel is initialized, get the actual owner ID
    try {
      const me = await this.leuteModel.me()
      if (me) {
        const actualOwnerId = await me.mainIdentity()
        if (actualOwnerId) {
          this.ownerId = actualOwnerId
          console.log('[NodeOneCore] Got actual owner ID from LeuteModel:', this.ownerId)
        }
      }
    } catch (error) {
      console.error('[NodeOneCore] Failed to get owner ID from LeuteModel:', error)
    }
    
    // Initialize Content Sharing Manager for Browser<->Node sync
    // This creates and manages Access objects for content sharing
    const { default: ContentSharingManager } = await import('./content-sharing.js')
    this.contentSharing = new ContentSharingManager(this)
    console.log('[NodeOneCore] ✅ Content Sharing Manager initialized')
    
    // Create Access objects for the browser instance
    // We need to know the browser's person ID to grant it access
    // For now, assume it's the same person (will be updated when browser connects)
    this.browserPersonId = this.ownerId
    await this.contentSharing.initializeSharing(this.browserPersonId)
    console.log('[NodeOneCore] ✅ Initial Access objects created for content sharing')
    
    // Initialize ChannelManager - needs leuteModel
    const { default: ChannelManager } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/ChannelManager.js')
    this.channelManager = new ChannelManager(this.leuteModel)
    await this.channelManager.init()
    console.log('[NodeOneCore] ✅ ChannelManager initialized')
    
    // Set up proper access rights using AccessRightsManager
    await this.setupProperAccessRights()
    
    // Set up simplified channel message logging
    this.channelManager.onUpdated(async (channelInfoIdHash, channelId, channelOwner, timeOfEarliestChange, data) => {
      console.log(`[NodeOneCore] 📨 Channel updates detected in ${channelId}, ${data.length} changes`)
      
      // DEBUG: Log all changes with their types
      for (let i = 0; i < data.length; i++) {
        const change = data[i]
        console.log(`[NodeOneCore] Change ${i}: type=${change.$type$}, hasText=${!!change.text}, hasSender=${!!change.sender}`)
        
        if (change.$type$ === 'ChatMessage') {
          console.log(`[NodeOneCore] ✅ ChatMessage from ${change.sender?.substring(0, 8)}: ${change.text?.substring(0, 50)}`)
        } else {
          console.log(`[NodeOneCore] ⚠️ Non-ChatMessage type: ${change.$type$}`)
        }
      }
      
      // Check if we have access to read this channel
      if (data.length > 0 && !data.some(change => change.$type$ === 'ChatMessage')) {
        console.log(`[NodeOneCore] ❌ No ChatMessages found in ${data.length} changes - possible access rights issue`)
      }
    })
    console.log('[NodeOneCore] ✅ Channel event listener registered')
    
    // Initialize TopicModel - needs channelManager and leuteModel
    const { default: TopicModel } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/Chat/TopicModel.js')
    this.topicModel = new TopicModel(this.channelManager, this.leuteModel)
    await this.topicModel.init()
    console.log('[NodeOneCore] ✅ TopicModel initialized')
    
    // Create contacts channel for CHUM sync
    await this.channelManager.createChannel('contacts')
    console.log('[NodeOneCore] ✅ Contacts channel created')
    
    // Initialize ConnectionsModel with commserver for external connections
    // ConnectionsModel will be imported later when needed
    
    // Skip MessageBus logging for now - focus on route registration
    
    // Note: Local browser-to-node sync will happen via IPC, not WebSocket
    // External connections still use commserver via ConnectionsModel
    
    // Create blacklist group for ConnectionsModel
    const { default: GroupModel } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/Leute/GroupModel.js')
    let blacklistGroup
    try {
      blacklistGroup = await GroupModel.constructFromLatestProfileVersionByGroupName('blacklist')
      console.log('[NodeOneCore] Using existing blacklist group')
    } catch {
      blacklistGroup = await this.leuteModel.createGroup('blacklist')
      console.log('[NodeOneCore] Created new blacklist group')
    }
    
    // Initialize Federation API for proper contact/endpoint management
    const { default: FederationAPI } = await import('./federation-api.js')
    this.federationAPI = new FederationAPI(this)
    
    // Register Node instance with its socket listener endpoint
    console.log('[NodeOneCore] Registering Node with endpoint at ws://localhost:8765...')
    try {
      await this.federationAPI.registerLocalNode()
      console.log('[NodeOneCore] ✅ Node registered with endpoint advertising ws://localhost:8765')
    } catch (error) {
      console.error('[NodeOneCore] Failed to register Node endpoint:', error)
    }
    
    // Create ConnectionsModel which will handle all connections
    // Configure both socket and commserver
    const socketConfig = {
      type: 'socket',
      host: 'localhost', 
      port: 8765,
      catchAll: true
    }
    
    const commServerConfig = {
      type: 'commserver',
      url: commServerUrl,
      catchAll: true
    }
    
    // Use the enhanced ConnectionsModel that now supports multiple transports
    const { default: ConnectionsModel } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/ConnectionsModel.js')
    
    this.connectionsModel = new ConnectionsModel(this.leuteModel, {
      commServerUrl,                      // Use commserver for external connections
      acceptIncomingConnections: true,    // Accept incoming connections
      acceptUnknownInstances: true,       // Accept browser instance and other devices
      acceptUnknownPersons: true,         // Accept pairing from other people
      allowPairing: true,                 // Allow pairing with other devices
      establishOutgoingConnections: true,
      allowDebugRequests: true,
      pairingTokenExpirationDuration: 2147483647,
      noImport: false,
      noExport: false,
      incomingConnectionConfigurations: [socketConfig, commServerConfig]  // Will work after enhancement!
    })
    
    console.log('[NodeOneCore] Initializing ConnectionsModel with blacklist group...')
    
    // Initialize with blacklist group
    await this.connectionsModel.init(blacklistGroup)
    
    console.log('[NodeOneCore] ✅ ConnectionsModel initialized with commserver:', commServerUrl)
    
    // ConnectionsModel handles all connections - both local and external
    // It will manage WebSocket connections internally
    console.log('[NodeOneCore] ✅ ConnectionsModel initialized and ready for connections')
    
    // Listen for successful pairing to add new contacts
    this.connectionsModel.pairing.onPairingSuccess(async (isInitiator, localPersonId, localInstanceId, remotePersonId, remoteInstanceId, token) => {
      console.log(`[NodeOneCore] 🎉 Pairing successful! Remote person: ${remotePersonId?.substring(0, 8)}`)
      
      // Check if this person is already a contact
      const others = await this.leuteModel.others()
      let isContact = false
      
      for (const someone of others) {
        try {
          const personId = await someone.person()
          if (personId === remotePersonId) {
            isContact = true
            console.log('[NodeOneCore] Person is already a contact')
            break
          }
        } catch (e) {
          // Ignore
        }
      }
      
      if (!isContact && remotePersonId !== this.ownerId) {
        console.log(`[NodeOneCore] 🆕 Adding new contact from pairing: ${remotePersonId.substring(0, 8)}...`)
        
        try {
          // Import profile functions
          const { default: ProfileModel } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/Leute/ProfileModel.js')
          const { default: SomeoneModel } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/Leute/SomeoneModel.js')
          
          // Wait a bit for the profile to be stored
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Try to get the profile that was shared during pairing
          let profileModel = null
          try {
            profileModel = await ProfileModel.constructFromLatestVersionByIdFields(
              remotePersonId,
              remotePersonId,
              'default'
            )
            console.log('[NodeOneCore] Found profile for new contact')
          } catch (e) {
            console.log('[NodeOneCore] No profile found yet, creating basic Someone')
          }
          
          // Create Someone for this contact
          const someoneModel = await SomeoneModel.constructWithNewSomeone(remotePersonId)
          
          // Add to LeuteModel
          await this.leuteModel.addSomeoneElse(someoneModel.idHash)
          console.log(`[NodeOneCore] ✅ Added new contact to LeuteModel: ${someoneModel.idHash}`)
          
          // Grant browser access to the new contact
          if (this.browserPersonId) {
            const { createAccess } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/access.js')
            const { SET_ACCESS_MODE } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/storage-base-common.js')
            
            await createAccess([{
              id: someoneModel.idHash,
              person: [this.browserPersonId],
              group: [],
              mode: SET_ACCESS_MODE.ADD
            }])
            console.log('[NodeOneCore] Granted browser access to new contact')
          }
          
          // Notify browser via IPC
          const { BrowserWindow } = await import('electron')
          const mainWindow = BrowserWindow.getAllWindows()[0]
          if (mainWindow) {
            mainWindow.webContents.send('contact:added', {
              personId: remotePersonId,
              someoneHash: someoneModel.idHash
            })
          }
        } catch (error) {
          console.error('[NodeOneCore] Failed to add contact from pairing:', error)
        }
      }
    })
    
    // Set up connection event monitoring
    this.connectionsModel.onConnectionsChange(() => {
      const connections = this.connectionsModel.connectionsInfo()
      console.log('[NodeOneCore] 🔄 Connections changed event fired!')
      console.log('[NodeOneCore] Current connections count:', connections.length)
      
      // Log active CHUM connections
      for (const conn of connections) {
        if (conn.isConnected && conn.protocolName === 'chum') {
          console.log('[NodeOneCore] CHUM connection active with:', conn.remotePersonId?.substring(0, 8))
          // CHUM will sync based on existing Access objects
        }
      }
      
      // Log connection details for debugging
      console.log('[NodeOneCore] Connection details:', connections.map(conn => ({
        id: conn.id?.substring(0, 20) + '...',
        isConnected: conn.isConnected,
        remotePersonId: conn.remotePersonId?.substring(0, 8),
        protocolName: conn.protocolName
      })))
    })
    
    // Wait for commserver connection to establish
    console.log('[NodeOneCore] Waiting for commserver connection...')
    await new Promise(resolve => setTimeout(resolve, 5000))  // Wait longer for connection
    
    // Check if we're connected to commserver
    console.log('[NodeOneCore] Checking commserver connection status...')
    const connections = this.connectionsModel.connectionsInfo()
    console.log('[NodeOneCore] Active connections after init:', connections.length)
    
    // Check if pairing is available
    if (this.connectionsModel.pairing) {
      console.log('[NodeOneCore] ✅ Pairing is available')
      // Check if we can create invitations
      try {
        const testInvite = await this.connectionsModel.pairing.createInvitation()
        if (testInvite) {
          console.log('[NodeOneCore] ✅ Can create invitations, commserver likely connected')
          console.log('[NodeOneCore] Test invitation URL:', testInvite.url)
        }
      } catch (e) {
        console.log('[NodeOneCore] ⚠️ Cannot create invitations:', e.message)
      }
    } else {
      console.log('[NodeOneCore] ❌ Pairing not available')
    }
    
    // Check catch-all routes after init
    console.log('[NodeOneCore] Checking catch-all routes after init...')
    if (this.connectionsModel.leuteConnectionsModule?.connectionRouteManager?.catchAllRoutes) {
      const catchAllCount = this.connectionsModel.leuteConnectionsModule.connectionRouteManager.catchAllRoutes.size
      console.log('[NodeOneCore] Catch-all routes registered:', catchAllCount)
      if (catchAllCount > 0) {
        console.log('[NodeOneCore] ✅ Pairing listener ready at commserver')
      }
    }
    
    // Check if commserver is connected
    if (this.connectionsModel.onlineState) {
      console.log('[NodeOneCore] ✅ Connected to commserver')
    } else {
      console.log('[NodeOneCore] ⚠️ Not connected to commserver - invitations may not work!')
    }
    
    // Check connection status
    console.log('[NodeOneCore] Active connections:', connections.length)
    
    // Log connection details for debugging
    for (const conn of connections) {
      if (conn.isConnected) {
        console.log(`[NodeOneCore] Connected to: ${conn.remotePersonId.substring(0, 8)}... (${conn.protocolName})`)
      }
    }
    
    // Note: Catch-all routes are listeners, not connections
    // They only become connections when someone connects via pairing
    
    // Verify catch-all routes are enabled
    if (this.connectionsModel.leuteConnectionsModule?.connectionRouteManager) {
      console.log('[NodeOneCore] Ensuring catch-all routes are enabled...')
      
      // Log the catch-all routes before enabling
      const catchAllRoutes = this.connectionsModel.leuteConnectionsModule.connectionRouteManager.catchAllRoutes
      console.log('[NodeOneCore] Catch-all routes before enable:', catchAllRoutes.size)
      
      for (const [key, value] of catchAllRoutes) {
        console.log('[NodeOneCore] Catch-all route key:', key)
        if (value.knownRoutes) {
          for (const route of value.knownRoutes) {
            console.log('[NodeOneCore] Route:', {
              type: route.route.type,
              id: route.route.id,
              disabled: route.disabled,
              active: route.route.active
            })
          }
        }
      }
      
      await this.connectionsModel.leuteConnectionsModule.connectionRouteManager.enableCatchAllRoutes()
      console.log('[NodeOneCore] Catch-all routes enabled')
      
      // Log the routes after enabling
      console.log('[NodeOneCore] Checking route status after enable...')
      for (const [key, value] of catchAllRoutes) {
        if (value.knownRoutes) {
          for (const route of value.knownRoutes) {
            console.log('[NodeOneCore] Route after enable:', {
              type: route.route.type,
              id: route.route.id,
              disabled: route.disabled,
              active: route.route.active
            })
          }
        }
      }
      
      // Wait a bit for catch-all connections to be established
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Check if port 8765 is listening and start it if not
      try {
        const { default: net } = await import('net')
        const isListening = await new Promise((resolve) => {
          const socket = net.createConnection({ port: 8765, host: 'localhost' })
          socket.on('connect', () => {
            socket.end()
            resolve(true)
          })
          socket.on('error', () => {
            resolve(false)
          })
        })
        console.log('[NodeOneCore] Port 8765 listening:', isListening)
        
        // If not listening, try to start the direct socket route
        if (!isListening && this.connectionsModel.leuteConnectionsModule?.connectionRouteManager) {
          console.log('[NodeOneCore] Port 8765 not listening, starting direct socket route...')
          const allRoutes = this.connectionsModel.leuteConnectionsModule.connectionRouteManager.getAllRoutes()
          for (const route of allRoutes) {
            if (route.type === 'IncomingWebsocketRouteDirect' && route.port === 8765 && !route.active) {
              console.log('[NodeOneCore] Starting direct socket route...')
              await route.start()
              console.log('[NodeOneCore] ✅ Direct socket listener started on ws://localhost:8765')
            }
          }
        }
      } catch (error) {
        console.log('[NodeOneCore] Could not check port 8765:', error.message)
      }
      
      // Re-check connections after enabling catch-all
      const updatedConnections = this.connectionsModel.connectionsInfo()
      const catchAllAfterEnable = updatedConnections.filter(c => c.isCatchAll)
      console.log('[NodeOneCore] Catch-all connections after enable:', catchAllAfterEnable.length)
      
      if (catchAllAfterEnable.length > 0) {
        console.log('[NodeOneCore] ✅ Catch-all connections ready for pairing')
      }
    } else {
      console.error('[NodeOneCore] WARNING: No connectionRouteManager available!')
    }
    
    console.log('[NodeOneCore] ✅ ConnectionsModel initialized')
    
    // Log pairing events
    if (this.connectionsModel.pairing) {
      console.log('[NodeOneCore] Pairing module available, active invitations:', this.connectionsModel.pairing.activeInvitations?.size || 0)
    }
    
    // Set up listeners for connection events
    this.connectionsModel.onConnectionsChange(async () => {
      console.log('[NodeOneCore] 🔄 Connections changed event fired!')
      const connections = this.connectionsModel.connectionsInfo()
      console.log('[NodeOneCore] Current connections count:', connections.length)
      console.log('[NodeOneCore] Connection details:', JSON.stringify(connections.map(c => ({
        id: c.id,
        isConnected: c.isConnected,
        remotePersonId: c.remotePersonId,
        protocolName: c.protocolName
      })), null, 2))
      
      // Initialize content sharing for new CHUM connections
      for (const conn of connections) {
        if (conn.isConnected && conn.protocolName === 'chum' && conn.remotePersonId) {
          console.log(`[NodeOneCore] CHUM connection detected with remote person: ${conn.remotePersonId.substring(0, 8)}...`)
          
          // Grant access rights to content objects (not Leute itself)
          const { createAccess } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/access.js')
          const { SET_ACCESS_MODE } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/storage-base-common.js')
          
          // Grant access to Someone objects (contacts in address book)
          try {
            const others = await this.leuteModel.others()
            for (const someone of others) {
              await createAccess([{
                id: someone.idHash,
                person: [conn.remotePersonId],
                group: [],
                mode: SET_ACCESS_MODE.ADD
              }])
            }
            console.log(`[NodeOneCore] ✅ Granted access to ${others.length} Someone objects for ${conn.remotePersonId.substring(0, 8)}...`)
          } catch (error) {
            console.warn('[NodeOneCore] Failed to grant Someone access:', error.message)
          }
        }
      }
      
      try {
        // Get all others (contacts) from LeuteModel
        const others = await this.leuteModel.others()
        console.log(`[NodeOneCore] Found ${others.length} contacts`)
        
        // Grant access to contacts channel for CHUM sync
        for (const someone of others) {
          try {
            const personId = await someone.mainIdentity()
            console.log('[NodeOneCore] Contact detected:', personId)
            
            // Grant access to the contacts channel
            const { createAccess } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/access.js')
            const { SET_ACCESS_MODE } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/storage-base-common.js')
            const { calculateIdHashOfObj } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/util/object.js')
            
            const myId = this.ownerId
            
            // Create access for the contacts channel
            const channelId = await calculateIdHashOfObj({
              $type$: 'ChannelInfo',
              id: 'contacts',
              owner: myId
            })
            
            await createAccess([{
              id: channelId,
              person: [personId],
              group: this.iomGroup ? [this.iomGroup.groupIdHash] : [],
              mode: SET_ACCESS_MODE.ADD
            }])
            
            console.log('[NodeOneCore] Access granted to contacts channel for:', personId)
            
            // Also grant mutual access to person-to-person message channels
            const p2pChannelId = myId < personId ? `${myId}<->${personId}` : `${personId}<->${myId}`
            
            try {
              // Calculate channel info hash for the person-to-person channel
              const p2pChannelInfoHash = await calculateIdHashOfObj({
                $type$: 'ChannelInfo',
                id: p2pChannelId,
                owner: myId  // I own the channel info
              })
              
              // Grant the other person access to read messages I send in our shared channel
              // Also grant IoM group access for sync between local instances
              await createAccess([{
                id: p2pChannelInfoHash,
                person: [personId],
                group: this.iomGroup ? [this.iomGroup.groupIdHash] : [],
                mode: SET_ACCESS_MODE.ADD
              }])
              
              console.log('[NodeOneCore] Mutual access granted for p2p channel:', p2pChannelId)
            } catch (error) {
              console.warn('[NodeOneCore] Failed to grant p2p channel access:', error.message)
            }
            
            // Try to grant access to their channel info if they own it
            try {
              const theirChannelInfoHash = await calculateIdHashOfObj({
                $type$: 'ChannelInfo', 
                id: p2pChannelId,
                owner: personId  // They own the channel info
              })
              
              // This will fail if we don't have permission, but that's expected
              // The other person needs to grant us access to their channel info
              console.log('[NodeOneCore] Would need access from', personId.substring(0, 8), 'to read their channel info')
            } catch (error) {
              // This is expected - we can't grant ourselves access to their channel info
            }
            
            // The browser instance will receive this contact via CHUM sync
          } catch (error) {
            console.warn('[NodeOneCore] Error granting access to contact:', error)
          }
        }
      } catch (error) {
        console.error('[NodeOneCore] Failed to process connections change:', error)
      }
    })
    
    // Set up message sync handling for AI responses
    await this.setupMessageSync()
    
    // AI contacts will be set up later after LLMManager is initialized
    // This is called from setupAIContactsWhenReady()
    
    console.log('[NodeOneCore] All models initialized successfully')
  }

  /**
   * Set up message sync - listen for user messages, process with AI, respond
   */
  async setupMessageSync() {
    console.log('[NodeOneCore] Setting up message sync for AI processing...')
    
    if (!this.topicModel) {
      console.warn('[NodeOneCore] TopicModel not available for message sync')
      return
    }
    
    // Track topics we've sent greetings to
    this.greetedTopics = new Set()
    
    // Set up periodic check for new messages (TopicModel doesn't have onTopicsChange)
    // This will be improved once we understand the proper event system
    this.messageSyncInterval = setInterval(async () => {
      try {
        const topics = await this.topicModel.topics()
        
        for (const topic of topics) {
          const topicRoom = await this.topicModel.joinTopic(topic.id)
          if (!topicRoom) continue
          
          // Check if this is the default AI chat and send greeting if needed
          if (topic.id === 'default' && !this.greetedTopics.has('default')) {
            console.log('[NodeOneCore] Found default AI chat, sending greeting...')
            await this.sendAIGreeting(topicRoom)
            this.greetedTopics.add('default')
          }
          
          // Get recent messages
          const messages = await topicRoom.getRecentMessages(10)
          
          // Check for unprocessed user messages
          for (const message of messages) {
            if (await this.shouldProcessMessage(message)) {
              await this.processMessageWithAI(topicRoom, message)
            }
          }
        }
      } catch (error) {
        // Silently skip - topics might not be ready yet
      }
    }, 5000) // Check every 5 seconds
    
    console.log('[NodeOneCore] ✅ Message sync set up for AI processing')
  }
  
  /**
   * Send AI greeting message to a topic
   */
  async sendAIGreeting(topicRoom) {
    try {
      // Get LLM manager to find active model
      const { default: llmManager } = await import('../services/llm-manager.js')
      const models = llmManager.getAvailableModels()
      
      // Use first available model or default
      const modelId = models.length > 0 ? models[0].id : 'gpt-oss'
      const modelName = models.length > 0 ? models[0].name : 'your AI assistant'
      
      // Create AI person ID for the greeting
      const aiPersonId = await this.getOrCreateAIPersonId(modelId, modelName)
      
      // Send greeting message as plain text
      // TopicRoom.sendMessage expects (text, author, channelOwner)
      const greetingText = `Hello! I'm ${modelName}. How can I help you today?`
      
      await topicRoom.sendMessage(greetingText, aiPersonId, undefined)
      console.log(`[NodeOneCore] ✅ AI greeting sent from ${modelName}`)
    } catch (error) {
      console.error('[NodeOneCore] Failed to send AI greeting:', error)
    }
  }
  
  /**
   * Check if a message should be processed by AI
   */
  async shouldProcessMessage(message) {
    // Skip if it's an AI message (don't respond to ourselves)
    if (message.author && message.author.includes('ai-')) {
      return false
    }
    
    // Skip if we already responded to this message
    // TODO: Implement proper tracking of processed messages
    
    return true
  }
  
  /**
   * Process a user message with AI and send response
   */
  async processMessageWithAI(topicRoom, userMessage) {
    console.log('[NodeOneCore] Processing user message with AI...')
    
    try {
      // Get LLM manager from main process
      const { default: llmManager } = await import('../services/llm-manager.js')
      
      // Get AI response
      const response = await llmManager.generateResponse({
        messages: [{
          role: 'user',
          content: userMessage.content
        }],
        model: 'gpt-oss' // Default model
      })
      
      if (response && response.content) {
        // Create AI person ID for the response
        const aiPersonId = await this.getOrCreateAIPersonId('gpt-oss')
        
        // Send AI response to topic (will sync via CHUM to browser)
        await topicRoom.sendMessage(response.content, aiPersonId, this.ownerId)
        
        console.log('[NodeOneCore] ✅ AI response sent to topic')
      }
    } catch (error) {
      console.error('[NodeOneCore] Error processing message with AI:', error)
    }
  }
  
  /**
   * Set up AI assistant contacts for available models
   */
  async setupAIContacts() {
    console.log('[NodeOneCore] 🤖 Setting up AI assistant contacts...')
    
    try {
      // Get available AI models from LLM manager
      const { default: llmManager } = await import('../services/llm-manager.js')
      const models = llmManager.getAvailableModels()
      
      console.log(`[NodeOneCore] Found ${models.length} AI models to create contacts for`)
      
      // Use the AI Contact Manager to create contacts
      const aiContacts = await this.aiContactManager.setupAIContacts(models)
      
      console.log(`[NodeOneCore] ✅ Created ${aiContacts.length} AI contacts`)
      
      // Store for reference
      this.aiPersonIds = aiContacts
      
      return aiContacts
    } catch (error) {
      console.error('[NodeOneCore] Could not set up AI contacts:', error)
    }
  }
  
  /**
   * Get AI person ID for a model (delegates to AIContactManager)
   */
  async getOrCreateAIPersonId(modelId, displayName) {
    // Delegate to the AI Contact Manager
    return this.aiContactManager.createAIContact(modelId, displayName)
  }
  
  /**
   * OLD METHOD - TO BE REMOVED
   */
  async getOrCreateAIPersonId_OLD(modelId, displayName) {
    console.log(`[NodeOneCore] Getting/creating AI person for ${displayName} (${modelId})`)
    
    try {
      if (!this.leuteModel) {
        console.error('[NodeOneCore] LeuteModel not available')
        return null
      }

      // Import required modules
      const { storeVersionedObject } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/storage-versioned-objects.js')
      const { createPersonIfNotExist } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/misc/person.js')
      
      // Create email for AI identity
      const email = `${modelId.replace(/[^a-zA-Z0-9]/g, '_')}@ai.local`
      
      // Use createPersonIfNotExist - it's idempotent and content-addressed
      const result = await createPersonIfNotExist(email)
      const personId = result.personId
      
      if (result.exists) {
        console.log(`[NodeOneCore] Using existing AI person for ${displayName}: ${personId.substring(0, 8)}...`)
      } else {
        console.log(`[NodeOneCore] Created new AI person for ${displayName}: ${personId.substring(0, 8)}...`)
      }
      
      // Get or create Someone wrapper for this person
      let someone = await this.leuteModel.someone(personId)
      let someoneIdHash
      
      if (!someone) {
        // Create profile and Someone wrapper for new person
        const myIdentity = await this.leuteModel.myMainIdentity()
        const newProfile = await ProfileModel.constructWithNewProfile(personId, myIdentity, 'default')
        await this.leuteModel.addProfile(newProfile.idHash)
        
        someone = await this.leuteModel.someone(personId)
        if (!someone) {
          throw new Error('Failed to create Someone wrapper for AI person')
        }
        someoneIdHash = someone.idHash
      } else {
        someoneIdHash = someone.idHash
      }
      
      // Load the created Someone model
      const someoneModel = await SomeoneModel.constructFromLatestVersion(someoneIdHash)
      
      // Get the main profile of the Someone  
      const profile = await someoneModel.mainProfile()
      
      // Add AI-specific information to the profile
      profile.personDescriptions = profile.personDescriptions || []
      profile.personDescriptions.push({
        $type$: 'PersonName',
        name: displayName
      })
      
      // Add AI model identifier as a custom field
      profile.description = `${displayName} AI Assistant (${modelId})`
      
      // Add communication endpoint
      profile.communicationEndpoints = profile.communicationEndpoints || []
      profile.communicationEndpoints.push({
        $type$: 'Email',
        email: email
      })
      
      // Persist the changes
      await profile.saveAndLoad()
      
      console.log(`[NodeOneCore] ✅ AI contact ${displayName} ready with ID: ${personId.substring(0, 8)}...`)
      
      return personId
    } catch (error) {
      console.error(`[NodeOneCore] Failed to create AI person for ${displayName}:`, error)
      // Fall back to simple hash
      const crypto = await import('crypto')
      return crypto
        .createHash('sha256')
        .update(`ai-assistant-${modelId}-${this.ownerId}`)
        .digest('hex')
    }
  }

  /**
   * Set up AI contacts after LLMManager is ready
   * This should be called from the main app after LLMManager.init()
   */
  async setupAIContactsWhenReady() {
    if (!this.initialized) {
      console.log('[NodeOneCore] Cannot set up AI contacts - Node not initialized')
      return
    }
    
    try {
      await this.setupAIContacts()
    } catch (error) {
      console.error('[NodeOneCore] Failed to set up AI contacts:', error)
    }
  }
  
  /**
   * Get current instance info
   */
  getInfo() {
    return {
      initialized: this.initialized,
      name: this.instanceName,
      ownerId: this.ownerId
    }
  }
  
  /**
   * Get instance credentials for browser IoM pairing
   */
  async getCredentialsForBrowser() {
    if (!this.initialized) {
      throw new Error('Node.js instance not initialized')
    }
    
    const { SettingsStore } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/system/settings-store.js')
    
    const email = await SettingsStore.getItem('email')
    const instanceName = await SettingsStore.getItem('instance')
    
    if (!email) {
      throw new Error('No credentials found in Node.js instance')
    }
    
    return {
      email: email,
      nodeInstanceName: instanceName,
      // Browser should use same email but different instance name
      browserInstanceName: 'browser'
    }
  }

  /**
   * Set/get state and settings
   */
  async setState(key, value) {
    console.log(`[NodeOneCore] Setting state: ${key}`)
    // TODO: Use Settings datatype when available
    return true
  }

  getState(key) {
    // TODO: Use Settings datatype when available
    return undefined
  }
  
  async setSetting(key, value) {
    // TODO: Implement proper settings storage
    console.log(`[NodeOneCore] Setting: ${key} = ${value}`)
    return true
  }
  
  async getSetting(key) {
    // TODO: Implement proper settings retrieval
    return undefined
  }
  
  async getSettings(prefix) {
    // TODO: Implement proper settings retrieval
    return {}
  }

  /**
   * Handle known connections - start CHUM protocol
   */
  async handleKnownConnection(conn, localPersonId, localInstanceId, remotePersonId, remoteInstanceId, initiatedLocally, routeGroupId) {
    console.log('[NodeOneCore] Starting CHUM protocol for known connection')
    
    const { startChumProtocol } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/misc/ConnectionEstablishment/protocols/Chum.js')
    const { OEvent } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/misc/OEvent.js')
    
    const onProtocolStart = new OEvent()
    
    await startChumProtocol(
      conn,
      localPersonId,
      localInstanceId,
      remotePersonId,
      remoteInstanceId,
      initiatedLocally,
      routeGroupId,
      onProtocolStart,
      false,  // noImport
      false   // noExport
    )
    
    console.log('[NodeOneCore] ✅ CHUM protocol started')
  }
  
  /**
   * Handle unknown connections - could be browser with different person ID
   */
  async handleUnknownConnection(conn, localPersonId, localInstanceId, remotePersonId, remoteInstanceId, initiatedLocally, routeGroupId) {
    console.log('[NodeOneCore] Handling unknown connection - checking if it\'s the browser')
    
    // For now, accept and start CHUM if it's from localhost (browser)
    if (routeGroupId.includes('chum')) {
      await this.handleKnownConnection(conn, localPersonId, localInstanceId, remotePersonId, remoteInstanceId, initiatedLocally, routeGroupId)
    }
  }
  
  /**
   * Clean up instance to allow re-initialization
   */
  async cleanup() {
    console.log('[NodeOneCore] Cleaning up instance...')
    
    try {
      // Stop direct connection listener
      if (this.directListenerStopFn) {
        await this.directListenerStopFn()
        this.directListenerStopFn = null
      }
      
      // Close WebSocket server if running
      if (this.wss) {
        this.wss.close()
        this.wss = null
      }
      
      // Shutdown ONE.core instance properly
      const { closeInstance } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/instance.js')
      closeInstance()
      
      // Reset all models
      this.leuteModel = null
      this.connectionsModel = null
      this.channelManager = null
      this.topicModel = null
      this.iomManager = null
      
      // Clear intervals
      if (this.messageSyncInterval) {
        clearInterval(this.messageSyncInterval)
        this.messageSyncInterval = null
      }
      
      console.log('[NodeOneCore] Cleanup complete')
    } catch (error) {
      console.error('[NodeOneCore] Error during cleanup:', error)
    }
  }


  /**
   * Set up proper access rights using AccessRightsManager pattern
   */
  async setupProperAccessRights() {
    if (!this.channelManager || !this.leuteModel) {
      console.warn('[NodeOneCore] ChannelManager or LeuteModel not available for access rights setup')
      return
    }
    
    try {
      // Create groups for access rights management
      const { default: GroupModel } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/Leute/GroupModel.js')
      
      const { default: LeuteModel } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/models/Leute/LeuteModel.js')
      const everyoneGroup = await LeuteModel.everyoneGroup()
      
      // Create federation group for instance-to-instance communication
      let federationGroup
      try {
        federationGroup = await GroupModel.constructFromLatestProfileVersionByGroupName('federation')
        console.log('[NodeOneCore] Using existing federation group')
      } catch {
        federationGroup = await this.leuteModel.createGroup('federation')
        console.log('[NodeOneCore] Created new federation group')
      }
      
      // Create replicant group for inter-instance sync
      let replicantGroup
      try {
        replicantGroup = await GroupModel.constructFromLatestProfileVersionByGroupName('replicant')
        console.log('[NodeOneCore] Using existing replicant group')
      } catch {
        replicantGroup = await this.leuteModel.createGroup('replicant')
        console.log('[NodeOneCore] Created new replicant group')
      }
      
      // Initialize access rights manager with groups
      const { default: NodeAccessRightsManager } = await import('./access-rights-manager.js')
      // ConnectionsModel already imported and used as this.connectionsModel
      
      this.accessRightsManager = new NodeAccessRightsManager(
        this.channelManager,
        this.connectionsModel,
        this.leuteModel
      )
      
      await this.accessRightsManager.init({
        everyone: everyoneGroup.groupIdHash,
        federation: federationGroup.groupIdHash,
        replicant: replicantGroup.groupIdHash
      })
      
      console.log('[NodeOneCore] ✅ Access rights manager initialized with proper groups')
      
    } catch (error) {
      console.error('[NodeOneCore] Failed to setup access rights:', error)
      // Continue without proper access rights - basic functionality may still work
    }
  }

  /**
   * Shutdown the instance properly
   */
  async shutdown() {
    console.log('[NodeOneCore] Shutting down...')
    await this.cleanup()
    
    if (this.accessRightsManager) {
      await this.accessRightsManager.shutdown()
      this.accessRightsManager = undefined
    }
    
    this.initialized = false
    this.instanceName = null
    this.ownerId = null
    console.log('[NodeOneCore] Shutdown complete')
  }
}

// Singleton
export default new NodeOneCore()