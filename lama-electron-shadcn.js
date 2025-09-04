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
      webSecurity: false,
      partition: 'persist:lama'  // Use persistent partition for IndexedDB
    },
    title: 'LAMA',
    backgroundColor: '#0a0a0a',
    show: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 }
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.loadURL('http://localhost:5174');
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
    // Clear device manager contacts first
    try {
      console.log('[ClearData] Clearing device manager...');
      const { default: deviceManager } = await import('./main/core/device-manager.js');
      if (deviceManager && deviceManager.devices) {
        deviceManager.devices.clear();
        await deviceManager.saveDevices();
        console.log('[ClearData] Device manager cleared');
      }
    } catch (error) {
      console.log('[ClearData] DeviceManager error:', error.message);
    }
    
    // Clear Node.js ONE.core storage
    console.log('[ClearData] Clearing Node.js ONE.core storage...');
    const nodeStorageDir = path.join(process.cwd(), 'one-core-storage', 'node');
    if (fs.existsSync(nodeStorageDir)) {
      try {
        fs.rmSync(nodeStorageDir, { recursive: true, force: true });
        console.log('[ClearData] Cleared Node.js storage');
      } catch (error) {
        console.error('[ClearData] Error clearing Node.js storage:', error);
      }
    } else {
      console.log('[ClearData] Node storage directory does not exist');
    }
    
    // Reset Node ONE.core instance
    console.log('[ClearData] Resetting Node ONE.core instance...');
    const { default: nodeOneCore } = await import('./main/core/node-one-core.js');
    const wasInitialized = nodeOneCore.initialized;
    const instanceName = nodeOneCore.instanceName;
    console.log('[ClearData] Node was initialized:', wasInitialized);
    
    // Properly shut down the Node instance if it was initialized
    if (wasInitialized) {
      console.log('[ClearData] Shutting down Node ONE.core instance...');
      await nodeOneCore.shutdown();
      console.log('[ClearData] Node ONE.core instance shut down');
    }
    
    // Also close the ONE.core instance singleton
    try {
      const { closeInstance } = await import('./electron-ui/node_modules/@refinio/one.core/lib/instance.js');
      closeInstance();
      console.log('[ClearData] ONE.core instance singleton closed');
    } catch (error) {
      console.log('[ClearData] Error closing ONE.core instance:', error.message);
    }
    
    console.log('[ClearData] Node ONE.core instance reset');
    
    // Clear any cached state
    console.log('[ClearData] Clearing state manager...');
    const { default: stateManager } = await import('./main/state/manager.js');
    stateManager.clearState();
    console.log('[ClearData] State manager cleared');
    
    // Shutdown main application
    if (mainApp && mainApp.shutdown) {
      console.log('[ClearData] Shutting down main application...');
      await mainApp.shutdown();
      console.log('[ClearData] Main application shut down');
    } else {
      console.log('[ClearData] Main app not available or no shutdown method');
    }
    
    const userDataPath = app.getPath('userData');
    console.log('[ClearData] User data path:', userDataPath);
    
    // Clear session data
    console.log('[ClearData] Clearing session data...');
    await session.defaultSession.clearStorageData();
    await session.defaultSession.clearCache();
    console.log('[ClearData] Session data cleared');
    
    // Delete app data directory contents (but keep the directory itself)
    if (fs.existsSync(userDataPath)) {
      const files = fs.readdirSync(userDataPath);
      for (const file of files) {
        const filePath = path.join(userDataPath, file);
        try {
          if (fs.statSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
          console.log('Deleted:', filePath);
        } catch (e) {
          console.error('Failed to delete:', filePath, e);
        }
      }
    }
    
    // Also clear the Partitions directory which contains IndexedDB
    const partitionsPath = path.join(userDataPath, '../', 'Partitions');
    if (fs.existsSync(partitionsPath)) {
      try {
        fs.rmSync(partitionsPath, { recursive: true, force: true });
        console.log('Deleted Partitions directory (IndexedDB)');
      } catch (e) {
        console.error('Failed to delete Partitions:', e);
      }
    }
    
    // Also clear LAMA-Desktop data if it exists
    const lamaDesktopPath = path.join(app.getPath('appData'), 'LAMA-Desktop');
    if (fs.existsSync(lamaDesktopPath)) {
      try {
        fs.rmSync(lamaDesktopPath, { recursive: true, force: true });
        console.log('Deleted LAMA-Desktop data');
      } catch (e) {
        console.error('Failed to delete LAMA-Desktop data:', e);
      }
    }
    
    console.log('[ClearData] All cleanup operations completed successfully');
    
    // Re-initialize the application after clearing
    console.log('[ClearData] Re-initializing application...');
    
    // Re-initialize the main app
    const { initializeApp } = await import('./main/app.js');
    mainApp = await initializeApp();
    console.log('[ClearData] Main app re-initialized');
    
    // Re-initialize IPC controller to register handlers again
    const { default: IPCController } = await import('./main/ipc/controller.js');
    const ipcController = new IPCController();
    await ipcController.initialize();
    console.log('[ClearData] IPC handlers re-registered');
    
    // Set flag to prevent saving any state on exit
    global.isClearing = true;
    
    // Wait a moment to ensure all cleanup is complete
    console.log('[ClearData] Waiting for cleanup to complete...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // In development, just reload the renderer instead of restarting
    if (process.env.NODE_ENV === 'development') {
      console.log('[ClearData] Development mode: Reloading renderer...');
      // Get the focused window or first window
      const currentWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (currentWindow && !currentWindow.isDestroyed()) {
        // Schedule reload after returning success
        setTimeout(() => {
          currentWindow.reload();
          console.log('[ClearData] Renderer reloaded');
        }, 100);
        return { success: true, message: 'App data cleared, reloading...' };
      } else {
        console.log('[ClearData] Warning: No window available, attempting app relaunch...');
        app.relaunch();
        app.exit(0);
        return { success: true, message: 'App data cleared and app restarting' };
      }
    } else {
      // In production, restart the app
      console.log('[ClearData] Production mode: Restarting app...');
      app.relaunch();
      app.exit(0);
      return { success: true, message: 'App data cleared and app restarting' };
    }
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