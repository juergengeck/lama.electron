#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fixFile(filePath) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return false;

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = false;

    // Fix ai-message-listener.ts
    if (filePath.includes('ai-message-listener.ts')) {
        // Fix the nodeCore reference issue - it should be the local variable, not a class property
        content = content.replace(
            /ownerId = this\.nodeCore\.default\?\.ownerId \|\| this\.nodeCore\.instance\?\.ownerId/g,
            'ownerId = nodeCore.default?.ownerId || nodeCore.instance?.ownerId'
        );

        // Fix the other nodeCore references
        content = content.replace(
            /topicModel = this\.nodeCore\.default\?\.topicModel/g,
            'topicModel = nodeCore.default?.topicModel'
        );

        content = content.replace(
            /topicModel = this\.nodeCore\.instance\?\.topicModel/g,
            'topicModel = nodeCore.instance?.topicModel'
        );

        // Fix the nodeCore variable reference
        content = content.replace(
            /console\.error\('\[AIMessageListener\] TopicModel not available - instance:', !!nodeCore/g,
            "console.error('[AIMessageListener] TopicModel not available - instance:', !!nodeCore.default"
        );

        modified = true;
    }

    // Fix ai-polling-listener.ts
    if (filePath.includes('ai-polling-listener.ts')) {
        // Fix llmManager property access
        content = content.replace(
            /const modelId = this\.llmManager\.defaultModelId/g,
            'const modelId = (this.llmManager as any).defaultModelId || "default"'
        );

        modified = true;
    }

    // Fix ai-settings-manager.ts to properly implement GlobalLLMSettings
    if (filePath.includes('ai-settings-manager.ts')) {
        // Fix the GlobalLLMSettings object creation
        content = content.replace(
            /const settings: GlobalLLMSettings = \{[\s\S]*?modified: Date\.now\(\)\s*\}/,
            `const settings: GlobalLLMSettings = {
      $type$: 'GlobalLLMSettings',
      defaultProvider: 'ollama',
      autoSelectBestModel: false,
      preferredModelIds: [],
      defaultModelId: null,
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: '',
      streamResponses: true,
      autoSummarize: false,
      enableMCP: true,
      created: Date.now(),
      modified: Date.now()
    }`
        );

        modified = true;
    }

    // Fix module import issues - add missing .js extensions
    content = content.replace(
        /from '(\.\.?\/[^'"]+)(?<!\.js)'/g,
        (match, path) => {
            // Don't add .js to node_modules imports or if it already has an extension
            if (path.includes('node_modules') || path.includes('.')) {
                return match;
            }
            return `from '${path}.js'`;
        }
    );

    // Fix type imports from ONE.core to use proper submodules
    content = content.replace(
        /import type \{ ([^}]+) \} from '@refinio\/one\.core'/g,
        (match, types) => {
            const typeList = types.split(',').map(t => t.trim());
            const imports = [];

            // Group types by their proper modules
            const recipeTypes = [];
            const hashTypes = [];
            const otherTypes = [];

            for (const type of typeList) {
                if (type.startsWith('SHA256')) {
                    hashTypes.push(type);
                } else if (['Person', 'Profile', 'Group', 'Instance', 'Keys', 'Topic', 'Message', 'Access', 'IdAccess'].includes(type)) {
                    recipeTypes.push(type);
                } else {
                    otherTypes.push(type);
                }
            }

            if (recipeTypes.length > 0) {
                imports.push(`import type { ${recipeTypes.join(', ')} } from '@refinio/one.core/lib/recipes.js'`);
            }
            if (hashTypes.length > 0) {
                imports.push(`import type { ${hashTypes.join(', ')} } from '@refinio/one.core/lib/util/type-checks.js'`);
            }
            if (otherTypes.length > 0) {
                // Default to recipes for unknown types
                imports.push(`import type { ${otherTypes.join(', ')} } from '@refinio/one.core/lib/recipes.js'`);
            }

            return imports.join(';\n');
        }
    );

    // Fix ChannelManager import to match reference
    content = content.replace(
        /import type \{ ChannelManager \} from '@refinio\/one\.models'/g,
        "import type ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js'"
    );

    content = content.replace(
        /import \{ ChannelManager \} from '@refinio\/one\.models'/g,
        "import ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js'"
    );

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        return true;
    }
    return false;
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    let fixedCount = 0;

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (!file.startsWith('.') && file !== 'node_modules' && file !== 'vendor') {
                fixedCount += walkDir(fullPath);
            }
        } else if (fixFile(fullPath)) {
            console.log(`Fixed: ${path.relative(__dirname, fullPath)}`);
            fixedCount++;
        }
    }

    return fixedCount;
}

console.log('Fixing architecture issues based on reference implementation...\n');

// Process main directory
const mainFixed = walkDir(path.join(__dirname, 'main'));

// Process electron-ui directory
const uiFixed = walkDir(path.join(__dirname, 'electron-ui'));

console.log(`\nTotal files fixed: ${mainFixed + uiFixed}`);
console.log('\nNow running TypeScript check...');