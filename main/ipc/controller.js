/**
 * Main IPC Controller
 * Routes IPC messages to appropriate handlers
 */

const { ipcMain } = require('electron')
const authHandlers = require('./handlers/auth')
const stateHandlers = require('./handlers/state')
const chatHandlers = require('./handlers/chat')
const iomHandlers = require('./handlers/iom')
const cryptoHandlers = require('./handlers/crypto')
const settingsHandlers = require('./handlers/settings')
const aiHandlers = require('./handlers/ai')
const attachmentHandlers = require('./handlers/attachments')

class IPCController {
  constructor() {
    this.handlers = new Map()
    this.mainWindow = null
  }

  initialize(mainWindow) {
    this.mainWindow = mainWindow
    
    // Register all handlers
    this.registerHandlers()
    
    console.log('[IPCController] Initialized with handlers')
  }

  registerHandlers() {
    // Authentication handlers
    this.handle('auth:login', authHandlers.login)
    this.handle('auth:register', authHandlers.register)
    this.handle('auth:logout', authHandlers.logout)
    this.handle('auth:check', authHandlers.checkAuth)
    
    // State handlers
    this.handle('state:get', stateHandlers.getState)
    this.handle('state:subscribe', stateHandlers.subscribe)
    
    // Chat handlers
    this.handle('chat:sendMessage', chatHandlers.sendMessage)
    this.handle('chat:getMessages', chatHandlers.getMessages)
    this.handle('chat:createConversation', chatHandlers.createConversation)
    this.handle('chat:getConversations', chatHandlers.getConversations)
    
    // IOM handlers
    this.handle('iom:getInstances', iomHandlers.getIOMInstances)
    this.handle('iom:getReplicationEvents', iomHandlers.getReplicationEvents)
    this.handle('iom:getDataStats', iomHandlers.getDataStats)
    this.handle('iom:updateBrowserStorage', iomHandlers.updateBrowserStorage)
    this.handle('iom:updateDataStats', iomHandlers.updateDataStats)
    
    // Crypto handlers
    this.handle('crypto:getKeys', cryptoHandlers.getKeys)
    this.handle('crypto:getCertificates', cryptoHandlers.getCertificates)
    this.handle('crypto:export', cryptoHandlers.exportCryptoObject)
    
    // Settings handlers
    this.handle('settings:get', settingsHandlers.getSetting)
    this.handle('settings:set', settingsHandlers.setSetting)
    this.handle('settings:getAll', settingsHandlers.getSettings)
    this.handle('settings:syncIoM', settingsHandlers.syncIoMSettings)
    this.handle('settings:subscribe', settingsHandlers.subscribeToSettings)
    this.handle('settings:getConfig', settingsHandlers.getInstanceConfig)
    
    // AI/LLM handlers
    this.handle('ai:chat', aiHandlers.chat)
    this.handle('ai:getModels', aiHandlers.getModels)
    this.handle('ai:setDefaultModel', aiHandlers.setDefaultModel)
    this.handle('ai:setApiKey', aiHandlers.setApiKey)
    this.handle('ai:getTools', aiHandlers.getTools)
    this.handle('ai:executeTool', aiHandlers.executeTool)
    this.handle('ai:initialize', aiHandlers.initializeLLM)
    this.handle('ai:debugTools', aiHandlers.debugTools)
    
    // Attachment handlers
    this.handle('attachment:store', attachmentHandlers.storeAttachment)
    this.handle('attachment:get', attachmentHandlers.getAttachment)
    this.handle('attachment:getMetadata', attachmentHandlers.getAttachmentMetadata)
    this.handle('attachment:storeMultiple', attachmentHandlers.storeAttachments)
    
    // Action handlers (user-initiated actions)
    this.handle('action:init', this.handleAction('init'))
    this.handle('action:login', this.handleAction('login'))
    this.handle('action:logout', this.handleAction('logout'))
    this.handle('action:sendMessage', this.handleAction('sendMessage'))
    
    // Query handlers (request state)
    this.handle('query:getState', this.handleQuery('getState'))
    this.handle('query:getConversation', this.handleQuery('getConversation'))
    this.handle('query:getMessages', this.handleQuery('getMessages'))
  }

  handle(channel, handler) {
    // Remove any existing handler
    if (this.handlers.has(channel)) {
      ipcMain.removeHandler(channel)
    }
    
    // Register new handler with error handling
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        console.log(`[IPC] Handling: ${channel}`, args)
        const result = await handler(event, ...args)
        // Don't double-wrap if handler already returns success/error format
        if (result && typeof result === 'object' && 'success' in result) {
          return result
        }
        return { success: true, data: result }
      } catch (error) {
        console.error(`[IPC] Error in ${channel}:`, error)
        return { 
          success: false, 
          error: error.message || 'Unknown error' 
        }
      }
    })
    
    this.handlers.set(channel, handler)
  }

  // Generic action handler wrapper
  handleAction(actionType) {
    return async (event, payload) => {
      console.log(`[IPC] Action: ${actionType}`, payload)
      
      // Process action based on type
      switch(actionType) {
        case 'init':
          // Platform is already initialized in main process
          return { initialized: true, platform: 'electron' }
        case 'login':
          return await authHandlers.login(event, payload)
        case 'logout':
          return await authHandlers.logout(event)
        case 'sendMessage':
          return await chatHandlers.sendMessage(event, payload)
        default:
          throw new Error(`Unknown action: ${actionType}`)
      }
    }
  }

  // Generic query handler wrapper
  handleQuery(queryType) {
    return async (event, params) => {
      console.log(`[IPC] Query: ${queryType}`, params)
      
      switch(queryType) {
        case 'getState':
          return await stateHandlers.getState(event, params)
        case 'getConversation':
          return await chatHandlers.getConversation(event, params)
        case 'getMessages':
          return await chatHandlers.getMessages(event, params)
        default:
          throw new Error(`Unknown query: ${queryType}`)
      }
    }
  }

  // Send update to renderer
  sendUpdate(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  // Forward console logs to renderer
  sendLogToRenderer(level, ...args) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update:mainProcessLog', {
        level,
        message: args.join(' '),
        timestamp: Date.now()
      })
    }
  }

  // Broadcast state change to renderer
  broadcastStateChange(path, newValue) {
    this.sendUpdate('update:stateChanged', {
      path,
      value: newValue,
      timestamp: Date.now()
    })
  }

  shutdown() {
    // Remove all handlers
    this.handlers.forEach((handler, channel) => {
      ipcMain.removeHandler(channel)
    })
    this.handlers.clear()
    
    console.log('[IPCController] Shutdown complete')
  }
}

module.exports = new IPCController()