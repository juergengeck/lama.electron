# Method-to-Component Mapping

**Source**: `main/core/ai-assistant-model.ts` (1605 lines)
**Purpose**: Document which methods belong to which component for refactoring

## Component Mapping

### AIContactManager (Contact Creation/Lookup)
Methods that manage AI Person/Profile/Someone objects:

- `ensureAIContactForModel(modelId: string)` → Create or get AI contact
- `createAIContact(modelId: string, displayName: string)` → Create Person/Profile/Someone
- `loadExistingAIContacts()` → Scan LeuteModel for existing AI contacts
- `isAIPerson(personId)` → Check if person ID is an AI
- `getPersonIdForModel(modelId)` → Reverse lookup: modelId → personId
- `getModelIdForPersonId(personId)` → Reverse lookup: personId → modelId

**State**:
- `aiContacts: Map<string, string>` (modelId → personId cache)

**Dependencies**:
- LeuteModel (for Person/Profile/Someone operations)
- LLMObjectManager (for model metadata)

---

### AITopicManager (Topic Lifecycle/Mappings)
Methods that manage topic-to-model associations and topic state:

- `registerAITopic(topicId, modelId)` → Register topic as AI topic
- `isAITopic(topicId)` → Check if topic is AI
- `getModelIdForTopic(topicId)` → Get model ID for topic
- `scanExistingConversations()` → Rebuild topic mappings from storage
- `checkAndRegisterExistingTopic(topicId)` → Register if already exists
- `ensureDefaultChats()` → Create Hi and LAMA topics if missing
- `ensureHiChat(modelId, aiPersonId)` → Ensure "Hi" topic exists
- `ensureLamaChat(privateModelId, privateAiPersonId)` → Ensure "LAMA" topic exists
- `setTopicDisplayName(topicId, name)` → Set display name
- `getTopicDisplayName(topicId)` → Get display name
- `setTopicLoadingState(topicId, isLoading)` → Set loading state
- `isTopicLoading(topicId)` → Check loading state
- `setTopicAIMode(topicId, mode)` → Set AI mode (assistant/iom/knowledge)
- `getTopicAIMode(topicId)` → Get AI mode

**State**:
- `topicModelMap: Map<string, string>` (topicId → modelId)
- `topicDisplayNames: Record<string, string>` (topicId → display name)
- `topicLoadingState: Map<string, boolean>` (topicId → isLoading)
- `topicAIModes: Map<string, AIMode>` (topicId → mode)
- `defaultModelId: string | null`

**Dependencies**:
- ChannelManager (for channel access)
- TopicModel (for topic/group operations)
- LeuteModel (for group member lookup)
- LLMManager (for model info)

---

### AIMessageProcessor (Message Queuing/Processing)
Methods that handle incoming messages and generate AI responses:

- `processMessage(topicId, message, senderId)` → Main entry point
- `handleTopicMessage(topicId, message)` → Process new topic message
- `isAIMessage(message)` → Check if message is from AI
- `isAIContact(personId)` → Check if person/profile is AI
- `handleNewTopic(topicId, topicRoom)` → Generate welcome message
- `processPendingMessages(topicId)` → Process queued messages after welcome

**State**:
- `pendingMessageQueues: Map<string, Array<{message, senderId}>>` (queue messages during init)
- `welcomeGenerationInProgress: Map<string, Promise<any>>` (track welcome generation)

**Dependencies**:
- ChannelManager (for posting messages)
- LLMManager (for LLM invocation)
- LeuteModel (for sender lookup)
- AITopicManager (for topic → model mapping)
- AIPromptBuilder (for prompt construction) **[CIRCULAR]**
- AITaskManager (for IoM task execution)
- StateManager/Platform (for UI events)

---

### AIPromptBuilder (Prompt Construction/Context)
Methods that build prompts with conversation context:

- `buildPrompt(topicId, newMessage, senderId)` → Build messages array for LLM
- `checkContextWindowAndPrepareRestart(topicId, messages)` → Check token limits
- `generateConversationSummaryForRestart(topicId, messages)` → Summarize for restart
- `enrichContextWithPastConversations(topicId, currentMessage)` → Add context hints

**State**:
- `lastRestartPoint: Map<string, number>` (topicId → message index)
- `topicRestartSummaries: Map<string, any>` (topicId → restart summary)

**Dependencies**:
- ChannelManager (for retrieving messages)
- LLMManager (for context window size)
- AITopicManager (for topic → model mapping)
- ContextEnrichmentService (for past conversation hints)
- AIMessageProcessor (for AI contact checks) **[CIRCULAR]**

---

### AITaskManager (Dynamic Task Associations for IoM)
Methods that manage task execution for Information over Messages:

- `initializeSubjectChannel()` → Create subject channel
- `associateTaskWithTopic(topicId, taskType)` → Link task to topic
- `getTasksForTopic(topicId)` → Get enabled tasks
- `executeTasksForMessage(topicId, message)` → Run tasks (keyword extraction, etc.)

**State**:
- `topicTaskAssociations: Map<string, AITaskConfig[]>` (topicId → tasks)

**Dependencies**:
- ChannelManager (for subject channel)
- TopicAnalysisModel (for subject/keyword extraction)

---

### AIHandler (Main Orchestrator in lama.core/handlers/)
Entry point that delegates to components:

- `init()` → Initialize all components
- `processMessage(topicId, message, senderId)` → Delegate to AIMessageProcessor
- `isAITopic(topicId)` → Delegate to AITopicManager
- `getModelIdForTopic(topicId)` → Delegate to AITopicManager
- `ensureAIContactForModel(modelId)` → Delegate to AIContactManager
- `setDefaultModel(modelId)` → Delegate to AITopicManager
- `getDefaultModel()` → Delegate to AITopicManager
- `ensureDefaultChats()` → Delegate to AITopicManager
- `scanExistingConversations()` → Delegate to AITopicManager
- `handleNewTopic(topicId)` → Delegate to AIMessageProcessor
- `shutdown()` → Clean up all components

**No State** - only delegates to components

---

## Circular Dependencies

### AIMessageProcessor ↔ AIPromptBuilder

**Why**:
- AIMessageProcessor calls `buildPrompt()` to construct prompts
- AIPromptBuilder calls `isAIContact()` to check if sender is AI

**Resolution**: Two-phase initialization with setters
```typescript
const promptBuilder = new AIPromptBuilder(...);
const messageProcessor = new AIMessageProcessor(...);

// Phase 2: Resolve circular dependency
promptBuilder.setMessageProcessor(messageProcessor);
messageProcessor.setPromptBuilder(promptBuilder);
```

---

## Migration Strategy

1. **Week 1**: Implement AIContactManager, AITopicManager, AITaskManager (no circular deps)
2. **Week 2**: Implement AIPromptBuilder and AIMessageProcessor (with circular dep resolution)
3. **Week 3**: Implement AIHandler orchestrator
4. **Week 4**: Update IPC handlers to use AIHandler
5. **Week 5**: Regression testing and deprecate old ai-assistant-model.ts
