#!/usr/bin/env node

import fs from 'fs';

console.log('Fixing final syntax errors...\n');

// Fix main/core/node-one-core.ts
const nodeFile = './main/core/node-one-core.ts';
if (fs.existsSync(nodeFile)) {
  let content = fs.readFileSync(nodeFile, 'utf8');

  // Fix this.instance!Name -> this.instanceName
  content = content.replace(/this\.instance!Name/g, 'this.instanceName');
  content = content.replace(/this\.instance!Module/g, 'this.instanceModule');

  // Fix other invalid syntax from our automated fixes
  content = content.replace(/this\.instance!/g, 'this.instance');

  fs.writeFileSync(nodeFile, content);
  console.log('Fixed main/core/node-one-core.ts');
}

// Fix main/types/extended-types.ts
const typesFile = './main/types/extended-types.ts';
if (fs.existsSync(typesFile)) {
  let content = fs.readFileSync(typesFile, 'utf8');

  // Remove all remaining broken module declarations
  const lines = content.split('\n');
  const fixedLines = [];
  let skipUntilEnd = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip broken declare module blocks
    if (line.includes('declare module') && (line.includes('@refinio') || line.includes('oneObjectInterfaces'))) {
      skipUntilEnd = true;
      continue;
    }

    if (skipUntilEnd && line.trim() === '}') {
      skipUntilEnd = false;
      continue;
    }

    if (!skipUntilEnd) {
      fixedLines.push(line);
    }
  }

  content = fixedLines.join('\n');

  // Clean up any remaining broken syntax
  content = content.replace(/\/\/ MessageAttestation type removed due to compatibility issues[^}]+}/gs, '');

  fs.writeFileSync(typesFile, content);
  console.log('Fixed main/types/extended-types.ts');
}

// Fix any remaining issues in refinio-api-server.ts
const apiFile = './main/api/refinio-api-server.ts';
if (fs.existsSync(apiFile)) {
  let content = fs.readFileSync(apiFile, 'utf8');

  // Fix any remaining instance! issues
  content = content.replace(/this\.instance!/g, 'this.instance');

  fs.writeFileSync(apiFile, content);
  console.log('Fixed main/api/refinio-api-server.ts');
}

console.log('\nDone!');