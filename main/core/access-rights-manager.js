/**
 * Access Rights Manager for Node.js ONE.core instance
 * Based on one.leute LeuteAccessRightsManager pattern
 */

/**
 * Access Rights Manager for Node.js instance
 * Handles proper access rights setup for channel sharing with browser instance
 */
class NodeAccessRightsManager {
  constructor(channelManager, connectionsModel, leuteModel) {
    this.channelManager = channelManager
    this.leuteModel = leuteModel
    this.connectionsModel = connectionsModel
    this.groupConfig = {}
    
    // Set up automatic access rights for new channels
    this.channelManager.onUpdated(async (channelInfoIdHash, channelId, channelOwner, timeOfEarliestChange, data) => {
      if (channelInfoIdHash && this.groupConfig.federation) {
        try {
          const { createAccess } = await import('../../node_modules/@refinio/one.core/lib/access.js')
          const { SET_ACCESS_MODE } = await import('../../node_modules/@refinio/one.core/lib/storage-base-common.js')
          
          await createAccess([{
            id: channelInfoIdHash,
            person: [],
            group: this.getGroups('federation', 'replicant', 'everyone'),
            mode: SET_ACCESS_MODE.ADD
          }])
          
          console.log(`[NodeAccessRights] ✅ Federation access granted for channel: ${channelId}`)
        } catch (error) {
          // Access might already exist, that's ok
          if (!error.message?.includes('already exists')) {
            console.error('[NodeAccessRights] Failed to grant federation access:', error.message)
          }
        }
      }
    })
  }
  
  /**
   * Initialize the access rights manager with group configuration
   */
  async init(groups) {
    if (groups) {
      this.groupConfig = groups
    }
    
    console.log('[NodeAccessRights] Initializing with groups:', Object.keys(this.groupConfig))
    
    await this.giveAccessToChannels()
    await this.giveAccessToMainProfile()
    
    console.log('[NodeAccessRights] ✅ Initialized successfully')
  }
  
  /**
   * Shutdown the access rights manager
   */
  async shutdown() {
    this.groupConfig = {}
  }
  
  /**
   * Get group IDs by name
   */
  getGroups(...groupNames) {
    const groups = []
    for (const groupName of groupNames) {
      const groupConfigEntry = this.groupConfig[groupName]
      if (groupConfigEntry !== undefined) {
        groups.push(groupConfigEntry)
      }
    }
    return groups
  }
  
  /**
   * Give access to main profile for everybody and federation
   */
  async giveAccessToMainProfile() {
    try {
      const { serializeWithType } = await import('../../node_modules/@refinio/one.core/lib/util/promise.js')
      const { createAccess } = await import('../../node_modules/@refinio/one.core/lib/access.js')
      const { SET_ACCESS_MODE } = await import('../../node_modules/@refinio/one.core/lib/storage-base-common.js')
      
      const me = await this.leuteModel.me()
      const mainProfile = me.mainProfileLazyLoad()
      
      await serializeWithType('Share', async () => {
        const setAccessParam = {
          id: mainProfile.idHash,
          person: [],
          group: this.getGroups('everyone', 'federation', 'replicant'),
          mode: SET_ACCESS_MODE.ADD
        }
        await createAccess([setAccessParam])
      })
      
      console.log('[NodeAccessRights] ✅ Granted access to main profile')
    } catch (error) {
      console.error('[NodeAccessRights] Failed to grant access to main profile:', error)
    }
  }
  
  /**
   * Set up access rights for channels
   */
  async giveAccessToChannels() {
    try {
      const { serializeWithType } = await import('../../node_modules/@refinio/one.core/lib/util/promise.js')
      const { createAccess } = await import('../../node_modules/@refinio/one.core/lib/access.js')
      const { SET_ACCESS_MODE } = await import('../../node_modules/@refinio/one.core/lib/storage-base-common.js')
      const { calculateIdHashOfObj } = await import('../../node_modules/@refinio/one.core/lib/util/object.js')
      
      const me = await this.leuteModel.me()
      const mainId = await me.mainIdentity()
      
      // Get all existing channels and grant access
      const channels = await this.channelManager.getMatchingChannelInfos()
      console.log(`[NodeAccessRights] Setting up access for ${channels.length} channels`)
      
      await serializeWithType('IdAccess', async () => {
        // Apply access rights to all channels
        await Promise.all(
          channels.map(async channel => {
            // Ensure channel exists
            await this.channelManager.createChannel(channel.id, channel.owner || mainId)
            
            // Calculate channel info hash
            const channelIdHash = await calculateIdHashOfObj({
              $type$: 'ChannelInfo',
              id: channel.id,
              owner: channel.owner || mainId
            })
            
            // Grant access
            await createAccess([{
              id: channelIdHash,
              person: [],
              group: this.getGroups('federation', 'replicant', 'everyone'),
              mode: SET_ACCESS_MODE.ADD
            }])
          })
        )
      })
      
      console.log('[NodeAccessRights] ✅ Channel access rights configured')
    } catch (error) {
      console.error('[NodeAccessRights] Failed to setup channel access:', error)
    }
  }
  
  /**
   * Grant access to a specific channel for federation
   */
  async grantChannelAccess(channelId, owner) {
    try {
      const { createAccess } = await import('../../node_modules/@refinio/one.core/lib/access.js')
      const { SET_ACCESS_MODE } = await import('../../node_modules/@refinio/one.core/lib/storage-base-common.js')
      const { calculateIdHashOfObj } = await import('../../node_modules/@refinio/one.core/lib/util/object.js')
      
      const channelIdHash = await calculateIdHashOfObj({
        $type$: 'ChannelInfo',
        id: channelId,
        owner: owner
      })
      
      await createAccess([{
        id: channelIdHash,
        person: [],
        group: this.getGroups('federation', 'replicant', 'everyone'),
        mode: SET_ACCESS_MODE.ADD
      }])
      
      console.log(`[NodeAccessRights] ✅ Granted federation access to channel: ${channelId}`)
    } catch (error) {
      console.error(`[NodeAccessRights] Failed to grant channel access for ${channelId}:`, error)
    }
  }
}

export default NodeAccessRightsManager