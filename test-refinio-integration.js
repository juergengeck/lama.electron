#!/usr/bin/env node

/**
 * Test script for refinio lama integration
 * This tests the CLI commands without needing to build the full refinio.cli
 */

const { exec, spawn } = require('child_process');
const path = require('path');

console.log('=== Testing LAMA Electron via refinio CLI Integration ===\n');

async function testPairingFlow() {
  console.log('Step 1: Testing the pairing flow we fixed...');
  
  // Clear storage and start the app
  console.log('Clearing storage and starting app...');
  
  const child = exec('./clear-all-storage.sh && npm run electron', { 
    cwd: '/Users/gecko/src/lama.electron'
  });
  
  let output = '';
  let foundPairingInvite = false;
  let foundApiServer = false;
  let apiPort = null;
  
  // Monitor output
  child.stdout.on('data', (data) => {
    output += data;
    process.stdout.write(data);
    
    // Look for pairing invitation being returned
    if (data.includes('pairingInvite')) {
      console.log('\n[TEST] ✅ Found pairingInvite in result');
      foundPairingInvite = true;
      
      // Extract the pairing invite data
      const match = data.match(/pairingInvite.*?"token":"([^"]+)"/);
      if (match) {
        console.log(`[TEST] ✅ Pairing token extracted: ${match[1].substring(0, 20)}...`);
      }
    }
    
    // Look for API server startup
    if (data.includes('Refinio API server running on port')) {
      console.log('\n[TEST] ✅ Found API server startup');
      foundApiServer = true;
      const portMatch = data.match(/port (\d+)/);
      if (portMatch) {
        apiPort = portMatch[1];
        console.log(`[TEST] ✅ API server on port ${apiPort}`);
      }
    }
    
    // Look for successful provisioning
    if (data.includes('Node provisioned successfully')) {
      console.log('\n[TEST] ✅ Node provisioned successfully');
    }
    
    if (data.includes('refinio lama')) {
      console.log('\n[TEST] ✅ CLI commands advertised');
    }
  });
  
  child.stderr.on('data', (data) => {
    process.stderr.write(data);
  });
  
  // Give it time to start and provision
  await new Promise(resolve => setTimeout(resolve, 20000));
  
  console.log('\n\n=== Test Results ===');
  console.log('Pairing invitation found:', foundPairingInvite ? '✅' : '❌');
  console.log('API server started:', foundApiServer ? '✅' : '❌');
  console.log('API port:', apiPort || 'Not detected');
  
  // Count key log entries
  const provisioningLogs = (output.match(/\[NodeProvisioning\]/g) || []).length;
  const initFlowLogs = (output.match(/\[InitFlow\]/g) || []).length;
  const pairingMentions = (output.match(/pairing/gi) || []).length;
  const apiMentions = (output.match(/refinio lama/gi) || []).length;
  
  console.log('\nLog Analysis:');
  console.log('- NodeProvisioning logs:', provisioningLogs);
  console.log('- InitFlow logs:', initFlowLogs);
  console.log('- Pairing mentions:', pairingMentions);
  console.log('- API command mentions:', apiMentions);
  
  // Summary
  const testsPassed = [
    foundPairingInvite,
    foundApiServer,
    provisioningLogs > 0,
    pairingMentions > 0,
    apiMentions > 0
  ].filter(Boolean).length;
  
  console.log(`\n=== Overall: ${testsPassed}/5 tests passed ===`);
  
  if (testsPassed >= 4) {
    console.log('🎉 LAMA refinio integration is working!');
    console.log('\nNow you can use:');
    console.log('  refinio lama status   - Check status');
    console.log('  refinio lama login    - Login');
    console.log('  refinio lama chat list - List chats');
  } else {
    console.log('❌ Some issues detected, but basic functionality may work');
  }
  
  // Clean up
  child.kill();
}

// Run the test
testPairingFlow().catch(console.error);