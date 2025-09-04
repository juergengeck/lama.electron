/**
 * Local Relay Client
 * Manages the browser instance's connection to the LocalCommRelay
 * and handles topic/contact syncing
 */

export class LocalRelayClient {
  private ws: WebSocket | null = null
  private connected: boolean = false
  private reconnectTimer: any = null
  private browserInstance: any = null
  
  constructor() {
    console.log('[LocalRelayClient] Initialized')
  }
  
  /**
   * Connect to the local relay server
   */
  async connect(browserInstance: any): Promise<void> {
    this.browserInstance = browserInstance
    
    return new Promise((resolve, reject) => {
      try {
        console.log('[LocalRelayClient] Connecting to local relay at ws://localhost:8765')
        
        this.ws = new WebSocket('ws://localhost:8765')
        
        this.ws.onopen = () => {
          console.log('[LocalRelayClient] Connected to local relay')
          this.connected = true
          
          // Identify as browser instance
          this.send({
            type: 'identify',
            source: 'browser',
            instance: {
              leuteModel: browserInstance.leuteModel,
              topicModel: browserInstance.topicModel,
              channelManager: browserInstance.channelManager
            }
          })
          
          resolve()
        }
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('[LocalRelayClient] Error parsing message:', error)
          }
        }
        
        this.ws.onerror = (error) => {
          console.error('[LocalRelayClient] WebSocket error:', error)
          this.connected = false
          reject(error)
        }
        
        this.ws.onclose = () => {
          console.log('[LocalRelayClient] Disconnected from local relay')
          this.connected = false
          this.scheduleReconnect()
        }
        
      } catch (error) {
        console.error('[LocalRelayClient] Failed to connect:', error)
        reject(error)
      }
    })
  }
  
  /**
   * Send a message to the relay
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('[LocalRelayClient] Cannot send message, not connected')
    }
  }
  
  /**
   * Handle incoming messages from the relay
   */
  private handleMessage(message: any): void {
    console.log('[LocalRelayClient] Received message:', message.type)
    
    switch (message.type) {
      case 'hello':
        console.log('[LocalRelayClient] Relay handshake:', message)
        break
        
      case 'instances-connected':
        console.log('[LocalRelayClient] 🎉 Both instances connected!')
        this.onInstancesConnected()
        break
        
      case 'waiting':
        console.log('[LocalRelayClient] Waiting for Node instance...')
        break
        
      case 'iom-connected':
        console.log('[LocalRelayClient] IoM connection established')
        break
        
      default:
        // Forward other messages to CHUM handler if available
        if (this.browserInstance?.handleChumMessage) {
          this.browserInstance.handleChumMessage(message)
        }
    }
  }
  
  /**
   * Called when both instances are connected
   */
  private async onInstancesConnected(): Promise<void> {
    console.log('[LocalRelayClient] Triggering instance sync...')
    
    // The sync will be handled by the relay's InstanceSyncManager
    // We just need to make sure our models are ready
    
    if (this.browserInstance) {
      // Notify that we're ready for syncing
      this.send({
        type: 'sync-ready',
        source: 'browser'
      })
    }
  }
  
  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    
    this.reconnectTimer = setTimeout(() => {
      console.log('[LocalRelayClient] Attempting to reconnect...')
      if (this.browserInstance) {
        this.connect(this.browserInstance).catch(error => {
          console.error('[LocalRelayClient] Reconnection failed:', error)
        })
      }
    }, 5000)
  }
  
  /**
   * Send a CHUM message through the relay
   */
  async sendChumMessage(message: any): Promise<void> {
    this.send({
      ...message,
      source: 'browser',
      type: 'chum'
    })
  }
  
  /**
   * Disconnect from the relay
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    this.connected = false
    console.log('[LocalRelayClient] Disconnected')
  }
  
  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected
  }
}

// Export singleton
export const localRelayClient = new LocalRelayClient()