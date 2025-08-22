/**
 * CommServer Transport - Wrapper around ConnectionsModel for WebSocket relay
 * Provides P2P connectivity through CommServer relay
 */

import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js'
import type Connection from '@refinio/one.models/lib/misc/Connection/Connection'
import ConnectionsModel from '@refinio/one.models/lib/models/ConnectionsModel.js'
import GroupModel from '@refinio/one.models/lib/models/Leute/GroupModel'
import type LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js'
import { TransportType, type ITransport, type ConnectionTarget } from '../TransportManager'

export enum TransportStatus {
  UNINITIALIZED = 'UNINITIALIZED',
  INITIALIZING = 'INITIALIZING', 
  READY = 'READY',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR'
}

export interface CommServerTransportConfig {
  type: TransportType
  options: {
    commServerUrl: string
    reconnectInterval?: number
    maxReconnectAttempts?: number
    connectionTimeout?: number
  }
}

export class CommServerManager implements ITransport {
  public readonly type = TransportType.COMM_SERVER
  public status: TransportStatus = TransportStatus.UNINITIALIZED
  public readonly config: CommServerTransportConfig

  public onConnectionEstablished: OEvent<(connection: Connection) => void> = new OEvent()
  public onConnectionClosed: OEvent<(connectionId: string, reason?: string) => void> = new OEvent()
  public onMessageReceived: OEvent<(connectionId: string, message: any) => void> = new OEvent()
  public onError: OEvent<(error: any) => void> = new OEvent()
  public onStatusChanged: OEvent<(status: TransportStatus) => void> = new OEvent()
  
  private connectionsModel!: InstanceType<typeof ConnectionsModel>

  constructor(
    private leuteModel: InstanceType<typeof LeuteModel>,
    config: CommServerTransportConfig
  ) {
    this.config = config
  }

  async init(): Promise<void> {
    if (this.status !== TransportStatus.UNINITIALIZED) {
      console.warn(`[CommServerManager] Already initialized. Status: ${this.status}`)
      return
    }

    console.log('[CommServerManager] Initializing CommServer transport...')
    this.setStatus(TransportStatus.INITIALIZING)

    try {
      const commServerUrl = this.config.options.commServerUrl
      if (!commServerUrl) {
        throw new Error('CommServer URL not configured')
      }

      // Create ConnectionsModel for WebSocket relay
      this.connectionsModel = new ConnectionsModel(this.leuteModel, {
          commServerUrl,
          acceptIncomingConnections: true,
          acceptUnknownInstances: true,
          acceptUnknownPersons: false,
          allowPairing: true,
          allowDebugRequests: true,
          pairingTokenExpirationDuration: 60000 * 15, // 15 minutes
          establishOutgoingConnections: true
      })

      // Initialize the ConnectionsModel (required for pairing to work)
      await this.connectionsModel.init()
      console.log('[CommServerManager] ConnectionsModel initialized')

      // Set up event forwarding
      this.connectionsModel.onConnectionsChange.listen(() => {
        // Forward connection events
      })

      this.connectionsModel.onOnlineStateChange.listen((isOnline: boolean) => {
        this.setStatus(isOnline ? TransportStatus.CONNECTED : TransportStatus.DISCONNECTED)
      })

      this.setStatus(TransportStatus.READY)
      console.log('[CommServerManager] CommServer transport initialized')
    } catch (error) {
      console.error('[CommServerManager] Initialization failed', error)
      this.setStatus(TransportStatus.ERROR)
      this.onError.emit(error)
      throw error
    }
  }

  async startNetworking(): Promise<void> {
    if (!this.connectionsModel) {
      throw new Error('ConnectionsModel not initialized')
    }

    console.log('[CommServerManager] Starting networking...')
    // ConnectionsModel is already initialized in init(), no need to initialize again
    console.log('[CommServerManager] Networking started')
  }

  isAvailable(): boolean {
    return this.status === TransportStatus.READY || 
           this.status === TransportStatus.CONNECTED
  }

  async connect(target: ConnectionTarget): Promise<Connection> {
    if (!this.connectionsModel) {
      throw new Error('ConnectionsModel not initialized')
    }

    if (target.pairingToken) {
      // Handle pairing with invitation
      const pairing = this.connectionsModel.pairing
      if (!pairing) {
        throw new Error('Pairing manager not available')
      }
      
      // Parse pairing URL and establish connection
      const invitation = await pairing.parseInvitationUrl(target.pairingToken)
      return await pairing.acceptInvitation(invitation)
    } else if (target.personId && target.instanceId) {
      // Direct connection to known device
      return await this.connectionsModel.establishConnection(
        target.personId as any,
        target.instanceId as any
      )
    } else {
      throw new Error('Invalid connection target')
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    if (!this.connectionsModel) {
      throw new Error('ConnectionsModel not initialized')
    }

    // Find and close the connection
    const connections = this.connectionsModel.connectionsInfo()
    const connection = connections.find(c => c.id === connectionId)
    if (connection) {
      await connection.close()
    }
  }

  async shutdown(): Promise<void> {
    console.log('[CommServerManager] Shutting down...')
    
    if (this.connectionsModel) {
      await this.connectionsModel.shutdown()
    }
    
    this.setStatus(TransportStatus.UNINITIALIZED)
    console.log('[CommServerManager] Shutdown complete')
  }

  private setStatus(status: TransportStatus): void {
    this.status = status
    this.onStatusChanged.emit(status)
  }

  // ConnectionsModel access
  getConnectionsModel(): InstanceType<typeof ConnectionsModel> {
    return this.connectionsModel
  }

  getPairingManager(): any {
    return this.connectionsModel?.pairing
  }

  async createInvitation(): Promise<string> {
    if (!this.connectionsModel?.pairing) {
      throw new Error('Pairing manager not available')
    }
    
    const invitation = await this.connectionsModel.pairing.createInvitation()
    return invitation.url
  }

  isOnline(): boolean {
    return this.status === TransportStatus.CONNECTED
  }

  async waitForConnection(timeout: number = 30000): Promise<void> {
    if (this.isOnline()) return
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, timeout)
      
      const listener = this.onStatusChanged.listen((status) => {
        if (status === TransportStatus.CONNECTED) {
          clearTimeout(timer)
          listener.disconnect()
          resolve()
        }
      })
    })
  }
}