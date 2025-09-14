# LAMA Electron Architecture v3.0

## Overview

LAMA Electron is a desktop application that runs a SINGLE ONE.core instance in Node.js with a pure UI layer in the browser. This simplified architecture provides clean separation of concerns with all data operations handled via IPC.

## Core Architecture (v3.0)

### Major Simplifications
1. **Single ONE.core Instance**: Only Node.js runs ONE.core
2. **Pure UI Layer**: Browser is just UI, no ONE.core
3. **IPC Only**: All data operations via IPC
4. **No Fallbacks**: Fail fast, fix problems

## Single ONE.core Architecture

### 1. Browser (Renderer Process) - UI ONLY
- **Location**: `/electron-ui/`
- **Platform**: Browser environment
- **Role**: UI ONLY - rendering and user interaction
- **ONE.core**: NONE - no ONE.core instance
- **Storage**: NONE - all data from Node.js
- **Communication**: IPC only via `window.electronAPI`

### 2. Node.js Instance (Main Process) - SINGLE ONE.core
- **Location**: `/main/core/node-one-core.js`
- **Platform**: Node.js with file system
- **Role**: ALL data operations, storage, AI, networking
- **Storage**: File system (persistent)
- **Models**: SingleUserNoAuth, LeuteModel, ChannelManager, AI contacts
- **Server**: WebSocket server on port 8765 (for external connections if needed)

## Communication Architecture

### IPC-Only Model
```
Browser UI <---> IPC (electronAPI) <---> Node.js ONE.core
```

**Benefits:**
- Simple, clean architecture
- Single source of truth
- No synchronization issues
- No complex federation

**Implementation:**
- Browser: Calls `window.electronAPI.invoke()` for all operations
- Node.js: IPC handlers in `/main/ipc/handlers/`
- No direct ONE.core access from browser
- All data flows through IPC

## Group Chat Architecture (Deviation from one.leute)

LAMA uses a unified group chat architecture for ALL conversations, including P2P:

### Key Architectural Decisions:
1. **All conversations are group chats** - Even P2P conversations use the group chat structure
2. **TopicGroupManager** handles all conversation creation and participant management
3. **Each participant gets their own channel** - Following one.leute's multi-channel pattern
4. **Group objects control access** - All participants are members of a Group

### P2P Conversations:
- Topic ID format: `person1ID<->person2ID` (sorted alphabetically)
- Both participants must have channels created for bidirectional message flow
- Messages flow through the group structure, not direct P2P
- Access controlled via Group objects with both participants as members

### Why This Architecture:
- **Simplifies code** - One unified flow for all conversation types
- **Enables easy upgrade** - P2P chats can become group chats seamlessly
- **Consistent permissions** - Same access control for all conversations
- **Better feature support** - Read receipts, presence, typing indicators work uniformly

### Known Architectural Debt:
- Topic IDs are parsed to extract participants (should pass explicitly)
- Contact names not properly synchronized between peers
- Should consider separate P2P and group flows in future refactor

## Authentication Flow

### Simple Login Process
1. **User enters credentials** in browser UI
2. **Browser calls IPC**: `electronAPI.invoke('onecore:initializeNode', credentials)`
3. **Node.js initializes ONE.core** with SingleUserNoAuth
4. **Node.js returns success** via IPC
5. **Browser UI updates** based on IPC response

No browser ONE.core initialization needed!

## Key Architectural Principles

### NO FALLBACKS
- Browser ONLY uses IPC
- If IPC fails, operation fails
- Fix the root cause, don't mitigate

### NO BROWSER ONE.CORE
- No ONE.core imports in browser
- No AppModel in browser
- No LeuteModel in browser
- No SingleUserNoAuth in browser

### SINGLE SOURCE OF TRUTH
- One ONE.core instance (Node.js)
- One data store (file system)
- One authentication (Node.js)
- All access via IPC

## Group Chat Architecture (one.leute Compatible)

### How Group Chats Work
LAMA follows the one.leute architecture for group chats to ensure compatibility with peer instances:

1. **ONE Topic ID** per conversation (e.g., "GroupChat123")
2. **MULTIPLE Channels** - one per participant, all sharing the same topic ID
3. **Each participant posts to their OWN channel** (channelOwner = their personId)
4. **All participants can READ from ALL channels** via group access
5. **Messages are aggregated** from all participant channels when displaying

### Group Chat Flow
```
Topic: "GroupChat123"
├── Channel (owner: Alice) - Alice posts here
├── Channel (owner: Bob)   - Bob posts here
├── Channel (owner: Carol) - Carol posts here
└── Group Access: All can read all channels
```

### Implementation Details
- **TopicGroupManager** (`/main/core/topic-group-manager.js`) handles group creation
- Local node creates its own channel immediately
- Remote participants create their channels when they detect group membership
- ChannelManager aggregates messages from all channels with the same topic ID

## File Structure

### Browser (UI Only)
```
/electron-ui/
├── src/
│   ├── components/        # React components
│   ├── services/
│   │   └── browser-init.ts         # UI init (NO ONE.core)
│   ├── bridge/
│   │   └── lama-bridge.ts  # IPC bridge
│   └── hooks/             # React hooks using IPC
```

### Node.js (ONE.core)
```
/main/
├── core/
│   ├── node-one-core.js   # SINGLE ONE.core instance
│   ├── topic-group-manager.js  # Group chat management (one.leute compatible)
│   ├── ai-contact-manager.js
│   └── ai-message-listener.js
├── ipc/
│   └── handlers/          # IPC handlers
│       ├── chat.js
│       ├── one-core.js
│       └── ...
└── services/
    └── llm-manager.js
```

## Data Flow Examples

### Getting Contacts
```javascript
// Browser (WRONG - old way)
const contacts = await appModel.getContacts()  // NO!

// Browser (RIGHT - new way)
const result = await window.electronAPI.invoke('onecore:getContacts')
const contacts = result.contacts
```

### Sending Message
```javascript
// Browser
await window.electronAPI.invoke('chat:sendMessage', {
  conversationId: 'default',
  content: 'Hello'
})

// Node.js handles everything:
// - Creates message in ONE.core
// - Stores in file system
// - Triggers AI response if needed
// - Returns via IPC
```

## Benefits of Single Instance

1. **Simplicity**: One instance to manage
2. **Performance**: No synchronization overhead
3. **Reliability**: No federation issues
4. **Debugging**: Single point to debug
5. **Maintenance**: Less code, fewer bugs

## Migration Notes

If you see:
- `import ... from '@refinio/one.core'` in browser → REMOVE
- `new AppModel()` in browser → REMOVE
- `simpleBrowserInit.getAppModel()` → Returns null
- Fallback patterns → REMOVE, use IPC only

## Common Issues and Solutions

### "Cannot find AppModel"
- Browser doesn't have AppModel anymore
- Use IPC: `window.electronAPI.invoke()`

### "ONE.core not initialized"
- Browser doesn't initialize ONE.core
- Node.js handles it after login

### "No contacts available"
- Use IPC: `electronAPI.invoke('onecore:getContacts')`
- Don't try to access local LeuteModel

## Summary

The v3.0 architecture is dramatically simplified:
- **ONE** ONE.core instance (Node.js)
- **ZERO** browser ONE.core
- **ALL** operations via IPC
- **NO** fallbacks or workarounds

This ensures clean separation of concerns and prevents the complexity of dual-instance synchronization.