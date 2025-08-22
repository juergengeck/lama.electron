# LAMA Electron Project Structure

## Overview
This repository contains the Electron desktop application for LAMA. The structure has been organized to keep the Electron UI separate from the React Native mobile app for independent updates and maintenance.

## Directory Structure

```
lama.electron/
├── electron-ui/              # Electron UI (React + Vite)
│   ├── src/                  # Source code
│   │   ├── components/       # React components
│   │   ├── models/          # ONE platform models
│   │   ├── hooks/           # React hooks
│   │   ├── bridge/          # LAMA bridge layer
│   │   └── initialization/  # App initialization
│   ├── package.json         # UI dependencies
│   └── vite.config.ts       # Vite configuration
│
├── lama/                    # React Native mobile app (DO NOT MODIFY)
│   └── [mobile app files]
│
├── one.core/               # ONE platform core
├── one.models/             # ONE platform models
├── one.leute/              # Reference web implementation
│
├── lama-electron-shadcn.js # Main Electron process
├── electron-preload.js     # Preload script
└── package.json            # Root package (Electron)
```

## Key Files

- **lama-electron-shadcn.js**: Main Electron process that creates windows and handles IPC
- **electron-ui/**: Contains the entire UI application (React + Vite)
- **electron-preload.js**: Bridge between Electron and web contexts

## Scripts

From root directory:
```bash
# Development
npm run electron     # Start Electron with dev server
npm run dev         # Start Vite dev server only

# Build
npm run build       # Build UI for production
npm run build:ui    # Alternative build command

# Installation
npm run install:all # Install dependencies for both root and UI
```

## Important Notes

1. **DO NOT** place Electron UI files in the `lama/` directory
2. The `lama/` folder contains the React Native mobile app and should remain independent
3. All Electron-specific UI code goes in `electron-ui/`
4. The main process files (lama-electron-shadcn.js, electron-preload.js) stay at root

## Data Management

### Reset App Data
The app includes a reset button in Settings → Privacy that will:
- Clear all conversation history
- Remove all stored data
- Delete app configuration
- Restart the app fresh

App data is stored in:
- macOS: `~/Library/Application Support/LAMA/`
- Linux: `~/.config/LAMA/`
- Windows: `%APPDATA%/LAMA/`

## Development Workflow

1. Make UI changes in `electron-ui/src/`
2. Test with `npm run electron`
3. Build for production with `npm run build`
4. Package with Electron Forge/Builder (to be configured)

## Architecture Benefits

- **Independent Updates**: Mobile and desktop apps can be updated separately
- **Clean Separation**: No mixing of React Native and Electron code
- **Maintainability**: Clear boundaries between platforms
- **Version Control**: Each platform can have its own release cycle