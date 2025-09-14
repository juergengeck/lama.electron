/**
 * Simplified Browser Instance for ONE.CORE
 * Handles authentication without complex imports
 */

export class SimpleBrowserInstance {
  private users: Map<string, any> = new Map()
  private currentUser: any = null
  private state: Map<string, any> = new Map()
  private initialized = false
  
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[SimpleBrowser] Already initialized')
      return
    }
    
    console.log('[SimpleBrowser] Initializing simple browser instance...')
    
    // Load any persisted users from localStorage
    const storedUsers = await ipcStorage.getItem('lama-users')
    if (storedUsers) {
      try {
        const parsed = JSON.parse(storedUsers)
        Object.entries(parsed).forEach(([id, user]) => {
          this.users.set(id, user)
        })
      } catch (e) {
        console.error('[SimpleBrowser] Failed to load stored users:', e)
      }
    }
    
    this.initialized = true
    console.log('[SimpleBrowser] Initialized successfully')
  }
  
  async createUser(username: string, password: string): Promise<any> {
    console.log('[SimpleBrowser] Creating user:', username)
    
    // Check if user already exists
    const existing = Array.from(this.users.values()).find(u => u.name === username)
    if (existing) {
      throw new Error('User already exists')
    }
    
    // Create new user
    const user = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: username,
      email: `${username}@lama.local`,
      passwordHash: this.hashPassword(password),
      createdAt: new Date().toISOString()
    }
    
    this.users.set(user.id, user)
    this.persistUsers()
    
    console.log('[SimpleBrowser] User created successfully')
    return user
  }
  
  async login(username: string, password: string): Promise<any> {
    console.log('[SimpleBrowser] Attempting login for:', username)
    
    const user = Array.from(this.users.values()).find(u => u.name === username)
    if (!user) {
      throw new Error('User not found')
    }
    
    if (user.passwordHash !== this.hashPassword(password)) {
      throw new Error('Invalid password')
    }
    
    this.currentUser = user
    await ipcStorage.setItem('lama-current-user', user.id)
    
    console.log('[SimpleBrowser] Login successful')
    return user
  }
  
  async logout(): Promise<void> {
    this.currentUser = null
    await ipcStorage.removeItem('lama-current-user')
    console.log('[SimpleBrowser] Logged out')
  }
  
  async checkAuth(): Promise<{ authenticated: boolean; user?: any }> {
    // Check if we have a current user
    if (this.currentUser) {
      return { authenticated: true, user: this.currentUser }
    }
    
    // Try to restore from localStorage
    const userId = await ipcStorage.getItem('lama-current-user')
    if (userId) {
      const user = this.users.get(userId)
      if (user) {
        this.currentUser = user
        return { authenticated: true, user }
      }
    }
    
    return { authenticated: false }
  }
  
  // State management
  async setState(path: string, value: any): Promise<void> {
    this.state.set(path, value)
    
    // Persist important state
    if (path.startsWith('identity.') || path.startsWith('provisioning.')) {
      await ipcStorage.setItem(`lama-state-${path}`, JSON.stringify(value))
    }
  }
  
  async getState(path: string): Promise<any> {
    // Check memory first
    if (this.state.has(path)) {
      return this.state.get(path)
    }
    
    // Check localStorage
    const stored = await ipcStorage.getItem(`lama-state-${path}`)
    if (stored) {
      try {
        const value = JSON.parse(stored)
        this.state.set(path, value)
        return value
      } catch (e) {
        console.error('[SimpleBrowser] Failed to parse stored state:', e)
      }
    }
    
    return undefined
  }
  
  // Message operations (simplified)
  async createMessage(conversationId: string, text: string): Promise<any> {
    const message = {
      id: `msg-${Date.now()}`,
      conversationId,
      text,
      sender: this.currentUser?.id || 'anonymous',
      timestamp: new Date().toISOString(),
      status: 'sent'
    }
    
    // Store in localStorage for now
    const messages = this.getStoredMessages()
    messages.push(message)
    await ipcStorage.setItem('lama-messages', JSON.stringify(messages))
    
    return message
  }
  
  async getMessages(conversationId: string, limit = 50): Promise<any[]> {
    const messages = this.getStoredMessages()
    return messages
      .filter(m => m.conversationId === conversationId)
      .slice(-limit)
  }
  
  // Conversation operations (simplified)
  async createConversation(name: string, participants: string[]): Promise<any> {
    const conversation = {
      id: `conv-${Date.now()}`,
      name,
      participants,
      createdAt: new Date().toISOString(),
      createdBy: this.currentUser?.id || 'system'
    }
    
    const conversations = this.getStoredConversations()
    conversations.push(conversation)
    await ipcStorage.setItem('lama-conversations', JSON.stringify(conversations))
    
    return conversation
  }
  
  async getConversations(): Promise<any[]> {
    return this.getStoredConversations()
  }
  
  // Helper methods
  private hashPassword(password: string): string {
    // Simple hash for demo - in production use proper crypto
    return btoa(password)
  }
  
  private persistUsers(): void {
    const userData: any = {}
    this.users.forEach((user, id) => {
      userData[id] = user
    })
    await ipcStorage.setItem('lama-users', JSON.stringify(userData))
  }
  
  private getStoredMessages(): any[] {
    const stored = await ipcStorage.getItem('lama-messages')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.error('[SimpleBrowser] Failed to parse messages:', e)
      }
    }
    return []
  }
  
  private getStoredConversations(): any[] {
    const stored = await ipcStorage.getItem('lama-conversations')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.error('[SimpleBrowser] Failed to parse conversations:', e)
      }
    }
    return []
  }
  
  async shutdown(): Promise<void> {
    console.log('[SimpleBrowser] Shutting down...')
    this.currentUser = null
    this.initialized = false
  }
}

// Export singleton
export const simpleBrowserInstance = new SimpleBrowserInstance()