# Data Model: AI Assistant Core Refactoring

**Feature**: AI Assistant Core Refactoring
**Date**: 2025-10-20
**Status**: Design Phase

## Overview

This document defines the component architecture, interfaces, and data flows for the refactored AI assistant system. The architecture separates platform-agnostic business logic (lama.core) from platform-specific adapters (lama.electron).

## Component Architecture

### Component Hierarchy

```
AIHandler (lama.core/handlers/)
├── AITopicManager (lama.core/models/ai/)
├── AIMessageProcessor (lama.core/models/ai/)
│   ├── AIPromptBuilder (injected via setter)
│   └── AITaskManager (injected via setter)
├── AIPromptBuilder (lama.core/models/ai/)
└── AIContactManager (lama.core/models/ai/)

LLMManager (lama.core/services/)
└── LLMPlatform interface (implemented in lama.electron)
```

### Component Responsibilities

#### AIHandler
**Location**: `lama.core/handlers/AIHandler.ts`
**Purpose**: Main orchestrator for AI operations, replaces ai-assistant-model.ts
**Responsibilities**:
- Initialize and coordinate all AI components
- Manage component lifecycle (init, shutdown)
- Provide unified API for IPC handlers
- Handle high-level AI operations (ensure default chats, scan conversations)

**Key Methods**:
```typescript
async init(): Promise<void>
async ensureDefaultChats(): Promise<void>
async scanExistingConversations(): Promise<void>
async processMessage(topicId: string, message: string, senderId: SHA256IdHash<Person>): Promise<string>
isAITopic(topicId: string): boolean
getModelIdForTopic(topicId: string): string | null
```

#### AITopicManager
**Location**: `lama.core/models/ai/AITopicManager.ts`
**Purpose**: Manage topic-to-model mappings and topic lifecycle
**Responsibilities**:
- Maintain topicId → modelId mapping
- Track topic loading states
- Manage topic display names
- Handle AI mode per topic (assistant/IoM/knowledge)

**State**:
```typescript
{
  topicModelMap: Map<string, string>,              // topicId → modelId
  topicLoadingState: Map<string, boolean>,         // topicId → isLoading
  topicDisplayNames: Record<string, string>,       // topicId → displayName
  topicAIModes: Map<string, string>                // topicId → mode (assistant|iom|knowledge)
}
```

**Key Methods**:
```typescript
registerAITopic(topicId: string, modelId: string): void
isAITopic(topicId: string): boolean
getModelIdForTopic(topicId: string): string | null
setTopicLoadingState(topicId: string, isLoading: boolean): void
getTopicDisplayName(topicId: string): string | undefined
setTopicDisplayName(topicId: string, name: string): void
```

#### AIMessageProcessor
**Location**: `lama.core/models/ai/AIMessageProcessor.ts`
**Purpose**: Handle message queuing, processing, and LLM invocation
**Responsibilities**:
- Queue messages per topic (prevent concurrent processing)
- Validate messages (dedupe, check sender)
- Invoke LLM with prompts from AIPromptBuilder
- Stream responses and emit progress events
- Coordinate with AITaskManager for dynamic tasks

**State**:
```typescript
{
  messageQueues: Map<string, {isProcessing: boolean, queue: Message[]}>,
  processingMessageIds: Set<string>,
  lastProcessedMessageId: Map<string, string>,    // Deduplication
  systemTopicMessages: Map<string, SystemMessage[]>
}
```

**Key Methods**:
```typescript
async handleTopicMessage(topicId: string, message: any): Promise<void>
async processMessage(topicId: string, text: string, senderId: SHA256IdHash<Person>): Promise<string>
isAIMessage(message: any): boolean
isAIContact(personId: SHA256IdHash<Person>): boolean
setPromptBuilder(builder: AIPromptBuilder): void  // Circular dep resolution
setTaskManager(manager: AITaskManager): void      // Circular dep resolution
```

#### AIPromptBuilder
**Location**: `lama.core/models/ai/AIPromptBuilder.ts`
**Purpose**: Construct prompts with context and conversation history
**Responsibilities**:
- Build message history from topic messages
- Determine if context restart needed (context window limits)
- Add system prompts and context enrichment
- Format messages for LLM (role: user/assistant/system)

**Key Methods**:
```typescript
async buildPrompt(topicId: string, newMessage: string, senderId: SHA256IdHash<Person>): Promise<PromptResult>
async checkContextWindowAndPrepareRestart(topicId: string, messages: any[]): Promise<RestartContext>
async generateConversationSummaryForRestart(topicId: string, messages: any[]): Promise<string>
setMessageProcessor(processor: AIMessageProcessor): void  // Circular dep resolution
```

