/**
 * Settings Replication Service
 * Handles peer-to-peer settings synchronization using verifiable credentials
 * Supports both receiving settings updates and broadcasting local changes
 */

const { EventEmitter } = require('events')
const credentialsManager = require('./credentials-manager')

class SettingsReplicationService extends EventEmitter {
  constructor() {
    super()
    this.replicationFilters = new Map()
    this.localSettings = new Map()
    this.pendingReplications = new Map()
    this.replicationHistory = []
    this.maxHistorySize = 1000
  }

  /**
   * Initialize settings replication service
   */
  async initialize() {
    console.log('[SettingsReplication] Initializing settings replication service...')
    
    // Create bootstrap credentials
    await credentialsManager.createBootstrapCredentials()
    
    // Set up replication filters for different setting types
    this.addReplicationFilter('connections', {
      scope: 'settings.connections',
      requiredAuthority: 'DEVICE_ADMIN',
      mergeStrategy: 'peer_priority'
    })
    
    this.addReplicationFilter('network', {
      scope: 'settings.network',
      requiredAuthority: 'DEVICE_ADMIN',
      mergeStrategy: 'peer_priority'
    })
    
    this.addReplicationFilter('appearance', {
      scope: 'settings.appearance',
      requiredAuthority: 'USER',
      mergeStrategy: 'user_priority'
    })
    
    this.addReplicationFilter('notifications', {
      scope: 'settings.notifications',
      requiredAuthority: 'USER',
      mergeStrategy: 'user_priority'
    })

    // Load existing settings
    await this.loadLocalSettings()
    
    console.log('[SettingsReplication] Settings replication service initialized')
  }

  /**
   * Add a replication filter for a settings category
   */
  addReplicationFilter(category, config) {
    this.replicationFilters.set(category, {
      scope: config.scope,
      requiredAuthority: config.requiredAuthority,
      mergeStrategy: config.mergeStrategy,
      lastSync: new Date(0),
      enabled: true
    })
    
    console.log(`[SettingsReplication] Added replication filter: ${category}`)
  }

  /**
   * Receive and process settings update from peer
   */
  async receiveSettingsUpdate(settingsUpdate) {
    try {
      console.log('[SettingsReplication] Received settings update:', {
        category: settingsUpdate.category,
        from: settingsUpdate.sourceInstance,
        timestamp: settingsUpdate.timestamp
      })

      // Validate the update structure
      if (!this.validateUpdateStructure(settingsUpdate)) {
        console.error('[SettingsReplication] Invalid update structure')
        return { success: false, reason: 'Invalid update structure' }
      }

      // Check if we have a replication filter for this category
      const filter = this.replicationFilters.get(settingsUpdate.category)
      if (!filter || !filter.enabled) {
        console.log('[SettingsReplication] No filter or disabled for category:', settingsUpdate.category)
        return { success: false, reason: 'Category not replicated' }
      }

      // Validate the credential
      const credentialValidation = await credentialsManager.validateCredential(
        settingsUpdate.credential,
        'sync',
        filter.scope
      )

      if (!credentialValidation.valid) {
        console.error('[SettingsReplication] Credential validation failed:', credentialValidation.reason)
        return { success: false, reason: credentialValidation.reason }
      }

      // Check if this is a newer update
      const currentSettings = this.localSettings.get(settingsUpdate.category)
      if (currentSettings && currentSettings.timestamp >= settingsUpdate.timestamp) {
        console.log('[SettingsReplication] Update is older than current settings, ignoring')
        return { success: false, reason: 'Stale update' }
      }

      // Apply the settings update using the appropriate merge strategy
      const mergeResult = await this.applySettingsUpdate(settingsUpdate, filter)
      
      if (mergeResult.success) {
        // Record the replication
        this.recordReplication(settingsUpdate, credentialValidation.subject)
        
        // Emit change event
        this.emit('settingsUpdated', {
          category: settingsUpdate.category,
          data: mergeResult.finalSettings,
          source: 'peer',
          sourceInstance: settingsUpdate.sourceInstance
        })
        
        console.log(`[SettingsReplication] Successfully applied settings update for ${settingsUpdate.category}`)
      }

      return mergeResult

    } catch (error) {
      console.error('[SettingsReplication] Error processing settings update:', error)
      return { success: false, reason: 'Processing error' }
    }
  }

