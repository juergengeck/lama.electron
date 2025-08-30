/**
 * Simplified Browser ONE.CORE Initialization
 * Minimal working version based on one.leute pattern
 */

console.log('[BrowserInitSimple] Starting initialization...')

// Use standard ONE.core platform abstraction - no explicit platform loading needed  
// The browser platform will be detected and loaded automatically

// Certificate imports for side effects (from one.leute)
import '@refinio/one.models/lib/recipes/Certificates/AffirmationCertificate.js'
import '@refinio/one.models/lib/recipes/Certificates/TrustKeysCertificate.js'
import '@refinio/one.models/lib/recipes/Certificates/RightToDeclareTrustedKeysForEverybodyCertificate.js'
import '@refinio/one.models/lib/recipes/Certificates/RightToDeclareTrustedKeysForSelfCertificate.js'

import SingleUserNoAuth from '@refinio/one.models/lib/models/Authenticator/SingleUserNoAuth.js'
import RecipesStable from '@refinio/one.models/lib/recipes/recipes-stable.js'
import RecipesExperimental from '@refinio/one.models/lib/recipes/recipes-experimental.js'
import { ReverseMapsStable } from '@refinio/one.models/lib/recipes/reversemaps-stable.js'
import { ReverseMapsExperimental } from '@refinio/one.models/lib/recipes/reversemaps-experimental.js'

import { AppModel } from '../models/AppModel'

export class SimpleBrowserInit {
  private one: SingleUserNoAuth | null = null
  private initialized = false
  private currentUser: any = null
  private appModel: AppModel | null = null
  private loginCredentials: { username: string; password: string } | null = null

  async initialize(): Promise<{ ready: boolean; needsAuth: boolean }> {
    if (this.initialized) {
      console.log('[BrowserInitSimple] Already initialized')
      return { ready: true, needsAuth: !this.currentUser }
    }

    console.log('[BrowserInitSimple] Creating SingleUserNoAuth...')

    try {
      // Wait for storage to be ready
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Create the authenticator (like in one.leute)
      this.one = new SingleUserNoAuth({
        recipes: [...RecipesStable, ...RecipesExperimental],
        reverseMaps: new Map([
          ...ReverseMapsStable,
          ...ReverseMapsExperimental
        ]),
        storageInitTimeout: 20000
      })

      // Set up event handlers
      this.one.onLogin.listen(this.handleLogin.bind(this))
      this.one.onLogout.listen(this.handleLogout.bind(this))

      this.initialized = true
      console.log('[BrowserInitSimple] ✅ Initialized successfully')

      // Check if already logged in
      const isRegistered = await this.one.isRegistered()
      if (isRegistered) {
        console.log('[BrowserInitSimple] User is registered, checking for saved credentials...')
        
        // Try to get saved credentials from localStorage
        const savedUser = localStorage.getItem('lama-last-user')
        if (savedUser) {
          try {
            const { username, hint } = JSON.parse(savedUser)
            console.log(`[BrowserInitSimple] Found saved user: ${username}`)
            
            // For demo purposes, password is same as username
            // In production, you'd use proper credential management
            const password = hint || username
            this.loginCredentials = { username, password }
            
            const email = `${username}@lama.local`
            const instanceName = `lama-${username}`
            
            await this.one.loginOrRegister(email, password, instanceName)
            return { ready: true, needsAuth: false }
          } catch (error) {
            console.warn('[BrowserInitSimple] Auto-login with saved credentials failed:', error)
            // Clear invalid saved credentials
            localStorage.removeItem('lama-last-user')
            return { ready: true, needsAuth: true }
          }
        }
        
        // No saved credentials, user needs to login
        return { ready: true, needsAuth: true }
      }

      return { ready: true, needsAuth: true }

    } catch (error) {
      console.error('[BrowserInitSimple] Initialization failed:', error)
      return { ready: true, needsAuth: true }
    }
  }

