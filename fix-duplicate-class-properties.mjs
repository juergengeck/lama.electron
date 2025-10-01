#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Get all TypeScript files with duplicate property errors
const errors = execSync('npx tsc --noEmit 2>&1 || true', { encoding: 'utf8' });
const duplicateErrors = errors
  .split('\n')
  .filter(line => line.includes('error TS2300'))
  .map(line => {
    const match = line.match(/^(.+\.ts)\((\d+),\d+\): error TS2300: Duplicate identifier '(.+)'\./);
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

// Group errors by file
const errorsByFile = {};
for (const error of duplicateErrors) {
  if (!errorsByFile[error.file]) {
    errorsByFile[error.file] = [];
  }
  errorsByFile[error.file].push(error);
}

// Process each file
for (const [filePath, fileErrors] of Object.entries(errorsByFile)) {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${filePath} (not found)`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Find and remove duplicate property declarations
  const propertiesToRemove = new Set();
  const publicDeclarations = {};

  // First pass: find public declarations
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const publicMatch = line.match(/^\s*public\s+(\w+):\s*any;?\s*$/);
    if (publicMatch) {
      const propName = publicMatch[1];
      publicDeclarations[propName] = i;
    }
  }

  // Second pass: find typed declarations
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const typedMatch = line.match(/^\s*(\w+):\s*[^=]+;?\s*$/);
    if (typedMatch && !line.includes('public') && !line.includes('private')) {
      const propName = typedMatch[1];
      if (publicDeclarations[propName] !== undefined && publicDeclarations[propName] !== i) {
        // We have both public and typed declaration
        // Remove the 'public any' version
        propertiesToRemove.add(publicDeclarations[propName]);
      }
    }
  }

  // Remove duplicate lines
  const newLines = lines.filter((_, index) => !propertiesToRemove.has(index));

  if (propertiesToRemove.size > 0) {
    fs.writeFileSync(filePath, newLines.join('\n'));
    console.log(`Fixed ${propertiesToRemove.size} duplicate properties in ${path.basename(filePath)}`);
  }
}

console.log('Done fixing duplicate properties');