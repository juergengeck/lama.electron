# Tasks: Topic-Subject-Summary Data Model with AI Integration

**Input**: Design documents from `/specs/005-we-must-change/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- **Process**: (main) = Node.js main process, (renderer) = Browser UI

## Path Conventions
- **Node.js (main)**: `/main/core/`, `/main/ipc/handlers/`, `/main/services/`
- **Browser (renderer)**: `/electron-ui/src/components/`, `/electron-ui/src/services/`
- **Tests**: `/tests/integration/`, `/tests/unit/`

## Phase 3.1: Setup
- [ ] T001 Create one.ai package structure in /main/core/one-ai/
- [ ] T002 Register new IPC handlers in /main/ipc/controller.js
- [ ] T003 [P] Add topic analysis types to /electron-ui/src/types/topic-analysis.ts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### IPC Handler Tests (main process)
- [ ] T004 [P] Contract test topicAnalysis:analyzeMessages in /tests/integration/topic-analysis/test-analyze-messages.js
- [ ] T005 [P] Contract test topicAnalysis:getSubjects in /tests/integration/topic-analysis/test-get-subjects.js
- [ ] T006 [P] Contract test topicAnalysis:getSummary in /tests/integration/topic-analysis/test-get-summary.js
- [ ] T007 [P] Contract test topicAnalysis:updateSummary in /tests/integration/topic-analysis/test-update-summary.js
- [ ] T008 [P] Contract test topicAnalysis:extractKeywords in /tests/integration/topic-analysis/test-extract-keywords.js
- [ ] T009 [P] Contract test topicAnalysis:mergeSubjects in /tests/integration/topic-analysis/test-merge-subjects.js

### Integration Tests
- [ ] T010 [P] Integration test multi-subject conversation analysis in /tests/integration/topic-analysis/test-multi-subject.js
- [ ] T011 [P] Integration test summary versioning in /tests/integration/topic-analysis/test-summary-versions.js
- [ ] T012 [P] Integration test keyword extraction accuracy in /tests/integration/topic-analysis/test-keyword-extraction.js

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### ONE.core Models (main process)
- [ ] T013 [P] Subject model in /main/core/one-ai/models/Subject.js
- [ ] T014 [P] Keyword model in /main/core/one-ai/models/Keyword.js
- [ ] T015 [P] Summary model in /main/core/one-ai/models/Summary.js

### Services (main process)
- [ ] T016 TopicAnalyzer service in /main/core/one-ai/services/TopicAnalyzer.js
- [ ] T017 Integrate TopicAnalyzer with LLMManager in /main/core/one-ai/services/TopicAnalyzer.js
- [ ] T018 Implement keyword extraction logic in /main/core/one-ai/services/TopicAnalyzer.js
- [ ] T019 Implement subject identification logic in /main/core/one-ai/services/TopicAnalyzer.js
- [ ] T020 Implement summary generation logic in /main/core/one-ai/services/TopicAnalyzer.js

### IPC Handlers (main process)
- [ ] T021 Implement topicAnalysis:analyzeMessages in /main/ipc/handlers/topic-analysis.js
- [ ] T022 Implement topicAnalysis:getSubjects in /main/ipc/handlers/topic-analysis.js
- [ ] T023 Implement topicAnalysis:getSummary in /main/ipc/handlers/topic-analysis.js
- [ ] T024 Implement topicAnalysis:updateSummary in /main/ipc/handlers/topic-analysis.js
- [ ] T025 Implement topicAnalysis:extractKeywords in /main/ipc/handlers/topic-analysis.js
- [ ] T026 Implement topicAnalysis:mergeSubjects in /main/ipc/handlers/topic-analysis.js

## Phase 3.4: UI Components (renderer process)

### React Components
- [ ] T027 [P] TopicSummary component in /electron-ui/src/components/TopicSummary/TopicSummary.tsx
- [ ] T028 [P] SubjectList component in /electron-ui/src/components/TopicSummary/SubjectList.tsx
- [ ] T029 [P] KeywordCloud component in /electron-ui/src/components/TopicSummary/KeywordCloud.tsx
- [ ] T030 [P] SummaryHistory component in /electron-ui/src/components/TopicSummary/SummaryHistory.tsx

### UI Integration
- [ ] T031 Add topic analysis IPC calls to /electron-ui/src/services/topic-analysis-service.ts
- [ ] T032 Integrate TopicSummary into conversation view in /electron-ui/src/components/Conversation/ConversationView.tsx
- [ ] T033 Add summary trigger button to conversation UI in /electron-ui/src/components/Conversation/ConversationActions.tsx

## Phase 3.5: Integration & Storage

### ONE.core Storage
- [ ] T034 Implement Subject storage methods in /main/core/one-ai/storage/subject-storage.js
- [ ] T035 Implement Summary versioning storage in /main/core/one-ai/storage/summary-storage.js
- [ ] T036 Implement Keyword indexing in /main/core/one-ai/storage/keyword-storage.js

### Performance & Optimization
- [ ] T037 Add caching for keyword extraction in /main/core/one-ai/services/TopicAnalyzer.js
- [ ] T038 Implement batch message processing in /main/core/one-ai/services/TopicAnalyzer.js
- [ ] T039 Add summary pruning (30-day retention) in /main/core/one-ai/storage/summary-storage.js

## Phase 3.6: Polish

### Unit Tests
- [ ] T040 [P] Unit tests for Subject model in /tests/unit/one-ai/test-subject.js
- [ ] T041 [P] Unit tests for Keyword model in /tests/unit/one-ai/test-keyword.js
- [ ] T042 [P] Unit tests for Summary model in /tests/unit/one-ai/test-summary.js

### Performance & Documentation
- [ ] T043 Performance test: <500ms keyword extraction in /tests/performance/test-keyword-perf.js
- [ ] T044 Performance test: <2s summary generation in /tests/performance/test-summary-perf.js
- [ ] T045 [P] Update CLAUDE.md with implementation details
- [ ] T046 Run quickstart.md validation scenarios
- [ ] T047 Lint and typecheck all new files

## Dependencies
- Setup (T001-T003) must complete first
- Tests (T004-T012) before ALL implementation
- Models (T013-T015) before services (T016-T020)
- Services before IPC handlers (T021-T026)
- IPC handlers before UI integration (T031-T033)
- Core implementation before storage (T034-T036)
- Everything before polish (T040-T047)

## Parallel Example
```bash
# Launch T004-T009 together (IPC contract tests):
Task: "Contract test topicAnalysis:analyzeMessages in /tests/integration/topic-analysis/test-analyze-messages.js"
Task: "Contract test topicAnalysis:getSubjects in /tests/integration/topic-analysis/test-get-subjects.js"
Task: "Contract test topicAnalysis:getSummary in /tests/integration/topic-analysis/test-get-summary.js"
Task: "Contract test topicAnalysis:updateSummary in /tests/integration/topic-analysis/test-update-summary.js"
Task: "Contract test topicAnalysis:extractKeywords in /tests/integration/topic-analysis/test-extract-keywords.js"
Task: "Contract test topicAnalysis:mergeSubjects in /tests/integration/topic-analysis/test-merge-subjects.js"

