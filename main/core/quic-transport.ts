import type { ConnectionsModel } from '@refinio/one.models/lib/models/index.js';
/**
 * QUIC Transport Layer
 *
 * This transport uses QUIC-VC (QUIC with Verifiable Credentials) for device communication
 * and regular QUIC for CHUM protocol peer-to-peer connections
 *
 * Architecture:
 * - For IoT devices (ESP32): Uses QuicVCConnectionManager with VC-based authentication
 * - For CHUM peers: Regular QUIC transport (future implementation)
 * - Transport is pluggable - CHUM doesn't care if it's QUIC or WebSocket
 */

import { EventEmitter } from 'events'
import dgram from 'dgram'
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js'
import type { Person } from '@refinio/one.core/lib/recipes.js'
import {
  QuicVCConnectionManager,
  type DeviceIdentityCredential,
  type VCManager,
  type VerifiedVCInfo
} from './quicvc-connection-manager.js'

interface NodeOneCore {
  ownPersonId?: SHA256IdHash<Person>
  connectionsModel?: any
}

interface ConnectionInterface {
  send(data: Uint8Array): Promise<void>
  close(): void
  on(event: string, handler: (...args: any[]) => void): void
}

interface TransportConfig {
  connect(address: string, port: number): Promise<ConnectionInterface>
  listen(port: number): Promise<void>
}

interface RInfo {
  address: string
  port: number
  family: string
  size: number
}

export default class QuicTransport extends EventEmitter {
  public nodeOneCore: NodeOneCore
  public connections: Map<string, any> = new Map() // peerId -> connection
  public socket: dgram.Socket | null = null
  public quicvcManager: QuicVCConnectionManager | null = null
  public trustManager: any = null // Trust manager for peer verification
  public peers: Map<string, any> = new Map() // peerId -> peer info
  public leuteModel: any = null // Reference to LeuteModel
  public type: string = 'quic'
  public connectionRouteManager: any = null

  constructor(nodeOneCore: NodeOneCore) {
    super()
    this.nodeOneCore = nodeOneCore
  }

  /**
   * Initialize the transport
   * Creates UDP socket and QuicVC manager
   */
  async initialize(): Promise<void> {
    // Create UDP socket for QUIC communication
    this.socket = dgram.createSocket('udp4')

    this.socket.on('error', (err: Error) => {
      console.error('[QuicTransport] Socket error:', err)
      this.emit('error', err)
    })

    this.socket.on('message', (msg: Buffer, rinfo: RInfo) => {
      // Forward to QuicVC manager or regular QUIC handler
      this.handleMessage(msg, rinfo)
    })

    // Initialize QuicVC manager if we have person ID
    if (this.nodeOneCore.ownPersonId) {
      this.quicvcManager = QuicVCConnectionManager.getInstance(this.nodeOneCore.ownPersonId)

      // Create a transport interface for QuicVC manager
      const transport = {
        send: async (data: Uint8Array, address: string, port: number): Promise<void> => {
          return new Promise((resolve, reject) => {
            if (!this.socket) {
              reject(new Error('Socket not initialized'))
              return
            }
            this.socket.send(data, port, address, (err?: Error | null) => {
              if (err) reject(err)
              else resolve()
            })
          })
        },
        on: (event: string, handler: (data: Uint8Array, rinfo: any) => void) => {
          if (event === 'message') {
            // QuicVC manager will receive messages via handleMessage
          }
        }
      }

      // Initialize QuicVC manager with transport
      await this.quicvcManager.initialize(transport, null, undefined)

      // Set up event forwarding from QuicVC manager
      this.quicvcManager.on('connectionEstablished', (deviceId: string, vcInfo: VerifiedVCInfo) => {
        this.emit('deviceConnected', { deviceId, vcInfo })
      })

      this.quicvcManager.on('connectionClosed', (deviceId: string, reason: string) => {
        this.emit('deviceDisconnected', { deviceId, reason })
      })

      this.quicvcManager.on('ledResponse', (deviceId: string, response: any) => {
        this.emit('ledResponse', { deviceId, response })
      })

      this.quicvcManager.on('deviceProvisioned', (info: { deviceId: string; ownerId: string }) => {
        this.emit('deviceProvisioned', info)
      })
    }

    console.log('[QuicTransport] Initialized with QUIC-VC support')
  }

