#!/bin/bash

# Fix all getAppModel references in the UI code
echo "Fixing getAppModel references..."

# List of files to fix
files=(
  "electron-ui/src/components/ChatView.tsx"
  "electron-ui/src/components/SettingsView.tsx"
  "electron-ui/src/components/ConnectionsView.tsx"
  "electron-ui/src/components/AISettingsView.tsx"
  "electron-ui/src/components/SettingsView.js"
  "electron-ui/src/components/ConnectionsView.js"
  "electron-ui/src/components/AISettingsView.js"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    # Replace getAppModel calls
    sed -i '' 's/lamaBridge\.getAppModel()/null/g' "$file"
    # Add comment before null assignments
    sed -i '' 's/const appModel = null/\/\/ NO AppModel in browser - everything via IPC\
  const appModel = null/g' "$file"
  fi
done

echo "Done!"