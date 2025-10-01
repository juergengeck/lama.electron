// Bridge to integrate LAMA with Electron
// Browser uses IPC ONLY - NO ONE.core, NO AppModel

import { ipcStorage } from '../services/ipc-storage.js'

export interface LamaAPI {
  // Identity & Authentication
  createIdentity: (name: string, password: string) => Promise<string>
  login: (id: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  getCurrentUser: () => Promise<{ id: string; name: string } | null>

  // Messaging
  sendMessage: (recipientId: string, content: string, attachments?: any[]) => Promise<string>
  getMessages: (conversationId: string) => Promise<Message[]>
  createChannel: (name: string, members: string[]) => Promise<string>
  
  // P2P Networking
  connectToPeer: (peerId: string) => Promise<boolean>
  getPeerList: () => Promise<Peer[]>
  
  // Contacts
  getContacts: () => Promise<any[]>
  getOrCreateTopicForContact: (contactId: string) => Promise<string | null>
  
  // Local AI
  queryLocalAI: (prompt: string) => Promise<string>
  loadModel: (modelId: string) => Promise<boolean>
  getAvailableModels: () => Promise<any[]>
  setDefaultModel: (modelId: string) => Promise<boolean>
  enableAIForTopic: (topicId: string) => Promise<boolean>
  disableAIForTopic: (topicId: string) => Promise<boolean>
  getBestModelForTask: (task: 'coding' | 'reasoning' | 'chat' | 'analysis') => Promise<any>
  getModelsByCapability: (capability: string) => Promise<any[]>
  
  // UDP Sockets
  createUdpSocket: (options: SocketOptions) => Promise<string>
  sendUdpMessage: (socketId: string, message: Buffer, port: number, address: string) => Promise<void>
  
  // Events
  on: (event: string, callback: (...args: any[]) => void) => void
  off: (event: string, callback: (...args: any[]) => void) => void
}

export interface Message {
  id: string
  senderId: string
  senderName?: string
  content: string
  timestamp: Date
  encrypted: boolean
  isAI?: boolean
  attachments?: any[]
  topicId?: string
  topicName?: string
}

export interface Peer {
  id: string
  name: string
  address: string
  status: 'connected' | 'disconnected' | 'connecting'
  lastSeen: Date
}

export interface SocketOptions {
  type: 'udp4' | 'udp6'
  port?: number
  address?: string
}

// IPC-only implementation - NO AppModel, NO ONE.core
class LamaBridge implements LamaAPI {
  private eventListeners = new Map<string, Set<Function>>()
  public ipcListenersSetup = false
  
  constructor() {
    console.log('[LamaBridge] IPC-only mode initialized')
    console.log('[LamaBridge] window.electronAPI exists:', !!window.electronAPI)
    
    // Set up IPC event listeners to forward Node.js events to UI
    if (window.electronAPI) {
      console.log('[LamaBridge] Setting up IPC event listeners...')

      // Helper function to handle IPC events consistently
      // The preload script now properly strips the IPC event and passes only data
      const createIPCHandler = (eventName: string, emitName?: string) => {
        return (data: any) => {
          console.log(`[LamaBridge] IPC event received: ${eventName}`, data)
          this.emit(emitName || eventName, data)
        }
      }

      // Register all IPC event listeners
      // AI streaming events
      window.electronAPI.on('message:thinking', createIPCHandler('message:thinking'))
      window.electronAPI.on('message:stream', createIPCHandler('message:stream'))
      window.electronAPI.on('message:updated', createIPCHandler('message:updated'))

      // Contact events
      window.electronAPI.on('contact:added', createIPCHandler('contact:added'))

      // Conversation events
      window.electronAPI.on('chat:conversationCreated', createIPCHandler('conversation:created'))

      // Message events - single event for all message updates
      window.electronAPI.on('chat:newMessages', (data: any) => {
        console.log('[LamaBridge] 🔥🔥🔥 chat:newMessages received from IPC:', JSON.stringify(data))
        // Debug: log to main process
        window.electronAPI.invoke('debug:log', `[LamaBridge] chat:newMessages received: ${data.conversationId}`)
        this.emit('chat:newMessages', data)
        console.log('[LamaBridge] 🔥🔥🔥 Emitted chat:newMessages to React')
        // Debug: check how many listeners are registered
        const listeners = this.eventListeners.get('chat:newMessages')
        const listenerCount = listeners?.size || 0
        console.log(`[LamaBridge] Number of listeners for chat:newMessages: ${listenerCount}`)
        window.electronAPI.invoke('debug:log', `[LamaBridge] Emitted to ${listenerCount} listeners`)
      })

      // Navigation events
      window.electronAPI.on('navigate', createIPCHandler('navigate'))

      console.log('[LamaBridge] IPC event listeners registered successfully')
      this.ipcListenersSetup = true
    } else {
      console.warn('[LamaBridge] No window.electronAPI - IPC not available')
    }
  }
  
