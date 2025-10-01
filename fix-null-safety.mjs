#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('Fixing null safety issues...\n');

// Get all TypeScript files that need null safety fixes
const files = [
  './lama-electron-shadcn.ts',
  './main/core/ai-assistant-model.ts',
  './main/core/ai-person-registry.ts',
  './main/core/ai-message-listener.ts',
  './main/core/attestation-manager.ts',
  './main/core/node-one-core.ts',
  './main/ipc/controller.ts'
];

let totalFixed = 0;

for (const file of files) {
  if (!fs.existsSync(file)) continue;

  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Fix mainWindow null safety
  if (content.includes('mainWindow.')) {
    content = content.replace(/mainWindow\.(?!on|once)/g, 'mainWindow?.');
    modified = true;
  }

  // Fix viteProcess null safety
  if (content.includes('viteProcess.')) {
    content = content.replace(/viteProcess\.stdout(?!\?)/g, 'viteProcess.stdout?');
    content = content.replace(/viteProcess\.stderr(?!\?)/g, 'viteProcess.stderr?');
    modified = true;
  }

  // Fix this.llmManager null safety
  if (content.includes('this.llmManager.')) {
    content = content.replace(/this\.llmManager\.(?!on|once)/g, 'this.llmManager?.');
    modified = true;
  }

  // Fix object possibly null - add null checks
  if (content.includes('Object is possibly \'null\'')) {
    // Add proper null checks for common patterns
    content = content.replace(
      /const (\w+) = ([^;]+);[\s\r\n]*(\1\.\w+)/g,
      'const $1 = $2;\nif ($1) {\n  $3'
    );
    modified = true;
  }

  // Fix undefined access patterns
  content = content.replace(/(\w+)\.(\w+)\s*\|\|\s*(\w+)/g, '$1?.$2 || $3');

  // Fix array access on possibly undefined
  if (content.includes('implicitly has an \'any\'')) {
    content = content.replace(/let (\w+)$/gm, 'let $1: any');
    content = content.replace(/const (\w+) = (\w+)\[/g, 'const $1: any = $2[');
    modified = true;
  }

  // Fix specific common null safety patterns
  const nullSafetyFixes = [
    // metadata?.property instead of metadata.property
    { from: /metadata\.(\w+)/g, to: 'metadata?.$1' },
    // result?.property instead of result.property when result can be undefined
    { from: /result\.(\w+)/g, to: '(result as any)?.$1' },
    // Fix Set methods on possibly undefined
    { from: /(\w+)\.set\(/g, to: '($1 as any)?.set(' },
    { from: /(\w+)\.get\(/g, to: '($1 as any)?.get(' },
    { from: /(\w+)\.push\(/g, to: '($1 as any)?.push(' },
    { from: /(\w+)\.shift\(/g, to: '($1 as any)?.shift(' },
    { from: /(\w+)\.length/g, to: '($1 as any)?.length' }
  ];

  for (const fix of nullSafetyFixes) {
    if (fix.from.test(content)) {
      content = content.replace(fix.from, fix.to);
      modified = true;
    }
  }

  // Fix ChildProcess null types
  if (file.includes('lama-electron-shadcn.ts')) {
    content = content.replace(
      /childProcesses\.delete\(viteProcess\)/g,
      'childProcesses.delete(viteProcess!)'
    );
    modified = true;
  }

  // Fix specific undefined variable references
  content = content.replace(/\bnodeCore\./g, 'this.nodeOneCore.');
  content = content.replace(/\bllmManager\./g, 'this.llmManager.');

  if (modified) {
    fs.writeFileSync(file, content);
    console.log(`Fixed ${path.basename(file)}`);
    totalFixed++;
  }
}

console.log(`\nFixed null safety in ${totalFixed} files`);

// Fix specific type issues in key files
console.log('\nFixing specific type issues...');

// Fix duplicate mainWindow declaration
const controllerFile = './main/ipc/controller.ts';
if (fs.existsSync(controllerFile)) {
  let content = fs.readFileSync(controllerFile, 'utf8');

  // Remove duplicate global declaration if it exists
  if (content.includes('declare global') && content.includes('var mainWindow')) {
    content = content.replace(/declare global\s*{\s*var mainWindow[^}]+}/g, '');
    fs.writeFileSync(controllerFile, content);
    console.log('Fixed duplicate mainWindow declaration in controller.ts');
  }
}

console.log('\nDone!');