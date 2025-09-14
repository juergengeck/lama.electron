# CLAUDE.md

This file provides guidance to Claude Code when working with LAMA Electron.

## Single ONE.core Architecture

**CRITICAL**: This Electron app runs ONE ONE.core instance in Node.js ONLY:

1. **Browser** (Renderer Process)
   - Location: `/electron-ui/`
   - Role: UI ONLY - NO ONE.core instance
   - Communication: ALL data operations via IPC
   - NO AppModel, NO LeuteModel, NO ChannelManager
   - NO SingleUserNoAuth - authentication handled by Node.js

2. **Node.js Instance** (Main Process) 
   - Location: `/main/core/node-one-core.js`
   - Platform: Node.js with file system
   - Role: SINGLE ONE.core instance - handles EVERYTHING
   - Models: SingleUserNoAuth, LeuteModel, ChannelManager, AI contacts, etc.
   - Storage: File system based

### Authentication Flow

The app follows a simple authentication flow:

1. **UI Login**: User enters credentials in browser UI
2. **IPC Call**: Browser calls `onecore:initializeNode` via IPC
3. **Node.js Init**: Node.js initializes ONE.core with SingleUserNoAuth
4. **Ready**: Node.js ONE.core is ready, UI gets data via IPC

### Architecture Principles

**NO FALLBACKS**: 
- Browser ONLY uses IPC - no fallback to local models
- If IPC fails, operations fail - no mitigation
- Fix the problem, don't work around it

**NO BROWSER ONE.CORE**:
- Browser has NO ONE.core imports
- Browser has NO AppModel
- Browser is JUST a UI layer
- ALL data comes from Node.js via IPC

### Common Issues

**"User not authenticated - node not provisioned"**
- This occurs when trying to create conversations before login
- Solution: User must log in first via the browser UI
- The Node instance is initialized after login

**Browser AppModel references**
- REMOVE THEM - Browser should NOT have AppModel
- Use IPC instead: `window.electronAPI.invoke()`
- All data operations go through Node.js

### Key Files

- `/main/core/node-one-core.js` - SINGLE Node.js ONE.core instance
- `/main/ipc/handlers/` - IPC handlers for all operations
- `/electron-ui/src/services/browser-init.ts` - UI initialization (NO ONE.core)
- `/electron-ui/src/bridge/lama-bridge.ts` - IPC bridge for UI

### Development Notes

- Main process uses CommonJS (`require`)
- Renderer uses ESM (`import`) 
- IPC communication via contextBridge for ALL operations
- NO direct ONE.core access from browser
- NO fallbacks - fail fast and fix

For consistency and simplicity:
- ONE instance (Node.js)
- ONE source of truth
- IPC for everything
- No complex federation/pairing needed
- reference implementations are in ./reference