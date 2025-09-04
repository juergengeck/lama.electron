#!/bin/bash

# Convert all handler files to ESM
for file in /Users/gecko/src/lama.electron/main/ipc/handlers/*.js; do
  if [ "$file" = "/Users/gecko/src/lama.electron/main/ipc/handlers/ai.js" ]; then
    echo "Skipping ai.js (already converted)"
    continue
  fi
  
  echo "Converting $(basename $file)..."
  
  # Replace require statements with imports
  sed -i '' "s/const \([a-zA-Z]*\) = require('\(.*\)')/import \1 from '\2.js'/g" "$file"
  sed -i '' "s/const { \(.*\) } = require('\(.*\)')/import { \1 } from '\2.js'/g" "$file"
  
  # Replace module.exports with export default
  sed -i '' "s/module\.exports = /export default /g" "$file"
  
  echo "  Converted $(basename $file)"
done

echo "All handler files converted to ESM"