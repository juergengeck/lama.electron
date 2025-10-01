import type { ChannelManager } from '@refinio/one.models/lib/models/index.js';
/**
 * IoP (Internet of Persons) Sync Manager
 * 
 * Manages explicit content sharing between Browser and Node.js instances
 * using access rights instead of IoM identity merging.
 */

class IoPSyncManager {
  public nodeOneCore: any;
  public syncEnabled: any;

  browserPersonId: string | null;
  nodePersonId: string | null;
  constructor(nodeOneCore: any) {

    this.nodeOneCore = nodeOneCore
    this.browserPersonId = null
    this.nodePersonId = null
    this.syncEnabled = false
}

  /**
   * Initialize IoP sync between Browser and Node instances
   * @param {string} browserPersonId - The browser instance's person ID
   */
  async initializeSync(browserPersonId: any): Promise<any> {
    console.log('[IoPSync] Initializing IoP sync...')
    
    this.browserPersonId = browserPersonId
    this.nodePersonId = this.nodeOneCore.ownerId
    
    if (!this.browserPersonId || !this.nodePersonId) {
      throw new Error('[IoPSync] Missing person IDs for sync setup')
    }
    
    console.log('[IoPSync] Browser Person:', this.browserPersonId)
    console.log('[IoPSync] Node Person:', this.nodePersonId)
    
    // Grant mutual access rights
    await this.grantMutualAccess()
    
    this.syncEnabled = true
    console.log('[IoPSync] ✅ IoP sync initialized')
  }
  
  /**
   * Grant mutual access rights between Browser and Node instances
   */
  async grantMutualAccess(): Promise<any> {
    console.log('[IoPSync] Granting mutual access rights...')
    
    const { createAccess } = await import('../../node_modules/@refinio/one.core/lib/access.js')
    const { SET_ACCESS_MODE } = await import('../../node_modules/@refinio/one.core/lib/storage-base-common.js')
    const { calculateIdHashOfObj } = await import('../../node_modules/@refinio/one.core/lib/util/object.js')
    
    // 1. Grant Browser access to Node's Leute object
    await this.grantAccessToLeute(this.browserPersonId, createAccess, SET_ACCESS_MODE, calculateIdHashOfObj)
    
    // 2. Grant Browser access to all Node's channels
    await this.grantAccessToChannels(this.browserPersonId, createAccess, SET_ACCESS_MODE, calculateIdHashOfObj)
    
    // 3. Grant Browser access to Node's Someone objects (contacts)
    await this.grantAccessToSomeones(this.browserPersonId, createAccess, SET_ACCESS_MODE)
    
    console.log('[IoPSync] ✅ Access rights granted')
  }
  
  /**
   * Grant access to Leute object for contact list sync
   */
  async grantAccessToLeute(remotePersonId: any, createAccess: any, SET_ACCESS_MODE: any, calculateIdHashOfObj: any): Promise<any> {
    console.log('[IoPSync] Granting access to Leute object...')
    
    // Calculate Leute object ID
    const leuteId = await calculateIdHashOfObj({
      $type$: 'Leute',
      appId: 'one.leute'
    })
    
    // Grant access to the Leute object
    await createAccess([{
      id: leuteId,
      person: [remotePersonId],
      group: [],
      mode: SET_ACCESS_MODE.ADD
    }])
    
    console.log('[IoPSync] ✅ Leute access granted')
  }
  
  /**
   * Grant access to all channels for message sync
   */
  async grantAccessToChannels(remotePersonId: any, createAccess: any, SET_ACCESS_MODE: any, calculateIdHashOfObj: any): Promise<any> {
    console.log('[IoPSync] Granting access to channels...')
    
    if (!this.nodeOneCore.channelManager) {
      console.warn('[IoPSync] ChannelManager not available')
      return
    }
    
    // Get all channels
    const channels = await this.nodeOneCore.channelManager.getAllChannels()
    console.log(`[IoPSync] Found ${(channels as any).length} channels to share`)
    
    for (const channel of channels) {
      try {
        const channelInfoId = await calculateIdHashOfObj({
          $type$: 'ChannelInfo',
          id: channel.id,
          owner: channel.owner || this.nodePersonId
        })
        
        await createAccess([{
          id: channelInfoId,
          person: [remotePersonId],
          group: [],
          mode: SET_ACCESS_MODE.ADD
        }])
        
        console.log(`[IoPSync] Access granted to channel: ${channel.id}`)
      } catch (error) {
        console.warn(`[IoPSync] Failed to grant access to channel ${channel.id}:`, (error as Error).message)
      }
    }
    
    console.log('[IoPSync] ✅ Channel access granted')
  }
  
