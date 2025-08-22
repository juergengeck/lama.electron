# LAMA Electron Architecture

## Core Principle

**Hybrid architecture with Internet of Me (IoM)**. Business logic is distributed between Node.js main process (with full ONE.CORE + IoM) and browser renderer (with sparse ONE.CORE for UI state).

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                MAIN PROCESS (Node.js) - Full Archive         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              INTERNET OF ME (IoM) STACK                │  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │  │
│  │  │   ONE.CORE   │  │  ONE.MODELS  │  │  IoMManager │ │  │
│  │  │   (Archive)  │  │              │  │             │ │  │
│  │  │  - Storage   │  │  - MultiUser │  │  - IoM Group│ │  │
│  │  │  - Crypto    │  │  - LeuteModel│  │  - Device   │ │  │
│  │  │  - Instance  │  │  - Channels  │  │    Sync     │ │  │
│  │  │  - CHUM      │  │  - Trust Cert│  │  - P2P Mesh │ │  │
│  │  └──────────────┘  └──────────────┘  └─────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                 HYBRID NODE INSTANCE                   │  │
│  │                                                        │  │
│  │  - Real Node Instance (full archive storage)           │  │
│  │  - Node Provisioning (browser → node sync)            │  │
│  │  - Cross-instance CHUM synchronization                 │  │
│  │  - File system operations                              │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  IPC CONTROLLER                        │  │
│  │                                                        │  │
│  │  Bridges Node.js and Browser instances:                │  │
│  │  - Action forwarding (CRUD operations)                 │  │
│  │  - State synchronization                                │  │
│  │  - App data management (reset, backup)                 │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                               │
                               │ IPC
                               ▼
┌──────────────────────────────────────────────────────────────┐
│           RENDERER PROCESS (Browser) - Sparse Storage        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               BROWSER ONE.CORE INSTANCE                │  │
│  │                                                        │  │
│  │  - Sparse storage (IndexedDB)                          │  │
│  │  - MultiUser authentication                            │  │
│  │  - Local state management                              │  │
│  │  - CHUM sync with Node instance                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    REACT UI + MODELS                   │  │
│  │                                                        │  │
│  │  Components:           Models:                         │  │
│  │  - ChatLayout         - AppModel (orchestrator)       │  │
│  │  - ChatView           - LLMManager (AI providers)     │  │
│  │  - SettingsView       - AIAssistantModel              │  │
│  │  - ModelOnboarding    - Conversation persistence      │  │
│  │                                                        │  │
│  │  State: Full application state with browser storage   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Hybrid Architecture with IoM

The app uses a **hybrid approach** combining:

- **Node.js Process**: Full ONE.CORE archive with IoM for device synchronization
- **Browser Process**: Sparse ONE.CORE for UI state and local operations
- **CHUM Synchronization**: Automatic state sync between instances

### 2. Internet of Me (IoM) Integration

The Node.js backend establishes a full IoM:

- **IoMManager**: Manages device connections and synchronization
- **LeuteModel**: Identity management with trust certificates
- **ChannelManager**: Data channels for multi-device sync
- **MultiUser Auth**: Secure multi-user support with encryption
- **Trust Certificates**: Automatic trusted key management
- **P2P Mesh Network**: Direct device-to-device communication

### 3. Dual Instance Strategy

Both processes maintain ONE.CORE instances:

- **Node.js**: Archive storage with full history (main/hybrid/real-node-instance.js)
- **Browser**: Sparse storage for active data (services/real-browser-instance.ts)
- **Provisioning**: Browser provisions Node instance on startup
- **Sync**: CHUM protocol keeps instances synchronized

### 4. Communication Pattern

```typescript
// Renderer: User clicks "Send Message"
await ipc.invoke('action:sendMessage', {
  conversationId: '123',
  text: 'Hello'
})

// Main Process: Handles the action
ipcMain.handle('action:sendMessage', async (event, { conversationId, text }) => {
  // 1. Validate input
  // 2. Create message object using one.models
  // 3. Store in one.core
  // 4. Update conversation state
  // 5. Broadcast to peers
  // 6. Return updated state
  return getConversationState(conversationId)
})

// Main Process: Pushes updates to renderer
mainWindow.webContents.send('state:conversationUpdated', {
  conversationId: '123',
  messages: [...],
  participants: [...]
})
```

## Worker Processes

For compute-intensive tasks, we use dedicated worker processes:

