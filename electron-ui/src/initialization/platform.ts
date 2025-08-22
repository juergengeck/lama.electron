/**
 * Platform initialization stub
 * ONE.CORE now runs in the main process, not in the renderer
 */

console.log('[Platform] ONE.CORE runs in main process - skipping renderer platform imports')

/**
 * Initialize the platform (stub for compatibility)
 */
export async function initPlatform(): Promise<void> {
  console.log('[Platform] Platform runs in main process, nothing to do in renderer')
}

/**
 * Check if we're running in Electron
 */
export function isElectron(): boolean {
  return !!(window as any).electronAPI
}

/**
 * Get platform info
 */
export function getPlatformInfo() {
  return {
    runtime: isElectron() ? 'electron' : 'browser',
    platform: SYSTEM, // 'browser' or 'nodejs' based on detection
    hasIndexedDB: typeof indexedDB !== 'undefined',
    hasWebCrypto: typeof crypto !== 'undefined' && !!crypto.subtle,
    hasElectronAPI: isElectron()
  }
}