/**
 * QuicVC Discovery - Local network discovery using UDP broadcast
 *
 * Implements discovery for QuicVC devices (ESP32, other lama instances)
 * using UDP broadcast on port 49497 (QuicVC discovery port).
 *
 * Based on QuicVC protocol discovery patterns with HEARTBEAT frames.
 */

import dgram from 'dgram';
import { EventEmitter } from 'events';
import type { LocalDiscoveryProvider, LocalPeerInfo } from '@lama/connection.core';

/**
 * QuicVC discovery frame type (from QuicVC spec)
 */
const QUICVC_FRAME_DISCOVERY = 0x30;
const QUICVC_FRAME_HEARTBEAT = 0x20;

/**
 * QuicVC discovery configuration (from QuicVC spec)
 */
const QUICVC_DISCOVERY_PORT = 49497; // Unified service port
const QUICVC_PORT = 49498; // QuicVC connection port
const DISCOVERY_INTERVAL = 5000; // 5 seconds
const PEER_EXPIRATION = 60000; // 60 seconds (matches QuicVC idle timeout)

export interface QuicVCDevice {
  id: string;
  name: string;
  type: string;
  address: string;
  port: number;
  capabilities: string[];
  credential?: any;
  mac?: string;
  lastSeen: number;
  discoveredAt: number;
}

export class QuicVCDiscovery extends EventEmitter implements LocalDiscoveryProvider {
  private socket: dgram.Socket | null = null;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private expirationInterval: NodeJS.Timeout | null = null;
  private discoveredDevices: Map<string, QuicVCDevice> = new Map();
  private ownDeviceId: string;
  private ownDeviceName: string;
  private peerDiscoveredCallbacks: ((peer: LocalPeerInfo) => void)[] = [];
  private peerLostCallbacks: ((peerId: string) => void)[] = [];

  constructor(ownDeviceId: string, ownDeviceName: string) {
    super();
    this.ownDeviceId = ownDeviceId;
    this.ownDeviceName = ownDeviceName;
  }

