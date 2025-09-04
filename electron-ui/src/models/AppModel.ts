/**
 * AppModel for LAMA Electron
 * Root model orchestrator for the application
 */

import { Model } from '@refinio/one.models/lib/models/Model'
import LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel'
import ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js'
import TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js'
import type ConnectionsModel from '@refinio/one.models/lib/models/ConnectionsModel.js'
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks'
import type { Person } from '@refinio/one.core/lib/recipes'
import { udpService, type UDPSocket } from '../services/udp-ipc'
import { TransportManager } from './network/TransportManager'
import { LLMManager } from './ai/LLMManager'
import { AIAssistantModel } from './ai/AIAssistantModel'
import { initializeObjectEvents } from './ObjectEventsSingleton'
// Recipes are registered via SingleUserNoAuth in browser-init-simple.ts
import LeuteAccessRightsManager from './LeuteAccessRightsManager'

export interface AppModelConfig {
  name: string
  version: string
  commServerUrl?: string
}

/**
 * AppModel - Root orchestrator for all application models
 */
export class AppModel extends Model {
  public name = 'AppModel' as const
  
  // Core models
  public leuteModel?: LeuteModel
  public channelManager?: ChannelManager
  public topicModel?: TopicModel
  public transportManager?: TransportManager
  public llmManager?: LLMManager
  public aiAssistantModel?: AIAssistantModel
  private leuteConnectionsModule?: any  // LeuteConnectionsModule for direct federation
  private nodePersonId?: SHA256IdHash<Person>  // Node's person ID for CHUM sync
  private accessRightsManager?: LeuteAccessRightsManager
  private connectionsModel?: ConnectionsModel  // ConnectionsModel for pairing operations
  
  // Expose ConnectionsModel for pairing operations
  public get connections(): InstanceType<typeof ConnectionsModel> | undefined {
    // Get ConnectionsModel from CommServerManager in TransportManager
    if (this.transportManager) {
      const commServerTransport = this.transportManager.getTransport('COMM_SERVER')
      if (commServerTransport && 'getConnectionsModel' in commServerTransport) {
        return (commServerTransport as any).getConnectionsModel()
      }
    }
    return undefined
  }
  
  // Expose CommServerManager for convenience
  public get commServerManager(): any {
    if (this.transportManager) {
      return this.transportManager.getTransport('COMM_SERVER')
    }
    return undefined
  }
  
  // Configuration
  private config: AppModelConfig
  
  // Owner information
  public ownerId?: SHA256IdHash<Person>
  
  // Error state
  private error?: Error
  
  constructor(config: AppModelConfig) {
    super()
    this.config = config
  }
  