```
┌──────────────────────────────────────────────────────────────┐
│                     MAIN PROCESS (Node.js)                   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                 WORKER PROCESS MANAGER                 │  │
│  │                                                        │  │
│  │  - Spawns/manages worker processes                     │  │
│  │  - Routes tasks to appropriate workers                 │  │
│  │  - Handles worker crashes/restarts                     │  │
│  │  - Load balancing across workers                       │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                    │                    │
        ┌───────────┴──────────┐         └──────────┐
        ▼                      ▼                    ▼
┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│  LLM WORKER    │    │  CRYPTO WORKER │    │  SYNC WORKER   │
│                │    │                │    │                │
│ - LLM inference│    │ - Heavy crypto │    │ - CRDT sync    │
│ - Embeddings   │    │ - Key derive   │    │ - Diff compute │
│ - RAG search   │    │ - Bulk encrypt │    │ - Merge ops    │
│ - Summarization│    │ - Signatures   │    │ - Replication  │
└────────────────┘    └────────────────┘    └────────────────┘
```

### Worker Types

#### 1. LLM Worker
- Runs AI model inference
- Manages model loading/unloading
- Handles prompt processing
- Generates embeddings
- Can use GPU if available

#### 2. Crypto Worker
- Performs heavy cryptographic operations
- Bulk encryption/decryption
- Key derivation
- Digital signatures
- Certificate validation

#### 3. Sync Worker
- CRDT synchronization
- Diff computation
- Merge operations
- Conflict resolution
- Data replication

#### 4. Index Worker (Future)
- Search indexing
- Full-text search
- Vector search for embeddings
- Graph traversal

## Implementation Structure

### Main Process Structure

```
/main/
  ├── app.js                 # Main entry point
  ├── core/
  │   ├── instance.js       # ONE.CORE instance management
  │   ├── storage.js        # Storage operations
  │   └── network.js        # Network management
  ├── models/
  │   ├── auth.js           # Authentication model
  │   ├── user.js           # User model
  │   ├── conversation.js   # Conversation model
  │   ├── message.js        # Message model
  │   └── contact.js        # Contact model
  ├── state/
  │   ├── manager.js        # Central state manager
  │   ├── user-state.js     # User session state
  │   ├── chat-state.js     # Chat state
  │   └── app-state.js      # Application state
  ├── workers/
  │   ├── manager.js        # Worker process manager
  │   ├── llm/
  │   │   ├── worker.js     # LLM worker process
  │   │   ├── inference.js  # Inference logic
  │   │   └── models.js     # Model management
  │   ├── crypto/
  │   │   ├── worker.js     # Crypto worker process
  │   │   └── operations.js # Crypto operations
  │   └── sync/
  │       ├── worker.js     # Sync worker process
  │       └── crdt.js       # CRDT operations
  ├── ipc/
  │   ├── controller.js     # Main IPC controller
  │   ├── handlers/
  │   │   ├── auth.js       # Auth-related handlers
  │   │   ├── chat.js       # Chat-related handlers
  │   │   ├── contacts.js   # Contact-related handlers
  │   │   ├── ai.js         # AI-related handlers
  │   │   └── settings.js   # Settings handlers
  │   └── events.js         # Event broadcaster
  └── services/
      ├── sync.js          # Sync service
      ├── crypto.js        # Crypto service
      ├── network.js       # Network service
      └── ai.js            # AI service (delegates to worker)
```

### Worker Communication

```javascript
// Main process
class WorkerManager {
  constructor() {
    this.llmWorker = new Worker('./workers/llm/worker.js')
    this.cryptoWorker = new Worker('./workers/crypto/worker.js')
    this.syncWorker = new Worker('./workers/sync/worker.js')
  }
  
  async runInference(prompt, options) {
    return this.llmWorker.postMessage({
      type: 'inference',
      prompt,
      options
    })
  }
  
  async bulkEncrypt(data) {
    return this.cryptoWorker.postMessage({
      type: 'bulk-encrypt',
      data
    })
  }
}

// LLM Worker
process.on('message', async (message) => {
  switch(message.type) {
    case 'inference':
      const result = await runInference(message.prompt)
      process.send({ result })
      break
    case 'load-model':
      await loadModel(message.modelPath)
      process.send({ success: true })
      break
  }
})
```

### Worker Pool Management

```javascript
class WorkerPool {
  constructor(workerPath, poolSize = 4) {
    this.workers = []
    this.queue = []
    this.busy = new Set()
    
    for (let i = 0; i < poolSize; i++) {
      this.workers.push(this.createWorker(workerPath))
    }
  }
  
  async execute(task) {
    const worker = await this.getAvailableWorker()
    this.busy.add(worker)
    
    try {
      const result = await worker.execute(task)
      return result
    } finally {
      this.busy.delete(worker)
      this.processQueue()
    }
  }
}
```

### Renderer Structure

