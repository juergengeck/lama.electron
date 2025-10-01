#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Fix remaining TypeScript errors based on reference implementation
function fixFile(filePath) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return false;

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Fix ai-assistant-model.ts - proper message type
    if (filePath.includes('ai-assistant-model.ts')) {
        // Replace all instances of history array declaration with proper type
        content = content.replace(
            /const history: any\[\] = \[\]/g,
            'const history: Array<{ role: "system" | "user" | "assistant", content: string }> = []'
        );

        // Also fix the let declaration
        content = content.replace(
            /let history: any\[\] = \[\]/g,
            'let history: Array<{ role: "system" | "user" | "assistant", content: string }> = []'
        );

        // Fix createdContacts type
        content = content.replace(
            /const createdContacts: string\[\] = \[\]/g,
            'const createdContacts: Array<{ modelId: string, personId: any, name: string }> = []'
        );
    }

    // Fix lama-electron-shadcn.ts
    if (filePath.includes('lama-electron-shadcn.ts')) {
        content = content.replace(
            /\.on\('request', \(req, res\)/g,
            '.on(\'request\', (req: any, res: any)'
        );
    }

    // Fix refinio-api-server.ts
    if (filePath.includes('refinio-api-server.ts')) {
        // The ObjectHandler constructor needs the full nodeCore instance, not just instance property
        content = content.replace(
            /const objectHandler = new ObjectHandler\(this\.instance\)/g,
            'const objectHandler = new ObjectHandler(this)'
        );
    }

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        return true;
    }
    return false;
}

console.log('Fixing final TypeScript errors based on reference implementation...');

// Fix main files
let fixedCount = 0;
const mainDir = path.join(__dirname, 'main');
const files = [
    'core/ai-assistant-model.ts',
    'api/refinio-api-server.ts'
];

for (const file of files) {
    const fullPath = path.join(mainDir, file);
    if (fs.existsSync(fullPath) && fixFile(fullPath)) {
        console.log(`Fixed: ${file}`);
        fixedCount++;
    }
}

// Fix root files
const rootFile = path.join(__dirname, 'lama-electron-shadcn.ts');
if (fs.existsSync(rootFile) && fixFile(rootFile)) {
    console.log('Fixed: lama-electron-shadcn.ts');
    fixedCount++;
}

console.log(`\nFixed ${fixedCount} files`);
console.log('\nNow checking TypeScript compilation...');