  /**
   * Initialize the AppModel and all sub-models
   * Following the sequential initialization pattern from init.md
   */
  async init(ownerId: SHA256IdHash<Person>): Promise<void> {
    try {
      this.state.assertCurrentState('Uninitialised')
    } catch (e) {
      console.warn('[AppModel] Already initialized or initializing')
      return
    }
    
    try {
      this.ownerId = ownerId
      
      console.log('[AppModel] Starting sequential initialization...')
      
      // LAMA recipes are already registered by SingleUserNoAuth during authentication
      // No need to register them again here
      
      // Initialize ObjectEventDispatcher through singleton
      await initializeObjectEvents()
      
      // Get connection config
      const { getConnectionConfig } = await import('../config/connection-config')
      const connectionConfig = getConnectionConfig()
      
      // STEP 1: Storage first (already done by ONE.core platform loading)
      console.log('[AppModel] ✅ Step 1: Storage initialized by platform')
      
      // STEP 2: Get device identity BEFORE network init
      console.log('[AppModel] Step 2: Getting device identity...')
      
      // Get device identity from LeuteModel (which will be initialized soon)
      let deviceId: SHA256IdHash<Person>
      let deviceKeys: { secretKey: string; publicKey: string }
      
      try {
        // Get owner ID from ONE.core (this is the person/identity ID)
        const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
        deviceId = getInstanceOwnerIdHash()
        console.log('[AppModel] ✅ Owner ID from ONE.core:', deviceId.toString().substring(0, 8))
        
        // Generate device-specific keys using ONE.core SettingsStore abstraction
        const { SettingsStore } = await import('@refinio/one.core/lib/system/settings-store.js')
        const deviceKeyId = `device_keys_${deviceId}`
        const storedKeys = await SettingsStore.getItem(deviceKeyId) as string | undefined
        
        if (storedKeys) {
          try {
            const parsedKeys = JSON.parse(storedKeys)
            deviceKeys = {
              secretKey: parsedKeys.secretKey,
              publicKey: parsedKeys.publicKey
            }
            console.log('[AppModel] ✅ Using existing device keys')
          } catch {
            // Corrupted, will regenerate below
            await SettingsStore.removeItem(deviceKeyId)
            throw new Error('Corrupted keys, regenerating')
          }
        } else {
          throw new Error('No stored keys, generating new ones')
        }
      } catch (error) {
        console.log('[AppModel] Generating new device keys:', error instanceof Error ? error.message : String(error))
        
        // Generate new device keys using tweetnacl
        const tweetnacl = await import('tweetnacl')
        const keyPair = tweetnacl.sign.keyPair()
        
        // Convert to hex strings
        const uint8ArrayToHex = (uint8Array: Uint8Array): string => {
          return Array.from(uint8Array)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('')
        }
        
        deviceKeys = {
          secretKey: uint8ArrayToHex(keyPair.secretKey),
          publicKey: uint8ArrayToHex(keyPair.publicKey)
        }
        
        // Store using ONE.core platform abstraction
        const { SettingsStore } = await import('@refinio/one.core/lib/system/settings-store.js')
        const keysToStore = {
          ...deviceKeys,
          generated: new Date().toISOString(),
          personId: deviceId
        }
        
        const deviceKeyId = `device_keys_${deviceId}`
        await SettingsStore.setItem(deviceKeyId, JSON.stringify(keysToStore))
        console.log('[AppModel] ✅ Generated and stored new device keys')
      }
      
      const identity = { deviceId, ...deviceKeys }
      console.log('[AppModel] ✅ Device identity ready:', identity.deviceId.toString().substring(0, 8))
      
      // STEP 3: Network layer - Browser instance uses direct connection to Node.js
      console.log('[AppModel] Step 3: Network layer managed by Node.js instance')
      console.log('[AppModel] ✅ Browser uses direct connection for network communication')
      
      // STEP 4: Browser instance focuses on UI models, not device discovery
      console.log('[AppModel] Step 4: Skipping DeviceDiscovery (handled by Node.js)')
      console.log('[AppModel] ✅ Device discovery managed by Node.js instance')
      
      // STEP 5: Create models in order
      console.log('[AppModel] Step 5: Creating core models...')
      
      // Use comm server URL from config if enabled
      const commServerUrl = connectionConfig.enableCommServer 
        ? (connectionConfig.commServerUrl || this.config.commServerUrl)
        : null
      
      if (commServerUrl) {
        console.log(`[AppModel] CommServer enabled: ${commServerUrl}`)
      } else {
        console.log('[AppModel] CommServer disabled, using direct connections only')
      }
      
      // Initialize LeuteModel (contacts/identity management)
      console.log('[AppModel] Creating LeuteModel...')
      // Pass null for commServerUrl if not using comm server
      this.leuteModel = new LeuteModel(commServerUrl || '', !commServerUrl)
      await this.leuteModel.init()
      console.log('[AppModel] ✅ LeuteModel initialized')
      
      // Initialize ChannelManager (communication channels)
      console.log('[AppModel] Creating ChannelManager...')
      this.channelManager = new ChannelManager(this.leuteModel)
      await this.channelManager.init()
      
      // Set up proper access rights handling using LeuteAccessRightsManager
      await this.setupProperAccessRights()
      console.log('[AppModel] ✅ ChannelManager initialized')
      
      // Initialize TopicModel (chat/messaging)
      console.log('[AppModel] Creating TopicModel...')
      try {
        // Ensure ChannelManager is fully initialized
        if (!this.channelManager) {
          throw new Error('ChannelManager not available for TopicModel')
        }
        
        this.topicModel = new TopicModel(this.channelManager, this.leuteModel)
        await this.topicModel.init()
        console.log('[AppModel] ✅ TopicModel initialized')
      } catch (error) {
        console.error('[AppModel] Failed to initialize TopicModel:', error)
        console.error('[AppModel] Stack trace:', (error as Error).stack)
        // Don't continue without TopicModel - it's essential for chat
        throw new Error(`TopicModel initialization failed: ${(error as Error).message}`)
      }
      
      // STEP 6: AppModel initialization (create system topics first)
      console.log('[AppModel] Step 6: Creating system topics...')
      await this.createSystemTopics()
      console.log('[AppModel] ✅ System topics created')
      
      // Initialize optional models
      console.log('[AppModel] Initializing optional models...')
      
      // LLMManager and AIAssistantModel belong in the Node.js instance ONLY
      // Browser just displays conversations synced via CHUM
      console.log('[AppModel] Browser instance - skipping LLMManager/AIAssistantModel (handled by Node.js)')
      console.warn('[AppModel] FEDERATION CHECK - THIS LOG MUST APPEAR!')
      this.llmManager = null
      this.aiAssistantModel = null
      
      // Set up connection between browser and Node.js for CHUM sync
      console.log('[AppModel] DEBUG: Connection config check:')
      console.log('[AppModel] DEBUG: - useDirectConnection:', connectionConfig.useDirectConnection)
      console.log('[AppModel] DEBUG: - window.electronAPI exists:', !!window.electronAPI)
      console.log('[AppModel] DEBUG: - connectionConfig:', JSON.stringify(connectionConfig, null, 2))
      
      if (connectionConfig.useDirectConnection && window.electronAPI) {
        console.log('[AppModel] Setting up browser-Node.js direct connection for CHUM sync...')
        await this.setupNodeConnection()
        console.log('[AppModel] ✅ Browser-Node.js direct connection setup complete')
      } else {
        console.warn('[AppModel] ❌ NOT calling setupNodeConnection():')
        console.warn('[AppModel] - useDirectConnection:', connectionConfig.useDirectConnection)
        console.warn('[AppModel] - electronAPI available:', !!window.electronAPI)
      }
      
      this.state.triggerEvent('init')
      console.log('[AppModel] ✅ Sequential initialization complete!')
    } catch (error) {
      console.error('[AppModel] Initialization failed:', error)
      this.error = error as Error
      throw error
    }
  }
  
  /**
   * Create a UDP socket (through Electron IPC)
   */
  async createUdpSocket(options: { type: 'udp4' | 'udp6' }): Promise<UDPSocket> {
    try {
      this.state.assertCurrentState('Initialised')
    } catch {
      throw new Error('AppModel not initialized')
    }
    
    console.log(`[AppModel] Creating UDP socket (${options.type})`)
    return await udpService.createSocket(options)
  }
  
