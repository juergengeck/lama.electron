#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Find all TypeScript files
const files = await glob('main/**/*.ts', { absolute: true });

let totalFixed = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Fix bare @refinio/one.models imports
  if (content.includes("from '@refinio/one.models'")) {
    content = content.replace(
      /from '@refinio\/one\.models'/g,
      "from '@refinio/one.models/lib/models/index.js'"
    );
    modified = true;
  }

  // Fix type imports
  if (content.includes("from '@refinio/one.models';")) {
    content = content.replace(
      /from '@refinio\/one\.models';/g,
      "from '@refinio/one.models/lib/models/index.js';"
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(file, content);
    console.log(`Fixed: ${path.relative(process.cwd(), file)}`);
    totalFixed++;
  }
});

console.log(`\nFixed ${totalFixed} files`);