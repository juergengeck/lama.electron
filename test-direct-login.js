// Direct login test - add to main process temporarily

async function testDirectLogin() {
  console.log('[TestDirectLogin] Starting direct login test...')
  
  const { default: nodeProvisioning } = await import('./main/services/node-provisioning.js')
  
  // Directly provision the Node
  const result = await nodeProvisioning.provision({
    user: {
      name: 'testuser',
      password: 'testpass123'
    }
  })
  
  console.log('[TestDirectLogin] Provisioning result:', result)
  
  if (result.success) {
    console.log('[TestDirectLogin] ✅ Node provisioned successfully')
    console.log('[TestDirectLogin] Node ID:', result.nodeId)
    console.log('[TestDirectLogin] Pairing invite available:', !!result.pairingInvite)
  } else {
    console.log('[TestDirectLogin] ❌ Provisioning failed:', result.error)
  }
}

// Export for use in main process
export { testDirectLogin }