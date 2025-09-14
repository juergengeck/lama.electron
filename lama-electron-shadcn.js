import electron from 'electron';
const { app, BrowserWindow, ipcMain, session } = electron;
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import http from 'http';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the main application
import mainApp from './main/app.js';
import { autoInitialize } from './main/startup/auto-init.js';
import ipcLogger from './main/utils/ipc-logger.js';

// Set app name
app.setName('LAMA');

// Handle EPIPE errors gracefully (when renderer disconnects unexpectedly)
process.on('uncaughtException', (error) => {
  if (error.code === 'EPIPE' || (error.message && error.message.includes('EPIPE'))) {
    // Ignore EPIPE errors - these happen when renderer closes while main is writing
    // Use process.stderr.write to avoid potential console issues
    try {
      process.stderr.write('[Main] Caught EPIPE error - renderer disconnected\n');
    } catch (e) {
      // Even stderr might fail, just ignore
    }
    return;
  }
  // For other uncaught exceptions, log and exit gracefully
  console.error('[Main] Uncaught exception:', error);
  console.error(error.stack);
  // Don't re-throw in production, just exit gracefully
  if (process.env.NODE_ENV === 'production') {
    app.quit();
  } else {
    // In development, allow the error to be seen but don't crash
    console.error('[Main] Development mode - continuing despite error');
  }
});

// Also handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled Rejection at:', promise, 'reason:', reason);
});

let mainWindow;
let viteProcess;

function createWindow() {
  // Use PNG for better compatibility, platform-specific icons can be set separately
  const iconPath = path.join(__dirname, 'assets', 'icons', 'icon-512.png');

  // Check if icon file exists, fallback to no icon if not found
  let windowIcon = undefined;
  if (fs.existsSync(iconPath)) {
    windowIcon = iconPath;
    console.log(`Using window icon: ${iconPath}`);
  } else {
    console.warn(`Icon file not found: ${iconPath}`);
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: windowIcon,
    webPreferences: {
      nodeIntegration: false,  // Disable Node in renderer for cleaner browser environment
      contextIsolation: true,   // Enable context isolation for security
      preload: path.join(__dirname, 'electron-preload.js'),
      webSecurity: true,  // Must be true for preload to work
      partition: 'persist:lama'  // Use persistent partition for IndexedDB
    },
    title: 'LAMA',
    backgroundColor: '#0a0a0a',
    show: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 }
  });

  // Set up IPC logger to send Node logs to browser
  ipcLogger.setMainWindow(mainWindow);
  
  // In development, load from Vite dev server
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.loadURL('http://localhost:5174');
    
    // Workaround: Inject electronAPI after page loads when webSecurity is disabled
    mainWindow.webContents.once('dom-ready', () => {
      console.log('[Main] Injecting electronAPI workaround for dev mode...');
      mainWindow.webContents.executeJavaScript(`
        if (!window.electronAPI) {
          console.warn('[Injection] electronAPI not found, this indicates preload issues with webSecurity:false');
          // The preload should have set this up, but with webSecurity:false it doesn't work
          // This is a dev-only workaround
        }
      `);
    });
    
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, 'electron-ui', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // AUTO-LOGIN FOR TESTING FEDERATION
  if (process.env.AUTO_LOGIN === 'true') {
    mainWindow.webContents.once('did-finish-load', async () => {
      console.log('[AutoLogin] Page loaded, waiting before auto-login...')
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      mainWindow.webContents.executeJavaScript(`
        (async () => {
          console.log('[AutoLogin] Attempting automatic login...')
          const usernameInput = document.querySelector('input[name="username"]')
          const passwordInput = document.querySelector('input[type="password"]')
          const loginButton = document.querySelector('button[type="submit"]')
          
          if (usernameInput && passwordInput && loginButton) {
            usernameInput.value = 'testuser'
            passwordInput.value = 'testpass123'
            usernameInput.dispatchEvent(new Event('input', { bubbles: true }))
            passwordInput.dispatchEvent(new Event('input', { bubbles: true }))
            await new Promise(resolve => setTimeout(resolve, 100))
            loginButton.click()
            return 'Login triggered'
          }
          return 'Login form not found'
        })()
      `).then(result => console.log('[AutoLogin]', result))
    })
  }
  
  // Add custom title bar with LAMA text
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      // Add custom title bar if not already present
      if (!document.querySelector('.electron-titlebar')) {
        const titleBar = document.createElement('div');
        titleBar.className = 'electron-titlebar';
        titleBar.innerHTML = '<div class="titlebar-content"><span class="lama-logo"><span style="color: #ef4444">L</span><span style="color: #eab308">A</span><span style="color: #22c55e">M</span><span style="color: #a855f7">A</span></span></div>';
        
        const style = document.createElement('style');
        style.textContent = \`
          .electron-titlebar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 38px;
            background: transparent;
            -webkit-app-region: drag;
            z-index: 10000;
            display: flex;
            align-items: center;
          }
          .titlebar-content {
            padding-left: 80px; /* Space for traffic lights + padding */
            display: flex;
            align-items: center;
            height: 100%;
          }
          .lama-logo {
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 1px;
            user-select: none;
          }
          body {
            padding-top: 38px; /* Push content down below title bar */
          }
        \`;
        document.head.appendChild(style);
        document.body.insertBefore(titleBar, document.body.firstChild);
      }
    `);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startViteServer() {
  return new Promise((resolve) => {
    // Check if server is already running
    http.get('http://localhost:5174', (res) => {
      console.log('Vite server already running');
      resolve();
    }).on('error', () => {
      // Start Vite server
      console.log('Starting Vite dev server...');
      viteProcess = spawn('npm', ['run', 'dev'], {
        cwd: path.join(__dirname, 'electron-ui'),
        shell: true,
        stdio: 'pipe',
        env: { ...process.env }
      });

      viteProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(output);
        if (output.includes('Local:')) {
          console.log('Vite server ready');
          setTimeout(resolve, 1000); // Give it a moment to stabilize
        }
      });

      viteProcess.stderr.on('data', (data) => {
        console.error(`Vite error: ${data}`);
      });
    });
  });
}

