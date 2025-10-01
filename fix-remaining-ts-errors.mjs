#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Fix type assertion issues
function fixTypeAssertions(filePath, content) {
  let fixed = content;

  // Fix SHA256IdHash type assertions
  if (filePath.includes('access-rights-manager.ts')) {
    fixed = fixed.replace(
      /channelId: personId1 \+ '<->' \+ personId2/g,
      'channelId: (personId1 + \'<->\' + personId2) as SHA256IdHash'
    );
    fixed = fixed.replace(
      /channelId: channelIdStr/g,
      'channelId: channelIdStr as SHA256IdHash'
    );
  }

  // Fix globalThis index signatures
  if (filePath.includes('app.ts')) {
    fixed = fixed.replace(
      /global\[key\]/g,
      '(global as any)[key]'
    );
  }

  // Fix unknown types in ai-assistant-model.ts
  if (filePath.includes('ai-assistant-model.ts')) {
    // Fix result type assertions
    fixed = fixed.replace(
      /const result = await/g,
      'const result: any = await'
    );

    // Fix null checks
    fixed = fixed.replace(
      /if \(this\.aiPersonRegistry && !isAI\)/g,
      'if (this.aiPersonRegistry && !isAI)'
    );

    // Add null checks where needed
    fixed = fixed.replace(
      /this\.llmManager\.abortGeneration/g,
      'this.llmManager?.abortGeneration'
    );

    // Fix ChatMessage sender property
    fixed = fixed.replace(
      /const sender = msg\.data\?\.sender \|\| msg\.author/g,
      'const sender = (msg.data as any)?.sender || msg.author'
    );
  }

  // Fix variable type in ai-message-listener.ts
  if (filePath.includes('ai-message-listener.ts')) {
    // Fix ownerId type
    fixed = fixed.replace(
      /let ownerId$/m,
      'let ownerId: any'
    );
  }

  // Fix Instance type issues in refinio-api-server.ts
  if (filePath.includes('refinio-api-server.ts')) {
    // Cast Instance where needed
    fixed = fixed.replace(
      /this\.instance = nodeOneCore\.instance/g,
      'this.instance = nodeOneCore.instance as Instance'
    );

    // Fix handler registration
    fixed = fixed.replace(
      /new AIHandler\(this\.nodeOneCore\)/g,
      'new AIHandler(this.nodeOneCore as any)'
    );

    // Fix QuicVCServer options
    fixed = fixed.replace(
      /new QuicVCServer\(options\)/g,
      'new QuicVCServer(options as any)'
    );
  }

  return fixed;
}

// Process all TypeScript files
function processFiles() {
  const files = [
    'main/api/refinio-api-server.ts',
    'main/app.ts',
    'main/core/access-rights-manager.ts',
    'main/core/ai-assistant-model.ts',
    'main/core/ai-message-listener.ts'
  ];

  let totalFixed = 0;

  for (const file of files) {
    const filePath = path.join(process.cwd(), file);

    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${file} (not found)`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const fixed = fixTypeAssertions(filePath, content);

    if (fixed !== content) {
      fs.writeFileSync(filePath, fixed);
      console.log(`Fixed ${file}`);
      totalFixed++;
    }
  }

  console.log(`\nFixed ${totalFixed} files`);
}

processFiles();