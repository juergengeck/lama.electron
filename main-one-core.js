/**
 * ONE.CORE service running in the main process
 * This handles all one.core operations with full Node.js access
 */

const { ipcMain } = require('electron');

let instance = null;
let storage = null;
let oneCoreModules = null;

/**
 * Load ONE.CORE modules dynamically (ES modules)
 */
async function loadOneCoreModules() {
  if (oneCoreModules) return oneCoreModules;
  
  console.log('[Main] Loading ONE.CORE modules...');
  
  // Load Node.js platform
  await import('@refinio/one.core/lib/system/load-nodejs.js');
  
  // Load required modules
  const [instanceModule, storageBaseModule, cryptoModule] = await Promise.all([
    import('@refinio/one.core/lib/instance.js'),
    import('@refinio/one.core/lib/storage-versioned-objects.js'),
    import('@refinio/one.core/lib/crypto/encryption.js')
  ]);
  
  oneCoreModules = {
    Instance: instanceModule.Instance || instanceModule.default,
    StorageVersionedObjects: storageBaseModule.StorageVersionedObjects || storageBaseModule.default,
    createRandomKeys: cryptoModule.createRandomKeys
  };
  
  console.log('[Main] ONE.CORE modules loaded');
  return oneCoreModules;
}

/**
 * Initialize ONE.CORE in the main process
 */
async function initializeOneCore() {
  console.log('[Main] Initializing ONE.CORE...');
  
  try {
    // Load modules first - this loads the Node.js platform
    await loadOneCoreModules();
    
    console.log('[Main] ONE.CORE platform loaded successfully');
    
    // For now, we just confirm the platform is loaded
    // The actual instance/storage initialization can be implemented later
    // once we understand the proper API usage
    
    return true;
  } catch (error) {
    console.error('[Main] Failed to initialize ONE.CORE:', error);
    // Don't throw - allow the app to start even if ONE.CORE fails
    return false;
  }
}

/**
 * Set up IPC handlers for one.core operations
 */
function setupIPCHandlers() {
  // Initialize one.core
  ipcMain.handle('one-core:init', async () => {
    return await initializeOneCore();
  });
  
  // Get instance info
  ipcMain.handle('one-core:getInstance', async () => {
    if (!instance) {
      throw new Error('ONE.CORE not initialized');
    }
    return {
      id: instance.id,
      publicKey: instance.publicKey
    };
  });
  
  // Storage operations
  ipcMain.handle('one-core:storage:get', async (event, key) => {
    if (!storage) {
      throw new Error('Storage not initialized');
    }
    return await storage.get(key);
  });
  
  ipcMain.handle('one-core:storage:set', async (event, key, value) => {
    if (!storage) {
      throw new Error('Storage not initialized');
    }
    return await storage.set(key, value);
  });
  
  // Object operations
  ipcMain.handle('one-core:createObject', async (event, data, type) => {
    if (!instance) {
      throw new Error('Instance not initialized');
    }
    // Implementation would go here
    return { id: 'object-' + Date.now(), type, data };
  });
  
  ipcMain.handle('one-core:getObject', async (event, hash) => {
    if (!instance) {
      throw new Error('Instance not initialized');
    }
    // Implementation would go here
    return { hash, data: {} };
  });
}

module.exports = {
  initializeOneCore,
  setupIPCHandlers
};