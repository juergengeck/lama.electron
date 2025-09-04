/**
 * Direct Connection Service
 * Manages direct P2P connection between renderer and Node.js instances
 * Uses ONE.models ConnectionsModel without comm server
 */

export class DirectConnectionService {
  private connectionsModel: any
  private nodeEndpoint: string = 'ws://localhost:8765'
  private isConnected: boolean = false
  
  constructor() {
    console.log('[DirectConnection] Service initialized')
  }
  
  /**
   * Initialize direct connection to Node.js instance
   * This bypasses the comm server and connects directly
   */
  async connectToNode(): Promise<boolean> {
    try {
      console.log('[DirectConnection] Connecting directly to Node.js instance at:', this.nodeEndpoint)
      
      // For now, just log that direct connection is not implemented
      // The actual connection will happen through the normal ONE.core flow
      console.log('[DirectConnection] Direct P2P connection not yet implemented')
      console.log('[DirectConnection] Connections will be established via normal CHUM sync after provisioning')
      
      // Return false to indicate direct connection is not available
      // The app will continue with normal browser-based ConnectionsModel
      return false
    } catch (error) {
      console.error('[DirectConnection] Failed to connect to Node.js:', error)
      return false
    }
  }
  
  /**
   * Set up message handlers for the direct connection
   */
  private setupMessageHandlers(connection: any): void {
    // Handle incoming messages from Node.js
    connection.on('message', (data: any) => {
      try {
        const message = JSON.parse(data)
        console.log('[DirectConnection] Received message from Node.js:', message.type)
        
        // Handle different message types
        switch (message.type) {
          case 'sync':
            this.handleSync(message)
            break
          case 'update':
            this.handleUpdate(message)
            break
          case 'notification':
            this.handleNotification(message)
            break
          default:
            console.log('[DirectConnection] Unknown message type:', message.type)
        }
      } catch (error) {
        console.error('[DirectConnection] Failed to handle message:', error)
      }
    })
    
    connection.on('close', () => {
      console.log('[DirectConnection] Connection to Node.js closed')
      this.isConnected = false
      
      // Attempt to reconnect after a delay
      setTimeout(() => {
        this.connectToNode()
      }, 5000)
    })
    
    connection.on('error', (error: any) => {
      console.error('[DirectConnection] Connection error:', error)
    })
  }
  
  /**
   * Send a message directly to Node.js instance
   */
  async sendToNode(type: string, data: any): Promise<void> {
    if (!this.isConnected || !this.connectionsModel) {
      console.error('[DirectConnection] Not connected to Node.js')
      throw new Error('Not connected to Node.js instance')
    }
    
    const message = {
      type,
      data,
      timestamp: new Date().toISOString()
    }
    
    await this.connectionsModel.send(message)
    console.log('[DirectConnection] Sent message to Node.js:', type)
  }
  
  /**
   * Handle sync messages from Node.js
   */
  private handleSync(message: any): void {
    console.log('[DirectConnection] Handling sync:', message.data)
    // Implement sync logic here
    // This could sync messages, contacts, settings, etc.
  }
  
  /**
   * Handle update messages from Node.js
   */
  private handleUpdate(message: any): void {
    console.log('[DirectConnection] Handling update:', message.data)
    // Implement update logic here
    // This could be new messages, status updates, etc.
  }
  
  /**
   * Handle notifications from Node.js
   */
  private handleNotification(message: any): void {
    console.log('[DirectConnection] Handling notification:', message.data)
    // Implement notification logic here
  }
  
  /**
   * Disconnect from Node.js instance
   */
  async disconnect(): Promise<void> {
    if (this.connectionsModel) {
      await this.connectionsModel.close()
      this.isConnected = false
      console.log('[DirectConnection] Disconnected from Node.js')
    }
  }
  
  /**
   * Check if connected to Node.js
   */
  getConnectionStatus(): boolean {
    return this.isConnected
  }
}

// Export singleton instance
export const directConnection = new DirectConnectionService()