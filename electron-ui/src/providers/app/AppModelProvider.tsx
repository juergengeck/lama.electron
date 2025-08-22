import React, { createContext, useEffect, useState } from 'react'
import type AppModel from '@/models/AppModel'

interface AppModelContextValue {
  appModel: AppModel | null
  isReady: boolean
}

export const AppModelContext = createContext<AppModelContextValue | null>(null)

export function AppModelProvider({ 
  children, 
  appModel 
}: { 
  children: React.ReactNode
  appModel: AppModel | null 
}) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (appModel) {
      setIsReady(true)
    }
  }, [appModel])

  return (
    <AppModelContext.Provider value={{ appModel, isReady }}>
      {children}
    </AppModelContext.Provider>
  )
}