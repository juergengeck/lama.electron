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

    // Fix ai-assistant-model.ts specific issues
    if (filePath.includes('ai-assistant-model.ts')) {
        // Fix the modelId and isAI issues - these should be part of LLM interface
        content = content.replace(
            /modelType: modelId\.startsWith\('ollama:'\) \? 'local' : 'remote'/g,
            `modelType: (modelId.startsWith('ollama:') ? 'local' : 'remote') as 'local' | 'remote'`
        );

        // Fix the storeIdObject call - import from proper module
        if (!content.includes("import { storeIdObject }") && content.includes("storeIdObject(")) {
            content = content.replace(
                /^(import.*from '@refinio\/one\.core\/lib\/storage-versioned-objects\.js';)$/m,
                `$1\nimport { storeIdObject } from '@refinio/one.core/lib/storage-versioned-objects.js';`
            );
        }

        // Fix implicit any issues with proper type annotations
        content = content.replace(
            /const\s+modelId\s+=\s+String\(/g,
            'const modelId: string = String('
        );

        content = content.replace(
            /const\s+isAI\s+=\s+message\.author/g,
            'const isAI: boolean = message.author'
        );

        content = content.replace(
            /let\s+history\s+=\s+\[\]/g,
            'let history: any[] = []'
        );

        content = content.replace(
            /const\s+createdContacts\s+=\s+\[\]/g,
            'const createdContacts: string[] = []'
        );

        modified = true;
    }

    // Fix ai-message-listener.ts issues
    if (filePath.includes('ai-message-listener.ts')) {
        // Fix ownerId type
        content = content.replace(
            /let\s+ownerId\s*$/m,
            'let ownerId: string | null'
        );

        // Fix timerId type
        content = content.replace(
            /const\s+timerId\s+=\s+clearTimeout\(/g,
            'clearTimeout('
        );

        // Fix nodeCore reference
        content = content.replace(
            /nodeCore\./g,
            'this.nodeCore.'
        );

        modified = true;
    }

    // Fix ai-polling-listener.ts
    if (filePath.includes('ai-polling-listener.ts')) {
        content = content.replace(
            /llmManager\./g,
            'this.llmManager.'
        );
        modified = true;
    }

    // Fix ai-settings-manager.ts - update GlobalLLMSettings creation
    if (filePath.includes('ai-settings-manager.ts')) {
        content = content.replace(
            /const settings = \{[\s\S]*?created:.*?modified:.*?\}/,
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

    // Fix lama-electron-shadcn.ts
    if (filePath.includes('lama-electron-shadcn.ts')) {
        content = content.replace(
            /\.on\('request', \(req, res\)/g,
            '.on(\'request\', (req: any, res: any)'
        );
        modified = true;
    }

    // Fix refinio-api-server.ts - Instance type issue
    if (filePath.includes('refinio-api-server.ts')) {
        // The issue is trying to pass an Instance where One is expected
        // This likely needs the actual ONE instance, not the Instance object
        content = content.replace(
            /IoMManager\.initialize\(nodeCore\.instance\)/g,
            'IoMManager.initialize(nodeCore)'
        );
        modified = true;
    }

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
            console.log(`Fixed: ${fullPath}`);
            fixedCount++;
        }
    }

    return fixedCount;
}

// Fix the LLM type definition in @OneCoreTypes.d.ts to include required fields
const typeDefPath = path.join(__dirname, '@OneCoreTypes.d.ts');
let typeDef = fs.readFileSync(typeDefPath, 'utf8');

// Add modelId and isAI to LLM interface if not present
if (!typeDef.includes('modelId:') || !typeDef.includes('isAI:')) {
    typeDef = typeDef.replace(
        /export interface LLM \{[\s\S]*?\n\s*\/\/ Model parameters/,
        `export interface LLM {
        $type$: 'LLM';
        name: string;
        filename: string;
        modelType: 'local' | 'remote';
        active: boolean;
        deleted: boolean;
        creator?: string;
        created: number;
        modified: number;
        createdAt: string;
        lastUsed: string;
        lastInitialized?: number;
        usageCount?: number;
        size?: number;

        // Required LLM identification fields
        modelId: string;
        isAI: boolean;

        personId?: SHA256IdHash<Person>;
        capabilities?: Array<'chat' | 'inference'>;

        // Model parameters`
    );
    fs.writeFileSync(typeDefPath, typeDef);
    console.log('Updated LLM type definition in @OneCoreTypes.d.ts');
}

console.log('Fixing comprehensive TypeScript issues...');

// Process main directory
const mainFixed = walkDir(path.join(__dirname, 'main'));
console.log(`Fixed ${mainFixed} files in main/`);

// Process root TypeScript files
const rootFiles = ['lama-electron-shadcn.ts', 'electron-preload.ts'];
let rootFixed = 0;
for (const file of rootFiles) {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath) && fixFile(fullPath)) {
        console.log(`Fixed: ${fullPath}`);
        rootFixed++;
    }
}

console.log(`\nTotal files fixed: ${mainFixed + rootFixed}`);
console.log('\nNow checking remaining TypeScript errors...');