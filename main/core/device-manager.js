/**
 * Device Manager - Manages multiple device connections to the central Node.js hub
 * Each device gets its own browser instance name and IoM connection
 */

import nodeOneCore from './node-one-core.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

class DeviceManager {
  constructor() {
    this.devices = new Map() // deviceId -> device info
    this.invites = new Map() // inviteId -> invite info
    this.connections = new Map() // websocket -> device info
    this.configFile = path.join(process.cwd(), 'one-core-storage', 'devices.json')
  }

  /**
   * Initialize device manager
   */
  async initialize() {
    // Load existing device configurations
    await this.loadDevices()
    
    console.log(`[DeviceManager] Initialized with ${this.devices.size} registered devices`)
  }

  /**
   * Register a new device
   * @param {Object} deviceInfo - Device information
   * @returns {Object} Device registration with invite
   */
  async registerDevice(deviceInfo) {
    const deviceId = deviceInfo.id || crypto.randomBytes(16).toString('hex')
    
    // Generate unique browser instance name for this device
    const browserInstanceName = `${nodeOneCore.instanceName}-ui-${deviceInfo.name || deviceId.slice(0, 8)}`
    
    const device = {
      id: deviceId,
      name: deviceInfo.name || `Device ${this.devices.size + 1}`,
      browserInstanceName,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      platform: deviceInfo.platform || 'unknown',
      status: 'pending'
    }
    
    // Create invite for this device
    const invite = await this.createDeviceInvite(device)
    
    // Store device
    this.devices.set(deviceId, device)
    await this.saveDevices()
    
    console.log(`[DeviceManager] Registered new device: ${device.name} (${deviceId})`)
    
    return {
      device,
      invite
    }
  }

  /**
   * Create an IoM invite for a specific device
   */
  async createDeviceInvite(device) {
    const inviteOptions = {
      name: device.browserInstanceName,
      description: `Connection for ${device.name}`,
      permissions: ['read', 'write', 'sync'],
      deviceId: device.id
    }
    
    const invite = await nodeOneCore.createLocalInvite(inviteOptions)
    
    // Store invite mapping
    this.invites.set(invite.id, {
      deviceId: device.id,
      createdAt: new Date().toISOString(),
      ...invite
    })
    
    console.log(`[DeviceManager] Created invite for device ${device.name}: ${invite.id}`)
    
    return invite
  }

  /**
   * Handle device connection via WebSocket
   */
  handleDeviceConnection(ws, deviceId) {
    const device = this.devices.get(deviceId)
    
    if (!device) {
      console.error(`[DeviceManager] Unknown device: ${deviceId}`)
      ws.close()
      return
    }
    
    // Update device status
    device.status = 'connected'
    device.lastSeen = new Date().toISOString()
    
    // Store connection
    this.connections.set(ws, device)
    
    console.log(`[DeviceManager] Device connected: ${device.name}`)
    
    // Handle disconnection
    ws.on('close', () => {
      this.handleDeviceDisconnection(ws)
    })
  }

  /**
   * Handle device disconnection
   */
  handleDeviceDisconnection(ws) {
    const device = this.connections.get(ws)
    
    if (device) {
      device.status = 'disconnected'
      device.lastSeen = new Date().toISOString()
      this.connections.delete(ws)
      
      console.log(`[DeviceManager] Device disconnected: ${device.name}`)
      
      // Save updated status
      this.saveDevices()
    }
  }

  /**
   * Get device by ID
   */
  getDevice(deviceId) {
    return this.devices.get(deviceId)
  }

  /**
   * Get all registered devices
   */
  getAllDevices() {
    return Array.from(this.devices.values())
  }

  /**
   * Get connected devices
   */
  getConnectedDevices() {
    return Array.from(this.devices.values()).filter(d => d.status === 'connected')
  }

  /**
   * Broadcast to all connected devices
   */
  broadcastToDevices(message) {
    const messageStr = JSON.stringify(message)
    
    for (const [ws, device] of this.connections) {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(messageStr)
        console.log(`[DeviceManager] Broadcast to ${device.name}`)
      }
    }
  }

  /**
   * Send to specific device
   */
  sendToDevice(deviceId, message) {
    for (const [ws, device] of this.connections) {
      if (device.id === deviceId && ws.readyState === 1) {
        ws.send(JSON.stringify(message))
        console.log(`[DeviceManager] Sent to ${device.name}`)
        return true
      }
    }
    
    console.warn(`[DeviceManager] Device not connected: ${deviceId}`)
    return false
  }

  /**
   * Remove a device
   */
  async removeDevice(deviceId) {
    const device = this.devices.get(deviceId)
    
    if (!device) {
      return false
    }
    
    // Close any active connections
    for (const [ws, dev] of this.connections) {
      if (dev.id === deviceId) {
        ws.close()
        this.connections.delete(ws)
      }
    }
    
    // Remove device
    this.devices.delete(deviceId)
    await this.saveDevices()
    
    console.log(`[DeviceManager] Removed device: ${device.name}`)
    return true
  }

  /**
   * Load devices from storage
   */
  async loadDevices() {
    try {
      const data = await fs.readFile(this.configFile, 'utf8')
      const devices = JSON.parse(data)
      
      for (const device of devices) {
        this.devices.set(device.id, device)
      }
      
      console.log(`[DeviceManager] Loaded ${devices.length} devices`)
    } catch (error) {
      // No existing devices file
      console.log('[DeviceManager] No existing devices found')
    }
  }

  /**
   * Save devices to storage
   */
  async saveDevices() {
    try {
      const devices = Array.from(this.devices.values())
      
      // Ensure directory exists
      const dir = path.dirname(this.configFile)
      await fs.mkdir(dir, { recursive: true })
      
      await fs.writeFile(this.configFile, JSON.stringify(devices, null, 2))
      
      console.log(`[DeviceManager] Saved ${devices.length} devices`)
    } catch (error) {
      console.error('[DeviceManager] Failed to save devices:', error)
    }
  }

  /**
   * Get device-specific configuration for browser
   */
  getDeviceConfig(deviceId) {
    const device = this.devices.get(deviceId)
    
    if (!device) {
      return null
    }
    
    return {
      deviceId: device.id,
      deviceName: device.name,
      browserInstanceName: device.browserInstanceName,
      nodeInstanceName: nodeOneCore.instanceName,
      nodeEndpoint: 'ws://localhost:8765'
    }
  }
}

// Singleton
export default new DeviceManager()