/**
 * UDP IPC Service for Electron
 * Provides UDP socket functionality through Electron's main process
 */

export interface UDPSocket {
  id: string
  type: 'udp4' | 'udp6'
  address: () => { address: string; port: number; family: string }
  bind: (port?: number, address?: string) => Promise<void>
  send: (buffer: Uint8Array, port: number, address: string) => Promise<number>
  close: () => Promise<void>
  on: (event: 'message' | 'error' | 'listening' | 'close', callback: (...args: any[]) => void) => void
  off: (event: 'message' | 'error' | 'listening' | 'close', callback: (...args: any[]) => void) => void
}

export interface UDPMessage {
  data: Uint8Array
  rinfo: {
    address: string
    family: 'IPv4' | 'IPv6'
    port: number
    size: number
  }
}

class UDPSocketImpl implements UDPSocket {
  private listeners: Map<string, Set<Function>> = new Map()
  private _address: { address: string; port: number; family: string } = {
    address: '',
    port: 0,
    family: 'IPv4'
  }
  
  constructor(
    public readonly id: string,
    public readonly type: 'udp4' | 'udp6'
  ) {
    // Listen for IPC messages from main process
    if (window.electronAPI) {
      window.electronAPI.onUDPMessage((socketId: string, event: string, ...args: any[]) => {
        if (socketId === this.id) {
          this.emit(event, ...args)
        }
      })
    }
  }
  
  address() {
    return this._address
  }
  
  async bind(port: number = 0, address?: string): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available')
    }
    
    const result = await window.electronAPI.udpBind(this.id, port, address)
    this._address = result
    this.emit('listening')
  }
  
  async send(buffer: Uint8Array, port: number, address: string): Promise<number> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available')
    }
    
    // Convert Uint8Array to array for IPC transfer
    const data = Array.from(buffer)
    return await window.electronAPI.udpSend(this.id, data, port, address)
  }
  
  async close(): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available')
    }
    
    await window.electronAPI.udpClose(this.id)
    this.emit('close')
    this.listeners.clear()
  }
  
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }
  
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback)
    }
  }
  
  private emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args)
        } catch (error) {
          console.error(`[UDP] Error in event handler for ${event}:`, error)
        }
      })
    }
  }
}

/**
 * UDP IPC Service
 */
export class UDPService {
  private sockets: Map<string, UDPSocket> = new Map()
  private socketCounter = 0
  
  /**
   * Create a new UDP socket
   */
  async createSocket(options: { type: 'udp4' | 'udp6' }): Promise<UDPSocket> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available')
    }
    
    const id = `socket-${++this.socketCounter}`
    const socket = new UDPSocketImpl(id, options.type)
    
    // Request socket creation in main process
    await window.electronAPI.udpCreate(id, options.type)
    
    this.sockets.set(id, socket)
    return socket
  }
  
  /**
   * Get socket by ID
   */
  getSocket(id: string): UDPSocket | undefined {
    return this.sockets.get(id)
  }
  
  /**
   * Close all sockets
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.sockets.values()).map(socket => socket.close())
    await Promise.all(closePromises)
    this.sockets.clear()
  }
}

// Export singleton instance
export const udpService = new UDPService()