console.log('[MAIN] Starting LAMA app...')

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Initialize platform FIRST
import './initialization/platform'

// Initialize browser ONE.CORE instance (simple version)
import { simpleBrowserInit as browserInit } from './services/browser-init-simple.ts'

async function startApp() {
  try {
    console.log('[MAIN] Checking if ready to show login screen...')
    const initResult = await browserInit.initialize()
    
    if (initResult.ready) {
      console.log('[MAIN] ✅ Ready to show UI (NO ONE.CORE initialized yet)')
      
      ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>,
      )
    } else {
      console.error('[MAIN] ❌ Browser ONE.CORE initialization failed')
      // Still render the app - it can show error state
      ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>,
      )
    }
    
  } catch (error) {
    console.error('[MAIN] Fatal initialization error:', error)
    // Still try to render the app
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  }
}

// Start the application
startApp()