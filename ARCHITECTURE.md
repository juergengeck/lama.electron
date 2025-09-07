# LAMA Electron Architecture

## Core Principle

**Hybrid architecture with separate user instances**. Business logic is distributed between Node.js main process (with full ONE.CORE archive) and browser renderer (with sparse ONE.CORE for UI state). The browser and Node instances have **different users by design** and communicate via WebSocket federation.

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

## ONE.core Concepts: Contacts vs Connections

### Contact (Persistent Relationship)
A **Contact** in ONE.core is a persistent trust relationship between two Person identities, stored as ONE objects:
- Created through successful pairing (exchange of trust certificates)
- Persists across application restarts
- Contains Profile information (Person object with name, keys, etc.)
- Enables automatic reconnection when both parties are online
- Stored in the ONE.core database as versioned objects

### Connection (Active Network Link)
A **Connection** is an active, encrypted network link between two instances:
- Temporary WebSocket or TCP connection
- Encrypted with instance keys (established during pairing)
- Can be closed and reopened without losing the Contact relationship
- Multiple connections can exist to the same Contact (different devices)
- ConnectionInfo provides metadata: remotePersonId, remoteInstanceId, protocol, status

### Pairing Process
1. **Invitation Creation**: One party creates a time-limited invitation token
2. **Pairing Protocol**: Exchange of identity information and trust certificates
3. **Contact Creation**: Both parties store each other's Profile as trusted Contact
4. **Connection Transition**: Pairing connection transitions to CHUM protocol for data sync
5. **Persistent Relationship**: Contact survives connection close, enables auto-reconnect

### In LAMA Electron Context
- **Browser-Node Pairing**: Creates a Contact relationship between browser and node users
- **CHUM Protocol**: Runs over the Connection to sync data between Contacts
- **Federation**: Browser discovers Node's OneInstanceEndpoint and connects automatically
- **Connection Reuse**: Direct sockets must reuse pairing connection for CHUM (no spare connections)

## Key Design Decisions

### 1. Hybrid Architecture with Separate Users

The app uses a **hybrid approach** with intentionally separate users:

- **Node.js Process**: Full ONE.CORE archive with its own user identity
- **Browser Process**: Sparse ONE.CORE with a different user identity
- **WebSocket Federation**: Browser connects to Node via ws://localhost:8765
- **CHUM Synchronization**: Cross-user data sync via federation protocol
- **No Internal IoM**: IoM is for external device sync, not internal architecture

### 2. Internet of Me (IoM) - External Only

The Node.js backend provides IoM for **external device synchronization only**:

- **IoMManager**: Manages connections to user's other devices (phones, tablets, etc.)
- **LeuteModel**: Identity management with trust certificates
- **ChannelManager**: Data channels for multi-device sync
- **MultiUser Auth**: Secure multi-user support with encryption
- **Trust Certificates**: Automatic trusted key management
- **P2P Mesh Network**: Direct device-to-device communication
- **NOT for Internal**: IoM is never used between browser and Node instances

### 3. Dual Instance Strategy with Different Users

Both processes maintain ONE.CORE instances with **separate user identities**:

- **Node.js**: Archive storage with Node user (main/hybrid/real-node-instance.js)
- **Browser**: Sparse storage with Browser user (services/real-browser-instance.ts)
- **Provisioning**: Browser provisions Node instance with credentials on startup
- **Federation**: Browser connects to Node's WebSocket listener (port 8765)
- **Sync**: CHUM protocol synchronizes data between different users

### 4. Communication Pattern

**IPC is for orchestration only**, not for data transfer:

