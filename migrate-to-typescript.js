#!/usr/bin/env node
/**
 * Script to migrate all JavaScript files to TypeScript
 * This adds minimal types to get compilation working
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directories to migrate
const dirsToMigrate = [
  'main/core',
  'main/services',
  'main/models',
  'main/state',
  'main/utils',
  'main/config',
  'main/startup',
  'main/recipes'
];

// Files to skip (already TypeScript or special cases)
const skipFiles = [
  'main/ipc/controller.ts',
  'main/ipc/handlers/auth.ts',
  'main/ipc/handlers/state.ts',
  'main/ipc/handlers/crypto.ts',
  'main/ipc/handlers/settings.ts',
  'main/ipc/handlers/topics.ts'
];

function shouldSkipFile(filePath) {
  // Skip if already TypeScript
  if (filePath.endsWith('.ts')) return true;

  // Skip if in skip list
  if (skipFiles.includes(filePath)) return true;

  // Skip if TypeScript version already exists
  const tsPath = filePath.replace(/\.js$/, '.ts');
  if (fs.existsSync(tsPath)) {
    console.log(`  Skipping ${filePath} - TypeScript version exists`);
    return true;
  }

  return false;
}

function addTypeToParameters(params) {
  if (!params || params.trim() === '') return '';

  return params.split(',').map(p => {
    const trimmed = p.trim();
    if (trimmed && !trimmed.includes(':') && !trimmed.includes('=')) {
      // Handle destructuring parameters - don't add types to them for now
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return trimmed;
      }
      // Handle rest parameters
      if (trimmed.startsWith('...')) {
        const paramName = trimmed.substring(3);
        return `...${paramName}: any`;
      }
      return trimmed + ': any';
    }
    return trimmed;
  }).join(', ');
}

function convertToTypeScript(jsPath) {
  const tsPath = jsPath.replace(/\.js$/, '.ts');

  console.log(`Converting ${jsPath} -> ${tsPath}`);

  let content = fs.readFileSync(jsPath, 'utf8');

  // Add TypeScript-specific changes
  const lines = content.split('\n');
  const modifiedLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // 1. Convert function declarations - be more specific with regex
    if (line.match(/^(\s*)(export\s+)?(async\s+)?function\s+\w+\s*\(/)) {
      line = line.replace(/(\s*)(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)(\s*:\s*\w+)?(\s*{|\s*$)/,
        (match, indent, exportPart, asyncPart, name, params, existingReturnType, ending) => {
          if (existingReturnType) {
            // Already has return type, just add parameter types
            const typedParams = addTypeToParameters(params);
            return `${indent}${exportPart || ''}${asyncPart || ''}function ${name}(${typedParams})${existingReturnType}${ending}`;
          } else {
            // Add both parameter types and return type
            const typedParams = addTypeToParameters(params);
            return `${indent}${exportPart || ''}${asyncPart || ''}function ${name}(${typedParams}): any${ending}`;
          }
        });
    }

    // 2. Convert arrow functions - be more specific
    else if (line.match(/^(\s*)(export\s+)?(const|let|var)\s+\w+\s*:\s*\([^)]*\)\s*=>\s*/) ||
             line.match(/^(\s*)(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\([^)]*\)\s*=>\s*/)) {
      line = line.replace(/(\s*)(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)\s*=>\s*/,
        (match, indent, exportPart, varType, name, asyncPart, params) => {
          const typedParams = addTypeToParameters(params);
          return `${indent}${exportPart || ''}${varType} ${name} = ${asyncPart || ''}(${typedParams}): any => `;
        });
    }

    // 3. Convert class methods - be very specific to avoid matching if statements
    else if (line.match(/^\s+(async\s+)?\w+\s*\([^)]*\)\s*{/) &&
             !line.match(/^\s*(if|for|while|switch|catch)\s*\(/) &&
             !line.includes('=') && !line.includes(':')) {
      line = line.replace(/(\s+)(async\s+)?(\w+)\s*\(([^)]*)\)\s*{/,
        (match, indent, asyncPart, name, params) => {
          // Don't add types to constructor
          if (name === 'constructor') {
            const typedParams = addTypeToParameters(params);
            return `${indent}${asyncPart || ''}${name}(${typedParams}) {`;
          }
          const typedParams = addTypeToParameters(params);
          return `${indent}${asyncPart || ''}${name}(${typedParams}): any {`;
        });
    }

    // 4. Convert object method shorthand
    else if (line.match(/^\s+\w+\s*\([^)]*\)\s*{/) &&
             !line.match(/^\s*(if|for|while|switch|catch)\s*\(/) &&
             !line.includes('=') && !line.includes('function')) {
      line = line.replace(/(\s+)(\w+)\s*\(([^)]*)\)\s*{/,
        (match, indent, name, params) => {
          const typedParams = addTypeToParameters(params);
          return `${indent}${name}(${typedParams}): any {`;
        });
    }

    // 5. Add any type to catch clauses
    else if (line.includes('catch (') && !line.includes(': any')) {
      line = line.replace(/catch\s*\((\w+)\)/, 'catch ($1: any)');
    }

    // 6. Convert variable function assignments
    else if (line.match(/^\s*(const|let|var)\s+\w+\s*=\s*function\s*\([^)]*\)/)) {
      line = line.replace(/(\s*)(const|let|var)\s+(\w+)\s*=\s*function\s*\(([^)]*)\)/,
        (match, indent, varType, name, params) => {
          const typedParams = addTypeToParameters(params);
          return `${indent}${varType} ${name} = function(${typedParams}): any`;
        });
    }

    modifiedLines.push(line);
  }

  content = modifiedLines.join('\n');

  // Convert CommonJS exports to ESM
  content = content.replace(/module\.exports\s*=\s*{([^}]*)}/gs, (match, objectContent) => {
    return `export default {${objectContent}}`;
  });
  content = content.replace(/module\.exports\s*=\s*([^;\n]+)/g, 'export default $1');
  content = content.replace(/exports\.(\w+)\s*=/g, 'export const $1 =');

  // Convert CommonJS requires to imports where possible
  content = content.replace(/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g, "import $1 from '$2'");
  content = content.replace(/const\s+{\s*([^}]+)\s*}\s*=\s*require\(['"]([^'"]+)['"]\)/g, "import { $1 } from '$2'");

  // Write the TypeScript file
  fs.writeFileSync(tsPath, content);

  // Delete the original JS file
  fs.unlinkSync(jsPath);

  return tsPath;
}

function migrateDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory ${dirPath} does not exist, skipping...`);
    return;
  }

  console.log(`\nMigrating directory: ${dirPath}`);

  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Recursively migrate subdirectories
      migrateDirectory(filePath);
    } else if (file.endsWith('.js') && !shouldSkipFile(filePath)) {
      try {
        convertToTypeScript(filePath);
      } catch (error) {
        console.error(`Error converting ${filePath}:`, error.message);
      }
    }
  }
}

// Also convert individual files in main/
function migrateMainFiles() {
  const mainDir = 'main';
  const files = fs.readdirSync(mainDir);

  for (const file of files) {
    const filePath = path.join(mainDir, file);
    const stat = fs.statSync(filePath);

    if (!stat.isDirectory() && file.endsWith('.js') && !shouldSkipFile(filePath)) {
      try {
        convertToTypeScript(filePath);
      } catch (error) {
        console.error(`Error converting ${filePath}:`, error.message);
      }
    }
  }
}

console.log('Starting TypeScript migration...\n');

// Migrate directories
for (const dir of dirsToMigrate) {
  migrateDirectory(dir);
}

// Migrate root files in main/
console.log('\nMigrating root files in main/...');
migrateMainFiles();

console.log('\n✅ Migration complete!');
console.log('\nNext steps:');
console.log('1. Run: npm run build:main');
console.log('2. Fix any compilation errors');
console.log('3. Gradually improve types from "any" to proper types');