  async createIdentity(name: string, password: string): Promise<string> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('onecore:createIdentity', { name, password })
    if (!result.success) {
      throw new Error(result.error || 'Failed to create identity')
    }
    return result.id
  }
  
  async login(id: string, password: string): Promise<boolean> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('onecore:login', { id, password })
    return result.success
  }
  
  async logout(): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    await window.electronAPI.invoke('onecore:logout')
  }
  
  async getCurrentUser(): Promise<{ id: string; name: string } | null> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('chat:getCurrentUser')
    if (!result?.success || !result.user) {
      return null
    }
    return {
      id: result.user.id,
      name: result.user.name || 'User'
    }
  }
  
  async sendMessage(recipientId: string, content: string, attachments?: any[]): Promise<string> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    
    console.log('[LamaBridge] Sending message via IPC:', { recipientId, content })
    
    const result = await window.electronAPI.invoke('chat:sendMessage', {
      conversationId: recipientId,
      text: content,
      attachments: attachments || []
    })
    
    if (result.success) {
      console.log('[LamaBridge] Message sent via IPC:', result.data.id)
      // Emit local event for UI update
      this.emit('message:sent', { 
        id: result.data.id, 
        recipientId, 
        content,
        timestamp: new Date()
      })
      return result.data.id
    } else {
      throw new Error(result.error || 'Failed to send message')
    }
  }
  
  async getMessages(conversationId: string): Promise<Message[]> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }

    const result = await window.electronAPI.invoke('chat:getMessages', { 
      conversationId, 
      limit: 100,
      offset: 0 
    })
    
    if (!result?.success || !result.messages) {
      console.error('[LamaBridge] Failed to get messages from Node')
      return []
    }
    
    console.log(`[LamaBridge] Got ${result.messages.length} messages from Node via IPC`)
    
    // Transform Node messages to our Message format
    return result.messages.map((msg: any) => ({
      id: msg.id || `msg-${Date.now()}-${Math.random()}`,
      senderId: msg.sender || msg.author || 'unknown',
      senderName: msg.senderName,
      content: msg.text || msg.content || '',
      timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      encrypted: false,
      isAI: msg.isAI || false,
      topicId: conversationId,
      topicName: 'Chat',
      attachments: msg.attachments
    }))
  }
  
  async createChannel(name: string, members: string[]): Promise<string> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('onecore:createChannel', { name, members })
    if (!result.success) {
      throw new Error(result.error || 'Failed to create channel')
    }
    return result.channelId
  }
  
  async connectToPeer(peerId: string): Promise<boolean> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('onecore:connectToPeer', { peerId })
    return result.success
  }
  
  async getPeerList(): Promise<Peer[]> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('onecore:getPeerList')
    if (!result.success) {
      return []
    }
    return result.peers || []
  }
  
  async queryLocalAI(prompt: string): Promise<string> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('ai:query', { prompt })
    if (!result.success) {
      throw new Error(result.error || 'AI query failed')
    }
    return result.response
  }
  
  async loadModel(modelId: string): Promise<boolean> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('ai:loadModel', { modelId })
    return result.success
  }
  
  async getAvailableModels(): Promise<any[]> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('ai:getModels')
    if (!result.success) {
      return []
    }
    return result.models || []
  }
  
  async setDefaultModel(modelId: string): Promise<boolean> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('ai:setDefaultModel', { modelId })
    return result.success
  }
  
  async enableAIForTopic(topicId: string): Promise<boolean> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('ai:enableForTopic', { topicId })
    return result.success
  }
  
  async disableAIForTopic(topicId: string): Promise<boolean> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('ai:disableForTopic', { topicId })
    return result.success
  }
  
  async getBestModelForTask(task: 'coding' | 'reasoning' | 'chat' | 'analysis'): Promise<any> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('ai:getBestModelForTask', { task })
    if (!result.success) {
      return null
    }
    return result.model
  }
  
  async getModelsByCapability(capability: string): Promise<any[]> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('ai:getModelsByCapability', { capability })
    if (!result.success) {
      return []
    }
    return result.models || []
  }
  
  async getContacts(): Promise<any[]> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('onecore:getContacts')
    if (!result.success) {
      throw new Error(result.error || 'Failed to get contacts')
    }
    return result.contacts || []
  }
  
  async getOrCreateTopicForContact(contactId: string): Promise<string | null> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('onecore:getOrCreateTopicForContact', contactId)
    if (result.success && result.topicId) {
      return result.topicId
    }
    return null
  }
  
  async createUdpSocket(options: SocketOptions): Promise<string> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('udp:createSocket', options)
    if (!result.success) {
      throw new Error(result.error || 'Failed to create UDP socket')
    }
    return result.socketId
  }
  
  async sendUdpMessage(socketId: string, message: Buffer, port: number, address: string): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('udp:sendMessage', {
      socketId,
      message: Array.from(message), // Convert Buffer to array for IPC
      port,
      address
    })
    if (!result.success) {
      throw new Error(result.error || 'Failed to send UDP message')
    }
  }
  
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
    console.log(`[LamaBridge] ON: Added listener for ${event}, total listeners: ${this.eventListeners.get(event)!.size}`)
  }

  off(event: string, callback: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(callback)
      console.log(`[LamaBridge] OFF: Removed listener for ${event}, remaining: ${listeners.size}`)
    }
  }
  
  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event)
    console.log(`[LamaBridge] EMIT event: ${event}, listeners count: ${listeners?.size || 0}`)
    if (event === 'chat:newMessages') {
      console.log('[LamaBridge] chat:newMessages data:', args[0])
    }
    if (listeners) {
      listeners.forEach(callback => {
        console.log(`[LamaBridge] Calling listener for ${event}`)
        callback(...args)
      })
    } else {
      console.log(`[LamaBridge] NO LISTENERS for event: ${event}`)
    }
  }
  
  async clearConversation(conversationId: string = 'default'): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('IPC not available')
    }
    const result = await window.electronAPI.invoke('chat:clearConversation', { conversationId })
    if (!result.success) {
      throw new Error(result.error || 'Failed to clear conversation')
    }
  }
  
  async setConversationModel(conversationId: string, modelId: string): Promise<void> {
    // Store locally for UI purposes
    await ipcStorage.setItem(`conv-model-${conversationId}`, modelId)
  }
  
  async getInstanceInfo(): Promise<any> {
    if (!window.electronAPI) {
      return {
        success: true,
        instance: {
          id: 'browser-instance',
          name: 'Browser UI',
          platform: 'browser',
          role: 'client',
          initialized: true,
          capabilities: {
            network: false,
            storage: false,
            llm: false
          }
        }
      }
    }
    return await window.electronAPI.invoke('instance:info')
  }
  
  async getConnectedDevices(): Promise<any> {
    if (!window.electronAPI) {
      return { success: true, devices: [] }
    }
    return await window.electronAPI.invoke('devices:connected')
  }
  
  async createInvitation(): Promise<any> {
    if (!window.electronAPI) {
      return {
        success: false,
        error: 'Invitations require Electron environment'
      }
    }
    return await window.electronAPI.invoke('invitation:create')
  }
}

// Create singleton instance
const instance = new LamaBridge()

export const lamaBridge = instance

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).lamaBridge = lamaBridge
}

// Type declarations for window.electronAPI
declare global {
  interface Window {
    electronAPI?: {
      platform: string
      isElectron: boolean
      invoke: (channel: string, ...args: any[]) => Promise<any>
      on: (channel: string, callback: (...args: any[]) => void) => void
      off: (channel: string, callback: (...args: any[]) => void) => void
    }
  }
}