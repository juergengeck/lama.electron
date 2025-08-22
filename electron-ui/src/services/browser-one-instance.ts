/**
 * Browser ONE.CORE Instance - REAL IMPLEMENTATION
 * Sparse storage with browser platform capabilities
 */

import { Instance } from '@refinio/one.core/lib/instance.js'
import { OneObjectTypeNames } from '@refinio/one.core/lib/recipes.js'
import { MultiUser } from '@refinio/one.models/lib/models/Authenticator/MultiUser.js'

export class BrowserOneInstance {
  private instance: Instance | null = null
  private multiUser: MultiUser | null = null
  private initialized = false
  
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[BrowserOne] Already initialized')
      return
    }
    
    console.log('[BrowserOne] Initializing ONE.CORE with browser platform...')
    
    try {
      // Wait for platform to be loaded by platform-loader
      // Don't load it here as it's already being loaded
      if (!window.ONE_CORE_PLATFORM_LOADED) {
        console.log('[BrowserOne] Waiting for platform loader...')
        // Give platform loader time to load
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      // Create instance
      this.instance = new Instance({
        name: 'lama-browser',
        directory: 'lama-browser-data'
      })
      
      await this.instance.init()
      
      // Initialize MultiUser model
      this.multiUser = new MultiUser(this.instance)
      await this.multiUser.init()
      
      this.initialized = true
      console.log('[BrowserOne] Initialized successfully')
      
    } catch (error) {
      console.error('[BrowserOne] Initialization failed:', error)
      throw error
    }
  }
  
  async createUser(username: string, password: string): Promise<any> {
    if (!this.multiUser) {
      throw new Error('MultiUser not initialized')
    }
    
    console.log('[BrowserOne] Creating user:', username)
    
    try {
      // Create user with MultiUser
      const user = await this.multiUser.createUser({
        name: username,
        email: `${username}@lama.local`,
        password
      })
      
      console.log('[BrowserOne] User created successfully')
      return user
      
    } catch (error) {
      console.error('[BrowserOne] Failed to create user:', error)
      throw error
    }
  }
  
  async login(username: string, password: string): Promise<any> {
    if (!this.multiUser) {
      throw new Error('MultiUser not initialized')
    }
    
    console.log('[BrowserOne] Attempting login for:', username)
    
    try {
      const user = await this.multiUser.login(username, password)
      console.log('[BrowserOne] Login successful')
      return user
      
    } catch (error) {
      console.error('[BrowserOne] Login failed:', error)
      throw error
    }
  }
  
  async logout(): Promise<void> {
    if (!this.multiUser) {
      return
    }
    
    try {
      await this.multiUser.logout()
      console.log('[BrowserOne] Logged out')
    } catch (error) {
      console.error('[BrowserOne] Logout failed:', error)
    }
  }
  
  async checkAuth(): Promise<{ authenticated: boolean; user?: any }> {
    if (!this.multiUser) {
      return { authenticated: false }
    }
    
    try {
      const isLoggedIn = await this.multiUser.isLoggedIn()
      if (isLoggedIn) {
        const user = await this.multiUser.getCurrentUser()
        return { authenticated: true, user }
      }
    } catch (error) {
      console.error('[BrowserOne] Auth check failed:', error)
    }
    
    return { authenticated: false }
  }
  
  // Create a state object in ONE.CORE
  async setState(path: string, value: any): Promise<void> {
    if (!this.instance) {
      throw new Error('Instance not initialized')
    }
    
    try {
      // Create a state object
      const stateObj = {
        type: 'State' as OneObjectTypeNames,
        path,
        value,
        timestamp: new Date().toISOString()
      }
      
      await this.instance.createObject(stateObj)
      
    } catch (error) {
      console.error('[BrowserOne] Failed to set state:', error)
      throw error
    }
  }
  
  // Get state from ONE.CORE
  async getState(path: string): Promise<any> {
    if (!this.instance) {
      throw new Error('Instance not initialized')
    }
    
    try {
      // Query for state objects with this path
      const objects = await this.instance.getObjects({
        type: 'State' as OneObjectTypeNames,
        filter: (obj: any) => obj.path === path
      })
      
      // Return the most recent value
      if (objects.length > 0) {
        const sorted = objects.sort((a: any, b: any) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        return sorted[0].value
      }
      
      return undefined
      
    } catch (error) {
      console.error('[BrowserOne] Failed to get state:', error)
      return undefined
    }
  }
  
  // Create a message object
  async createMessage(conversationId: string, text: string): Promise<any> {
    if (!this.instance) {
      throw new Error('Instance not initialized')
    }
    
    try {
      const message = {
        type: 'Message' as OneObjectTypeNames,
        conversationId,
        text,
        sender: await this.getCurrentUserId(),
        timestamp: new Date().toISOString(),
        status: 'sent'
      }
      
      const created = await this.instance.createObject(message)
      console.log('[BrowserOne] Message created')
      return created
      
    } catch (error) {
      console.error('[BrowserOne] Failed to create message:', error)
      throw error
    }
  }
  
  // Get messages for a conversation
  async getMessages(conversationId: string, limit = 50): Promise<any[]> {
    if (!this.instance) {
      throw new Error('Instance not initialized')
    }
    
    try {
      const messages = await this.instance.getObjects({
        type: 'Message' as OneObjectTypeNames,
        filter: (obj: any) => obj.conversationId === conversationId
      })
      
      // Sort by timestamp and limit
      const sorted = messages.sort((a: any, b: any) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      
      return sorted.slice(-limit)
      
    } catch (error) {
      console.error('[BrowserOne] Failed to get messages:', error)
      return []
    }
  }
  
  // Create a conversation
  async createConversation(name: string, participants: string[]): Promise<any> {
    if (!this.instance) {
      throw new Error('Instance not initialized')
    }
    
    try {
      const conversation = {
        type: 'Conversation' as OneObjectTypeNames,
        name,
        participants,
        createdAt: new Date().toISOString(),
        createdBy: await this.getCurrentUserId()
      }
      
      const created = await this.instance.createObject(conversation)
      console.log('[BrowserOne] Conversation created')
      return created
      
    } catch (error) {
      console.error('[BrowserOne] Failed to create conversation:', error)
      throw error
    }
  }
  
  // Get all conversations
  async getConversations(): Promise<any[]> {
    if (!this.instance) {
      throw new Error('Instance not initialized')
    }
    
    try {
      const conversations = await this.instance.getObjects({
        type: 'Conversation' as OneObjectTypeNames
      })
      
      return conversations.sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      
    } catch (error) {
      console.error('[BrowserOne] Failed to get conversations:', error)
      return []
    }
  }
  
  // Helper to get current user ID
  private async getCurrentUserId(): Promise<string> {
    if (!this.multiUser) {
      return 'anonymous'
    }
    
    try {
      const user = await this.multiUser.getCurrentUser()
      return user?.id || 'anonymous'
    } catch (error) {
      return 'anonymous'
    }
  }
  
  // Get the instance for direct access
  getInstance(): Instance | null {
    return this.instance
  }
  
  // Get MultiUser for direct access
  getMultiUser(): MultiUser | null {
    return this.multiUser
  }
  
  // Shutdown
  async shutdown(): Promise<void> {
    console.log('[BrowserOne] Shutting down...')
    
    if (this.multiUser) {
      await this.multiUser.logout()
    }
    
    if (this.instance) {
      await this.instance.shutdown()
    }
    
    this.initialized = false
    console.log('[BrowserOne] Shutdown complete')
  }
}

// Export singleton
export const browserOneInstance = new BrowserOneInstance()