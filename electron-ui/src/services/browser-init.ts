/**
 * Simplified Browser ONE.CORE Initialization
 * Following one.leute pattern
 */

import SingleUserNoAuth from '@refinio/one.models/lib/models/Authenticator/SingleUserNoAuth.js'
import LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js'
import ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js'
import ConnectionsModel from '@refinio/one.models/lib/models/ConnectionsModel.js'
import TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js'
import { objectEvents } from '@refinio/one.models/lib/misc/ObjectEventDispatcher.js'
import RecipesStable from '@refinio/one.models/lib/recipes/recipes-stable.js'
import RecipesExperimental from '@refinio/one.models/lib/recipes/recipes-experimental.js'
import {
  ReverseMapsStable,
  ReverseMapsForIdObjectsStable
} from '@refinio/one.models/lib/recipes/reversemaps-stable.js'
import {
  ReverseMapsExperimental,
  ReverseMapsForIdObjectsExperimental
} from '@refinio/one.models/lib/recipes/reversemaps-experimental.js'

/**
 * Browser Model - simplified like one.leute
 */
export class BrowserModel {
  public one: SingleUserNoAuth
  public leuteModel: LeuteModel
  public channelManager: ChannelManager
  public connections: ConnectionsModel
  public topicModel: TopicModel
  
  private initialized = false
  
  constructor() {
    // Create authenticator with proper recipes
    this.one = new SingleUserNoAuth({
      storagePrefix: 'lama-browser',
      initialRecipes: [...RecipesStable, ...RecipesExperimental],
      initiallyEnabledReverseMapTypes: new Map([
        ...ReverseMapsStable,
        ...ReverseMapsExperimental
      ]),
      initiallyEnabledReverseMapTypesForIdObjects: new Map([
        ...ReverseMapsForIdObjectsStable,
        ...ReverseMapsForIdObjectsExperimental
      ])
    })
    
    // Setup models
    const commServerUrl = 'wss://comm.one.leute.io' // Default comm server
    this.leuteModel = new LeuteModel(commServerUrl, true)
    this.channelManager = new ChannelManager(this.leuteModel)
    this.connections = new ConnectionsModel(this.leuteModel, {
      commServerUrl,
      acceptIncomingConnections: true,
      acceptUnknownInstances: true,
      acceptUnknownPersons: false,
      allowPairing: true,
      establishOutgoingConnections: true
    })
    this.topicModel = new TopicModel(this.channelManager, this.leuteModel)
  }
  
  /**
   * Initialize the model
   */
  async init(): Promise<void> {
    if (this.initialized) {
      console.log('[BrowserModel] Already initialized')
      return
    }
    
    console.log('[BrowserModel] Initializing...')
    
    // Setup object events
    objectEvents.determinePriorityOverride = (result: any) => {
      if (result.obj.$type$ === 'Person') return 11
      if (result.obj.$type$ === 'Profile') return 10
      return 0
    }
    
    await objectEvents.init()
    
    // Initialize models
    await this.leuteModel.init()
    await this.channelManager.init()
    await this.topicModel.init()
    await this.connections.init()
    
    // Create system topics
    await this.topicModel.createEveryoneTopic()
    await this.topicModel.createGlueTopic()
    
    this.initialized = true
    console.log('[BrowserModel] ✅ Initialized')
  }
  
  /**
   * Check if registered
   */
  async isRegistered(): Promise<boolean> {
    return await this.one.isRegistered()
  }
  
  /**
   * Login or register
   */
  async login(): Promise<void> {
    const registered = await this.isRegistered()
    
    if (registered) {
      console.log('[BrowserModel] Logging in...')
      await this.one.login()
    } else {
      console.log('[BrowserModel] Registering new user...')
      await this.one.register()
    }
    
    // Initialize after auth
    await this.init()
  }
  
  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return
    
    console.log('[BrowserModel] Shutting down...')
    
    await this.connections.shutdown()
    await this.topicModel.shutdown()
    await this.channelManager.shutdown()
    await this.leuteModel.shutdown()
    
    this.initialized = false
  }
}

// Export singleton
export const browserModel = new BrowserModel()