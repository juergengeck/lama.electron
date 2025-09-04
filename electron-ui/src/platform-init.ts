/**
 * Platform initialization for dual ONE.core architecture
 * Renderer runs its own ONE.core instance that connects to Node.js via IoM
 */

import './platform-loader'

console.log('[PLATFORM-INIT] Initializing renderer ONE.core instance...')

// Platform loader automatically loads the browser platform
console.log('[PLATFORM-INIT] ✅ Renderer ONE.core platform loading initiated')

export const platformReady = true