#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all TypeScript errors
const errors = execSync('npx tsc -p tsconfig.main.json --noEmit 2>&1 || true', { encoding: 'utf-8' });

// Parse errors into structured data
const errorLines = errors.split('\n').filter(line => line.includes('error TS'));
const errorMap = new Map();

errorLines.forEach(line => {
  const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
  if (match) {
    const [, file, lineNum, col, code, message] = match;
    if (!errorMap.has(file)) {
      errorMap.set(file, []);
    }
    errorMap.get(file).push({
      line: parseInt(lineNum),
      col: parseInt(col),
      code,
      message
    });
  }
});

// Fix missing property declarations (TS2339, TS2551)
const propertyFixes = new Map();

errorMap.forEach((errors, file) => {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Find class declarations
  const classRegex = /^(export\s+)?class\s+(\w+)/;
  let currentClass = null;
  let classLine = -1;
  let properties = new Set();

  lines.forEach((line, index) => {
    const classMatch = line.match(classRegex);
    if (classMatch) {
      currentClass = classMatch[2];
      classLine = index;
      properties = new Set();
    }

    // Look for property usage errors in this file
    errors.forEach(error => {
      if (error.line === index + 1 && (error.code === 'TS2339' || error.code === 'TS2551')) {
        const propMatch = error.message.match(/Property '(\w+)' does not exist/);
        if (propMatch && currentClass && index > classLine) {
          properties.add(propMatch[1]);
        }
      }
    });
  });

  // Add missing properties to classes
  if (properties.size > 0 && currentClass) {
    console.log(`Adding ${properties.size} properties to ${currentClass} in ${path.basename(file)}`);

    // Find the class opening brace
    let braceIndex = -1;
    for (let i = classLine; i < lines.length; i++) {
      if (lines[i].includes('{')) {
        braceIndex = i;
        break;
      }
    }

    if (braceIndex !== -1) {
      const indent = '  ';
      const propDeclarations = Array.from(properties).map(prop => {
        // Guess the type based on property name
        let type = 'any';
        if (prop.toLowerCase().includes('id')) type = 'string';
        else if (prop.toLowerCase().includes('count')) type = 'number';
        else if (prop.toLowerCase().includes('is') || prop.toLowerCase().includes('has')) type = 'boolean';
        else if (prop.toLowerCase().includes('list') || prop.toLowerCase().includes('array')) type = 'any[]';
        else if (prop.toLowerCase().includes('map')) type = 'Map<string, any>';
        else if (prop.toLowerCase().includes('set')) type = 'Set<any>';

        return `${indent}${prop}: ${type};`;
      }).join('\n');

      lines.splice(braceIndex + 1, 0, propDeclarations);

      // Write back the file
      fs.writeFileSync(filePath, lines.join('\n'));
      propertyFixes.set(file, properties.size);
    }
  }
});

// Fix import issues (TS2307)
const importFixes = new Map();

errorMap.forEach((errors, file) => {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  errors.forEach(error => {
    if (error.code === 'TS2307') {
      const moduleMatch = error.message.match(/Cannot find module '(.+?)'/);
      if (moduleMatch) {
        const modulePath = moduleMatch[1];

        // Common import fixes
        if (modulePath.includes('@refinio/one.core/lib/misc/type-helpers')) {
          // This module doesn't exist, use the correct import
          content = content.replace(
            /@refinio\/one\.core\/lib\/misc\/type-helpers\.js/g,
            '@refinio/one.core/lib/util/type-checks.js'
          );
          modified = true;
        }
      }
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    importFixes.set(file, true);
  }
});

// Summary
console.log('\n=== TypeScript Error Fixes Applied ===\n');
console.log(`Fixed ${propertyFixes.size} files with missing properties`);
console.log(`Fixed ${importFixes.size} files with import issues`);

let totalPropsFixed = 0;
propertyFixes.forEach((count, file) => {
  totalPropsFixed += count;
  console.log(`  - ${path.basename(file)}: ${count} properties added`);
});

console.log(`\nTotal properties added: ${totalPropsFixed}`);

// Check remaining errors
const remainingErrors = execSync('npx tsc -p tsconfig.main.json --noEmit 2>&1 | grep "error TS" | wc -l || true', { encoding: 'utf-8' });
console.log(`\nRemaining TypeScript errors: ${remainingErrors.trim()}`);