  /**
   * Grant access to Someone objects (contacts)
   */
  async grantAccessToSomeones(remotePersonId: any, createAccess: any, SET_ACCESS_MODE: any): Promise<any> {
    console.log('[IoPSync] Granting access to Someone objects...')
    
    if (!this.nodeOneCore.leuteModel) {
      console.warn('[IoPSync] LeuteModel not available')
      return
    }
    
    // Get all contacts (Someone objects)
    const others = await this.nodeOneCore.leuteModel.others()
    console.log(`[IoPSync] Found ${others.length} contacts to share`)
    
    for (const someone of others) {
      try {
        // Grant access to the Someone object
        await createAccess([{
          id: someone.idHash,
          person: [remotePersonId],
          group: [],
          mode: SET_ACCESS_MODE.ADD
        }])
        
        console.log(`[IoPSync] Access granted to contact: ${someone.idHash?.substring(0, 8)}...`)
      } catch (error) {
        console.warn(`[IoPSync] Failed to grant access to contact:`, (error as Error).message)
      }
    }
    
    console.log('[IoPSync] ✅ Someone access granted')
  }
  
  /**
   * Set up listeners for new content to automatically grant access
   */
  setupAutoAccessGrant(): any {
    if (!this.syncEnabled || !this.browserPersonId) {
      return
    }
    
    console.log('[IoPSync] Setting up auto-access grant for new content...')
    
    // Listen for new channels
    if (this.nodeOneCore.channelManager) {
      this.nodeOneCore.channelManager.onChannelCreated(async (channel: any) => {
        console.log(`[IoPSync] New channel created: ${channel.id}, granting access...`)
        const { createAccess } = await import('../../node_modules/@refinio/one.core/lib/access.js')
        const { SET_ACCESS_MODE } = await import('../../node_modules/@refinio/one.core/lib/storage-base-common.js')
        const { calculateIdHashOfObj } = await import('../../node_modules/@refinio/one.core/lib/util/object.js')
        
        const channelInfoId = await calculateIdHashOfObj({
          $type$: 'ChannelInfo',
          id: channel.id,
          owner: channel.owner || this.nodePersonId
        })
        
        if (this.browserPersonId) {
          await createAccess([{
            id: channelInfoId,
            person: [this.browserPersonId as any],
            group: [],
            mode: SET_ACCESS_MODE.ADD
          }])
        }
        
        console.log(`[IoPSync] ✅ Access granted to new channel: ${channel.id}`)
      })
    }
    
    // Listen for new contacts
    if (this.nodeOneCore.leuteModel) {
      this.nodeOneCore.leuteModel.onSomeoneAdded(async (someoneId: any) => {
        console.log(`[IoPSync] New contact added: ${String(someoneId).substring(0, 8)}..., granting access...`)
        const { createAccess } = await import('../../node_modules/@refinio/one.core/lib/access.js')
        const { SET_ACCESS_MODE } = await import('../../node_modules/@refinio/one.core/lib/storage-base-common.js')
        
        if (this.browserPersonId) {
          await createAccess([{
            id: someoneId,
            person: [this.browserPersonId as any],
            group: [],
            mode: SET_ACCESS_MODE.ADD
          }])
        }
        
        console.log(`[IoPSync] ✅ Access granted to new contact`)
      })
    }
    
    console.log('[IoPSync] ✅ Auto-access grant configured')
  }
  
  /**
   * Check sync status
   */
  getStatus(): any {
    return {
      enabled: this.syncEnabled,
      browserPersonId: this.browserPersonId,
      nodePersonId: this.nodePersonId
    }
  }
}

export default IoPSyncManager;