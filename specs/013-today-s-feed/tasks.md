# Tasks: Feed-Forward Training Infrastructure

**Input**: Design documents from `/specs/013-today-s-feed/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript 5.7.2, Node.js 18+, @refinio/one.core
   → Libraries: FeedForwardManager, TrustCalculator, CorpusGenerator
2. Load design documents: ✓
   → data-model.md: 5 entities (Supply, Demand, Match, TrustScore, CorpusEntry)
   → contracts/: 2 files (IPC and external API)
   → research.md: Reuse existing components
   → quickstart.md: Test scenarios
3. Generate tasks by category:
   → Setup: Recipe definitions (5 tasks)
   → Tests: Contract tests for all IPC endpoints (7 tasks)
   → Core: Manager and service implementations (15 tasks)
   → Integration: IPC handlers and connections (8 tasks)
   → UI: Browser components (5 tasks)
   → Polish: Integration tests and validation (6 tasks)
4. Apply LAMA-specific rules:
   → IPC handlers in main process (sequential)
   → UI components in renderer (parallel [P])
   → Tests before implementation (TDD)
5. Number tasks T001-T046
6. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- Process designation: (main) or (renderer)

## LAMA Architecture Note
- **Main process**: Node.js with ONE.core - ALL business logic
- **Renderer process**: React UI - NO ONE.core, IPC only
- **IPC Bridge**: All data operations via window.electronAPI.invoke()

## Phase 3.1: Setup & Recipes
- [ ] T001 [P] Define Supply recipe in /main/recipes/feed-forward-recipes.ts
- [ ] T002 [P] Define Demand recipe in /main/recipes/feed-forward-recipes.ts
- [ ] T003 [P] Define SupplyDemandMatch recipe in /main/recipes/feed-forward-recipes.ts
- [ ] T004 [P] Define TrustScore recipe in /main/recipes/feed-forward-recipes.ts
- [ ] T005 [P] Define TrainingCorpusEntry recipe in /main/recipes/feed-forward-recipes.ts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T006 [P] Contract test feedForward:createSupply in /tests/contract/feed-forward-create-supply.test.ts
- [ ] T007 [P] Contract test feedForward:createDemand in /tests/contract/feed-forward-create-demand.test.ts
- [ ] T008 [P] Contract test feedForward:matchSupplyDemand in /tests/contract/feed-forward-match.test.ts
- [ ] T009 [P] Contract test feedForward:updateTrust in /tests/contract/feed-forward-trust.test.ts
- [ ] T010 [P] Contract test feedForward:getCorpusStream in /tests/contract/feed-forward-corpus.test.ts
- [ ] T011 [P] Contract test feedForward:enableSharing in /tests/contract/feed-forward-sharing.test.ts
- [ ] T012 [P] Contract test feedForward:getTrustScore in /tests/contract/feed-forward-get-trust.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T013 Create FeedForwardManager class in /main/core/feed-forward/manager.ts
- [ ] T014 Implement Supply object creation in /main/core/feed-forward/supply-demand.ts
- [ ] T015 Implement Demand object creation in /main/core/feed-forward/supply-demand.ts
- [ ] T016 Implement keyword hashing utility in /main/core/feed-forward/supply-demand.ts
- [ ] T017 Implement Supply-Demand matching algorithm in /main/core/feed-forward/manager.ts
- [ ] T018 Create TrustCalculator class in /main/core/feed-forward/trust-calculator.ts
- [ ] T019 Implement 5-component trust score calculation in /main/core/feed-forward/trust-calculator.ts
- [ ] T020 Create CorpusGenerator class in /main/core/feed-forward/corpus-generator.ts
- [ ] T021 Implement message sanitization in /main/core/feed-forward/corpus-generator.ts
- [ ] T022 Implement privacy controls in /main/core/feed-forward/corpus-generator.ts
- [ ] T023 Add sharing settings to Topic objects in /main/core/feed-forward/manager.ts
- [ ] T024 Implement trust score caching with TTL in /main/core/feed-forward/trust-calculator.ts
- [ ] T025 Implement Supply/Demand storage with ONE.core in /main/core/feed-forward/supply-demand.ts
- [ ] T026 Implement corpus entry generation in /main/core/feed-forward/corpus-generator.ts
- [ ] T027 Add recursive Supply/Demand support in /main/core/feed-forward/supply-demand.ts

## Phase 3.4: Integration & IPC
- [ ] T028 Connect to existing keyword extractor in /main/core/feed-forward/manager.ts
- [ ] T029 Integrate with ContactTrustManager in /main/core/feed-forward/trust-calculator.ts
- [ ] T030 Hook into message creation flow in /main/core/feed-forward/manager.ts
- [ ] T031 Implement IPC handler feedForward:createSupply in /main/ipc/handlers/feed-forward.ts
- [ ] T032 Implement IPC handler feedForward:createDemand in /main/ipc/handlers/feed-forward.ts
- [ ] T033 Implement IPC handler feedForward:matchSupplyDemand in /main/ipc/handlers/feed-forward.ts
- [ ] T034 Implement IPC handler feedForward:updateTrust in /main/ipc/handlers/feed-forward.ts
- [ ] T035 Implement IPC handler feedForward:getCorpusStream in /main/ipc/handlers/feed-forward.ts
- [ ] T036 Implement IPC handler feedForward:enableSharing in /main/ipc/handlers/feed-forward.ts
- [ ] T037 Implement IPC handler feedForward:getTrustScore in /main/ipc/handlers/feed-forward.ts
- [ ] T038 Register all feed-forward IPC handlers in /main/ipc/controller.ts

## Phase 3.5: UI Components (Renderer Process)
- [ ] T039 [P] Add sharing toggle to conversation UI in /electron-ui/src/components/chat/ConversationSettings.tsx
- [ ] T040 [P] Display trust scores in /electron-ui/src/components/chat/TrustIndicator.tsx
- [ ] T041 [P] Show Supply/Demand counts in /electron-ui/src/components/feed-forward/SupplyDemandStatus.tsx
- [ ] T042 [P] Add corpus statistics view in /electron-ui/src/components/feed-forward/CorpusStats.tsx
- [ ] T043 [P] Create API key management UI in /electron-ui/src/components/Settings/ApiKeySettings.tsx

## Phase 3.6: Polish & Integration Tests
- [ ] T044 Integration test Supply/Demand flow in /tests/integration/feed-forward/supply-demand.test.ts
- [ ] T045 Integration test trust calculation in /tests/integration/feed-forward/trust-scoring.test.ts
- [ ] T046 Integration test corpus generation in /tests/integration/feed-forward/corpus-generation.test.ts
- [ ] T047 Performance test matching algorithm (<500ms) in /tests/performance/feed-forward-matching.test.ts
- [ ] T048 Load test keyword extraction (100/sec) in /tests/performance/keyword-extraction.test.ts
- [ ] T049 Run quickstart.md scenarios for validation

## Dependencies
- Recipes (T001-T005) independent, can run in parallel
- Contract tests (T006-T012) must complete before implementation
- Core implementation (T013-T027) mostly sequential within manager
- T013 (FeedForwardManager) blocks most other core tasks
- T028-T030 (integration) requires core complete
- IPC handlers (T031-T038) require core implementation
- UI components (T039-T043) independent, can run after IPC ready
- Integration tests (T044-T049) require all implementation complete

## Parallel Execution Examples

### Example 1: Launch all recipe definitions
```
# Can run T001-T005 together (all in same file but different exports):
Task: "Define Supply recipe"
Task: "Define Demand recipe"
Task: "Define SupplyDemandMatch recipe"
Task: "Define TrustScore recipe"
Task: "Define TrainingCorpusEntry recipe"
```

### Example 2: Launch all contract tests
```
# Can run T006-T012 together (different test files):
Task: "Contract test feedForward:createSupply"
Task: "Contract test feedForward:createDemand"
Task: "Contract test feedForward:matchSupplyDemand"
Task: "Contract test feedForward:updateTrust"
Task: "Contract test feedForward:getCorpusStream"
Task: "Contract test feedForward:enableSharing"
Task: "Contract test feedForward:getTrustScore"
```

### Example 3: Launch UI components
```
# Can run T039-T043 together (different React components):
Task: "Add sharing toggle to conversation UI"
Task: "Display trust scores"
Task: "Show Supply/Demand counts"
Task: "Add corpus statistics view"
Task: "Create API key management UI"
```

## Notes
- [P] tasks = different files or independent components
- Tests MUST fail before implementing (RED-GREEN-Refactor)
- Commit after each task with descriptive message
- Main process handles all ONE.core operations
- Renderer process is UI only, uses IPC for data
- Avoid: Direct ONE.core imports in renderer

## Task Generation Rules
*Applied during main() execution*

1. **From IPC Contract**:
   - 6 IPC endpoints → 6 contract tests [P]
   - 6 IPC endpoints → 6 handler implementations
   - Added getTrustScore endpoint (discovered in quickstart)

2. **From Data Model**:
   - 5 entities → 5 recipe definitions [P]
   - Supply/Demand → storage implementation
   - TrustScore → calculator implementation
   - CorpusEntry → generator implementation

3. **From Quickstart Scenarios**:
   - 5 scenarios → integration tests
   - Performance requirements → load tests

4. **Ordering**:
   - Recipes → Contract Tests → Core → IPC → UI → Integration Tests
   - TDD enforced: tests before implementation

## Validation Checklist
*GATE: Checked before execution*

- [x] All IPC endpoints have contract tests
- [x] All entities have recipe definitions
- [x] All tests come before implementation (T006-T012 before T013-T038)
- [x] Parallel tasks truly independent
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Main/renderer process separation maintained
- [x] No ONE.core imports in UI tasks

## Estimated Completion Time
- Setup & Recipes: 2 hours
- Contract Tests: 3 hours
- Core Implementation: 8 hours
- Integration & IPC: 4 hours
- UI Components: 3 hours
- Polish & Tests: 4 hours
- **Total**: ~24 hours of focused development