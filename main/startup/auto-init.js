/**
 * Auto-initialization on startup
 * Tries to recover existing instances or prompts for setup
 */

import nodeOneCore from '../core/node-one-core.js';

async function autoInitialize() {
  console.log('[AutoInit] Checking for existing instances...')
  
  try {
    // Don't auto-initialize without a real user
    // The instance will be created when the user logs in via browser
    console.log('[AutoInit] Waiting for user login to initialize Node.js instance')
    return { success: false, needsSetup: true, waitingForUser: true }
    
  } catch (error) {
    console.error('[AutoInit] Auto-initialization check failed:', error)
    return { success: false, error: error.message, needsSetup: true }
  }
}

export { autoInitialize }