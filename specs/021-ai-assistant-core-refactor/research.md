# AI Assistant Refactoring Research Document

**Date:** October 20, 2025
**Current Implementation:** `/Users/gecko/src/lama/lama.electron/main/core/ai-assistant-model.ts` (1605 lines)
**Reference Implementation:** `/Users/gecko/src/lama/lama.electron/reference/lama/src/models/ai/assistant/` (modular architecture)
**Target:** Migrate to lama.core with platform-agnostic design following ChatHandler/AIHandler pattern

---

## Executive Summary

The current monolithic AIAssistantModel (1605 lines) in lama.electron needs refactoring into platform-agnostic components in lama.core. The reference implementation provides a proven modular architecture with 5 specialized components. This document analyzes component boundaries, dependency patterns, platform abstraction requirements, and migration strategies.

**Key Findings:**
- **Clear component boundaries** exist in reference implementation
- **Platform-specific code concentrated** in BrowserWindow event handling and Node.js file I/O
- **Circular dependencies** between AIMessageProcessor ↔ AIPromptBuilder require careful initialization
- **LLM Manager requires platform abstraction** for Node.js vs Browser execution

---

## 1. Component Boundary Analysis

### 1.1 Current Monolithic Structure (ai-assistant-model.ts - 1605 lines)

**Responsibilities Mixed in Single Class:**
- Topic management (registration, loading states, display names)
- Contact creation and management
- Message processing and queueing
- AI response generation
- Welcome message handling
- Context window management
- Model selection and caching
- Settings management

**Problems:**
- Violates Single Responsibility Principle
- Hard to test individual behaviors
- Cannot reuse components in different platforms
- Tight coupling to Electron (BrowserWindow, ipcMain)

---

### 1.2 Reference Implementation Component Breakdown

#### **Component 1: AITopicManager**
**Location:** `reference/lama/src/models/ai/assistant/aiTopicManager.ts` (437 lines)

**Responsibilities:**
```typescript
// Topic state management
- topicDisplayNames: Record<string, string>
- topicLoadingState: Map<string, boolean>
- topicModelMap: Map<string, string>  // topicId -> modelId
- topicAIModes: Map<string, string>   // topicId -> mode (chat/assistant/summarizer)
- topicTaskConfigs: Map<string, AITaskConfig[]>

// Core methods
+ setTopicLoadingState(topicId, isLoading)
+ getTopicDisplayName(topicId): string
+ setTopicDisplayName(topicId, name)
+ getAllAITopicIds(): string[]
+ getModelIdForTopic(topicId): string
+ addTopicModelMapping(topicId, modelIdHash)
+ getLatestUserMessage(topicId): Promise<Message>
+ needsResponse(topicId): Promise<boolean>
+ setTopicAIMode(topicId, mode)
+ getTopicAIMode(topicId): string
+ setTopicTaskConfigs(topicId, configs)
+ getTopicTaskConfigs(topicId): AITaskConfig[]
```

**Dependencies:**
```typescript
constructor(
  topicModel: TopicModel,
  llmManager: LLMManager,
  channelManager: ChannelManager,
  leuteModel: LeuteModel,
  personId: SHA256IdHash<Person>,
  aiaModel: any  // Back-reference to main model
)
```

**Platform-Agnostic:** ✅ No platform-specific code

---

#### **Component 2: AIMessageProcessor**
**Location:** `reference/lama/src/models/ai/assistant/aiMessageProcessor.ts` (1189 lines)

**Responsibilities:**
```typescript
// Message queue management
- messageQueues: Map<string, {isProcessing, queue}>
- processingMessageIds: Set<string>
- lastProcessedMessageId: Map<string, string>
- systemTopicMessages: Map<string, Message[]>

// Core methods
+ handleTopicMessage(topicId, message): Promise<void>
+ isAIContact(profileOrPersonId): boolean
+ isAIMessage(message): boolean
+ setAvailableLLMModels(models)
+ setTaskManager(taskManager)

// Private methods
- processMessageQueue(topicId)
- generateResponse(modelId, text, topicId): Promise<string>
- cleanAIResponse(text): string
- validateResponse(response): ValidationResult
- sendResponseToTopic(topicId, text)
- enqueueMessage(topicId, messageId, message, text)
- getTasksForTopic(topicId): Promise<AITaskConfig[]>
```

