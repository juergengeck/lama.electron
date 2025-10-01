#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Track files we've already processed to avoid duplicates
const processedFiles = new Set();

function fixImports(content) {
    // Fix imports from ONE.core to use proper submodules like the reference
    const importMappings = {
        // Storage functions
        'storeVersionedObject': '@refinio/one.core/lib/storage-versioned-objects.js',
        'getObjectByIdHash': '@refinio/one.core/lib/storage-versioned-objects.js',
        'getIdObject': '@refinio/one.core/lib/storage-versioned-objects.js',
        'storeIdObject': '@refinio/one.core/lib/storage-versioned-objects.js',
        'onVersionedObj': '@refinio/one.core/lib/storage-versioned-objects.js',
        'storeUnversionedObject': '@refinio/one.core/lib/storage-unversioned-objects.js',
        'getObject': '@refinio/one.core/lib/storage-unversioned-objects.js',

        // Access functions
        'createAccess': '@refinio/one.core/lib/access.js',

        // Instance functions
        'getInstanceIdHash': '@refinio/one.core/lib/instance.js',
        'getInstanceOwnerIdHash': '@refinio/one.core/lib/instance.js',

        // Keychain functions
        'getDefaultKeys': '@refinio/one.core/lib/keychain/keychain.js',
        'createDefaultKeys': '@refinio/one.core/lib/keychain/keychain.js',
        'hasDefaultKeys': '@refinio/one.core/lib/keychain/keychain.js',
        'createCryptoApiFromDefaultKeys': '@refinio/one.core/lib/keychain/keychain.js',

        // Util functions
        'calculateHashOfObj': '@refinio/one.core/lib/util/object.js',
        'calculateIdHashOfObj': '@refinio/one.core/lib/util/object.js',
        'serializeWithType': '@refinio/one.core/lib/util/promise.js',
        'createRandomString': '@refinio/one.core/lib/system/crypto-helpers.js',

        // Error functions
        'createError': '@refinio/one.core/lib/errors.js',

        // Type checks
        'ensureHash': '@refinio/one.core/lib/util/type-checks.js',
        'ensureIdHash': '@refinio/one.core/lib/util/type-checks.js',
        'isObject': '@refinio/one.core/lib/util/type-checks-basic.js',
        'isFunction': '@refinio/one.core/lib/util/type-checks-basic.js',

        // Storage base
        'SET_ACCESS_MODE': '@refinio/one.core/lib/storage-base-common.js',

        // Reverse map
        'getAllEntries': '@refinio/one.core/lib/reverse-map-query.js',
        'getOnlyLatestReferencingObjsHashAndId': '@refinio/one.core/lib/reverse-map-query.js',

        // Microdata
        'implode': '@refinio/one.core/lib/microdata-imploder.js',
    };

    // Fix type imports
    const typeImports = {
        'SHA256Hash': '@refinio/one.core/lib/util/type-checks.js',
        'SHA256IdHash': '@refinio/one.core/lib/util/type-checks.js',
        'Person': '@refinio/one.core/lib/recipes.js',
        'Profile': '@refinio/one.core/lib/recipes.js',
        'Group': '@refinio/one.core/lib/recipes.js',
        'Instance': '@refinio/one.core/lib/recipes.js',
        'Keys': '@refinio/one.core/lib/recipes.js',
        'Access': '@refinio/one.core/lib/recipes.js',
        'IdAccess': '@refinio/one.core/lib/recipes.js',
        'Recipe': '@refinio/one.core/lib/recipes.js',
        'ChannelInfo': '@refinio/one.core/lib/recipes.js',
        'Topic': '@refinio/one.core/lib/recipes.js',
        'Message': '@refinio/one.core/lib/recipes.js',
        'OneObjectTypeNames': '@refinio/one.core/lib/recipes.js',
        'OneVersionedObjectTypeNames': '@refinio/one.core/lib/recipes.js',
        'VersionedObjectResult': '@refinio/one.core/lib/storage-versioned-objects.js',
    };

    // Process imports from @refinio/one.core without submodule
    content = content.replace(
        /import\s*\{([^}]+)\}\s*from\s*['"]@refinio\/one\.core['"]/gm,
        (match, imports) => {
            const importList = imports.split(',').map(i => i.trim());
            const importsByModule = {};

            for (const imp of importList) {
                const cleanImport = imp.split(' as ')[0].trim();
                const module = importMappings[cleanImport] || '@refinio/one.core/lib/recipes.js';
                if (!importsByModule[module]) {
                    importsByModule[module] = [];
                }
                importsByModule[module].push(imp);
            }

            return Object.entries(importsByModule)
                .map(([module, imps]) => `import { ${imps.join(', ')} } from '${module}'`)
                .join(';\n');
        }
    );

    // Process type imports similarly
    content = content.replace(
        /import\s*type\s*\{([^}]+)\}\s*from\s*['"]@refinio\/one\.core['"]/gm,
        (match, imports) => {
            const importList = imports.split(',').map(i => i.trim());
            const importsByModule = {};

            for (const imp of importList) {
                const cleanImport = imp.split(' as ')[0].trim();
                const module = typeImports[cleanImport] || '@refinio/one.core/lib/recipes.js';
                if (!importsByModule[module]) {
                    importsByModule[module] = [];
                }
                importsByModule[module].push(imp);
            }

            return Object.entries(importsByModule)
                .map(([module, imps]) => `import type { ${imps.join(', ')} } from '${module}'`)
                .join(';\n');
        }
    );

    // Fix ONE.models imports to use proper paths
    content = content.replace(
        /import\s+type\s+\{?\s*ChannelManager\s*\}?\s*from\s*['"]@refinio\/one\.models['"]/g,
        "import type ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js'"
    );

    content = content.replace(
        /import\s+\{?\s*ChannelManager\s*\}?\s*from\s*['"]@refinio\/one\.models['"]/g,
        "import ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js'"
    );

    // Fix other ONE.models imports
    content = content.replace(
        /from\s*['"]@refinio\/one\.models\/lib\/([^'"]+)(?<!\.js)['"]/g,
        "from '@refinio/one.models/lib/$1.js'"
    );

    // Fix local imports to add .js extension
    content = content.replace(
        /from\s*['"](\.\.[\/\\][^'"]+)(?<!\.js)(?<!\.json)(?<!\.node)['"]/g,
        "from '$1.js'"
    );

    return content;
}

function fixTypeIssues(content, filePath) {
    // Fix ai-settings-manager.ts GlobalLLMSettings
    if (filePath.includes('ai-settings-manager')) {
        // The GlobalLLMSettings in our @OneCoreTypes.d.ts has more fields than reference
        // We need to provide all required fields
        content = content.replace(
            /const settings = \{[\s\S]*?\$type\$: 'GlobalLLMSettings'[\s\S]*?\}/,
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
    }

    // Fix ObjectHandler in refinio-api-server.ts
    if (filePath.includes('refinio-api-server')) {
        // ObjectHandler expects the full node core instance
        content = content.replace(
            /const objectHandler = new ObjectHandler\(this\)/g,
            'const objectHandler = new ObjectHandler(nodeOneCore as any)'
        );
    }

    // Fix type casts for storeVersionedObject/storeIdObject calls
    content = content.replace(
        /await storeVersionedObject\(\{[\s\S]*?\$type\$: ['"]([^'"]+)['"]/gm,
        (match, type) => {
            // Ensure the object conforms to the expected type
            return match + ' as const';
        }
    );

    return content;
}

function processFile(filePath) {
    if (processedFiles.has(filePath)) {
        return false;
    }

    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
        return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Apply import fixes
    content = fixImports(content);

    // Apply type fixes
    content = fixTypeIssues(content, filePath);

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        processedFiles.add(filePath);
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
            if (!file.startsWith('.') &&
                file !== 'node_modules' &&
                file !== 'vendor' &&
                file !== 'reference') {
                fixedCount += walkDir(fullPath);
            }
        } else if (processFile(fullPath)) {
            console.log(`Fixed: ${path.relative(__dirname, fullPath)}`);
            fixedCount++;
        }
    }

    return fixedCount;
}

console.log('Fixing imports and types based on Node.js reference patterns...\n');

// Process main directory
const mainFixed = walkDir(path.join(__dirname, 'main'));

// Process electron-ui directory
const uiFixed = walkDir(path.join(__dirname, 'electron-ui'));

// Process root TypeScript files
const rootFiles = ['lama-electron-shadcn.ts', 'electron-preload.ts'];
let rootFixed = 0;
for (const file of rootFiles) {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath) && processFile(fullPath)) {
        console.log(`Fixed: ${file}`);
        rootFixed++;
    }
}

console.log(`\nTotal files fixed: ${mainFixed + uiFixed + rootFixed}`);
console.log('\nRunning TypeScript check...');