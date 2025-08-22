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
import { registerLamaRecipes } from '../recipes'

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
      
      console.log('[AppModel] Initializing models...')
      
      // Register LAMA recipes in the renderer process
      // Note: Recipes are ALSO registered in the main Node.js process (electron/main.ts)
      // Each ONE instance needs its own recipe registration
      await registerLamaRecipes()
      
      // Initialize ObjectEventDispatcher through singleton
      await initializeObjectEvents()
      
      // Get commServerUrl from config - use development server in dev mode
      const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
      const defaultUrl = isDevelopment ? 'wss://comm10.dev.refinio.one' : 'wss://comm.refinio.net'
      const commServerUrl = this.config.commServerUrl || defaultUrl
      console.log(`[AppModel] Using CommServer: ${commServerUrl} (isDevelopment: ${isDevelopment})`)
      
      // Initialize LeuteModel (contacts/identity management)
      console.log('[AppModel] Creating LeuteModel...')
      this.leuteModel = new LeuteModel(commServerUrl, true)
      await this.leuteModel.init()
      console.log('[AppModel] LeuteModel initialized')
      
      // Initialize ChannelManager (communication channels)
      console.log('[AppModel] Creating ChannelManager...')
      // Use direct instantiation like one.leute does
      this.channelManager = new ChannelManager(this.leuteModel)
      await this.channelManager.init()
      
      // Set up access rights handling for person-to-person chats
      this.setupAccessRightsHandling()
      console.log('[AppModel] ChannelManager initialized')
      
      // Initialize TopicModel (chat/messaging)
      console.log('[AppModel] Creating TopicModel...')
      try {
        // Ensure ChannelManager is fully initialized
        if (!this.channelManager) {
          throw new Error('ChannelManager not available for TopicModel')
        }
        
        this.topicModel = new TopicModel(this.channelManager, this.leuteModel)
        await this.topicModel.init()
        console.log('[AppModel] TopicModel initialized successfully')
      } catch (error) {
        console.error('[AppModel] Failed to initialize TopicModel:', error)
        console.error('[AppModel] Stack trace:', (error as Error).stack)
        // Don't continue without TopicModel - it's essential for chat
        throw new Error(`TopicModel initialization failed: ${(error as Error).message}`)
      }
      
      // Initialize TransportManager (networking)
      console.log('[AppModel] Creating TransportManager...')
      this.transportManager = new TransportManager(this.leuteModel, this.channelManager, commServerUrl)
      await this.transportManager.init()
      console.log('[AppModel] TransportManager initialized')
      
      // Start networking
      console.log('[AppModel] Starting networking...')
      await this.transportManager.startNetworking()
      console.log('[AppModel] Networking started')
      
      // Initialize LLMManager (optional - continue if fails)
      try {
        console.log('[AppModel] Creating LLMManager...')
        this.llmManager = new LLMManager(this.leuteModel, this.channelManager, this.transportManager)
        await this.llmManager.init()
        console.log('[AppModel] LLMManager initialized')
      } catch (error) {
        console.warn('[AppModel] LLMManager initialization failed (non-critical):', error)
        // Continue without LLM functionality
      }
      
      // Initialize AIAssistantModel (optional - continue if fails)
      if (this.llmManager && this.topicModel) {
        try {
          console.log('[AppModel] Creating AIAssistantModel...')
          this.aiAssistantModel = new AIAssistantModel(this.leuteModel, this.topicModel, this.llmManager, ownerId)
          await this.aiAssistantModel.init()
          console.log('[AppModel] AIAssistantModel initialized')
          
          // Start the AI assistant
          await this.aiAssistantModel.start()
          console.log('[AppModel] AIAssistantModel started')
        } catch (error) {
          console.warn('[AppModel] AIAssistantModel initialization/start failed (non-critical):', error)
          // Continue without AI assistant functionality
        }
      }
      
      // Create system topics
      await this.createSystemTopics()
      
      // TODO: Initialize other models as needed
      // - QuicModel (UDP/QUIC transport)
      // - SettingsModel (configuration)
      
      this.state.triggerEvent('init')
      console.log('[AppModel] Initialization complete')
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
   * Get list of contacts
   */
  private setupAccessRightsHandling(): void {
    // Listen for channel updates to grant access rights
    if (!this.channelManager) {
      console.warn('[AppModel] ChannelManager not available for access rights setup')
      return
    }
    
    const unsubscribe = this.channelManager.onUpdated.listen(async (
      channelInfoIdHash: any,
      channelId: string,
      channelOwner: any,
      timeOfEarliestChange: Date,
      data: any[]
    ) => {
      try {
        // Check if this is a person-to-person topic
        if (!channelId.includes('<->')) {
          return // Not a person-to-person topic
        }

        console.log('[AppModel] Channel updated, granting access rights for:', channelId)
        console.log('[AppModel] Channel owner:', channelOwner)
        console.log('[AppModel] Data entries:', data.length)
        
        // Extract participants from channel ID
        const participants = channelId.split('<->')
        if (participants.length !== 2) {
          return
        }

        // Import access control functions
        const { createAccess } = await import('@refinio/one.core/lib/access.js')
        const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')

        // Grant access to the channel info itself
        await createAccess([{
          id: channelInfoIdHash,
          person: participants as any,
          group: [],
          mode: SET_ACCESS_MODE.ADD
        }])

        // Grant access to all message data
        for (const entry of data) {
          const accessGrants = []
          
          // Grant access to the channel entry
          if (entry.channelEntryHash) {
            accessGrants.push({
              object: entry.channelEntryHash,
              person: participants as any,
              group: [],
              mode: SET_ACCESS_MODE.ADD
            })
          }
          
          // Grant access to the message data
          if (entry.dataHash) {
            accessGrants.push({
              object: entry.dataHash,
              person: participants as any,
              group: [],
              mode: SET_ACCESS_MODE.ADD
            })
          }
          
          // Grant access to metadata
          if (entry.metaDataHashes) {
            for (const metaHash of entry.metaDataHashes) {
              accessGrants.push({
                object: metaHash,
                person: participants as any,
                group: [],
                mode: SET_ACCESS_MODE.ADD
              })
            }
          }
          
          if (accessGrants.length > 0) {
            await createAccess(accessGrants)
          }
        }

        console.log('[AppModel] Access rights granted for channel:', channelId)
        
        // Trigger CHUM sync if connections are available
        if (this.connections) {
          console.log('[AppModel] Triggering CHUM sync after access rights creation')
          // ConnectionsModel should handle CHUM sync automatically
          // when access rights are created
        }
      } catch (error) {
        console.error('[AppModel] Error granting access rights:', error)
      }
    })
    
    console.log('[AppModel] Access rights handler registered')
  }

  async getContacts() {
    if (!this.leuteModel) {
      throw new Error('LeuteModel not initialized')
    }
    
    const allContacts = []
    
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
      
      // 2. Get AI models as contacts
      if (this.aiAssistantModel) {
        try {
          // Get all available LLM models
          const availableModels = this.aiAssistantModel.getAvailableModels()
          console.log(`[AppModel] Found ${availableModels.length} AI models`)
          
          for (const model of availableModels) {
            // AI models don't have personId, they have id
            if (model.id) {
              // Format the model name properly
              let displayName = model.name
              if (displayName.toLowerCase().includes('gpt') && displayName.toLowerCase().includes('oss')) {
                displayName = 'GPT-OSS'
              } else {
                displayName = displayName
                  .replace(/[-_]/g, ' ')
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ')
              }
              
              // Check if model is loaded/active
              const isLoaded = this.llmManager?.isModelLoaded(model.id) || false
              
              allContacts.push({
                id: model.id, // Use model.id instead of personId
                name: displayName,
                displayName: displayName,
                email: '',
                status: isLoaded ? 'online' as const : 'offline' as const,
                isAI: true,
                modelId: model.id
              })
            }
          }
        } catch (error) {
          console.warn('[AppModel] Could not get AI models as contacts:', error)
        }
      }
      
      // 3. Get human contacts (Someone objects)
      const someoneContacts = await this.leuteModel.others()
      
      if (!someoneContacts || someoneContacts.length === 0) {
        console.log(`[AppModel] No human contacts found`)
      } else {
        console.log(`[AppModel] Found ${someoneContacts.length} human contacts`)
        
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
            let displayName = `Contact ${personId.toString().substring(0, 8)}`
            
            if (profile?.personDescriptions?.length > 0) {
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
              status: 'offline' as const, // TODO: Implement online status
              isAI: false // Explicitly mark human contacts as not AI
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
      console.log('[AppModel] Creating system topics...')
      
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
}