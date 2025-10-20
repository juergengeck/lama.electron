# Quickstart Guide: AI Assistant Core Refactoring

**Audience**: Developers working with the refactored AI assistant architecture
**Last Updated**: 2025-10-20

## Overview

The AI assistant has been refactored from a monolithic 1605-line class into focused, platform-agnostic components in `lama.core`. This guide helps you:

1. Understand the new architecture
2. Use AI assistant components in your code
3. Add new AI features
4. Test AI functionality

## Architecture at a Glance

### Before (Monolithic)

```
lama.electron/main/core/ai-assistant-model.ts (1605 lines)
  ├── Topic management
  ├── Message processing
  ├── Contact management
  ├── Prompt building
  ├── LLM invocation
  └── Electron-specific UI events
```

### After (Component-Based)

```
lama.core/
├── handlers/
│   └── AIHandler.ts                    # Main orchestrator
├── models/ai/
│   ├── AITopicManager.ts               # Topic lifecycle
│   ├── AIMessageProcessor.ts           # Message queuing/processing
│   ├── AIPromptBuilder.ts              # Context/prompts
│   ├── AIContactManager.ts             # AI contacts
│   └── AITaskManager.ts                # Dynamic tasks (IoM)
└── services/
    └── llm-manager.ts                  # LLM orchestration

lama.electron/main/ipc/handlers/
└── ai.ts                               # Thin adapter (<100 lines)
```

## Quick Start: Using AIHandler

### 1. Import and Instantiate

```typescript
// lama.electron/main/ipc/handlers/ai.ts
import { AIHandler } from '@lama/core/handlers/AIHandler.js';
import nodeOneCore from '../../core/node-one-core.js';

// Create handler with dependencies
const aiHandler = new AIHandler({
  oneCore: nodeOneCore,
  channelManager: nodeOneCore.channelManager,
  topicModel: nodeOneCore.topicModel,
  leuteModel: nodeOneCore.leuteModel,
  llmManager: nodeOneCore.llmManager,
  stateManager: stateManager,              // Platform-specific
  llmObjectManager: nodeOneCore.llmObjectManager,
  contextEnrichmentService: nodeOneCore.contextEnrichmentService,
  topicAnalysisModel: nodeOneCore.topicAnalysisModel,
});

// Initialize (once, at startup)
await aiHandler.init();
```

### 2. Expose Methods via IPC

```typescript
// Export thin IPC handlers
export default {
  async processMessage(event: any, params: any) {
    const { topicId, message, senderId } = params;
    return await aiHandler.processMessage(topicId, message, senderId);
  },

  async isAITopic(event: any, { topicId }: any) {
    return aiHandler.isAITopic(topicId);
  },

  async ensureDefaultChats(event: any) {
    await aiHandler.ensureDefaultChats();
    return { success: true };
  },
};
```

### 3. Wire IPC Channels

```typescript
// lama.electron/main/ipc/index.ts
import aiHandlers from './handlers/ai.js';

ipcMain.handle('ai:processMessage', aiHandlers.processMessage);
ipcMain.handle('ai:isAITopic', aiHandlers.isAITopic);
ipcMain.handle('ai:ensureDefaultChats', aiHandlers.ensureDefaultChats);
```

## Common Tasks

### Task 1: Check if a Topic is an AI Topic

```typescript
// In lama.electron (IPC handler)
const isAI = aiHandler.isAITopic('topic-123');

// In UI (renderer process)
const isAI = await window.electronAPI.invoke('ai:isAITopic', { topicId: 'topic-123' });
```

### Task 2: Process a Message

```typescript
// In lama.electron (IPC handler)
const response = await aiHandler.processMessage(
  'topic-123',
  'Hello AI!',
  userPersonId
);

// In UI (renderer process)
const result = await window.electronAPI.invoke('ai:processMessage', {
  topicId: 'topic-123',
  message: 'Hello AI!',
  senderId: userPersonId,
});
```

### Task 3: Create an AI Contact

```typescript
// In lama.electron (IPC handler)
const personId = await aiHandler.ensureAIContactForModel('gpt-oss:20b');

// The AIHandler delegates to AIContactManager internally:
// 1. Checks if contact already exists (cached)
// 2. If not, creates Person/Profile/Someone objects
// 3. Adds to LeuteModel
// 4. Returns personId
```

### Task 4: Register a New AI Topic

```typescript
// In lama.electron (IPC handler)
const modelId = 'gpt-oss:20b';
const topicId = 'new-conversation-123';

aiHandler.registerAITopic(topicId, modelId);

// Now the topic is tracked as an AI topic
console.log(aiHandler.isAITopic(topicId)); // true
console.log(aiHandler.getModelIdForTopic(topicId)); // 'gpt-oss:20b'
```

### Task 5: Handle New Topic Creation

```typescript
// When a new AI topic is created
const topicId = 'new-topic-456';
const modelId = 'gpt-oss:20b';

// 1. Register the topic
aiHandler.registerAITopic(topicId, modelId);

// 2. Generate welcome message
await aiHandler.handleNewTopic(topicId);

// AIHandler will:
// - Determine the model from the topic mapping
// - Generate a welcome message via LLM
// - Send it to the topic
// - Emit UI events for the welcome message
```

