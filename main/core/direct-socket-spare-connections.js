/**
 * Spare Connection Manager for Direct Sockets
 * 
 * Implements CommServer-like spare connection behavior for direct WebSocket connections.
 * This allows clients to reconnect after pairing and get a properly authenticated connection.
 */

import { createMessageBus } from '@refinio/one.core/lib/message-bus.js'
const MessageBus = createMessageBus('DirectSocketSpare')

class DirectSocketSpareConnections {
  constructor() {
    this.spareConnections = new Map() // publicKey -> connection[]
    this.pendingHandovers = new Map() // token -> callback
  }

  /**
   * Register a spare connection for a specific public key
   * This is called after pairing succeeds
   */
  registerSpareConnection(publicKey, connection) {
    const key = typeof publicKey === 'string' ? publicKey : Buffer.from(publicKey).toString('hex')
    
    if (!this.spareConnections.has(key)) {
      this.spareConnections.set(key, [])
    }
    
    this.spareConnections.get(key).push(connection)
    MessageBus.send('log', `[SpareConnections] Registered spare connection for ${key.substring(0, 8)}`)
  }

  /**
   * Get a spare connection for handover
   * This is called when a client reconnects after pairing
   */
  getSpareConnection(publicKey) {
    const key = typeof publicKey === 'string' ? publicKey : Buffer.from(publicKey).toString('hex')
    const connections = this.spareConnections.get(key)
    
    if (connections && connections.length > 0) {
      const conn = connections.shift()
      if (connections.length === 0) {
        this.spareConnections.delete(key)
      }
      MessageBus.send('log', `[SpareConnections] Retrieved spare connection for ${key.substring(0, 8)}`)
      return conn
    }
    
    return null
  }

  /**
   * Check if we should hand over this connection
   * Called when a new connection arrives
   */
  shouldHandover(targetPublicKey) {
    const key = typeof targetPublicKey === 'string' ? targetPublicKey : Buffer.from(targetPublicKey).toString('hex')
    return this.spareConnections.has(key)
  }

  /**
   * Create a new spare connection after successful pairing
   * This mimics CommServer behavior
   */
  async createSpareAfterPairing(url, cryptoApi, leuteConnectionsModule) {
    try {
      MessageBus.send('log', '[SpareConnections] Creating spare connection after pairing...')
      
      // For direct sockets, we don't actually create a new connection
      // Instead, we mark that the next connection from this client should use CHUM
      // The client will reconnect automatically
      
      const publicKey = Buffer.from(cryptoApi.publicEncryptionKey).toString('hex')
      
      // Register that we're expecting a reconnection for CHUM
      this.registerSpareConnection(publicKey, {
        cryptoApi,
        expectingChum: true,
        timestamp: Date.now()
      })
      
      MessageBus.send('log', `[SpareConnections] Ready for CHUM connection from ${publicKey.substring(0, 8)}`)
    } catch (error) {
      MessageBus.send('log', `[SpareConnections] Error creating spare: ${error.message}`)
    }
  }
}

export default new DirectSocketSpareConnections()