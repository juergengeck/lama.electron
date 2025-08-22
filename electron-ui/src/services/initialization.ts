/**
 * Initialization service for setting up the ONE platform and models
 */

import { AppModel } from '../models/AppModel'
import { lamaBridge } from '../bridge/lama-bridge'
// Types will be defined locally to avoid importing from one.core
type SHA256IdHash = string
type Person = { name?: string; id: string }

// Global app model instance
let globalAppModel: AppModel | null = null

/**
 * Initialize the application with ONE platform
 */
export async function initializeApp(): Promise<AppModel> {
  console.log('[Initialization] Starting app initialization...')
  
  try {
    // Check if already initialized
    if (globalAppModel && globalAppModel.isReady()) {
      console.log('[Initialization] App already initialized')
      return globalAppModel
    }
    
    // Initialize ONE platform storage
    const { initOneStorage } = await import('./storage')
    await initOneStorage()
    
    // Get or create user identity
    const userId = await getOrCreateUserIdentity()
    
    // Create and initialize AppModel
    const appModel = new AppModel({
      name: 'LAMA Electron',
      version: '1.0.0'
    })
    
    await appModel.init(userId)
    
    // Connect lamaBridge to AppModel
    lamaBridge.setAppModel(appModel)
    
    // Store global reference
    globalAppModel = appModel
    
    // Make available for debugging
    if (typeof window !== 'undefined') {
      (window as any).appModel = appModel
    }
    
    console.log('[Initialization] App initialized successfully')
    return appModel
  } catch (error) {
    console.error('[Initialization] Failed to initialize app:', error)
    throw error
  }
}

/**
 * Get existing user identity or create a new one
 */
async function getOrCreateUserIdentity(): Promise<SHA256IdHash<Person>> {
  // For now, create a mock identity
  // In real implementation, this would check storage for existing identity
  // or prompt user to create/import one
  
  console.log('[Initialization] Creating user identity...')
  
  // Import ONE core functions
  const { Person } = await import('@refinio/one.core/lib/recipes.js')
  const { createLocalPerson } = await import('@refinio/one.core/lib/storage/persons.js')
  
  try {
    // Try to get existing person
    const existingPersons = await Person.query()
    if (existingPersons.length > 0) {
      console.log('[Initialization] Using existing identity')
      return existingPersons[0].idHash
    }
  } catch (err) {
    console.log('[Initialization] No existing identity found, creating new one')
  }
  
  // Create new person
  const person = await createLocalPerson()
  console.log('[Initialization] Created new identity:', person.idHash)
  
  return person.idHash
}

/**
 * Shutdown the application
 */
export async function shutdownApp(): Promise<void> {
  console.log('[Initialization] Shutting down app...')
  
  if (globalAppModel) {
    await globalAppModel.shutdown()
    globalAppModel = null
  }
  
  console.log('[Initialization] App shutdown complete')
}

/**
 * Get the global app model instance
 */
export function getAppModel(): AppModel | null {
  return globalAppModel
}

/**
 * Check if app is initialized
 */
export function isAppInitialized(): boolean {
  return globalAppModel !== null && globalAppModel.isReady()
}