/**
 * REAL Browser ONE.CORE Instance Implementation
 * No localStorage bullshit - actual ONE.CORE
 */

import type { Person } from '@refinio/one.core/lib/recipes.js'
import type LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js'
import MultiUser from '@refinio/one.models/lib/models/Authenticator/MultiUser.js'
import RecipesStable from '@refinio/one.models/lib/recipes/recipes-stable.js'
import RecipesExperimental from '@refinio/one.models/lib/recipes/recipes-experimental.js'
import { ReverseMapsStable } from '@refinio/one.models/lib/recipes/reversemaps-stable.js'
import { ReverseMapsExperimental } from '@refinio/one.models/lib/recipes/reversemaps-experimental.js'

export class RealBrowserInstance {
  private multiUser: MultiUser | null = null
  private leuteModel: LeuteModel | null = null
  private initialized: boolean = false
  private ownerId: string | null = null
  private browserSettings: any = null
  private iomSettings: any = null
  
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[RealBrowser] Already initialized')
      return
    }
    
    // Mark as initializing to prevent double initialization from React StrictMode
    if ((this as any).initializing) {
      console.log('[RealBrowser] Already initializing, waiting...')
      // Wait for the other initialization to complete
      while ((this as any).initializing && !this.initialized) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return
    }
    
    (this as any).initializing = true
    
    console.log('[RealBrowser] Initializing REAL ONE.CORE...')
    
    try {
      // Wait for platform to be loaded
      let attempts = 0
      while (!window.ONE_CORE_PLATFORM_LOADED && attempts < 10) {
        console.log('[RealBrowser] Waiting for platform loader...')
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }
      
      if (!window.ONE_CORE_PLATFORM_LOADED) {
        throw new Error('Platform failed to load')
      }
      
      // Create MultiUser instance with all necessary recipes
      console.log('[RealBrowser] Creating MultiUser instance with recipes...')
      this.multiUser = new MultiUser({
        directory: 'lama-browser-data',
        recipes: [
          ...RecipesStable,
          ...RecipesExperimental
        ],
        reverseMaps: new Map([
          ...ReverseMapsStable,
          ...ReverseMapsExperimental
        ])
      })
      
      // Set up event handlers for authentication state changes
      await this.attachAuthHandlers()
      
      console.log('[RealBrowser] MultiUser instance created with event handlers')
      
      // Mark as initialized
      this.initialized = true
      ;(this as any).initializing = false
      console.log('[RealBrowser] ✅ REAL ONE.CORE initialized!')
      
    } catch (error) {
      console.error('[RealBrowser] Failed to initialize:', error)
      ;(this as any).initializing = false
      throw error
    }
  }
  
  private async attachAuthHandlers(): Promise<void> {
    if (!this.multiUser) {
      throw new Error('MultiUser not initialized')
    }
    
    console.log('[RealBrowser] Attaching authentication event handlers...')
    
    // Listen for login events (including session restoration)
    this.multiUser.onLogin.listen(async (instanceName: string, secret: string) => {
      console.log('[RealBrowser] onLogin event fired for:', instanceName)
      
      // Prevent duplicate initialization
      if (this.ownerId) {
        console.log('[RealBrowser] Already initialized, skipping')
        return
      }
      
      try {
        // Get the instance owner ID
        const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
        const ownerId = getInstanceOwnerIdHash()
        
        if (ownerId) {
          console.log('[RealBrowser] Login successful, owner:', ownerId)
          this.ownerId = ownerId
          await this.completeInitializationAfterAuth()
        } else {
          console.warn('[RealBrowser] Login event fired but no owner ID found')
        }
      } catch (error) {
        console.error('[RealBrowser] Error handling login event:', error)
      }
    })
    
    // Listen for logout events
    this.multiUser.onLogout.listen(async () => {
      console.log('[RealBrowser] onLogout event fired')
      
      // Clear our state
      this.ownerId = null
      this.leuteModel = null
      this.browserSettings = null
      this.iomSettings = null
    })
    
    // Listen for auth state changes
    if (this.multiUser.authState && this.multiUser.authState.onStateChange) {
      this.multiUser.authState.onStateChange.listen((oldState, newState) => {
        console.log('[RealBrowser] Auth state change:', oldState, '->', newState)
      })
    }
    
    console.log('[RealBrowser] Authentication event handlers attached')
  }
  
  private async initializeSettings(): Promise<void> {
    try {
      const { default: PropertyTreeStore } = await import('@refinio/one.models/lib/models/SettingsModel.js')
      
      // Create browser-specific settings store
      this.browserSettings = new PropertyTreeStore(`browser-settings-${this.ownerId || 'default'}`)
      await this.browserSettings.init()
      
      // Set default browser settings
      await this.browserSettings.setValue('instance.type', 'browser')
      await this.browserSettings.setValue('instance.id', `browser-${this.ownerId || Date.now()}`)
      await this.browserSettings.setValue('theme', 'dark')
      await this.browserSettings.setValue('language', 'en')
      await this.browserSettings.setValue('notifications', 'true')
      await this.browserSettings.setValue('storage.role', 'cache')
      
      // Create shared IoM settings store
      this.iomSettings = new PropertyTreeStore('iom-shared-settings')
      await this.iomSettings.init()
      
      // Set shared IoM settings
      await this.iomSettings.setValue('iom.browser.connected', 'true')
      await this.iomSettings.setValue('iom.browser.lastUpdate', new Date().toISOString())
      
      console.log('[RealBrowser] Settings stores initialized')
    } catch (error) {
      console.error('[RealBrowser] Failed to initialize settings:', error)
      throw error
    }
  }
  
  private async initializeModels(): Promise<void> {
    try {
      const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
      const ownerId = getInstanceOwnerIdHash()
      
      if (ownerId) {
        console.log('[RealBrowser] Instance has owner:', ownerId)
        
        // Check if MultiUser has a LeuteModel we can use
        if (this.multiUser && (this.multiUser as any).leuteModel) {
          console.log('[RealBrowser] Using LeuteModel from MultiUser')
          this.leuteModel = (this.multiUser as any).leuteModel
        } else {
          console.log('[RealBrowser] Creating new LeuteModel...')
          const { default: LeuteModelClass } = await import('@refinio/one.models/lib/models/Leute/LeuteModel.js')
          this.leuteModel = new LeuteModelClass()
          await this.leuteModel.init()
        }
        
        console.log('[RealBrowser] ✅ LeuteModel initialized!')
        
        // Store the owner ID for later use
        this.ownerId = ownerId
      } else {
        console.log('[RealBrowser] No instance owner, models not initialized')
      }
    } catch (error) {
      console.error('[RealBrowser] Failed to initialize models:', error)
      throw error
    }
  }
  
  async createObject(obj: any): Promise<any> {
    if (!this.initialized) {
      throw new Error('Instance not initialized')
    }
    
    if (!this.ownerId) {
      throw new Error('User not authenticated')
    }
    
    // Use ONE.core storage functions directly after initialization
    const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
    return await storeVersionedObject(obj)
  }
  
  async getObjects(query: any): Promise<any[]> {
    if (!this.initialized) {
      throw new Error('Instance not initialized')
    }
    
    if (!this.ownerId) {
      throw new Error('User not authenticated')
    }
    
    // For Person queries, return empty array for now
    // TODO: Implement proper person queries with LeuteModel
    if (query.type === 'Person') {
      return []
    }
    
    // Otherwise use direct storage query
    const { getObjectsByType } = await import('@refinio/one.core/lib/storage-unversioned-objects.js')
    return await getObjectsByType(query.type)
  }
  
  async createUser(username: string, password: string): Promise<any> {
    console.log('[RealBrowser] Creating/registering user:', username)
    
    if (!this.multiUser) {
      throw new Error('MultiUser not initialized')
    }
    
    const email = `${username}@lama.local`
    const instanceName = `lama-${username}`
    
    // If already logged in, we need to logout first before registering a new user
    if (this.ownerId) {
      console.log('[RealBrowser] Already logged in, logging out first...')
      try {
        await this.multiUser.logout()
        // Clear our state
        this.ownerId = null
        this.leuteModel = null
        this.browserSettings = null
        this.iomSettings = null
      } catch (error) {
        console.warn('[RealBrowser] Logout failed:', error)
      }
    }
    
    try {
      // Register new user with MultiUser
      await this.multiUser.register(email, password, instanceName)
      console.log('[RealBrowser] User registered successfully')
      
      // Complete initialization after successful registration
      await this.completeInitializationAfterAuth()
      
      // Return user info with owner ID (consistent format for both browser and node)
      return { 
        id: this.ownerId,
        name: username,
        email: email,
        person: { 
          id: this.ownerId, 
          email 
        }
      }
    } catch (error) {
      console.error('[RealBrowser] Failed to register user:', error)
      throw error
    }
  }
  
  private async completeInitializationAfterAuth(): Promise<void> {
    console.log('[RealBrowser] Completing initialization after authentication...')
    
    // Ensure all recipes are in the runtime
    console.log('[RealBrowser] Ensuring all recipes are in global runtime...')
    const { addRecipeToRuntime, hasRecipe } = await import('@refinio/one.core/lib/object-recipes.js')
    
    for (const recipe of [...RecipesStable, ...RecipesExperimental]) {
      if (!hasRecipe(recipe.name)) {
        addRecipeToRuntime(recipe)
      }
    }
    console.log('[RealBrowser] All recipes added to runtime')
    
    // Get the instance owner ID
    const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
    this.ownerId = getInstanceOwnerIdHash()
    console.log('[RealBrowser] Instance owner ID:', this.ownerId)
    
    // Initialize models
    await this.initializeModels()
    
    // Initialize Settings stores
    await this.initializeSettings()
    
    console.log('[RealBrowser] Post-auth initialization complete')
  }
  
  async login(username: string, password: string): Promise<any> {
    console.log('[RealBrowser] Logging in:', username)
    
    if (!this.multiUser) {
      throw new Error('MultiUser not initialized')
    }
    
    const email = `${username}@lama.local`
    const instanceName = `lama-${username}`
    
    try {
      // Use loginOrRegister - it handles both new and existing users
      await this.multiUser.loginOrRegister(email, password, instanceName)
      console.log('[RealBrowser] LoginOrRegister completed')
      
      // Wait for the onLogin event handler to complete initialization
      // The event handler will set this.ownerId
      let attempts = 0
      while (!this.ownerId && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 50))
        attempts++
      }
      
      if (!this.ownerId) {
        throw new Error('Login succeeded but initialization did not complete')
      }
      
      // Return user info with owner ID
      return { 
        id: this.ownerId,
        name: username,
        email: email,
        person: { 
          id: this.ownerId, 
          email 
        }
      }
    } catch (error) {
      console.error('[RealBrowser] Failed to login:', error)
      throw error
    }
  }
  
  async setState(path: string, value: any): Promise<void> {
    if (!this.browserSettings) {
      console.warn('[RealBrowser] Cannot set state - settings not initialized')
      return
    }
    
    // Use the Settings datatype we already have
    await this.browserSettings.setValue(path, JSON.stringify(value))
  }
  
  async getState(path: string): Promise<any> {
    if (!this.browserSettings) {
      return undefined
    }
    
    // Get from Settings datatype
    const value = this.browserSettings.getValue(path)
    if (value) {
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }
    return undefined
  }
  
  getLeuteModel(): LeuteModel | null {
    return this.leuteModel
  }
  
  async shutdown(): Promise<void> {
    if (this.multiUser) {
      try {
        await this.multiUser.logout()
      } catch (error) {
        console.warn('[RealBrowser] Error during logout:', error)
      }
      this.multiUser = null
    }
    
    if (this.leuteModel) {
      // LeuteModel doesn't have shutdown, just clear the reference
      this.leuteModel = null
    }
    this.initialized = false
  }
  
  isInitialized(): boolean {
    return this.initialized
  }
  
  getOwnerId(): string | null {
    return this.ownerId
  }
  
  async checkAuth(): Promise<{ authenticated: boolean; user?: any }> {
    if (this.multiUser && this.multiUser.authState && this.multiUser.authState.currentState === 'logged_in') {
      const userState = await this.getState('identity.user')
      return {
        authenticated: true,
        user: userState || { id: this.ownerId, name: 'User' }
      }
    }
    
    return { authenticated: false }
  }
  
  async logout(): Promise<void> {
    console.log('[RealBrowser] Logging out...')
    
    if (this.multiUser) {
      try {
        await this.multiUser.logout()
      } catch (error) {
        console.warn('[RealBrowser] MultiUser logout failed:', error)
      }
    }
    
    // Clear our state
    this.ownerId = null
    this.leuteModel = null
    this.browserSettings = null
    this.iomSettings = null
    
    console.log('[RealBrowser] Logout complete')
  }
  
  async updateNodeConnectionStatus(connected: boolean): Promise<void> {
    if (this.iomSettings) {
      await this.iomSettings.setValue('iom.node.connected', connected ? 'true' : 'false')
      await this.iomSettings.setValue('iom.node.lastUpdate', new Date().toISOString())
    }
  }
  
  async setSetting(key: string, value: any): Promise<void> {
    if (!this.browserSettings) {
      throw new Error('Settings not initialized')
    }
    
    await this.browserSettings.setValue(key, String(value))
    
    // If it's an IoM-related setting, also update the shared settings
    if (key.startsWith('iom.')) {
      if (this.iomSettings) {
        await this.iomSettings.setValue(key, String(value))
      }
    }
  }
  
  async getSetting(key: string): Promise<string | undefined> {
    if (!this.browserSettings) {
      return undefined
    }
    
    const value = this.browserSettings.getValue(key)
    return value || undefined
  }
  
  getBrowserSettings(): any {
    return this.browserSettings
  }
  
  getIoMSettings(): any {
    return this.iomSettings
  }
  
  async getOrCreateAIPersonId(aiName: string): Promise<string> {
    // For AI assistants, create deterministic Person IDs based on their name
    // This ensures consistent IDs across sessions
    if (!this.leuteModel) {
      // If no LeuteModel, generate a deterministic hash for the AI
      const { createHash } = await import('crypto')
      const hash = createHash('sha256').update(`ai-${aiName}`).digest('hex')
      return hash
    }
    
    try {
      // Try to find existing AI person
      const persons = await this.leuteModel.getPersons()
      const aiPerson = persons.find(p => p.email === `${aiName}@ai.lama`)
      
      if (aiPerson) {
        return aiPerson.id
      }
      
      // Create new AI person identity
      const personId = await this.leuteModel.createNewIdentity(`${aiName}@ai.lama`)
      console.log(`[RealBrowser] Created AI person for ${aiName}:`, personId)
      return personId
    } catch (error) {
      console.error('[RealBrowser] Failed to create AI person:', error)
      // Fallback to deterministic hash
      const { createHash } = await import('crypto')
      const hash = createHash('sha256').update(`ai-${aiName}`).digest('hex')
      return hash
    }
  }
}

// Export singleton
export const realBrowserInstance = new RealBrowserInstance()