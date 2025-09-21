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

// Allow multiple instances - each with proper cleanup
// Different instances can use different user data directories for testing
console.log('[Main] Starting new LAMA instance with PID:', process.pid);

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

// Track all child processes for this instance
const childProcesses = new Set();

// Clean up on process exit
process.on('exit', () => {
  console.log(`[Main-${process.pid}] Process exiting, cleaning up child processes...`);
  // Kill any remaining child processes
  childProcesses.forEach(child => {
    try {
      if (child && !child.killed) {
        child.kill('SIGTERM');
      }
    } catch (e) {
      // Process might already be gone
    }
  });
});

// Handle termination signals
process.on('SIGTERM', () => {
  console.log(`[Main-${process.pid}] Received SIGTERM, closing gracefully...`);
  app.quit();
});

process.on('SIGINT', () => {
  console.log(`[Main-${process.pid}] Received SIGINT, closing gracefully...`);
  app.quit();
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
      console.log(`[Main-${process.pid}] Starting Vite dev server...`);
      viteProcess = spawn('npm', ['run', 'dev'], {
        cwd: path.join(__dirname, 'electron-ui'),
        shell: true,
        stdio: 'pipe',
        env: { ...process.env }
      });

      // Track this child process
      childProcesses.add(viteProcess);

      // Remove from tracking when it exits
      viteProcess.on('exit', () => {
        childProcesses.delete(viteProcess);
        console.log(`[Main-${process.pid}] Vite process exited`);
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
  console.log(`[Main-${process.pid}] All windows closed for this instance`);

  // Clean up this instance's Vite process
  if (viteProcess) {
    console.log(`[Main-${process.pid}] Killing Vite process...`);
    viteProcess.kill('SIGTERM');
  }

  // On macOS, keep app in dock but clean up resources
  // On other platforms, quit completely
  if (process.platform !== 'darwin') {
    console.log(`[Main-${process.pid}] Non-macOS platform, quitting...`);
    app.quit();
  } else {
    console.log(`[Main-${process.pid}] macOS: App stays in dock, resources cleaned`);
    // Clean up any instance-specific resources here
    mainWindow = null;
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', async (event) => {
  // Skip shutdown if we're clearing data
  if (global.isClearing) {
    return;
  }

  console.log(`[Main-${process.pid}] App instance is quitting, cleaning up...`);
  
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
    // Step 1: Set clearing flag immediately to prevent any saves
    global.isClearing = true;

    // Step 2: Shutdown services properly
    console.log('[ClearData] Shutting down services...');

    // Shutdown main app first
    try {
      await mainApp.shutdown();
      console.log('[ClearData] Main app shut down');
    } catch (error) {
      console.error('[ClearData] Error shutting down main app:', error);
    }

    // Shutdown Node.js ONE.core instance
    try {
      const { default: nodeOneCore } = await import('./main/core/node-one-core.js');
      if (nodeOneCore) {
        // Call shutdown first if it exists
        if (nodeOneCore.shutdown) {
          await nodeOneCore.shutdown();
          console.log('[ClearData] Node.js ONE.core shut down');
        }

        // Then reset to clean state
        if (nodeOneCore.reset) {
          nodeOneCore.reset();
          console.log('[ClearData] NodeOneCore reset to clean state');
        }
      }

      // Reset node provisioning state
      const { default: nodeProvisioning } = await import('./main/hybrid/node-provisioning.js');
      if (nodeProvisioning && nodeProvisioning.reset) {
        nodeProvisioning.reset();
        console.log('[ClearData] Node provisioning reset');
      }
    } catch (e) {
      console.error('[ClearData] Error shutting down Node.js instance:', e);
    }

    // Step 3: Clear browser storage
    console.log('[ClearData] Clearing browser storage...');

    try {
      // Clear all browser storage data
      await session.defaultSession.clearStorageData({
        storages: ['indexdb', 'localstorage', 'cookies', 'cachestorage', 'websql']
      });

      // Also clear cache
      await session.defaultSession.clearCache();

      console.log('[ClearData] Browser storage cleared');
    } catch (error) {
      console.error('[ClearData] Error clearing browser storage:', error);
    }

    // Step 4: Delete data folders
    console.log('[ClearData] Deleting data folders...');

    const oneDbPath = path.join(process.cwd(), 'OneDB');
    const oneCoreStorageDir = path.join(process.cwd(), 'one-core-storage');
    const oneDataNodePath = path.join(process.cwd(), 'one-data-node');

    // Delete all data directories
    const dataDirs = [
      { path: oneDbPath, name: 'OneDB' },
      { path: oneCoreStorageDir, name: 'one-core-storage' },
      { path: oneDataNodePath, name: 'one-data-node' }
    ];

    for (const dir of dataDirs) {
      if (fs.existsSync(dir.path)) {
        try {
          fs.rmSync(dir.path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
          console.log(`[ClearData] Deleted ${dir.name} directory`);
        } catch (error) {
          console.error(`[ClearData] Error deleting ${dir.name}:`, error);
        }
      }
    }

    // Step 5: Clear application state
    console.log('[ClearData] Resetting application state...');

    try {
      const { default: stateManager } = await import('./main/state/manager.js');
      if (stateManager && stateManager.clearState) {
        stateManager.clearState();
        console.log('[ClearData] State manager cleared');
      }
    } catch (error) {
      console.error('[ClearData] Error clearing state manager:', error);
    }

    // Step 6: Clear module cache to ensure fresh restart
    console.log('[ClearData] Clearing module cache...');

    // Clear the require cache for key modules
    const modulePathsToDelete = [
      './main/core/node-one-core.js',
      './main/hybrid/node-provisioning.js',
      './main/hybrid/node-instance.js',
      './main/state/manager.js',
      './main/app.js'
    ];

    for (const modulePath of modulePathsToDelete) {
      try {
        const fullPath = path.join(__dirname, modulePath);
        delete require.cache[require.resolve(fullPath)];
        console.log(`[ClearData] Cleared cache for ${modulePath}`);
      } catch (error) {
        // Module might not be in cache yet, that's ok
      }
    }

    console.log('[ClearData] All data cleared successfully');

    // Step 7: Restart the application with a clean state
    console.log('[ClearData] Scheduling application restart...');

    // Give a bit more time to ensure everything is cleaned up
    setTimeout(() => {
      console.log('[ClearData] Restarting application now...');

      // Use app.relaunch with no arguments to start fresh
      app.relaunch();

      // Exit with code 0 to indicate successful termination
      app.exit(0);
    }, 1000);

    return { success: true, message: 'App data cleared successfully. Application will restart...' };

  } catch (error) {
    console.error('[ClearData] FATAL ERROR:', error);
    console.error('[ClearData] Stack trace:', error.stack);

    // Even on error, try to restart the app
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 1000);

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