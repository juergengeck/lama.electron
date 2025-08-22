/**
 * React hook for LAMA initialization
 */

import { useState, useEffect, useCallback } from 'react'
import { lamaInit } from '../initialization'

export interface LamaAuthState {
  isInitialized: boolean
  isAuthenticated: boolean
  isLoading: boolean
  error: Error | null
  user: { email: string; id: string } | null
}

export function useLamaInit() {
  const [state, setState] = useState<LamaAuthState>({
    isInitialized: false,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    user: null
  })

  // Initialize on mount
  useEffect(() => {
    let mounted = true
    
    const init = async () => {
      // Prevent multiple initializations
      if (!mounted) return
      
      try {
        setState(prev => ({ ...prev, isLoading: true }))
        
        // Create authenticator instance
        await lamaInit.createInstance()
        
        // Check if already logged in (e.g., after hot reload)
        const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance')
        const ownerId = getInstanceOwnerIdHash()
        
        if (ownerId) {
          console.log('[useLamaInit] Already logged in, initializing models...')
          
          // User is already logged in, initialize models
          const appModel = await lamaInit.initModel()
          
          // Connect LamaBridge to the AppModel
          const { lamaBridge } = await import('@/bridge/lama-bridge')
          lamaBridge.setAppModel(appModel)
          
          if (mounted) {
            setState(prev => ({
              ...prev,
              isInitialized: true,
              isAuthenticated: true,
              isLoading: false
            }))
          }
        } else {
          if (mounted) {
            setState(prev => ({
              ...prev,
              isInitialized: true,
              isLoading: false
            }))
          }
        }
      } catch (error) {
        if (mounted) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: error as Error
          }))
        }
      }
    }
    
    init()
    
    return () => {
      mounted = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      // Login or register
      await lamaInit.loginOrRegister(email, password)
      
      // Initialize models
      const appModel = await lamaInit.initModel()
      
      // Connect LamaBridge to the AppModel
      const { lamaBridge } = await import('@/bridge/lama-bridge')
      lamaBridge.setAppModel(appModel)
      
      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false,
        user: { email, id: email }
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }))
      throw error
    }
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    // For LAMA, register uses the same flow as login
    return login(email, password)
  }, [login])

  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      await lamaInit.logout()
      
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
        user: null
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }))
      throw error
    }
  }, [])

  return {
    ...state,
    login,
    register,
    logout,
    getModel: lamaInit.getModel
  }
}