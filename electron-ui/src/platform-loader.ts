/**
 * Platform Loader for Browser ONE.CORE Instance
 * Works with context isolation enabled
 */

console.log('🔧 PLATFORM-LOADER: Initializing...')

declare global {
  interface Window {
    electronAPI?: any
    ONE_CORE_PLATFORM_LOADED?: boolean
  }
}

// Load browser platform for sparse storage in renderer
async function loadBrowserPlatform() {
  try {
    console.log('🔧 PLATFORM-LOADER: Loading browser platform for sparse storage...')
    
    // With context isolation, the renderer is a clean browser environment
    // No Node.js globals to worry about
    await import('@refinio/one.core/lib/system/load-browser.js')
    
    window.ONE_CORE_PLATFORM_LOADED = true
    console.log('✅ PLATFORM-LOADER: Browser platform loaded successfully')
    
  } catch (error) {
    console.error('❌ PLATFORM-LOADER: Failed to load browser platform:', error)
    // Don't throw - allow app to continue
  }
}

// Load immediately
loadBrowserPlatform()

export const platformLoaded = true