#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fixFile(filePath) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return false;

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Fix ai-assistant-model.ts issues
    if (filePath.includes('ai-assistant-model.ts')) {
        // Fix the modelId variable type issue
        content = content.replace(
            /const modelId = String\(/g,
            'const modelId: string = String('
        );

        // Fix isAI variable type
        content = content.replace(
            /const isAI = message\.author/g,
            'const isAI: boolean = Boolean(message.author'
        );

        content = content.replace(
            /const isAI = this\.isAIPerson/g,
            'const isAI: boolean = this.isAIPerson'
        );

        // Fix the console.log issue (it's not a function call)
        content = content.replace(
            /console\.log\(`\[AIAssistantModel\] Stored AI LLM object with hash: \$\{storedObjectHash\}`\)\s*\n\s*console/g,
            'console.log(`[AIAssistantModel] Stored AI LLM object with hash: ${storedObjectHash}`);\n      console'
        );

        // Fix the topicRestartSummaries Map access
        content = content.replace(
            /this\.topicRestartSummaries\s*=\s*this\.topicRestartSummaries\s*\|\|\s*new Map\(\)/g,
            'this.topicRestartSummaries = this.topicRestartSummaries || new Map()'
        );

        content = content.replace(
            /\(this\.topicRestartSummaries as any\)\?\.set\(/g,
            'this.topicRestartSummaries.set('
        );
    }

    // Fix ai-message-listener.ts issues
    if (filePath.includes('ai-message-listener.ts')) {
        // Fix ownerId type
        content = content.replace(
            /let ownerId;/g,
            'let ownerId: string | undefined;'
        );

        // Fix timerId issue - clearTimeout returns void, not a timer ID
        content = content.replace(
            /const timerId = clearTimeout\(/g,
            'clearTimeout('
        );

        // Fix the setTimeout assignment
        content = content.replace(
            /const timerId = setTimeout\(async \(\) => \{/g,
            'const timerId: NodeJS.Timeout = setTimeout(async () => {'
        );
    }

    // Fix lama-electron-shadcn.ts
    if (filePath.includes('lama-electron-shadcn.ts')) {
        // Add type annotations to callback parameters
        content = content.replace(
            /\.on\('request', \(req, res\) =>/g,
            ".on('request', (req: any, res: any) =>"
        );
    }

    // Fix general type issues
    // Add type annotations to variables that need them
    content = content.replace(
        /const (\w+) = (.*?)\.map\(/g,
        (match, varName, expr) => {
            // Don't double-type if already typed
            if (match.includes(':')) return match;
            return `const ${varName}: any[] = ${expr}.map(`;
        }
    );

    // Fix createdContacts type issue
    content = content.replace(
        /const createdContacts = \[\]/g,
        'const createdContacts: Array<{ modelId: string, personId: any, name: string }> = []'
    );

    // Fix history array type
    content = content.replace(
        /let history = \[\]/g,
        'let history: Array<{ role: "system" | "user" | "assistant", content: string }> = []'
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

console.log('Fixing variable type annotations...\n');

// Process main directory
const mainFixed = walkDir(path.join(__dirname, 'main'));

// Process root TypeScript files
const rootFile = path.join(__dirname, 'lama-electron-shadcn.ts');
if (fs.existsSync(rootFile) && fixFile(rootFile)) {
    console.log(`Fixed: lama-electron-shadcn.ts`);
}

console.log(`\nTotal files fixed: ${mainFixed + (fs.existsSync(rootFile) ? 1 : 0)}`);
console.log('\nChecking TypeScript compilation...');