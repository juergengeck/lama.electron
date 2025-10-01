#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Map of imports to their correct submodule paths based on reference implementation
const importMapping = {
    // From @refinio/one.core main barrel export to specific submodules
    'implode': '@refinio/one.core/lib/microdata-imploder.js',
    'calculateHashOfObj': '@refinio/one.core/lib/util/object.js',
    'calculateIdHashOfObj': '@refinio/one.core/lib/util/object.js',
    'createAccess': '@refinio/one.core/lib/access.js',
    'getObject': '@refinio/one.core/lib/storage-unversioned-objects.js',
    'storeVersionedObject': '@refinio/one.core/lib/storage-versioned-objects.js',
    'getObjectByIdHash': '@refinio/one.core/lib/storage-versioned-objects.js',
    'getIdObject': '@refinio/one.core/lib/storage-versioned-objects.js',
    'storeUnversionedObject': '@refinio/one.core/lib/storage-unversioned-objects.js',
    'createError': '@refinio/one.core/lib/errors.js',
    'createRandomString': '@refinio/one.core/lib/system/crypto-helpers.js',
    'getDefaultKeys': '@refinio/one.core/lib/keychain/keychain.js',
    'createCryptoApiFromDefaultKeys': '@refinio/one.core/lib/keychain/keychain.js',
    'getInstanceIdHash': '@refinio/one.core/lib/instance.js',
    'getInstanceOwnerIdHash': '@refinio/one.core/lib/instance.js',
    'ensureUnicodeFlagSupport': '@refinio/one.core/lib/system/unicode.js',
};

// Common recipe types that should come from lib/recipes.js
const recipeTypes = [
    'Person', 'Profile', 'Group', 'Instance', 'Keys',
    'OneVersionedObjectTypeNames', 'OneObjectTypes',
    'BLOB', 'CLOB', 'Message', 'Topic', 'ChannelInfo',
    'LinkedListEntry', 'IdAccess', 'Access'
];

function processFile(filePath) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Fix direct imports from @refinio/one.core without submodule
    // Pattern: import { X, Y } from '@refinio/one.core';
    const directImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]@refinio\/one\.core['"];?/g;

    content = content.replace(directImportRegex, (match, imports) => {
        const importList = imports.split(',').map(i => i.trim());
        const importGroups = {};

        for (const imp of importList) {
            const importName = imp.split(' as ')[0].trim();

            // Check if it's a recipe type
            if (recipeTypes.includes(importName)) {
                const module = '@refinio/one.core/lib/recipes.js';
                if (!importGroups[module]) importGroups[module] = [];
                importGroups[module].push(imp);
            }
            // Check if we have a specific mapping
            else if (importMapping[importName]) {
                const module = importMapping[importName];
                if (!importGroups[module]) importGroups[module] = [];
                importGroups[module].push(imp);
            }
            // Default to recipes.js for unknown imports
            else {
                const module = '@refinio/one.core/lib/recipes.js';
                if (!importGroups[module]) importGroups[module] = [];
                importGroups[module].push(imp);
            }
        }

        // Generate new import statements
        const newImports = Object.entries(importGroups)
            .map(([module, imports]) => `import { ${imports.join(', ')} } from '${module}';`)
            .join('\n');

        return newImports;
    });

    // Fix type imports from @refinio/one.core
    const typeImportRegex = /import\s*type\s*\{([^}]+)\}\s*from\s*['"]@refinio\/one\.core['"];?/g;

    content = content.replace(typeImportRegex, (match, imports) => {
        const importList = imports.split(',').map(i => i.trim());
        const importGroups = {};

        for (const imp of importList) {
            const importName = imp.split(' as ')[0].trim();

            // SHA256 types come from type-checks
            if (importName.startsWith('SHA256')) {
                const module = '@refinio/one.core/lib/util/type-checks.js';
                if (!importGroups[module]) importGroups[module] = [];
                importGroups[module].push(imp);
            }
            // Recipe types
            else if (recipeTypes.includes(importName)) {
                const module = '@refinio/one.core/lib/recipes.js';
                if (!importGroups[module]) importGroups[module] = [];
                importGroups[module].push(imp);
            }
            // Default to recipes.js
            else {
                const module = '@refinio/one.core/lib/recipes.js';
                if (!importGroups[module]) importGroups[module] = [];
                importGroups[module].push(imp);
            }
        }

        // Generate new import statements
        const newImports = Object.entries(importGroups)
            .map(([module, imports]) => `import type { ${imports.join(', ')} } from '${module}';`)
            .join('\n');

        return newImports;
    });

    // Fix imports from @refinio/one.models without .js extension
    content = content.replace(
        /from\s*['"]@refinio\/one\.models\/lib\/([^'"]+)(?<!\.js)['"];?/g,
        "from '@refinio/one.models/lib/$1.js';"
    );

    // Fix @OneObjectInterfaces imports to match reference
    content = content.replace(
        /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*['"]@OneCoreTypes['"];?/g,
        "import type {$1} from '@OneObjectInterfaces';"
    );

    // Fix module augmentation
    content = content.replace(
        /declare\s+module\s+['"]@OneCoreTypes['"]/g,
        "declare module '@OneObjectInterfaces'"
    );

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`Fixed imports in ${filePath}`);
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
        } else if (processFile(fullPath)) {
            fixedCount++;
        }
    }

    return fixedCount;
}

// Process main directory
console.log('Fixing ONE.core imports to use proper submodule paths...');
const mainFixed = walkDir(path.join(__dirname, 'main'));
console.log(`Fixed ${mainFixed} files in main/`);

// Process electron-ui directory
const uiFixed = walkDir(path.join(__dirname, 'electron-ui'));
console.log(`Fixed ${uiFixed} files in electron-ui/`);

// Process root TypeScript files
const rootFiles = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
    .map(f => path.join(__dirname, f));

let rootFixed = 0;
for (const file of rootFiles) {
    if (processFile(file)) rootFixed++;
}
console.log(`Fixed ${rootFixed} files in root`);

console.log(`\nTotal files fixed: ${mainFixed + uiFixed + rootFixed}`);
console.log('\nNow run: npm run typecheck to verify the fixes');