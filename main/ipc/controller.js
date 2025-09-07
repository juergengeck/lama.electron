/**
 * Main IPC Controller
 * Routes IPC messages to appropriate handlers
 */

import electron from 'electron';
const { ipcMain } = electron;
import authHandlers from './handlers/auth.js';
import stateHandlers from './handlers/state.js';
import chatHandlers from './handlers/chat.js';
import iomHandlers from './handlers/iom.js';
import cryptoHandlers from './handlers/crypto.js';
import settingsHandlers from './handlers/settings.js';
import aiHandlers from './handlers/ai.js';
import attachmentHandlers from './handlers/attachments.js';
import oneCoreHandlers from './handlers/one-core.js';
import messageHandlers from './handlers/messages.js';
import { initializeDeviceHandlers } from './handlers/devices.js';

class IPCController {
  constructor() {
    this.handlers = new Map()
    this.mainWindow = null
  }
  
  // Safe console methods that won't throw EPIPE errors
  safeLog(...args) {
    // Skip logging entirely if mainWindow is destroyed
    if (this.mainWindow && this.mainWindow.isDestroyed()) {
      return;
    }
    
    try {
      console.log(...args)
    } catch (err) {
      // Ignore EPIPE errors when renderer disconnects
      if (err.code !== 'EPIPE' && !err.message.includes('EPIPE')) {
        // Try to at least log to stderr if stdout fails
        try {
          process.stderr.write(`[IPC] Log failed: ${err.message}\n`)
        } catch {}
      }
    }
  }
  
  safeError(...args) {
    // Skip logging entirely if mainWindow is destroyed
    if (this.mainWindow && this.mainWindow.isDestroyed()) {
      return;
    }
    
    try {
      console.error(...args)
    } catch (err) {
      // Ignore EPIPE errors
      if (err.code !== 'EPIPE' && !err.message.includes('EPIPE')) {
        try {
          process.stderr.write(`[IPC] Error log failed: ${err.message}\n`)
        } catch {}
      }
    }
  }

  initialize(mainWindow) {
    this.mainWindow = mainWindow
    
    // Register all handlers
    this.registerHandlers()
    
    this.safeLog('[IPCController] Initialized with handlers')
  }

  registerHandlers() {
    // Authentication handlers
    this.handle('auth:login', authHandlers.login)
    this.handle('auth:register', authHandlers.register)
    this.handle('auth:logout', authHandlers.logout)
    this.handle('auth:check', authHandlers.checkAuth)
    
    // State handlers
    this.handle('state:get', stateHandlers.getState)
    this.handle('state:set', stateHandlers.setState)
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
    this.handle('iom:createPairingInvitation', iomHandlers.createPairingInvitation)
    this.handle('iom:acceptPairingInvitation', iomHandlers.acceptPairingInvitation)
    
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
    
    // Message handlers for browser-node sync
    this.handle('messages:send', messageHandlers.sendMessage)
    this.handle('messages:get', messageHandlers.getMessages)
    this.handle('messages:subscribe', messageHandlers.subscribeToTopic)
    this.handle('messages:unsubscribe', messageHandlers.unsubscribeFromTopic)
    this.handle('messages:createTopic', messageHandlers.createTopic)
    
    // ONE.core handlers
    this.handle('onecore:initializeNode', oneCoreHandlers.initializeNode)
    this.handle('onecore:createLocalInvite', oneCoreHandlers.createLocalInvite)
    this.handle('onecore:createBrowserPairingInvite', oneCoreHandlers.createBrowserPairingInvite)
    this.handle('onecore:getBrowserPairingInvite', oneCoreHandlers.getBrowserPairingInvite)
    this.handle('onecore:createNetworkInvite', oneCoreHandlers.createNetworkInvite)
    this.handle('onecore:listInvites', oneCoreHandlers.listInvites)
    this.handle('onecore:revokeInvite', oneCoreHandlers.revokeInvite)
    this.handle('onecore:getNodeStatus', oneCoreHandlers.getNodeStatus)
    this.handle('onecore:setNodeState', oneCoreHandlers.setNodeState)
    this.handle('onecore:getNodeState', oneCoreHandlers.getNodeState)
    this.handle('onecore:getNodeConfig', oneCoreHandlers.getNodeConfig)
    this.handle('onecore:testSettingsReplication', oneCoreHandlers.testSettingsReplication)
    this.handle('onecore:syncConnectionSettings', oneCoreHandlers.syncConnectionSettings)
    this.handle('onecore:getCredentialsStatus', oneCoreHandlers.getCredentialsStatus)
    this.handle('onecore:getContacts', oneCoreHandlers.getContacts)
    
    // Debug handler for owner ID comparison
    this.handle('debug', (event, data) => {
      if (data.type === 'browser-owner-id') {
        console.log('[DEBUG] Browser Owner ID received:', data.ownerId)
        console.log('[DEBUG] Timestamp:', data.timestamp)
      } else {
        console.log('[DEBUG]', data)
      }
    })
    
    // Device handlers
    initializeDeviceHandlers()
    
    // Note: app:clearData is handled in lama-electron-shadcn.js
    
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
        this.safeLog(`[IPC] Handling: ${channel}`, args)
        const result = await handler(event, ...args)
        // Don't double-wrap if handler already returns success/error format
        if (result && typeof result === 'object' && 'success' in result) {
          return result
        }
        return { success: true, data: result }
      } catch (error) {
        this.safeError(`[IPC] Error in ${channel}:`, error)
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
      this.safeLog(`[IPC] Action: ${actionType}`, payload)
      
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
      this.safeLog(`[IPC] Query: ${queryType}`, params)
      
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

  async handleClearData() {
    try {
      this.safeLog('[IPCController] Clearing app data...')
      
      const { app } = electron;
      const fsModule = await import('fs');
      const fs = fsModule.promises;
      const pathModule = await import('path');
      const path = pathModule.default;
      
      // Clear device manager contacts
      const { default: deviceManager } = await import('../core/device-manager.js');
      deviceManager.devices.clear()
      await deviceManager.saveDevices()
      
      // Clear Node.js ONE.core storage
      const storageDir = path.join(process.cwd(), 'one-core-storage', 'node')
      try {
        await fs.rm(storageDir, { recursive: true, force: true })
        this.safeLog('[IPCController] Cleared Node.js storage')
      } catch (error) {
        this.safeError('[IPCController] Error clearing Node.js storage:', error)
      }
      
      // Clear any cached state
      const { default: stateManager } = await import('../state/manager.js');
      stateManager.clearState()
      
      // Properly shutdown Node ONE.core instance
      const { default: nodeOneCore } = await import('../core/node-one-core.js');
      
      if (nodeOneCore.initialized) {
        this.safeLog('[IPCController] Shutting down Node ONE.core instance...')
        await nodeOneCore.shutdown()
        this.safeLog('[IPCController] Node ONE.core instance shut down')
      }
      
      this.safeLog('[IPCController] App data cleared, ready for fresh start')
      
      return { success: true }
      
    } catch (error) {
      this.safeError('[IPCController] Failed to clear app data:', error)
      return { success: false, error: error.message }
    }
  }
  
  shutdown() {
    // Remove all handlers
    this.handlers.forEach((handler, channel) => {
      ipcMain.removeHandler(channel)
    })
    this.handlers.clear()
    
    this.safeLog('[IPCController] Shutdown complete')
  }
}

export default new IPCController()