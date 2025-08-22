# LAMA Electron Real Integration Plan

## Overview
Integrating the existing LAMA React Native app with ONE platform models into the Electron desktop wrapper.

## Architecture Summary

### Current State
- **LAMA React Native App**: Full messaging app with ONE platform models
- **Electron UI**: shadcn/ui interface with mock bridge implementation
- **ONE Platform**: Core crypto, storage, and networking from Refinio

### Target State
- Electron app using actual ONE platform models
- Native UDP sockets through Electron IPC
- llama.cpp integration for local AI
- Full P2P networking with WebSocket relay and direct connections

## Phase 1: Core Dependencies Setup

### 1.1 Install ONE Platform Packages
```bash
# Copy vendor packages from LAMA to electron-ui
cp ../vendor/refinio-one.core-*.tgz ./vendor/
cp ../vendor/refinio-one.models-*.tgz ./vendor/

# Install ONE platform dependencies
npm install ./vendor/refinio-one.core-*.tgz
npm install ./vendor/refinio-one.models-*.tgz
```

### 1.2 Platform Initialization
- Set up crypto helpers for Electron environment
- Initialize storage system with IndexedDB
- Configure platform-specific implementations

### 1.3 Required Polyfills
```typescript
// Electron-specific polyfills
- Buffer polyfill for crypto operations
- Process global for ONE platform
- WebCrypto API for key management
```

## Phase 2: Authentication System

### 2.1 MultiUser Implementation
```typescript
interface ElectronAuth {
  createInstance(): Promise<void>
  login(userId: string, password: string): Promise<void>
  register(name: string, password: string): Promise<string>
  logout(): Promise<void>
}
```

### 2.2 Key Management
- Store keys in Electron secure storage
- Implement key derivation from password
- Set up encryption/decryption for messages

## Phase 3: Model Integration

### 3.1 Model Initialization Sequence
```typescript
// Critical initialization order
1. Platform & Crypto
2. Storage & Access Manager
3. MultiUser Authentication
4. LeuteModel (identity)
5. ChannelManager (messaging)
6. TransportManager (networking)
7. TopicModel (chat)
8. Additional models
```

### 3.2 AppModel Adaptation
```typescript
class ElectronAppModel extends AppModel {
  // Electron-specific overrides
  - Use Electron IPC for UDP sockets
  - Use Node.js crypto where beneficial
  - Integrate with system notifications
}
```

### 3.3 Model State Management
```typescript
// React hooks for model state
function useModelState(model: StateMachine) {
  const [state, setState] = useState(model.getState())
  
  useEffect(() => {
    const listener = model.onStateChange.listen(setState)
    return () => listener.unsubscribe()
  }, [model])
  
  return {
    isReady: state === 'Initialised',
    isLoading: state === 'Initialising',
    error: state === 'Error'
  }
}
```

## Phase 4: Networking Stack

### 4.1 TransportManager Setup
```typescript
class ElectronTransportManager extends TransportManager {
  // WebSocket relay through CommServer
  commServerManager: CommServerManager
  
  // Native UDP through Electron IPC
  quicModel: QuicModel
  
  // P2P connection management
  connectionsModel: ConnectionsModel
}
```

### 4.2 UDP Socket Bridge
```typescript
// Main process (Electron)
ipcMain.handle('udp:create', async (event, options) => {
  const socket = dgram.createSocket(options)
  sockets.set(socketId, socket)
  return socketId
})

// Renderer process
class ElectronUDPSocket implements UDPSocket {
  async send(message: Buffer, port: number, address: string) {
    return ipcRenderer.invoke('udp:send', this.id, message, port, address)
  }
}
```

### 4.3 WebSocket Relay
- Connect to CommServer for initial pairing
- Generate invitation URLs with tokens
- Handover to direct P2P when possible

## Phase 5: Chat & Messaging

### 5.1 TopicModel Integration
```typescript
interface ChatIntegration {
  // Message operations
  sendMessage(topicId: string, content: string): Promise<void>
  getMessages(topicId: string): Message[]
  
  // Real-time updates
  onMessagesUpdated: OEvent<(topicId: string) => void>
  
  // Encryption
  encryptMessage(content: string, recipientKey: PublicKey): Promise<string>
  decryptMessage(encrypted: string, privateKey: PrivateKey): Promise<string>
}
```

### 5.2 CHUM Protocol
- Implement message synchronization
- Handle offline message queue
- Manage message ordering and deduplication

## Phase 6: Local AI Integration

### 6.1 llama.cpp Binding
```typescript
class ElectronLLMManager {
  // Load model from local file
  async loadModel(modelPath: string): Promise<void>
  
  // Run inference
  async complete(prompt: string, options: InferenceOptions): Promise<string>
  
  // Stream responses
  streamComplete(prompt: string): AsyncGenerator<string>
}
```

