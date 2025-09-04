#!/bin/bash
# Clear all ONE.core storage for fresh start

echo "Clearing all ONE.core storage..."

# Clear Node.js storage
echo "Clearing Node.js storage..."
rm -rf one-core-storage/node

# Clear browser IndexedDB (Electron stores it in userData)
echo "Clearing browser IndexedDB..."
rm -rf ~/Library/Application\ Support/lama/IndexedDB
rm -rf ~/Library/Application\ Support/lama/Local\ Storage
rm -rf ~/Library/Application\ Support/lama/Session\ Storage

echo "All storage cleared. Ready for fresh start."