  private async handleLogin(instanceName: string, secret: string): Promise<void> {
    console.log('[BrowserInitSimple] Login event:', instanceName)
    this.currentUser = {
      instanceName,
      name: instanceName.replace('lama-', ''),
      id: instanceName,
      password: secret,
      loggedInAt: new Date().toISOString()
    }

    // Initialize AppModel after successful login
    try {
      await this.initializeAppModel()
    } catch (error) {
      console.error('[BrowserInitSimple] Failed to initialize AppModel:', error)
      // Don't throw - allow basic functionality without full AppModel
    }
  }

  private async handleLogout(): Promise<void> {
    console.log('[BrowserInitSimple] Logout event')
    this.currentUser = null
    
    // Cleanup AppModel
    if (this.appModel) {
      try {
        await this.appModel.shutdown()
      } catch (error) {
        console.warn('[BrowserInitSimple] AppModel shutdown error:', error)
      }
      this.appModel = null
    }
  }

  private async initializeAppModel(): Promise<void> {
    if (this.appModel) {
      console.log('[BrowserInitSimple] AppModel already initialized')
      return
    }

    console.log('[BrowserInitSimple] Initializing AppModel...')

    try {
      // Get owner ID from ONE.CORE
      const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
      const ownerId = getInstanceOwnerIdHash()
      
      if (!ownerId) {
        throw new Error('No owner ID available from ONE.CORE')
      }

      // Create AppModel with browser-specific config
      this.appModel = new AppModel({
        name: 'LAMA-Browser',
        version: '1.0.0',
        commServerUrl: '' // Browser instance doesn't use comm server directly
      })

      // Provision Node.js instance FIRST if in Electron (so pairing invitation is ready)
      if (window.electronAPI && this.loginCredentials) {
        console.log('[BrowserInitSimple] Provisioning Node.js instance...')
        try {
          const result = await window.electronAPI.invoke('provision:node', {
            user: { 
              id: ownerId,
              name: this.loginCredentials.username,
              password: this.loginCredentials.password
            },
            config: {
              storageRole: 'archive',
              capabilities: ['network', 'storage']
            }
          })
          console.log('[BrowserInitSimple] Node.js provisioning result:', result)
          
          // Store Node instance info for endpoint creation
          ;(window as any).nodeInstanceInfo = result
        } catch (error) {
          console.error('[BrowserInitSimple] Failed to provision Node.js instance:', error)
          // Continue anyway - browser works without Node.js
        }
      }
      
      // Initialize the AppModel AFTER Node.js is provisioned
      console.warn('[BrowserInitSimple] Starting AppModel.init() now...')
      await this.appModel.init(ownerId)
      console.log('[BrowserInitSimple] ✅ AppModel initialized successfully')
      console.warn('[BrowserInitSimple] AppModel.init() completed')

    } catch (error) {
      console.error('[BrowserInitSimple] AppModel initialization failed:', error)
      this.appModel = null
      throw error
    }
  }

  async login(username: string, password: string): Promise<{ success: boolean; user?: any }> {
    console.log('[BrowserInitSimple] Login attempt:', username)

    if (!this.one) {
      throw new Error('Not initialized')
    }

    // Store credentials for Node.js provisioning
    this.loginCredentials = { username, password }

    const email = `${username}@lama.local`
    const instanceName = `lama-${username}`

    try {
      await this.one.loginOrRegister(email, password, instanceName)

      // Wait for login event
      let attempts = 0
      while (!this.currentUser && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }

      if (this.currentUser) {
        return { success: true, user: this.currentUser }
      } else {
        throw new Error('Login event not fired')
      }

    } catch (error) {
      console.error('[BrowserInitSimple] Login failed:', error)
      throw error
    }
  }

  async logout(): Promise<void> {
    console.log('[BrowserInitSimple] Logout')
    if (this.one) {
      await this.one.logout()
    }
  }

  getCurrentUser(): any {
    return this.currentUser
  }

  isInitialized(): boolean {
    return this.initialized
  }

  getLeuteModel(): any {
    return this.appModel?.leuteModel || null
  }

  getChannelManager(): any {
    return this.appModel?.channelManager || null
  }

  getAppModel(): AppModel | null {
    return this.appModel
  }
}

export const simpleBrowserInit = new SimpleBrowserInit()