# Electron ONE.CORE Architecture

## Two Parallel ONE.CORE Instances

This Electron application runs **TWO separate ONE.CORE instances in parallel**:

### 1. Main Process Instance (Node.js)
- **Location**: Main Electron process
- **Platform**: `@refinio/one.core/lib/system/load-nodejs.js`
- **Purpose**: 
  - Full system access (UDP sockets, file system, native modules)
  - Network operations and P2P connections
  - Heavy computational tasks
  - Secure key management
- **Storage**: File-based storage on disk
- **Loaded in**: `src/preload.cjs` (line 16)

### 2. Renderer Process Instance (Browser)
- **Location**: Renderer/Browser process
- **Platform**: `@refinio/one.core/lib/system/load-browser.js`
- **Purpose**:
  - UI-related operations
  - Quick access for display data
  - Local caching and state management
- **Storage**: IndexedDB-based storage
- **Loaded in**: 
  - `src/platform-loader.ts` (line 22)
  - `src/services/one-core-debug.ts` (line 24)
  - `src/platform/initPlatform.ts` (line 7)

## Communication Between Instances

The two instances communicate via Electron IPC:
- Main process exposes APIs through contextBridge
- Renderer requests operations from main when needed
- Each instance maintains its own state and storage

## Why Two Instances?

1. **Security**: Main process handles sensitive operations with full Node.js capabilities
2. **Performance**: Renderer has quick local access to UI data without IPC overhead
3. **Separation of Concerns**: 
   - Main handles networking, crypto, and system operations
   - Renderer handles UI state and user interactions
4. **Resilience**: If one instance has issues, the other can continue operating

## Important Notes

- **NEVER** remove either instance - they work together
- **NEVER** try to merge them into one - they serve different purposes
- The renderer instance uses browser platform for a reason (security sandbox)
- The main instance uses Node.js platform for system access
- Both instances must be initialized properly with their respective recipes

## Recipe Registration

Both instances need proper recipe registration:
- Main process: Registers all recipes during initialization
- Renderer process: Registers recipes via MultiUser pattern (current implementation)

## Storage Locations

- **Main Process**: `~/.lama-electron/` (or app data directory)
- **Renderer Process**: IndexedDB with key `lama-browser-data`