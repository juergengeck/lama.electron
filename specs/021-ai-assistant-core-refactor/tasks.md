# Tasks: AI Assistant Core Refactoring

**Input**: Design documents from `/specs/021-ai-assistant-core-refactor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **lama.core**: `/Users/gecko/src/lama/lama.core/`
- **lama.electron**: `/Users/gecko/src/lama/lama.electron/`
- All paths are absolute from repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure and platform abstraction foundations

- [ ] T001 Create lama.core/models/ai/ directory for AI components
- [ ] T002 Create lama.core/handlers/ directory for AIHandler (if not exists)
- [ ] T003 [P] Create lama.electron/tests/ai-assistant/ directory for component tests
- [ ] T004 [P] Create lama.core/services/llm-platform.ts with LLMPlatform interface
- [ ] T005 [P] Create lama.electron/adapters/electron-llm-platform.ts implementing LLMPlatform

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Create lama.core/models/ai/types.ts with shared types (AIMode, AITaskType, AITaskConfig, LLMModelInfo, PromptResult, RestartContext)
- [ ] T007 Copy contracts/ TypeScript interfaces to lama.core/models/ai/interfaces.ts (IAIHandler, IAITopicManager, IAIMessageProcessor, IAIPromptBuilder, IAIContactManager, IAITaskManager)
- [ ] T008 [P] Create lama.core/models/ai/index.ts with component exports
- [ ] T009 Review current lama.electron/main/core/ai-assistant-model.ts (1605 lines) and document method-to-component mapping in migration notes

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Platform-Agnostic AI Components (Priority: P1) 🎯 MVP

**Goal**: Developers can use AI assistant and LLM management functionality in any platform without duplicating business logic

**Independent Test**: Import and instantiate AIHandler in a Node.js test script, verify it accepts only ONE.core dependencies (no Electron imports), and check that lama.core has zero imports from lama.electron via static analysis

### Implementation for User Story 1

#### AIContactManager (Simplest Component - No Dependencies on Other AI Components)

- [ ] T010 [P] [US1] Create lama.core/models/ai/AIContactManager.ts with constructor accepting LeuteModel and optional LLMObjectManager
- [ ] T011 [P] [US1] Implement ensureAIContactForModel() method: check cache, create Person/Profile/Someone if needed
- [ ] T012 [P] [US1] Implement createAIContact() method: Create Person object, generate keys, create Profile and Someone, add to LeuteModel
- [ ] T013 [P] [US1] Implement lookup methods: getPersonIdForModel(), isAIPerson(), getModelIdForPersonId()
- [ ] T014 [P] [US1] Implement ensureContactsForModels() for batch contact creation
- [ ] T015 [US1] Add aiContacts Map cache (modelId → personId) with initialization from existing contacts

#### AITopicManager (No Circular Dependencies)

- [ ] T016 [P] [US1] Create lama.core/models/ai/AITopicManager.ts with constructor accepting TopicModel, ChannelManager, LeuteModel, LLMManager
- [ ] T017 [P] [US1] Implement state maps: topicModelMap, topicLoadingState, topicDisplayNames, topicAIModes
- [ ] T018 [P] [US1] Implement registerAITopic(), isAITopic(), getModelIdForTopic()
- [ ] T019 [P] [US1] Implement setTopicLoadingState(), isTopicLoading() with OEvent emission
- [ ] T020 [P] [US1] Implement getTopicDisplayName(), setTopicDisplayName()
- [ ] T021 [P] [US1] Implement getAllAITopicIds(), setTopicAIMode(), getTopicAIMode()

#### AITaskManager (No Circular Dependencies)

- [ ] T022 [P] [US1] Create lama.core/models/ai/AITaskManager.ts with constructor accepting ChannelManager and optional TopicAnalysisModel
- [ ] T023 [P] [US1] Implement state: topicTaskConfigs Map, subjectChannelInitialized boolean
- [ ] T024 [P] [US1] Implement initializeSubjectChannel() method for IoM subject channel creation
- [ ] T025 [P] [US1] Implement associateTaskWithTopic() for dynamic task associations
- [ ] T026 [P] [US1] Implement getTasksForTopic() and executeTasksForMessage()

#### AIPromptBuilder (Part of Circular Dependency Pair)

- [ ] T027 [P] [US1] Create lama.core/models/ai/AIPromptBuilder.ts with constructor accepting ChannelManager, LLMManager, AITopicManager, optional ContextEnrichmentService
- [ ] T028 [P] [US1] Add setMessageProcessor() setter method for circular dependency resolution
- [ ] T029 [P] [US1] Implement buildPrompt() method: Get history, check context window, add enrichment, return PromptResult
- [ ] T030 [P] [US1] Implement checkContextWindowAndPrepareRestart(): Estimate tokens, trigger restart if needed
- [ ] T031 [P] [US1] Implement generateConversationSummaryForRestart(): Get Summary from TopicAnalysisModel or fallback

#### AIMessageProcessor (Part of Circular Dependency Pair)

- [ ] T032 [P] [US1] Create lama.core/models/ai/AIMessageProcessor.ts with constructor accepting ChannelManager, LLMManager, LeuteModel, AITopicManager, optional StateManager
- [ ] T033 [P] [US1] Add setPromptBuilder() and setTaskManager() setter methods for circular dependency resolution
- [ ] T034 [P] [US1] Implement state: messageQueues, processingMessageIds, lastProcessedMessageId, systemTopicMessages
- [ ] T035 [P] [US1] Implement handleTopicMessage(): Validate, queue, process messages per topic
- [ ] T036 [P] [US1] Implement processMessage(): Build prompt via AIPromptBuilder, invoke LLM, stream response
- [ ] T037 [P] [US1] Implement isAIMessage() and isAIContact() validation methods
- [ ] T038 [P] [US1] Implement setAvailableLLMModels() and onGenerationProgress event handling

#### AIHandler (Main Orchestrator)

- [ ] T039 [US1] Create lama.core/handlers/AIHandler.ts with constructor accepting AIHandlerDependencies interface
- [ ] T040 [US1] Implement init() method: Two-phase initialization - create components, resolve circular dependencies via setters
- [ ] T041 [US1] Implement ensureDefaultChats(): Check for 'hi' and 'lama' topics, register or create
- [ ] T042 [US1] Implement scanExistingConversations(): Iterate channels, find AI participants, register topics
- [ ] T043 [US1] Implement processMessage() delegation to AIMessageProcessor.handleTopicMessage()
- [ ] T044 [US1] Implement delegation methods: isAITopic(), getModelIdForTopic(), isAIPerson(), getModelIdForPersonId()
- [ ] T045 [US1] Implement ensureAIContactForModel() delegation to AIContactManager
- [ ] T046 [US1] Implement setDefaultModel(), getDefaultModel() with AISettingsManager integration
- [ ] T047 [US1] Implement registerAITopic(), getTopicDisplayName(), setTopicDisplayName() delegation
- [ ] T048 [US1] Implement handleNewTopic() for welcome message generation
- [ ] T049 [US1] Implement shutdown() method to clean up resources

#### LLMManager Migration to lama.core

- [ ] T050 [US1] Copy lama.electron/main/services/llm-manager.ts to lama.core/services/llm-manager.ts
- [ ] T051 [US1] Refactor LLMManager constructor to accept optional LLMPlatform interface
- [ ] T052 [US1] Replace all BrowserWindow.send() calls with platform?.emitProgress/emitError/emitMessageUpdate
- [ ] T053 [US1] Remove child_process imports for MCP server (move to LLMPlatform.startMCPServer)
- [ ] T054 [US1] Remove file system operations (move to LLMPlatform.readModelFile)
- [ ] T055 [US1] Update ollama.ts, lmstudio.ts, claude.ts imports to use lama.core/services paths
- [ ] T056 [US1] Verify LLMManager works without platform interface (browser compatibility)

#### Static Analysis Verification (SC-003: Zero lama.electron imports in lama.core)

- [ ] T057 [US1] Create static analysis script in lama.core/ to check for lama.electron imports
- [ ] T058 [US1] Run static analysis: `grep -r "from '@lama/electron" lama.core/` → should return zero results
- [ ] T059 [US1] Run static analysis: `grep -r "from '../../../lama.electron" lama.core/` → should return zero results
- [ ] T060 [US1] Verify all imports in lama.core use only @refinio/one.core, @refinio/one.models, or lama.core paths

**Checkpoint**: At this point, all lama.core components exist with zero platform dependencies. User Story 1 should be testable by instantiating AIHandler with mocked ONE.core dependencies in a Node.js script.

---

## Phase 4: User Story 2 - Component-Based AI Architecture (Priority: P2)

**Goal**: Developers can modify specific AI functionality without understanding or risking changes to unrelated AI features

**Independent Test**: Modify prompt building logic (e.g., change context window calculation) and verify via unit tests that topic management and contact management behavior remains unchanged

### Unit Tests for User Story 2

- [ ] T061 [P] [US2] Create lama.electron/tests/ai-assistant/topic-manager.test.ts with AITopicManager unit tests
- [ ] T062 [P] [US2] Create lama.electron/tests/ai-assistant/message-processor.test.ts with AIMessageProcessor unit tests
- [ ] T063 [P] [US2] Create lama.electron/tests/ai-assistant/prompt-builder.test.ts with AIPromptBuilder unit tests
- [ ] T064 [P] [US2] Create lama.electron/tests/ai-assistant/contact-manager.test.ts with AIContactManager unit tests
- [ ] T065 [P] [US2] Create lama.electron/tests/ai-assistant/task-manager.test.ts with AITaskManager unit tests

### Implementation for User Story 2

- [ ] T066 [US2] Implement AITopicManager unit tests: registerAITopic, isAITopic, getModelIdForTopic, loading states, display names
- [ ] T067 [US2] Implement AIMessageProcessor unit tests: handleTopicMessage, processMessage, queue management, deduplication
- [ ] T068 [US2] Implement AIPromptBuilder unit tests: buildPrompt, checkContextWindowAndPrepareRestart, summary generation
- [ ] T069 [US2] Implement AIContactManager unit tests: ensureAIContactForModel, createAIContact, lookup methods
- [ ] T070 [US2] Implement AITaskManager unit tests: initializeSubjectChannel, associateTaskWithTopic, executeTasksForMessage
- [ ] T071 [US2] Create mock factories for dependencies: MockTopicModel, MockChannelManager, MockLeuteModel, MockLLMManager
- [ ] T072 [US2] Test circular dependency resolution: Verify AIPromptBuilder.setMessageProcessor and AIMessageProcessor.setPromptBuilder work correctly
- [ ] T073 [US2] Verify component isolation: Change AIPromptBuilder logic, run AITopicManager tests, confirm zero test changes needed
- [ ] T074 [US2] Verify component size (SC-004): Each component <400 lines via line count script

**Checkpoint**: At this point, User Story 2 should be complete with comprehensive unit tests verifying component isolation. Developers can confidently modify individual components.

---

## Phase 5: User Story 3 - Consistent Handler Pattern (Priority: P3)

**Goal**: Platform-specific code follows a consistent thin-adapter pattern where handlers instantiate lama.core components and delegate business logic

**Independent Test**: Examine lama.electron/main/ipc/handlers/ai.ts and verify it contains <100 lines, performs only dependency injection and delegation, and contains zero business logic

### Implementation for User Story 3

#### IPC Handler Refactoring

- [ ] T075 [P] [US3] Backup current lama.electron/main/core/ai-assistant-model.ts to ai-assistant-model.ts.backup
- [ ] T076 [P] [US3] Create new lama.electron/main/ipc/handlers/ai.ts as thin adapter
- [ ] T077 [US3] Implement AIHandler instantiation in ai.ts: Import from lama.core, inject NodeOneCore dependencies
- [ ] T078 [US3] Implement aiHandler.init() call during Electron main process initialization
- [ ] T079 [US3] Implement IPC handler: 'ai:processMessage' → aiHandler.processMessage()
- [ ] T080 [US3] Implement IPC handler: 'ai:isAITopic' → aiHandler.isAITopic()
- [ ] T081 [US3] Implement IPC handler: 'ai:getModelIdForTopic' → aiHandler.getModelIdForTopic()
- [ ] T082 [US3] Implement IPC handler: 'ai:ensureDefaultChats' → aiHandler.ensureDefaultChats()
- [ ] T083 [US3] Implement IPC handler: 'ai:getTopicDisplayName' → aiHandler.getTopicDisplayName()
- [ ] T084 [US3] Implement IPC handler: 'ai:setTopicDisplayName' → aiHandler.setTopicDisplayName()
- [ ] T085 [US3] Implement IPC handler: 'ai:setDefaultModel' → aiHandler.setDefaultModel()
- [ ] T086 [US3] Implement IPC handler: 'ai:getDefaultModel' → aiHandler.getDefaultModel()
- [ ] T087 [US3] Create ElectronLLMPlatform adapter: Implement emitProgress, emitError, emitMessageUpdate via BrowserWindow
- [ ] T088 [US3] Wire ElectronLLMPlatform to AIHandler/LLMManager during initialization

#### LLM IPC Handler Updates

- [ ] T089 [P] [US3] Refactor lama.electron/main/ipc/handlers/llm.ts to use lama.core/services/llm-manager.ts
- [ ] T090 [P] [US3] Update llm.ts IPC handlers to delegate to LLMManager from lama.core
- [ ] T091 [P] [US3] Remove lama.electron/main/services/llm-manager.js (replaced by lama.core version)

#### Chat IPC Handler Integration

- [ ] T092 [US3] Update lama.electron/main/ipc/handlers/chat.ts to check aiHandler.isAITopic() before delegating
- [ ] T093 [US3] For AI topics, delegate message sending to aiHandler.processMessage()
- [ ] T094 [US3] For non-AI topics, maintain existing TopicRoom.sendMessage() behavior

#### Contract Tests (Verify FR-010: No breaking IPC changes)

- [ ] T095 [US3] Create lama.electron/tests/ai-assistant/ipc-contracts.test.ts
- [ ] T096 [US3] Test 'ai:processMessage' contract: Verify request/response types match contracts/ipc-contracts.ts
- [ ] T097 [US3] Test 'ai:isAITopic' contract: Verify request/response types
- [ ] T098 [US3] Test 'ai:getModelIdForTopic' contract: Verify request/response types
- [ ] T099 [US3] Test 'ai:ensureDefaultChats' contract: Verify request/response types
- [ ] T100 [US3] Test 'llm:getAvailableModels' contract: Verify request/response types
- [ ] T101 [US3] Test 'llm:loadModel' contract: Verify request/response types
- [ ] T102 [US3] Test all IPC event contracts: message:thinking, message:stream, message:updated, ai:error
- [ ] T103 [US3] Verify IPC handler size (SC-006): ai.ts <100 lines via line count

#### Integration Tests

- [ ] T104 [US3] Create lama.electron/tests/ai-assistant/integration.test.ts
- [ ] T105 [US3] Test end-to-end message flow: User message → IPC → AIHandler → LLM → Response → UI events
- [ ] T106 [US3] Test topic registration flow: Create topic → Register → Verify isAITopic → Process message
- [ ] T107 [US3] Test welcome message generation: New topic → handleNewTopic → Welcome message sent
- [ ] T108 [US3] Test context window restart: Many messages → Context limit → Summary-based restart
- [ ] T109 [US3] Test AI contact creation: ensureAIContactForModel → Person/Profile/Someone created → Cached

**Checkpoint**: At this point, User Story 3 should be complete. All IPC handlers follow the thin-adapter pattern, and contract tests verify no breaking changes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and regression testing

### Regression Testing (SC-005: All existing features work identically)

- [ ] T110 [P] Test welcome message generation: Hi and LAMA chats created with correct messages
- [ ] T111 [P] Test topic analysis integration: Keywords and subjects extracted correctly
- [ ] T112 [P] Test context enrichment: Context hints added to prompts correctly
- [ ] T113 [P] Test default chats: ensureDefaultChats() creates Hi and LAMA if missing
- [ ] T114 [P] Test message processing: AI responds to messages with correct content
- [ ] T115 [P] Test topic scanning: scanExistingConversations() registers all AI topics
- [ ] T116 [P] Test contact management: AI contacts created and cached correctly
- [ ] T117 [P] Test task manager: Subject channel initialized, tasks executed

### Performance Testing

- [ ] T118 Test AI response streaming: First token latency <100ms (same as before)
- [ ] T119 Test component instantiation: AIHandler.init() <10ms overhead
- [ ] T120 Test message processing throughput: ~50 msgs/sec (same as before)
- [ ] T121 Test memory usage: Component architecture doesn't increase memory significantly

### Code Cleanup

- [ ] T122 Remove lama.electron/main/core/ai-assistant-model.ts (replaced by AIHandler in lama.core)
- [ ] T123 Remove lama.electron/main/services/llm-manager.js (moved to lama.core)
- [ ] T124 Update lama.electron/main/core/node-one-core.ts to use AIHandler from lama.core
- [ ] T125 Update all imports in lama.electron to use lama.core paths (@lama/core/...)
- [ ] T126 [P] Run TypeScript compiler: Verify zero type errors in both lama.core and lama.electron
- [ ] T127 [P] Run ESLint: Verify zero linting errors
- [ ] T128 [P] Update package.json dependencies: Ensure lama.core is properly linked

### Documentation Updates

- [ ] T129 [P] Update lama.electron/CLAUDE.md with new AI assistant architecture section
- [ ] T130 [P] Add migration guide to specs/021-ai-assistant-core-refactor/MIGRATION.md for future refactoring
- [ ] T131 [P] Update quickstart.md with real examples from implemented code
- [ ] T132 [P] Verify all code examples in quickstart.md work correctly

### Final Validation

- [ ] T133 Run full test suite: All tests pass (unit, integration, contract)
- [ ] T134 Verify success criteria SC-001: Import AIHandler in Node.js test, zero Electron deps
- [ ] T135 Verify success criteria SC-002: Run test suite against handlers in Node.js and simulated browser
- [ ] T136 Verify success criteria SC-003: Static analysis shows zero lama.electron imports in lama.core
- [ ] T137 Verify success criteria SC-004: All components <400 lines
- [ ] T138 Verify success criteria SC-005: Regression tests pass (all features work)
- [ ] T139 Verify success criteria SC-006: IPC handlers <100 lines average
- [ ] T140 Verify success criteria SC-007: Modify AIPromptBuilder, verify zero changes to other components

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase - Creates all components
- **User Story 2 (Phase 4)**: Depends on User Story 1 - Adds unit tests for component isolation
- **User Story 3 (Phase 5)**: Depends on User Story 1 - Refactors IPC handlers to use components
- **Polish (Phase 6)**: Depends on all user stories - Final validation

### User Story Dependencies

- **User Story 1 (P1)**: MUST complete first - Creates all lama.core components
- **User Story 2 (P2)**: Depends on US1 - Tests the components created in US1
- **User Story 3 (P3)**: Depends on US1 - Uses components from US1 in IPC handlers

**Note**: Unlike typical features, this refactoring has sequential dependencies because:
- US1 creates the components
- US2 tests the components
- US3 integrates the components into IPC handlers

### Within Each User Story

**User Story 1**:
1. Create types and interfaces (T006-T009)
2. Create independent components in parallel: AIContactManager (T010-T015), AITopicManager (T016-T021), AITaskManager (T022-T026)
3. Create circular dependency pair: AIPromptBuilder (T027-T031), AIMessageProcessor (T032-T038)
4. Create AIHandler orchestrator (T039-T049)
5. Migrate LLMManager (T050-T056)
6. Verify static analysis (T057-T060)

**User Story 2**:
1. Create test files in parallel (T061-T065)
2. Implement unit tests (T066-T073)
3. Verify component isolation and size (T074)

**User Story 3**:
1. Create IPC handlers in parallel: ai.ts (T075-T088), llm.ts (T089-T091)
2. Update chat.ts (T092-T094)
3. Create contract tests (T095-T103)
4. Create integration tests (T104-T109)

### Parallel Opportunities

**Setup (Phase 1)**:
- T003, T004, T005 can run in parallel

**Foundational (Phase 2)**:
- T006, T007, T008 can run in parallel

**User Story 1**:
- T010-T015 (AIContactManager) in parallel
- T016-T021 (AITopicManager) in parallel
- T022-T026 (AITaskManager) in parallel
- T027-T031 (AIPromptBuilder) in parallel with T032-T038 (AIMessageProcessor)

**User Story 2**:
- T061-T065 (test file creation) in parallel
- T110-T117 (regression tests) in parallel

**User Story 3**:
- T075-T076 (backups) in parallel
- T089-T091 (llm.ts) in parallel with T075-T088 (ai.ts)
- T129-T132 (documentation) in parallel

---

## Parallel Example: User Story 1

```bash
# Create all independent components in parallel:
Task T010-T015: "AIContactManager implementation"
Task T016-T021: "AITopicManager implementation"
Task T022-T026: "AITaskManager implementation"

