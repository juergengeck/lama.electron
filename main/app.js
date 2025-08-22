/**
 * Main Application Entry Point
 * Initializes all services and manages the application lifecycle
 */

const { app, BrowserWindow } = require('electron')
const path = require('path')

// Core modules - now using hybrid architecture
const nodeProvisioning = require('./hybrid/node-provisioning')
const ipcController = require('./ipc/controller')
const llmManager = require('./services/llm-manager')
const attachmentService = require('./services/attachment-service')

class MainApplication {
  constructor() {
    this.mainWindow = null
    this.initialized = false
  }

  async initialize() {
    if (this.initialized) return
    
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
      throw error
    }
  }

  setupStateListeners() {
    // State changes will be handled through CHUM sync
    // No longer using centralized state manager
    console.log('[MainApp] State listeners configured for CHUM sync')
  }

  createWindow() {
    // Set up window icon
    const iconPath = path.join(__dirname, '..', 'assets', 'icons', 'icon-512.png')
    let windowIcon = undefined
    if (require('fs').existsSync(iconPath)) {
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
    })
  }

  async start() {
    console.log('[MainApp] Starting application...')
    
    // Initialize core services
    await this.initialize()
    
    // Create main window
    this.createWindow()
    
    console.log('[MainApp] Application started')
  }

  async shutdown() {
    console.log('[MainApp] Shutting down...')
    
    // Shutdown LLM Manager
    try {
      await llmManager.shutdown()
    } catch (error) {
      console.error('[MainApp] Error shutting down LLM Manager:', error)
    }
    
    // Shutdown IPC
    ipcController.shutdown()
    
    // Deprovision Node instance if provisioned
    if (nodeProvisioning.isProvisioned()) {
      await nodeProvisioning.deprovision()
    }
    
    console.log('[MainApp] Shutdown complete')
  }

  getMainWindow() {
    return this.mainWindow
  }

  getState() {
    // State is now managed by ONE.CORE instances
    if (nodeProvisioning.isProvisioned()) {
      const nodeInstance = require('./hybrid/node-instance')
      return nodeInstance.models?.state?.getAll() || {}
    }
    return {}
  }
}

// Export singleton instance
module.exports = new MainApplication()