/**
 * Simplified Main Entry - Following one.leute pattern
 */

// Load browser platform FIRST
import '@refinio/one.core/lib/system/load-browser.js'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

import { browserModel } from './services/browser-init'

// Start the app
async function start() {
  console.log('[MAIN] Starting LAMA Browser...')
  
  // Check if already registered
  if (await browserModel.isRegistered()) {
    await browserModel.login()
  }
  
  // Render React app
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

start().catch(console.error)