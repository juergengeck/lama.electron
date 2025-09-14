# Tasks: Topic-Based Memory System with CommServer Fixes

**Input**: Design documents from `/specs/002-memories-live-in/`
**Prerequisites**: plan.md (required), data-model.md, contracts/, research.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: one.memory module architecture, IPC contracts
2. Load design documents:
   → data-model.md: Topic, Memory, MemoryReference recipes
   → contracts/: 11 IPC handler methods
   → research.md: CommServer centralization approach
3. Generate tasks by category:
   → Setup: one.memory module structure
   → Tests: IPC handler tests (TDD)
   → Core: Recipes, Models, MemoryManager
   → Integration: IPC handlers, CommServer fixes
   → Polish: Documentation, typecheck
4. Apply LAMA rules:
   → Browser = UI only (renderer process)
   → Node.js = all logic (main process)
   → IPC handlers bridge the gap
5. Number tasks sequentially (T001, T002...)
6. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths and process designation (main/renderer)

## Path Conventions
- **Main process**: `/main/` - Node.js, ONE.core, business logic
- **Renderer process**: `/electron-ui/` - Browser, React, UI only
- **Shared types**: `/shared/types/` - TypeScript interfaces

## Phase 3.1: Setup & CommServer Fixes
- [ ] T001 Create one.memory module structure at /main/one.memory/ with src/models/, src/recipes/, src/index.js
- [ ] T002 Create centralized CommServer configuration at /main/core/commserver-config.js to fix hardcoded URLs
- [ ] T003 [P] Update /main/core/node-one-core.js to use centralized CommServer config
- [ ] T004 [P] Add CommServer error handling improvements to /main/core/node-one-core.js
- [ ] T005 Create shared TypeScript interfaces at /shared/types/memory.d.ts for Topic, Memory, MemoryReference

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T006 [P] IPC handler test for memory:initializeManager in /tests/ipc/memory-initialize.test.js
- [ ] T007 [P] IPC handler test for memory:createTopic in /tests/ipc/memory-create-topic.test.js
- [ ] T008 [P] IPC handler test for memory:listTopics in /tests/ipc/memory-list-topics.test.js
- [ ] T009 [P] IPC handler test for memory:addMemory in /tests/ipc/memory-add.test.js
- [ ] T010 [P] IPC handler test for memory:getMemories in /tests/ipc/memory-get.test.js
- [ ] T011 [P] IPC handler test for memory:searchMemories in /tests/ipc/memory-search.test.js
- [ ] T012 [P] Integration test for CommServer reconnection in /tests/integration/commserver-recovery.test.js
- [ ] T013 [P] Integration test for memory sync via CHUM in /tests/integration/memory-sync.test.js

## Phase 3.3: Core Implementation (ONLY after tests are failing)
### ONE.core Recipes
- [ ] T014 [P] Create Topic recipe at /main/one.memory/src/recipes/Topic.js with Recipe definition
- [ ] T015 [P] Create Memory recipe at /main/one.memory/src/recipes/Memory.js with Recipe definition
- [ ] T016 [P] Create MemoryReference recipe at /main/one.memory/src/recipes/MemoryReference.js

### Model Classes
- [ ] T017 Create TopicModel at /main/one.memory/src/models/TopicModel.js extending ONE.models Model
- [ ] T018 Create MemoryModel at /main/one.memory/src/models/MemoryModel.js with CRUD operations
- [ ] T019 Create MemoryManager at /main/one.memory/src/models/MemoryManager.js orchestrating models

### Module Export
- [ ] T020 Create module index at /main/one.memory/src/index.js exporting all recipes and models

## Phase 3.4: IPC Handler Integration
**Main Process Handlers - Bridge to UI**
- [ ] T021 Create memory IPC handler base at /main/ipc/handlers/memory.js with handler registration
- [ ] T022 Implement memory:initializeManager handler connecting to MemoryManager
- [ ] T023 Implement memory:createTopic handler calling TopicModel.createTopic
- [ ] T024 Implement memory:listTopics handler calling TopicModel.listTopics
- [ ] T025 Implement memory:addMemory handler calling MemoryModel.createMemory
- [ ] T026 Implement memory:getMemories handler calling MemoryModel.getMemoriesForTopic
- [ ] T027 Implement memory:searchMemories handler with topic-scoped search
- [ ] T028 Implement memory:archiveTopic handler for soft delete
- [ ] T029 Implement memory:restoreTopic handler for unarchive
- [ ] T030 Implement memory:createReference handler for cross-references
- [ ] T031 Implement memory:importConversation handler for bulk import
- [ ] T032 Implement memory:exportTopic handler with format support
- [ ] T033 Implement memory:syncStatus handler for sync monitoring

