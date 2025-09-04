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
3. **Federation Setup**: Both instances create OneInstanceEndpoints
4. **Connection**: Browser connects to Node via ws://localhost:8765
5. **CHUM Sync**: Data synchronization over established connection
6. **Ready**: Both instances are connected and syncing

### Federation Architecture

**Direct WebSocket Connection**:
- Node.js: Socket listener on ws://localhost:8765 + CommServer for external
- Browser: Outgoing connections only, discovers Node via OneInstanceEndpoint
- Connection: Automatic via LeuteConnectionsModule discovery
- Sync: CHUM protocol handles bidirectional data synchronization

### Common Issues

**"User not authenticated - node not provisioned"**
- This occurs when trying to create conversations before login
- Solution: User must log in first via the browser UI
- The Node instance is provisioned automatically after browser login

**Connection Issues**
- Check Node socket listener on port 8765: Look for "Direct listener on ws://localhost:8765"
- Verify OneInstanceEndpoint creation: Look for "Created OneInstanceEndpoint"
- Ensure no firewall blocking localhost:8765
- Check browser ConnectionsModel logs for discovery attempts

### Key Files

- `/FEDERATION-ARCHITECTURE.md` - Federation and connection documentation
- `/ELECTRON-ARCHITECTURE-V2.md` - Full architecture documentation
- `/main/core/federation-api.js` - Federation API for endpoint management
- `/main/core/node-one-core.js` - Node instance with socket listener
- `/main/hybrid/node-provisioning.js` - Node provisioning logic
- `/electron-ui/src/models/AppModel.ts` - Browser connection setup
- `/electron-ui/src/services/browser-init-simple.ts` - Browser initialization
- `/main/ipc/handlers/chat.js` - Chat handler with auth checks

### Development Notes

- Main process uses CommonJS (`require`)
- Renderer uses ESM (`import`)
- IPC communication via contextBridge for UI operations
- Direct WebSocket for ONE.core instance communication
- CHUM sync between instances is automatic

For consistency with the Expo/React Native LAMA app, we maintain similar patterns where possible.
- No commserver for internal connections (direct WebSocket instead)
- IPC is not used for content (CHUM handles sync)