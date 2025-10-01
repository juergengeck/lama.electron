#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Files with syntax errors
const files = [
  'main/core/one-ai/services/ContextEnrichmentService.ts',
  'main/core/peer-message-listener.ts',
  'main/core/quicvc-connection-manager.ts',
  'main/core/topic-group-manager.ts',
  'main/ipc/handlers/chat.ts',
  'main/ipc/handlers/export.ts'
];

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');

  // Fix patterns like: this.(property as any)
  // Should be: (this.property as any)
  content = content.replace(/this\.\((\w+) as any\)/g, '(this.$1 as any)');

  // Fix patterns like: object.(property as any)
  // Should be: (object.property as any)
  content = content.replace(/(\w+)\.\((\w+) as any\)/g, '($1.$2 as any)');

  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${path.basename(file)}`);
}

console.log('Done!');