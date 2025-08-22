# LAMA Electron Architecture

## Overview

LAMA Electron implements a hybrid architecture with two separate ONE.CORE instances that will eventually sync via CHUM protocol. This provides the best of both worlds: responsive UI with browser storage and powerful backend with Node.js capabilities.

## Current Implementation Status

### ✅ Completed
- Browser-first initialization flow
- Simplified browser instance with localStorage
- Node.js instance ready for provisioning
- Security through obscurity (credentials = deployment)
- Context isolation for security
- Demo user credentials

### 🚧 In Progress
- CHUM sync between instances
- CRDT-based state synchronization
- Worker processes for LLM

### 📋 Planned
- Sparse storage in browser
- Archive storage in Node
- Verifiable credentials for IoM

## Architecture Components

### 1. Main Process (Node.js)
**Location**: `/main/`

- **app.js**: Main application entry point
- **hybrid/node-one-instance.js**: Node.js ONE.CORE instance (archive storage)
- **hybrid/node-provisioning.js**: Handles provisioning from browser

**Features**:
- Full Node.js API access
- File system operations
- Network capabilities
- LLM inference (planned)
- Archive storage (keeps everything)

### 2. Renderer Process (Browser)
**Location**: `/electron-ui/src/`

- **services/simple-browser-instance.ts**: Simplified browser storage using localStorage
- **services/init-flow.ts**: Initialization and provisioning flow
- **components/LoginDeploy.tsx**: Security through obscurity login

**Features**:
- Clean browser environment (no Node.js)
- localStorage for persistence
- Responsive UI
- Sparse storage (planned)

### 3. Communication Layer

#### IPC (Current)
- **electron-preload.js**: Uses contextBridge for secure IPC
- **services/one-core-client.ts**: IPC client for renderer

```javascript
// Preload script exposes limited API
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => { /* ... */ },
  off: (channel, callback) => { /* ... */ }
})
```

#### CHUM (Planned)
- P2P sync between browser and Node instances
- No IPC needed for data sync
- Real-time synchronization

## Security Model

### Context Isolation
- **Enabled**: Renderer process is isolated from Node.js
- **No Node Integration**: Clean browser environment
- **Preload Script**: Only bridge between main and renderer

### Security Through Obscurity
- Credentials ARE the deployment
- No user enumeration
- Each credential pair creates isolated instance
- No "user exists" errors

## Data Flow

### Current Flow (IPC)
```
User Action (Browser)
    ↓
SimpleBrowserInstance (localStorage)
    ↓
IPC via electronAPI
    ↓
Node Provisioning (if needed)
    ↓
Node ONE.CORE Instance
```

### Future Flow (CHUM)
```
User Action (Browser)
    ↓
Browser ONE.CORE Instance
    ↓
CHUM Sync ←→ Node ONE.CORE Instance
    ↓           ↓
IndexedDB    File System
```

## Storage Strategy

### Browser Instance
- **Current**: localStorage (simplified)
- **Planned**: IndexedDB with ONE.CORE
- **Retention**: 30 days of recent data
- **Size Limit**: 500MB
- **Eviction**: LRU (Least Recently Used)

### Node Instance  
- **Storage**: File system
- **Retention**: Forever (archive)
- **Size Limit**: Unlimited
- **Role**: Backup, heavy computation, file operations

## Initialization Flow

1. **Browser First**: Browser instance initializes first
2. **Check Auth**: Check localStorage for existing user
3. **Login/Deploy**: 
   - Existing credentials → Login
   - New credentials → Deploy new instance
4. **Provision Node**: Browser provisions Node with credential
5. **Future**: Establish CHUM connection

## File Structure

```
/lama.electron/
├── main/                    # Main process (Node.js)
│   ├── app.js              # Application entry
│   └── hybrid/             # Hybrid architecture
│       ├── node-one-instance.js
│       └── node-provisioning.js
├── electron-ui/            # Renderer process (Browser)
│   └── src/
│       ├── services/
│       │   ├── simple-browser-instance.ts
│       │   ├── init-flow.ts
│       │   └── one-core-client.ts
│       └── components/
│           └── LoginDeploy.tsx
├── electron-preload.js     # Preload script
└── lama-electron-shadcn.js # Electron main entry
```

## Configuration

### Window Configuration
```javascript
{
  webPreferences: {
    nodeIntegration: false,    // Clean browser
    contextIsolation: true,    // Security
    preload: 'electron-preload.js'
  }
}
```

### Demo Credentials
- Username: `demo`
- Password: `demo`

## Development Commands

```bash
# Start development
NODE_ENV=development npm run electron

# Kill all Electron processes
pkill -f Electron
```

## Known Issues & Solutions

### Module Import Errors
- ONE.CORE has mixed CommonJS/ESM modules
- Solution: SimpleBrowserInstance avoids complex imports

### Context Isolation Errors
- Window configurations must match
- Both main/app.js and lama-electron-shadcn.js must use same settings

### Platform Detection
- Electron renderer may be detected as Node.js
- Solution: Context isolation creates clean browser environment

## Future Enhancements

1. **CHUM Sync**: Replace IPC with P2P sync
2. **Sparse Storage**: Implement real ONE.CORE in browser
3. **Archive Storage**: Full ONE.CORE in Node
4. **Workers**: LLM inference, crypto operations
5. **IoM**: Internet of Me with verifiable credentials