**Dependencies:**
```typescript
constructor(
  channelManager: ChannelManager,
  llmManager: LLMManager,
  leuteModel: LeuteModel,
  personId: SHA256IdHash<Person>,
  topicManager: AITopicManager,
  promptBuilder: AIPromptBuilder,
  availableLLMModels: Array<ModelInfo>
)
```

**Platform-Specific Code:**
```typescript
// Current implementation (NEEDS ABSTRACTION):
- Direct BrowserWindow.getAllWindows() calls for UI events
- Node.js-specific error handling
```

**Circular Dependency:** ⚠️ Depends on AIPromptBuilder, which depends on AIMessageProcessor

---

#### **Component 3: AIPromptBuilder**
**Location:** `reference/lama/src/models/ai/assistant/aiPromptBuilder.ts` (416 lines)

**Responsibilities:**
```typescript
// Prompt construction
+ buildPrompt(modelId, text, topicId): Promise<PromptResult>
+ buildChatMessages(modelId, text, topicId, tools?): Promise<ChatPromptResult>

// Private methods
- calculateContextBudget(modelId, systemPrompt, currentMessage)
- filterCorruptedMessages(messages)
- deduplicateMessages(messages)
- truncateToContextWindow(messages, maxTokens)
```

**Dependencies:**
```typescript
constructor(
  channelManager: ChannelManager,
  llmManager: LLMManager,
  leuteModel: LeuteModel,
  topicManager: AITopicManager
)

// Circular dependency resolution
setMessageProcessor(messageProcessor: AIMessageProcessor): void
```

**Platform-Agnostic:** ✅ No platform-specific code

---

#### **Component 4: AIContactManager**
**Location:** `reference/lama/src/models/ai/assistant/aiContactManager.ts` (113 lines)

**Responsibilities:**
```typescript
// Contact creation for AI models
+ ensureContactsForModels(models): Promise<number>
+ createContactForModel(model): Promise<Contact>
```

**Dependencies:**
```typescript
constructor(
  leuteModel: LeuteModel
)
```

**Platform-Agnostic:** ✅ No platform-specific code

---

#### **Component 5: AITaskManager**
**Location:** `reference/lama/src/models/ai/assistant/aiTaskManager.ts` (456 lines)

**Responsibilities:**
```typescript
// Dynamic task management
+ createTask(name, type, config): Promise<AITask>
+ addTaskToTopic(task, topicId, priority)
+ removeTaskFromTopic(task, topicId)
+ setTaskEnabled(task, topicId, enabled)
+ getActiveTasksForTopic(topicId): Promise<AITask[]>
+ convertTasksToConfigs(tasks): AITaskConfig[]

// Subject management (IoM - Internet of Memory)
+ createSubject(keywords, summary, context): Promise<AISubject>
+ addTopicReferenceToSubject(subject, topicId, messageHashes)
+ getSubjectsByKeywords(keywords): Promise<AISubject[]>
+ getSubjectsForTopic(topicId): Promise<AISubject[]>
+ getAllSubjects(): Promise<AISubject[]>
+ addSubjectContext(subject, relatedSubjectId)
+ searchSubjectsBySummary(searchTerm): Promise<AISubject[]>
```

**Dependencies:**
```typescript
constructor(
  channelManager: ChannelManager,
  personId: SHA256IdHash<Person>
)
```

**Platform-Agnostic:** ✅ No platform-specific code

---

### 1.3 Component Responsibility Matrix

