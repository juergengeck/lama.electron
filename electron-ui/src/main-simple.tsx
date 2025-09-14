/**
 * Simplified Main Entry - Browser UI only (no ONE.core)
 */

// NO ONE.core in browser - everything via IPC

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