## Component Deep Dives

### AITopicManager

**When to use**: Topic-level operations (mappings, loading states, display names)

```typescript
// Access via AIHandler
const modelId = aiHandler.getModelIdForTopic('topic-123');
const displayName = aiHandler.getTopicDisplayName('topic-123');

// Or directly if you have the component instance
import { AITopicManager } from '@lama/core/models/ai/AITopicManager.js';

const topicManager = new AITopicManager(
  topicModel,
  channelManager,
  leuteModel,
  llmManager
);

topicManager.registerAITopic('topic-123', 'gpt-oss:20b');
topicManager.setTopicDisplayName('topic-123', 'My AI Chat');
```

### AIMessageProcessor

**When to use**: Message handling, queuing, LLM invocation

```typescript
// Access via AIHandler.processMessage (recommended)
const response = await aiHandler.processMessage(topicId, message, senderId);

// Or directly (advanced usage)
import { AIMessageProcessor } from '@lama/core/models/ai/AIMessageProcessor.js';

const processor = new AIMessageProcessor(
  channelManager,
  llmManager,
  leuteModel,
  topicManager,
  stateManager
);

// Resolve circular dependencies
processor.setPromptBuilder(promptBuilder);
processor.setTaskManager(taskManager);

// Handle message
await processor.handleTopicMessage('topic-123', messageObject);
```

### AIPromptBuilder

**When to use**: Building prompts with context, checking context windows

```typescript
// Access via AIMessageProcessor (recommended)
// Automatically used when processing messages

// Or directly (advanced usage)
import { AIPromptBuilder } from '@lama/core/models/ai/AIPromptBuilder.js';

const promptBuilder = new AIPromptBuilder(
  channelManager,
  llmManager,
  topicManager,
  contextEnrichmentService
);

const result = await promptBuilder.buildPrompt(
  'topic-123',
  'What is the weather?',
  userPersonId
);

// Result contains:
// - messages: Array of {role, content} for LLM
// - needsRestart: boolean (context window limit reached?)
// - restartContext?: string (summary for restart)
```

### AIContactManager

**When to use**: Creating or looking up AI contacts

```typescript
// Access via AIHandler.ensureAIContactForModel (recommended)
const personId = await aiHandler.ensureAIContactForModel('gpt-oss:20b');

// Or directly (advanced usage)
import { AIContactManager } from '@lama/core/models/ai/AIContactManager.js';

const contactManager = new AIContactManager(leuteModel, llmObjectManager);

// Create AI contact
const personId = await contactManager.createAIContact('gpt-oss:20b', 'GPT-OSS 20B');

// Lookup operations
const personId = contactManager.getPersonIdForModel('gpt-oss:20b');
const isAI = contactManager.isAIPerson(somePersonId);
const modelId = contactManager.getModelIdForPersonId(aiPersonId);
```

### AITaskManager

**When to use**: Dynamic task associations for IoM (Information over Messages)

```typescript
// Access via AIHandler (automatic initialization)
// Task manager is initialized during aiHandler.init()

// Or directly (advanced usage)
import { AITaskManager } from '@lama/core/models/ai/AITaskManager.js';
import { AITaskType } from '@lama/core/models/ai/types.js';

const taskManager = new AITaskManager(channelManager, topicAnalysisModel);

// Initialize subject channel
await taskManager.initializeSubjectChannel();

// Associate tasks with a topic
await taskManager.associateTaskWithTopic('topic-123', AITaskType.KeywordExtraction);
await taskManager.associateTaskWithTopic('topic-123', AITaskType.SummaryGeneration);

// Execute tasks (automatic during message processing)
const results = await taskManager.executeTasksForMessage('topic-123', 'Message content');
```

## Testing

### Unit Tests (Component Isolation)

```typescript
// Example: Testing AITopicManager
import { AITopicManager } from '@lama/core/models/ai/AITopicManager.js';

describe('AITopicManager', () => {
  let topicManager: AITopicManager;
  let mockTopicModel: jest.Mocked<TopicModel>;
  let mockChannelManager: jest.Mocked<ChannelManager>;

  beforeEach(() => {
    mockTopicModel = createMockTopicModel();
    mockChannelManager = createMockChannelManager();
    topicManager = new AITopicManager(
      mockTopicModel,
      mockChannelManager,
      mockLeuteModel,
      mockLLMManager
    );
  });

  it('should register AI topic', () => {
    topicManager.registerAITopic('topic-1', 'gpt-4');

    expect(topicManager.isAITopic('topic-1')).toBe(true);
    expect(topicManager.getModelIdForTopic('topic-1')).toBe('gpt-4');
  });

  it('should track loading state', () => {
    topicManager.setTopicLoadingState('topic-1', true);

    expect(topicManager.isTopicLoading('topic-1')).toBe(true);
  });
});
```

### Integration Tests (Component Interactions)