```
/renderer/
  ├── App.tsx              # Main React app
  ├── hooks/
  │   ├── useIPC.ts       # IPC communication hook
  │   ├── useAppState.ts  # App state subscription
  │   └── useActions.ts   # User action handlers
  ├── components/
  │   ├── LoginForm.tsx   # Login UI
  │   ├── ChatView.tsx    # Chat UI
  │   ├── MessageList.tsx # Message display
  │   └── ContactList.tsx # Contacts UI
  └── services/
      └── ipc-client.ts   # IPC client wrapper
```

## State Flow

### 1. Initial Load

```
Main Process                          Renderer
     │                                   │
     ├─ Initialize ONE.CORE              │
     ├─ Load saved state                 │
     ├─ Start network services           │
     │                                   │
     │                          ◄────────┤ Request initial state
     ├─────────────────────────►         │ Receive state
     │                                   │ Render UI
```

### 2. User Action

```
Main Process                          Renderer
     │                                   │
     │                          ◄────────┤ User clicks "Send"
     ├─ Validate action                  │
     ├─ Execute business logic           │
     ├─ Update state                     │
     ├─ Persist to ONE.CORE             │
     ├─────────────────────────►         │ Receive new state
     │                                   │ Update UI
```

### 3. External Event

```
Main Process                          Renderer
     │                                   │
     ├◄─ Receive network message         │
     ├─ Process message                  │
     ├─ Update state                     │
     ├─────────────────────────►         │ Receive update
     │                                   │ Update UI
```

## IPC Protocol

### Actions (Renderer → Main)

All user-initiated actions:

- `action:login` - User login
- `action:logout` - User logout
- `action:sendMessage` - Send a message
- `action:createConversation` - Start new conversation
- `action:addContact` - Add a contact
- `action:updateSettings` - Change settings

### Queries (Renderer → Main)

Request current state:

- `query:getState` - Get full app state
- `query:getConversation` - Get conversation details
- `query:getContacts` - Get contact list
- `query:getMessages` - Get message history

### Updates (Main → Renderer)

Push state changes:

- `update:stateChanged` - Full state update
- `update:messageReceived` - New message
- `update:contactOnline` - Contact status change
- `update:syncProgress` - Sync status

## Internet of Me (IoM) Architecture

### IoM Initialization Flow

```javascript
// main/hybrid/real-node-instance.js
class RealNodeInstance {
  async initialize(user, credential) {
    // 1. Create ONE.CORE instance with archive storage
    this.instance = new Instance({ 
      name: `lama-node-${user.id}`,
      directory: dataDir 
    })
    
    // 2. Setup MultiUser authenticator
    this.authenticator = new MultiUser({
      instance: this.instance,
      recipes: [...RecipesStable, ...RecipesExperimental],
      reverseMaps: new Map([...ReverseMapsStable, ...ReverseMapsExperimental])
    })
    
    // 3. Initialize LeuteModel and ChannelManager
    this.leuteModel = new LeuteModel(this.channelManager)
    this.channelManager = new ChannelManager(this.instance)
    
    // 4. Create IoMManager for device synchronization
    this.iomManager = new IoMManager(this.leuteModel, commServerUrl)
    await this.iomManager.init()
    
    // 5. Establish IoM group for device mesh
    const iomGroup = await this.iomManager.iomGroup()
    
    // 6. Grant trust certificates
    await this.leuteModel.trust.certify(
      'RightToDeclareTrustedKeysForEverybodyCertificate',
      { beneficiary: myMainId }
    )
  }
}
```

### IoM Features

1. **Device Discovery**: Automatic discovery of user's devices
2. **Secure Pairing**: QR code or link-based device pairing
3. **Data Synchronization**: Real-time sync across all devices
4. **Trust Management**: Cryptographic trust certificates
5. **Offline Support**: Devices sync when reconnected
6. **Backup & Restore**: Any device can restore from IoM

## Benefits

1. **Multi-Device Support**: Seamless experience across devices via IoM
2. **Data Sovereignty**: Full control with distributed storage
3. **Security**: End-to-end encryption with trust certificates
4. **Performance**: Dual instance strategy optimizes for both storage and UI
5. **Offline-First**: Both instances work offline with later sync
6. **Flexibility**: Hybrid architecture supports various deployment models

## Migration Path

1. **Phase 1**: Move all models to main process
2. **Phase 2**: Create state manager in main process
3. **Phase 3**: Implement IPC controllers
4. **Phase 4**: Refactor UI to be stateless
5. **Phase 5**: Remove all business logic from renderer

## Testing Strategy

### Main Process
- Unit tests for models
- Integration tests for state management
- Mock IPC for testing handlers

### Renderer
- Component tests with mocked IPC
- UI interaction tests
- Visual regression tests

### End-to-End
- Full IPC flow tests
- User journey tests
- Performance tests