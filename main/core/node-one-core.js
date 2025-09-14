/**
 * Node.js ONE.core Instance using one.leute.replicant template
 * Proper initialization following the template pattern
 */

// Polyfill WebSocket for Node.js environment
import { WebSocket } from 'ws';
global.WebSocket = WebSocket;

import path from 'path';
import { fileURLToPath } from 'url';
import AIAssistantModel from './ai-assistant-model.js';
import RefinioApiServer from '../api/refinio-api-server.js';
import TopicGroupManager from './topic-group-manager.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class NodeOneCore {
  constructor() {
    this.initialized = false
    this.instanceName = null
    this.ownerId = null
    this.leuteModel = null
    this.appStateModel = null
    this.connectionsModel = null
    this.channelManager = null
    this.topicModel = null
    this.localWsServer = null
    this.instanceModule = null // Track the instance module
    this.aiAssistantModel = null // Will be initialized after models are ready
    this.apiServer = null // Refinio API server
    this.topicGroupManager = null // Will be initialized after models are ready
    this.federationGroup = null // Track federation group for access
  }

  /**
   * Initialize Node.js ONE.core using the proper template
   */
  async initialize(username, password) {
    if (this.initialized) {
      console.log('[NodeOneCore] Already initialized')
      return { success: true, ownerId: this.ownerId, instanceName: this.instanceName }
    }
    
    // Use different instance name for Node
    this.instanceName = `lama-node-${username}`
    console.log(`[NodeOneCore] Initializing Node instance for browser user: ${username}`)
    
    // No patching needed - fixed in ONE.models source
    
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
   * Initialize ONE.core instance using SingleUserNoAuth (same as browser)
   */
  async initOneCoreInstance(username, password, directory) {
    // Ensure storage directories exist
    const fs = await import('fs')
    const path = await import('path')
    
    const oneDbPath = path.join(process.cwd(), 'OneDB')
    const oneCoreStoragePath = path.join(process.cwd(), 'one-core-storage')
    
    // Create OneDB directory if it doesn't exist
    if (!fs.existsSync(oneDbPath)) {
      fs.mkdirSync(oneDbPath, { recursive: true })
      console.log('[NodeOneCore] Created OneDB directory')
    }
    
    // Create one-core-storage directory if it doesn't exist
    if (!fs.existsSync(oneCoreStoragePath)) {
      fs.mkdirSync(oneCoreStoragePath, { recursive: true })
      console.log('[NodeOneCore] Created one-core-storage directory')
    }
    
    // Load Node.js platform FIRST - before any other ONE.core imports
    console.log('[NodeOneCore] Loading Node.js platform...')
    await import('@refinio/one.core/lib/system/load-nodejs.js')
    console.log('[NodeOneCore] ✅ Node.js platform loaded')
    
    // Now safe to import ONE.core modules
    const { closeInstance } = await import('@refinio/one.core/lib/instance.js')
    
    // Ensure clean slate - close any existing instance singleton
    try {
      closeInstance()
      console.log('[NodeOneCore] Closed existing ONE.core singleton for clean init')
    } catch (e) {
      // OK if there was no existing instance
    }
    
    // Import SingleUserNoAuth - same as browser and one.leute
    const { default: SingleUserNoAuth } = await import('@refinio/one.models/lib/models/Authenticator/SingleUserNoAuth.js')
    const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
    
    // Use DIFFERENT email from browser to enable federation
    // ConnectionsModel won't connect instances with the same person ID
    const instanceName = `lama-node-${username}`
    const email = `node-${username}@lama.local`  // Different email for federation to work
    
    console.log('[NodeOneCore] Using SingleUserNoAuth pattern for Node instance:', email)
    
    // Import recipes following one.leute pattern
    const { CORE_RECIPES } = await import('@refinio/one.core/lib/recipes.js')
    const ModelsRecipesStableModule = await import('@refinio/one.models/lib/recipes/recipes-stable.js')
    const ModelsRecipesExperimentalModule = await import('@refinio/one.models/lib/recipes/recipes-experimental.js')
    const { LamaRecipes } = await import('../recipes/index.js')
    const { StateEntryRecipe, AppStateJournalRecipe } = await import('@refinio/refinio-api/dist/state/index.js')
    
    // Import reverse maps
    const ReverseMapsStableModule = await import('@refinio/one.models/lib/recipes/reversemaps-stable.js')
    const ReverseMapsExperimentalModule = await import('@refinio/one.models/lib/recipes/reversemaps-experimental.js')
    
    const ModelsRecipesStable = ModelsRecipesStableModule.default
    const ModelsRecipesExperimental = ModelsRecipesExperimentalModule.default
    const { ReverseMapsStable, ReverseMapsForIdObjectsStable } = ReverseMapsStableModule
    const { ReverseMapsExperimental, ReverseMapsForIdObjectsExperimental } = ReverseMapsExperimentalModule
    
    // Create SingleUserNoAuth instance - same pattern as one.leute
    const allRecipes = [
      ...(CORE_RECIPES || []),
      ...(ModelsRecipesStable || []),
      ...(ModelsRecipesExperimental || []),
      ...(LamaRecipes || []),
      StateEntryRecipe,
      AppStateJournalRecipe
    ].filter(r => r && typeof r === 'object' && r.name)
    
    console.log('[NodeOneCore] Creating SingleUserNoAuth with', allRecipes.length, 'recipes')
    console.log('[NodeOneCore] CORE_RECIPES length:', CORE_RECIPES?.length || 0)
    console.log('[NodeOneCore] First 5 recipe names:', allRecipes.slice(0, 5).map(r => r.name))
    
    // Check specifically for Person recipe
    const personRecipe = allRecipes.find(r => r.name === 'Person')
    console.log('[NodeOneCore] Person recipe found:', !!personRecipe)
    
    // Debug: Check for LLM recipe and its structure
    const llmRecipes = allRecipes.filter(r => r.name === 'LLM')
    console.log('[NodeOneCore] Found', llmRecipes.length, 'LLM recipe(s)')
    if (llmRecipes.length > 0) {
      llmRecipes.forEach((recipe, index) => {
        const idField = recipe.rule?.find(r => r.isId === true)
        console.log(`[NodeOneCore] LLM Recipe #${index + 1} ID field:`, idField?.itemprop || 'NO ID FIELD')
        console.log(`[NodeOneCore] LLM Recipe #${index + 1} has ${recipe.rule?.length || 0} rules`)
      })
    }
    console.log('[NodeOneCore] LamaRecipes:', LamaRecipes?.map(r => r.name).join(', '))
    
    this.oneAuth = new SingleUserNoAuth({
      recipes: allRecipes,
      reverseMaps: new Map([
        ...(ReverseMapsStable || []),
        ...(ReverseMapsExperimental || [])
      ]),
      reverseMapsForIdObjects: new Map([
        ...(ReverseMapsForIdObjectsStable || []),
        ...(ReverseMapsForIdObjectsExperimental || [])
      ]),
      storageInitTimeout: 20000
    })
    
    try {
      // Check if already registered
      const isRegistered = await this.oneAuth.isRegistered()
      
      if (isRegistered) {
        console.log('[NodeOneCore] Instance already registered, logging in...')
        await this.oneAuth.login()
      } else {
        console.log('[NodeOneCore] Registering new instance with email:', email)
        await this.oneAuth.register({
          email: email,
          instanceName: instanceName,
          secret: password
        })
      }
      
      // Get owner ID AFTER proper authentication
      this.ownerId = getInstanceOwnerIdHash()
      this.instanceName = instanceName
      
      // Verify owner ID is available
      if (!this.ownerId) {
        throw new Error('Owner ID not available after authentication')
      }
      
      console.log('[NodeOneCore] ONE.core instance initialized successfully')
      console.log('[NodeOneCore] Owner ID:', this.ownerId)
      console.log('[NodeOneCore] Instance name:', this.instanceName)
      
      // After authentication, explicitly register our custom recipes with the runtime
      // This ensures they're available for storeVersionedObject calls
      const { addRecipeToRuntime, hasRecipe } = await import('@refinio/one.core/lib/object-recipes.js')
      
      // Register LamaRecipes
      for (const recipe of LamaRecipes) {
        if (!hasRecipe(recipe.name)) {
          console.log(`[NodeOneCore] Registering recipe: ${recipe.name}`)
          addRecipeToRuntime(recipe)
          
          // Debug: Verify the recipe was added correctly
          if (recipe.name === 'LLM') {
            const idField = recipe.rule?.find(r => r.isId === true)
            console.log(`[NodeOneCore] LLM Recipe registered with ID field: ${idField?.itemprop}`)
          }
        }
      }
      
      // Register AppState recipes
      if (!hasRecipe(StateEntryRecipe.name)) {
        console.log(`[NodeOneCore] Registering recipe: ${StateEntryRecipe.name}`)
        addRecipeToRuntime(StateEntryRecipe)
      }
      if (!hasRecipe(AppStateJournalRecipe.name)) {
        console.log(`[NodeOneCore] Registering recipe: ${AppStateJournalRecipe.name}`)
        addRecipeToRuntime(AppStateJournalRecipe)
      }
      
    } catch (e) {
      console.error('[NodeOneCore] Authentication failed:', e)
      throw e
    }
  }

  /**
   * Monitor pairing and CHUM transitions
   * ConnectionsModel handles the transition automatically
   */
  setupConnectionMonitoring() {
    console.log('[NodeOneCore] Setting up connection monitoring...')
    
    // Just monitor what ConnectionsModel is doing - don't interfere
    if (this.connectionsModel?.pairing) {
      this.connectionsModel.pairing.onPairingSuccess((initiatedLocally, localPersonId, localInstanceId, remotePersonId, remoteInstanceId, token) => {
        console.log('[NodeOneCore] ✅ Pairing successful')
        console.log('[NodeOneCore] Remote person:', remotePersonId?.substring(0, 8))
        // ConnectionsModel will handle the transition to CHUM automatically
      })
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
    const { objectEvents } = await import('@refinio/one.models/lib/misc/ObjectEventDispatcher.js')
    try {
      await objectEvents.init()
      console.log('[NodeOneCore] ✅ ObjectEventDispatcher initialized')
      
      // TRACE: Log when ChannelInfo objects are received
      objectEvents.onNewVersion(async (obj) => {
        if (obj.$type$ === 'ChannelInfo') {
          console.log('[NodeOneCore] 📨 NODE: Received ChannelInfo via CHUM!', {
            channelId: obj.id,
            owner: obj.owner?.substring(0, 8)
          })
        }
      })
    } catch (error) {
      // If it's already initialized, that's fine
      if (error.message?.includes('already initialized')) {
        console.log('[NodeOneCore] ObjectEventDispatcher already initialized, continuing...')
      } else {
        throw error
      }
    }
    
    // Initialize LeuteModel with commserver for external connections
    console.log('[NodeOneCore] About to initialize LeuteModel...')
    
    // Double-check owner ID is still available
    const { getInstanceOwnerIdHash: checkOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
    const currentOwnerId = checkOwnerIdHash()
    console.log('[NodeOneCore] Current owner ID before LeuteModel init:', currentOwnerId)
    console.log('[NodeOneCore] This.ownerId before LeuteModel init:', this.ownerId)
    
    if (!currentOwnerId) {
      throw new Error('Owner ID disappeared before LeuteModel initialization')
    }
    
    const { default: LeuteModel } = await import('@refinio/one.models/lib/models/Leute/LeuteModel.js')
    this.leuteModel = new LeuteModel(commServerUrl, true) // true = create everyone group
    console.log('[NodeOneCore] LeuteModel created, calling init()...')
    await this.leuteModel.init()
    console.log('[NodeOneCore] ✅ LeuteModel initialized with commserver:', commServerUrl)
    
    // Now that LeuteModel is initialized, get the person ID (but keep instance owner ID)
    try {
      const me = await this.leuteModel.me()
      if (me) {
        const personId = await me.mainIdentity()
        if (personId) {
          // DO NOT overwrite this.ownerId - it should remain the instance owner ID hash
          console.log('[NodeOneCore] Person ID from LeuteModel:', personId)
          console.log('[NodeOneCore] Keeping instance owner ID:', this.ownerId)
        }
      }
    } catch (error) {
      console.error('[NodeOneCore] Failed to get person ID from LeuteModel:', error)
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
    const { default: ChannelManager } = await import('@refinio/one.models/lib/models/ChannelManager.js')
    this.channelManager = new ChannelManager(this.leuteModel)
    await this.channelManager.init()
    console.log('[NodeOneCore] ✅ ChannelManager initialized')
    
    // Set up proper access rights using AccessRightsManager
    await this.setupProperAccessRights()
    
    // Set up federation-aware channel sync
    const { setupChannelSyncListeners } = await import('./federation-channel-sync.js')
    setupChannelSyncListeners(this.channelManager, 'Node', (channelId, messages) => {
      console.log('\n' + '='.repeat(60))
      console.log('📥 MESSAGE FLOW TRACE - NODE RECEIVED via CHUM')
      console.log('='.repeat(60))
      console.log(`[TRACE] 📨 NODE: Received ${messages.length} messages in channel ${channelId}`)
      console.log(`[NodeOneCore] 📨 New messages in channel ${channelId}:`, messages.length)
      
      // Log message details
      messages.forEach((msg, idx) => {
        console.log(`[TRACE] Message ${idx + 1}:`, {
          text: msg.text?.substring(0, 50),
          sender: msg.sender?.substring(0, 8),
          timestamp: msg.timestamp
        })
      })
      
      // Check if this is an AI-enabled topic and respond if needed
      if (this.aiAssistantModel && this.aiAssistantModel.isAITopic(channelId)) {
        console.log(`[TRACE] 🤖 NODE: AI topic detected, processing...`)
        console.log(`[NodeOneCore] AI topic detected, processing messages...`)
        // AI response will be handled by AIMessageListener
      }
    })
    console.log('[NodeOneCore] ✅ Federation channel sync listener registered')
    
    // Add more detailed CHUM data reception logging
    console.log('[NodeOneCore] 🎯🎯🎯 NODE: Setting up detailed CHUM data reception logging')
    this.channelManager.onUpdated((channelInfoIdHash, channelId, owner, time, data) => {
      console.log('[NodeOneCore] 🔔🔔🔔 NODE CHUM DATA RECEIVED!', {
        channelId,
        owner: owner?.substring(0, 8),
        dataLength: data?.length,
        timestamp: new Date(time).toISOString(),
        myOwnerId: this.ownerId?.substring(0, 8),
        isMyChannel: owner === this.ownerId
      })
      
      // Log what's actually in the data
      if (data && data.length > 0) {
        data.forEach((item, idx) => {
          console.log(`[NodeOneCore]   CHUM Data[${idx}]:`, {
            type: item.$type$,
            content: item.content ? item.content.substring(0, 50) + '...' : undefined,
            author: item.author?.substring(0, 8),
            timestamp: item.creationTime
          })
        })
        
        // Check if this is a ChatMessage
        const chatMessages = data.filter(d => d.$type$ === 'ChatMessage')
        if (chatMessages.length > 0) {
          console.log(`[NodeOneCore] 💬 NODE RECEIVED ${chatMessages.length} CHAT MESSAGES via CHUM!`)
          chatMessages.forEach(msg => {
            console.log('[NodeOneCore]   Message:', {
              content: msg.content?.substring(0, 100),
              author: msg.author?.substring(0, 8)
            })
          })
        }
      }
    })
    
    // Initialize TopicModel - needs channelManager and leuteModel
    const { default: TopicModel } = await import('@refinio/one.models/lib/models/Chat/TopicModel.js')
    this.topicModel = new TopicModel(this.channelManager, this.leuteModel)
    await this.topicModel.init()
    console.log('[NodeOneCore] ✅ TopicModel initialized')
    
    // TODO: Fix AppStateModel - AppStateJournal recipe needs to be versioned
    // Initialize AppStateModel for CRDT-based state journaling
    // const { AppStateModel } = await import('@refinio/refinio-api/dist/state/index.js')
    // // Pass the current ONE instance (oneAuth) to AppStateModel
    // this.appStateModel = new AppStateModel(this.oneAuth, 'nodejs')
    // await this.appStateModel.init(this.ownerId)
    // console.log('[NodeOneCore] ✅ AppStateModel initialized')
    
    // // Record initial Node.js state
    // await this.appStateModel.recordStateChange(
    //   'nodejs.initialized',
    //   true,
    //   false,
    //   { action: 'init', description: 'Node.js ONE.core instance initialized' }
    // )
    
    console.log('[NodeOneCore] ⚠️  AppStateModel disabled - recipe issue needs fixing')
    
    // Create contacts channel for CHUM sync
    await this.channelManager.createChannel('contacts')
    console.log('[NodeOneCore] ✅ Contacts channel created')
    
    // Create default channel for conversations
    await this.channelManager.createChannel('default')
    console.log('[NodeOneCore] ✅ Default channel created')
    
    // Initialize ConnectionsModel with commserver for external connections
    // ConnectionsModel will be imported later when needed
    
    // Skip MessageBus logging for now - focus on route registration
    
    // Note: Local browser-to-node sync will happen via IPC, not WebSocket
    // External connections still use commserver via ConnectionsModel
    
    // Create blacklist group for ConnectionsModel
    const { default: GroupModel } = await import('@refinio/one.models/lib/models/Leute/GroupModel.js')
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
    
    // Note: Profile with OneInstanceEndpoint will be created on-the-fly
    // when the browser is invited (in node-provisioning.js)
    console.log('[NodeOneCore] Federation API initialized')
    
    // Create ConnectionsModel with standard configuration matching one.leute
    const { default: ConnectionsModel } = await import('@refinio/one.models/lib/models/ConnectionsModel.js')
    
    // ConnectionsModel configuration with separate sockets for pairing and CHUM
    // Port 8765: Pairing only (accepts unknown instances)
    // Port 8766: CHUM sync only (known instances only)
    
    this.connectionsModel = new ConnectionsModel(this.leuteModel, {
      commServerUrl,                      
      acceptIncomingConnections: true,    
      // Configure multiple incoming connection methods
      incomingConnectionConfigurations: [
        // CommServer for external connections
        {
          type: 'commserver',
          url: commServerUrl,
          catchAll: true  // Handle all unknown connections
        },
        // Direct socket for local federation
        {
          type: 'socket', 
          host: 'localhost',
          port: 8765,
          url: 'ws://localhost:8765',
          catchAll: true  // Accept all connections
        }
      ],
      acceptUnknownInstances: true,       // Accept new instances via pairing
      acceptUnknownPersons: false,        // Require pairing for new persons
      allowPairing: true,                 // Enable pairing protocol
      establishOutgoingConnections: true,  // Auto-connect to discovered endpoints
      allowDebugRequests: true,
      pairingTokenExpirationDuration: 60000 * 15,  // 15 minutes
      noImport: false,
      noExport: false
    })
    
    console.log('[NodeOneCore] ConnectionsModel created:', {
      commServer: commServerUrl,
      directSocket: 'ws://localhost:8765',  // Single port for pairing and CHUM
      acceptUnknownInstances: true,      // Required for pairing
      acceptUnknownPersons: false,
      allowPairing: true
    })
    
    console.log('[NodeOneCore] Initializing ConnectionsModel with blacklist group...')
    
    // Monitor connections (ConnectionsModel handles transitions automatically)
    this.setupConnectionMonitoring()
    
    // Initialize with blacklist group (standard one.leute pattern)
    await this.connectionsModel.init(blacklistGroup)
    
    console.log('[NodeOneCore] ✅ ConnectionsModel initialized with dual listeners')
    console.log('[NodeOneCore]   - CommServer:', commServerUrl, '(for pairing & external connections)')
    console.log('[NodeOneCore]   - Direct socket: ws://localhost:8765 (for browser-node federation)')
    
    // Register CHUM protocol explicitly if needed
    if (this.connectionsModel.leuteConnectionsModule) {
      console.log('[NodeOneCore] Checking CHUM protocol registration...')
      
      // CHUM should be auto-registered, but let's verify
      const protocols = this.connectionsModel.leuteConnectionsModule.getRegisteredProtocols?.()
      if (protocols && !protocols.includes('chum')) {
        console.warn('[NodeOneCore] CHUM protocol not registered, attempting manual registration...')
        // CHUM is typically auto-registered by LeuteConnectionsModule
        // If not, there may be an issue with the module initialization
      } else if (protocols) {
        console.log('[NodeOneCore] ✅ CHUM protocol is registered:', protocols.includes('chum'))
      }
      
      // Monitor for CHUM connections
      this.connectionsModel.onConnectionsChange(() => {
        const connections = this.connectionsModel.connectionsInfo()
        const chumConnections = connections.filter(c => c.protocolName === 'chum' && c.isConnected)
        if (chumConnections.length > 0) {
          console.log('[NodeOneCore] 🔄 Active CHUM connections:', chumConnections.length)
          chumConnections.forEach(conn => {
            console.log('[NodeOneCore]   - CHUM with:', conn.remotePersonId?.substring(0, 8))
          })
        }
      })
    }
    
    // Both listeners are now configured through incomingConnectionConfigurations
    // No need for manual listenForDirectConnections - ConnectionsModel handles both
    
    // Let ConnectionsModel handle all connection events internally
    // We don't need to manually manage connections - that's what caused the spare connection issue
    
    // Log pairing events
    if (this.connectionsModel.pairing && typeof this.connectionsModel.pairing.onPairingSuccess?.on === 'function') {
      console.log('[NodeOneCore] Pairing module available')
      
      // Add detailed pairing event logging
      this.connectionsModel.pairing.onPairingSuccess.on((initiatedLocally, localPersonId, localInstanceId, remotePersonId, remoteInstanceId, token) => {
        console.log('[NodeOneCore] 🎉 Pairing SUCCESS!', {
          initiatedLocally,
          localPerson: localPersonId?.substring(0, 8),
          localInstance: localInstanceId?.substring(0, 8),
          remotePerson: remotePersonId?.substring(0, 8),
          remoteInstance: remoteInstanceId?.substring(0, 8),
          token: token?.substring(0, 8)
        })
      })
    }
    
    // Debug: Check what CryptoApis are registered after init
    if (this.connectionsModel?.leuteConnectionsModule?.connectionRouteManager?.catchAllRoutes) {
      const catchAllRoutes = this.connectionsModel.leuteConnectionsModule.connectionRouteManager.catchAllRoutes
      const registeredKeys = [...catchAllRoutes.keys()]
      console.log('[NodeOneCore] Socket listener registered CryptoApi keys:', registeredKeys)
      console.log('[NodeOneCore] Number of registered keys:', registeredKeys.length)
      
      // Get our instance keys for comparison
      const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
      const { getLocalInstanceOfPerson } = await import('@refinio/one.models/lib/misc/instance.js')
      const { getDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js')
      const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js')
      
      const myPersonId = getInstanceOwnerIdHash()
      const instanceId = await getLocalInstanceOfPerson(myPersonId)
      const defaultInstanceKeys = await getDefaultKeys(instanceId)
      const instanceKeys = await getObject(defaultInstanceKeys)
      
      console.log('[NodeOneCore] Our instance publicKey:', instanceKeys.publicKey)
      console.log('[NodeOneCore] Is our key registered?:', registeredKeys.includes(instanceKeys.publicKey))
    }
    
    // ConnectionsModel handles all connections - both local and external
    // It will manage WebSocket connections internally
    console.log('[NodeOneCore] ✅ ConnectionsModel initialized and ready for connections')
    
    // ConnectionsModel should automatically handle socket listener startup
    // Add debug listeners for incoming connections
    if (this.connectionsModel.leuteConnectionsModule) {
      const originalAcceptConnection = this.connectionsModel.leuteConnectionsModule.acceptConnection.bind(this.connectionsModel.leuteConnectionsModule)
      this.connectionsModel.leuteConnectionsModule.acceptConnection = async (...args) => {
        console.log('[NodeOneCore] 🔌 DEBUG: Incoming connection being accepted')
        console.log('[NodeOneCore] 🔌 DEBUG: Connection args:', args.length)
        if (args[0]) {
          console.log('[NodeOneCore] 🔌 DEBUG: Connection id:', args[0].id)
          console.log('[NodeOneCore] 🔌 DEBUG: Connection plugins:', args[0].plugins?.map(p => p.name))
          console.log('[NodeOneCore] 🔌 DEBUG: Connection has PromisePlugin:', args[0].hasPlugin?.('promise'))
        }
        try {
          const result = await originalAcceptConnection(...args)
          console.log('[NodeOneCore] 🔌 DEBUG: Connection acceptance result:', !!result)
          return result
        } catch (error) {
          console.error('[NodeOneCore] ❌ DEBUG: Connection acceptance failed:', error.message)
          throw error
        }
      }
    }
    
    // Listen for successful pairing to add new contacts and grant access
    this.connectionsModel.pairing.onPairingSuccess(async (isInitiator, localPersonId, localInstanceId, remotePersonId, remoteInstanceId, token) => {
      console.log(`[NodeOneCore] 🎉 Pairing successful! Remote person: ${remotePersonId?.substring(0, 8)}`)
      
      // Grant access to channels for CHUM sync
      console.log('[NodeOneCore] Granting channel access to browser person...')
      try {
        const { createAccess } = await import('@refinio/one.core/lib/access.js')
        const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')
        
        // Get all our channels
        const channels = await this.channelManager.channels()
        console.log(`[NodeOneCore] Granting access to ${channels.length} channels`)
        
        // Grant browser person access to each channel
        for (const channel of channels) {
          if (channel.channelInfoIdHash) {
            await createAccess([{
              id: channel.channelInfoIdHash,
              person: [remotePersonId], // Grant access to browser person
              group: [],
              mode: SET_ACCESS_MODE.ADD
            }])
            console.log(`[NodeOneCore] Granted access to channel: ${channel.id}`)
          }
        }
        
        console.log('[NodeOneCore] ✅ Access rights configured for CHUM sync')
      } catch (error) {
        console.error('[NodeOneCore] Failed to grant access:', error)
      }
      
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
          const { default: ProfileModel } = await import('@refinio/one.models/lib/models/Leute/ProfileModel.js')
          const { default: SomeoneModel } = await import('@refinio/one.models/lib/models/Leute/SomeoneModel.js')
          
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
            const { createAccess } = await import('@refinio/one.core/lib/access.js')
            const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')
            
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
      // Skip test invitation to avoid any waiting room conflicts
      console.log('[NodeOneCore] Skipping test invitation to keep waiting room clear for actual pairing')
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
    
    // Check if port 8765 is listening for internal federation
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
    
    // ConnectionsModel handles CommServer automatically with allowPairing: true
    // Pairing will transition to CHUM after successful handshake
    
    // Ensure CHUM protocol is registered and enabled
    console.log('[NodeOneCore] Ensuring CHUM protocol is available...')
    if (this.connectionsModel.leuteConnectionsModule) {
      // CHUM should be auto-registered by ConnectionsModel
      const protocols = this.connectionsModel.leuteConnectionsModule.getRegisteredProtocols?.()
      if (protocols) {
        console.log('[NodeOneCore] Available protocols:', protocols)
      }
    }
    console.log('[NodeOneCore] ConnectionsModel initialized with CommServer and direct socket')
    
    console.log('[NodeOneCore] ✅ ConnectionsModel initialized')
    
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
          const { createAccess } = await import('@refinio/one.core/lib/access.js')
          const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')
          
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

          // Ensure P2P channels exist for bidirectional messaging
          if (this.topicGroupManager) {
            try {
              await this.topicGroupManager.ensureP2PChannelsForPeer(conn.remotePersonId)
              console.log(`[NodeOneCore] ✅ P2P channels ensured for ${conn.remotePersonId.substring(0, 8)}`)
            } catch (error) {
              console.warn('[NodeOneCore] Failed to ensure P2P channels:', error.message)
            }
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
            const personId = await someone.person()
            console.log('[NodeOneCore] Contact detected:', personId)
            
            // Grant access to the contacts channel
            const { createAccess } = await import('@refinio/one.core/lib/access.js')
            const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')
            const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/util/object.js')
            
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
              group: [],
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
              // Grant access for sync between instances
              await createAccess([{
                id: p2pChannelInfoHash,
                person: [personId],
                group: [],
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
    
    // Create channels for existing conversations so Node receives CHUM updates
    await this.createChannelsForExistingConversations()
    
    // AI contacts will be set up later after LLMManager is initialized
    // This is called from setupAIContactsWhenReady()
    
    console.log('[NodeOneCore] All models initialized successfully')
  }

  /**
   * Create channels for existing conversations so Node participates in CHUM sync
   */
  async createChannelsForExistingConversations() {
    console.log('[NodeOneCore] Creating channels for existing conversations...')
    
    if (!this.channelManager) {
      console.warn('[NodeOneCore] ChannelManager not available')
      return
    }
    
    try {
      // Get existing conversations from state
      const { default: stateManager } = await import('../state/manager.js')
      const conversationsMap = stateManager.getState('conversations')
      
      if (conversationsMap && conversationsMap.size > 0) {
        console.log(`[NodeOneCore] Found ${conversationsMap.size} existing conversations`)
        
        for (const [id, conversation] of conversationsMap) {
          try {
            // Create a channel for each conversation
            // This ensures the Node instance receives CHUM updates for messages in these conversations
            await this.channelManager.createChannel(id, this.ownerId)
            console.log(`[NodeOneCore] Created channel for conversation: ${id}`)
          } catch (error) {
            // Channel might already exist, that's fine
            if (!error.message?.includes('already exists')) {
              console.warn(`[NodeOneCore] Could not create channel for ${id}:`, error.message)
            }
          }
        }
      } else {
        console.log('[NodeOneCore] No existing conversations found')
      }
    } catch (error) {
      console.error('[NodeOneCore] Error creating channels for existing conversations:', error)
    }
  }

  /**
   * Set up message sync - listen for user messages, process with AI, respond
   */
  async setupMessageSync() {
    console.log('[NodeOneCore] Setting up event-based message sync for AI processing...')
    
    if (!this.channelManager) {
      console.warn('[NodeOneCore] ChannelManager not available for message sync')
      return
    }
    
    // Import and create the AI message listener FIRST
    const AIMessageListener = await import('./ai-message-listener.js')
    const { default: llmManager } = await import('../services/llm-manager.js')
    
    // Create the AI message listener before AIAssistantModel
    this.aiMessageListener = new AIMessageListener.default(
      this.channelManager, 
      llmManager  // Use the actual LLM manager from main process
    )
    
    // Initialize Topic Group Manager for proper group topics
    if (!this.topicGroupManager) {
      this.topicGroupManager = new TopicGroupManager(this)
      console.log('[NodeOneCore] ✅ Topic Group Manager initialized')
    }
    
    // Initialize AI Assistant Model to orchestrate everything
    if (!this.aiAssistantModel) {
      this.aiAssistantModel = new AIAssistantModel(this)
      // Pre-warm LLM connections early
      await this.aiAssistantModel.init()
      console.log('[NodeOneCore] ✅ AI Assistant Model initialized with pre-warmed connections')

      // Connect AIAssistantModel to the message listener
      this.aiMessageListener.setAIAssistantModel(this.aiAssistantModel)
      console.log('[NodeOneCore] ✅ Connected AIAssistantModel to message listener')
    }

    // Initialize Refinio API Server as part of this ONE.core instance
    if (!this.apiServer) {
      this.apiServer = new RefinioApiServer(this.aiAssistantModel)
      // The API server will use THIS instance, not create a new one
      await this.apiServer.start()
    }
    
    // Start the listener
    this.aiMessageListener.start()
    
    console.log('[NodeOneCore] ✅ Event-based message sync set up for AI processing')
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
      
      // Use the AI Assistant Model to create contacts
      const aiContacts = await this.aiAssistantModel.setupAIContacts(models)
      
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
    // Delegate to the AI Assistant Model
    return this.aiAssistantModel.createAIContact(modelId, displayName)
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
      const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
      const { createPersonIfNotExist } = await import('@refinio/one.models/lib/misc/person.js')
      
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
   * Setup channel access for browser-node federation
   * Called when browser Person ID becomes available
   */
  async setupBrowserAccess(browserPersonId) {
    try {
      if (!this.channelManager || !browserPersonId) {
        console.warn('[NodeOneCore] Cannot setup browser access - missing requirements')
        return false
      }
      
      console.log('\n' + '='.repeat(60))
      console.log('🔐 NODE: Setting up Browser Access')
      console.log('='.repeat(60))
      console.log(`[TRACE] 🔐 NODE: Browser Person ID received: ${browserPersonId.substring(0, 8)}`)
      console.log(`[NodeOneCore] Setting up direct channel access for browser: ${browserPersonId.substring(0, 8)}`)
      
      // Grant direct person-to-person access to channels
      const { setupBrowserNodeChannelAccess } = await import('./channel-access-manager.js')
      await setupBrowserNodeChannelAccess(this.ownerId, browserPersonId, this.channelManager)
      
      // Store browser person ID for future use
      this.browserPersonId = browserPersonId
      
      console.log('[TRACE] ✅ NODE: Browser access setup complete')
      console.log('[NodeOneCore] ✅ Browser access setup complete')
      console.log('='.repeat(60) + '\n')
      return true
    } catch (error) {
      console.error('[NodeOneCore] Failed to setup browser access:', error)
      return false
    }
  }
  
  /**
   * Get current instance info
   */
  getInfo() {
    return {
      initialized: this.initialized,
      name: this.instanceName,
      ownerId: this.ownerId,
      browserPersonId: this.browserPersonId
    }
  }
  
  /**
   * Get the ONE.core instance object
   * @returns {Object} The instance object or null if not initialized
   */
  getInstance() {
    if (!this.initialized || !this.instanceModule) {
      return null
    }
    // Return the instance module's exports which contains the instance
    return this.instanceModule
  }
  
  /**
   * Get instance credentials for browser pairing
   */
  async getCredentialsForBrowser() {
    if (!this.initialized) {
      throw new Error('Node.js instance not initialized')
    }
    
    const { SettingsStore } = await import('@refinio/one.core/lib/system/settings-store.js')
    
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
    
    const { startChumProtocol } = await import('@refinio/one.models/lib/misc/ConnectionEstablishment/protocols/Chum.js')
    const { OEvent } = await import('@refinio/one.models/lib/misc/OEvent.js')
    
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
      // Stop the AI message listener
      if (this.aiMessageListener) {
        this.aiMessageListener.stop()
        this.aiMessageListener = null
      }
      
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
      const { closeInstance } = await import('@refinio/one.core/lib/instance.js')
      closeInstance()
      
      // Reset all models
      this.leuteModel = null
      this.connectionsModel = null
      this.channelManager = null
      this.topicModel = null
      this.oneAuth = null
        
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
      const { default: GroupModel } = await import('@refinio/one.models/lib/models/Leute/GroupModel.js')
      
      const { default: LeuteModel } = await import('@refinio/one.models/lib/models/Leute/LeuteModel.js')
      const everyoneGroup = await LeuteModel.everyoneGroup()
      
      // Create federation group for instance-to-instance communication
      try {
        this.federationGroup = await GroupModel.constructFromLatestProfileVersionByGroupName('federation')
        console.log('[NodeOneCore] Using existing federation group')
      } catch {
        this.federationGroup = await this.leuteModel.createGroup('federation')
        console.log('[NodeOneCore] Created new federation group')
      }
      
      // Create replicant group for inter-instance sync
      try {
        this.replicantGroup = await GroupModel.constructFromLatestProfileVersionByGroupName('replicant')
        console.log('[NodeOneCore] Using existing replicant group')
      } catch {
        this.replicantGroup = await this.leuteModel.createGroup('replicant')
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
        federation: this.federationGroup.groupIdHash,
        replicant: this.replicantGroup.groupIdHash
      })
      
      console.log('[NodeOneCore] ✅ Access rights manager initialized with proper groups')
      
    } catch (error) {
      console.error('[NodeOneCore] Failed to setup access rights:', error)
      // Continue without proper access rights - basic functionality may still work
    }
  }

  // REMOVED: startDirectListener() 
  // Direct WebSocket listener now handled by ConnectionsModel via socketConfig

  /**
   * Shutdown the instance properly
   */
  async shutdown() {
    console.log('[NodeOneCore] Shutting down...')
    
    // Stop direct WebSocket listener if running
    if (this.directSocketStopFn) {
      console.log('[NodeOneCore] Stopping direct WebSocket listener...')
      await this.directSocketStopFn()
      this.directSocketStopFn = null
    }
    
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

  // WebSocket listening is handled by IncomingConnectionManager.listenForDirectConnections()
  // which is called after ConnectionsModel.init()
}

// Singleton
const instance = new NodeOneCore()
export default instance
export { instance }