/**
 * Authentication Model
 * Handles user authentication with ONE.CORE
 */

const instanceManager = require('../core/instance')
const stateManager = require('../state/manager')

class AuthModel {
  constructor() {
    this.currentUser = null
    this.multiUser = null
  }

  async initialize() {
    // Initialize ONE.CORE instance
    await instanceManager.initialize()
    
    // Load MultiUser from one.models
    const { default: MultiUser } = await import('@refinio/one.models/lib/models/Authenticator/MultiUser')
    
    // Create MultiUser instance
    this.multiUser = new MultiUser({
      instanceManager: instanceManager.getInstance(),
      storage: instanceManager.getStorage()
    })
    
    await this.multiUser.init()
    
    console.log('[AuthModel] Initialized')
  }

  async login(username, password) {
    try {
      console.log(`[AuthModel] Attempting login for: ${username}`)
      
      if (!this.multiUser) {
        await this.initialize()
      }
      
      // Attempt login
      const result = await this.multiUser.login(username, password)
      
      if (result.success) {
        this.currentUser = {
          id: result.userId,
          name: username,
          email: result.email || `${username}@lama.local`
        }
        
        // Update state
        stateManager.setUser(this.currentUser)
        
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
      console.log(`[AuthModel] Registering new user: ${username}`)
      
      if (!this.multiUser) {
        await this.initialize()
      }
      
      // Create new user
      const result = await this.multiUser.register({
        username,
        password,
        email: email || `${username}@lama.local`
      })
      
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

module.exports = new AuthModel()