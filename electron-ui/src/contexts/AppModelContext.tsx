/**
 * AppModel Context Provider
 * Provides access to the initialized AppModel throughout the application
 */

import React, { createContext, useContext, useEffect, useState } from 'react'
import { AppModel } from '../models/AppModel'
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks'
import type { Person } from '@refinio/one.core/lib/recipes'

interface AppModelContextType {
  appModel: AppModel | null
  isInitialized: boolean
  error: Error | null
  initializeApp: (userId: SHA256IdHash<Person>) => Promise<void>
}

const AppModelContext = createContext<AppModelContextType | undefined>(undefined)

export function AppModelProvider({ children }: { children: React.ReactNode }) {
  const [appModel, setAppModel] = useState<AppModel | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const initializeApp = async (userId: SHA256IdHash<Person>) => {
    try {
      console.log('[AppModelProvider] Initializing app...')
      
      // Create and initialize AppModel
      const model = new AppModel({
        name: 'LAMA Electron',
        version: '1.0.0'
      })
      
      await model.init(userId)
      
      setAppModel(model)
      setIsInitialized(true)
      setError(null)
      
      console.log('[AppModelProvider] App initialized successfully')
    } catch (err) {
      console.error('[AppModelProvider] Failed to initialize app:', err)
      setError(err as Error)
      setIsInitialized(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (appModel) {
        console.log('[AppModelProvider] Shutting down app model...')
        appModel.shutdown().catch(console.error)
      }
    }
  }, [appModel])

  return (
    <AppModelContext.Provider value={{ appModel, isInitialized, error, initializeApp }}>
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