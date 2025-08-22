/**
 * Platform initialization stub
 * ONE.CORE now runs in the main process, not the renderer
 */

console.log('[PLATFORM-INIT] ONE.CORE runs in main process - skipping renderer platform load')

// Export to maintain compatibility
export const platformReady = true