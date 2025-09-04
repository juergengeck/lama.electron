#!/usr/bin/env node

// Simple script to trigger login through Electron IPC
import { app } from 'electron'

async function triggerLogin() {
  console.log('[TestLogin] Attempting to trigger login...')
  
  // Import and call the provision function directly
  const { default: nodeProvisioning } = await import('./main/hybrid/node-provisioning.js')
  
  try {
    const result = await nodeProvisioning.provision({
      username: 'demo',
      password: 'demo'
    })
    
    console.log('[TestLogin] Provision result:', JSON.stringify(result, null, 2))
    
    if (result.success) {
      console.log('[TestLogin] ✅ Login successful!')
      console.log('[TestLogin] Node provisioned, pairing should start...')
    } else {
      console.log('[TestLogin] ❌ Login failed:', result.error)
    }
  } catch (error) {
    console.error('[TestLogin] Error:', error)
  }
  
  // Keep the process alive for a bit to see results
  setTimeout(() => {
    console.log('[TestLogin] Test complete')
  }, 10000)
}

// Run after a delay to let the app initialize
setTimeout(triggerLogin, 3000)