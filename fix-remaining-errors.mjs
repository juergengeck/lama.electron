#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fixFile(filePath) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return false;

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Fix attestation-manager.ts
    if (filePath.includes('attestation-manager.ts')) {
        // getObjectByHash doesn't exist, should be getObject
        content = content.replace(/getObjectByHash/g, 'getObject');

        // ProfileModel.name should be accessed differently
        content = content.replace(
            /const authorName = profile\.name \|\| 'Unknown'/g,
            "const authorName = (profile as any)?.displayName || 'Unknown'"
        );
    }

    // Fix contact-acceptance-manager.ts
    if (filePath.includes('contact-acceptance-manager.ts')) {
        // Fix imports - these are not direct exports but need proper imports
        content = content.replace(
            /const Person = await import\('@refinio\/one\.core\/lib\/recipes\.js'\)/g,
            "const { storeIdObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')"
        );

        content = content.replace(
            /const ProfileModel = await import/g,
            "const ProfileModel = (await import"
        );

        content = content.replace(
            /ProfileModel\./g,
            "ProfileModel.default."
        );

        // Fix crypto verify import
        content = content.replace(
            /const \{ verify \} = await import\('@refinio\/one\.core\/lib\/crypto\/sign\.js'\)/g,
            "const { verifySignature: verify } = await import('@refinio/one.core/lib/crypto/sign.js')"
        );
    }

    // Fix contact-trust-manager.ts
    if (filePath.includes('contact-trust-manager.ts')) {
        // Similar fixes as contact-acceptance-manager
        content = content.replace(
            /const Person = await import\('@refinio\/one\.core\/lib\/recipes\.js'\)/g,
            "const { storeIdObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')"
        );

        content = content.replace(
            /SomeoneModel\./g,
            "SomeoneModel.default."
        );
    }

    // Fix instance.ts
    if (filePath.includes('instance.ts')) {
        // Fix imports that don't exist
        content = content.replace(
            /const Instance = await import\('@refinio\/one\.core\/lib\/instance\.js'\)/g,
            "const { createInstance } = await import('@refinio/one.core/lib/instance.js')"
        );

        content = content.replace(
            /const StorageVersionedObjects = await import/g,
            "const { storeVersionedObject } = await import"
        );

        content = content.replace(
            /const \{ createRandomKeys \} = await import\('@refinio\/one\.core\/lib\/crypto\/encryption\.js'\)/g,
            "const { createKeys: createRandomKeys } = await import('@refinio/one.core/lib/keychain/keychain.js')"
        );
    }

    // Fix Summary.ts - add proper interface
    if (filePath.includes('Summary.ts')) {
        // Ensure the Summary interface is properly defined
        if (!content.includes('interface Summary')) {
            content = content.replace(
                /export class SummaryModel/,
                `interface Summary {
  $type$: 'Summary';
  topicId: string;
  version: number;
  content: string;
  generatedAt: string;
  changeReason?: string;
  previousVersion?: string;
  subjects: any[];
}

export class SummaryModel`
            );
        }
    }

    // Fix array.has() calls - should be Set.has() or array.includes()
    content = content.replace(
        /(\w+)\.has\(/g,
        (match, varName) => {
            // Check if it's likely an array (common patterns)
            if (content.includes(`${varName}: any[]`) ||
                content.includes(`${varName} = []`) ||
                content.includes(`const ${varName}: any[]`)) {
                return `${varName}.includes(`;
            }
            // Otherwise assume it's a Set
            return match;
        }
    );

    // Fix more specific import issues
    content = content.replace(
        /import\s+ProfileModel\s+from/g,
        "import ProfileModel from"
    );

    content = content.replace(
        /import\s+SomeoneModel\s+from/g,
        "import SomeoneModel from"
    );

    // Fix missing exports
    content = content.replace(
        /export default (\w+)$/gm,
        "export default $1;"
    );

    // Fix type assertion issues
    content = content.replace(
        /as const\s*;/g,
        "as const;"
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
            if (!file.startsWith('.') &&
                file !== 'node_modules' &&
                file !== 'vendor' &&
                file !== 'reference') {
                fixedCount += walkDir(fullPath);
            }
        } else if (fixFile(fullPath)) {
            console.log(`Fixed: ${path.relative(__dirname, fullPath)}`);
            fixedCount++;
        }
    }

    return fixedCount;
}

console.log('Fixing remaining TypeScript errors...\n');

const totalFixed = walkDir(path.join(__dirname, 'main'));

console.log(`\nTotal files fixed: ${totalFixed}`);
console.log('\nRunning TypeScript check...');