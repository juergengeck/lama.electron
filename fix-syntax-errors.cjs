#!/usr/bin/env node

/**
 * Fix syntax errors introduced by the previous script
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to fix
const fixes = [
  // Fix duplicated arrow function parameters
  {
    pattern: /onStream:\s*\([^)]+\)\s*=>\s*[^)]+\)\s*=>\s*{/g,
    fix: (match) => {
      // Extract the parameter name and type
      const paramMatch = match.match(/onStream:\s*\(([^:]+):\s*([^)]+)\)/);
      if (paramMatch) {
        return `onStream: (${paramMatch[1]}: ${paramMatch[2]}) => {`;
      }
      return match;
    }
  },

  // Fix malformed substring calls
  {
    pattern: /\.\(String\(([^)]+)\)\)\.substring/g,
    fix: (match, prop) => `.${prop}?.substring`
  },

  // Fix incorrect property access patterns
  {
    pattern: /([a-zA-Z_]\w*)\.(String\([^)]+\))\.substring/g,
    fix: (match, obj, cast) => `(String(${obj})).substring`
  },

  // Fix double type casting
  {
    pattern: /\(([^)]+) as \{ ([^}]+) \}\)\.\2/g,
    fix: (match, obj, prop) => `(${obj} as any).${prop}`
  },

  // Fix broken catch blocks
  {
    pattern: /catch\s*\(error:\s*any\)\s*{/g,
    fix: () => 'catch (error) {'
  },

  // Fix incorrect array access patterns
  {
    pattern: /\[0\] as \{ ([^}]+) \}\)\.\1/g,
    fix: (match, prop) => `[0]?.${prop}`
  },

  // Fix duplicate type definitions in parameters
  {
    pattern: /\(([^:]+):\s*([^)]+)\)\s*=>\s*\1:\s*\2\)\s*=>/g,
    fix: (match, param, type) => `(${param}: ${type}) =>`
  },

  // Fix incorrect ChannelManager type assignments
  {
    pattern: /const\s+([^:]+):\s*ChannelManager\s*=\s*await[^;]+getMatchingChannelInfos/g,
    fix: (match, varName) => {
      return match.replace(`: ChannelManager`, '');
    }
  },

  // Fix incorrect ConnectionsModel type assignments
  {
    pattern: /const\s+([^:]+):\s*ConnectionsModel\s*=\s*[^;]+\["leuteConnectionsModule"/g,
    fix: (match) => {
      return match.replace(`: ConnectionsModel`, '');
    }
  },

  // Fix property access with incorrect String casting
  {
    pattern: /([a-zA-Z_]\w*)\.(String\(([^)]+)\))/g,
    fix: (match, obj, cast, prop) => {
      if (prop.includes('.')) {
        return match; // Skip if it's already a complex expression
      }
      return `String(${obj}.${prop})`;
    }
  }
];

function processFile(filePath) {
  if (!filePath.endsWith('.ts') || filePath.includes('node_modules')) {
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let modified = false;

  // Apply fixes
  for (const { pattern, fix } of fixes) {
    const newContent = content.replace(pattern, fix);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  }

  // Additional specific fixes for common patterns

  // Fix the onStream double arrow function issue more comprehensively
  content = content.replace(
    /onStream:\s*\(chunk:\s*string\)\s*=>\s*chunk\)\s*=>\s*{/g,
    'onStream: (chunk: string) => {'
  );

  // Fix property access patterns like obj.(String(prop))
  content = content.replace(
    /(\w+)\.\(String\((\w+)\)\)/g,
    'String($1.$2)'
  );

  // Fix incorrect catch parameter types
  content = content.replace(
    /catch\s*\(error:\s*any\)/g,
    'catch (error)'
  );

  // Remove duplicate imports that might have been added
  const lines = content.split('\n');
  const seenImports = new Set();
  const filteredLines = [];

  for (const line of lines) {
    if (line.startsWith('import type { ChannelManager }') ||
        line.startsWith('import type { ConnectionsModel }')) {
      const importKey = line.trim();
      if (seenImports.has(importKey)) {
        modified = true;
        continue; // Skip duplicate
      }
      seenImports.add(importKey);
    }
    filteredLines.push(line);
  }

  if (seenImports.size > 0) {
    content = filteredLines.join('\n');
  }

  if (modified && content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
    return true;
  }

  return false;
}

// Main execution
async function main() {
  const pattern = path.join(__dirname, 'main', '**', '*.ts');
  const files = glob.sync(pattern);

  let fixedCount = 0;
  console.log(`Processing ${files.length} TypeScript files...`);

  for (const file of files) {
    if (processFile(file)) {
      fixedCount++;
    }
  }

  console.log(`\nFixed ${fixedCount} files.`);

  // Run TypeScript compiler to check results
  const { exec } = require('child_process');
  exec('npx tsc -p tsconfig.main.json --noEmit', (error, stdout, stderr) => {
    const errorCount = stderr.split('\n').filter(line => line.includes('error TS')).length;
    console.log(`\nRemaining TypeScript errors: ${errorCount}`);
  });
}

main().catch(console.error);