#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Get all TypeScript uninitialized property errors
const errors = execSync('npx tsc --noEmit 2>&1 || true', { encoding: 'utf8' });
const uninitErrors = errors
  .split('\n')
  .filter(line => line.includes('error TS2564'))
  .map(line => {
    const match = line.match(/^(.+\.ts)\((\d+),\d+\): error TS2564: Property '(.+)' has no initializer/);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2], 10),
        property: match[3]
      };
    }
    return null;
  })
  .filter(Boolean);

console.log(`Found ${uninitErrors.length} uninitialized properties`);

// Group by file
const byFile = {};
for (const error of uninitErrors) {
  if (!byFile[error.file]) {
    byFile[error.file] = [];
  }
  byFile[error.file].push(error);
}

// Process each file
for (const [filePath, fileErrors] of Object.entries(byFile)) {
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;

  for (const error of fileErrors) {
    const lineIndex = error.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) continue;

    const line = lines[lineIndex];

    // Check if property is used in the file
    const propertyUsages = content.match(new RegExp(`this\\.${error.property}\\b`, 'g'));

    if (!propertyUsages || propertyUsages.length === 0) {
      // Property not used, remove it
      console.log(`  Removing unused property ${error.property} in ${path.basename(filePath)}`);
      lines[lineIndex] = '// ' + line + ' // REMOVED: unused property';
      modified = true;
    } else {
      // Property is used, add initializer or make optional
      if (line.includes(':')) {
        // Make it optional with undefined as default
        if (!line.includes('?') && !line.includes(' = ')) {
          const newLine = line.replace(/(\w+):\s*(.+?)(;?)$/, '$1: $2 | undefined$3');
          lines[lineIndex] = newLine;
          console.log(`  Made property ${error.property} optional in ${path.basename(filePath)}`);
          modified = true;
        }
      }
    }
  }

  if (modified) {
    // Clean up commented lines
    const cleanedLines = lines.filter(line => !line.includes('// REMOVED: unused property'));
    fs.writeFileSync(filePath, cleanedLines.join('\n'));
    console.log(`Fixed ${path.basename(filePath)}`);
  }
}

console.log('Done');