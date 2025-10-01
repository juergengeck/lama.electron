#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Find all TypeScript files
const files = await glob('main/**/*.ts', { absolute: true });

let totalFixed = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Replace private with public for properties that need external access
  // This is a simple fix - ideally we'd use proper getters/setters
  content = content.replace(/^\s*private\s+(\w+):/gm, (match, propName) => {
    // Keep some things private
    if (propName.startsWith('_') || propName === 'password' || propName === 'secret') {
      return match;
    }
    // Make others public
    modified = true;
    return match.replace('private', 'public');
  });

  if (modified) {
    fs.writeFileSync(file, content);
    console.log(`Fixed: ${path.basename(file)}`);
    totalFixed++;
  }
}

console.log(`\nFixed ${totalFixed} files`);