| Responsibility | Current (Monolith) | Target Component | Lines | Platform-Agnostic |
|---|---|---|---|---|
| Topic state management | AIAssistantModel | AITopicManager | ~150 | ✅ |
| Topic-model mappings | AIAssistantModel | AITopicManager | ~50 | ✅ |
| Message queue processing | AIAssistantModel | AIMessageProcessor | ~300 | ⚠️ Needs event abstraction |
| AI response generation | AIAssistantModel | AIMessageProcessor | ~200 | ⚠️ Needs platform abstraction |
| Response cleaning/validation | AIAssistantModel | AIMessageProcessor | ~150 | ✅ |
| Prompt building | AIAssistantModel | AIPromptBuilder | ~250 | ✅ |
| Context window management | AIAssistantModel | AIPromptBuilder | ~100 | ✅ |
| Contact creation | AIAssistantModel | AIContactManager | ~100 | ✅ |
| AI contact caching | AIAssistantModel | AIContactManager | ~50 | ✅ |
| Task management | AIAssistantModel | AITaskManager | ~200 | ✅ |
| Subject management (IoM) | AIAssistantModel | AITaskManager | ~150 | ✅ |
| Welcome message generation | AIAssistantModel | AIMessageProcessor | ~100 | ⚠️ Needs event abstraction |
| Model loading/caching | AIAssistantModel | AIMessageProcessor | ~50 | ✅ |

**Total Platform-Specific Code:** ~25% (concentrated in UI events and response generation)

---

## 2. Dependency Injection Patterns

### 2.1 Existing Pattern: ChatHandler.ts

```typescript
/**
 * ChatHandler - Pure business logic for chat operations
 * Dependencies injected via constructor
 */
export class ChatHandler {
  private nodeOneCore: any;
  private stateManager: any;
  private messageVersionManager: any;
  private messageAssertionManager: any;

  constructor(
    nodeOneCore: any,
    stateManager?: any,
    messageVersionManager?: any,
    messageAssertionManager?: any
  ) {
    this.nodeOneCore = nodeOneCore;
    this.stateManager = stateManager;
    this.messageVersionManager = messageVersionManager;
    this.messageAssertionManager = messageAssertionManager;
  }

  // Optional: Set dependencies after initialization
  setMessageManagers(versionManager: any, assertionManager: any): void {
    this.messageVersionManager = versionManager;
    this.messageAssertionManager = assertionManager;
  }
}
```

**Key Patterns:**
1. **Constructor injection** for core dependencies
2. **Setter injection** for optional/circular dependencies
3. **No ambient pattern** - all dependencies explicit
4. **Typed interfaces** for dependencies (using TypeScript)

---

### 2.2 Platform Abstraction Strategy for Events

**Problem:** Current code uses `BrowserWindow.getAllWindows()` directly:

```typescript
// Current (platform-specific):
const windows = BrowserWindow.getAllWindows();
for (const window of windows) {
  window.webContents.send('message:thinking', { conversationId, messageId });
}
```

**Solution 1: Event Emitter Pattern** (Recommended)

```typescript
// In lama.core (platform-agnostic):
export interface AIEventEmitter {
  emit(event: string, data: any): void;
}

export class AIMessageProcessor {
  constructor(
    private eventEmitter: AIEventEmitter,
    // ... other deps
  ) {}

  private notifyUI(event: string, data: any) {
    this.eventEmitter.emit(event, data);
  }
}

// In lama.electron (platform-specific adapter):
class ElectronAIEventEmitter implements AIEventEmitter {
  emit(event: string, data: any): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send(event, data);
    }
  }
}

// In browser (platform-specific adapter):
class BrowserAIEventEmitter implements AIEventEmitter {
  emit(event: string, data: any): void {
    window.postMessage({ type: event, data }, '*');
  }
}
```

**Solution 2: Callback Pattern** (Alternative)

```typescript
export type UIEventCallback = (event: string, data: any) => void;

export class AIMessageProcessor {
  constructor(
    private onUIEvent?: UIEventCallback,
    // ... other deps
  ) {}

  private notifyUI(event: string, data: any) {
    this.onUIEvent?.(event, data);
  }
}
```

---

### 2.3 Circular Dependency Resolution

**Problem:** AIMessageProcessor needs AIPromptBuilder, which needs to call `isAIContact()` on AIMessageProcessor

**Reference Implementation Solution:**

```typescript
// Step 1: Create AIPromptBuilder without MessageProcessor
this.promptBuilder = new AIPromptBuilder(
  channelManager,
  llmManager,
  leuteModel,
  topicManager
);

// Step 2: Create AIMessageProcessor with PromptBuilder
this.messageProcessor = new AIMessageProcessor(
  channelManager,
  llmManager,
  leuteModel,
  personId,
  topicManager,
  this.promptBuilder,
  availableLLMModels
);

// Step 3: Connect circular reference
this.promptBuilder.setMessageProcessor(this.messageProcessor);
```