```typescript
// Example: Testing AIHandler end-to-end
import { AIHandler } from '@lama/core/handlers/AIHandler.js';

describe('AIHandler Integration', () => {
  let aiHandler: AIHandler;

  beforeEach(async () => {
    aiHandler = new AIHandler({
      oneCore: mockNodeOneCore,
      channelManager: mockChannelManager,
      topicModel: mockTopicModel,
      leuteModel: mockLeuteModel,
      llmManager: mockLLMManager,
    });

    await aiHandler.init();
  });

  it('should process message end-to-end', async () => {
    // Register topic
    aiHandler.registerAITopic('topic-1', 'gpt-oss:20b');

    // Process message
    const response = await aiHandler.processMessage(
      'topic-1',
      'Hello AI',
      userPersonId
    );

    // Verify response
    expect(response).toBeTruthy();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  });
});
```

### IPC Contract Tests

```typescript
// Example: Verify IPC signatures remain unchanged
import type { AIIPCHandlers } from '@lama/specs/contracts/ipc-contracts.js';
import aiHandlers from './handlers/ai.js';

describe('AI IPC Contract Tests', () => {
  it('ai:processMessage maintains signature', async () => {
    const request: AIIPCHandlers['ai:processMessage']['request'] = {
      topicId: 'test-topic',
      message: 'Hello',
      senderId: 'person-123' as any,
    };

    const response = await aiHandlers.processMessage(null, request);

    // Verify response shape
    expect(response).toHaveProperty('messageId');
    expect(response).toHaveProperty('response');
    expect(typeof response.messageId).toBe('string');
  });
});
```

## Platform Abstraction

### Using LLMPlatform Interface

The refactored architecture uses a `LLMPlatform` interface for platform-specific operations:

```typescript
// lama.core/services/llm-platform.ts
interface LLMPlatform {
  emitProgress(topicId: string, progress: number): void;
  emitError(topicId: string, error: Error): void;
  emitMessageUpdate(topicId: string, messageId: string, text: string, status: string): void;
}

// lama.electron/adapters/electron-llm-platform.ts
class ElectronLLMPlatform implements LLMPlatform {
  constructor(private mainWindow: BrowserWindow) {}

  emitProgress(topicId: string, progress: number): void {
    this.mainWindow.webContents.send('message:thinking', {
      conversationId: topicId,
      progress,
    });
  }

  // ... other implementations
}

// Usage in LLMManager
const llmManager = new LLMManager(electronPlatform);
```

**Benefits**:
- LLM manager works in Node.js and browser
- Platform-specific UI feedback isolated to adapters
- Easy to test with mock platforms

## Migration Checklist

If you're migrating code from the old monolithic architecture:

- [ ] Replace `ai-assistant-model.ts` imports with `AIHandler` from lama.core
- [ ] Update IPC handlers to use thin adapter pattern (<100 lines)
- [ ] Replace direct `llmManager` imports from lama.electron with lama.core version
- [ ] Update tests to use component-based mocks
- [ ] Verify IPC contract tests pass (no signature changes)
- [ ] Run regression tests to ensure feature parity

## Troubleshooting

### Issue: "Cannot find module '@lama/core'"

**Solution**: Ensure you're importing from the correct package:
```typescript
// ✅ Correct
import { AIHandler } from '@lama/core/handlers/AIHandler.js';

// ❌ Incorrect
import { AIHandler } from '@lama/electron/main/core/ai-assistant-model.js';
```

### Issue: "Circular dependency error"

**Solution**: Use two-phase initialization with setters:
```typescript
const promptBuilder = new AIPromptBuilder(...);
const messageProcessor = new AIMessageProcessor(...);

// Resolve circular dependency
promptBuilder.setMessageProcessor(messageProcessor);
messageProcessor.setPromptBuilder(promptBuilder);
```

### Issue: "AI topic not recognized"

**Solution**: Ensure topic is registered before processing messages:
```typescript
aiHandler.registerAITopic(topicId, modelId);
// Now aiHandler.isAITopic(topicId) returns true
```

### Issue: "Platform-specific code in lama.core"

**Solution**: Use the LLMPlatform interface for platform operations:
```typescript
// ❌ Don't do this in lama.core
import { BrowserWindow } from 'electron';
mainWindow.webContents.send('event', data);

// ✅ Do this instead
if (this.platform) {
  this.platform.emitProgress(topicId, progress);
}
```

## Next Steps

1. **Read the full specification**: [spec.md](spec.md)
2. **Review component interfaces**: [contracts/components.ts](contracts/components.ts)
3. **Understand IPC contracts**: [contracts/ipc-contracts.ts](contracts/ipc-contracts.ts)
4. **Study the data model**: [data-model.md](data-model.md)
5. **Review the migration plan**: [plan.md](plan.md)

## Getting Help

- **Architecture questions**: Review [data-model.md](data-model.md) for component responsibilities
- **IPC issues**: Check [contracts/ipc-contracts.ts](contracts/ipc-contracts.ts) for expected signatures
- **Testing**: See test examples in this guide and [data-model.md](data-model.md)
- **Migration**: Follow the week-by-week plan in [research.md](research.md)
