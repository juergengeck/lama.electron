/**
 * Authentication Model
 * Handles user authentication with ONE.CORE
 */

import instanceManager from '../core/instance.js';
import stateManager from '../state/manager.js';
import nodeOneCore from '../core/node-one-core.js';

class AuthModel {
  public currentUser: any;
  public multiUser: any;

  constructor() {

    this.currentUser = null
    this.multiUser = null
}

  async initialize(): Promise<any> {
    // AUTH MODEL DOES NOT INITIALIZE NODE
    // Node initialization happens only through provision:node IPC handler
    // This prevents competing control flows
    console.log('[AuthModel] Skipping initialization - handled by provision:node')
    return
  }

  async login(username: any, password: any): Promise<any> {
    try {
      console.log(`[AuthModel] Login not handled here - browser handles auth`)
      
      // AUTH MODEL DOES NOT HANDLE LOGIN
      // Browser handles login and provisions Node via IPC
      // This prevents competing control flows
      return {
        success: false,
        error: 'Login must be initiated from browser UI'
      }

    } catch (error) {
      console.error('[AuthModel] Login error:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  async register(username: any, password: any, email = null): Promise<unknown> {
    try {
      console.log(`[AuthModel] Registration not handled here - browser handles auth`)
      
      // AUTH MODEL DOES NOT HANDLE REGISTRATION
      // Browser handles registration and provisions Node via IPC
      // This prevents competing control flows
      return {
        success: false,
        error: 'Registration must be initiated from browser UI'
      }
    } catch (error) {
      console.error('[AuthModel] Registration error:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  async logout(): Promise<any> {
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
        error: (error as Error).message
      }
    }
  }

  async checkAuth(): Promise<any> {
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

  getCurrentUser(): any {
    return this.currentUser
  }

  isAuthenticated(): any {
    return this.currentUser !== null
  }
}

export default new AuthModel()