**Pattern:** Two-phase initialization with setter injection

---

### 2.4 Minimal Dependencies Per Component

#### AITopicManager
```typescript
constructor(
  topicModel: TopicModel,           // Required: Topic CRUD
  llmManager: LLMManager,            // Required: Model metadata
  channelManager: ChannelManager,    // Required: Message iteration
  leuteModel: LeuteModel,            // Required: User identity
  personId: SHA256IdHash<Person>,    // Required: Current user
  aiaModel: any                      // Required: Back-reference for isAIPerson()
)
```

**Justification:** Needs to query messages to determine `needsResponse()` and identify AI vs user messages

---

#### AIMessageProcessor
```typescript
constructor(
  channelManager: ChannelManager,    // Required: Post messages
  llmManager: LLMManager,            // Required: Generate responses
  leuteModel: LeuteModel,            // Required: User identity checks
  personId: SHA256IdHash<Person>,    // Required: Current user
  topicManager: AITopicManager,      // Required: Topic state
  promptBuilder: AIPromptBuilder,    // Required: Build prompts
  availableLLMModels: ModelInfo[],   // Required: AI contact lookup
  eventEmitter?: AIEventEmitter      // Optional: UI notifications
)
```

**Justification:** Core message processing requires all these collaborators

---

#### AIPromptBuilder
```typescript
constructor(
  channelManager: ChannelManager,    // Required: Load message history
  llmManager: LLMManager,            // Required: Model context length
  leuteModel: LeuteModel,            // Required: Settings lookup
  topicManager: AITopicManager       // Required: Topic metadata
)

setMessageProcessor(messageProcessor: AIMessageProcessor): void
```

**Justification:** Prompt construction requires conversation history and model capabilities

---

#### AIContactManager
```typescript
constructor(
  leuteModel: LeuteModel             // Required: Contact CRUD
)
```

**Justification:** Minimal - only creates contacts

---

#### AITaskManager
```typescript
constructor(
  channelManager: ChannelManager,    // Required: Post tasks/subjects
  personId: SHA256IdHash<Person>     // Required: Ownership
)
```

**Justification:** Stores versioned objects in channels

---

## 3. LLM Manager Migration

### 3.1 Current Platform-Specific Code

**Location:** `/Users/gecko/src/lama/lama.electron/main/services/llm-manager.ts` (1156 lines)

**Platform Dependencies:**
```typescript
import { spawn } from 'child_process';      // Node.js only
import path from 'path';                     // Node.js only
import EventEmitter from 'events';           // Node.js only
import { fileURLToPath } from 'url';         // Node.js only
import electron from 'electron';             // Electron only
const { ipcMain, BrowserWindow } = electron;
```

**Key Platform-Specific Features:**
1. **MCP Server Management** (lines 398-464)
   - Spawns Node.js child processes
   - Uses stdio transport
   - Requires `child_process` module

2. **File System Operations**
   - Ollama model discovery via filesystem
   - Config file loading

3. **Event Forwarding to Renderer** (lines 19-33)
   - Direct BrowserWindow access
   - IPC communication

4. **HTTP Requests**
   - `fetch()` API (works in both Node.js and Browser)
   - Platform-agnostic ✅

---

### 3.2 Platform Abstraction Strategy

**Option 1: Create LLMManagerBase in lama.core**

```typescript
// lama.core/services/LLMManagerBase.ts
export abstract class LLMManagerBase {
  protected models: Map<string, LLMModel>;
  protected modelSettings: Map<string, any>;

  // Platform-agnostic methods
  async chat(messages: any[], modelId: string, options: any): Promise<string> {
    // Core logic
  }

  async chatWithAnalysis(messages: any[], modelId: string): Promise<any> {
    // Core logic
  }

  // Platform-specific abstractions
  protected abstract discoverOllamaModels(): Promise<LLMModel[]>;
  protected abstract loadOllamaConfig(): Promise<OllamaConfig>;
  protected abstract initializeMCP(): Promise<void>;
  protected abstract forwardLog(level: string, ...args: any[]): void;
}

// lama.electron/services/llm-manager.ts
export class NodeLLMManager extends LLMManagerBase {
  protected async discoverOllamaModels(): Promise<LLMModel[]> {
    // Node.js implementation using filesystem
  }

  protected async initializeMCP(): Promise<void> {
    // Node.js implementation using child_process
  }

  protected forwardLog(level: string, ...args: any[]): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    mainWindow?.webContents.send('main-process-log', { level, message: args.join(' ') });
  }
}
```