```typescript
// IPC: Orchestration commands only
await ipc.invoke('orchestrate:startConversation', {
  participants: ['alice', 'bob']
})

// WebSocket Federation: Actual data synchronization
// Browser instance connects to Node instance on ws://localhost:8765
// Data flows via CHUM protocol between the two user instances

// Example: Message sending
// 1. Browser creates message in its ONE.CORE
// 2. CHUM syncs to Node via WebSocket federation
// 3. Node processes and stores in archive
// 4. Updates sync back to browser via CHUM
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
- MCP tool execution
- Multi-provider support (Ollama, LM Studio, Claude API)

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

## IPC Protocol (Orchestration Only)

**IPC is exclusively for orchestration**, not data transfer. Data flows through WebSocket federation.

### Orchestration Commands (Renderer → Main)

- `orchestrate:provision` - Provision Node instance with credentials
- `orchestrate:startFederation` - Initialize WebSocket connection
- `orchestrate:resetStorage` - Clear Node instance storage
- `orchestrate:backup` - Trigger backup operation
- `orchestrate:restore` - Restore from backup

### Status Updates (Main → Renderer)

- `status:nodeProvisioned` - Node instance ready
- `status:federationConnected` - WebSocket connection established
- `status:syncProgress` - CHUM sync status

### Data Flow Architecture

```
Browser User Instance          Node User Instance
        │                             │
        │  WebSocket Federation       │
        ├─────────────────────────────┤
        │  ws://localhost:8765        │
        │                             │
        │  CHUM Protocol Sync         │
        ├─────────────────────────────┤
        │  - Messages                 │
        │  - Conversations            │
        │  - Contacts                 │
        │  - AI Responses             │
        └─────────────────────────────┘
```

## Internet of Me (IoM) Architecture - External Devices Only

### IoM Initialization Flow - External Devices

```javascript
// main/hybrid/real-node-instance.js
class RealNodeInstance {
  async initialize(nodeUser, credential) {
    // 1. Create ONE.CORE instance for Node user (different from browser user)
    this.instance = new Instance({ 
      name: `lama-node-${nodeUser.id}`,  // Node's own user
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
    
    // 4. Create IoMManager for EXTERNAL device synchronization
    // This connects to user's phones, tablets, other computers
    // NOT used for browser-node communication
    this.iomManager = new IoMManager(this.leuteModel, commServerUrl)
    await this.iomManager.init()
    
    // 5. Setup WebSocket listener for browser federation
    // Browser instance will connect here as a different user
    await this.setupDirectListener(8765)
    
    // 6. Grant trust certificates for external devices
    await this.leuteModel.trust.certify(
      'RightToDeclareTrustedKeysForEverybodyCertificate',
      { beneficiary: myMainId }
    )
  }
}
```

### IoM Features (External Only)

1. **External Device Discovery**: Discovery of user's phones, tablets, other computers
2. **Secure Pairing**: QR code or link-based pairing with external devices
3. **Multi-Device Sync**: Real-time sync across user's device ecosystem
4. **Trust Management**: Cryptographic trust certificates for external devices
5. **Offline Support**: External devices sync when reconnected
6. **Backup & Restore**: Any external device can restore from IoM
7. **Not Internal**: IoM is never used for browser-node communication

## Benefits

1. **Separation of Concerns**: Browser and Node have distinct user identities
2. **Multi-Device Support**: External devices sync via IoM (phones, tablets, etc.)
3. **Data Sovereignty**: Full control with distributed storage
4. **Security**: End-to-end encryption with trust certificates
5. **Performance**: Dual instance strategy optimizes for both storage and UI
6. **Clean Architecture**: IPC for orchestration, WebSocket for data
7. **Offline-First**: Both instances work offline with later sync
8. **Flexibility**: Hybrid architecture supports various deployment models

## Migration Path

1. **Phase 1**: Move all models to main process
2. **Phase 2**: Create state manager in main process
3. **Phase 3**: Implement IPC controllers
4. **Phase 4**: Refactor UI to be stateless
5. **Phase 5**: Remove all business logic from renderer

## AI Architecture

### Core Components

#### AIAssistantModel (`/main/core/ai-assistant-model.js`)
The central orchestrator that coordinates all AI functionality:
- **LLM Management**: Integrates with LLMManager for model operations
- **AI Identity**: Creates AI contacts as full ONE.core Person objects
- **Message Listening**: Monitors CHUM events for AI conversations  
- **Topic Management**: Associates AI models with conversation topics
- **Tool Interface**: Unified access to AI tools (MCP and custom)
- **Response Generation**: Handles conversation context and history
- **Federation Support**: AI objects sync across browser/node instances

#### LLMManager (`/main/services/llm-manager.js`)
Handles actual LLM operations and provider integration:
- **Multi-Provider Support**:
  - Ollama: Local models via REST API
  - LM Studio: Local models with streaming support
  - Claude: Anthropic API integration
- **MCP Integration**: 
  - Filesystem tools via `@modelcontextprotocol/server-filesystem`
  - Tool discovery and registration
  - Automatic tool descriptions in prompts
- **Response Processing**:
  - Tool call detection in responses
  - Automatic tool execution
  - Result integration back into response

#### AI Contact System
AI models are represented as full contacts in ONE.core:
```javascript
// Each AI model becomes a Person with:
{
  $type$: 'LLM',
  name: 'claude-3-5-sonnet',
  personId: SHA256Hash,  // Full Person identity
  modelType: 'remote',
  provider: 'anthropic',
  capabilities: ['chat', 'analysis', 'reasoning'],
  maxTokens: 8192,
  temperature: 0.7
}
```

### AI Data Flow

```
User Input → Browser UI → IPC → AIAssistantModel
                                      ↓
                              Check AI Topic/Model
                                      ↓
                              Get Conversation History
                                      ↓
                              LLMManager.chat()
                                      ↓
                              Enhance with Tools (MCP)
                                      ↓
                              Provider API Call
                                      ↓
                              Process Tool Calls
                                      ↓
                              Store Response (ONE.core)
                                      ↓
                              CHUM Sync → Browser UI
```

### MCP (Model Context Protocol) Integration

The app integrates MCP for tool use:

```javascript
// MCP Server Initialization
const fsTransport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/gecko/src/lama.electron']
})

