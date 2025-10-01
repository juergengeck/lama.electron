/**
 * Central State Manager
 * Single source of truth for application state
 */

import { EventEmitter } from 'events';

class StateManager extends EventEmitter {
  public state: any;

  watchers: Map<string, Set<Function>>

  constructor() {
    super()
    
    this.state = {
      // User session
      user: {
        authenticated: false,
        id: null,
        name: null,
        email: null
      },
      
      // Conversations
      conversations: new Map(),
      activeConversationId: null,
      
      // Contacts
      contacts: new Map(),
      
      // Messages (indexed by conversation)
      messages: new Map(),
      
      // Application settings
      settings: {
        theme: 'dark',
        notifications: true,
        aiEnabled: true
      },
      
      // Connection status
      network: {
        connected: false,
        peers: [],
        syncStatus: 'idle'
      }
    }
    
    // State change listeners for specific paths
    this.watchers = new Map()
  }

  // Get current state or a specific path
  getState(path = null) {
    if (!path) return { ...this.state }
    
    const parts = path.split('.')
    let current = this.state
    
    for (const part of parts) {
      if (current[part] === undefined) return undefined
      current = current[part]
    }
    
    return current
  }

  // Update state and notify listeners
  setState(path: any, value: any): any {
    const parts = path.split('.')
    const lastPart = parts.pop()
    
    let current = this.state
    for (const part of parts) {
      if (!current[part]) current[part] = {}
      current = current[part]
    }
    
    const oldValue = current[lastPart]
    current[lastPart] = value
    
    // Emit change event
    this.emit('stateChanged', {
      path,
      oldValue,
      newValue: value
    })
    
    // Notify specific watchers
    if (this.watchers.has(path)) {
      this.watchers.get(path).forEach(callback => {
        callback(value, oldValue)
      })
    }
    
    // Special handling for browser Person ID
    // Removed browserPersonId handling - browser has no ONE instance
  }

  // Watch for changes to a specific path
  watch(path: any, callback: any): any {
    if (!this.watchers.has(path)) {
      this.watchers.set(path, new Set())
    }
    this.watchers.get(path).add(callback)
    
    // Return unwatch function
    return () => {
      const watchers = this.watchers.get(path)
      if (watchers) {
        watchers.delete(callback)
        if (watchers.size === 0) {
          this.watchers.delete(path)
        }
      }
    }
  }

  // User state management
  setUser(user: any): any {
    this.setState('user', {
      authenticated: true,
      id: user.id,
      name: user.name,
      email: user.email
    })
  }

  clearUser(): any {
    this.setState('user', {
      authenticated: false,
      id: null,
      name: null,
      email: null
    })
  }

  // Conversation management
  addConversation(conversation: any): any {
    const conversations = new Map(this.state.conversations)
    conversations.set(conversation.id, conversation)
    this.setState('conversations', conversations)
  }

  updateConversation(id: any, updates: any): any {
    const conversations = new Map(this.state.conversations)
    const existing = conversations.get(id)
    if (existing && typeof existing === 'object') {
      conversations.set(id, { ...existing, ...updates })
      this.setState('conversations', conversations)
    }
  }

  setActiveConversation(id: any): any {
    this.setState('activeConversationId', id)
  }

  // Message management
  addMessage(conversationId: any, message: any): any {
    const messages = new Map(this.state.messages)
    if (!messages.has(conversationId)) {
      messages.set(conversationId, [])
    }

    const existingMessages = messages.get(conversationId)
    if (!Array.isArray(existingMessages)) {
      messages.set(conversationId, [message])
    } else {
      const conversationMessages = [...existingMessages, message]
      messages.set(conversationId, conversationMessages)
    }
    
    this.setState('messages', messages)
    
    // Also update conversation's last message
    this.updateConversation(conversationId, {
      lastMessage: message,
      lastMessageAt: new Date()
    })
  }

  getMessages(conversationId: any): any {
    return this.state.messages.get(conversationId) || []
  }

  // Contact management
  addContact(contact: any): any {
    const contacts = new Map(this.state.contacts)
    contacts.set(contact.id, contact)
    this.setState('contacts', contacts)
  }

  updateContact(id: any, updates: any): any {
    const contacts = new Map(this.state.contacts)
    const existing = contacts.get(id)
    if (existing && typeof existing === 'object') {
      contacts.set(id, { ...existing, ...updates })
      this.setState('contacts', contacts)
    }
  }

  // Network status
  setNetworkStatus(status: any): any {
    this.setState('network', {
      ...this.state.network,
      ...status
    })
  }

  // Get serializable state for IPC
  toJSON(): any {
    return {
      ...this.state,
      conversations: Array.from(this.state.conversations.entries()),
      contacts: Array.from(this.state.contacts.entries()),
      messages: Array.from(this.state.messages.entries())
    }
  }
  
  // Clear all state (for app reset)
  clearState(): any {
    this.state = {
      user: {
        authenticated: false,
        id: null,
        name: null,
        email: null
      },
      conversations: new Map(),
      activeConversationId: null,
      contacts: new Map(),
      messages: new Map(),
      settings: {
        theme: 'dark',
        notifications: true,
        aiEnabled: true
      },
      network: {
        connected: false,
        peers: [],
        syncStatus: 'idle'
      }
    }
    
    // Clear any browser instance ID as well
    delete this.state.browserInstanceId
    
    // Emit state cleared event
    this.emit('stateCleared')
  }
}

export default new StateManager()