**Option 2: Dependency Injection for Platform Features** (Recommended)

```typescript
// lama.core/services/LLMManager.ts
export interface LLMPlatform {
  discoverModels(): Promise<LLMModel[]>;
  loadConfig(): Promise<any>;
  initializeMCP(): Promise<MCPClient[]>;
  emit(event: string, data: any): void;
}

export class LLMManager {
  constructor(
    private platform: LLMPlatform
  ) {}

  async init(): Promise<void> {
    const models = await this.platform.discoverModels();
    const config = await this.platform.loadConfig();
    await this.platform.initializeMCP();
  }
}

// lama.electron/platform/NodeLLMPlatform.ts
export class NodeLLMPlatform implements LLMPlatform {
  async discoverModels(): Promise<LLMModel[]> {
    const { getLocalOllamaModels } = await import('../../electron-ui/src/services/ollama.js');
    return await getLocalOllamaModels();
  }

  async initializeMCP(): Promise<MCPClient[]> {
    // Node.js MCP initialization
  }

  emit(event: string, data: any): void {
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send(event, data));
  }
}
```

**Recommendation:** Use **Option 2** (Dependency Injection) for better testability and clearer boundaries.

---

### 3.3 Shared vs Platform-Specific Methods

#### **Platform-Agnostic (Move to lama.core):**
```typescript
✅ chat(messages, modelId, options)
✅ chatWithAnalysis(messages, modelId, options, topicId)
✅ chatWithOllama(model, messages, options)
✅ chatWithClaude(model, messages, options)
✅ enhanceMessagesWithTools(messages)
✅ processToolCalls(response, context)
✅ getModels()
✅ getModel(id)
✅ getAvailableModels()
✅ registerPrivateVariant(modelId)
```

#### **Platform-Specific (Keep in lama.electron):**
```typescript
⚠️ discoverOllamaModels()      // Uses filesystem
⚠️ loadOllamaConfig()          // Uses IPC handlers
⚠️ initializeMCP()             // Uses child_process
⚠️ forwardLog()                // Uses BrowserWindow
⚠️ preWarmConnection()         // Uses fetch (works in both, but config is platform-specific)
```

---

## 4. Migration Risks and Mitigation

### 4.1 Breaking Changes Risk

**Risk:** Existing IPC handlers in lama.electron depend on current API

**Example:**
```typescript
// Current: main/ipc/handlers/ai.ts
export default {
  async chat(event, request) {
    // Calls llmManager.chat() directly
    return await llmManager.chat(request.messages, request.modelId);
  }
}
```

**Mitigation:**
1. **Phase 1:** Create new handlers alongside old ones
2. **Phase 2:** Update IPC handlers to use new component architecture
3. **Phase 3:** Remove old handlers

**Timeline:** 2-3 iterations to avoid breaking changes

---

### 4.2 State Migration Risk

**Risk:** Existing state in AIAssistantModel needs migration

**Current State:**
```typescript
class AIAssistantModel {
  topicModelMap: Map<string, string>
  topicDisplayNames: Record<string, string>
  aiContacts: Map<string, string>
  lastRestartPoint: Map<string, number>
  topicRestartSummaries: Map<string, any>
  pendingMessageQueues: Map<string, Array<any>>
  welcomeGenerationInProgress: Map<string, Promise<any>>
}
```

**Mitigation:**
1. **Use state transfer objects** during initialization
2. **Serialize state** between old and new implementations
3. **Gradual migration** - keep old state manager until all features migrated

---

### 4.3 Circular Dependency Risk

**Risk:** Improper initialization order causes null pointer errors

**Example:**
```typescript
// WRONG: Circular initialization
const promptBuilder = new AIPromptBuilder(..., messageProcessor); // Not created yet!
const messageProcessor = new AIMessageProcessor(..., promptBuilder);
```

