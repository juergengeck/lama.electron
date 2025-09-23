# Implementation Plan: HTML Export with Microdata Markup

**Branch**: `008-we-now-successfully` | **Date**: 2025-09-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-we-now-successfully/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Leverage ONE.core's native `implode()` function to generate HTML with microdata markup for chat export, adding human-readable formatting and comprehensive embedded hashes and signatures for message authenticity verification.

## Technical Context
**Language/Version**: TypeScript 5.x / Node.js 20.x
**Primary Dependencies**: ONE.core (existing), Electron, React
**Storage**: File system (ONE.core objects)
**Testing**: Jest (existing test suite)
**Target Platform**: Electron desktop application (macOS, Windows, Linux)
**Project Type**: single (Electron with Node.js backend and browser UI)
**Performance Goals**: Export conversations with <2s for 1000 messages
**Constraints**: Must use ONE.core's implode() for microdata generation, IPC-only communication
**Scale/Scope**: Support conversations with up to 10k messages
**ONE.core Specifics**: Use implode() from one.core to generate microdata, add human readability layer

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (Electron app with IPC handlers)
- Using framework directly? YES (ONE.core implode(), no wrapper)
- Single data model? YES (ONE.core objects, no DTOs)
- Avoiding patterns? YES (direct IPC handlers, no repository)

**Architecture**:
- EVERY feature as library? YES (export service in Node.js)
- Libraries listed:
  - HTMLExportService: Generate HTML from ONE objects using implode()
  - MicrodataFormatter: Add human-readable formatting to imploded HTML
- CLI per library: N/A (IPC handlers instead)
- Library docs: Will document in quickstart.md

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES
- Git commits show tests before implementation? YES
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? YES (actual ONE.core, real file system)
- Integration tests for: IPC handlers, export service
- FORBIDDEN: Implementation before test ✓

**Observability**:
- Structured logging included? YES (existing logging)
- Frontend logs → backend? YES (via IPC)
- Error context sufficient? YES

**Versioning**:
- Version number assigned? Uses existing app version
- BUILD increments on every change? YES
- Breaking changes handled? N/A (new feature)

## Project Structure

### Documentation (this feature)
```
specs/008-we-now-successfully/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT - Electron app)
main/
├── ipc/
│   └── handlers/
│       └── export.js    # IPC handler for HTML export
├── services/
│   └── html-export/
│       ├── implode-wrapper.js  # ONE.core implode() integration
│       └── formatter.js         # Human-readable formatting
└── core/
    └── node-one-core.js  # Existing ONE.core instance

electron-ui/
├── src/
│   └── components/
│       └── ExportDialog/  # UI for export options
└── tests/

tests/
├── integration/
│   └── export-html.test.js
└── unit/
    └── formatter.test.js
```

**Structure Decision**: Option 1 (Single Electron project) - follows existing LAMA architecture

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - ONE.core implode() function capabilities and API
   - Microdata schema format (schema.org vs custom)
   - Signature format from ONE.core
   - Performance characteristics of implode() with large datasets

2. **Generate and dispatch research agents**:
   ```
   Task 1: "Research ONE.core implode() function for HTML microdata generation"
   Task 2: "Investigate microdata schema options for chat messages"
   Task 3: "Explore ONE.core signature and hash generation methods"
   Task 4: "Analyze performance implications of implode() with 10k messages"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts

*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - ExportRequest: Format type, conversation ID, options
   - ExportedHTML: Complete HTML document with microdata
   - MessageMicrodata: ONE object with hash and signature
   - ConversationMetadata: Topic, participants, date range

2. **Generate API contracts** from functional requirements:
   - IPC: `export:htmlWithMicrodata` handler
   - Request: conversation ID, format options
   - Response: HTML string or file path
   - Output to `/contracts/export-html.yaml`

3. **Generate contract tests** from contracts:
   - Test IPC handler contract
   - Test HTML structure validation
   - Test microdata extraction
   - Tests must fail initially

4. **Extract test scenarios** from user stories:
   - Export conversation with microdata
   - View HTML in browser
   - Verify hashes and signatures
   - Handle edge cases (special chars, large conversations)

5. **Update CLAUDE.md incrementally**:
   - Add HTML export with implode() context
   - Document IPC handlers for export
   - Keep under 150 lines

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md updates

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
The /tasks command will generate approximately 18-22 tasks based on:

1. **Test Tasks (TDD - First Priority)**:
   - Contract test for IPC handler schema validation
   - Integration test for export:htmlWithMicrodata handler
   - Unit test for implode wrapper service
   - Unit test for HTML formatter service
   - E2E test for full export flow

2. **Implementation Tasks (After Tests)**:
   - Create export.js IPC handler skeleton [P]
   - Implement implode-wrapper.js service [P]
   - Implement formatter.js service [P]
   - Add HTML template generation
   - Add CSS styling inline
   - Implement hash and signature embedding
   - Add error handling and validation

3. **UI Tasks (Final)**:
   - Add export button to ChatHeader
   - Create ExportDialog component
   - Wire up IPC calls from UI
   - Add loading state during export
   - Handle file save dialog

**Task Dependencies**:
```
Contract Test → IPC Handler → Integration Test
                     ↓
             Implode Wrapper → Formatter
                     ↓
                UI Components → E2E Test
```

**Parallel Execution Opportunities [P]**:
- Contract test, unit tests (independent files)
- Service implementations (separate modules)
- UI component creation (independent components)

**Ordering Strategy**:
1. All test files first (RED phase of TDD)
2. Implementation to make tests pass (GREEN phase)
3. UI integration last
4. Final E2E validation

**Estimated Output**: 20 numbered tasks in tasks.md with clear dependencies

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No violations - design follows all constitutional principles*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---
*Based on Constitution v1.0.0 - See `/spec/memory/constitution.md`*