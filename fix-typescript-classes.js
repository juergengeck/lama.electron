#!/usr/bin/env node
/**
 * Script to fix TypeScript class issues after migration
 * Fixes constructor and property declarations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function fixTypeScriptFile(filePath) {
  if (!filePath.endsWith('.ts')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix constructor properties (remove type annotations from assignments)
  content = content.replace(/constructor\((.*?)\)(.*?)\{([\s\S]*?)^\s*\}/gm, (match, params, returnType, body) => {
    let fixedBody = body;

    // Fix property assignments like "this.propertyName: any = value"
    fixedBody = fixedBody.replace(/this\.(\w+)\s*:\s*any\s*=/g, 'this.$1 =');

    if (fixedBody !== body) {
      modified = true;
    }

    return `constructor(${params})${returnType}{${fixedBody}}`;
  });

  // Fix async function return types (: any => should be ): any =>
  content = content.replace(/async\s+(\w+)\((.*?)\)\s*:\s*any\s*{/g, (match, name, params) => {
    modified = true;
    return `async ${name}(${params}): Promise<any> {`;
  });

  // Fix class property declarations that got broken
  // Turn "this.prop: any = value" into "this.prop = value"
  content = content.replace(/^\s*this\.(\w+)\s*:\s*any\s*=/gm, (match, prop) => {
    modified = true;
    return match.replace(': any', '');
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

function fixDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      fixDirectory(fullPath);
    } else if (entry.endsWith('.ts')) {
      fixTypeScriptFile(fullPath);
    }
  }
}

console.log('Fixing TypeScript class issues...\n');

// Fix main directories
fixDirectory('main');
fixTypeScriptFile('lama-electron-shadcn.ts');
fixTypeScriptFile('electron-preload.ts');

console.log('\n✅ Class fixes complete!');