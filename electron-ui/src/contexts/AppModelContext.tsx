/**
 * AppModel Context Provider
 * Browser uses IPC only - NO AppModel, NO ONE.core
 */

import React, { createContext, useContext, useEffect, useState } from 'react'

interface AppModelContextType {
  // NO AppModel in browser - everything via IPC
  isInitialized: boolean
  error: Error | null
  initializeApp: (userId: string) => Promise<void>
}

const AppModelContext = createContext<AppModelContextType | undefined>(undefined)

export function AppModelProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const initializeApp = async (userId: string) => {
    try {
      console.log('[AppModelProvider] Browser UI ready - using IPC only')
      
      // Browser doesn't initialize AppModel - just marks as ready
      // All operations go through IPC to Node.js
      setIsInitialized(true)
      setError(null)
      
      console.log('[AppModelProvider] UI initialized successfully')
    } catch (err) {
      console.error('[AppModelProvider] Failed to initialize:', err)
      setError(err as Error)
      setIsInitialized(false)
    }
  }

  // No cleanup needed - browser has no AppModel
  useEffect(() => {
    return () => {
      console.log('[AppModelProvider] UI context cleanup')
    }
  }, [])

  return (
    <AppModelContext.Provider value={{ isInitialized, error, initializeApp }}>
      {children}
    </AppModelContext.Provider>
  )
}

export function useAppModel() {
  const context = useContext(AppModelContext)
  if (!context) {
    throw new Error('useAppModel must be used within AppModelProvider')
  }
  return context
}