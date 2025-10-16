# Tasks: Context-Aware Knowledge Sharing Proposals

**Input**: Design documents from `/Users/gecko/src/lama.electron/specs/019-above-the-chat/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/ipc-proposals.json, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Tech Stack: TypeScript 5.x, React 18, react-swipeable
   → Architecture: Electron split (main/electron-ui)
2. Load design documents:
   → data-model.md: Proposal, ProposalConfig, DismissedProposal
   → contracts/ipc-proposals.json: 5 IPC handlers
   → research.md: Jaccard similarity, LRU cache
   → quickstart.md: 7 test scenarios
3. Generate tasks by category:
   → Setup: Dependencies, recipes
   → Tests: IPC contract tests, integration tests (TDD)
   → Core: ProposalEngine, ProposalRanker (Node.js)
   → IPC: Handler implementation
   → UI: React components (browser)
   → Polish: Lint, typecheck, validation
4. Apply LAMA-specific rules:
   → IPC handlers in main process (sequential)
   → UI components in renderer (parallel [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T022)
6. Generate parallel execution examples
7. SUCCESS - Ready for execution
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **main**: Node.js main process (`/main/`)
- **renderer**: Browser renderer process (`/electron-ui/`)

## Path Conventions (LAMA Electron)
- **Main process**: `/Users/gecko/src/lama.electron/main/`
- **Renderer process**: `/Users/gecko/src/lama.electron/electron-ui/src/`
- **Tests**: `/Users/gecko/src/lama.electron/tests/integration/proposals/`
- **Specs**: `/Users/gecko/src/lama.electron/specs/019-above-the-chat/`

---

## Phase 3.1: Setup

- [ ] **T001** Install react-swipeable dependency in electron-ui/package.json
  - Process: renderer
  - Command: `cd electron-ui && npm install react-swipeable`
  - Why: Swipe gesture library for proposal navigation (research.md decision)

- [ ] **T002** Create ProposalConfig recipe in main/recipes/proposal-recipes.js
  - Process: main
  - Define ProposalConfig recipe with userEmail as ID property
  - Fields: matchWeight, recencyWeight, recencyWindow, minJaccard, maxProposals, updated
  - Reference: data-model.md lines 38-79

- [ ] **T003** Register ProposalConfig recipe in main/core/node-one-core.js
  - Process: main
  - Import and register ProposalConfigRecipe during ONE.core initialization
  - Add to recipes array passed to registerRecipes()

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [ ] **T004** [P] Contract test proposals:getForTopic in tests/integration/proposals/test-proposals-ipc-contract.js
  - Process: main (test)
  - Validate request schema: topicId (required), currentSubjects (optional), forceRefresh (optional)
  - Validate response schema: proposals array, count, cached, computeTimeMs
  - Validate error codes: TOPIC_NOT_FOUND, NO_SUBJECTS, COMPUTATION_ERROR
  - Reference: contracts/ipc-proposals.json lines 7-100

- [ ] **T005** [P] Contract test proposals:updateConfig in tests/integration/proposals/test-proposals-config-contract.js
  - Process: main (test)
  - Validate request schema: config object with partial ProposalConfig
  - Validate response schema: success, config, versionHash
  - Validate error codes: INVALID_CONFIG, STORAGE_ERROR
  - Reference: contracts/ipc-proposals.json lines 102-166

- [ ] **T006** [P] Contract test proposals:getConfig in tests/integration/proposals/test-proposals-config-contract.js
  - Process: main (test)
  - Validate response schema: config, isDefault
  - Validate error code: USER_NOT_AUTHENTICATED
  - Reference: contracts/ipc-proposals.json lines 167-208

- [ ] **T007** [P] Contract test proposals:dismiss in tests/integration/proposals/test-proposals-dismiss-contract.js
  - Process: main (test)
  - Validate request schema: proposalId, topicId, pastSubjectIdHash
  - Validate response schema: success, remainingCount
  - Validate error code: PROPOSAL_NOT_FOUND
  - Reference: contracts/ipc-proposals.json lines 209-262

- [ ] **T008** [P] Contract test proposals:share in tests/integration/proposals/test-proposals-share-contract.js
  - Process: main (test)
  - Validate request schema: proposalId, topicId, pastSubjectIdHash, includeMessages
  - Validate response schema: success, sharedContent
  - Validate error codes: SHARE_FAILED, SUBJECT_NOT_FOUND
  - Reference: contracts/ipc-proposals.json lines 263-344

- [ ] **T009** [P] Integration test proposal matching in tests/integration/proposals/test-proposal-matching.js
  - Process: main (test)
  - Test Scenario 1: Display single most relevant proposal (quickstart.md)
  - Create current topic with subjects, verify proposal generated
  - Verify matched keywords are correct
  - Verify no proposals when no keyword matches
  - Reference: quickstart.md lines 15-47

- [ ] **T010** [P] Integration test proposal ranking in tests/integration/proposals/test-proposal-ranking.js
  - Process: main (test)
  - Test Scenario 2: Swipe through multiple proposals (quickstart.md)
  - Create multiple past subjects with varying relevance
  - Verify proposals ordered by relevanceScore descending
  - Verify Jaccard similarity calculation
  - Verify recency boost calculation
  - Reference: quickstart.md lines 49-77, research.md lines 59-72

- [ ] **T011** [P] Integration test proposal sharing in tests/integration/proposals/test-proposal-share.js
  - Process: main (test)
  - Test Scenario 4: Share proposal into conversation (quickstart.md)
  - Verify proposal content shared correctly
  - Verify proposal marked as dismissed after share
  - Reference: quickstart.md lines 79-107

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [ ] **T012** [P] ProposalEngine service in main/services/proposal-engine.js
  - Process: main
  - Implement getProposalsForTopic(topicId, currentSubjects, config)
  - Query past subjects from ONE.core (via Feature 018 storage)
  - Calculate Jaccard similarity for each past subject
  - Calculate recency boost using config.recencyWindow
  - Filter by config.minJaccard threshold
  - Return matched keywords for each proposal
  - Reference: data-model.md lines 146-190, research.md lines 59-72

- [ ] **T013** [P] ProposalRanker service in main/services/proposal-ranker.js
  - Process: main
  - Implement rankProposals(proposals, config)
  - Calculate relevanceScore: jaccard * matchWeight + recency * recencyWeight
  - Sort proposals by relevanceScore descending
  - Limit to config.maxProposals
  - Reference: data-model.md lines 146-176, research.md lines 60-72

- [ ] **T014** [P] ProposalCache class in main/services/proposal-cache.js
  - Process: main
  - Implement LRU cache with 50 entry max, 60s TTL
  - Cache key: `${topicId}:${currentSubjectIds.sort().join(',')}`
  - Implement get(topicId, currentSubjects)
  - Implement set(topicId, currentSubjects, proposals)
  - Implement invalidate(topicId)
  - Reference: research.md lines 88-157

- [ ] **T015** IPC handler proposals:getForTopic in main/ipc/handlers/proposals.js
  - Process: main
  - Check cache first (unless forceRefresh)
  - Get current subjects if not provided (via Feature 018)
  - Call ProposalEngine.getProposalsForTopic()
  - Call ProposalRanker.rankProposals()
  - Filter against dismissed proposals (session state)
  - Cache results
  - Return response with computeTimeMs
  - Reference: contracts/ipc-proposals.json lines 7-100

- [ ] **T016** IPC handler proposals:updateConfig in main/ipc/handlers/proposals.js
  - Process: main
  - Validate config parameters (weights 0.0-1.0, maxProposals 1-50)
  - Get current user email from session
  - Merge with existing config (partial update)
  - Create ProposalConfig object with $type$: 'ProposalConfig'
  - Store via storeVersionedObject() (ONE.core)
  - Invalidate proposal cache
  - Return versionHash
  - Reference: contracts/ipc-proposals.json lines 102-166, data-model.md lines 38-99

- [ ] **T017** IPC handler proposals:getConfig in main/ipc/handlers/proposals.js
  - Process: main
  - Get current user email from session
  - Calculate ID hash for ProposalConfig
  - Retrieve via getObjectByIdHash()
  - If not found, return default config
  - Set isDefault flag accordingly
  - Reference: contracts/ipc-proposals.json lines 167-208, data-model.md lines 81-93

- [ ] **T018** IPC handler proposals:dismiss in main/ipc/handlers/proposals.js
  - Process: main
  - Add to session-only dismissedProposals Set (in-memory)
  - Store: `${topicId}:${pastSubjectIdHash}`
  - Query remaining non-dismissed proposals
  - Return remainingCount
  - Reference: contracts/ipc-proposals.json lines 209-262, data-model.md lines 107-128

- [ ] **T019** IPC handler proposals:share in main/ipc/handlers/proposals.js
  - Process: main
  - Retrieve past subject by pastSubjectIdHash
  - Get subject name and keywords
  - Optionally retrieve sample messages if includeMessages=true
  - Format sharedContent object
  - Mark proposal as dismissed (call internal dismiss logic)
  - Return success with sharedContent
  - Reference: contracts/ipc-proposals.json lines 263-344

---

## Phase 3.4: UI Implementation (Renderer Process)

- [ ] **T020** [P] useProposals hook in electron-ui/src/hooks/useProposals.ts
  - Process: renderer
  - React hook to manage proposal state
  - Call window.electronAPI.invoke('proposals:getForTopic', ...)
  - Provide currentIndex, current proposal, next/prev functions
  - Auto-refresh when current subjects change
  - Reference: plan.md line 133

- [ ] **T021** [P] ProposalCard component in electron-ui/src/components/ProposalCard.tsx
  - Process: renderer
  - Display single proposal with pastSubjectName
  - Highlight matchedKeywords
  - Show relevanceScore (optional, for debugging)
  - Click handler to trigger proposals:share
  - Dismiss button (X) to trigger proposals:dismiss
  - Reference: plan.md line 127

- [ ] **T022** [P] ProposalCarousel component in electron-ui/src/components/ProposalCarousel.tsx
  - Process: renderer
  - Use react-swipeable for horizontal swipe gestures
  - trackMouse: true (desktop mouse drag support)
  - onSwipedLeft: next proposal
  - onSwipedRight: previous proposal
  - Render current ProposalCard
  - Reference: plan.md line 128, research.md lines 32-45

- [ ] **T023** [P] Integrate ProposalCarousel into ChatView in electron-ui/src/components/ChatView.tsx
  - Process: renderer
  - Position above chat entry field
  - Pass current topicId to useProposals hook
  - Only render when proposals exist
  - Handle share action (insert content into chat input)
  - Reference: plan.md line 129

---

## Phase 3.5: Polish

- [ ] **T024** [P] Performance validation in tests/integration/proposals/test-proposal-performance.js
  - Process: main (test)
  - Test Scenario 7: Performance targets (quickstart.md)
  - Create 50+ past subjects
  - Measure proposal generation time (<100ms)
  - Verify cache hit performance (<1ms)
  - Reference: quickstart.md lines 185-218

- [ ] **T025** [P] TypeScript type definitions in electron-ui/src/types/proposals.ts
  - Process: renderer
  - Define Proposal interface
  - Define ProposalConfig interface
  - Export types for UI components

- [ ] **T026** Run quickstart.md validation scenarios
  - Process: manual
  - Execute all 7 test scenarios from quickstart.md
  - Verify integration checklist items
  - Confirm performance targets met

---

## Dependencies

**Setup before Tests**:
- T001-T003 before T004-T011

**Tests before Implementation**:
- T004-T011 MUST be failing before T012-T019
- Cannot start T012 until ALL tests (T004-T011) exist and fail

**Node.js Core before IPC Handlers**:
- T012 (ProposalEngine) blocks T015
- T013 (ProposalRanker) blocks T015
- T014 (ProposalCache) blocks T015-T019

**IPC Handlers before UI**:
- T015-T019 before T020-T023
- T015 blocks T020 (useProposals needs getForTopic)

**UI Components Dependency Chain**:
- T020 (useProposals) blocks T023 (ChatView integration)
- T021, T022 independent of each other but both needed by T023

**Polish after Core**:
- T024-T026 after T012-T023

---

## Parallel Execution Examples

### Example 1: Contract Tests (Phase 3.2)
All contract tests can run in parallel since they test different IPC handlers:
```
Task: "Contract test proposals:getForTopic in tests/integration/proposals/test-proposals-ipc-contract.js"
Task: "Contract test proposals:updateConfig in tests/integration/proposals/test-proposals-config-contract.js"
Task: "Contract test proposals:getConfig in tests/integration/proposals/test-proposals-config-contract.js"
Task: "Contract test proposals:dismiss in tests/integration/proposals/test-proposals-dismiss-contract.js"
Task: "Contract test proposals:share in tests/integration/proposals/test-proposals-share-contract.js"
```

### Example 2: Core Services (Phase 3.3)
ProposalEngine, ProposalRanker, and ProposalCache are independent services:
```
Task: "ProposalEngine service in main/services/proposal-engine.js"
Task: "ProposalRanker service in main/services/proposal-ranker.js"
Task: "ProposalCache class in main/services/proposal-cache.js"
```

### Example 3: UI Components (Phase 3.4)
ProposalCard and ProposalCarousel can be built in parallel:
```
Task: "useProposals hook in electron-ui/src/hooks/useProposals.ts"
Task: "ProposalCard component in electron-ui/src/components/ProposalCard.tsx"
Task: "ProposalCarousel component in electron-ui/src/components/ProposalCarousel.tsx"
```
(Note: ChatView integration T023 must wait until all three complete)

---

## Notes

- **[P] tasks** = different files, no dependencies, can run in parallel
- **TDD required**: All tests (T004-T011) MUST fail before implementation
- **LAMA architecture**: Main process handles ALL logic, renderer is UI only
- **ONE.core storage**: ProposalConfig is versioned object, proposals are computed
- **Session state**: DismissedProposal in-memory only (not stored)
- **Feature 018 dependency**: Uses existing Subject and Keyword objects

---

## Validation Checklist

- [x] All 5 IPC contracts have corresponding tests (T004-T008)
- [x] All 3 entities (Proposal, ProposalConfig, DismissedProposal) have implementation tasks
- [x] All tests (T004-T011) come before implementation (T012-T019)
- [x] Parallel tasks [P] are truly independent (different files)
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task
- [x] Tests before implementation enforced (Phase 3.2 before 3.3)
- [x] LAMA-specific: IPC handlers sequential, UI components parallel
- [x] LAMA-specific: No browser-side ONE.core operations

---

## Task Count Summary

- Setup: 3 tasks (T001-T003)
- Tests: 8 tasks (T004-T011)
- Core: 8 tasks (T012-T019)
- UI: 4 tasks (T020-T023)
- Polish: 3 tasks (T024-T026)
- **Total: 26 tasks**

**Estimated Completion**: 18-22 hours (per plan.md estimate)
