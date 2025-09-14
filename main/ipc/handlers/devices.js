/**
 * IPC handlers for device management
 */

import electron from 'electron';
const { ipcMain } = electron;
import deviceManager from '../../core/device-manager.js';
import nodeOneCore from '../../core/node-one-core.js';
import oneCoreHandlers from './one-core.js';

/**
 * Initialize device IPC handlers
 */
function initializeDeviceHandlers() {
  /**
   * Create an invitation for pairing
   */
  ipcMain.handle('invitation:create', async (event) => {
    try {
      console.log('[DeviceHandlers] UPDATED CODE - Creating invitation for pairing')
      
      // Check if Node.js instance is functionally ready
      console.log('[DeviceHandlers] Node.js instance state:', {
        ownerId: nodeOneCore.ownerId,
        instanceName: nodeOneCore.instanceName,
        initialized: nodeOneCore.initialized,
        hasConnectionsModel: !!nodeOneCore.connectionsModel,
        hasPairing: !!nodeOneCore.connectionsModel?.pairing
      })
      
      if (!nodeOneCore.ownerId || !nodeOneCore.instanceName) {
        throw new Error(`Node.js instance not provisioned - missing identity (ownerId: ${!!nodeOneCore.ownerId}, instanceName: ${!!nodeOneCore.instanceName})`)
      }
      
      // Check if connections model exists
      if (!nodeOneCore.connectionsModel?.pairing) {
        console.error('[DeviceHandlers] No pairing module found:', {
          hasConnectionsModel: !!nodeOneCore.connectionsModel,
          hasPairing: !!nodeOneCore.connectionsModel?.pairing
        })
        throw new Error('Node.js instance does not have networking initialized')
      }
      
      // Log pairing configuration details
      console.log('[DeviceHandlers] Pairing module state:', {
        hasCreateInvitation: typeof nodeOneCore.connectionsModel.pairing.createInvitation === 'function',
        activeInvitations: nodeOneCore.connectionsModel.pairing.activeInvitations?.size || 0,
        url: nodeOneCore.connectionsModel.pairing.url,
        expirationDuration: nodeOneCore.connectionsModel.pairing.inviteExpirationDurationInMs
      })
      
      // Create invitation through Node.js instance's ConnectionsModel
      const rawInvitation = await nodeOneCore.connectionsModel.pairing.createInvitation()
      console.log('[DeviceHandlers] Raw invitation received:', {
        hasToken: !!rawInvitation?.token,
        hasPublicKey: !!rawInvitation?.publicKey,
        hasUrl: !!rawInvitation?.url,
        rawInvitation: JSON.stringify(rawInvitation, null, 2)
      })
      console.log('[DeviceHandlers] Active invitations after creation:', nodeOneCore.connectionsModel.pairing.activeInvitations?.size || 0)
      
      // Extract values as plain strings (following LAMA pattern from InviteManager.ts)
      const token = String(rawInvitation.token || '')
      const publicKey = String(rawInvitation.publicKey || '')
      const url = String(rawInvitation.url || '')
      
      console.log('[DeviceHandlers] Extracted values:')
      console.log('  - Token type:', typeof token, 'length:', token.length)
      console.log('  - PublicKey type:', typeof publicKey, 'length:', publicKey.length)
      console.log('  - URL type:', typeof url, 'length:', url.length)
      
      // Verify the invitation format
      if (!token || !publicKey || !url) {
        console.error('[DeviceHandlers] Invalid invitation format - missing fields')
        throw new Error(`Invalid invitation format: token:${!!token} publicKey:${!!publicKey} url:${!!url}`)
      }
      
      // Create plain invitation object (not from one.models)
      const invitationData = {
        token: token,
        publicKey: publicKey,
        url: url
      }
      
      console.log('[DeviceHandlers] Plain invitation data:', JSON.stringify(invitationData))
      
      // Serialize and encode the plain object
      const serializedData = JSON.stringify(invitationData)
      const encodedData = encodeURIComponent(serializedData)
      
      console.log('[DeviceHandlers] Serialization:')
      console.log('  - Serialized length:', serializedData.length)
      console.log('  - Encoded length:', encodedData.length)
      
      // Create the proper invitation URL
      // The URL in the invitation object is the commServerUrl (e.g., wss://comm10.dev.refinio.one)
      // We need to convert it to the web app URL for the invitation link
      let baseUrl = 'https://edda.dev.refinio.one'  // Default for dev environment
      
      // Try to determine the correct base URL from the commServerUrl
      if (url.includes('dev.refinio.one')) {
        baseUrl = 'https://edda.dev.refinio.one'
      } else if (url.includes('refinio.one')) {
        baseUrl = 'https://edda.refinio.one'
      }
      
      const fullInvitationUrl = `${baseUrl}/invites/invitePartner/?invited=true/#${encodedData}`
      
      console.log('[DeviceHandlers] Returning invitation URL:', fullInvitationUrl)
      
      return {
        success: true,
        invitation: {
          url: fullInvitationUrl,
          token
        }
      }
    } catch (error) {
      console.error('[DeviceHandlers] Failed to create invitation:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })
  
  /**
   * Register a new device
   */
  ipcMain.handle('devices:register', async (event, deviceInfo) => {
    try {
      console.log('[DeviceHandlers] Registering new device:', deviceInfo)
      
      // Ensure Node.js instance is initialized
      if (!nodeOneCore.initialized) {
        throw new Error('Node.js instance not initialized')
      }
      
      const result = await deviceManager.registerDevice(deviceInfo)
      
      return {
        success: true,
        device: result.device,
        invite: result.invite
      }
    } catch (error) {
      console.error('[DeviceHandlers] Failed to register device:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })
  
  /**
   * Get all registered devices
   */
  ipcMain.handle('devices:list', async () => {
    try {
      const devices = deviceManager.getAllDevices()
      return {
        success: true,
        devices
      }
    } catch (error) {
      console.error('[DeviceHandlers] Failed to list devices:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })
  
  /**
   * Get connected devices
   */
  ipcMain.handle('devices:connected', async () => {
    try {
      // Get contacts from Node.js ONE.core instead of device manager
      const result = await oneCoreHandlers.getContacts()
      
      if (result.success) {
        return {
          success: true,
          devices: result.contacts
        }
      } else {
        return result
      }
    } catch (error) {
      console.error('[DeviceHandlers] Failed to get connected devices:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })
  
  /**
   * Remove a device
   */
  ipcMain.handle('devices:remove', async (event, deviceId) => {
    try {
      const removed = await deviceManager.removeDevice(deviceId)
      return {
        success: removed
      }
    } catch (error) {
      console.error('[DeviceHandlers] Failed to remove device:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })
  
  /**
   * Get device configuration
   */
  ipcMain.handle('devices:config', async (event, deviceId) => {
    try {
      const config = deviceManager.getDeviceConfig(deviceId)
      if (!config) {
        throw new Error('Device not found')
      }
      
      return {
        success: true,
        config
      }
    } catch (error) {
      console.error('[DeviceHandlers] Failed to get device config:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })
  
  /**
   * Send message to specific device
   */
  ipcMain.handle('devices:send', async (event, { deviceId, message }) => {
    try {
      const sent = deviceManager.sendToDevice(deviceId, message)
      return {
        success: sent
      }
    } catch (error) {
      console.error('[DeviceHandlers] Failed to send to device:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })
  
  /**
   * Broadcast to all devices
   */
  ipcMain.handle('devices:broadcast', async (event, message) => {
    try {
      deviceManager.broadcastToDevices(message)
      return {
        success: true
      }
    } catch (error) {
      console.error('[DeviceHandlers] Failed to broadcast:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })
  
  /**
   * Get connections model status and info
   */
  ipcMain.handle('connections:status', async () => {
    try {
      const status = {
        nodeInitialized: nodeOneCore.initialized,
        connectionsModel: !!nodeOneCore.connectionsModel,
        pairingAvailable: !!(nodeOneCore.connectionsModel?.pairing),
        instanceId: nodeOneCore.ownerId,
        instanceName: nodeOneCore.instanceName,
        config: nodeOneCore.getState('capabilities.network') || {}
      }
      
      return {
        success: true,
        status
      }
    } catch (error) {
      console.error('[DeviceHandlers] Failed to get connections status:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })
  
  /**
   * Get connection info from Node.js ConnectionsModel
   */
  ipcMain.handle('connections:info', async () => {
    try {
      if (!nodeOneCore.initialized || !nodeOneCore.connectionsModel) {
        return {
          success: false,
          error: 'ConnectionsModel not available'
        }
      }
      
      const connectionsInfo = nodeOneCore.connectionsModel.connectionsInfo()
      
      return {
        success: true,
        connections: connectionsInfo
      }
    } catch (error) {
      console.error('[DeviceHandlers] Failed to get connections info:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })
  
  /**
   * Get instance information (combined handler for both instance:info and devices:getInstanceInfo)
   */
  const getInstanceInfo = async () => {
    try {
      // Comprehensive instance info that works for both use cases
      const instanceInfo = {
        success: true,
        // Basic info
        id: nodeOneCore.ownerId,
        name: nodeOneCore.instanceName,
        type: 'electron-main',
        platform: 'nodejs',
        role: 'hub',
        // Status info
        initialized: nodeOneCore.initialized === true,
        nodeInitialized: nodeOneCore.initialized === true,
        hasConnectionsModel: !!nodeOneCore.connectionsModel,
        hasPairing: !!nodeOneCore.connectionsModel?.pairing,
        ownerId: nodeOneCore.ownerId,
        instanceName: nodeOneCore.instanceName,
        // Capabilities
        capabilities: {
          network: nodeOneCore.getState('capabilities.network'),
          storage: nodeOneCore.getState('capabilities.storage'),
          llm: nodeOneCore.getState('capabilities.llm')
        },
        // Devices
        devices: deviceManager.getAllDevices(),
        // For legacy compatibility
        instance: {
          id: nodeOneCore.ownerId,
          name: nodeOneCore.instanceName,
          type: 'electron-main',
          platform: 'nodejs',
          role: 'hub',
          initialized: nodeOneCore.initialized,
          capabilities: {
            network: nodeOneCore.getState('capabilities.network'),
            storage: nodeOneCore.getState('capabilities.storage'),
            llm: nodeOneCore.getState('capabilities.llm')
          },
          devices: deviceManager.getAllDevices()
        }
      }
      
      console.log('[DeviceHandlers] Instance info:', JSON.stringify({
        initialized: instanceInfo.initialized,
        ownerId: instanceInfo.ownerId,
        instanceName: instanceInfo.instanceName
      }, null, 2))
      
      return instanceInfo
    } catch (error) {
      console.error('[DeviceHandlers] Failed to get instance info:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  // Register both handler names for compatibility
  ipcMain.handle('devices:getInstanceInfo', getInstanceInfo)
  ipcMain.handle('instance:info', getInstanceInfo)
}

export { initializeDeviceHandlers }