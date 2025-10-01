#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('Fixing ONE.core and ONE.models imports...\n');

// Get all TypeScript files
const tsFiles = execSync('find . -name "*.ts" -not -path "./node_modules/*" -not -path "./vendor/*"', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

let fixedCount = 0;

for (const file of tsFiles) {
  if (!fs.existsSync(file)) continue;

  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Fix incorrect imports from one.core recipes
  // ChatMessage and ChannelInfo are in one.models, not one.core
  if (content.includes("from '@refinio/one.core/lib/recipes.js'")) {
    const oldImport = content;

    // If importing ChatMessage or ChannelInfo, they should come from one.models
    content = content.replace(
      /import type \{([^}]*)\} from '@refinio\/one\.core\/lib\/recipes\.js';/g,
      (match, imports) => {
        const importList = imports.split(',').map(i => i.trim());
        const coreImports = [];
        const modelImports = [];

        for (const imp of importList) {
          if (imp.includes('ChatMessage') || imp.includes('ChannelInfo')) {
            modelImports.push(imp);
          } else if (imp.includes('Person') || imp.includes('Group') || imp.includes('Recipe') ||
                     imp.includes('Instance') || imp.includes('Access') || imp.includes('IdAccess') ||
                     imp.includes('Chum')) {
            coreImports.push(imp);
          } else {
            coreImports.push(imp); // Default to core
          }
        }

        let result = '';
        if (coreImports.length > 0) {
          result += `import type { ${coreImports.join(', ')} } from '@refinio/one.core/lib/recipes.js';`;
        }
        if (modelImports.length > 0) {
          if (result) result += '\n';
          result += `import type { ${modelImports.join(', ')} } from '@refinio/one.models/lib/recipes/ChatRecipes.js';`;
        }

        return result || match;
      }
    );

    if (content !== oldImport) modified = true;
  }

  // Fix getObjectByIdHash import - it doesn't exist, use getObjectByHash
  content = content.replace(
    /import \{ getObjectByIdHash \}/g,
    'import { getObjectByHash }'
  );
  if (content.includes('getObjectByIdHash(')) {
    content = content.replace(/getObjectByIdHash\(/g, 'getObjectByHash(');
    modified = true;
  }

  // Fix SomeoneModel import - it's in LeuteModel module
  content = content.replace(
    /import type \{ ([^}]*SomeoneModel[^}]*) \} from ['"]@refinio\/one\.models\/lib\/models\/index\.js['"]/g,
    (match, imports) => {
      const importList = imports.split(',').map(i => i.trim());
      const withoutSomeone = importList.filter(i => !i.includes('SomeoneModel'));
      const someoneImport = importList.find(i => i.includes('SomeoneModel'));

      let result = '';
      if (withoutSomeone.length > 0) {
        result = `import type { ${withoutSomeone.join(', ')} } from '@refinio/one.models/lib/models/index.js'`;
      }
      if (someoneImport) {
        if (result) result += ';\n';
        result += `import type { SomeoneModel } from '@refinio/one.models/lib/models/Leute/SomeoneModel.js'`;
      }

      return result;
    }
  );

  // Fix ConnectionsModel references - it's a class in one.models
  if (content.includes('ConnectionsModel')) {
    // Remove duplicate type imports
    content = content.replace(
      /import type \{ ([^}]*) \} from '@refinio\/one\.models\/lib\/models\/index\.js'/g,
      (match, imports) => {
        const importList = imports.split(',').map(i => i.trim());
        const uniqueImports = [...new Set(importList)];
        return `import type { ${uniqueImports.join(', ')} } from '@refinio/one.models/lib/models/index.js'`;
      }
    );
    modified = true;
  }

  // Fix module augmentations
  content = content.replace(
    /declare module '@refinio\/one\.core\/lib\/storage\.js'/g,
    "declare module '@refinio/one.core/lib/storage-unversioned-objects.js'"
  );

  content = content.replace(
    /declare module '@refinio\/one\.core\/lib\/signatures\.js'/g,
    "declare module '@refinio/one.core/lib/crypto/sign.js'"
  );

  // Fix duplicate type names
  if (content.includes('type ChannelManager =')) {
    content = content.replace(
      /^export type ChannelManager = /gm,
      'export type ChannelManagerType = '
    );
    content = content.replace(
      /^export type ConnectionsModel = /gm,
      'export type ConnectionsModelType = '
    );
    modified = true;
  }

  // Write back if modified
  if (modified) {
    fs.writeFileSync(file, content);
    console.log(`Fixed ${path.relative('.', file)}`);
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files`);

// Now fix specific type issues in main/types/common.ts
const commonTypesFile = './main/types/common.ts';
if (fs.existsSync(commonTypesFile)) {
  let content = fs.readFileSync(commonTypesFile, 'utf8');

  // Remove ChatMessage and ChannelInfo from one.core imports
  content = content.replace(
    /import type \{[^}]+\} from '@refinio\/one\.core\/lib\/recipes\.js';/,
    `import type {
  Person,
  Group,
  Recipe,
  Instance,
  Access,
  IdAccess,
  Chum
} from '@refinio/one.core/lib/recipes.js';`
  );

  // Add ChatMessage and ChannelInfo from one.models
  if (!content.includes("from '@refinio/one.models/lib/recipes/ChatRecipes.js'")) {
    const coreImportEnd = content.indexOf("from '@refinio/one.core/lib/recipes.js';") +
                          "from '@refinio/one.core/lib/recipes.js';".length;

    content = content.slice(0, coreImportEnd) +
      `\nimport type { ChatMessage } from '@refinio/one.models/lib/recipes/ChatRecipes.js';
import type { ChannelInfo } from '@refinio/one.models/lib/models/ChannelManager.js';` +
      content.slice(coreImportEnd);
  }

  fs.writeFileSync(commonTypesFile, content);
  console.log('Fixed main/types/common.ts');
}

console.log('\nDone!');