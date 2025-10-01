#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Get all TypeScript errors
const errors = execSync('npx tsc --noEmit 2>&1 || true', { encoding: 'utf8' });

// Parse implicit any errors
const implicitAnyErrors = [];
const lines = errors.split('\n');

for (const line of lines) {
  const match = line.match(/^(.+?)\((\d+),(\d+)\): error TS7006: Parameter '(.+?)' implicitly has an 'any' type/);
  if (match) {
    implicitAnyErrors.push({
      file: match[1],
      line: parseInt(match[2]),
      column: parseInt(match[3]),
      param: match[4]
    });
  }
}

// Group by file
const errorsByFile = {};
for (const error of implicitAnyErrors) {
  if (!errorsByFile[error.file]) {
    errorsByFile[error.file] = [];
  }
  errorsByFile[error.file].push(error);
}

console.log(`Found ${implicitAnyErrors.length} implicit any parameters in ${Object.keys(errorsByFile).length} files`);

// Fix each file
for (const [filePath, fileErrors] of Object.entries(errorsByFile)) {
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Sort errors by line number in reverse order (to not mess up line numbers when fixing)
  fileErrors.sort((a, b) => b.line - a.line);

  for (const error of fileErrors) {
    const lineIdx = error.line - 1;
    if (lineIdx >= lines.length) continue;

    const line = lines[lineIdx];
    const param = error.param;

    // Common patterns to fix
    const patterns = [
      // Arrow function parameters
      {
        regex: new RegExp(`\\b(${param})\\s*=>`, 'g'),
        replacement: `(${param}: any) =>`
      },
      // Regular function parameters
      {
        regex: new RegExp(`\\((.*?)\\b(${param})\\b(?!:)`, 'g'),
        replacement: `($1${param}: any`
      },
      // .map, .filter, .forEach, .find callbacks
      {
        regex: new RegExp(`\\.(map|filter|forEach|find|some|every|reduce)\\((${param})\\s*=>`, 'g'),
        replacement: `.$1((${param}: any) =>`
      },
      // async arrow functions
      {
        regex: new RegExp(`async\\s+\\((.*?)\\b(${param})\\b(?!:)`, 'g'),
        replacement: `async ($1${param}: any`
      },
    ];

    let fixed = false;
    for (const pattern of patterns) {
      if (line.match(pattern.regex)) {
        lines[lineIdx] = line.replace(pattern.regex, pattern.replacement);
        fixed = true;
        break;
      }
    }

    if (!fixed) {
      // Fallback: just add : any after the parameter
      const regex = new RegExp(`\\b(${param})\\b(?!:)`, 'g');
      lines[lineIdx] = line.replace(regex, `${param}: any`);
    }
  }

  const newContent = lines.join('\n');
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent);
    console.log(`Fixed ${fileErrors.length} parameters in ${path.basename(filePath)}`);
  }
}

// Check how many errors remain
const remaining = execSync('npx tsc --noEmit 2>&1 | grep "implicitly has an .any. type" | wc -l', { encoding: 'utf8' }).trim();
console.log(`\nRemaining implicit any errors: ${remaining}`);