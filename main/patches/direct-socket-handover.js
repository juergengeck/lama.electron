/**
 * Direct Socket Connection Handover
 * 
 * Implements connection handover for direct sockets similar to CommServer.
 * After pairing succeeds, keeps the connection alive and transitions to CHUM.
 */

import { createMessageBus } from '@refinio/one.core/lib/message-bus.js'

const MessageBus = createMessageBus('DirectSocketHandover')

class DirectSocketHandover {
  constructor() {
    // Map of instanceId -> spare connections waiting for handover
    this.spareConnections = new Map()
    
    // Map of token -> pairing info for tracking pairing success
    this.pairingTokens = new Map()
  }
  
  /**
   * Register a pairing token to track when it succeeds
   */
  registerPairingToken(token, localInstanceId, remoteInstanceId) {
    console.log(`[DirectSocketHandover] Registering pairing token: ${token}`)
    this.pairingTokens.set(token, {
      localInstanceId,
      remoteInstanceId,
      timestamp: Date.now()
    })
  }
  
  /**
   * Called when pairing succeeds - prepare for spare connection
   */
  onPairingSuccess(token, localInstanceId, remoteInstanceId) {
    console.log(`[DirectSocketHandover] Pairing success for token: ${token}`)
    console.log(`[DirectSocketHandover] Expecting spare connection from instance: ${remoteInstanceId?.substring(0, 8)}`)
    
    // Mark that we're expecting a spare connection from this instance
    this.registerSpareConnectionExpectation(remoteInstanceId)
    
    // Clean up pairing token
    this.pairingTokens.delete(token)
  }
  
  /**
   * Register that we expect a spare connection from an instance
   */
  registerSpareConnectionExpectation(instanceId) {
    // Store expectation with timeout
    const expectation = {
      instanceId,
      timestamp: Date.now(),
      timeoutHandle: setTimeout(() => {
        console.warn(`[DirectSocketHandover] Spare connection timeout for instance: ${instanceId?.substring(0, 8)}`)
        this.spareConnections.delete(instanceId)
      }, 30000) // 30 second timeout
    }
    
    this.spareConnections.set(instanceId, expectation)
  }
  
  /**
   * Handle incoming spare connection after pairing
   * Returns true if this is a spare connection that should transition to CHUM
   */
  isSpareConnection(connection, remoteInstanceId) {
    const expectation = this.spareConnections.get(remoteInstanceId)
    
    if (expectation) {
      console.log(`[DirectSocketHandover] Identified spare connection from instance: ${remoteInstanceId?.substring(0, 8)}`)
      
      // Clear timeout
      if (expectation.timeoutHandle) {
        clearTimeout(expectation.timeoutHandle)
      }
      
      // Remove expectation
      this.spareConnections.delete(remoteInstanceId)
      
      // This connection should transition to CHUM
      return true
    }
    
    return false
  }
  
  /**
   * Send connection handover message (mimics CommServer)
   */
  async sendConnectionHandover(connection) {
    console.log(`[DirectSocketHandover] Sending connection_handover message`)
    
    try {
      // Send the handover message like CommServer does
      await connection.send(JSON.stringify({
        command: 'connection_handover'
      }))
      
      console.log(`[DirectSocketHandover] ✅ Connection handover sent`)
      return true
    } catch (error) {
      console.error(`[DirectSocketHandover] Failed to send handover:`, error)
      return false
    }
  }
  
  /**
   * Clean up old expectations
   */
  cleanup() {
    const now = Date.now()
    const timeout = 60000 // 1 minute
    
    for (const [instanceId, expectation] of this.spareConnections) {
      if (now - expectation.timestamp > timeout) {
        console.log(`[DirectSocketHandover] Cleaning up old expectation for: ${instanceId?.substring(0, 8)}`)
        if (expectation.timeoutHandle) {
          clearTimeout(expectation.timeoutHandle)
        }
        this.spareConnections.delete(instanceId)
      }
    }
  }
}

// Singleton instance
export const directSocketHandover = new DirectSocketHandover()

export default directSocketHandover