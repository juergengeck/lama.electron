/**
 * Authentication IPC Handlers
 */

import authModel from '../../models/auth.js'
import stateManager from '../../state/manager.js'

const authHandlers = {
  async login(event, { username, password }) {
    console.log(`[AuthHandler] Login request for: ${username}`)
    
    const result = await authModel.login(username, password)
    
    if (result.success) {
      // Notify renderer of successful login
      event.sender.send('auth:loginSuccess', result.user)
    }
    
    return result
  },

  async register(event, { username, password, email }) {
    console.log(`[AuthHandler] Register request for: ${username}`)
    
    const result = await authModel.register(username, password, email)
    
    if (result.success) {
      // Notify renderer of successful registration
      event.sender.send('auth:registerSuccess', result.user)
    }
    
    return result
  },

  async logout(event) {
    console.log('[AuthHandler] Logout request')
    
    const result = await authModel.logout()
    
    if (result.success) {
      // Notify renderer of logout
      event.sender.send('auth:logoutSuccess')
    }
    
    return result
  },

  async checkAuth(event) {
    console.log('[AuthHandler] Check auth status')
    
    const result = await authModel.checkAuth()
    
    return result
  }
}

export default authHandlers