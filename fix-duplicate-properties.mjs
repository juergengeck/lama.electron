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

  // Remove duplicate private property declarations
  const lines = content.split('\n');
  const seenProperties = new Set();
  const filteredLines = [];

  for (let line of lines) {
    // Check if this is a property declaration
    const propMatch = line.match(/^\s*(?:private|public|protected)?\s+(\w+):\s*any;?\s*$/);

    if (propMatch) {
      const propName = propMatch[1];
      if (seenProperties.has(propName)) {
        // Skip duplicate
        modified = true;
        console.log(`Removing duplicate property '${propName}' from ${path.basename(file)}`);
        continue;
      }
      seenProperties.add(propName);
    }

    filteredLines.push(line);
  }

  if (modified) {
    content = filteredLines.join('\n');
    fs.writeFileSync(file, content);
    totalFixed++;
  }
}

console.log(`\nFixed ${totalFixed} files`);