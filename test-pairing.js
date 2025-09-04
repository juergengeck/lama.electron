/**
 * Test script to verify pairing invitation logic
 * Simulates the browser-node pairing flow
 */

console.log("=== Testing Pairing Invitation Logic ===")

// Test 1: Verify nodeInstanceInfo structure
console.log("\n1. Testing nodeInstanceInfo structure...")

// Simulate what gets stored in window.nodeInstanceInfo
const mockNodeInstanceInfo = {
  nodeId: "test-node-123",
  endpoint: "ws://localhost:8765",
  pairingInvite: {
    token: JSON.stringify({
      token: "mock-token",
      publicKey: "mock-public-key", 
      url: "ws://localhost:8765"
    }),
    raw: {
      token: "mock-token",
      publicKey: "mock-public-key",
      url: "ws://localhost:8765"
    },
    url: "https://internal.lama.app/invite#encoded-data"
  }
}

console.log("Mock nodeInstanceInfo:", JSON.stringify(mockNodeInstanceInfo, null, 2))

// Test 2: Check the logic
console.log("\n2. Testing pairing invitation logic...")

if (mockNodeInstanceInfo?.pairingInvite) {
  console.log("✅ Found pairing invitation")
  console.log("- Has raw invitation:", !!mockNodeInstanceInfo.pairingInvite.raw)
  console.log("- Raw invitation URL:", mockNodeInstanceInfo.pairingInvite.raw.url)
  console.log("- Token available:", !!mockNodeInstanceInfo.pairingInvite.raw.token)
  console.log("- Public key available:", !!mockNodeInstanceInfo.pairingInvite.raw.publicKey)
} else {
  console.log("❌ No pairing invitation found")
}

console.log("\n=== Test Complete ===")
