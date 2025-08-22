/**
 * TransportManager - Container for multiple transport types
 * Manages CommServerManager for WebSocket relay connections
 */

import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js'
import type Connection from '@refinio/one.models/lib/misc/Connection/Connection'
import type ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js'
import type LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js'
import { CommServerManager } from './transports/CommServerManager'

export enum TransportType {
  COMM_SERVER = 'COMM_SERVER',
  QUIC = 'QUIC',
  UDP_DIRECT = 'UDP_DIRECT',
  BLE = 'BLE'
}

export interface ConnectionTarget {
  personId?: string
  instanceId?: string
  endpoint?: string
  pairingToken?: string
}

export interface TransportPreferences {
  preferred: TransportType[]
  fallback: TransportType[]
  timeout?: number
  retryAttempts?: number
}

export interface ITransport {
  type: TransportType
  isAvailable(): boolean
  connect(target: ConnectionTarget): Promise<Connection>
  disconnect(connectionId: string): Promise<void>
  shutdown(): Promise<void>
  onConnectionEstablished?: OEvent<(connection: Connection) => void>
  onConnectionClosed?: OEvent<(connectionId: string, reason?: string) => void>
}

export class TransportManager {
  private static instance: TransportManager | null = null
  private transports: Map<TransportType, ITransport> = new Map()
  private commServerManager!: CommServerManager

  // Events
  public readonly onTransportRegistered = new OEvent<(transport: ITransport) => void>()
  public readonly onTransportUnregistered = new OEvent<(type: TransportType) => void>()
  public readonly onConnectionEstablished = new OEvent<(connection: Connection, transport: TransportType) => void>()
  public readonly onConnectionClosed = new OEvent<(connectionId: string, transport: TransportType, reason?: string) => void>()
  public readonly onTransportSelected = new OEvent<(type: TransportType, target: ConnectionTarget) => void>()

  constructor(
    private leuteModel: InstanceType<typeof LeuteModel>,
    channelManager: InstanceType<typeof ChannelManager>,
    public readonly commServerUrl: string
  ) {
    console.log('[TransportManager] Creating transport manager...')
    
    // Create CommServerManager with proper config
    this.commServerManager = new CommServerManager(
      this.leuteModel,
      {
        type: TransportType.COMM_SERVER,
        options: {
          commServerUrl: this.commServerUrl,
          reconnectInterval: 5000,
          maxReconnectAttempts: 10,
          connectionTimeout: 30000
        }
      }
    )
    
    console.log('[TransportManager] Transport manager created')
  }

  async init(): Promise<void> {
    console.log('[TransportManager] Initializing...')
    
    try {
      // Initialize CommServerManager
      await this.commServerManager.init()
      
      // Register it as a transport
      this.registerTransport(this.commServerManager)
      
      console.log('[TransportManager] Initialized successfully')
    } catch (error) {
      console.error('[TransportManager] Initialization failed', error)
      throw error
    }
  }

  async startNetworking(): Promise<void> {
    console.log('[TransportManager] Starting networking layer...')
    try {
      if (this.commServerManager) {
        await this.commServerManager.startNetworking()
        console.log('[TransportManager] CommServerManager networking started')
      } else {
        console.warn('[TransportManager] CommServerManager not available')
      }
    } catch (error) {
      console.error('[TransportManager] Failed to start networking', error)
      throw error
    }
  }

  registerTransport(transport: ITransport): void {
    if (this.transports.has(transport.type)) {
      console.warn(`[TransportManager] Transport ${transport.type} already registered`)
    }
    
    console.log(`[TransportManager] Registering transport: ${transport.type}`)
    this.transports.set(transport.type, transport)
    
    // Set up event forwarding
    if (transport.onConnectionEstablished) {
      transport.onConnectionEstablished.listen((connection: any) => {
        this.onConnectionEstablished.emit(connection, transport.type)
      })
    }
    
    if (transport.onConnectionClosed) {
      transport.onConnectionClosed.listen((connectionId: string, reason?: string) => {
        this.onConnectionClosed.emit(connectionId, transport.type, reason)
      })
    }
    
    this.onTransportRegistered.emit(transport)
    console.log(`[TransportManager] Transport registered: ${transport.type}`)
  }

  unregisterTransport(type: TransportType): void {
    const transport = this.transports.get(type)
    if (transport) {
      this.transports.delete(type)
      this.onTransportUnregistered.emit(type)
      console.log(`[TransportManager] Transport unregistered: ${type}`)
    }
  }

  getTransports(): Map<TransportType, ITransport> {
    return new Map(this.transports)
  }

  getTransport(type: TransportType): ITransport | undefined {
    return this.transports.get(type)
  }

  async shutdownAllTransports(): Promise<void> {
    console.log('[TransportManager] Shutting down all transports...')
    
    for (const [type, transport] of Array.from(this.transports)) {
      try {
        console.log(`[TransportManager] Shutting down transport: ${type}`)
        await transport.shutdown()
      } catch (error) {
        console.error(`[TransportManager] Error shutting down transport ${type}:`, error)
      }
    }
    
    this.transports.clear()
    console.log('[TransportManager] All transports shut down')
  }

  async connectToDevice(target: ConnectionTarget, preferences?: TransportPreferences): Promise<Connection> {
    // Use CommServer transport by default
    const transport = this.getTransport(TransportType.COMM_SERVER)
    if (!transport) {
      throw new Error('No CommServer transport available')
    }
    
    this.onTransportSelected.emit(TransportType.COMM_SERVER, target)
    return transport.connect(target)
  }

  async connectViaTransport(type: TransportType, target: ConnectionTarget): Promise<Connection> {
    const transport = this.getTransport(type)
    if (!transport) {
      throw new Error(`Transport ${type} not available`)
    }
    
    this.onTransportSelected.emit(type, target)
    return transport.connect(target)
  }

  setTransportPreferences(preferences: TransportPreferences): void {
    // Store preferences for future use
  }

  getTransportPreferences(): TransportPreferences {
    return {
      preferred: [TransportType.COMM_SERVER],
      fallback: [],
      timeout: 30000,
      retryAttempts: 3
    }
  }

  async getConnectionQualities(): Promise<Map<string, any>> {
    return new Map()
  }

  // Convenience methods
  getCommServerManager(): CommServerManager {
    return this.commServerManager
  }

  getConnectionsModel(): any {
    if (!this.commServerManager) {
      throw new Error('CommServerManager not initialized')
    }
    return this.commServerManager.getConnectionsModel()
  }

  async getActiveConnections(): Promise<any[]> {
    try {
      const cm = this.getConnectionsModel()
      if (cm && typeof cm.connectionsInfo === 'function') {
        return cm.connectionsInfo()
      }
    } catch (err) {
      console.warn('[TransportManager] Failed to retrieve connections info', err)
    }
    return []
  }

  static getInstance(): TransportManager | null {
    return TransportManager.instance
  }

  static setInstance(instance: TransportManager): void {
    TransportManager.instance = instance
  }
}