**Return Types**:
```typescript
interface PromptResult {
  messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>,
  needsRestart: boolean,
  restartContext?: string
}

interface RestartContext {
  needsRestart: boolean,
  restartContext: string | null
}
```

#### AIContactManager
**Location**: `lama.core/models/ai/AIContactManager.ts`
**Purpose**: Create and manage AI contacts (Person/Profile/Someone objects)
**Responsibilities**:
- Create Person objects for AI models
- Generate cryptographic keys for AI persons
- Create Profile and Someone objects
- Add AI contacts to LeuteModel
- Cache AI person IDs

**Key Methods**:
```typescript
async ensureAIContactForModel(modelId: string, displayName: string): Promise<SHA256IdHash<Person>>
async createAIContact(modelId: string, displayName: string): Promise<SHA256IdHash<Person>>
getPersonIdForModel(modelId: string): SHA256IdHash<Person> | null
isAIPerson(personId: SHA256IdHash<Person>): boolean
getModelIdForPersonId(personId: SHA256IdHash<Person>): string | null
```

#### AITaskManager
**Location**: `lama.core/models/ai/AITaskManager.ts`
**Purpose**: Manage dynamic task associations for IoM (Information over Messages)
**Responsibilities**:
- Initialize subject channel (topicId: 'subjects')
- Associate tasks with topics
- Execute dynamic tasks when configured
- Manage task configurations per topic

**State**:
```typescript
{
  topicTaskConfigs: Map<string, AITaskConfig[]>,
  subjectChannelInitialized: boolean
}
```

**Key Methods**:
```typescript
async initializeSubjectChannel(): Promise<void>
async associateTaskWithTopic(topicId: string, taskType: AITaskType): Promise<void>
getTasksForTopic(topicId: string): AITaskConfig[]
async executeTasksForMessage(topicId: string, message: string): Promise<any>
```

## Dependency Graph

### Component Dependencies

```
AIHandler
├── Dependencies (constructor):
│   ├── NodeOneCore (or generic ONE.core interface)
│   ├── ChannelManager
│   ├── TopicModel
│   ├── LeuteModel
│   ├── LLMManager
│   └── StateManager (platform-specific)
└── Creates:
    ├── AITopicManager
    ├── AIMessageProcessor
    ├── AIPromptBuilder
    ├── AIContactManager
    └── AITaskManager

AITopicManager
├── Dependencies (constructor):
│   ├── TopicModel
│   ├── ChannelManager
│   ├── LeuteModel
│   └── LLMManager
└── No circular dependencies

AIMessageProcessor
├── Dependencies (constructor):
│   ├── ChannelManager
│   ├── LLMManager
│   ├── LeuteModel
│   ├── AITopicManager
│   └── StateManager (optional, for progress tracking)
├── Dependencies (setter):
│   ├── AIPromptBuilder (circular dependency resolved)
│   └── AITaskManager (circular dependency resolved)
└── Events:
    ├── onGenerationProgress(topicId, progress)
    └── onMessageComplete(topicId, messageId, text)

AIPromptBuilder
├── Dependencies (constructor):
│   ├── ChannelManager
│   ├── LLMManager
│   ├── AITopicManager
│   └── ContextEnrichmentService (optional)
├── Dependencies (setter):
│   └── AIMessageProcessor (circular dependency resolved)
└── No events

AIContactManager
├── Dependencies (constructor):
│   ├── LeuteModel
│   └── LLMObjectManager (optional)
└── No circular dependencies

AITaskManager
├── Dependencies (constructor):
│   ├── ChannelManager
│   └── TopicAnalysisModel (optional)
└── No circular dependencies
```

### Circular Dependency Resolution

**Problem**: AIMessageProcessor needs AIPromptBuilder to build prompts, but AIPromptBuilder needs AIMessageProcessor to determine if messages are from AI.

**Solution**: Two-phase initialization using setter methods:

```typescript
// Phase 1: Construct components with non-circular dependencies
const topicManager = new AITopicManager(topicModel, channelManager, leuteModel, llmManager);
const contactManager = new AIContactManager(leuteModel, llmObjectManager);
const taskManager = new AITaskManager(channelManager, topicAnalysisModel);

const promptBuilder = new AIPromptBuilder(channelManager, llmManager, topicManager);
const messageProcessor = new AIMessageProcessor(
  channelManager, llmManager, leuteModel, topicManager, stateManager
);

// Phase 2: Resolve circular dependencies via setters
promptBuilder.setMessageProcessor(messageProcessor);
messageProcessor.setPromptBuilder(promptBuilder);
messageProcessor.setTaskManager(taskManager);
```

## Platform Abstraction

### LLMPlatform Interface

Platform-specific operations (file I/O, child processes, BrowserWindow) are abstracted behind an interface:

