/**
 * Settings IPC Handlers
 * Manages settings synchronization between browser and node instances
 */

const realNodeInstance = require('../../hybrid/real-node-instance')

const settingsHandlers = {
  /**
   * Get a setting value from the node instance
   */
  async getSetting(event, key) {
    console.log('[Settings] Getting setting:', key)
    
    if (!realNodeInstance.isInitialized()) {
      throw new Error('Node instance not initialized')
    }
    
    const value = await realNodeInstance.getSetting(key)
    return value
  },

  /**
   * Set a setting value in the node instance
   */
  async setSetting(event, { key, value }) {
    console.log('[Settings] Setting:', key, '=', value)
    
    if (!realNodeInstance.isInitialized()) {
      throw new Error('Node instance not initialized')
    }
    
    await realNodeInstance.setSetting(key, value)
    
    // Broadcast the change to all listeners
    return { success: true }
  },

  /**
   * Get all settings with a specific prefix
   */
  async getSettings(event, prefix) {
    console.log('[Settings] Getting settings with prefix:', prefix)
    
    if (!realNodeInstance.isInitialized()) {
      throw new Error('Node instance not initialized')
    }
    
    const settings = await realNodeInstance.getSettings(prefix)
    return settings
  },

  /**
   * Sync IoM settings between browser and node
   */
  async syncIoMSettings(event, browserSettings) {
    console.log('[Settings] Syncing IoM settings from browser')
    
    if (!realNodeInstance.isInitialized()) {
      throw new Error('Node instance not initialized')
    }
    
    // Update browser connection status
    await realNodeInstance.updateBrowserConnectionStatus(true)
    
    // Sync browser-specific settings to IoM
    if (browserSettings) {
      for (const [key, value] of Object.entries(browserSettings)) {
        if (key.startsWith('iom.browser.')) {
          await realNodeInstance.setSetting(key, value)
        }
      }
    }
    
    // Return current IoM settings from node
    const iomSettings = realNodeInstance.getIoMSettings()
    if (iomSettings) {
      const settings = {}
      // Get relevant IoM settings
      settings['iom.group'] = iomSettings.getValue('iom.group')
      settings['iom.owner'] = iomSettings.getValue('iom.owner')
      settings['iom.node.connected'] = iomSettings.getValue('iom.node.connected')
      settings['iom.browser.connected'] = iomSettings.getValue('iom.browser.connected')
      return settings
    }
    
    return {}
  },

  /**
   * Subscribe to settings changes
   */
  async subscribeToSettings(event, prefix) {
    console.log('[Settings] Subscribing to settings with prefix:', prefix)
    
    if (!realNodeInstance.isInitialized()) {
      throw new Error('Node instance not initialized')
    }
    
    const nodeSettings = realNodeInstance.getNodeSettings()
    const iomSettings = realNodeInstance.getIoMSettings()
    
    // Subscribe to node settings changes
    if (nodeSettings) {
      nodeSettings.onSettingChange((key, value) => {
        if (!prefix || key.startsWith(prefix)) {
          event.sender.send('settings:changed', { key, value })
        }
      })
    }
    
    // Subscribe to IoM settings changes
    if (iomSettings) {
      iomSettings.onSettingChange((key, value) => {
        if (!prefix || key.startsWith(prefix)) {
          event.sender.send('settings:changed', { key, value })
        }
      })
    }
    
    return { subscribed: true }
  },

  /**
   * Get instance configuration
   */
  async getInstanceConfig(event) {
    console.log('[Settings] Getting instance configuration')
    
    const config = {
      node: {
        initialized: realNodeInstance.isInitialized(),
        hasSettings: !!realNodeInstance.getNodeSettings(),
        hasIoMSettings: !!realNodeInstance.getIoMSettings()
      }
    }
    
    if (realNodeInstance.isInitialized()) {
      config.node.instanceId = await realNodeInstance.getSetting('instance.id')
      config.node.instanceType = await realNodeInstance.getSetting('instance.type')
      config.node.storageRole = await realNodeInstance.getSetting('storage.role')
      config.node.syncEnabled = await realNodeInstance.getSetting('sync.enabled')
      
      // Get IoM configuration
      const iomSettings = realNodeInstance.getIoMSettings()
      if (iomSettings) {
        config.iom = {
          group: iomSettings.getValue('iom.group'),
          owner: iomSettings.getValue('iom.owner'),
          nodeConnected: iomSettings.getValue('iom.node.connected'),
          browserConnected: iomSettings.getValue('iom.browser.connected')
        }
      }
    }
    
    return config
  }
}

module.exports = settingsHandlers