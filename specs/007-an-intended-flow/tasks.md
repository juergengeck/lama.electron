# Tasks: Third-Party Message Audit Flow

**Input**: Design documents from `/specs/007-an-intended-flow/`
**Prerequisites**: plan.md (required), spec.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: Core modules, data models, phases
2. Generate tasks by category:
   → Setup: IPC contracts, dependencies
   → Tests: IPC handler tests (TDD)
   → Core: Node.js attestation/QR services
   → IPC: Handler implementations
   → UI: React components in browser
   → Polish: Export formatting, docs
3. Apply LAMA task rules:
   → IPC handlers: Sequential (same controller)
   → UI components: Parallel [P] (different files)
   → Node.js core: Sequential (dependencies)
4. Number tasks sequentially (T001, T002...)
5. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup & IPC Contracts
- [ ] T001 Define IPC contracts for audit operations in `/main/ipc/controller.js`
- [ ] T002 Install qrcode generation dependency: `npm install qrcode`
- [ ] T003 Create attestation data model types in `/main/core/types/attestation.d.ts`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T004 [P] Test IPC handler for generating QR codes in `/test/ipc/audit.test.js`
- [ ] T005 [P] Test IPC handler for creating attestations in `/test/ipc/attestation.test.js`
- [ ] T006 [P] Test IPC handler for topic export with attestations in `/test/ipc/export.test.js`
- [ ] T007 Test attestation storage in Topic structure in `/test/core/attestation-storage.test.js`

## Phase 3.3: Core Implementation (Node.js - Main Process)
- [ ] T008 Create QR generation service in `/main/core/qr-generation.js` for message hash encoding
- [ ] T009 Create attestation manager in `/main/core/attestation-manager.js` with MessageAttestation object
- [ ] T010 Extend topic export service in `/main/core/topic-export.js` to include attestations with microdata
- [ ] T011 Add attestation storage to Topic structure using existing ChannelManager

## Phase 3.4: IPC Handler Implementation
- [ ] T012 Create IPC handler `audit:generateQR` in `/main/ipc/handlers/audit.js` for QR generation
- [ ] T013 Create IPC handler `audit:createAttestation` in `/main/ipc/handlers/audit.js` for attestation creation
- [ ] T014 Create IPC handler `audit:getAttestations` in `/main/ipc/handlers/audit.js` to retrieve attestations
- [ ] T015 Create IPC handler `audit:exportTopic` in `/main/ipc/handlers/audit.js` for structured export
- [ ] T016 Register audit handlers in `/main/ipc/controller.js`

## Phase 3.5: UI Components (Browser - Renderer Process) [P]
- [ ] T017 [P] Create QR display component in `/electron-ui/src/components/audit/QRCodeDisplay.tsx`
- [ ] T018 [P] Create attestation status indicator in `/electron-ui/src/components/audit/AttestationStatus.tsx`
- [ ] T019 [P] Create audit view panel in `/electron-ui/src/components/audit/AuditPanel.tsx`
- [ ] T020 [P] Create auditor identity display in `/electron-ui/src/components/audit/AuditorBadge.tsx`
- [ ] T021 Integrate audit components into message bubble in `/electron-ui/src/components/chat/EnhancedMessageBubble.tsx`

## Phase 3.6: Reference Implementation
- [ ] T022 Create QR scanner module in `/reference/lama/qr-scanner.js` with camera access
- [ ] T023 Add ONE.core audit URL parser in `/reference/lama/audit-url-parser.js`
- [ ] T024 Create verification interface in `/reference/lama/verification-view.js`
- [ ] T025 Integrate scanner with message retrieval by hash

## Phase 3.7: Export & Microdata
- [ ] T026 Update HTML export to include attestation microdata in `/main/core/html-export.js`
- [ ] T027 Add attestation itemtype schema definition in `/main/core/schemas/attestation-schema.js`
- [ ] T028 Ensure microdata consistency between export and import

## Phase 3.8: Polish
- [ ] T029 [P] Add attestation status tooltips showing auditor details
- [ ] T030 [P] Create attestation timeline view for version history
- [ ] T031 Update documentation in `/docs/audit-flow.md`
- [ ] T032 Add audit flow to manual testing checklist
- [ ] T033 Performance test: QR generation < 100ms for batch of 50 messages

## Dependencies
- T001-T003 (Setup) must complete first
- T004-T007 (Tests) before T008-T016 (Implementation)
- T008-T011 (Core) before T012-T016 (IPC handlers)
- T012-T016 (IPC) before T017-T021 (UI)
- T022-T025 (Reference) can start after T008 (QR generation)
- T026-T028 (Export) after T009 (attestation manager)
- All implementation before T029-T033 (Polish)

## Parallel Execution Examples

### UI Components (T017-T020)
```bash
# Launch all UI components together (different files):
Task: "Create QR display component in /electron-ui/src/components/audit/QRCodeDisplay.tsx"
Task: "Create attestation status indicator in /electron-ui/src/components/audit/AttestationStatus.tsx"
Task: "Create audit view panel in /electron-ui/src/components/audit/AuditPanel.tsx"
Task: "Create auditor identity display in /electron-ui/src/components/audit/AuditorBadge.tsx"
```

### Test Tasks (T004-T006)
```bash
# Launch IPC tests together (different test files):
Task: "Test IPC handler for generating QR codes in /test/ipc/audit.test.js"
Task: "Test IPC handler for creating attestations in /test/ipc/attestation.test.js"
Task: "Test IPC handler for topic export with attestations in /test/ipc/export.test.js"
```

## Notes for LAMA Architecture
- **Main Process (Node.js)**: All ONE.core operations, attestation logic, QR generation
- **Renderer Process (Browser)**: UI components only - display QR, show status
- **IPC Bridge**: All data flows through IPC handlers - no direct ONE.core in browser
- **Reference Implementation**: Separate app for QR scanning functionality
- Tests must be written before implementation (TDD approach)
- UI components can be developed in parallel as they're in different files
- IPC handlers must be sequential as they're in the same audit.js file

## Key Integration Points
- Leverages existing message versioning system (message hashes)
- Uses AffirmationCertificate infrastructure for signatures
- Integrates with Topic sync via ChannelManager
- Extends HTML export with microdata for attestations