# Create circular dependency pair:
Task T027-T031: "AIPromptBuilder implementation"
Task T032-T038: "AIMessageProcessor implementation"

# Then sequentially:
Task T039-T049: "AIHandler orchestrator" (depends on all components)
Task T050-T056: "LLMManager migration"
Task T057-T060: "Static analysis verification"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T009) - CRITICAL
3. Complete Phase 3: User Story 1 (T010-T060)
4. **STOP and VALIDATE**:
   - Import AIHandler in Node.js test
   - Verify zero Electron dependencies
   - Run static analysis (SC-003)
   - Test basic message processing
5. This gives you a working, platform-agnostic AI assistant in lama.core

### Incremental Delivery

1. **Foundation** (Setup + Foundational) → Structure ready
2. **US1** (Platform-Agnostic Components) → Core refactoring done ✅ MVP!
3. **US2** (Component Isolation Tests) → Quality assurance ✅
4. **US3** (IPC Handler Pattern) → Integration complete ✅
5. **Polish** (Regression + Validation) → Production ready ✅

Each phase adds value without breaking previous work.

### Risk Mitigation

- **Parallel implementation in US1** allows old ai-assistant-model.ts to coexist with new AIHandler
- **Contract tests in US3** catch any breaking IPC changes before UI breakage
- **Regression tests** ensure feature parity (SC-005)
- **Static analysis** enforces platform separation (SC-003)

