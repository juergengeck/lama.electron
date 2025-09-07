/**
 * Simplified Browser ONE.CORE Initialization
 * Minimal working version based on one.leute pattern
 */

console.log('[BrowserInitSimple] Module loaded')

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
import { LamaRecipes } from '../recipes/index.js'
import { ReverseMapsStable } from '@refinio/one.models/lib/recipes/reversemaps-stable.js'
import { ReverseMapsExperimental } from '@refinio/one.models/lib/recipes/reversemaps-experimental.js'
import { StateEntryRecipe, AppStateJournalRecipe } from '@refinio/refinio-api/dist/state/index.js'

import { AppModel } from '../models/AppModel'

export class SimpleBrowserInit {
  private one: SingleUserNoAuth | null = null
  private initialized = false
  private currentUser: any = null
  private appModel: AppModel | null = null
  private loginCredentials: { username: string; password: string } | null = null

  async initialize(): Promise<{ ready: boolean; needsAuth: boolean }> {
    if (this.initialized) {
      console.log('[BrowserInitSimple] Already checked - ready for login')
      return { ready: true, needsAuth: !this.currentUser }
    }

    console.log('[BrowserInitSimple] NO ONE.CORE YET - Waiting for user login')

    // DON'T initialize ONE.core here!
    // Just mark as ready so the UI can render the login screen
    this.initialized = true
    
    // Removed auto-login to prevent IndexedDB conflicts
    
    // Always need auth - we haven't initialized ONE.core yet
    return { ready: true, needsAuth: true }
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

    // Initialize AppModel in the onLogin handler - this is the ONLY place it should be initialized
    try {
      console.log('[BrowserInitSimple] DEBUG: About to initialize AppModel')
      console.log('[BrowserInitSimple] DEBUG: nodeInstanceInfo on window exists:', !!((window as any).nodeInstanceInfo))
      if ((window as any).nodeInstanceInfo) {
        const nodeInfo = (window as any).nodeInstanceInfo
        console.log('[BrowserInitSimple] DEBUG: nodeInstanceInfo details:')
        console.log('  - nodeId:', nodeInfo.nodeId)
        console.log('  - endpoint:', nodeInfo.endpoint)  
        console.log('  - pairingInvite exists:', !!nodeInfo.pairingInvite)
      }
      
      // Get owner ID from ONE.CORE  
      const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
      const ownerId = getInstanceOwnerIdHash()
      
      if (!ownerId) {
        throw new Error('No owner ID available from ONE.CORE')
      }
      
      console.log('[BrowserInitSimple] Browser instance owner ID:', ownerId)
      
      // Also send to Node.js for comparison  
      if (window.electronAPI && window.electronAPI.send) {
        window.electronAPI.send('debug', {
          type: 'browser-owner-id',
          ownerId: ownerId,
          timestamp: new Date().toISOString()
        })
      }
      
      // Create AppModel only if it doesn't exist
      if (!this.appModel) {
        console.log('[BrowserInitSimple] Creating AppModel...')
        this.appModel = new AppModel({
          name: 'LAMA-Browser',
          version: '1.0.0',
          commServerUrl: '' // Browser instance doesn't use comm server directly
        })
        
        // Initialize AppModel - this should only happen ONCE per login
        console.warn('[BrowserInitSimple] Starting AppModel.init() from onLogin handler...')
        await this.appModel.init(ownerId)
        console.log('[BrowserInitSimple] ✅ AppModel initialized successfully')
        
        // Make AppModel globally available for debugging
        ;(window as any).appModel = this.appModel
      } else {
        console.log('[BrowserInitSimple] AppModel already exists, skipping initialization')
      }
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


  async login(username: string, password: string): Promise<{ success: boolean; user?: any }> {
    console.log('[BrowserInitSimple] Login attempt:', username)

    // Store credentials
    this.loginCredentials = { username, password }
    const email = `${username}@lama.local`
    const instanceName = `lama-${username}`

    try {
      // STEP 1: Initialize/provision Node.js instance FIRST via IPC
      console.log('[BrowserInitSimple] Step 1: Initializing Node.js instance via IPC...')
      if (window.electronAPI) {
        console.log('[BrowserInitSimple] Calling IPC provision:node with:', { username, password: '***' })
        const nodeResult = await window.electronAPI.invoke('provision:node', {
          user: { 
            name: username,
            password: password
          }
          // Browser instance info will be sent AFTER browser ONE.core init
        })
        
        console.log('[BrowserInitSimple] IPC returned:', nodeResult)
        
        if (!nodeResult || !nodeResult.success) {
          throw new Error(`Failed to initialize Node.js instance: ${nodeResult?.error || 'No response'}`)
        }
        console.log('[BrowserInitSimple] ✅ Node.js instance ready:', nodeResult.nodeId)
        console.log('[BrowserInitSimple] Node endpoint:', nodeResult.endpoint)
        
        // Store Node info for later connection
        ;(window as any).nodeInstanceInfo = {
          nodeId: nodeResult.nodeId,
          endpoint: nodeResult.endpoint || 'ws://localhost:8765',
          pairingInvite: nodeResult.pairingInvite
        }
        
        console.log('[BrowserInitSimple] DEBUG: Stored nodeInstanceInfo on window:')
        console.log('[BrowserInitSimple] - nodeId:', nodeResult.nodeId)
        console.log('[BrowserInitSimple] - endpoint:', nodeResult.endpoint)
        console.log('[BrowserInitSimple] - pairingInvite exists:', !!nodeResult.pairingInvite)
        if (nodeResult.pairingInvite) {
          console.log('[BrowserInitSimple] - pairingInvite.token:', nodeResult.pairingInvite.token)
          console.log('[BrowserInitSimple] - pairingInvite.url:', nodeResult.pairingInvite.url)
        }
      } else {
        // Cannot proceed without Electron/Node.js
        throw new Error('Electron API not available - cannot initialize Node.js instance')
      }

      // STEP 2: NOW Initialize Browser ONE.core instance (ONLY after Node.js is ready)
      console.log('[BrowserInitSimple] Step 2: Initializing browser ONE.core (Node.js is ready)...')
      
      // Import same recipes as Node.js for consistent crypto context
      const { CORE_RECIPES } = await import('@refinio/one.core/lib/recipes.js')
      
      // Create the authenticator NOW (after Node is ready) - same config as Node.js
      // INCLUDE AppState recipes at initialization
      this.one = new SingleUserNoAuth({
        recipes: [
          ...(CORE_RECIPES || []),
          ...RecipesStable,
          ...RecipesExperimental,
          ...LamaRecipes,
          StateEntryRecipe,
          AppStateJournalRecipe
        ],
        reverseMaps: new Map([
          ...ReverseMapsStable,
          ...ReverseMapsExperimental
        ]),
        storageInitTimeout: 20000
      })

      // Set up event handlers
      this.one.onLogin.listen(this.handleLogin.bind(this))
      this.one.onLogout.listen(this.handleLogout.bind(this))

      // Check if already registered
      const isRegistered = await this.one.isRegistered()
      
      if (isRegistered) {
        console.log('[BrowserInitSimple] Instance already registered, logging in...')
        await this.one.login()
      } else {
        console.log('[BrowserInitSimple] Registering new instance with email:', email)
        await this.one.register({
          email: email,
          instanceName: instanceName,
          secret: password
        })
      }

      // Wait for login event
      let attempts = 0
      while (!this.currentUser && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }

      if (this.currentUser) {
        console.log('[BrowserInitSimple] ✅ Browser instance logged in')
        console.log('[BrowserInitSimple] AppState recipes registered during initialization')
        
        // STEP 3: Accept pairing invitation to establish contact relationship
        // NOTE: We'll use AppModel's ConnectionsModel which is created during AppModel.init()
        // For now, just store the invitation for AppModel to process
        const nodeInfo = (window as any).nodeInstanceInfo
        if (nodeInfo?.pairingInvite) {
          console.log('[BrowserInitSimple] Step 3: Pairing invitation received from Node.js')
          console.log('[BrowserInitSimple] Token:', nodeInfo.pairingInvite.token)
          console.log('[BrowserInitSimple] URL:', nodeInfo.pairingInvite.url)
          console.log('[BrowserInitSimple] Invitation will be accepted by AppModel during setupNodeConnection()')
          
          // Store invitation for AppModel to use
          ;(window as any).pendingPairingInvitation = nodeInfo.pairingInvite
        } else {
          console.warn('[BrowserInitSimple] No pairing invitation from Node.js - contact relationship not established')
          console.warn('[BrowserInitSimple] Connection may fail without contact relationship')
        }
        
        console.log('[BrowserInitSimple] Both instances ready for federation')
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