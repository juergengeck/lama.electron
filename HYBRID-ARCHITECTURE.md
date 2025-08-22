# Hybrid CHUM-Based Architecture

## Overview

Instead of traditional IPC, we run TWO independent ONE.CORE instances that sync via CHUM:

```
┌─────────────────────────────────────┐     ┌─────────────────────────────────────┐
│      MAIN PROCESS (Node.js)         │     │     RENDERER PROCESS (Browser)      │
│                                     │     │                                     │
│  ┌─────────────────────────────┐   │     │  ┌─────────────────────────────┐   │
│  │   ONE.CORE Instance (Node)  │   │     │  │  ONE.CORE Instance (Browser)│   │
│  │                             │   │     │  │                             │   │
│  │  - Full Node.js APIs        │   │     │  │  - IndexedDB Storage        │   │
│  │  - File system access       │   │     │  │  - WebCrypto                │   │
│  │  - Network sockets          │   │◄────┼──┤  - React UI                 │   │
│  │  - Heavy computation        │   │CHUM │  │  - User interactions        │   │
│  │  - LLM inference            │   │SYNC │  │  - Real-time updates        │   │
│  └─────────────────────────────┘   │     │  └─────────────────────────────┘   │
│                                     │     │                                     │
│  Both instances are PEERS          │     │  Both instances are PEERS          │
│  No master/slave relationship      │     │  No master/slave relationship      │
└─────────────────────────────────────┘     └─────────────────────────────────────┘
```

## Key Benefits

1. **No IPC Complexity**: Instances communicate via CHUM protocol
2. **True Distributed**: Both instances are equal peers
3. **Offline Capable**: Each instance works independently
4. **Automatic Sync**: CRDT-based conflict resolution
5. **Testbed**: Perfect for testing ONE.CORE's distributed features

## Implementation

### 1. Main Process (Node.js)

```javascript
// main/instance.js
class NodeInstance {
  async initialize() {
    // Load Node.js platform
    await import('@refinio/one.core/lib/system/load-nodejs.js')
    
    // Create instance with CHUM
    this.instance = new Instance()
    this.chum = new ChumSync(this.instance)
    
    // Start CHUM server on local port
    await this.chum.listen(8765)
    
    // Handle heavy operations
    this.setupWorkers()
  }
  
  setupWorkers() {
    // LLM inference worker
    this.llmWorker = new Worker('./workers/llm.js')
    
    // File operations
    this.fileHandler = new FileHandler()
    
    // Network operations
    this.networkManager = new NetworkManager()
  }
}
```

### 2. Renderer Process (Browser)

```javascript
// renderer/instance.js
class BrowserInstance {
  async initialize() {
    // Load browser platform
    await import('@refinio/one.core/lib/system/load-browser.js')
    
    // Create instance with CHUM
    this.instance = new Instance()
    this.chum = new ChumSync(this.instance)
    
    // Connect to main process CHUM
    await this.chum.connect('ws://localhost:8765')
    
    // Set up UI bindings
    this.setupUIBindings()
  }
  
  setupUIBindings() {
    // React components interact directly with local instance
    this.instance.on('objectCreated', (obj) => {
      // Update UI state
      updateReactState(obj)
    })
  }
}
```

### 3. CHUM Synchronization

```javascript
// shared/chum-config.js
const CHUM_CONFIG = {
  // What to sync between instances
  syncTypes: [
    'Message',
    'Conversation', 
    'Contact',
    'Settings'
  ],
  
  // Sync strategies
  strategies: {
    Message: 'append-only',      // Messages never conflict
    Conversation: 'last-write',  // Latest update wins
    Contact: 'merge',            // Merge contact fields
    Settings: 'instance-local'   // Don't sync settings
  }
}
```

### 4. Hybrid Operations

Some operations are best suited for specific instances:

#### Node Instance Handles:
- File operations (import/export)
- LLM inference
- Network connections
- Heavy crypto operations
- Background sync

#### Browser Instance Handles:
- UI interactions
- Local state management
- Quick crypto (WebCrypto)
- IndexedDB queries
- Real-time updates

#### Both Handle:
- Message creation
- Contact management
- Settings (local only)
- CRDT operations

### 5. Communication Flow

```
User Action in UI (Browser)
    │
    ▼
Create object in Browser Instance
    │
    ▼
Store in IndexedDB
    │
    ▼
CHUM syncs to Node Instance
    │
    ▼
Node Instance receives object
    │
    ▼
Node performs heavy operations (if needed)
    │
    ▼
Creates response object
    │
    ▼
CHUM syncs back to Browser
    │
    ▼
UI updates automatically
```

## Example: Sending a Message with AI Enhancement

```javascript
// Browser Instance
async function sendMessage(text) {
  // 1. Create message locally
  const message = await browserInstance.createObject({
    type: 'Message',
    text,
    needsAI: true,
    status: 'pending'
  })
  
  // 2. Message auto-syncs to Node via CHUM
  // 3. Node instance detects needsAI flag
}

// Node Instance (auto-triggered by CHUM sync)
nodeInstance.on('objectCreated', async (obj) => {
  if (obj.type === 'Message' && obj.needsAI) {
    // 4. Run AI enhancement
    const enhanced = await llmWorker.enhance(obj.text)
    
    // 5. Create enhanced message
    const enhancedMessage = await nodeInstance.createObject({
      type: 'Message',
      originalId: obj.id,
      text: enhanced,
      status: 'enhanced'
    })
    
    // 6. Auto-syncs back to browser
  }
})

// Browser Instance (receives enhanced message)
browserInstance.on('objectCreated', (obj) => {
  if (obj.type === 'Message' && obj.status === 'enhanced') {
    // 7. Update UI with enhanced message
    updateMessageInUI(obj)
  }
})
```

## Advantages Over IPC

1. **Simpler**: No IPC channel management
2. **Robust**: Works even if one instance crashes
3. **Flexible**: Can add more instances (mobile, other devices)
4. **Standard**: Uses ONE.CORE's native sync protocol
5. **Testable**: Same code works distributed or local

## Configuration

### Development Mode
- Both instances on same machine
- WebSocket connection via localhost
- Instant sync for testing

### Production Mode
- Can run on different machines
- Works over network
- Can sync with mobile/web clients

### Offline Mode
- Each instance works independently
- Syncs when connection restored
- No data loss

## Migration Path

1. **Phase 1**: Set up both instances
2. **Phase 2**: Establish CHUM connection
3. **Phase 3**: Migrate features to use local instances
4. **Phase 4**: Remove IPC code
5. **Phase 5**: Optimize sync strategies

## Security

- Each instance has its own keys
- CHUM connections are encrypted
- Can add authentication between instances
- No direct access between processes

## Performance

- UI remains responsive (browser instance)
- Heavy ops don't block (node instance)
- Parallel processing (both instances)
- Efficient sync (only changes)

This architecture makes LAMA a true distributed application where even the desktop app itself is distributed!