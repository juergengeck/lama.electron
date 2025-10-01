import type { ChannelManager } from '@refinio/one.models/lib/models/index.js';
/**
 * Content Sharing Manager
 * 
 * Manages access rights between Browser and Node instances for:
 * - Someone objects (contacts/address book)
 * - Channels/Topics (chat messages)
 * 
 * NOT the Leute object itself (that's identity management)
 */

import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';

class ContentSharingManager {
  public nodeOneCore: any;

  browserPersonId: SHA256IdHash<Person> | undefined
  nodePersonId: SHA256IdHash<Person> | undefined
  sharingEnabled: boolean

  constructor(nodeOneCore: any) {
    this.nodeOneCore = nodeOneCore
    this.browserPersonId = undefined
    this.nodePersonId = undefined
    this.sharingEnabled = false
  }

  /**
   * Initialize content sharing between Browser and Node
   * @param {string} browserPersonId - The browser instance's person ID
   */
  async initializeSharing(browserPersonId: any): Promise<any> {
    console.log('[ContentSharing] Initializing content sharing...')
    
    this.browserPersonId = browserPersonId
    this.nodePersonId = this.nodeOneCore.ownerId
    
    if (!this.browserPersonId || !this.nodePersonId) {
      console.error('[ContentSharing] Missing person IDs for sharing setup')
      return
    }
    
    console.log('[ContentSharing] Browser Person:', this.browserPersonId?.substring(0, 8) + '...')
    console.log('[ContentSharing] Node Person:', this.nodePersonId?.substring(0, 8) + '...')
    
    // ALWAYS create Access objects for CHUM sync to work
    // Access objects determine what data is shared during sync
    await this.grantAccessToExistingContent()
    
    // Set up listeners for new content
    await this.setupNewContentListeners()
    
    this.sharingEnabled = true
    console.log('[ContentSharing] ✅ Content sharing initialized - Access objects created')
  }
  
  /**
   * Grant access to existing content
   */
  async grantAccessToExistingContent(): Promise<any> {
    console.log('[ContentSharing] Granting access to existing content...')
    
    const { createAccess } = await import('../../node_modules/@refinio/one.core/lib/access.js')
    const { SET_ACCESS_MODE } = await import('../../node_modules/@refinio/one.core/lib/storage-base-common.js')
    
    // 1. Grant access to Someone objects (contacts)
    await this.grantAccessToContacts(createAccess, SET_ACCESS_MODE)
    
    // 2. Grant access to channels (for messages)
    await this.grantAccessToChannels(createAccess, SET_ACCESS_MODE)
    
    console.log('[ContentSharing] ✅ Access granted to existing content')
  }
  
  /**
   * Grant access to Someone objects (contacts in address book)
   */
  async grantAccessToContacts(createAccess: any, SET_ACCESS_MODE: any): Promise<any> {
    console.log('[ContentSharing] Granting access to contacts...')
    
    if (!this.nodeOneCore.leuteModel) {
      console.warn('[ContentSharing] LeuteModel not available')
      return
    }
    
    try {
      // Get all Someone objects from "other" array
      const others = await this.nodeOneCore.leuteModel.others()
      console.log(`[ContentSharing] Found ${others.length} contacts to share`)
      
      for (const someone of others) {
        try {
          // Grant the browser person access to this Someone object
          await createAccess([{
            id: someone.idHash,
            person: [this.browserPersonId],
            group: [],
            mode: SET_ACCESS_MODE.ADD
          }])
          
          console.log(`[ContentSharing] Granted access to contact: ${someone.idHash?.substring(0, 8)}...`)
          
          // Also grant access to the Person's profiles
          const profiles = await someone.profiles()
          for (const profile of profiles) {
            await createAccess([{
              id: profile.idHash,
              person: [this.browserPersonId],
              group: [],
              mode: SET_ACCESS_MODE.ADD
            }])
          }
        } catch (error) {
          console.warn(`[ContentSharing] Failed to grant access to contact:`, (error as Error).message)
        }
      }
      
      console.log('[ContentSharing] ✅ Contact access granted')
    } catch (error) {
      console.error('[ContentSharing] Failed to grant contact access:', error)
    }
  }
  
