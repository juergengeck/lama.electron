/**
 * Platform initialization for browser UI
 * Browser has NO ONE.core - all operations go through IPC to Node.js
 */

console.log('[Platform] Browser UI platform check (NO ONE.core)')

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
    platform: 'browser-ui',
    hasIndexedDB: typeof indexedDB !== 'undefined',
    hasWebCrypto: typeof crypto !== 'undefined' && !!crypto.subtle,
    hasElectronAPI: isElectron()
  }
}

/**
 * Initialize platform (just checks environment)
 */
export async function initPlatform(): Promise<void> {
  console.log('[Platform] Browser UI environment check...')
  
  if (!isElectron()) {
    console.warn('[Platform] Not running in Electron - IPC will not work')
  } else {
    console.log('[Platform] ✅ Running in Electron - IPC available')
  }
}