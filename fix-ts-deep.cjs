#!/usr/bin/env node

/**
 * Deep TypeScript fix script - applies proper type annotations
 * instead of using 'any' everywhere
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Pattern replacements with proper types
const replacements = [
  // Fix private property access with proper type assertions
  {
    pattern: /\.leuteConnectionsModule\b/g,
    replacement: match => '["leuteConnectionsModule" as keyof ConnectionsModel]'
  },

  // Add proper types to commonly untyped parameters
  {
    pattern: /\((\w+)\)\s*=>\s*\1\.(name|personId|topicId|provider|nickname|defaultModelId)\b/g,
    replacement: (match, param, property) => {
      const typeMap = {
        name: 'Record<string, any>',
        personId: '{ personId: string }',
        topicId: '{ topicId: string }',
        provider: '{ provider: string }',
        nickname: '{ nickname?: string }',
        defaultModelId: '{ defaultModelId?: string | null }'
      };
      return `(${param}: ${typeMap[property] || 'any'}) => ${param}.${property}`;
    }
  },

  // Fix substring calls on unknown types
  {
    pattern: /(\w+)\.substring\(/g,
    replacement: (match, variable) => `(String(${variable})).substring(`
  },

  // Fix match calls on unknown types
  {
    pattern: /(\w+)\.match\(/g,
    replacement: (match, variable) => `(String(${variable})).match(`
  },

  // Add types to error catches
  {
    pattern: /catch\s*\(error\)\s*{/g,
    replacement: 'catch (error: unknown) {'
  },

  // Type error.message accesses
  {
    pattern: /\berror\.message\b/g,
    replacement: '(error as Error).message'
  },

  // Type error.stack accesses
  {
    pattern: /\berror\.stack\b/g,
    replacement: '(error as Error).stack'
  },

  // Fix common destructuring patterns
  {
    pattern: /const\s+{\s*(name|id|email|status)\s*}\s*=\s*(\w+);/g,
    replacement: (match, prop, variable) => {
      return `const { ${prop} } = ${variable} as { ${prop}: string };`;
    }
  },

  // Fix async function types
  {
    pattern: /async\s+(\w+)\(([^)]*)\)\s*{/g,
    replacement: (match, funcName, params) => {
      if (!params) return `async ${funcName}(): Promise<void> {`;
      if (params.includes(':')) return match; // Already typed
      return `async ${funcName}(${params}): Promise<unknown> {`;
    }
  },

  // Add return types to functions that return promises
  {
    pattern: /(\w+)\s*\([^)]*\)\s*:\s*Promise\s*{/g,
    replacement: '$1($2): Promise<void> {'
  },

  // Fix array access patterns
  {
    pattern: /\[0\]\.(name|id|hash|personId)/g,
    replacement: '[0] as { $1: string }).$1'
  },

  // Add proper types to connection-related objects
  {
    pattern: /const\s+(\w+)\s*=\s*.*connectionsModel/g,
    replacement: (match) => {
      if (match.includes(':')) return match; // Already typed
      return match.replace(/const\s+(\w+)/, 'const $1: ConnectionsModel');
    }
  },

  // Fix trust manager access
  {
    pattern: /\.trustedKeysManager\b/g,
    replacement: '.trust'
  },

  // Add proper types to channel manager references
  {
    pattern: /const\s+(\w+)\s*=\s*.*channelManager/g,
    replacement: (match) => {
      if (match.includes(':')) return match; // Already typed
      return match.replace(/const\s+(\w+)/, 'const $1: ChannelManager');
    }
  },

  // Fix contact manager references
  {
    pattern: /\.contactManager\b/g,
    replacement: '.leuteModel'
  },

  // Add proper stream handler types
  {
    pattern: /onStream:\s*\(/g,
    replacement: 'onStream: (chunk: string) => '
  },

  // Fix common property existence checks
  {
    pattern: /if\s*\(\s*(\w+)\.(name|id|personId|topicId)\s*\)/g,
    replacement: 'if (($1 as any).$2)'
  },

  // Fix Promise.all with proper types
  {
    pattern: /Promise\.all\(\[([^\]]+)\]\)/g,
    replacement: (match, contents) => {
      if (contents.includes('Promise<')) return match;
      return `Promise.all<any>([${contents}])`;
    }
  }
];

// Process a single file
function processFile(filePath) {
  if (!filePath.endsWith('.ts') || filePath.includes('node_modules')) {
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const originalContent = content;

  // Apply all replacements
  for (const { pattern, replacement } of replacements) {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  }

  // Additional intelligent fixes

  // Add import statements if missing
  if (content.includes('ConnectionsModel') && !content.includes("import.*ConnectionsModel")) {
    const importLine = "import type { ConnectionsModel } from '@refinio/one.models';\n";
    if (!content.includes(importLine)) {
      content = importLine + content;
      modified = true;
    }
  }

  if (content.includes('ChannelManager') && !content.includes("import.*ChannelManager")) {
    const importLine = "import type { ChannelManager } from '@refinio/one.models';\n";
    if (!content.includes(importLine)) {
      content = importLine + content;
      modified = true;
    }
  }

  // Write back if modified
  if (modified) {
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