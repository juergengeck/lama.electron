#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Find all TypeScript files
const files = await glob('main/**/*.ts', { absolute: true });

let totalFixed = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Find class declarations and constructor assignments
  const classMatches = content.matchAll(/class\s+(\w+)[^{]*\{/g);

  for (const match of classMatches) {
    const className = match[1];
    const classStartIndex = match.index + match[0].length;

    // Find the constructor
    const constructorMatch = content.slice(classStartIndex).match(/constructor\s*\([^)]*\)\s*\{([^}]+)\}/);

    if (constructorMatch) {
      const constructorBody = constructorMatch[1];

      // Find all this.property assignments
      const propertyAssignments = constructorBody.matchAll(/this\.(\w+)\s*=/g);
      const properties = new Set();

      for (const propMatch of propertyAssignments) {
        properties.add(propMatch[1]);
      }

      // Check if properties are already declared
      const classContent = content.slice(0, classStartIndex);
      const alreadyDeclared = new Set();

      // Check for property declarations
      const propDeclarations = classContent.matchAll(/^\s*(private|public|protected)?\s*(\w+)\s*[:\?]/gm);
      for (const decl of propDeclarations) {
        alreadyDeclared.add(decl[2]);
      }

      // Add missing property declarations
      const missingProps = [...properties].filter(p => !alreadyDeclared.has(p));

      if (missingProps.length > 0) {
        // Insert property declarations after the class opening brace
        const insertPoint = classStartIndex;
        const declarations = missingProps.map(prop => `  private ${prop}: any;`).join('\n');

        content = content.slice(0, insertPoint) + '\n' + declarations + '\n' + content.slice(insertPoint);
        modified = true;
        console.log(`Fixed ${className} in ${path.basename(file)}: Added ${missingProps.join(', ')}`);
      }
    }
  }

  // Also add [key: string]: any for classes that access dynamic properties
  if (content.includes('this[') && !content.includes('[key: string]: any')) {
    const classMatch = content.match(/class\s+\w+[^{]*\{/);
    if (classMatch) {
      const insertPoint = classMatch.index + classMatch[0].length;
      content = content.slice(0, insertPoint) + '\n  [key: string]: any;\n' + content.slice(insertPoint);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(file, content);
    totalFixed++;
  }
}

console.log(`\nFixed ${totalFixed} files`);