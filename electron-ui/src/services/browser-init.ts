/**
 * Browser UI Initialization (NO ONE.CORE)
 * Browser is ONLY a UI layer - all ONE.core operations go through IPC to Node.js
 */

console.log('[BrowserInit] Module loaded - UI layer only')

// NO ONE.CORE IN BROWSER - Just a UI layer that uses IPC

export class BrowserInit {
  private initialized = false
  private currentUser: any = null
  private loginCredentials: { username: string; password: string } | null = null

  async initialize(): Promise<{ ready: boolean; needsAuth: boolean }> {
    if (this.initialized) {
      console.log('[BrowserInit] Already initialized - ready for login')
      return { ready: true, needsAuth: !this.currentUser }
    }

    console.log('[BrowserInit] Browser is just UI - waiting for user login')
    
    // Just mark as ready so the UI can render the login screen
    this.initialized = true
    
    // Always need auth - Node.js handles ONE.core
    return { ready: true, needsAuth: true }
  }

  /**
   * Handle user login - Just forwards to Node.js via IPC
   */
  async login(username: string, password: string): Promise<any> {
    console.log('[BrowserInit] User login:', username)
    
    // Store credentials for UI purposes
    this.loginCredentials = { username, password }
    
    try {
      // Call Node.js to initialize ONE.core instance
      console.log('[BrowserInit] Calling Node.js to initialize ONE.core...')
      
      if (!window.electronAPI) {
        throw new Error('Electron API not available - cannot communicate with Node.js')
      }
      
      // Initialize Node.js ONE.core instance
      const nodeResult = await window.electronAPI.invoke('onecore:initializeNode', {
        user: { 
          name: username,
          password: password
        }
      })
      
      console.log('[BrowserInit] Node.js response:', nodeResult)
      
      if (!nodeResult || !nodeResult.success) {
        throw new Error(`Failed to initialize Node.js instance: ${nodeResult?.error || 'No response'}`)
      }
      
      // Store user info for UI
      this.currentUser = {
        instanceName: `lama-${username}`,
        name: username,
        id: `lama-${username}`,
        password: password,
        loggedInAt: new Date().toISOString()
      }
      
      console.log('[BrowserInit] ✅ Node.js ONE.core initialized:', nodeResult.nodeId)
      
      // Store Node info for debugging
      ;(window as any).nodeInstanceInfo = {
        nodeId: nodeResult.nodeId,
        endpoint: nodeResult.endpoint || 'ws://localhost:8765'
      }
      
      return { success: true, user: this.currentUser }
      
    } catch (error) {
      console.error('[BrowserInit] Login failed:', error)
      throw error
    }
  }

  async logout(): Promise<void> {
    console.log('[BrowserInit] Logout')
    this.currentUser = null
    this.loginCredentials = null
    // TODO: Call Node.js to logout if needed
  }

  getCurrentUser(): any {
    return this.currentUser
  }

  isInitialized(): boolean {
    return this.initialized
  }

  // These return null - no browser ONE.core models
  getLeuteModel(): any {
    // NO BROWSER ONE.CORE - Use IPC
    return null
  }

  getChannelManager(): any {
    // NO BROWSER ONE.CORE - Use IPC
    return null
  }

  getAppModel(): any {
    // NO BROWSER ONE.CORE - Use IPC
    return null
  }
}

export const browserInit = new BrowserInit()