### 6.2 AI Assistant Model
- Integrate with chat interface
- Local context management
- Tool calling through MCP

## Phase 7: UI Integration

### 7.1 Replace Mock Bridge
```typescript
// Replace mock implementation with real models
class RealLamaBridge implements LamaAPI {
  constructor(
    private appModel: AppModel,
    private auth: MultiUser
  ) {}
  
  async sendMessage(recipientId: string, content: string) {
    const topic = await this.appModel.topicModel.getOrCreateTopic(recipientId)
    return this.appModel.topicModel.sendMessage(topic.id, content)
  }
}
```

### 7.2 React Context Providers
```typescript
<AppModelProvider>
  <AuthProvider>
    <ChatProvider>
      <NetworkProvider>
        <App />
      </NetworkProvider>
    </ChatProvider>
  </AuthProvider>
</AppModelProvider>
```

## Phase 8: Native Features

### 8.1 System Tray
```typescript
const tray = new Tray(iconPath)
tray.setContextMenu(Menu.buildFromTemplate([
  { label: 'Show', click: () => mainWindow.show() },
  { label: 'Quit', click: () => app.quit() }
]))
```

### 8.2 Notifications
```typescript
ipcMain.handle('notify', (event, title, body) => {
  new Notification({ title, body }).show()
})
```

### 8.3 File Handling
- Drag & drop file sharing
- Image/video preview
- Document attachments

## Implementation Steps

### Week 1: Foundation
1. Set up ONE platform dependencies
2. Initialize crypto and storage
3. Implement MultiUser auth
4. Create model initialization pipeline

### Week 2: Core Models
1. Integrate LeuteModel for identity
2. Set up ChannelManager
3. Implement TopicModel for chat
4. Create TransportManager

### Week 3: Networking
1. Implement UDP socket bridge
2. Set up WebSocket relay
3. Create P2P connection logic
4. Test message flow

### Week 4: UI & Features
1. Replace mock bridge with real implementation
2. Update React components
3. Add system tray
4. Implement notifications

## Testing Strategy

### Unit Tests
- Model initialization sequences
- Crypto operations
- Message encryption/decryption

### Integration Tests
- Auth flow (register/login/logout)
- Message send/receive
- P2P connection establishment

### E2E Tests
- Full chat conversation
- File sharing
- Multi-device sync

## Security Considerations

1. **Key Storage**: Use Electron safeStorage API
2. **IPC Security**: Validate all IPC messages
3. **CSP Headers**: Strict content security policy
4. **Process Isolation**: Enable context isolation
5. **Auto-updates**: Sign releases and verify signatures

## Performance Optimizations

1. **Lazy Loading**: Load models on-demand
2. **Message Pagination**: Load messages in chunks
3. **IndexedDB Indexes**: Optimize query performance
4. **Worker Threads**: Crypto operations in workers
5. **Virtual Scrolling**: For large message lists

## Migration Path

### From Mock to Real
1. Keep mock bridge as fallback
2. Feature flag for real/mock modes
3. Gradual rollout of features
4. Data migration utilities

## Dependencies Required

### NPM Packages
```json
{
  "@refinio/one.core": "file:vendor/refinio-one.core-0.6.1-beta-1.tgz",
  "@refinio/one.models": "file:vendor/refinio-one.models-14.1.0-beta-1.tgz",
  "events": "^3.3.0",
  "buffer": "^6.0.3",
  "process": "^0.11.10",
  "crypto-browserify": "^3.12.0"
}
```

### Native Modules
- Node.js dgram for UDP
- Node.js crypto for performance
- Electron APIs for system integration

## Success Metrics

1. **Authentication**: < 2s login time
2. **Messages**: < 100ms send latency
3. **P2P**: > 80% direct connection rate
4. **AI**: < 500ms response time
5. **Memory**: < 200MB baseline usage

## Risk Mitigation

### Technical Risks
1. **ONE Platform Compatibility**: Test thoroughly in Electron
2. **Performance Issues**: Profile and optimize critical paths
3. **Network Failures**: Implement robust retry logic

### Schedule Risks
1. **Dependency Issues**: Vendor critical packages
2. **Integration Complexity**: Start with minimal viable integration
3. **Testing Delays**: Automate testing early

## Next Steps

1. Review and approve plan
2. Set up development environment
3. Create feature branches
4. Begin Phase 1 implementation
5. Weekly progress reviews

---

*This plan provides a comprehensive roadmap for integrating the LAMA React Native app with the Electron desktop wrapper, leveraging the full ONE platform capabilities while maintaining security and performance.*