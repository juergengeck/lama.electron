# Tasks: Default LLM Topic Initialization

**Input**: Design documents from `/specs/009-after-the-user/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: Node.js/Electron stack, IPC architecture
2. Load design documents:
   → data-model.md: AI Topic Configuration entities
   → contracts/: ai-setDefaultModel IPC contract
   → research.md: Current implementation in ai.js handler
3. Generate tasks by category:
   → Tests: IPC handler tests, integration tests
   → Core: Fix topic ID generation, add participant switching
   → Integration: Update UI components, test scenarios
4. Apply TDD rules: Tests before implementation
5. Mark [P] for parallel execution (different files)
6. SUCCESS: Tasks ready for execution
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup
- [ ] T001 Create test directory structure `/tests/integration/` if not exists
- [ ] T002 Install test dependencies (if needed for Node.js testing)

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [ ] T003 [P] Contract test for `ai:setDefaultModel` IPC handler in `/tests/integration/ai-setDefaultModel.test.js`
- [ ] T004 [P] Integration test for topic creation with hardcoded IDs in `/tests/integration/topic-creation.test.js`
- [ ] T005 [P] Integration test for participant switching on model change in `/tests/integration/participant-switching.test.js`
- [ ] T006 [P] Integration test for welcome message behavior (static vs LLM) in `/tests/integration/welcome-messages.test.js`
- [ ] T007 [P] Integration test for duplicate prevention in `/tests/integration/duplicate-prevention.test.js`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [ ] T008 Fix topic ID generation in `/main/ipc/handlers/ai.js` (lines 194-195: use "hi" and "lama" instead of model names)
- [ ] T009 Add participant switching logic in `/main/ipc/handlers/ai.js` (update existing participants when model changes)
- [ ] T010 Add welcome message suppression flag in `/main/core/ai-assistant-model.js` (handleNewTopic method)
- [ ] T011 Update static welcome message content verification in Hi topic creation
- [ ] T012 Add topic existence check before creation in `/main/ipc/handlers/ai.js`

## Phase 3.4: Integration

- [ ] T013 Update ChatLayout component in `/electron-ui/src/components/ChatLayout.tsx` to display correct topic names
- [ ] T014 Verify IPC response format matches contract in `/specs/009-after-the-user/contracts/ai-setDefaultModel.json`
- [ ] T015 Add error handling for invalid model IDs in `/main/ipc/handlers/ai.js`
- [ ] T016 Update AI settings persistence to track participant changes

## Phase 3.5: Validation & Polish

- [ ] T017 [P] Run quickstart scenarios from `/specs/009-after-the-user/quickstart.md`
- [ ] T018 [P] Verify console logging matches expected format in quickstart guide
- [ ] T019 [P] Test all edge cases: rapid model switching, invalid models, missing topics
- [ ] T020 [P] Performance validation: topic creation < 100ms
- [ ] T021 Clean up any debugging console.log statements
- [ ] T022 Update CLAUDE.md with any new patterns discovered during implementation

## Dependencies

- Tests (T003-T007) before implementation (T008-T012)
- T008 (topic ID fix) blocks T009 (participant switching)
- T010 (welcome suppression) can run parallel with T008-T009
- Integration tasks (T013-T016) require core implementation complete
- Validation (T017-T022) requires all implementation complete

## Parallel Example
```
# Launch T003-T007 together (all different test files):
Task: "Contract test for ai:setDefaultModel IPC handler in /tests/integration/ai-setDefaultModel.test.js"
Task: "Integration test for topic creation with hardcoded IDs in /tests/integration/topic-creation.test.js"
Task: "Integration test for participant switching in /tests/integration/participant-switching.test.js"
Task: "Integration test for welcome messages in /tests/integration/welcome-messages.test.js"
Task: "Integration test for duplicate prevention in /tests/integration/duplicate-prevention.test.js"
```

## Notes

- [P] tasks = different files, no dependencies
- Focus on existing `/main/ipc/handlers/ai.js` - modify, don't recreate
- All tests must verify TDD approach (fail first, then pass after implementation)
- Follow LAMA's IPC-first architecture: Node.js backend, React frontend via IPC
- Preserve existing conversation data when switching participants
- Error handling: fail fast, no fallbacks per LAMA constitution

## Task Generation Rules Applied

1. **From Contracts**: ai-setDefaultModel.json → T003 contract test
2. **From Data Model**: AI Topic Configuration entities → T004 topic creation tests
3. **From Research**: Participant switching requirement → T005, T009
4. **From Quickstart**: All test scenarios → T017 validation
5. **Ordering**: Setup → Tests → Core → Integration → Validation
6. **TDD**: All tests (T003-T007) before any implementation (T008-T012)

## Validation Checklist

- [x] ai-setDefaultModel contract has corresponding test (T003)
- [x] All functional requirements covered by tests (T003-T007)
- [x] All tests come before implementation (T008-T012)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task