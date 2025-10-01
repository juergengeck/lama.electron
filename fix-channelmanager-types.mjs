#!/usr/bin/env node

import fs from 'fs';
import { glob } from 'glob';

const files = await glob('main/**/*.ts');

let totalFixed = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  // Fix incorrect ChannelManager type annotations
  // These methods return arrays or other types, not ChannelManager
  let fixed = content
    .replace(/const (\w+): ChannelManager = await (.+?)\.getAllChannelInfos\(\)/g,
             'const $1 = await $2.getAllChannelInfos()')
    .replace(/const (\w+): ChannelManager = await (.+?)\.getAllChannels\(\)/g,
             'const $1 = await $2.getAllChannels()')
    .replace(/const (\w+): ChannelManager = await (.+?)\.getChannelInfos\(\)/g,
             'const $1 = await $2.getChannelInfos()')
    .replace(/const (\w+): ChannelManager = await (.+?)\.getChannelEntries\(([^)]+)\)/g,
             'const $1 = await $2.getChannelEntries($3)')
    .replace(/const (\w+): ChannelManager = await (.+?)\.getChannelMessages\(([^)]+)\)/g,
             'const $1 = await $2.getChannelMessages($3)')
    .replace(/const (\w+): ChannelManager = await (.+?)\.hasChannel\(([^)]+)\)/g,
             'const $1 = await $2.hasChannel($3)');

  if (fixed !== content) {
    const changeCount = (content.match(/: ChannelManager = await/g) || []).length;
    if (changeCount > 0) {
      console.log(`Fixed ${changeCount} ChannelManager type annotations in ${file}`);
      fs.writeFileSync(file, fixed);
      totalFixed += changeCount;
    }
  }
}

console.log(`\nTotal ChannelManager type annotations fixed: ${totalFixed}`);