  /**
   * Broadcast local settings change to peers
   */
  async broadcastSettingsChange(category, newSettings, credential) {
    try {
      const filter = this.replicationFilters.get(category)
      if (!filter || !filter.enabled) {
        console.log('[SettingsReplication] Category not configured for replication:', category)
        return
      }

      const settingsUpdate = {
        id: `setting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: category,
        scope: filter.scope,
        data: newSettings,
        timestamp: Date.now(),
        sourceInstance: credentialsManager.getOwnInstanceId(),
        sourceInstanceName: 'Node.js Hub', // TODO: Get actual instance name
        credential: credential,
        schemaVersion: '1.0.0'
      }

      console.log(`[SettingsReplication] Broadcasting settings change for ${category}`)

      // Store locally first
      this.localSettings.set(category, {
        data: newSettings,
        timestamp: settingsUpdate.timestamp,
        source: 'local'
      })

      // Send to CHUM sync for peer replication
      const chumSync = require('./chum-sync')
      await chumSync.queueSettingsReplication(settingsUpdate)

      // Record the broadcast
      this.recordReplication(settingsUpdate, { id: 'self' }, 'broadcast')

    } catch (error) {
      console.error('[SettingsReplication] Error broadcasting settings change:', error)
    }
  }

  /**
   * Apply settings update using merge strategy
   */
  async applySettingsUpdate(settingsUpdate, filter) {
    try {
      const currentSettings = this.localSettings.get(settingsUpdate.category)
      let finalSettings

      switch (filter.mergeStrategy) {
        case 'peer_priority':
          // Peer settings take priority (for device-level settings)
          finalSettings = settingsUpdate.data
          break

        case 'user_priority':
          // User settings take priority, only update if no local user preference
          if (!currentSettings || currentSettings.source !== 'user') {
            finalSettings = settingsUpdate.data
          } else {
            // Keep local settings but merge non-conflicting parts
            finalSettings = this.mergeSettings(currentSettings.data, settingsUpdate.data)
          }
          break

        case 'timestamp_priority':
          // Newest timestamp wins
          if (!currentSettings || currentSettings.timestamp < settingsUpdate.timestamp) {
            finalSettings = settingsUpdate.data
          } else {
            finalSettings = currentSettings.data
          }
          break

        default:
          finalSettings = settingsUpdate.data
      }

      // Update local storage
      this.localSettings.set(settingsUpdate.category, {
        data: finalSettings,
        timestamp: settingsUpdate.timestamp,
        source: 'peer',
        sourceInstance: settingsUpdate.sourceInstance
      })

      // Apply to actual system settings
      await this.applyToSystemSettings(settingsUpdate.category, finalSettings)

      return { success: true, finalSettings }

    } catch (error) {
      console.error('[SettingsReplication] Error applying settings update:', error)
      return { success: false, reason: 'Application error' }
    }
  }

  /**
   * Apply settings to the actual system
   */
  async applyToSystemSettings(category, settings) {
    try {
      switch (category) {
        case 'connections':
          await this.applyConnectionSettings(settings)
          break
        case 'network':
          await this.applyNetworkSettings(settings)
          break
        case 'appearance':
          await this.applyAppearanceSettings(settings)
          break
        case 'notifications':
          await this.applyNotificationSettings(settings)
          break
      }
    } catch (error) {
      console.error(`[SettingsReplication] Error applying ${category} settings:`, error)
      throw error
    }
  }

  /**
   * Apply connection settings to Node.js instance
   */
  async applyConnectionSettings(settings) {
    const nodeOneCore = require('../core/node-one-core')
    
    if (settings.commServerUrl) {
      await nodeOneCore.setState('capabilities.network.commServerUrl', settings.commServerUrl)
    }
    
    if (settings.directConnections !== undefined) {
      await nodeOneCore.setState('capabilities.network.directConnections', settings.directConnections)
    }
    
    if (settings.acceptIncomingConnections !== undefined) {
      // Update ConnectionsModel configuration
      if (nodeOneCore.connectionsModel) {
        nodeOneCore.connectionsModel.acceptIncomingConnections = settings.acceptIncomingConnections
      }
    }
    
    console.log('[SettingsReplication] Applied connection settings')
  }

  /**
   * Apply network settings
   */
  async applyNetworkSettings(settings) {
    const nodeOneCore = require('../core/node-one-core')
    
    if (settings.protocols) {
      await nodeOneCore.setState('capabilities.network.protocols', settings.protocols)
    }
    
    if (settings.iomServer) {
      await nodeOneCore.setState('capabilities.network.iomServer', settings.iomServer)
    }
    
    console.log('[SettingsReplication] Applied network settings')
  }

  /**
   * Apply appearance settings (for future UI sync)
   */
  async applyAppearanceSettings(settings) {
    // Store for UI consumption
    console.log('[SettingsReplication] Applied appearance settings')
  }

  /**
   * Apply notification settings
   */
  async applyNotificationSettings(settings) {
    // Store for notification system
    console.log('[SettingsReplication] Applied notification settings')
  }

  /**
   * Merge two settings objects (simple deep merge)
   */
  mergeSettings(currentSettings, newSettings) {
    if (typeof newSettings !== 'object' || newSettings === null) {
      return currentSettings
    }
    
    if (typeof currentSettings !== 'object' || currentSettings === null) {
      return newSettings
    }
    
    const merged = { ...currentSettings }
    
    for (const key in newSettings) {
      if (typeof newSettings[key] === 'object' && newSettings[key] !== null && !Array.isArray(newSettings[key])) {
        merged[key] = this.mergeSettings(currentSettings[key], newSettings[key])
      } else {
        merged[key] = newSettings[key]
      }
    }
    
    return merged
  }

  /**
   * Validate settings update structure
   */
  validateUpdateStructure(settingsUpdate) {
    const required = ['id', 'category', 'scope', 'data', 'timestamp', 'sourceInstance', 'credential']
    
    for (const field of required) {
      if (!(field in settingsUpdate)) {
        console.error('[SettingsReplication] Missing required field:', field)
        return false
      }
    }
    
    return true
  }

  /**
   * Record replication for audit trail
   */
  recordReplication(settingsUpdate, subject, direction = 'received') {
    const record = {
      id: settingsUpdate.id,
      category: settingsUpdate.category,
      timestamp: new Date().toISOString(),
      direction: direction,
      sourceInstance: settingsUpdate.sourceInstance,
      subject: subject.id || subject.instanceId,
      authority: subject.authority,
      dataHash: this.hashSettings(settingsUpdate.data)
    }
    
    this.replicationHistory.push(record)
    
    // Limit history size
    if (this.replicationHistory.length > this.maxHistorySize) {
      this.replicationHistory.shift()
    }
    
    console.log(`[SettingsReplication] Recorded replication: ${direction} ${settingsUpdate.category} from ${record.subject}`)
  }

  /**
   * Hash settings data for audit trail
   */
  hashSettings(data) {
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 8)
  }

  /**
   * Load existing local settings
   */
  async loadLocalSettings() {
    // TODO: Load from persistent storage
    console.log('[SettingsReplication] Loaded local settings')
  }

  /**
   * Get replication status
   */
  getReplicationStatus() {
    return {
      filtersEnabled: this.replicationFilters.size,
      localSettings: this.localSettings.size,
      replicationHistory: this.replicationHistory.length,
      trustedCredentials: credentialsManager.getAllCredentials().trusted.length
    }
  }
}

// Singleton
module.exports = new SettingsReplicationService()