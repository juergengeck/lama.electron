/**
 * IPC Logger
 * Sends Node.js logs to browser console via IPC
 */

class IPCLogger {
  constructor() {
    this.mainWindow = null
    this.enabled = true
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    }
    
    // Override console methods
    this.setupInterceptors()
  }
  
  setMainWindow(window) {
    this.mainWindow = window
    this.originalConsole.log('[IPCLogger] Main window set, logs will be sent to browser')

    // Test the connection
    setTimeout(() => {
      console.log('[IPCLogger] Test message - if you see this in browser console, IPC logging is working!')
    }, 2000)
  }
  
  setupInterceptors() {
    const self = this
    
    // Override console.log
    console.log = function(...args) {
      self.originalConsole.log.apply(console, args)
      if (self.enabled && self.mainWindow && !self.mainWindow.isDestroyed()) {
        self.sendToBrowser('log', args)
      }
    }
    
    // Override console.error
    console.error = function(...args) {
      self.originalConsole.error.apply(console, args)
      if (self.enabled && self.mainWindow && !self.mainWindow.isDestroyed()) {
        self.sendToBrowser('error', args)
      }
    }
    
    // Override console.warn
    console.warn = function(...args) {
      self.originalConsole.warn.apply(console, args)
      if (self.enabled && self.mainWindow && !self.mainWindow.isDestroyed()) {
        self.sendToBrowser('warn', args)
      }
    }
    
    // Override console.info
    console.info = function(...args) {
      self.originalConsole.info.apply(console, args)
      if (self.enabled && self.mainWindow && !self.mainWindow.isDestroyed()) {
        self.sendToBrowser('info', args)
      }
    }
  }
  
  sendToBrowser(level, args) {
    try {
      // Convert args to serializable format
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2)
          } catch {
            return String(arg)
          }
        }
        return String(arg)
      }).join(' ')
      
      // Send to browser
      this.mainWindow.webContents.send('node-log', {
        level,
        message,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      // Silently fail if can't send to browser
      this.originalConsole.error('[IPCLogger] Failed to send log to browser:', error.message)
    }
  }
  
  disable() {
    this.enabled = false
  }
  
  enable() {
    this.enabled = true
  }
}

// Create singleton
const ipcLogger = new IPCLogger()

export default ipcLogger