# Launch T013-T015 together (ONE.core models):
Task: "Subject model in /main/core/one-ai/models/Subject.js"
Task: "Keyword model in /main/core/one-ai/models/Keyword.js"
Task: "Summary model in /main/core/one-ai/models/Summary.js"

# Launch T027-T030 together (UI components):
Task: "TopicSummary component in /electron-ui/src/components/TopicSummary/TopicSummary.tsx"
Task: "SubjectList component in /electron-ui/src/components/TopicSummary/SubjectList.tsx"
Task: "KeywordCloud component in /electron-ui/src/components/TopicSummary/KeywordCloud.tsx"
Task: "SummaryHistory component in /electron-ui/src/components/TopicSummary/SummaryHistory.tsx"
```

## Notes
- [P] tasks = different files, can run in parallel
- (main) = Node.js main process tasks
- (renderer) = Browser UI tasks (NO ONE.core!)
- ALL data operations through IPC
- Tests MUST fail before implementation
- Commit after each task
- NO browser-side ONE.core operations

## LAMA-Specific Constraints
- **IPC-First**: All browser-Node communication via electronAPI.invoke()
- **Single ONE.core**: Only in Node.js main process
- **Fail Fast**: No retries, no fallbacks - fix root causes
- **TDD**: Tests written and failing before implementation
- **Process Separation**: Browser = UI only, Node = all logic

## Validation Checklist
*GATE: Checked before execution*

- [x] All IPC contracts have corresponding tests (T004-T009)
- [x] All entities have model tasks (T013-T015)
- [x] All tests come before implementation
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Browser tasks are UI-only (no ONE.core)
- [x] All ONE.core operations in Node.js tasks

---
**Total Tasks**: 47
**Parallel Groups**: 6 (tests, models, UI components)
**Estimated Duration**: 2-3 days with parallel execution