// Handle browser console logs
ipcMain.on('browser-log', (event, level, message) => {
  console.log(`[Browser ${level}]`, message);
});

app.whenReady().then(async () => {
  // Set dock icon for macOS after app is ready
  if (process.platform === 'darwin') {
    const dockIconPath = path.join(__dirname, 'assets', 'icons', 'icon-512.png');
    
    if (fs.existsSync(dockIconPath)) {
      try {
        app.dock.setIcon(dockIconPath);
        console.log(`Dock icon set successfully: ${dockIconPath}`);
      } catch (error) {
        console.warn('Failed to set dock icon:', error.message);
      }
    } else {
      console.warn(`Dock icon file not found: ${dockIconPath}`);
    }
  }

  // Start Vite server first if in development
  if (process.env.NODE_ENV !== 'production') {
    await startViteServer();
  }
  
  // Try to auto-initialize instances
  try {
    const initResult = await autoInitialize();
    if (initResult.recovered) {
      console.log('Auto-recovered existing ONE.core instances');
    } else if (initResult.needsSetup) {
      console.log('Need to set up ONE.core instances via UI');
    }
  } catch (error) {
    console.error('Auto-initialization error:', error);
  }
  
  // Start the main application
  try {
    await mainApp.start();
    console.log('Main application started successfully');
  } catch (error) {
    console.error('Failed to start main application:', error);
    // Still create window even if initialization fails
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (viteProcess) {
    viteProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  // Skip shutdown if we're clearing data
  if (global.isClearing) {
    return;
  }
  
  if (viteProcess) {
    viteProcess.kill();
  }
  
  // Shutdown main application
  if (mainApp && mainApp.shutdown) {
    await mainApp.shutdown();
  }
});

// IPC handlers for native features
ipcMain.handle('create-udp-socket', async (event, options) => {
  // Placeholder for UDP socket creation
  console.log('Creating UDP socket:', options);
  return { id: 'socket-' + Date.now() };
});

// Crypto handlers are now registered via IPCController

// Handler for clearing app data
ipcMain.handle('app:clearData', async (event) => {
  console.log('[ClearData] Starting app data reset...');
  
  try {
    // Step 1: Shutdown services
    console.log('[ClearData] Shutting down services...');
    
    // Shutdown Node.js ONE.core instance
    try {
      const { default: nodeOneCore } = await import('./main/core/node-one-core.js');
      if (nodeOneCore && nodeOneCore.shutdown) {
        await nodeOneCore.shutdown();
        console.log('[ClearData] Node.js ONE.core shut down');
      }
      
      // Reset node provisioning state
      const { default: nodeProvisioning } = await import('./main/hybrid/node-provisioning.js');
      nodeProvisioning.reset();
      console.log('[ClearData] Node provisioning reset');
      
      // Clear the initialized flag on NodeOneCore
      if (nodeOneCore) {
        nodeOneCore.initialized = false;
        nodeOneCore.initFailed = false;
        console.log('[ClearData] NodeOneCore flags reset');
      }
    } catch (e) {
      console.error('[ClearData] Error shutting down Node.js instance:', e);
    }
    
    // Step 2: Clear IndexedDB and localStorage
    console.log('[ClearData] Clearing browser storage...');
    
    // Clear IndexedDB, localStorage, and other browser storage
    await session.defaultSession.clearStorageData({
      storages: ['indexdb', 'localstorage']
    });
    console.log('[ClearData] Browser storage cleared');
    
    // Step 3: Delete data folders
    console.log('[ClearData] Deleting data folders...');
    
    const oneDbPath = path.join(process.cwd(), 'OneDB');
    const oneCoreStorageDir = path.join(process.cwd(), 'one-core-storage');
    
    // Delete OneDB folder
    if (fs.existsSync(oneDbPath)) {
      try {
        fs.rmSync(oneDbPath, { recursive: true, force: true });
        console.log('[ClearData] Deleted OneDB directory');
      } catch (error) {
        console.error('[ClearData] Error deleting OneDB:', error);
      }
    }
    
    // Delete one-core-storage folder
    if (fs.existsSync(oneCoreStorageDir)) {
      try {
        fs.rmSync(oneCoreStorageDir, { recursive: true, force: true });
        console.log('[ClearData] Deleted one-core-storage directory');
      } catch (error) {
        console.error('[ClearData] Error deleting one-core-storage:', error);
      }
    }
    
    // Step 4: Clear application state
    console.log('[ClearData] Resetting application state...');
    
    try {
      const { default: stateManager } = await import('./main/state/manager.js');
      stateManager.clearState();
      console.log('[ClearData] State manager cleared');
    } catch (error) {
      console.error('[ClearData] Error clearing state manager:', error);
    }
    
    console.log('[ClearData] All data cleared successfully');
    
    // Step 5: Restart the application
    console.log('[ClearData] Restarting application...');
    
    // Set flag to prevent saving any state on exit
    global.isClearing = true;
    
    // Schedule restart
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 500);
    
    return { success: true, message: 'App data cleared successfully. Application will restart...' };
    
  } catch (error) {
    console.error('[ClearData] FATAL ERROR:', error);
    console.error('[ClearData] Stack trace:', error.stack);
    return { success: false, error: error.message || 'Failed to clear app data' };
  }
});

// Auto-login test function for debugging - DISABLED to avoid redundant control flows
async function autoLoginTest() {
  console.log('[AutoLogin] Auto-login disabled to prevent redundant control flows')
  // setTimeout(async () => {
  //   console.log('[AutoLogin] Triggering login with demo/demo...')
  //   try {
  //     const { default: nodeProvisioning } = await import('./main/hybrid/node-provisioning.js')
  //     const result = await nodeProvisioning.provision({
  //       user: {
  //         name: 'demo',
  //         password: 'demo'
  //       }
  //     })
  //     console.log('[AutoLogin] Provision result:', JSON.stringify(result, null, 2))
  //   } catch (error) {
  //     console.error('[AutoLogin] Error:', error)
  //   }
  // }, 5000)
}

// Uncomment to enable auto-login for testing
autoLoginTest();