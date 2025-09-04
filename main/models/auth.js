/**
 * Authentication Model
 * Handles user authentication with ONE.CORE
 */

import instanceManager from '../core/instance.js';
import stateManager from '../state/manager.js';
import nodeOneCore from '../core/node-one-core.js';

class AuthModel {
  constructor() {
    this.currentUser = null
    this.multiUser = null
  }

  async initialize() {
    // AUTH MODEL DOES NOT INITIALIZE NODE
    // Node initialization happens only through provision:node IPC handler
    // This prevents competing control flows
    console.log('[AuthModel] Skipping initialization - handled by provision:node')
    return
  }

  async login(username, password) {
    try {
      console.log(`[AuthModel] Login not handled here - browser handles auth`)
      
      // AUTH MODEL DOES NOT HANDLE LOGIN
      // Browser handles login and provisions Node via IPC
      // This prevents competing control flows
      return {
        success: false,
        error: 'Login must be initiated from browser UI'
      }
      
      if (result.success) {
        this.currentUser = {
          id: result.userId,
          name: username,
          email: result.email || `${username}@lama.local`
        }
        
        // Update state
        stateManager.setUser(this.currentUser)
        
        // Node provisioning is handled separately through provision:node IPC
        // This prevents duplicate initialization attempts
        console.log('[AuthModel] Node provisioning will be handled by browser through provision:node')
        
        console.log('[AuthModel] Login successful')
        return {
          success: true,
          user: this.currentUser
        }
      } else {
        console.log('[AuthModel] Login failed:', result.error)
        return {
          success: false,
          error: result.error || 'Invalid credentials'
        }
      }
    } catch (error) {
      console.error('[AuthModel] Login error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async register(username, password, email = null) {
    try {
      console.log(`[AuthModel] Registration not handled here - browser handles auth`)
      
      // AUTH MODEL DOES NOT HANDLE REGISTRATION
      // Browser handles registration and provisions Node via IPC
      // This prevents competing control flows
      return {
        success: false,
        error: 'Registration must be initiated from browser UI'
      }
      
      if (result.success) {
        // Auto-login after registration
        return await this.login(username, password)
      } else {
        return {
          success: false,
          error: result.error || 'Registration failed'
        }
      }
    } catch (error) {
      console.error('[AuthModel] Registration error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async logout() {
    try {
      if (this.multiUser) {
        await this.multiUser.logout()
      }
      
      this.currentUser = null
      stateManager.clearUser()
      
      console.log('[AuthModel] Logged out')
      return { success: true }
    } catch (error) {
      console.error('[AuthModel] Logout error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async checkAuth() {
    if (!this.multiUser) {
      return { authenticated: false }
    }
    
    const isAuthenticated = await this.multiUser.isAuthenticated()
    
    if (isAuthenticated && !this.currentUser) {
      // Restore user info
      const userId = await this.multiUser.getCurrentUserId()
      this.currentUser = {
        id: userId,
        name: 'User',
        email: 'user@lama.local'
      }
      stateManager.setUser(this.currentUser)
    }
    
    return {
      authenticated: isAuthenticated,
      user: this.currentUser
    }
  }

  getCurrentUser() {
    return this.currentUser
  }

  isAuthenticated() {
    return this.currentUser !== null
  }
}

export default new AuthModel()