  /**
   * Grant access to channels (for message sync)
   */
  async grantAccessToChannels(createAccess: any, SET_ACCESS_MODE: any): Promise<any> {
    console.log('[ContentSharing] Granting access to channels...')
    
    if (!this.nodeOneCore.channelManager) {
      console.warn('[ContentSharing] ChannelManager not available')
      return
    }
    
    const { calculateIdHashOfObj } = await import('../../node_modules/@refinio/one.core/lib/util/object.js')
    
    try {
      // Get all channels
      const channelInfos = await this.nodeOneCore.channelManager.getAllChannelInfos()
      console.log(`[ContentSharing] Found ${(channelInfos as any).length} channels to share`)
      
      for (const channelInfo of channelInfos) {
        try {
          // Calculate the channel info ID
          const channelInfoId = await calculateIdHashOfObj({
            $type$: 'ChannelInfo',
            id: channelInfo.id,
            owner: channelInfo.owner
          })
          
          // Grant access to the channel
          await createAccess([{
            id: channelInfoId,
            person: [this.browserPersonId],
            group: [],
            mode: SET_ACCESS_MODE.ADD
          }])
          
          console.log(`[ContentSharing] Granted access to channel: ${channelInfo.id}`)
        } catch (error) {
          console.warn(`[ContentSharing] Failed to grant access to channel ${channelInfo.id}:`, (error as Error).message)
        }
      }
      
      console.log('[ContentSharing] ✅ Channel access granted')
    } catch (error) {
      console.error('[ContentSharing] Failed to grant channel access:', error)
    }
  }
  
  /**
   * Set up listeners to grant access to new content automatically
   * This ensures Access objects are created for ALL new content
   */
  async setupNewContentListeners(): Promise<any> {
    if (!this.browserPersonId) {
      console.warn('[ContentSharing] Cannot set up listeners - no browser person ID')
      return
    }
    
    console.log('[ContentSharing] Setting up listeners for new content...')
    
    // Listen for new contacts (Someone objects)
    if (this.nodeOneCore.leuteModel) {
      // Import OEvent dynamically
      const { OEvent } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/misc/OEvent.js')
      
      // Listen for when a new Someone is added to "other" array
      this.nodeOneCore.leuteModel.onSomeoneAdded = this.nodeOneCore.leuteModel.onSomeoneAdded || new OEvent()
      
      this.nodeOneCore.leuteModel.onSomeoneAdded.listen(async (someoneId: any) => {
        console.log(`[ContentSharing] New contact added: ${String(someoneId).substring(0, 8)}...`)
        
        const { createAccess } = await import('../../node_modules/@refinio/one.core/lib/access.js')
        const { SET_ACCESS_MODE } = await import('../../node_modules/@refinio/one.core/lib/storage-base-common.js')
        
        // Grant access to the new Someone object
        if (this.browserPersonId) {
          await createAccess([{
            id: someoneId,
            person: [this.browserPersonId],
            group: [],
            mode: SET_ACCESS_MODE.ADD
          }])
        }
        
        console.log(`[ContentSharing] ✅ Access granted to new contact`)
      })
    }
    
    // Listen for new channels
    if (this.nodeOneCore.channelManager) {
      // Import OEvent if not already imported
      const { OEvent } = await import('../../electron-ui/node_modules/@refinio/one.models/lib/misc/OEvent.js')
      
      // ChannelManager has an onChannelCreated event
      this.nodeOneCore.channelManager.onChannelCreated = this.nodeOneCore.channelManager.onChannelCreated || new OEvent()
      
      this.nodeOneCore.channelManager.onChannelCreated.listen(async (channelInfo: any) => {
        console.log(`[ContentSharing] New channel created: ${channelInfo.id}`)
        
        const { createAccess } = await import('../../node_modules/@refinio/one.core/lib/access.js')
        const { SET_ACCESS_MODE } = await import('../../node_modules/@refinio/one.core/lib/storage-base-common.js')
        const { calculateIdHashOfObj } = await import('../../node_modules/@refinio/one.core/lib/util/object.js')
        
        // Calculate channel info ID
        const channelInfoId = await calculateIdHashOfObj({
          $type$: 'ChannelInfo',
          id: channelInfo.id,
          owner: channelInfo.owner
        })
        
        // Grant access to the new channel
        if (this.browserPersonId) {
          await createAccess([{
            id: channelInfoId,
            person: [this.browserPersonId],
            group: [],
            mode: SET_ACCESS_MODE.ADD
          }])
        }
        
        console.log(`[ContentSharing] ✅ Access granted to new channel`)
      })
    }
    
    console.log('[ContentSharing] ✅ New content listeners configured')
  }
  
  /**
   * Get sharing status
   */
  getStatus(): any {
    return {
      enabled: this.sharingEnabled,
      browserPersonId: this.browserPersonId,
      nodePersonId: this.nodePersonId,
      samePersonMode: this.browserPersonId === this.nodePersonId
    }
  }
}

export default ContentSharingManager;