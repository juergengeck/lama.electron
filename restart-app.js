#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// Wait a moment for the old process to fully exit
setTimeout(() => {
  console.log('Restarting LAMA app...');
  
  // Use the electron binary directly for more reliable restart
  const electronPath = path.join(__dirname, 'electron-ui', 'node_modules', '.bin', 'electron');
  const mainFile = path.join(__dirname, 'lama-electron-shadcn.js');
  
  // Start the app in a detached process
  const child = spawn(electronPath, [mainFile], {
    cwd: __dirname,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  // Allow the parent to exit
  child.unref();
  
  console.log('LAMA app restarted');
  process.exit(0);
}, 2000);