/**
 * Main Application Entry Point
 * Initializes all services and manages the application lifecycle
 */

import electron from 'electron';
const { app, BrowserWindow } = electron;
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extend global type for mainWindow
declare global {
  var mainWindow: electron.BrowserWindow | null;
}

// Core modules
import nodeProvisioning from './services/node-provisioning.js';
import ipcController from './ipc/controller.js';
import llmManager from './services/llm-manager-singleton.js';
import attachmentService from './services/attachment-service.js';

class MainApplication {
  public mainWindow: any;
  public initialized: any;

  
  constructor() {
    this.mainWindow = null
    this.initialized = false
}

  async initialize(): Promise<any> {
    // Always reset initialization state on fresh start
    // This ensures we can properly reinitialize after a data reset
    if (this.initialized) {
      console.log('[MainApp] Already initialized, skipping...')
      return
    }

    console.log('[MainApp] Initializing application...')

    try {
      // Initialize Node provisioning listener
      // Node instance will be initialized when browser provisions it
      nodeProvisioning.initialize()

      // Initialize attachment service
      await attachmentService.initialize()
      console.log('[MainApp] Attachment service initialized')

      // Initialize LLM Manager with MCP support
      try {
        await llmManager.init()
        console.log('[MainApp] LLM Manager initialized with MCP tools')
      } catch (error) {
        console.warn('[MainApp] LLM Manager initialization failed (non-critical):', error)
        // Continue without LLM - can be initialized later
      }

      // Set up state change listeners
      this.setupStateListeners()

      this.initialized = true
      console.log('[MainApp] Application ready for provisioning')
    } catch (error) {
      console.error('[MainApp] Failed to initialize:', error)
      // Don't set initialized on failure, allow retry
      throw error
    }
  }

  reset(): any {
    // Reset the application state for clean restart
    console.log('[MainApp] Resetting application state...')
    this.initialized = false
    this.mainWindow = null
  }

  setupStateListeners(): any {
    // State changes will be handled through CHUM sync
    // No longer using centralized state manager
    console.log('[MainApp] State listeners configured for CHUM sync')
  }

  createWindow(): any {
    // Set up window icon
    const iconPath = path.join(__dirname, '..', 'assets', 'icons', 'icon-512.png')
    let windowIcon = undefined
    if (fs.existsSync(iconPath)) {
      windowIcon = iconPath
      console.log(`[MainApp] Using window icon: ${iconPath}`)
    } else {
      console.warn(`[MainApp] Icon file not found: ${iconPath}`)
    }

    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      icon: windowIcon,
      webPreferences: {
        nodeIntegration: false,    // Clean browser environment
        contextIsolation: true,     // Enable for security
        preload: path.join(__dirname, '..', 'electron-preload.js'),
        webSecurity: false
      },
      title: 'LAMA',
      backgroundColor: '#0a0a0a',
      show: false,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 20, y: 20 }
    })
    
    // Set global reference for IPC handlers to use
    global.mainWindow = this.mainWindow

    // Initialize IPC controller with window
    ipcController.initialize(this.mainWindow)

    // Load the app
    if (process.env.NODE_ENV !== 'production') {
      this.mainWindow.loadURL('http://localhost:5174')
      this.mainWindow.webContents.openDevTools()
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '..', 'electron-ui', 'dist', 'index.html'))
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show()
    })

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null
      global.mainWindow = null
    })
  }

  async start(): Promise<any> {
    console.log('[MainApp] Starting application...')
    
    // Initialize core services
    await this.initialize()
    
    // Create main window
    this.createWindow()
    
    console.log('[MainApp] Application started')
  }

  async shutdown(): Promise<any> {
    console.log('[MainApp] Shutting down...')

    // Shutdown LLM Manager
    try {
      await llmManager.shutdown()
    } catch (error) {
      console.error('[MainApp] Error shutting down LLM Manager:', error)
    }

    // Shutdown IPC
    if (ipcController && ipcController.shutdown) {
      ipcController.shutdown()
    }

    // Deprovision Node instance if provisioned
    if (nodeProvisioning && nodeProvisioning.isProvisioned && nodeProvisioning.isProvisioned()) {
      await nodeProvisioning.deprovision()
    }

    // Reset the application state
    this.reset()

    console.log('[MainApp] Shutdown complete')
  }

  getMainWindow(): any {
    return this.mainWindow
  }

  async getState(): Promise<any> {
    // State is now managed by ONE.CORE instances
    if (nodeProvisioning.isProvisioned()) {
      const { default: nodeInstance } = await import('./core/node-one-core.js');
      return nodeInstance.models?.state?.getAll() || {};
    }
    return {};
  }
}

// Export singleton instance
export default new MainApplication();