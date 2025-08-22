const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Import the main application
const mainApp = require('./main/app');

// Set app name
app.setName('LAMA');

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
      webSecurity: false
    },
    title: 'LAMA',
    backgroundColor: '#0a0a0a',
    show: false,
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
    const http = require('http');
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

// Handler for clearing app data
ipcMain.handle('app:clearData', async (event) => {
  console.log('Clearing app data...');
  
  try {
    // Shutdown main application first
    if (mainApp && mainApp.shutdown) {
      console.log('Shutting down main application...');
      await mainApp.shutdown();
    }
    
    const userDataPath = app.getPath('userData');
    console.log('User data path:', userDataPath);
    
    // Clear session data
    const session = require('electron').session;
    await session.defaultSession.clearStorageData();
    await session.defaultSession.clearCache();
    
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
    
    console.log('App data cleared successfully');
    
    // Set flag to prevent saving any state on exit
    global.isClearing = true;
    
    // Start the restart script in a detached process
    const { spawn } = require('child_process');
    spawn('node', [path.join(__dirname, 'restart-app.js')], {
      detached: true,
      stdio: 'ignore'
    }).unref();
    
    // Force quit the current instance
    app.exit(0);
    
    return true;
  } catch (error) {
    console.error('Failed to clear app data:', error);
    throw error;
  }
});