**Mitigation:**
```typescript
// CORRECT: Two-phase initialization
const topicManager = new AITopicManager(...);
const promptBuilder = new AIPromptBuilder(..., topicManager);
const messageProcessor = new AIMessageProcessor(..., promptBuilder);

// Connect circular reference
promptBuilder.setMessageProcessor(messageProcessor);
```

**Testing:** Create unit tests that verify initialization order

---

### 4.4 Platform Abstraction Risk

**Risk:** Platform-specific code leaks into lama.core

**Example:**
```typescript
// BAD: Direct platform dependency in lama.core
import { BrowserWindow } from 'electron';  // ❌ Not platform-agnostic

// GOOD: Dependency injection
constructor(private eventEmitter: AIEventEmitter) {}  // ✅ Platform-agnostic
```

**Mitigation:**
1. **Strict import rules:** lama.core can only import from `@refinio/one.core` and `@refinio/one.models`
2. **CI/CD checks:** Lint rules to prevent platform imports
3. **Code review:** Mandatory review for any lama.core changes

---

### 4.5 Testing Complexity Risk

**Risk:** Refactored components harder to test in isolation

**Mitigation:**
1. **Create mock implementations** for all dependencies
2. **Test each component** with mocked dependencies
3. **Integration tests** to verify component interactions
4. **Reference implementation tests** as baseline

**Example Test:**
```typescript
describe('AIMessageProcessor', () => {
  let messageProcessor: AIMessageProcessor;
  let mockChannelManager: jest.Mocked<ChannelManager>;
  let mockLLMManager: jest.Mocked<LLMManager>;

  beforeEach(() => {
    mockChannelManager = createMockChannelManager();
    mockLLMManager = createMockLLMManager();

    messageProcessor = new AIMessageProcessor(
      mockChannelManager,
      mockLLMManager,
      // ... other mocks
    );
  });

  it('should queue messages correctly', async () => {
    await messageProcessor.handleTopicMessage('topic1', mockMessage);
    expect(mockChannelManager.postToChannel).toHaveBeenCalledWith('topic1', expect.any(Object));
  });
});
```

---

## 5. Dependency Graph

### 5.1 Component Dependencies (No Cycles)

```
┌─────────────────────┐
│  AIContactManager   │
│  (Minimal deps)     │
└─────────────────────┘
         │
         │ Creates contacts for
         ▼
┌─────────────────────┐
│  AITopicManager     │◄─── Uses to identify AI messages
│                     │
└─────────────────────┘
         │
         │ Topic state
         ▼
┌─────────────────────┐
│  AIPromptBuilder    │◄─── Uses to check isAIContact()
│                     │     (circular, resolved via setter)
└─────────────────────┘
         │
         │ Builds prompts
         ▼
┌─────────────────────┐
│ AIMessageProcessor  │
│                     │
└─────────────────────┘
         │
         │ Task execution
         ▼
┌─────────────────────┐
│  AITaskManager      │
│  (Subjects/Tasks)   │
└─────────────────────┘
```

### 5.2 External Dependencies

```
All Components depend on:
  ├── ChannelManager (from @refinio/one.models)
  ├── LeuteModel (from @refinio/one.models)
  ├── TopicModel (from @refinio/one.models)
  └── LLMManager (from lama.core - needs abstraction)

Platform-Specific:
  ├── BrowserWindow (Electron) ──► AIEventEmitter abstraction
  ├── child_process (Node.js) ──► LLMPlatform.initializeMCP()
  └── fs/path (Node.js) ──► LLMPlatform.discoverModels()
```

---

## 6. Recommended Migration Approach

### Phase 1: Foundation (Week 1)
1. **Create platform abstraction interfaces**
   - `AIEventEmitter` in lama.core
   - `LLMPlatform` in lama.core
   - Implement adapters in lama.electron

2. **Extract AIContactManager**
   - Smallest component (113 lines)
   - No circular dependencies
   - Minimal testing surface
   - Move to `lama.core/handlers/AIContactManager.ts`

3. **Create shared types**
   - Move `AITaskConfig`, `AITask`, `AISubject` to lama.core
   - Share between components

