# CLAUDE.md

This file provides guidance to Claude Code when working with LAMA Electron.

## Dual ONE.core Architecture

**CRITICAL**: This Electron app runs TWO separate ONE.core instances:

1. **Browser Instance** (Renderer Process)
   - Location: `/electron-ui/`
   - Platform: Browser environment with IndexedDB
   - Role: UI responsiveness, sparse storage
   - State: Managed locally in browser

2. **Node Instance** (Main Process) 
   - Location: `/main/hybrid/`
   - Platform: Node.js with file system
   - Role: Archive storage, heavy computation, network operations
   - State: Provisioned from browser instance

### Authentication Flow

The app follows a specific authentication sequence:

1. **Browser First**: User logs in via browser UI
2. **Node Provisioning**: Browser provisions the Node instance with credentials
3. **State Sync**: User state propagates from Node to stateManager
4. **Ready**: Both instances are authenticated and ready

### Common Issues

**"User not authenticated - node not provisioned"**
- This occurs when trying to create conversations before login
- Solution: User must log in first via the browser UI
- The Node instance is provisioned automatically after browser login

### Key Files

- `/ELECTRON-ARCHITECTURE.md` - Full architecture documentation
- `/main/hybrid/node-provisioning.js` - Node provisioning logic
- `/main/hybrid/real-node-instance.js` - Node ONE.core instance
- `/electron-ui/src/services/init-flow.ts` - Browser initialization
- `/main/ipc/handlers/chat.js` - Chat handler with auth checks

### Development Notes

- Main process uses CommonJS (`require`)
- Renderer uses ESM (`import`)
- IPC communication via contextBridge
- Future: CHUM sync between instances

For consistency with the Expo/React Native LAMA app, we maintain similar patterns where possible.