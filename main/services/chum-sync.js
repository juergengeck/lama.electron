/**
 * CHUM Sync Service
 * Manages data replication from Node.js ONE.core to Browser instance
 */

const { EventEmitter } = require('events')

class ChumSyncService extends EventEmitter {
  constructor() {
    super()
    this.syncInterval = null
    this.lastSyncTime = null
    this.syncFilters = new Set()
  }

  /**
   * Initialize CHUM sync between Node and Browser instances
   */
  async initialize() {
    console.log('[ChumSync] Initializing CHUM sync service...')
    
    // Set up default sync filters
    this.addSyncFilter('Message')      // Chat messages
    this.addSyncFilter('Topic')        // Conversations
    this.addSyncFilter('Person')       // Contacts
    this.addSyncFilter('Profile')      // Contact profiles
    this.addSyncFilter('Settings')     // User settings
    
    // Start periodic sync
    this.startSync()
    
    console.log('[ChumSync] CHUM sync service initialized')
  }

  /**
   * Add a type to sync from Node to Browser
   */
  addSyncFilter(type) {
    this.syncFilters.add(type)
    console.log(`[ChumSync] Added sync filter for type: ${type}`)
  }

  /**
   * Start periodic sync
   */
  startSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    // Sync every 5 seconds
    this.syncInterval = setInterval(() => {
      this.performSync().catch(error => {
        console.error('[ChumSync] Sync error:', error)
      })
    }, 5000)

    // Perform initial sync
    this.performSync()
  }

  /**
   * Perform sync from Node to Browser
   */
  async performSync() {
    const nodeProvisioning = require('../hybrid/node-provisioning')
    const nodeInstance = require('../hybrid/real-node-instance')
    
    if (!nodeProvisioning.isProvisioned()) {
      console.log('[ChumSync] Node not provisioned, skipping sync')
      return
    }

    console.log('[ChumSync] Starting sync...')
    
    try {
      const syncStartTime = Date.now()
      let objectsSynced = 0

      // Get changes since last sync
      const changesSinceTime = this.lastSyncTime || new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours if first sync
      
      // For each type in sync filters
      for (const type of this.syncFilters) {
        try {
          const changes = await this.getChangesForType(type, changesSinceTime)
          
          if (changes.length > 0) {
            console.log(`[ChumSync] Found ${changes.length} changes for type ${type}`)
            
            // Send to browser via IPC
            await this.sendToBrowser(type, changes)
            objectsSynced += changes.length
          }
        } catch (error) {
          console.error(`[ChumSync] Error syncing type ${type}:`, error)
        }
      }

      this.lastSyncTime = new Date(syncStartTime)
      
      if (objectsSynced > 0) {
        console.log(`[ChumSync] Sync complete: ${objectsSynced} objects synced`)
        this.emit('syncComplete', { objectsSynced, duration: Date.now() - syncStartTime })
      }
    } catch (error) {
      console.error('[ChumSync] Sync failed:', error)
      this.emit('syncError', error)
    }
  }

  /**
   * Get changes for a specific type since a given time
   */
  async getChangesForType(type, sinceTime) {
    const nodeInstance = require('../hybrid/real-node-instance')
    
    // This would normally use ONE.core's query capabilities
    // For now, we'll use the models we have
    
    switch (type) {
      case 'Message':
        if (nodeInstance.topicModel) {
          // Get recent messages
          return await nodeInstance.topicModel.getRecentMessages(sinceTime)
        }
        break
        
      case 'Topic':
        if (nodeInstance.topicModel) {
          // Get topics/conversations
          return await nodeInstance.topicModel.getTopics()
        }
        break
        
      case 'Person':
      case 'Profile':
        if (nodeInstance.leuteModel) {
          // Get contacts
          return await nodeInstance.leuteModel.getContacts()
        }
        break
        
      case 'Settings':
        if (nodeInstance.settingsModel) {
          // Get settings
          return await nodeInstance.settingsModel.getAll()
        }
        break
    }
    
    return []
  }

  /**
   * Send changes to browser instance via IPC
   */
  async sendToBrowser(type, changes) {
    const { BrowserWindow } = require('electron')
    const windows = BrowserWindow.getAllWindows()
    
    if (windows.length > 0) {
      const mainWindow = windows[0]
      
      // Send to renderer process
      mainWindow.webContents.send('chum:sync', {
        type,
        changes,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Stop sync
   */
  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
    console.log('[ChumSync] Sync stopped')
  }

  /**
   * Force immediate sync
   */
  async forceSync() {
    console.log('[ChumSync] Forcing immediate sync...')
    await this.performSync()
  }
}

module.exports = new ChumSyncService()