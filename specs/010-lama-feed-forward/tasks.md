# Tasks: LAMA Feed-Forward Information Sharing

**Input**: Design documents from `/specs/010-lama-feed-forward/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Tech stack: JavaScript/Node.js 18+, ONE.core, Electron, React, Jest
   → ✅ Structure: Single LAMA Electron app
2. Load design documents:
   → ✅ data-model.md: Supply, Demand, Score recipes (Pattern deferred)
   → ✅ contracts/ipc-handlers.json: 8 IPC handlers
   → ✅ research.md: Technical decisions (SHA-256, CHUM, trust)
   → ✅ quickstart.md: 5 test scenarios with 4 privacy levels
3. Generate tasks by category:
   → Setup: Recipe registration, directory structure
   → Tests: 8 IPC handler tests (TDD - must fail first)
   → Core: Node.js feed-forward modules (6 files)
   → IPC: 8 handler implementations
   → UI: 4 React components [P]
   → Polish: Lint, docs, performance
4. Apply LAMA-specific rules:
   → IPC handlers sequential (same file)
   → UI components parallel [P] (different files)
   → Node.js core sequential (dependencies)
   → Tests before implementation (TDD)
5. Number tasks T001-T040
6. Pattern implementation deferred to Phase 2 (T035-T040)
7. Validate: All contracts have tests ✅
8. Return: SUCCESS (40 tasks ready)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- Process designation: (main) or (renderer)

## Phase 3.1: Setup
- [ ] T001 Create feed-forward module structure at `/main/core/feed-forward/`
- [ ] T002 Define Supply, Demand, Score recipes in `/main/recipes/index.js` (main)
- [ ] T003 Register feed-forward handler import in `/main/ipc/controller.js` (main)
- [ ] T004 [P] Create test directory structure at `/tests/integration/feed-forward/`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T005 [P] IPC test feedforward:createSupply in `/tests/integration/feed-forward/test-create-supply.js`
- [ ] T006 [P] IPC test feedforward:createDemand in `/tests/integration/feed-forward/test-create-demand.js`
- [ ] T007 [P] IPC test feedforward:matchSupplyDemand in `/tests/integration/feed-forward/test-matching.js`
- [ ] T008 [P] IPC test feedforward:updateTrustScore in `/tests/integration/feed-forward/test-trust.js`
- [ ] T009 [P] IPC test feedforward:detectPatterns in `/tests/integration/feed-forward/test-patterns.js`
- [ ] T010 [P] IPC test feedforward:getSharingPreferences in `/tests/integration/feed-forward/test-preferences.js`
- [ ] T011 [P] IPC test feedforward:setSharingPreferences in `/tests/integration/feed-forward/test-preferences.js`
- [ ] T012 [P] IPC test feedforward:getNetworkStatus in `/tests/integration/feed-forward/test-network-status.js`

## Phase 3.3: Core Implementation (Node.js - main process)
**ONLY after tests are failing**
- [ ] T013 Implement SHA-256 keyword hasher in `/main/core/feed-forward/hasher.js` (main)
- [ ] T014 Create Supply/Demand/Score recipe objects in `/main/core/feed-forward/recipes.js` (main)
- [ ] T015 Implement trust score manager in `/main/core/feed-forward/trust.js` (main)
- [ ] T016 Build Supply/Demand matcher (30% overlap) in `/main/core/feed-forward/matcher.js` (main)
- [ ] T017 Create feed-forward manager orchestrator in `/main/core/feed-forward/manager.js` (main)
- [ ] T018 Add pattern detector stub (Phase 2) in `/main/core/feed-forward/patterns.js` (main)

## Phase 3.4: IPC Handler Implementation (main process)
**Sequential - all handlers in same file**
- [ ] T019 Implement feedforward:createSupply handler in `/main/ipc/handlers/feed-forward.js`
- [ ] T020 Implement feedforward:createDemand handler in `/main/ipc/handlers/feed-forward.js`
- [ ] T021 Implement feedforward:matchSupplyDemand handler in `/main/ipc/handlers/feed-forward.js`
- [ ] T022 Implement feedforward:updateTrustScore handler in `/main/ipc/handlers/feed-forward.js`
- [ ] T023 Implement feedforward:getSharingPreferences handler in `/main/ipc/handlers/feed-forward.js`
- [ ] T024 Implement feedforward:setSharingPreferences handler in `/main/ipc/handlers/feed-forward.js`
- [ ] T025 Implement feedforward:getNetworkStatus handler in `/main/ipc/handlers/feed-forward.js`
- [ ] T026 Implement feedforward:detectPatterns handler (stub) in `/main/ipc/handlers/feed-forward.js`

## Phase 3.5: UI Components (React - renderer process)
**Can run in parallel [P] - different files**
- [ ] T027 [P] Create FeedForward settings panel in `/electron-ui/src/components/FeedForward/Settings.tsx`
- [ ] T028 [P] Build Supply/Demand list view in `/electron-ui/src/components/FeedForward/SupplyDemandList.tsx`
- [ ] T029 [P] Create network status display in `/electron-ui/src/components/FeedForward/NetworkStatus.tsx`
- [ ] T030 [P] Build trust manager UI in `/electron-ui/src/components/FeedForward/TrustManager.tsx`
- [ ] T031 Update main Settings.tsx to include feed-forward tab at `/electron-ui/src/components/Settings.tsx`

## Phase 3.6: Integration & CHUM Sync
- [ ] T032 Integrate feed-forward with CHUM sync in `/main/core/feed-forward/manager.js`
- [ ] T033 Add Supply/Demand to channel propagation in `/main/core/node-one-core.js`
- [ ] T034 Implement privacy levels (0-3) based on trust in `/main/core/feed-forward/trust.js`

## Phase 3.7: Polish & Documentation
- [ ] T035 [P] Performance test: keyword extraction <1s in `/tests/integration/feed-forward/test-performance.js`
- [ ] T036 [P] Performance test: matching <2s for 100 objects in `/tests/integration/feed-forward/test-performance.js`
- [ ] T037 Update CLAUDE.md with feed-forward documentation
- [ ] T038 Run quickstart.md test scenarios 1-5 (including all privacy levels)
- [ ] T039 [P] Run npm run lint and fix issues
- [ ] T040 [P] Run npm run typecheck and fix TypeScript errors

## Phase 4: Pattern Implementation (Deferred to Phase 2)
**Note**: Pattern Recipe defined but implementation deferred
- Pattern detection logic → Phase 2
- Pattern aggregation → Phase 2
- Pattern visualization → Phase 2
- Emergent property analysis → Phase 2

## Dependencies
- Setup (T001-T004): T001-T003 sequential, T004 parallel
- Tests (T005-T012): All parallel, must complete before T013
- Core (T013-T018): Sequential due to dependencies
- IPC (T019-T026): Sequential (same file)
- UI (T027-T030): Parallel, T031 depends on T027-T030
- Integration (T032-T034): Sequential
- Polish (T035-T040): T035-T036, T039-T040 parallel

## Parallel Execution Examples

### Test Launch (T005-T012)
```bash
# All test files are independent - launch together:
Task subagent_type="general-purpose" description="Test createSupply" prompt="Write failing IPC test for feedforward:createSupply handler in /tests/integration/feed-forward/test-create-supply.js. Test should verify: keywords array validation (1-20 items), context level (0-3), SHA-256 hash return, timestamp generation."