## Phase 3.5: Node.js Integration
- [ ] T034 Update /main/core/node-one-core.js to initialize MemoryManager on startup
- [ ] T035 Register memory IPC handlers in /main/main.js IPC handler setup
- [ ] T036 Add memory sync to existing CHUM protocol handlers
- [ ] T037 Connect MemoryManager to existing ChannelManager for topic-channel integration

## Phase 3.6: Browser UI Components (Renderer Process)
**UI ONLY - No ONE.core imports allowed**
- [ ] T038 [P] Create TopicList component at /electron-ui/src/components/memory/TopicList.tsx
- [ ] T039 [P] Create TopicView component at /electron-ui/src/components/memory/TopicView.tsx  
- [ ] T040 [P] Create MemoryCard component at /electron-ui/src/components/memory/MemoryCard.tsx
- [ ] T041 [P] Create MemorySearch component at /electron-ui/src/components/memory/MemorySearch.tsx
- [ ] T042 [P] Create memory service at /electron-ui/src/services/memory-service.ts for IPC calls
- [ ] T043 Add topic navigation to main UI at /electron-ui/src/App.tsx

## Phase 3.7: Polish & Documentation
- [ ] T044 [P] Update CLAUDE.md with memory system documentation and IPC endpoints
- [ ] T045 [P] Run lint checks: npm run lint in project root
- [ ] T046 [P] Run typecheck: npm run typecheck in project root
- [ ] T047 Create user documentation at /docs/memory-system.md
- [ ] T048 Run quickstart validation from /specs/002-memories-live-in/quickstart.md
- [ ] T049 Performance test: Verify <100ms IPC response times
- [ ] T050 Load test: Create 100 topics with 1000 memories each

## Dependencies
- CommServer fixes (T002-T004) before any network operations
- Tests (T006-T013) MUST fail before implementation starts
- Recipes (T014-T016) before Models (T017-T019)
- Models before IPC handlers (T021-T033)
- IPC handlers before UI components (T038-T043)
- All implementation before polish (T044-T050)

## Parallel Execution Examples

### Example 1: Run all IPC handler tests in parallel
```bash
# Using Task agent to run tests T006-T011 simultaneously
Task "Run IPC handler test for memory:initializeManager" &
Task "Run IPC handler test for memory:createTopic" &
Task "Run IPC handler test for memory:listTopics" &
Task "Run IPC handler test for memory:addMemory" &
Task "Run IPC handler test for memory:getMemories" &
Task "Run IPC handler test for memory:searchMemories" &
wait
```

### Example 2: Create all recipes in parallel
```bash
# Recipes have no dependencies on each other
Task "Create Topic recipe" &
Task "Create Memory recipe" &
Task "Create MemoryReference recipe" &
wait
```

### Example 3: Build UI components in parallel
```bash
# UI components T038-T042 can be developed simultaneously
Task "Create TopicList component" &
Task "Create TopicView component" &
Task "Create MemoryCard component" &
Task "Create MemorySearch component" &
Task "Create memory service for IPC" &
wait
```

## Critical Path
The minimum sequential path for a working system:
1. T001 → T002 → T006 (setup → config → first test)
2. T014 → T017 → T019 (recipes → models → manager)
3. T021 → T022 (handler base → first handler)
4. T034 → T035 (integration → registration)
5. T042 → T043 (service → UI integration)

## Notes for Implementation

### LAMA Architecture Reminders
- **NEVER** import ONE.core in browser/renderer process
- **ALL** data operations go through IPC handlers
- **NO** fallbacks - fail fast if IPC fails
- CommServer URL must be centralized (T002)
- Tests must fail first (TDD requirement)

### File Naming Conventions
- Main process: CommonJS (.js files, require/module.exports)
- Renderer process: ESM (.ts/.tsx files, import/export)
- Tests: .test.js for Node.js tests

### Process Isolation
- Main process tasks (T001-T037): Node.js environment
- Renderer tasks (T038-T043): Browser environment
- Never mix concerns between processes

## Success Metrics
- ✅ All 50 tasks completed
- ✅ Tests written and failing before implementation
- ✅ CommServer centralized configuration working
- ✅ Memory system integrated with existing LAMA
- ✅ UI can create/view/search memories via IPC
- ✅ Performance targets met (<100ms IPC)
- ✅ Load test passed (100 topics, 1000 memories each)