---

## Task Summary

**Total Tasks**: 140

**Breakdown by Phase**:
- Phase 1 (Setup): 5 tasks
- Phase 2 (Foundational): 4 tasks
- Phase 3 (User Story 1): 51 tasks
- Phase 4 (User Story 2): 14 tasks
- Phase 5 (User Story 3): 35 tasks
- Phase 6 (Polish): 31 tasks

**Breakdown by Story**:
- User Story 1: 51 tasks (36%)
- User Story 2: 14 tasks (10%)
- User Story 3: 35 tasks (25%)
- Setup/Foundational/Polish: 40 tasks (29%)

**Parallel Opportunities**: 35+ tasks marked [P] can run concurrently

**Independent Test Criteria**:
- **US1**: Import AIHandler in Node.js, verify zero Electron deps, static analysis
- **US2**: Modify AIPromptBuilder logic, run AITopicManager tests, zero changes needed
- **US3**: Examine ai.ts, verify <100 lines and zero business logic

**Suggested MVP**: Complete through Phase 3 (User Story 1) for platform-agnostic AI components

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story builds on the previous (sequential dependency in this refactoring)
- Commit after each component completion (T015, T021, T026, T031, T038, T049)
- Stop at any checkpoint to validate story independently
- Static analysis runs at end of US1 to enforce platform separation
- Contract tests in US3 prevent IPC breaking changes
- All 7 success criteria verified in Phase 6 (Polish)
