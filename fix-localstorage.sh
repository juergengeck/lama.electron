#!/bin/bash

echo "Replacing all localStorage usage with IPC storage..."

# Find all TypeScript/TSX files with localStorage
FILES=$(grep -rl "localStorage\." electron-ui/src --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ipc-storage.ts)

for file in $FILES; do
  echo "Processing: $file"
  
  # Check if ipcStorage is already imported
  if ! grep -q "import.*ipcStorage" "$file"; then
    # Add import at the beginning of the file after the first import
    sed -i '' '0,/^import/{/^import/a\
import { ipcStorage } from '"'"'@/services/ipc-storage'"'"'
}' "$file"
  fi
  
  # Replace localStorage.setItem with await ipcStorage.setItem
  sed -i '' 's/localStorage\.setItem(\([^)]*\))/await ipcStorage.setItem(\1)/g' "$file"
  
  # Replace localStorage.getItem with await ipcStorage.getItem  
  sed -i '' 's/localStorage\.getItem(\([^)]*\))/await ipcStorage.getItem(\1)/g' "$file"
  
  # Replace localStorage.removeItem with await ipcStorage.removeItem
  sed -i '' 's/localStorage\.removeItem(\([^)]*\))/await ipcStorage.removeItem(\1)/g' "$file"
  
  # Replace localStorage.clear with await ipcStorage.clear
  sed -i '' 's/localStorage\.clear()/await ipcStorage.clear()/g' "$file"
  
  # Mark functions as async if they now contain await
  # This is complex, so we'll need to handle manually
done

echo "Done! Now need to manually:"
echo "1. Make functions async that now contain await"
echo "2. Handle error cases properly"
echo "3. Test the application"