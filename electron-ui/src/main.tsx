console.log('[MAIN] Starting LAMA app...')
console.log('[MAIN] window.electronAPI available?', typeof window !== 'undefined' && !!window.electronAPI)
if (typeof window !== 'undefined' && window.electronAPI) {
  console.log('[MAIN] ✅ electronAPI is available with methods:', Object.keys(window.electronAPI))
  // Force a test message to main process
  if (window.electronAPI.log) {
    window.electronAPI.log('[MAIN] TEST - electronAPI is working!')
  }
} else {
  console.error('[MAIN] ❌ electronAPI is NOT available - preload script may not have run')
  // Try again after a delay
  setTimeout(() => {
    if (window.electronAPI && window.electronAPI.log) {
      window.electronAPI.log('[MAIN] DELAYED TEST - electronAPI now available!')
    }
  }, 1000)
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize platform FIRST
import './initialization/platform'

// Initialize browser ONE.CORE instance (simple version)
import { browserInit as browserInit } from './services/browser-init.ts'

async function startApp() {
  try {
    console.log('[MAIN] Checking if ready to show login screen...')
    const initResult = await browserInit.initialize()
    
    if (initResult.ready) {
      console.log('[MAIN] ✅ Ready to show UI (NO ONE.CORE initialized yet)')
      
      ReactDOM.createRoot(document.getElementById('root')!).render(
        <App />
      )
    } else {
      console.error('[MAIN] ❌ Browser ONE.CORE initialization failed')
      // Still render the app - it can show error state
      ReactDOM.createRoot(document.getElementById('root')!).render(
        <App />
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

// Development: Restart Node.js instance when HMR reloads the page
if (import.meta.hot) {
  import.meta.hot.on('vite:beforeFullReload', async () => {
    console.log('[MAIN] Vite HMR full reload detected - restarting Node.js instance...')
    if (window.electronAPI && window.electronAPI.invoke) {
      try {
        const result = await window.electronAPI.invoke('onecore:restartNode')
        console.log('[MAIN] Node restart result:', result)
      } catch (error) {
        console.error('[MAIN] Failed to restart Node instance:', error)
      }
    }
  })
}