### Phase 2: Core Components (Week 2)
1. **Extract AITopicManager**
   - 437 lines, no platform dependencies
   - Move to `lama.core/handlers/AITopicManager.ts`
   - Update imports in lama.electron

2. **Extract AITaskManager**
   - 456 lines, channel-based storage
   - Move to `lama.core/handlers/AITaskManager.ts`
   - Test subject/task storage

### Phase 3: Complex Components (Week 3)
1. **Extract AIPromptBuilder**
   - 416 lines, message history logic
   - Move to `lama.core/handlers/AIPromptBuilder.ts`
   - Prepare for circular dependency

2. **Extract AIMessageProcessor**
   - 1189 lines, core message handling
   - Move to `lama.core/handlers/AIMessageProcessor.ts`
   - Inject `AIEventEmitter` for UI notifications
   - Resolve circular dependency with AIPromptBuilder

### Phase 4: LLM Manager Refactoring (Week 4)
1. **Create LLMManagerBase in lama.core**
   - Extract platform-agnostic methods
   - Define `LLMPlatform` interface

2. **Create NodeLLMPlatform in lama.electron**
   - Implement Node.js-specific features
   - Migrate existing code

3. **Update all references**
   - Update handlers to use new LLMManager
   - Test MCP integration

### Phase 5: Integration & Testing (Week 5)
1. **Create integration tests**
   - Test component interactions
   - Test platform adapters

2. **Update IPC handlers**
   - Use new components
   - Remove old code

3. **Documentation**
   - Update CLAUDE.md
   - Create migration guide

---

## 7. Success Metrics

### Code Quality
- ✅ All components < 500 lines
- ✅ No platform-specific imports in lama.core
- ✅ Test coverage > 80% per component
- ✅ Zero circular dependencies (except resolved via setters)

### Performance
- ✅ No performance degradation vs current implementation
- ✅ Message queue processing time unchanged
- ✅ LLM response time unchanged

### Maintainability
- ✅ New features can be added to individual components
- ✅ Components can be tested in isolation
- ✅ Platform adapters can be swapped (Electron → Web Worker)

---

## Appendix A: File Locations

### Current Implementation
```
/Users/gecko/src/lama/lama.electron/main/core/ai-assistant-model.ts (1605 lines)
/Users/gecko/src/lama/lama.electron/main/services/llm-manager.ts (1156 lines)
```

### Reference Implementation
```
/Users/gecko/src/lama/lama.electron/reference/lama/src/models/ai/assistant/
  ├── AIAssistantModel.ts (792 lines - orchestrator)
  ├── aiTopicManager.ts (437 lines)
  ├── aiMessageProcessor.ts (1189 lines)
  ├── aiPromptBuilder.ts (416 lines)
  ├── aiContactManager.ts (113 lines)
  └── aiTaskManager.ts (456 lines)
```

### Target Structure (lama.core)
```
/Users/gecko/src/lama/lama.core/handlers/
  ├── AIContactManager.ts
  ├── AITopicManager.ts
  ├── AIPromptBuilder.ts
  ├── AIMessageProcessor.ts
  └── AITaskManager.ts

/Users/gecko/src/lama/lama.core/services/
  ├── LLMManagerBase.ts
  └── interfaces/
      ├── AIEventEmitter.ts
      └── LLMPlatform.ts
```

### Platform Adapters (lama.electron)
```
/Users/gecko/src/lama/lama.electron/platform/
  ├── ElectronAIEventEmitter.ts
  └── NodeLLMPlatform.ts
```

---

## Appendix B: Existing Handler Patterns

### ChatHandler Pattern
- **Location:** `/Users/gecko/src/lama/lama.core/handlers/ChatHandler.ts`
- **Lines:** 841
- **Pattern:** Constructor injection, typed request/response interfaces
- **Usage:** Created in IPC handler, dependencies passed from lama.electron

### AIHandler Pattern
- **Location:** `/Users/gecko/src/lama/lama.core/handlers/AIHandler.ts`
- **Lines:** 878
- **Pattern:** Constructor injection, setter methods for optional deps
- **Usage:** Created in IPC handler, platform-specific callbacks via `eventSender`

---

**End of Research Document**
