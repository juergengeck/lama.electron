# Tasks: HTML Export with Microdata Markup

**Input**: Design documents from `/specs/008-we-now-successfully/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/export-html.yaml

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
   → Setup: IPC handler registration, service directories
   → Tests: IPC contract tests, integration tests
   → Core: Node.js services, IPC handlers
   → UI: React components (renderer process)
   → Polish: lint, typecheck, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All IPC handlers implemented?
   → All UI components created?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- **Process**: (main) = Node.js main process, (renderer) = Browser UI

## Path Conventions
- **Main process**: `/main/` - Node.js backend with ONE.core
- **Renderer process**: `/electron-ui/` - React UI components
- **Tests**: `/tests/` - Integration and unit tests
- **IPC handlers**: `/main/ipc/handlers/` - All IPC operations

## Phase 3.1: Setup
- [ ] T001 Create directory structure /main/services/html-export/ for export services
- [ ] T002 Register new IPC handler 'export:htmlWithMicrodata' in /main/ipc/controller.js
- [ ] T003 [P] Create placeholder export.js file in /main/ipc/handlers/ with basic structure

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [ ] T004 [P] Create IPC contract test for export:htmlWithMicrodata request validation in /tests/integration/export-html-contract.test.js
- [ ] T005 [P] Create test for HTML response structure validation in /tests/integration/export-html-response.test.js

### Service Tests
- [ ] T006 [P] Create unit test for implode-wrapper service in /tests/unit/implode-wrapper.test.js
- [ ] T007 [P] Create unit test for HTML formatter service in /tests/unit/formatter.test.js

### Integration Tests
- [ ] T008 Create integration test for full export flow (create topic, add messages, export) in /tests/integration/export-html-flow.test.js
- [ ] T009 [P] Create test for error handling (invalid topic, missing messages) in /tests/integration/export-html-errors.test.js

## Phase 3.3: Core Implementation (ONLY after tests are failing)
**Process: Main (Node.js)**

### Services Layer
- [ ] T010 [P] Implement implode-wrapper.js service in /main/services/html-export/implode-wrapper.js using ONE.core's implode() function
- [ ] T011 [P] Implement formatter.js service in /main/services/html-export/formatter.js to add human-readable HTML structure
- [ ] T012 [P] Create html-template.js in /main/services/html-export/html-template.js with CSS styles and HTML boilerplate

### IPC Handler
- [ ] T013 Implement export.js IPC handler in /main/ipc/handlers/export.js with request validation
- [ ] T014 Add message retrieval from TopicRoom in export.js handler
- [ ] T015 Integrate implode() call for each message in export.js handler
- [ ] T016 Add hash and signature embedding logic in export.js handler
- [ ] T017 Implement error handling and timeout (30s) in export.js handler

### Data Processing
- [ ] T018 Add HTML escaping for user content using escapeForHtml() from ONE.core
- [ ] T019 Implement attachment handling (base64 encoding) for inline files
- [ ] T020 Add metadata generation (participants, date range, message count)

## Phase 3.4: UI Components (Renderer Process)
**Process: Renderer (React/Browser)**

- [ ] T021 [P] Add Export button to ChatHeader.tsx component in /electron-ui/src/components/chat/ChatHeader.tsx
- [ ] T022 [P] Create ExportDialog.tsx component in /electron-ui/src/components/ExportDialog/ExportDialog.tsx
- [ ] T023 [P] Create ExportOptions.tsx form component in /electron-ui/src/components/ExportDialog/ExportOptions.tsx
- [ ] T024 Wire up IPC call to export:htmlWithMicrodata in ExportDialog.tsx
- [ ] T025 Add loading state and progress indicator in ExportDialog.tsx
- [ ] T026 Implement file save dialog using Electron's dialog API in ExportDialog.tsx

## Phase 3.5: Integration & Polish

### Final Integration
- [ ] T027 Test export with real conversation data containing formatted text and code blocks
- [ ] T028 Verify microdata attributes are correctly embedded in exported HTML
- [ ] T029 Test opening exported HTML in browser and verify rendering

### Performance & Optimization
- [ ] T030 [P] Add performance logging for exports >1000 messages
- [ ] T031 [P] Implement batch processing for large conversations (>5000 messages)

### Documentation & Validation
- [ ] T032 [P] Run npm run lint and fix any linting issues
- [ ] T033 [P] Run npm run typecheck and fix any TypeScript errors
- [ ] T034 Update README.md with export feature documentation
- [ ] T035 Run full test suite and ensure all tests pass

## Dependencies
- Setup (T001-T003) must complete first
- Tests (T004-T009) before implementation (T010-T020)
- Services (T010-T012) can be parallel, must complete before IPC handler (T013-T017)
- IPC handler complete before UI components (T021-T026)
- UI components can be developed in parallel
- Polish tasks (T030-T035) after all implementation

## Parallel Execution Examples

### Launch Test Tasks Together (T004-T007):
```javascript
// Run these 4 test file creations in parallel:
Task: "Create IPC contract test in /tests/integration/export-html-contract.test.js"
Task: "Create HTML response test in /tests/integration/export-html-response.test.js"
Task: "Create implode-wrapper unit test in /tests/unit/implode-wrapper.test.js"
Task: "Create formatter unit test in /tests/unit/formatter.test.js"
```

### Launch Service Implementations Together (T010-T012):
```javascript
// Run these 3 service implementations in parallel:
Task: "Implement implode-wrapper.js in /main/services/html-export/"
Task: "Implement formatter.js in /main/services/html-export/"
Task: "Create html-template.js in /main/services/html-export/"
```

### Launch UI Components Together (T021-T023):
```javascript
// Run these 3 UI component tasks in parallel:
Task: "Add Export button to ChatHeader.tsx"
Task: "Create ExportDialog.tsx component"
Task: "Create ExportOptions.tsx form component"
```

## Task Validation Checklist
- ✅ All IPC contracts have tests (T004-T005)
- ✅ All services have unit tests (T006-T007)
- ✅ Integration tests cover full flow (T008-T009)
- ✅ IPC handler fully implemented (T013-T017)
- ✅ UI components created (T021-T026)
- ✅ Tests written before implementation (TDD enforced)
- ✅ Parallel tasks marked with [P]
- ✅ Process designation clear (main vs renderer)

## Notes
- **IPC-First**: All data operations through IPC handlers
- **No Browser ONE.core**: UI components only call IPC, never import ONE.core
- **TDD Mandatory**: Tests must fail first, then implement
- **Process Separation**: Main process = Node.js/ONE.core, Renderer = React UI
- **Parallel Safety**: [P] tasks work on different files, no conflicts
- **Commit Frequency**: Commit after each completed task

## Special LAMA Considerations
1. **IPC Handler Registration**: Must update /main/ipc/controller.js (T002)
2. **ONE.core in Main Only**: Services use ONE.core, UI never touches it
3. **File System Access**: Only through Node.js main process
4. **Error Context**: All errors include topicId and operation context
5. **Existing Infrastructure**: Reuse existing TopicRoom and message retrieval