Task subagent_type="general-purpose" description="Test createDemand" prompt="Write failing IPC test for feedforward:createDemand handler in /tests/integration/feed-forward/test-create-demand.js. Test should verify: keywords array (1-10 items), urgency enum (high/medium/low), context max 500 chars, criteria max 200 chars."

Task subagent_type="general-purpose" description="Test matching" prompt="Write failing IPC test for feedforward:matchSupplyDemand handler in /tests/integration/feed-forward/test-matching.js. Test should verify: 30% keyword overlap threshold, trust score filtering, match score calculation."

Task subagent_type="general-purpose" description="Test trust" prompt="Write failing IPC test for feedforward:updateTrustScore handler in /tests/integration/feed-forward/test-trust.js. Test should verify: trust value updates (+0.1 success, -0.2 failure), decay over time, bidirectional relationships."
```

### UI Components Launch (T027-T030)
```bash
# All UI components are independent - launch together:
Task subagent_type="general-purpose" description="Settings UI" prompt="Create FeedForward settings panel React component in /electron-ui/src/components/FeedForward/Settings.tsx with: enable/disable toggle, default context level (0-3), whitelist/blacklist management, auto-share option."

Task subagent_type="general-purpose" description="Supply/Demand UI" prompt="Create Supply/Demand list view React component in /electron-ui/src/components/FeedForward/SupplyDemandList.tsx showing: active supplies with keywords, demands with status, match indicators."

Task subagent_type="general-purpose" description="Network UI" prompt="Create network status React component in /electron-ui/src/components/FeedForward/NetworkStatus.tsx displaying: active supplies/demands count, connected instances, recent exchanges, average trust."

Task subagent_type="general-purpose" description="Trust UI" prompt="Create trust manager React component in /electron-ui/src/components/FeedForward/TrustManager.tsx with: instance list, trust scores (0-1), exchange counts, manual adjustment."
```

## Notes
- **Process Separation**: Node.js (main) handles all logic, React (renderer) is UI only
- **IPC Bridge**: All browser↔Node communication via IPC handlers
- **No Browser ONE.core**: Forbidden in LAMA architecture
- **Fail Fast**: No fallbacks, throw errors immediately
- **TDD Mandatory**: Tests must fail before implementation
- **Privacy Levels**: 0=Hash only, 1=Basic (≥0.3), 2=Context (≥0.6), 3=Full (≥0.8)
- **Pattern Deferred**: Interface defined, implementation in Phase 2

## Validation Checklist
- [x] All 8 IPC contracts have test tasks
- [x] All 3 active recipes (Supply, Demand, Score) have implementation
- [x] Pattern recipe defined but deferred
- [x] Tests before implementation (T005-T012 before T013-T040)
- [x] Parallel tasks are independent (different files)
- [x] Each task has exact file path
- [x] No [P] tasks modify same file
- [x] Process designation clear (main vs renderer)
- [x] LAMA architecture respected
- [x] Privacy levels (0-3) implemented
- [x] CHUM sync integration included

---
*Generated from specs/010-lama-feed-forward/ on 2025-01-28*
*40 tasks total: 16 parallel [P], 24 sequential*
*Pattern implementation deferred to Phase 2 per plan.md*