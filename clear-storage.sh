#!/bin/bash

echo "Clearing all LAMA Electron storage..."

# Clear Node.js ONE.core storage
echo "Clearing Node.js storage..."
rm -rf one-core-storage/

# Clear Electron app data (macOS specific)
echo "Clearing Electron app data..."
rm -rf ~/Library/Application\ Support/lama/
rm -rf ~/Library/Application\ Support/Electron/

# Clear Chrome/Chromium IndexedDB (where Electron stores browser data)
echo "Clearing browser storage..."
rm -rf ~/Library/Application\ Support/Google/Chrome/Default/IndexedDB/*lama*
rm -rf ~/Library/Application\ Support/Chromium/Default/IndexedDB/*lama*

echo "✅ All storage cleared. Please restart the app."