console.log('[MAIN] Starting app...')

// ABSOLUTELY CRITICAL: Platform MUST be loaded before ANYTHING else
// This import executes synchronously and sets up the platform
import './platform-init'
// Debug disabled - real instance created by real-browser-instance.ts

console.log('[MAIN] Platform initialized, loading app modules...')

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

console.log('[MAIN] Starting LAMA Electron UI')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)