  /**
   * Handle incoming UDP messages
   */
  private handleMessage(msg: Buffer, rinfo: RInfo): void {
    // Check if this is a QUIC-VC packet (check packet type in first byte)
    if (msg.length > 0) {
      const flags = msg[0]
      const isLongHeader = (flags & 0x80) !== 0

      if (isLongHeader) {
        // This looks like a QUIC-VC packet, forward to manager
        if (this.quicvcManager) {
          this.quicvcManager.handleQuicVCPacket(msg, rinfo)
        }
      } else {
        // Regular QUIC packet for CHUM protocol (future implementation)
        // For now, just log it
        console.log(`[QuicTransport] Received non-QUIC-VC packet from ${rinfo.address}:${rinfo.port}`)
      }
    }
  }

  /**
   * Start QUIC server
   */
  async listen(port: number = 8766): Promise<void> {
    console.log(`[QuicTransport] Starting QUIC server on port ${port}`)

    if (!this.socket) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'))
        return
      }

      this.socket.bind(port, () => {
        console.log(`[QuicTransport] Listening on UDP port ${port}`)
        resolve()
      })
    })
  }

  /**
   * Connect to a device using QUIC-VC
   */
  async connectToDevice(deviceId: string, address: string, port: number, credential: DeviceIdentityCredential): Promise<void> {
    if (!this.quicvcManager) {
      throw new Error('QuicVC manager not initialized')
    }

    console.log(`[QuicTransport] Connecting to device ${deviceId} at ${address}:${port}`)
    await this.quicvcManager.connect(deviceId, address, port, credential)
  }

  /**
   * Send data to a device using QUIC-VC
   */
  async sendToDevice(deviceId: string, data: Uint8Array): Promise<void> {
    if (!this.quicvcManager) {
      throw new Error('QuicVC manager not initialized')
    }

    await this.quicvcManager.sendData(deviceId, data)
  }

  /**
   * Send a protected frame to a device
   */
  async sendProtectedFrame(deviceId: string, frameData: Uint8Array): Promise<void> {
    if (!this.quicvcManager) {
      throw new Error('QuicVC manager not initialized')
    }

    await this.quicvcManager.sendProtectedFrame(deviceId, frameData)
  }

  /**
   * Check if connected to a device
   */
  isConnectedToDevice(deviceId: string): boolean {
    if (!this.quicvcManager) return false
    return this.quicvcManager.isConnected(deviceId)
  }

  /**
   * Disconnect from a device
   */
  disconnectFromDevice(deviceId: string): void {
    if (!this.quicvcManager) return
    this.quicvcManager.disconnect(deviceId)
  }

  /**
   * Connect to a peer via QUIC (for CHUM protocol)
   */
  async connect(address: string, port: number): Promise<ConnectionInterface> {
    console.log(`[QuicTransport] Connecting to ${address}:${port}`)
    // TODO: Implement regular QUIC client for CHUM protocol

    // This would return a transport interface that ConnectionsModel can use
    return {
      send: async (data: Uint8Array): Promise<void> => {
        // Send raw bytes over QUIC
      },
      close: (): void => {
        // Close QUIC stream
      },
      on: (event: string, handler: (...args: any[]) => void): void => {
        // Handle transport events (data, error, close)
      }
    }
  }

  /**
   * Register this transport with ConnectionsModel
   * ConnectionsModel will use this for CHUM protocol
   */
  registerWithConnectionsModel(): void {
    if (!this.nodeOneCore.connectionsModel) {
      console.warn('[QuicTransport] ConnectionsModel not available yet')
      return
    }

    // Register as a transport option
    // ConnectionsModel handles CHUM, we just move bytes
    const transportConfig: TransportConfig = {
      connect: this.connect.bind(this),
      listen: this.listen.bind(this)
    }

    this.nodeOneCore.connectionsModel.registerTransport('quic', transportConfig)

    console.log('[QuicTransport] Registered as transport for ConnectionsModel')
  }

  /**
   * Close the transport
   */
  close(): void {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }
}