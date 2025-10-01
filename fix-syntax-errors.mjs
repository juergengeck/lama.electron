#!/usr/bin/env node

import fs from 'fs';
import { glob } from 'glob';

const files = await glob('main/**/*.ts');

let totalFixed = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  // Fix malformed syntax: this.(property as any)?. -> (this.property as any)?.
  const fixed = content.replace(/this\.\((\w+) as any\)\?\./g, '(this.$1 as any)?.');

  if (fixed !== content) {
    const matches = (content.match(/this\.\((\w+) as any\)\?\./g) || []).length;
    console.log(`Fixed ${matches} syntax errors in ${file}`);
    fs.writeFileSync(file, fixed);
    totalFixed += matches;
  }
}

console.log(`\nTotal syntax errors fixed: ${totalFixed}`);
