import type { ConnectionsModel } from '@refinio/one.models/lib/models/index.js';
/**
 * IPC handlers for device management
 */

import electron from 'electron';
const { ipcMain } = electron;
import deviceManager from '../../core/device-manager.js';
import nodeOneCore from '../../core/node-one-core.js';
import oneCoreHandlers from './one-core.js';
import type { IpcMainInvokeEvent } from 'electron';

interface DeviceInfo {
  name?: string;
  type?: string;
  capabilities?: any[];
  [key: string]: any;
}

interface MessageToDevice {
  deviceId: string;
  message: any;
}

interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  invitation?: {
    url: string;
    token: string;
  };
  device?: any;
  invite?: any;
  devices?: any[];
  config?: any;
  status?: any;
  connections?: any;
  instance?: any;
  [key: string]: any;
}

/**
 * Initialize device IPC handlers
 */
function initializeDeviceHandlers() {
  /**
   * Create an invitation for pairing
   * Delegates to IOMHandler for proper IoM/IoP support
   */
  ipcMain.handle('invitation:create', async (event: IpcMainInvokeEvent, mode?: 'IoM' | 'IoP'): Promise<IpcResponse> => {
    try {
      // Delegate to ConnectionHandler
      const connectionHandlers = (await import('./connection.js')).default
      return await connectionHandlers.createPairingInvitation(event, mode)
    } catch (error) {
      console.error('[DeviceHandlers] Failed to create invitation:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  })

  /**
   * Register a new device
   */
  ipcMain.handle('devices:register', async (event: IpcMainInvokeEvent, deviceInfo: DeviceInfo): Promise<IpcResponse> => {
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
        error: (error as Error).message
      }
    }
  })

  /**
   * Get all registered devices
   */
  ipcMain.handle('devices:list', async (): Promise<IpcResponse> => {
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
        error: (error as Error).message
      }
    }
  })

  /**
   * Get connected devices
   */
  ipcMain.handle('devices:connected', async (): Promise<IpcResponse> => {
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
        error: (error as Error).message
      }
    }
  })

  /**
   * Remove a device
   */
  ipcMain.handle('devices:remove', async (event: IpcMainInvokeEvent, deviceId: string): Promise<IpcResponse> => {
    try {
      const removed = await deviceManager.removeDevice(deviceId)
      return {
        success: removed
      }
    } catch (error) {
      console.error('[DeviceHandlers] Failed to remove device:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  })

  /**
   * Get device configuration
   */
  ipcMain.handle('devices:config', async (event: IpcMainInvokeEvent, deviceId: string): Promise<IpcResponse> => {
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
        error: (error as Error).message
      }
    }
  })

  /**
   * Send message to specific device
   */
  ipcMain.handle('devices:send', async (event: IpcMainInvokeEvent, { deviceId, message }: MessageToDevice): Promise<IpcResponse> => {
    try {
      const sent = deviceManager.sendToDevice(deviceId, message)
      return {
        success: sent
      }
    } catch (error) {
      console.error('[DeviceHandlers] Failed to send to device:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  })

  /**
   * Broadcast to all devices
   */
  ipcMain.handle('devices:broadcast', async (event: IpcMainInvokeEvent, message: any): Promise<IpcResponse> => {
    try {
      deviceManager.broadcastToDevices(message)
      return {
        success: true
      }
    } catch (error) {
      console.error('[DeviceHandlers] Failed to broadcast:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  })

  /**
   * Get connections model status and info
   */
  ipcMain.handle('connections:status', async (): Promise<IpcResponse> => {
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
        error: (error as Error).message
      }
    }
  })

  /**
   * Get connection info from Node.js ConnectionsModel
   */
  ipcMain.handle('connections:info', async (): Promise<IpcResponse> => {
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
        error: (error as Error).message
      }
    }
  })

  /**
   * Get instance information (combined handler for both instance:info and devices:getInstanceInfo)
   */
  const getInstanceInfo = async (): Promise<IpcResponse> => {
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
        error: (error as Error).message
      }
    }
  }

  // Register both handler names for compatibility
  ipcMain.handle('devices:getInstanceInfo', getInstanceInfo)
  ipcMain.handle('instance:info', getInstanceInfo)
}

export { initializeDeviceHandlers }