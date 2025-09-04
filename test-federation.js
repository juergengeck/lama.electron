// Test script to simulate login and check federation
// Run this in the browser console after the app loads

async function testFederation() {
  console.log('[TEST] Starting federation test...')
  
  // Wait for the app to be ready
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Check if browser instance is available
  if (!window.browserInstance) {
    console.log('[TEST] Browser instance not available, attempting login...')
    
    // Trigger login with test credentials
    const username = 'testuser'
    const password = 'testpass123'
    
    // Call login directly if available
    if (window.browserInstance?.login) {
      console.log('[TEST] Calling login...')
      await window.browserInstance.login(username, password)
    } else {
      console.log('[TEST] Login method not available on window.browserInstance')
    }
  }
  
  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  // Check federation status
  if (window.appModel) {
    const connections = window.appModel.leuteConnectionsModule?.connectionsInfo() || []
    console.log('[TEST] Federation connections:', connections.length)
    
    connections.forEach(conn => {
      console.log('[TEST] Connection:', {
        id: conn.id?.substring(0, 20),
        isConnected: conn.isConnected,
        remotePersonId: conn.remotePersonId?.substring(0, 8),
        protocolName: conn.protocolName
      })
    })
  } else {
    console.log('[TEST] AppModel not available on window')
  }
  
  // Check if we can see the pairing invitation
  if (window.nodeInstanceInfo) {
    console.log('[TEST] Node instance info available:', {
      nodeId: window.nodeInstanceInfo.nodeId,
      endpoint: window.nodeInstanceInfo.endpoint,
      hasPairingInvite: !!window.nodeInstanceInfo.pairingInvite
    })
  } else {
    console.log('[TEST] No node instance info available')
  }
}

// Instructions for manual testing
console.log(`
=== FEDERATION TEST INSTRUCTIONS ===

To test federation manually:

1. Open browser DevTools (Cmd+Option+I)
2. Login with any username/password
3. Wait for initialization messages
4. Run: testFederation()

Or paste this to auto-login:
  window.browserInstance?.login('testuser', 'testpass123')

Then check:
  window.appModel?.leuteConnectionsModule?.connectionsInfo()
  window.nodeInstanceInfo
`)