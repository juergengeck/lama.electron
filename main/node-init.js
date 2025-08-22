/**
 * Node.js ONE.CORE Initialization
 * Following one.leute.replicant pattern
 */

// Load Node.js platform
require('@refinio/one.core/lib/system/load-nodejs.js')

const { initOneCoreInstance, shutdownOneCoreInstance } = require('./one-core-helper')
const LeuteModel = require('@refinio/one.models/lib/models/Leute/LeuteModel.js').default
const ChannelManager = require('@refinio/one.models/lib/models/ChannelManager.js').default
const ConnectionsModel = require('@refinio/one.models/lib/models/ConnectionsModel.js').default
const TopicModel = require('@refinio/one.models/lib/models/Chat/TopicModel.js').default
const { objectEvents } = require('@refinio/one.models/lib/misc/ObjectEventDispatcher.js')

/**
 * Node Model - simplified like one.leute.replicant
 */
class NodeModel {
  constructor() {
    this.initialized = false
    this.directory = 'lama-node-data'
    this.secret = null
    
    // Models will be created on init
    this.leuteModel = null
    this.channelManager = null
    this.connections = null
    this.topicModel = null
  }
  
  /**
   * Initialize with secret
   */
  async init(secret) {
    if (this.initialized) {
      console.log('[NodeModel] Already initialized')
      return
    }
    
    console.log('[NodeModel] Initializing ONE.CORE instance...')
    this.secret = secret
    
    // Initialize ONE.CORE instance
    await initOneCoreInstance(secret, this.directory)
    
    // Setup object events
    objectEvents.determinePriorityOverride = (result) => {
      if (result.obj.$type$ === 'Person') return 11
      if (result.obj.$type$ === 'Profile') return 10
      return 0
    }
    
    await objectEvents.init()
    
    // Create models
    const commServerUrl = 'wss://comm.one.leute.io'
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
    
    // Initialize models
    await this.leuteModel.init()
    
    // Give main identity ability to define trusted keys
    const myMainId = await this.leuteModel.myMainIdentity()
    await this.leuteModel.trust.certify('RightToDeclareTrustedKeysForEverybodyCertificate', {
      beneficiary: myMainId
    })
    
    await this.channelManager.init()
    await this.topicModel.init()
    await this.connections.init()
    
    // Create system topics
    await this.topicModel.createEveryoneTopic()
    await this.topicModel.createGlueTopic()
    
    this.initialized = true
    console.log('[NodeModel] ✅ Initialized')
  }
  
  /**
   * Shutdown
   */
  async shutdown() {
    if (!this.initialized) return
    
    console.log('[NodeModel] Shutting down...')
    
    try {
      await this.connections.shutdown()
    } catch (e) {
      console.error(e)
    }
    
    try {
      await this.topicModel.shutdown()
    } catch (e) {
      console.error(e)
    }
    
    try {
      await this.channelManager.shutdown()
    } catch (e) {
      console.error(e)
    }
    
    try {
      await this.leuteModel.shutdown()
    } catch (e) {
      console.error(e)
    }
    
    shutdownOneCoreInstance()
    
    this.initialized = false
  }
  
  /**
   * Check if provisioned
   */
  isProvisioned() {
    return this.initialized
  }
  
  /**
   * Provision with credentials
   */
  async provision(credentials) {
    console.log('[NodeModel] Provisioning with credentials...')
    
    // Extract secret from credentials
    const secret = credentials.secret || 'default-secret'
    
    // Initialize
    await this.init(secret)
    
    console.log('[NodeModel] ✅ Provisioned')
  }
}

// Export singleton
module.exports = new NodeModel()