```typescript
// lama.core/services/llm-platform.ts
interface LLMPlatform {
  // Event emission (progress, errors, updates)
  emitProgress(topicId: string, progress: number): void;
  emitError(topicId: string, error: Error): void;
  emitMessageUpdate(topicId: string, messageId: string, text: string, status: string): void;

  // Optional platform features
  startMCPServer?(modelId: string, config: MCPConfig): Promise<void>;
  stopMCPServer?(modelId: string): Promise<void>;
  readModelFile?(path: string): Promise<Buffer>;
}

// lama.electron/adapters/electron-llm-platform.ts
class ElectronLLMPlatform implements LLMPlatform {
  constructor(private mainWindow: BrowserWindow) {}

  emitProgress(topicId: string, progress: number): void {
    this.mainWindow.webContents.send('message:thinking', { topicId, progress });
  }

  emitError(topicId: string, error: Error): void {
    this.mainWindow.webContents.send('ai:error', { topicId, error: error.message });
  }

  // ... other platform-specific implementations
}
```

**Usage in LLMManager**:
```typescript
// lama.core/services/llm-manager.ts
export class LLMManager {
  constructor(private platform?: LLMPlatform) {}

  async chat(messages, modelId, options) {
    // Platform-agnostic logic
    const response = await this.invokeModel(messages, modelId);

    // Optional platform-specific progress tracking
    if (this.platform && options.onStream) {
      this.platform.emitProgress(options.topicId, 50);
    }

    return response;
  }
}
```

## Data Flows

### Message Processing Flow

```
User sends message
  ↓
IPC Handler (lama.electron)
  ↓
AIHandler.processMessage(topicId, message, senderId)
  ↓
AIMessageProcessor.handleTopicMessage(topicId, message)
  ↓
[Validation: Check if AI topic, dedupe, check sender]
  ↓
AIPromptBuilder.buildPrompt(topicId, message, senderId)
  ↓
[Build context: Get history, check context window, add enrichment]
  ↓
AIMessageProcessor.processMessage(topicId, text, senderId)
  ↓
LLMManager.chat(messages, modelId, { onStream })
  ↓
[Stream response chunks via platform.emitProgress]
  ↓
AITaskManager.executeTasksForMessage(topicId, response)
  ↓
[Optional: Execute dynamic tasks if configured]
  ↓
TopicRoom.sendMessage(response, aiPersonId)
  ↓
Platform.emitMessageUpdate(topicId, messageId, response, 'sent')
```

### Topic Registration Flow

```
User creates topic with AI participant
  ↓
IPC Handler (lama.electron)
  ↓
AIHandler.ensureDefaultChats() OR scanExistingConversations()
  ↓
AIContactManager.ensureAIContactForModel(modelId, displayName)
  ↓
[Create Person, Profile, Someone if needed]
  ↓
TopicGroupManager.createGroupTopic(name, topicId, [aiPersonId])
  ↓
AITopicManager.registerAITopic(topicId, modelId)
  ↓
AIMessageProcessor.handleTopicMessage(topicId, welcomeMessage)
  ↓
[Generate welcome message via LLM]
```

### Context Window Restart Flow

```
AIPromptBuilder.buildPrompt(topicId, message, senderId)
  ↓
checkContextWindowAndPrepareRestart(topicId, messages)
  ↓
[Estimate token count: total vs usable context window]
  ↓
IF tokens > usable context:
  ↓
  generateConversationSummaryForRestart(topicId, messages)
  ↓
  [Try: Get existing Summary from TopicAnalysisModel]
  ↓
  IF Summary exists:
    [Build restart context with Summary + active subjects + keywords]
  ELSE:
    [Trigger TopicAnalysisModel.analyzeMessages → create Summary]
    [Use created Summary for restart context]
  ↓
  Return: { needsRestart: true, restartContext: summary }
ELSE:
  Return: { needsRestart: false, restartContext: null }
```

## State Management

### AITopicManager State

| Field | Type | Persistence | Purpose |
|-------|------|-------------|---------|
| topicModelMap | Map<string, string> | In-memory | Maps topicId → modelId for AI topics |
| topicLoadingState | Map<string, boolean> | In-memory | Tracks topics currently being initialized |
| topicDisplayNames | Record<string, string> | In-memory | Custom display names for topics |
| topicAIModes | Map<string, string> | In-memory | AI mode per topic (assistant/iom/knowledge) |

**Note**: State is rebuilt on initialization via `scanExistingConversations()`. No persistence needed as it's derived from Topic and Group objects.

### AIMessageProcessor State

| Field | Type | Persistence | Purpose |
|-------|------|-------------|---------|
| messageQueues | Map<string, QueueState> | In-memory | Per-topic message queues (prevents concurrent processing) |
| processingMessageIds | Set<string> | In-memory | Currently processing message IDs (prevents duplication) |
| lastProcessedMessageId | Map<string, string> | In-memory | Last successfully processed message per topic (deduplication) |
| systemTopicMessages | Map<string, Message[]> | In-memory | System topic messages (e.g., LAMA private context) |