// Tool Registration
tools.tools.forEach(tool => {
  this.mcpTools.set(tool.name, {
    ...tool,
    server: 'filesystem'
  })
})

// Automatic tool enhancement in prompts
const enhancedMessages = this.enhanceMessagesWithTools(messages)
```

Available MCP tools:
- `read_file`: Read file contents
- `write_file`: Write to files
- `list_directory`: List directory contents
- `create_directory`: Create directories
- `delete_file`: Delete files
- `move_file`: Move/rename files

### AI Federation Architecture

AI components participate in the federated architecture:

1. **Node Instance**: Hosts AIAssistantModel and LLMManager
2. **LLM Objects**: Stored as versioned objects in ONE.core
3. **Federation Access**: Granted to federation group for sync
4. **Browser Discovery**: Finds AI contacts via CHUM sync
5. **Message Routing**: AIMessageListener handles AI responses

### AI Message Listener

Monitors CHUM events for AI-relevant messages:
```javascript
class AIMessageListener {
  registerAITopic(topicId, modelId) {
    // Associates topics with AI models
  }
  
  handleMessage(event) {
    if (this.isAITopic(event.topicId)) {
      // Trigger AI response generation
    }
  }
}
```

### Tool Interface Architecture

Unified interface for all tool types:
```javascript
class AIToolInterface {
  async handleToolCall(toolName, input, context) {
    // Route to appropriate tool handler:
    // - MCP tools (filesystem)
    // - Custom LAMA tools
    // - Future: Web search, code execution, etc.
  }
}
```

### Key Features

1. **Identity-Based AI**: AI models are full citizens with Person IDs
2. **Federated Sync**: AI conversations sync across all devices
3. **Tool-Augmented**: MCP integration for filesystem operations
4. **Multi-Model**: Support for multiple providers simultaneously
5. **Context-Aware**: Maintains conversation history per topic
6. **Streaming Support**: Real-time response streaming (LM Studio)
7. **Offline Capable**: Local models work without internet

### Future AI Enhancements

- **RAG (Retrieval Augmented Generation)**: Search user's data
- **Custom MCP Servers**: LAMA-specific tools
- **Voice Integration**: Speech-to-text and text-to-speech
- **Multi-Modal**: Image understanding and generation
- **Agent Workflows**: Complex multi-step AI tasks
- **Fine-Tuning**: Custom models trained on user data

## Testing Strategy

### Main Process
- Unit tests for models
- Integration tests for state management
- Mock IPC for testing handlers
- AI model mocking for testing

### Renderer
- Component tests with mocked IPC
- UI interaction tests
- Visual regression tests

### End-to-End
- Full IPC flow tests
- User journey tests
- Performance tests
- AI conversation flow tests