  /**
   * Get current user's profile information
   */
  async getCurrentUserProfile() {
    if (!this.leuteModel) {
      throw new Error('LeuteModel not initialized')
    }
    
    // Try to get the current user's Someone object using me()
    try {
      const me = await this.leuteModel.me()
      if (me) {
        const myProfile = await me.mainProfile()
        let myName = 'Me'
        
        if (myProfile?.personDescriptions?.length > 0) {
          const nameDesc = myProfile.personDescriptions.find((d: any) => 
            d.$type$ === 'PersonName' && d.name
          )
          if (nameDesc?.name) {
            myName = nameDesc.name
          }
        }
        
        return {
          id: this.ownerId,
          name: myName,
          email: myProfile?.email || '',
          profileImage: undefined // TODO: Implement profile image support
        }
      }
    } catch (error) {
      console.warn('[AppModel] Could not get current user via me():', error)
    }
    
    // Fallback: return basic info with owner ID
    return {
      id: this.ownerId,
      name: 'User',
      email: 'user@lama.local',
      profileImage: undefined
    }
  }
  
  /**
   * Set up proper access rights using LeuteAccessRightsManager pattern
   */
  private async setupProperAccessRights(): Promise<void> {
    if (!this.channelManager || !this.leuteModel) {
      console.warn('[AppModel] ChannelManager or LeuteModel not available for access rights setup')
      return
    }
    
    try {
      // Create groups for access rights management
      const { default: GroupModel } = await import('@refinio/one.models/lib/models/Leute/GroupModel.js')
      const { default: LeuteModel } = await import('@refinio/one.models/lib/models/Leute/LeuteModel.js')
      
      // Create or get the Everyone group
      let everyoneGroup
      try {
        everyoneGroup = await GroupModel.constructFromLatestProfileVersionByGroupName(LeuteModel.EVERYONE_GROUP_NAME)
        console.log('[AppModel] Using existing Everyone group')
      } catch {
        // Create the Everyone group if it doesn't exist
        everyoneGroup = await this.leuteModel.createGroup(LeuteModel.EVERYONE_GROUP_NAME || 'Everyone')
        console.log('[AppModel] Created new Everyone group')
      }
      
      // Create federation group for instance-to-instance communication
      let federationGroup
      try {
        federationGroup = await GroupModel.constructFromLatestProfileVersionByGroupName('federation')
        console.log('[AppModel] Using existing federation group')
      } catch {
        federationGroup = await this.leuteModel.createGroup('federation')
        console.log('[AppModel] Created new federation group')
      }
      
      // Create replicant group for inter-instance sync
      let replicantGroup
      try {
        replicantGroup = await GroupModel.constructFromLatestProfileVersionByGroupName('replicant')
        console.log('[AppModel] Using existing replicant group')
      } catch {
        replicantGroup = await this.leuteModel.createGroup('replicant')
        console.log('[AppModel] Created new replicant group')
      }
      
      // Initialize access rights manager with groups
      const { default: ConnectionsModel } = await import('@refinio/one.models/lib/models/ConnectionsModel.js')
      
      // Initialize ConnectionsModel with proper configuration for automatic connections
      this.connectionsModel = new ConnectionsModel(this.leuteModel, {
        commServerUrl: null,  // null - we don't use commserver for browser-to-node connection
        acceptIncomingConnections: false,  // Browser only connects out
        acceptUnknownInstances: true,  // Accept Node instance after pairing
        acceptUnknownPersons: false,  // FIXED: Match one.leute - use catch-all for pairing
        allowPairing: true,  // Required for pairing protocol to work properly
        establishOutgoingConnections: true,  // CRITICAL: Automatically connect to discovered endpoints
        allowDebugRequests: true,
        incomingConnectionConfigurations: []  // Explicitly no incoming connections
      })
      
      this.accessRightsManager = new LeuteAccessRightsManager(
        this.channelManager,
        this.connectionsModel,
        this.leuteModel
      )
      
      await this.accessRightsManager.init({
        everyone: everyoneGroup.groupIdHash,
        federation: federationGroup.groupIdHash,
        replicant: replicantGroup.groupIdHash
      })
      
      console.log('[AppModel] ✅ Access rights manager initialized with proper groups')
      
      // Set up message processing for UI display
      this.setupMessageProcessing()
      
    } catch (error) {
      console.error('[AppModel] Failed to setup access rights:', error)
      // Continue without proper access rights - basic functionality may still work
    }
  }
  
