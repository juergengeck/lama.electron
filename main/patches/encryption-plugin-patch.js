/**
 * Patch for EncryptionPlugin to handle protocol messages that should not be encrypted
 * 
 * The ONE.models pairing protocol sends a sync token as plain JSON after encryption
 * is established. This causes EncryptionPlugin to fail because it expects all messages
 * to be encrypted binary data after the handshake.
 * 
 * This patch makes EncryptionPlugin recognize and pass through protocol messages
 * like the sync token without attempting to decrypt them.
 */

export function patchEncryptionPlugin() {
  console.log('[EncryptionPluginPatch] Patching EncryptionPlugin to handle protocol messages...')
  
  // Import the EncryptionPlugin class
  import('@refinio/one.models/lib/misc/Connection/plugins/EncryptionPlugin.js').then(module => {
    const EncryptionPlugin = module.default
    
    // Save the original transformIncomingEvent method
    const originalTransformIncoming = EncryptionPlugin.prototype.transformIncomingEvent
    
    // Override transformIncomingEvent to handle protocol messages
    EncryptionPlugin.prototype.transformIncomingEvent = function(event) {
      // Only process message events
      if (event.type !== 'message') {
        return originalTransformIncoming.call(this, event)
      }
      
      // Check if this is a protocol message that should not be decrypted
      if (typeof event.data === 'string') {
        try {
          const parsed = JSON.parse(event.data)
          
          // Sync token - pass through without decryption
          if (parsed.command === 'sync') {
            console.log('[EncryptionPluginPatch] Detected sync token, passing through without decryption')
            return event
          }
          
          // Other protocol messages can be added here as needed
          
        } catch (e) {
          // Not JSON, continue with normal processing
        }
      }
      
      // Call the original method for all other messages
      return originalTransformIncoming.call(this, event)
    }
    
    console.log('[EncryptionPluginPatch] ✅ EncryptionPlugin patched successfully')
  }).catch(err => {
    console.error('[EncryptionPluginPatch] ❌ Failed to patch EncryptionPlugin:', err)
  })
}