import type { ChannelManager } from '@refinio/one.models/lib/models/index.js';
/**
 * Access Rights Manager for Node.js ONE.core instance
 * Based on one.leute LeuteAccessRightsManager pattern
 */

/**
 * Access Rights Manager for Node.js instance
 * Handles proper access rights setup for channel sharing with browser instance
 */
class NodeAccessRightsManager {
  public channelManager: any;
  public leuteModel: any;
  public connectionsModel: any;
  public groupConfig: any;

  [key: string]: any;
  constructor(channelManager: any, connectionsModel: any, leuteModel: any) {
    this.channelManager = channelManager
    this.leuteModel = leuteModel
    this.connectionsModel = connectionsModel
    this.groupConfig = {}
    
    // Set up automatic access rights for new channels
    this.channelManager.onUpdated(async (channelInfoIdHash: any, channelId: string, channelOwner: string, timeOfEarliestChange: number, data: any) => {
      if (channelInfoIdHash && this.groupConfig.federation) {
        // CRITICAL: Check channel type before granting access
        const isP2PChannel = channelId.includes('<->')
        const isPrivateChannel = channelId === 'contacts' // Note: 'lama' and 'hi' are user-visible channels

        // Skip automatic access for P2P and private channels
        if (isP2PChannel || isPrivateChannel) {
          console.log(`[NodeAccessRights] Skipping automatic access for ${isPrivateChannel ? 'private' : 'P2P'} channel: ${channelId}`)

          // For private channels, only grant federation access (browser only)
          if (isPrivateChannel) {
            try {
              const { createAccess } = await import('../../node_modules/@refinio/one.core/lib/access.js')
              const { SET_ACCESS_MODE } = await import('../../node_modules/@refinio/one.core/lib/storage-base-common.js')

              const { ensureIdHash } = await import('@refinio/one.core/lib/util/type-checks.js')
              await createAccess([{
                id: ensureIdHash(channelInfoIdHash),
                person: [],
                group: this.getGroups('federation'), // ONLY federation
                mode: SET_ACCESS_MODE.ADD
}])

              console.log(`[NodeAccessRights] ✅ Federation-only access granted for private channel: ${channelId}`)
            } catch (error) {
              if (!(error as Error).message?.includes('already exists')) {
                console.error('[NodeAccessRights] Failed to grant federation access:', (error as Error).message)
              }
            }
          }
          return
        }

        // For other channels, grant broader access (but not to everyone)
        try {
          const { createAccess } = await import('../../node_modules/@refinio/one.core/lib/access.js')
          const { SET_ACCESS_MODE } = await import('../../node_modules/@refinio/one.core/lib/storage-base-common.js')

          const { ensureIdHash } = await import('@refinio/one.core/lib/util/type-checks.js')
          await createAccess([{
            id: ensureIdHash(channelInfoIdHash),
            person: [],
            group: this.getGroups('federation', 'replicant'), // NOT everyone
            mode: SET_ACCESS_MODE.ADD
          }])

          console.log(`[NodeAccessRights] ✅ Access granted for channel: ${channelId}`)
        } catch (error) {
          // Access might already exist, that's ok
          if (!(error as Error).message?.includes('already exists')) {
            console.error('[NodeAccessRights] Failed to grant access:', (error as Error).message)
          }
        }
      }
    })
  }
  
  /**
   * Initialize the access rights manager with group configuration
   */
  async init(groups: any): Promise<any> {
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
  async shutdown(): Promise<any> {
    this.groupConfig = {}
  }
  
  /**
   * Get group IDs by name
   */
  getGroups(...groupNames: any): any {
    const groups = []
    for (const groupName of groupNames) {
      const groupConfigEntry = this.groupConfig[groupName]
      if (groupConfigEntry !== undefined) {
        // Ensure we're pushing a simple value, not a frozen object
        groups.push(groupConfigEntry)
      }
    }
    return groups
  }
  
  /**
   * Give access to main profile for everybody and federation
   */
  async giveAccessToMainProfile(): Promise<any> {
    try {
      const { serializeWithType } = await import('@refinio/one.core/lib/util/promise.js')
      const { createAccess } = await import('@refinio/one.core/lib/access.js')
      const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')
      
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
  async giveAccessToChannels(): Promise<any> {
    try {
      const { serializeWithType } = await import('@refinio/one.core/lib/util/promise.js')
      const { createAccess } = await import('@refinio/one.core/lib/access.js')
      const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')
      const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/util/object.js')

      const me = await this.leuteModel.me()
      const mainId = await me.mainIdentity()

      // Get all existing channels and grant access
      const channels = await this.channelManager.getMatchingChannelInfos()
      console.log(`[NodeAccessRights] Setting up access for ${channels.length} channels`)

      await serializeWithType('IdAccess', async () => {
        // Apply access rights to channels selectively
        await Promise.all(
          channels.map(async (channel: any) => {
            // CRITICAL: Don't share "lama" or other private channels with everyone!
            // Only share P2P channels (format: id1<->id2) and specific shared channels
            const isP2PChannel = channel.id.includes('<->')
            const isPrivateChannel = channel.id === 'contacts' // Note: 'lama' and 'hi' are user-visible channels

            if (isPrivateChannel) {
              console.log(`[NodeAccessRights] Skipping private channel: ${channel.id}`)
              // Only share with federation (browser), NOT with everyone
              await this.channelManager.createChannel(channel.id, channel.owner)

              const channelIdHash = await calculateIdHashOfObj({
                $type$: 'ChannelInfo',
                id: channel.id,
                owner: channel.owner
              })

              await createAccess([{
                id: channelIdHash,
                person: [],
                group: this.getGroups('federation'), // ONLY federation, not everyone!
                mode: SET_ACCESS_MODE.ADD
              }])
              return
            }

            // For P2P channels, handle specially
            if (isP2PChannel) {
              console.log(`[NodeAccessRights] P2P channel detected: ${channel.id}`)
              // P2P channels should only be accessible to the participants
              // Access should be granted per-person when the channel is created
              // Not to everyone group!
              return // Skip automatic group access for P2P channels
            }

            // For other channels (future shared channels), grant broader access
            await this.channelManager.createChannel(channel.id, channel.owner)

            const channelIdHash = await calculateIdHashOfObj({
              $type$: 'ChannelInfo',
              id: channel.id,
              owner: channel.owner
            })

            // Only share with federation and replicant, not everyone
            await createAccess([{
              id: channelIdHash,
              person: [],
              group: this.getGroups('federation', 'replicant'),
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
  async grantChannelAccess(channelId: any, owner: any): Promise<any> {
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

export default NodeAccessRightsManager;