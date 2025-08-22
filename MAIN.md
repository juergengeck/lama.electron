# Main Process Architecture

## Overview
The Electron main process should be the central hub for all business logic, AI services, and system integrations. The renderer process should be a thin UI layer that only handles presentation and user interactions.

## Current Architecture (INCORRECT)
```
Renderer Process (electron-ui/)
├── AppModel
├── AIAssistantModel
├── LLMManager
├── MCPManager
├── TopicModel
├── LeuteModel
└── React UI Components

Main Process (lama-electron-shadcn.js)
└── Window Management Only
```

## Proposed Architecture (CORRECT)
```
Main Process (Node.js Environment)
├── Window Management
├── AppModel (Core Orchestrator)
│   ├── AIAssistantModel
│   │   ├── LLMManager
│   │   │   ├── Ollama Integration
│   │   │   ├── Claude API
│   │   │   └── Local Models
│   │   └── MCPManager
│   │       ├── Filesystem Server (spawn)
│   │       ├── Shell Server (spawn)
│   │       └── LAMA Server (spawn)
│   ├── TopicModel (Chat/Messaging)
│   ├── LeuteModel (Identity/Contacts)
│   ├── ChannelManager
│   └── TransportManager (P2P/Networking)
│
├── IPC Service Layer
│   ├── AI Service (chat, completions)
│   ├── Message Service (send, receive, history)
│   ├── Contact Service (list, add, remove)
│   ├── Settings Service (get, set, persist)
│   └── MCP Tool Service (execute tools)
│
└── Storage & Persistence
    ├── ONE Platform Storage
    ├── Settings Storage
    └── Model Cache

Renderer Process (Browser Environment)
├── React UI Components
├── IPC Client Bridge
│   ├── useAI() hook
│   ├── useMessages() hook
│   ├── useContacts() hook
│   └── useSettings() hook
└── UI State Management
```

## Implementation Plan

### Phase 1: Create Main Process Services
1. Move AppModel initialization to main process
2. Create IPC service handlers for each model
3. Implement message passing protocol

### Phase 2: Create IPC Protocol
```typescript
// Main Process (main-services.js)
class MainServices {
  private appModel: AppModel
  
  async initialize() {
    // Initialize ONE platform
    // Create AppModel with all sub-models
    // Setup IPC handlers
  }
  
  // IPC Handlers
  handle('ai:chat', async (event, messages) => {
    return await this.appModel.aiAssistant.chat(messages)
  })
  
  handle('messages:get', async (event, conversationId) => {
    return await this.appModel.topicModel.getMessages(conversationId)
  })
  
  handle('messages:send', async (event, {conversationId, content}) => {
    return await this.appModel.topicModel.sendMessage(conversationId, content)
  })
  
  handle('mcp:execute', async (event, {tool, params}) => {
    return await this.appModel.mcpManager.executeTool(tool, params)
  })
}

// Renderer Process (ipc-client.ts)
class IPCClient {
  async chat(messages: Message[]) {
    return await ipcRenderer.invoke('ai:chat', messages)
  }
  
  async getMessages(conversationId: string) {
    return await ipcRenderer.invoke('messages:get', conversationId)
  }
  
  async sendMessage(conversationId: string, content: string) {
    return await ipcRenderer.invoke('messages:send', {conversationId, content})
  }
}
```

### Phase 3: Refactor UI Layer
1. Replace direct model access with IPC calls
2. Convert hooks to use IPC client
3. Remove all model imports from renderer

## Benefits

### Security
- No Node.js APIs in renderer (secure by default)
- Controlled access through IPC whitelist
- No direct file system or process access from UI

### Performance
- Heavy computations in main process
- UI remains responsive
- Better memory management

### Capabilities
- Full Node.js access for AI services
- Can spawn MCP servers properly
- Direct file system access for models
- Native module integration

### Maintainability
- Clear separation of concerns
- UI can be replaced without touching business logic
- Easier testing (mock IPC for UI tests)
- Better error boundaries

## IPC Message Format
```typescript
// Request
{
  id: string,          // Unique request ID
  service: string,     // Service name (ai, messages, contacts)
  method: string,      // Method name (chat, get, send)
  params: any[]        // Method parameters
}

// Response
{
  id: string,          // Matching request ID
  success: boolean,    // Success/failure flag
  data?: any,          // Response data if success
  error?: {            // Error details if failure
    code: string,
    message: string,
    details?: any
  }
}

// Event (pushed from main)
{
  event: string,       // Event name
  data: any           // Event data
}
```

## File Structure
```
lama.electron/
├── main/                    # Main process code (NEW)
│   ├── services/           # Business logic services
│   │   ├── AppModel.ts
│   │   ├── AIAssistantModel.ts
│   │   ├── LLMManager.ts
│   │   └── MCPManager.ts
│   ├── ipc/               # IPC handlers
│   │   ├── ai-service.ts
│   │   ├── message-service.ts
│   │   └── contact-service.ts
│   └── index.ts           # Main entry point
│
├── electron-ui/            # Renderer process (REFACTORED)
│   ├── src/
│   │   ├── components/    # React components (unchanged)
│   │   ├── ipc/          # IPC client layer (NEW)
│   │   ├── hooks/        # React hooks (refactored to use IPC)
│   │   └── App.tsx
│   └── package.json
│
├── lama-electron-shadcn.js # Electron bootstrap (simplified)
└── package.json
```

## Migration Strategy

### Step 1: Parallel Structure
- Create `main/` directory with services
- Keep existing renderer code working
- Implement IPC handlers alongside existing code

### Step 2: Gradual Migration
- One service at a time
- Start with AI chat (most isolated)
- Then messages, contacts, settings

### Step 3: Cleanup
- Remove old model code from renderer
- Simplify renderer to pure UI
- Optimize IPC communication

## Key Considerations

### State Synchronization
- Main process is source of truth
- Renderer caches for performance
- Events pushed for real-time updates

### Error Handling
- All errors caught in main process
- Sanitized error messages to renderer
- Detailed logging in main process

### Development Experience
- Hot reload for UI still works
- Main process changes require restart
- IPC mock for UI development

### Testing
- Main process: unit tests for services
- Renderer: component tests with IPC mocks
- E2E: full integration tests

## Next Steps
1. Create main/ directory structure
2. Move AppModel to main process
3. Implement basic IPC protocol
4. Create hooks that use IPC
5. Gradually migrate each feature
6. Remove models from renderer