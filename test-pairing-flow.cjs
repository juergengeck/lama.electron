#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');

console.log('=== Testing LAMA Electron Pairing Flow ===\n');

// Step 1: Clear storage
console.log('Step 1: Clearing storage...');
exec('./clear-all-storage.sh', (err, stdout, stderr) => {
  if (err) {
    console.error('Failed to clear storage:', err);
    return;
  }
  console.log('Storage cleared.\n');
  
  // Step 2: Start the app
  console.log('Step 2: Starting LAMA Electron...');
  const child = exec('npm run electron', { 
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  let output = '';
  let foundPairing = false;
  
  // Monitor output
  child.stdout.on('data', (data) => {
    output += data;
    process.stdout.write(data);
    
    // Look for pairing-related logs
    if (data.includes('NodeProvisioning')) {
      console.log('\n[TEST] Found NodeProvisioning log');
    }
    if (data.includes('pairing') || data.includes('Pairing')) {
      console.log('\n[TEST] Found pairing-related log');
      foundPairing = true;
    }
    if (data.includes('pairingInvite')) {
      console.log('\n[TEST] Found pairingInvite reference');
    }
    if (data.includes('InitFlow')) {
      console.log('\n[TEST] Found InitFlow log'); 
    }
  });
  
  child.stderr.on('data', (data) => {
    process.stderr.write(data);
  });
  
  // Give it 15 seconds then kill
  setTimeout(() => {
    console.log('\n\n=== Test Summary ===');
    console.log('Found pairing logs:', foundPairing);
    
    // Count key log entries
    const nodeLogs = (output.match(/\[NodeProvisioning\]/g) || []).length;
    const initLogs = (output.match(/\[InitFlow\]/g) || []).length;
    const pairingLogs = (output.match(/pairing/gi) || []).length;
    
    console.log('NodeProvisioning logs:', nodeLogs);
    console.log('InitFlow logs:', initLogs);
    console.log('Pairing mentions:', pairingLogs);
    
    child.kill();
    process.exit(0);
  }, 15000);
});