  /**
   * Initialize UDP discovery
   */
  async initialize(): Promise<void> {
    console.log('[QuicVCDiscovery] Initializing on port', QUICVC_DISCOVERY_PORT);

    // Create UDP socket for discovery
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    // Setup socket event handlers
    this.socket.on('message', (msg, rinfo) => {
      console.log('[QuicVCDiscovery] 📡 Received UDP packet:', msg.length, 'bytes from', rinfo.address + ':' + rinfo.port);

      // Log full packet for debugging
      console.log('[QuicVCDiscovery] Full hex:', msg.toString('hex'));
      console.log('[QuicVCDiscovery] Full ascii:', msg.toString('ascii'));

      void this.handleDiscoveryMessage(msg, rinfo);
    });

    this.socket.on('error', (err) => {
      console.error('[QuicVCDiscovery] Socket error:', err);
    });

    // Bind to discovery port
    await new Promise<void>((resolve, reject) => {
      this.socket!.bind(QUICVC_DISCOVERY_PORT, () => {
        try {
          this.socket!.setBroadcast(true);
          console.log('[QuicVCDiscovery] Bound to port', QUICVC_DISCOVERY_PORT);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    // Start peer expiration checker
    this.startExpirationChecker();

    console.log('[QuicVCDiscovery] Initialized successfully');
  }

  /**
   * Start listening for discovery broadcasts
   */
  async startListening(): Promise<void> {
    if (!this.socket) {
      throw new Error('Discovery not initialized');
    }

    console.log('[QuicVCDiscovery] Started listening for devices');

    // Start broadcasting our own presence
    this.startBroadcasting();
  }

  /**
   * Stop listening for discovery broadcasts
   */
  stopListening(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    console.log('[QuicVCDiscovery] Stopped listening');
  }

  /**
   * Perform one-time discovery scan
   */
  async scan(timeout: number): Promise<LocalPeerInfo[]> {
    // Send discovery broadcast
    await this.sendDiscoveryBroadcast();

    // Wait for responses
    await new Promise((resolve) => setTimeout(resolve, timeout));

    // Convert discovered devices to LocalPeerInfo
    return Array.from(this.discoveredDevices.values()).map((device) =>
      this.convertToLocalPeerInfo(device)
    );
  }

  /**
   * Register callback for peer discovered
   */
  onPeerDiscovered(callback: (peer: LocalPeerInfo) => void): void {
    this.peerDiscoveredCallbacks.push(callback);
  }

  /**
   * Register callback for peer lost
   */
  onPeerLost(callback: (peerId: string) => void): void {
    this.peerLostCallbacks.push(callback);
  }

  /**
   * Shutdown discovery
   */
  async shutdown(): Promise<void> {
    this.stopListening();

    if (this.expirationInterval) {
      clearInterval(this.expirationInterval);
      this.expirationInterval = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.discoveredDevices.clear();
    console.log('[QuicVCDiscovery] Shutdown complete');
  }

  /**
   * Start broadcasting discovery announcements
   */
  private startBroadcasting(): void {
    // Send initial broadcast immediately
    void this.sendDiscoveryBroadcast();

    // Then send periodically
    this.broadcastInterval = setInterval(() => {
      void this.sendDiscoveryBroadcast();
    }, DISCOVERY_INTERVAL);
  }

  /**
   * Send discovery broadcast
   */
  private async sendDiscoveryBroadcast(): Promise<void> {
    if (!this.socket) return;

    // Create discovery announcement (simple JSON for now)
    const announcement = {
      type: 'discovery',
      deviceId: this.ownDeviceId,
      deviceName: this.ownDeviceName,
      timestamp: Date.now(),
      capabilities: ['quicvc', 'websocket'],
      port: QUICVC_PORT,
    };

    const message = Buffer.from(JSON.stringify(announcement));

    // Broadcast on local network
    try {
      console.log('[QuicVCDiscovery] 📤 Sending discovery broadcast:', message.length, 'bytes');
      this.socket.send(message, QUICVC_DISCOVERY_PORT, '255.255.255.255', (err) => {
        if (err) {
          console.error('[QuicVCDiscovery] Broadcast error:', err);
        } else {
          console.log('[QuicVCDiscovery] ✅ Broadcast sent successfully');
        }
      });
    } catch (error) {
      console.error('[QuicVCDiscovery] Failed to send broadcast:', error);
    }
  }

  /**
   * Handle incoming discovery message
   */
  private async handleDiscoveryMessage(
    msg: Buffer,
    rinfo: dgram.RemoteInfo
  ): Promise<void> {
    try {
      // Try to parse as JSON (simple format)
      let data: any;
      try {
        data = JSON.parse(msg.toString());
      } catch {
        // Not JSON - try ESP32 HTML microdata format
        if (msg.length > 10 && msg[0] === 0xc0) {
          console.log('[QuicVCDiscovery] Parsing ESP32 HTML microdata packet');
          data = this.parseESP32Packet(msg);
          if (!data) {
            console.log('[QuicVCDiscovery] Failed to parse ESP32 packet');
            return;
          }
        } else if (msg.length >= 3) {
          // Check if it's a QuicVC HEARTBEAT or DISCOVERY frame
          const frameType = msg[0];
          if (frameType === QUICVC_FRAME_HEARTBEAT || frameType === QUICVC_FRAME_DISCOVERY) {
            console.log('[QuicVCDiscovery] Received QuicVC frame type', frameType.toString(16), 'from', rinfo.address);
            data = this.parseQuicVCFrame(msg);
          } else {
            return; // Unknown format
          }
        } else {
          return; // Too short
        }
      }

      // Ignore our own broadcasts
      if (data.deviceId === this.ownDeviceId) {
        return;
      }

      // Extract device info
      const deviceId = data.deviceId || data.device_id || data.id || `unknown-${rinfo.address}`;
      const deviceName = data.deviceName || data.device_name || data.name || deviceId;
      const deviceType = data.deviceType || data.type || 'unknown';

      const device: QuicVCDevice = {
        id: deviceId,
        name: deviceName,
        type: deviceType,
        address: rinfo.address,
        port: data.port || QUICVC_PORT,
        capabilities: data.capabilities || ['quicvc'],
        mac: data.mac,
        lastSeen: Date.now(),
        discoveredAt: this.discoveredDevices.get(deviceId)?.discoveredAt || Date.now(),
      };

      // Check if this is a new device
      const isNew = !this.discoveredDevices.has(deviceId);

      // Update or add device
      this.discoveredDevices.set(deviceId, device);

      if (isNew) {
        console.log('[QuicVCDiscovery] 🎉 Discovered new device:', deviceName, 'at', rinfo.address);

        // Emit to callbacks
        const peerInfo = this.convertToLocalPeerInfo(device);
        this.peerDiscoveredCallbacks.forEach((callback) => callback(peerInfo));

        // Emit event
        this.emit('peerDiscovered', peerInfo);
      } else {
        // Update last seen for existing device
        console.log('[QuicVCDiscovery] Updated device:', deviceName);
      }
    } catch (error) {
      console.error('[QuicVCDiscovery] Error handling discovery message:', error);
    }
  }

  /**
   * Parse ESP32 HTML microdata packet
   * Format: 0xC0 [version] [length] [random] [markers] [HTML]
   */
  private parseESP32Packet(data: Buffer): any {
    try {
      // Find the HTML start (<!DOCTYPE or <html)
      const htmlStart = data.indexOf('<!DOCTYPE');
      if (htmlStart === -1) {
        return null;
      }

      // Extract HTML
      const html = data.slice(htmlStart).toString('utf-8');

      // Parse microdata attributes
      const idMatch = html.match(/itemprop="id"\s+content="([^"]+)"/);
      const typeMatch = html.match(/itemprop="type"\s+content="([^"]+)"/);
      const statusMatch = html.match(/itemprop="status"\s+content="([^"]+)"/);
      const ownershipMatch = html.match(/itemprop="ownership"\s+content="([^"]+)"/);

      if (!idMatch) {
        return null;
      }

      return {
        id: idMatch[1],
        deviceId: idMatch[1],
        name: idMatch[1],
        type: typeMatch ? typeMatch[1] : 'ESP32',
        status: statusMatch ? statusMatch[1] : 'unknown',
        ownership: ownershipMatch ? ownershipMatch[1] : 'unknown',
        capabilities: ['quicvc'],
      };
    } catch (error) {
      console.error('[QuicVCDiscovery] Error parsing ESP32 packet:', error);
      return null;
    }
  }

  /**
   * Parse QuicVC binary frame (simplified)
   */
  private parseQuicVCFrame(data: Buffer): any {
    const frameType = data[0];
    const length = (data[1] << 8) | data[2];

    if (data.length < 3 + length) {
      return {}; // Invalid frame
    }

    const payload = data.slice(3, 3 + length);

    // Try to parse payload as JSON
    try {
      return JSON.parse(payload.toString());
    } catch {
      // Binary payload - extract what we can
      return {
        frameType,
        deviceId: `quicvc-${data.slice(3, 9).toString('hex')}`,
      };
    }
  }

  /**
   * Start peer expiration checker
   */
  private startExpirationChecker(): void {
    this.expirationInterval = setInterval(() => {
      const now = Date.now();
      const expiredDevices: string[] = [];

      for (const [deviceId, device] of this.discoveredDevices) {
        if (now - device.lastSeen > PEER_EXPIRATION) {
          expiredDevices.push(deviceId);
        }
      }

      for (const deviceId of expiredDevices) {
        console.log('[QuicVCDiscovery] Device expired:', deviceId);
        this.discoveredDevices.delete(deviceId);

        // Emit to callbacks
        this.peerLostCallbacks.forEach((callback) => callback(deviceId));

        // Emit event
        this.emit('peerLost', deviceId);
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Convert QuicVCDevice to LocalPeerInfo
   */
  private convertToLocalPeerInfo(device: QuicVCDevice): LocalPeerInfo {
    return {
      id: device.id,
      name: device.name,
      address: `${device.address}:${device.port}`,
      capabilities: device.capabilities,
      discoveredAt: device.discoveredAt,
      lastSeenAt: device.lastSeen,
    };
  }

  /**
   * Get all discovered devices
   */
  getDiscoveredDevices(): QuicVCDevice[] {
    return Array.from(this.discoveredDevices.values());
  }
}