**Note**: Queues are ephemeral. On restart, messages are reprocessed from ONE.core storage.

### AIContactManager State

| Field | Type | Persistence | Purpose |
|-------|------|-------------|---------|
| aiContacts | Map<string, SHA256IdHash<Person>> | In-memory cache | Maps modelId → personId for AI contacts |

**Note**: Actual Person/Profile/Someone objects are persisted in ONE.core. Cache is rebuilt from LeuteModel on initialization.

## Migration Strategy

### Phase 1: Create Core Components (Week 1-3)

1. **Week 1**: AIContactManager (simplest, no dependencies)
   - Create `lama.core/models/ai/AIContactManager.ts`
   - Write unit tests with mocked LeuteModel
   - Verify Person/Profile/Someone creation

2. **Week 2**: AITopicManager + AITaskManager (no circular deps)
   - Create both components
   - Write unit tests
   - Wire into temporary test harness

3. **Week 3**: AIPromptBuilder + AIMessageProcessor (circular dep)
   - Create components with two-phase initialization
   - Write unit tests for each
   - Write integration test for circular dep resolution

### Phase 2: Create AIHandler (Week 4)

4. **Week 4**: AIHandler + LLMManager refactoring
   - Create `lama.core/handlers/AIHandler.ts`
   - Refactor LLMManager with LLMPlatform interface
   - Create ElectronLLMPlatform adapter
   - Wire all components together
   - Write integration tests

### Phase 3: Update IPC Handlers (Week 5)

5. **Week 5**: IPC handler migration
   - Update `lama.electron/main/ipc/handlers/ai.ts` to use AIHandler
   - Update `lama.electron/main/ipc/handlers/chat.ts` for AI topic handling
   - Update `lama.electron/main/ipc/handlers/llm.ts` to delegate to LLMManager
   - Remove old `ai-assistant-model.ts` and `llm-manager.js`
   - Run full regression test suite

## Testing Strategy

### Unit Tests (Per Component)

Each component has isolated unit tests with mocked dependencies:

```typescript
// Example: AITopicManager.test.ts
describe('AITopicManager', () => {
  let topicManager: AITopicManager;
  let mockTopicModel: jest.Mocked<TopicModel>;
  let mockChannelManager: jest.Mocked<ChannelManager>;

  beforeEach(() => {
    mockTopicModel = createMockTopicModel();
    mockChannelManager = createMockChannelManager();
    topicManager = new AITopicManager(
      mockTopicModel, mockChannelManager, mockLeuteModel, mockLLMManager
    );
  });

  it('should register AI topic', () => {
    topicManager.registerAITopic('topic-1', 'gpt-4');
    expect(topicManager.isAITopic('topic-1')).toBe(true);
    expect(topicManager.getModelIdForTopic('topic-1')).toBe('gpt-4');
  });
});
```

### Integration Tests

Test component interactions and circular dependency resolution:

```typescript
// integration.test.ts
describe('AI Assistant Integration', () => {
  it('should process message end-to-end', async () => {
    const handler = new AIHandler(nodeOneCore, channelManager, ...);
    await handler.init();

    const response = await handler.processMessage('topic-1', 'Hello AI', userPersonId);

    expect(response).toContain('Hello');
    expect(handler.isAITopic('topic-1')).toBe(true);
  });
});
```

### Contract Tests

Verify IPC handler signatures remain unchanged:

```typescript
// ipc-contracts.test.ts
describe('IPC Handler Contracts', () => {
  it('should maintain ai:processMessage signature', async () => {
    const result = await ipcHandler.processMessage(
      mockEvent,
      { topicId: 'topic-1', message: 'test', senderId: 'user-123' }
    );

    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('messageId');
  });
});
```

## Success Criteria

| Criterion | Measurement | Target |
|-----------|-------------|--------|
| Component Size | Lines of code per file | <400 lines |
| Test Coverage | Jest coverage report | >80% |
| Platform Imports | Static analysis (grep/eslint) | Zero lama.electron imports in lama.core |
| IPC Handler Size | Lines of code | <100 lines average |
| Feature Parity | Regression test suite | 100% pass rate |
| Performance | Response time comparison | <5% degradation |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking IPC contracts | HIGH - UI breaks | Contract tests, parallel implementation |
| Circular dependencies | MEDIUM - Hard to test | Two-phase init with setter tests |
| Platform leakage | HIGH - Browser incompatible | Import linter, CI checks |
| State migration errors | MEDIUM - Lost data | Rebuild from ONE.core on init |
| Performance regression | MEDIUM - Slow AI | Benchmark tests, profiling |
