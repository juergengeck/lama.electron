/**
 * Platform initialization for dual ONE.core architecture
 * Renderer runs its own ONE.core instance that connects to Node.js via IoM
 */
import '@refinio/one.core/lib/system/load-browser.js';
import { SYSTEM } from '@refinio/one.core/lib/system/platform.js';
console.log('[Platform] Initializing renderer ONE.core platform...');
/**
 * Initialize the browser platform for renderer ONE.core instance
 */
export async function initPlatform() {
    console.log('[Platform] Loading browser platform for renderer ONE.core...');
    // Browser platform is loaded by the import above
    console.log('[Platform] ✅ Renderer ONE.core platform initialized');
}
/**
 * Check if we're running in Electron
 */
export function isElectron() {
    return !!window.electronAPI;
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
    };
}
