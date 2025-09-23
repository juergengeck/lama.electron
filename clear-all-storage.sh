#!/bin/bash
# Clear all ONE.core storage for fresh start

echo "Clearing all ONE.core storage..."

# Clear ONE.core storage (all instances)
echo "Clearing OneDB directory..."
rm -rf OneDB

# Clear browser storage (Electron stores it in userData)
echo "Clearing browser storage..."
rm -rf ~/Library/Application\ Support/lama/IndexedDB
rm -rf ~/Library/Application\ Support/lama/Local\ Storage
rm -rf ~/Library/Application\ Support/lama/Session\ Storage

echo "All storage cleared. Ready for fresh start."