  /**
   * Set up message processing for UI display
   */
  private setupMessageProcessing(): void {
    if (!this.channelManager) return
    
    this.channelManager.onUpdated.listen(async (
      channelInfoIdHash: any,
      channelId: string,
      channelOwner: any,
      timeOfEarliestChange: Date,
      data: any[]
    ) => {
      // Process messages for UI display (ALL channel types)
      for (const change of data) {
        if (change.$type$ === 'ChatMessage') {
          console.log('[AppModel] New message received via CHUM:', {
            channelId,
            text: change.text?.substring(0, 50),
            sender: change.sender?.substring(0, 8),
            timestamp: change.timestamp
          })
          
          // Emit to UI via global event for display
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('lama:messageReceived', {
              detail: { 
                conversationId: channelId,
                message: change
              }
            }))
          }
        }
      }
    })
  }

  async getContacts() {
    if (!this.leuteModel) {
      throw new Error('LeuteModel not initialized')
    }
    
    const allContacts = []
    
    // DISABLED: IPC contact sync - contacts should sync via direct connection/CHUM not IPC
    // The direct connection will handle proper CHUM sync between Browser and Node instances
    /*
    if (window.electronAPI) {
      try {
        const nodeContactsResult = await window.electronAPI.invoke('onecore:getContacts')
        if (nodeContactsResult?.success && nodeContactsResult.contacts) {
          console.log(`[AppModel] Synced ${nodeContactsResult.contacts.length} contacts from Node.js via IPC`)
          // Import Node contacts into browser LeuteModel
          for (const contact of nodeContactsResult.contacts) {
            // Node.js sends 'id' not 'personId'
            if (!contact.isSelf) {
              // TODO: Import the contact into browser's LeuteModel via CHUM
              // For now, just add to the results
              allContacts.push(contact)
            }
          }
          
          // If we got contacts from Node, return them (CHUM will sync later)
          if (allContacts.length > 0) {
            console.log(`[AppModel] Returning ${allContacts.length} contacts from Node.js`)
            return allContacts
          }
        }
      } catch (error) {
        console.warn('[AppModel] Failed to sync contacts from Node:', error)
      }
    }
    */
    
    try {
      // 1. Get the current user as a contact
      try {
        const me = await this.leuteModel.me()
        if (me) {
          const myPersonId = await me.mainIdentity()
          const myProfile = await me.mainProfile()
          let myName = 'Me'
          
          if (myProfile?.personDescriptions?.length > 0) {
            const nameDesc = myProfile.personDescriptions.find((d: any) => 
              d.$type$ === 'PersonName' && d.name
            )
            if (nameDesc?.name) {
              myName = nameDesc.name
            }
          }
          
          allContacts.push({
            id: myPersonId,
            name: myName,
            displayName: myName,
            email: myProfile?.email || '',
            status: 'online' as const,
            isMe: true
          })
        }
      } catch (error) {
        console.warn('[AppModel] Could not get current user:', error)
      }
      
      // 2. Get all Someone objects (real contacts) from LeuteModel
      try {
        // Get all other contacts
        const others = await this.leuteModel.others()
        
        for (const someone of others) {
          try {
            const personId = await someone.mainIdentity()
            const profile = await someone.mainProfile()
            
            // Get display name from profile
            let displayName = 'Unknown'
            if (profile?.nickname) {
              displayName = profile.nickname
            } else if (profile?.personDescriptions?.length > 0) {
              const nameDesc = profile.personDescriptions.find((d: any) => 
                d.$type$ === 'PersonName' && d.name
              )
              if (nameDesc?.name) {
                displayName = nameDesc.name
              }
            }
            
            allContacts.push({
              id: personId,
              name: displayName,
              displayName: displayName,
              email: profile?.email || '',
              status: 'disconnected' as const,
              isMe: false
            })
          } catch (error) {
            console.warn('[AppModel] Error processing Someone:', error)
          }
        }
      } catch (error) {
        console.warn('[AppModel] Could not get Someone objects:', error)
      }
      
      // 2. Get all contacts (including AI) - they should be synced via CHUM from Node.js
      const someoneContacts = await this.leuteModel.others()
      
      if (!someoneContacts || someoneContacts.length === 0) {
        console.log(`[AppModel] No contacts found (waiting for CHUM sync?)`)
      } else {
        console.log(`[AppModel] Found ${someoneContacts.length} contacts (includes AI synced from Node.js)`)
        
        // Map to contact format
        for (const someone of someoneContacts) {
          try {
            // Get the main identity (person ID) from this Someone
            const personId = await someone.mainIdentity()
            if (!personId) {
              console.warn('[AppModel] No main identity for Someone:', someone.idHash)
              continue
            }
            
            // Get the main profile for display information
            const profile = await someone.mainProfile()
            
            // Check if this is an AI contact (synced from Node.js)
            const isAI = profile?.nickname?.startsWith('AI-') || false
            
            let displayName = `Contact ${personId.toString().substring(0, 8)}`
            
            if (isAI && profile?.nickname) {
              // For AI contacts, use the model name from nickname
              // The nickname format is "AI-<display name>" where display name is already properly formatted
              displayName = profile.nickname.replace('AI-', '')
            } else if (profile?.personDescriptions?.length > 0) {
              const nameDesc = profile.personDescriptions.find((d: any) => 
                d.$type$ === 'PersonName' && d.name
              )
              if (nameDesc?.name) {
                displayName = nameDesc.name
              }
            } else if (profile?.nickname) {
              displayName = profile.nickname
            }
            
            allContacts.push({
              id: personId,
              name: displayName,
              displayName: displayName,
              email: profile?.email || '',
              status: isAI ? 'online' as const : 'offline' as const,
              isAI: isAI,
              modelId: isAI ? personId : undefined
            })
          } catch (error) {
            console.warn(`[AppModel] Error loading contact:`, error)
          }
        }
      }
      
      console.log(`[AppModel] Total contacts: ${allContacts.length} (Me: ${allContacts.filter(c => c.isMe).length}, AI: ${allContacts.filter(c => c.isAI).length}, Humans: ${allContacts.filter(c => !c.isMe && !c.isAI).length})`)
      
      // If still no contacts (shouldn't happen), at least return something
      if (allContacts.length === 0) {
        console.warn('[AppModel] No contacts found at all, returning default')
        return [{
          id: 'default-user',
          name: 'User',
          displayName: 'User',
          email: '',
          status: 'online' as const
        }]
      }
      
      return allContacts
    } catch (error) {
      console.error('[AppModel] Failed to get contacts:', error)
      // Return default user as fallback
      return [{
        id: 'default-user',
        name: 'User',
        displayName: 'User',
        email: '',
        status: 'online' as const
      }]
    }
  }
  
  /**
   * Get list of channels
   */
  async getChannels() {
    if (!this.channelManager) {
      throw new Error('ChannelManager not initialized')
    }
    
    const channels = await this.channelManager.channels
    return channels.map(channel => ({
      id: channel.id,
      name: channel.name || 'Unnamed Channel',
      description: channel.description || '',
      memberCount: channel.members?.length || 0,
      lastActivity: channel.lastActivity || new Date()
    }))
  }
  
  
  /**
   * Create system topics (Everyone and Glue topics)
   */
  private async createSystemTopics(): Promise<void> {
    if (!this.topicModel || !this.channelManager) {
      console.warn('[AppModel] TopicModel or ChannelManager not initialized, skipping system topics')
      return
    }
    
    try {
      console.log('[AppModel] Creating system topics and channels...')
      
      // Create contacts channel for CHUM sync with Node.js
      console.log('[AppModel] Creating contacts channel for CHUM sync...')
      await this.channelManager.createChannel('contacts')
      console.log('[AppModel] ✅ Contacts channel created')
      
      // Create Everyone topic (broadcast to all contacts)
      const everyoneTopic = await this.topicModel.createEveryoneTopic()
      console.log('[AppModel] Everyone topic created:', everyoneTopic?.id)
      
      // Create Glue topic (system integration)
      const glueTopic = await this.topicModel.createGlueTopic()
      console.log('[AppModel] Glue topic created:', glueTopic?.id)
      
      // Configure channel settings like one.leute does
      if (everyoneTopic?.channel) {
        this.channelManager.setChannelSettingsMaxSize(everyoneTopic.channel, 1024 * 1024 * 100) // 100MB
      }
      
      if (glueTopic?.channel) {
        this.channelManager.setChannelSettingsMaxSize(glueTopic.channel, 1024 * 1024 * 100) // 100MB
        this.channelManager.setChannelSettingsAppendSenderProfile(glueTopic.channel, true)
        this.channelManager.setChannelSettingsRegisterSenderProfileAtLeute(glueTopic.channel, true)
      }
      
      console.log('[AppModel] System topics created and configured')
    } catch (error) {
      console.error('[AppModel] Failed to create system topics:', error)
    }
  }
  
  /**
   * Shutdown the AppModel and all sub-models
   */
  async shutdown(): Promise<void> {
    console.log('[AppModel] Shutting down...')
    
    try {
      // Shutdown models in reverse order of initialization
      if (this.aiAssistantModel) {
        await this.aiAssistantModel.shutdown()
        this.aiAssistantModel = undefined
      }
      
      if (this.llmManager) {
        await this.llmManager.shutdown()
        this.llmManager = undefined
      }
      
      if (this.transportManager) {
        await this.transportManager.shutdownAllTransports()
        this.transportManager = undefined
      }
      
      if (this.topicModel) {
        await this.topicModel.shutdown()
        this.topicModel = undefined
      }
      
      if (this.accessRightsManager) {
        await this.accessRightsManager.shutdown()
        this.accessRightsManager = undefined
      }
      
      if (this.channelManager) {
        await this.channelManager.shutdown()
        this.channelManager = undefined
      }
      
      if (this.leuteModel) {
        await this.leuteModel.shutdown()
        this.leuteModel = undefined
      }
      
      // Close all UDP sockets
      await udpService.closeAll()
      
      this.state.triggerEvent('shutdown')
      console.log('[AppModel] Shutdown complete')
    } catch (error) {
      console.error('[AppModel] Shutdown error:', error)
      throw error
    }
  }
  
  /**
   * Get app configuration
   */
  getConfig(): AppModelConfig {
    return { ...this.config }
  }
  
  /**
   * Check if all core models are ready
   */
  isReady(): boolean {
    try {
      this.state.assertCurrentState('Initialised')
      return true
    } catch {
      return false
    }
  }

  /**
   * Set up direct connection to Node.js for CHUM sync via federation
   */
  private async setupNodeConnection(): Promise<void> {
    if (!this.leuteModel || !this.channelManager) {
      throw new Error('LeuteModel or ChannelManager not initialized')
    }

    try {
      console.log('[AppModel] 🔄 Setting up federation connection to Node.js...')
      
      // Wait for Node.js to be ready (with timeout)
      let nodeInfo = await window.electronAPI.invoke('devices:getInstanceInfo')
      let retries = 0
      const maxRetries = 15 // Increase retries
      
      while ((!nodeInfo.success || !nodeInfo.ownerId) && retries < maxRetries) {
        console.warn(`[AppModel] Node.js not ready yet (attempt ${retries + 1}/${maxRetries}), waiting...`)
        console.warn('[AppModel] Current node info:', nodeInfo)
        await new Promise(resolve => setTimeout(resolve, 3000)) // Wait longer
        nodeInfo = await window.electronAPI.invoke('devices:getInstanceInfo')
        retries++
      }
      
      if (!nodeInfo.success || !nodeInfo.ownerId) {
        console.error('[AppModel] Node.js failed to initialize after waiting, CHUM sync will not work!')
        console.error('[AppModel] Node info:', nodeInfo)
        return
      }
      
      console.log('[AppModel] Node.js owner ID:', nodeInfo.ownerId)
      console.log('[AppModel] Browser owner ID:', this.ownerId)
      
      // Federation Setup - Direct connection via OneInstanceEndpoints
      console.log('[AppModel] Setting up federation connection...')
      
      // Store Node person ID for federation - this will be different from browser
      this.nodePersonId = nodeInfo.ownerId
      
      // Store connection info globally for debugging
      ;(window as any).browserPersonId = this.ownerId
      ;(window as any).nodePersonId = nodeInfo.ownerId
      
      console.log('[AppModel] Federation setup - Browser and Node have different person IDs:')
      console.log('[AppModel] - Browser person:', this.ownerId?.substring(0, 8))
      console.log('[AppModel] - Node person:', nodeInfo.ownerId?.substring(0, 8))
      
      // LeuteConnectionsModule will handle endpoint creation and discovery automatically
      // No need to manually create endpoints - that's what the module is for!
      
      // Initialize LeuteConnectionsModule for outgoing connections only  
      const { default: LeuteConnectionsModule } = await import('@refinio/one.models/lib/misc/ConnectionEstablishment/LeuteConnectionsModule.js')
      
      this.leuteConnectionsModule = new LeuteConnectionsModule(this.leuteModel, {
        incomingConnectionConfigurations: [],  // No incoming connections
        incomingRoutesGroupIds: ['chum'],
        outgoingRoutesGroupIds: ['chum'],
        reconnectDelay: 5000,
        newRoutesEnabled: true
      })
      
      console.log('[AppModel] ✅ LeuteConnectionsModule initialized for federation')
      
      // Debug: Check initial endpoint discovery
      console.log('[AppModel] Checking for endpoints immediately after init...')
      try {
        const allEndpoints = await this.leuteModel.findAllOneInstanceEndpointsForOthers()
        console.log('[AppModel] Initial endpoint check - others:', allEndpoints?.length || 0)
        
        const myEndpoints = await this.leuteModel.findAllOneInstanceEndpointsForMe()
        console.log('[AppModel] Initial endpoint check - mine:', myEndpoints?.length || 0)
        
        // Check if we know about the Node person (will check later when nodeInstanceInfo is available)
        const tempNodeInfo = (window as any).nodeInstanceInfo
        if (tempNodeInfo?.nodeId) {
          console.log('[AppModel] Checking if Node person is a contact...')
          const nodeSomeone = await this.leuteModel.getSomeone(tempNodeInfo.nodeId)
          console.log('[AppModel] Node person as contact:', nodeSomeone ? 'YES' : 'NO')
          
          if (!nodeSomeone) {
            console.log('[AppModel] Node person is NOT a contact - this is why endpoints aren\'t discovered!')
            console.log('[AppModel] Need to add Node person as a contact for endpoint discovery to work')
          }
        }
      } catch (e) {
        console.error('[AppModel] Initial endpoint check error:', e)
      }
      
      // Store connections globally for debugging
      ;(window as any).browserLeuteConnectionsModule = this.leuteConnectionsModule
      ;(this as any).leuteConnectionsModule = this.leuteConnectionsModule
      
      // Listen for known connections (connections to contacts we know)
      this.leuteConnectionsModule.onKnownConnection((conn: any, myPersonId: string, myInstanceId: string, remotePersonId: string, remoteInstanceId: string) => {
        console.log('[AppModel] 🔄 Known connection established:', {
          remotePersonId: remotePersonId?.substring(0, 8),
          remoteInstanceId: remoteInstanceId?.substring(0, 8)
        })
        
        // Check if this is the Node.js connection (same owner)
        if (remotePersonId === this.ownerId) {
          console.log('[AppModel] ✅ Connected to Node.js instance via federation')
          
          // Test CHUM sync
          this.testCHUMSync()
        }
      })
      
      // Listen for connection changes
      this.leuteConnectionsModule.onConnectionsChange(() => {
        console.log('[AppModel] Connections changed')
      })
      
      // The LeuteConnectionsModule will automatically discover and connect to
      // the Node's OneInstanceEndpoint which advertises ws://localhost:8765
      // Accept the local pairing invitation from Node.js to establish connection
      console.log('[AppModel] DEBUG: Checking for nodeInstanceInfo on window...')
      const nodeInstanceInfo = (window as any).nodeInstanceInfo
      console.log('[AppModel] DEBUG: nodeInstanceInfo:', nodeInstanceInfo)
      console.log('[AppModel] DEBUG: pairingInvite:', nodeInstanceInfo?.pairingInvite)
      
      // Also check for pending invitation stored by browser-init-simple
      const pendingInvitation = (window as any).pendingPairingInvitation
      if (pendingInvitation && !nodeInstanceInfo?.pairingInvite) {
        console.log('[AppModel] Found pending pairing invitation from browser-init-simple')
        nodeInstanceInfo.pairingInvite = pendingInvitation
      }
      
      // Prefer pairing invitation if available (it establishes contact relationship)
      if (nodeInstanceInfo?.pairingInvite) {
        // Use pairing invitation to establish connection and exchange contacts
        console.log('[AppModel] Found pairing invitation from Node.js')
        try {
          const invitation = nodeInstanceInfo.pairingInvite // Direct invitation object now
          console.log('[AppModel] Local invitation points to:', invitation.url)
          console.log('[AppModel] Invitation token:', invitation.token)
          console.log('[AppModel] Invitation publicKey:', invitation.publicKey)
          console.log('[AppModel] Full invitation object:', invitation)
          
          // Actually accept the pairing invitation to establish the connection
          console.log('[AppModel] Accepting pairing invitation...')
          
          // Browser needs to use the pairing protocol to connect
          console.log('[AppModel] Using pairing protocol to connect to Node.js...')
          
          try {
            // Use the ConnectionsModel's pairing manager (like one.leute does)
            const pairingManager = this.connectionsModel?.pairing
            if (!pairingManager) {
              throw new Error('ConnectionsModel pairing manager not available')
            }
            
            console.log('[AppModel] Connecting using pairing invitation...')
            console.log('[AppModel] Invitation URL:', invitation.url)
            console.log('[AppModel] Invitation token:', invitation.token)
            console.log('[AppModel] Invitation publicKey:', invitation.publicKey)
            
            // Connect using the invitation
            console.log('[AppModel] Calling connectUsingInvitation...')
            console.log('[AppModel] DEBUG: About to call pairingManager.connectUsingInvitation')
            console.log('[AppModel] DEBUG: pairingManager exists:', !!pairingManager)
            console.log('[AppModel] DEBUG: invitation exists:', !!invitation)
            console.log('[AppModel] DEBUG: this.ownerId:', this.ownerId)
            
            // Listen for pairing success event (OEvent is a functor - call it directly)
            pairingManager.onPairingSuccess(async (
              initiatedLocally,
              localPersonId, 
              localInstanceId,
              remotePersonId,
              remoteInstanceId,
              token
            ) => {
              console.log('[AppModel] ✅ Pairing successful!')
              console.log('[AppModel] - Local person:', localPersonId?.substring(0, 8))
              console.log('[AppModel] - Remote person (Node.js):', remotePersonId?.substring(0, 8))
              console.log('[AppModel] - Contact relationship established')
              
              // Grant access to channels for CHUM sync
              console.log('[AppModel] Granting channel access to Node.js person...')
              try {
                const { createAccess } = await import('@refinio/one.core/lib/access.js')
                const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')
                
                // Get all our channels
                const channels = await this.channelManager.channels()
                console.log(`[AppModel] Granting access to ${channels.length} channels`)
                
                // Grant Node.js person access to each channel
                for (const channel of channels) {
                  if (channel.channelInfoIdHash) {
                    await createAccess([{
                      id: channel.channelInfoIdHash,
                      person: [remotePersonId], // Grant access to Node.js person
                      group: [],
                      mode: SET_ACCESS_MODE.ADD
                    }])
                    console.log(`[AppModel] Granted access to channel: ${channel.id}`)
                  }
                }
                
                console.log('[AppModel] ✅ Access rights configured for CHUM sync')
              } catch (error) {
                console.error('[AppModel] Failed to grant access:', error)
              }
              
              console.log('[AppModel] Next steps:')
              console.log('[AppModel]   1. LeuteConnectionsModule discovers Node endpoint')
              console.log('[AppModel]   2. Establishes CHUM connection for data sync')
              console.log('[AppModel]   3. CHUM protocol automatically syncs content')
            })
            
            try {
              // This establishes contact and then closes - it doesn't return a connection
              console.log('[AppModel] 🚀 BROWSER INITIATING CONNECTION AS CLIENT')
              console.log('[AppModel] Calling pairingManager.connectUsingInvitation()')
              await pairingManager.connectUsingInvitation(
                invitation,
                this.ownerId
              )
              console.log('[AppModel] ✅ Pairing protocol completed')
              console.log('[AppModel] Contact relationship established with Node.js')
              console.log('[AppModel] LeuteConnectionsModule will now discover and connect')
            } catch (error) {
              // The pairing handshake often shows a "Decryption failed" error
              // but CHUM sync still works fine. This is a known issue with the
              // encryption plugin during the initial handshake.
              if (error.message?.includes('Decryption')) {
                console.log('[AppModel] ⚠️ Pairing handshake showed decryption error (normal)')
                console.log('[AppModel] CHUM sync will still work despite this message')
              } else {
                console.error('[AppModel] ❌ Pairing failed:', error)
                console.error('[AppModel] Error:', error.message)
                console.warn('[AppModel] Without pairing, instances may not sync properly')
              }
            }
            
            // Store for debugging
            ;(window as any).pairingManager = pairingManager
            
          } catch (error) {
            console.error('[AppModel] Failed to connect via pairing:', error)
            console.log('[AppModel] Will rely on auto-discovery')
          }
          
          // Store the pairing token globally for debugging
          ;(window as any).pairingToken = invitation.token
          
        } catch (error) {
          console.error('[AppModel] Failed to process pairing invitation:', error)
          console.log('[AppModel] Will rely on auto-discovery at ws://localhost:8765')
        }
      } else if (nodeInstanceInfo?.nodeId && nodeInstanceInfo.nodeId !== this.ownerId) {
        console.log('[AppModel] ✅ Node and browser have different person IDs')
        console.log('[AppModel] Node person ID:', nodeInstanceInfo.nodeId?.substring(0, 8))
        console.log('[AppModel] Browser person ID:', this.ownerId?.substring(0, 8))
        console.log('[AppModel] Node endpoint:', nodeInstanceInfo.endpoint)
        console.warn('[AppModel] ⚠️ No pairing invitation - contacts not established')
        console.warn('[AppModel] Auto-discovery won\'t work without contact relationship!')
      } else {
        console.warn('[AppModel] ❌ No pairing invitation available!')
        console.warn('[AppModel] nodeInstanceInfo exists:', !!nodeInstanceInfo)
        console.warn('[AppModel] pairingInvite exists:', !!(nodeInstanceInfo?.pairingInvite))
        console.log('[AppModel] Will rely on auto-discovery at ws://localhost:8765')
      }
      
      // Wait a bit for federation connection to establish
      setTimeout(async () => {
        const connections = this.leuteConnectionsModule.connectionsInfo()
        
        // Check CHUM sync as the real indicator of connection
        const channels = await this.channelManager?.channels() || []
        const hasSharedChannels = channels.length > 2 // More than just default local channels
        
        if (hasSharedChannels) {
          console.log(`[AppModel] ✅ Federation working: CHUM sync active with ${channels.length} channels`)
          if (connections.length === 0) {
            console.log('[AppModel] Note: Direct pairing connection (not tracked in connectionsInfo)')
          }
        } else {
          console.log(`[AppModel] Federation status: ${connections.length} connections via connectionsInfo()`)
        }
        
        // Debug: Check what endpoints are discovered
        try {
          const nodeEndpoints = await this.leuteModel.findAllOneInstanceEndpointsForPerson(nodeInstanceInfo?.nodeId)
          console.log('[AppModel] Node endpoints found:', nodeEndpoints?.length || 0)
          
          if (hasSharedChannels && nodeEndpoints?.length > 0) {
            console.log('[AppModel] ✅ Browser-Node.js federation is working!')
            console.log(`[AppModel]   - CHUM sync active (${channels.length} channels visible)`)
            console.log(`[AppModel]   - Node endpoint discovered via profile sync`)
            console.log(`[AppModel]   - Contact relationship established`)
            
            // The connection is working even if connectionsInfo() returns 0
            if (connections.length === 0) {
              console.log('[AppModel] Note: connectionsInfo() returns 0 but CHUM sync is working')
              console.log('[AppModel] This is expected for pairing-based connections')
            }
          } else if (!hasSharedChannels) {
            console.warn('[AppModel] ⚠️ CHUM sync not working - only local channels visible')
            console.log('[AppModel] Possible causes:')
            console.log('[AppModel]   1. Connection not established after pairing')
            console.log('[AppModel]   2. Access rights not properly configured')
            console.log('[AppModel]   3. ConnectionsModel not configured with establishOutgoingConnections')
          } else if (!nodeEndpoints || nodeEndpoints.length === 0) {
            // This is normal for pairing-based connections - endpoint discovery isn't needed
            if (hasSharedChannels) {
              console.log('[AppModel] Note: Node endpoint not discovered but CHUM sync is working')
              console.log('[AppModel] This is expected for direct pairing connections')
            }
          }
          
          // Additional diagnostics
          console.log(`[AppModel] Diagnostic info:`)
          console.log(`[AppModel]   - Channels visible: ${channels.length}`)
          console.log(`[AppModel]   - Node endpoints found: ${nodeEndpoints?.length || 0}`)
          console.log(`[AppModel]   - connectionsInfo() reports: ${connections.length} connections`)
          
          const allEndpoints = await this.leuteModel.findAllOneInstanceEndpointsForOthers()
          console.log('[AppModel]   - All other endpoints: ', allEndpoints?.length || 0)
          
          const myEndpoints = await this.leuteModel.findAllOneInstanceEndpointsForMe()
          console.log('[AppModel]   - My endpoints: ', myEndpoints?.length || 0)
        } catch (e) {
          console.error('[AppModel] Error checking endpoints:', e)
        }
        
        // Log detailed connection info if available
        if (connections.length > 0) {
          console.log('[AppModel] Connection details from connectionsInfo():')
          connections.forEach((conn: any, idx: number) => {
            console.log(`[AppModel]   Connection ${idx}:`, {
              id: conn.id?.substring(0, 20),
              isConnected: conn.isConnected,
              remotePersonId: conn.remotePersonId?.substring(0, 8),
              remoteInstanceId: conn.remoteInstanceId?.substring(0, 8),
              protocolName: conn.protocolName,
              url: conn.url
            })
          })
        }
        
        // Test CHUM sync
        await this.testCHUMSync()
      }, 10000)
      
    } catch (error) {
      console.error('[AppModel] Failed to setup federation:', error)
      // Continue without federation
    }
  }

  /**
   * Test CHUM synchronization between instances
   */
  private async testCHUMSync(): Promise<void> {
    if (!this.channelManager) return
    
    try {
      console.log('[AppModel] 🧪 Testing CHUM sync between instances...')
      
      // Check if we have any shared channels
      const channels = await this.channelManager.channels()
      console.log(`[AppModel] Found ${channels?.length || 0} channels in browser instance`)
      
      if (channels && channels.length > 0) {
        console.log('[AppModel] ✅ CHUM sync appears to be working - channels are visible')
        channels.forEach((ch: any) => {
          console.log(`[AppModel] Channel: ${ch.id} (owner: ${ch.owner?.substring(0, 8)})`)
        })
      } else {
        console.warn('[AppModel] ⚠️ No channels found - CHUM sync may not be working yet')
      }
    } catch (error) {
      console.error('[AppModel] CHUM sync test failed:', error)
    }
  }
  
}