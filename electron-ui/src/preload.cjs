/**
 * Electron Preload Script
 * Exposes IPC APIs to the renderer process and initializes ONE platform
 */

const { contextBridge, ipcRenderer } = require('electron')

// NO ONE.CORE IN BROWSER
// Platform is loaded only in the main process
console.log('[PRELOAD] Script loaded at:', new Date().toISOString())
console.log('[PRELOAD] Browser does not load ONE.core - using IPC only')

// Platform is initialized in the main process for ESM modules
// The preload script runs in an isolated context and can't share module state
// We'll just report that the platform is ready since it's confirmed working in main
let platformInitialized = true // Platform is loaded in main process
let platformError = null
let platformInitPromise = Promise.resolve(true)

console.log('[PRELOAD] Platform is initialized in main process (ESM modules)')
console.log('[PRELOAD] ✅ Using Node.js platform from main process')

// Set up log forwarding from main process to renderer console
ipcRenderer.on('main-process-log', (event, logData) => {
  const timestamp = new Date(logData.timestamp).toLocaleTimeString()
  const prefix = `[MAIN:${timestamp}]`
  
  switch (logData.level) {
    case 'error':
      console.error(prefix, logData.message)
      break
    case 'warn':
      console.warn(prefix, logData.message)
      break
    default:
      console.log(prefix, logData.message)
      break
  }
})

// Expose protected APIs to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform status
  platform: 'nodejs',
  isElectron: true,
  isPlatformInitialized: () => platformInitialized,
  getPlatformError: () => platformError ? platformError.message : null,
  waitForPlatform: () => platformInitPromise,
  
  // UDP Socket APIs
  udpCreate: (socketId, type) => ipcRenderer.invoke('udp:create', socketId, type),
  udpBind: (socketId, port, address) => ipcRenderer.invoke('udp:bind', socketId, port, address),
  udpSend: (socketId, data, port, address) => ipcRenderer.invoke('udp:send', socketId, data, port, address),
  udpClose: (socketId) => ipcRenderer.invoke('udp:close', socketId),
  onUDPMessage: (callback) => {
    ipcRenderer.on('udp:message', (event, socketId, eventType, ...args) => {
      callback(socketId, eventType, ...args)
    })
  },
  
  // App control APIs
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  
  // System info
  getPlatform: () => ipcRenderer.invoke('system:platform'),
  getVersion: () => ipcRenderer.invoke('system:version'),
  
  // File system (restricted)
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  selectFile: (filters) => ipcRenderer.invoke('dialog:selectFile', filters),
  
  // Clipboard
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  readFromClipboard: () => ipcRenderer.invoke('clipboard:read'),
  
  // File downloads
  downloadFile: (downloadId, url, filePath) => ipcRenderer.invoke('download:start', downloadId, url, filePath),
  cancelDownload: (downloadId) => ipcRenderer.invoke('download:cancel', downloadId),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download:progress', (event, downloadId, progress) => {
      callback(downloadId, progress)
    })
  },
  onDownloadComplete: (callback) => {
    ipcRenderer.on('download:complete', (event, downloadId) => {
      callback(downloadId)
    })
  },
  onDownloadError: (callback) => {
    ipcRenderer.on('download:error', (event, downloadId, error) => {
      callback(downloadId, error)
    })
  },
  
  // File operations
  fileExists: (filePath) => ipcRenderer.invoke('file:exists', filePath),
  getFileSize: (filePath) => ipcRenderer.invoke('file:size', filePath),
  
  // Navigation from menu
  on: (channel, callback) => {
    const validChannels = [
      'navigate', 
      'update:mainProcessLog',
      'message:updated',
      'contact:added',
      'chat:conversationCreated',
      'chat:messageSent'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback)
    }
  },
  off: (channel, callback) => {
    const validChannels = [
      'navigate', 
      'update:mainProcessLog',
      'message:updated',
      'contact:added',
      'chat:conversationCreated',
      'chat:messageSent'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback)
    }
  },
  removeListener: (channel, callback) => {
    const validChannels = [
      'navigate', 
      'update:mainProcessLog',
      'message:updated',
      'contact:added',
      'chat:conversationCreated',
      'chat:messageSent'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback)
    }
  },
  
  // Generic IPC invoke for platform bridge
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
})