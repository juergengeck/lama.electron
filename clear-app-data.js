#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Get common app data paths
const homeDir = os.homedir();
const appName = 'LAMA';

// Electron app data is typically stored here
const electronAppData = path.join(homeDir, 'Library', 'Application Support', appName);

console.log('Checking for LAMA app data...\n');

const possiblePaths = [
  electronAppData,
  path.join(homeDir, '.one.storage'),
  path.join(homeDir, '.lama'),
  path.join(homeDir, 'Library', 'Application Support', 'LAMA-Desktop'),
  path.join(homeDir, '.config', 'LAMA'),
  path.join(homeDir, '.local', 'share', 'LAMA')
];

console.log('Storage locations found:');
let foundAny = false;
possiblePaths.forEach(p => {
  if (fs.existsSync(p)) {
    foundAny = true;
    const stats = fs.statSync(p);
    console.log(`\n  ${p}`);
    if (stats.isDirectory()) {
      try {
        const files = fs.readdirSync(p);
        console.log(`    Contains ${files.length} items`);
        if (files.length <= 10) {
          files.forEach(f => console.log(`      - ${f}`));
        }
      } catch (e) {
        console.log(`    (cannot read contents)`);
      }
    }
  }
});

if (!foundAny) {
  console.log('  No LAMA data directories found.');
}

console.log('\nTo delete all app data, you can run:');
possiblePaths.forEach(p => {
  if (fs.existsSync(p)) {
    console.log(`  rm -rf "${p}"`);
  }
});

process.exit(0);