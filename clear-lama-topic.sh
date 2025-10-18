#!/bin/bash
# Clear LAMA storage completely

echo "Stopping Electron if running..."
ps aux | grep "[e]lectron dist/lama-electron-shadcn.js" | awk '{print $2}' | xargs kill 2>/dev/null
sleep 2

echo "Clearing ONE.core storage directories..."
# Clear the actual storage location in project directory
rm -rf OneDB/*
# Also clear browser storage if it exists
rm -rf ~/.one-core/browser/*

echo "Storage cleared completely. Everything will be recreated on next login."
echo "You can now run the app with: npm run electron"
