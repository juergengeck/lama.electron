#!/usr/bin/env node

import fs from 'fs';
import { glob } from 'glob';

const files = await glob('main/**/*.ts');

let totalFixed = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  // Fix patterns like (String(xxx)).substring() -> String(xxx).substring()
  // This is causing "Type 'String' has no call signatures" errors
  let fixed = content.replace(/\(String\(([^)]+)\)\)/g, 'String($1)');

  // Also fix console.log patterns with String() that might have extra parentheses
  fixed = fixed.replace(/\$\{String\(([^)]+)\)\}/g, '${String($1)}');

  // Fix patterns where we're trying to call a property access result
  // Like: metadata?.lastSeen = Date.now() which should be metadata.lastSeen = Date.now()
  fixed = fixed.replace(/(\w+)\?\.(lastSeen) = /g, 'if ($1) $1.$2 = ');

  if (fixed !== content) {
    const changeCount = (content.match(/\(String\(/g) || []).length;
    if (changeCount > 0) {
      console.log(`Fixed ${changeCount} String() patterns in ${file}`);
      fs.writeFileSync(file, fixed);
      totalFixed += changeCount;
    }
  }
}

console.log(`\nTotal String() patterns fixed: ${totalFixed}`);