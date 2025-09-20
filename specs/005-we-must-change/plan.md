# Implementation Plan: Topic-Subject-Summary Data Model with AI Integration

**Branch**: `005-we-must-change` | **Date**: 2025-09-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-we-must-change/spec.md`

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
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file
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
Integrate AI-powered topic analysis into LAMA Electron by implementing a hierarchical data model where Topics contain multiple Subjects (identified by keyword combinations), each with versioned Summaries. The AI assistant will automatically identify subjects, extract keywords, and maintain updated summaries as conversations evolve, all operating through IPC from the Node.js ONE.core instance.

## Technical Context
**Language/Version**: TypeScript 5.x / Node.js 20.x
**Primary Dependencies**: ONE.core, Electron, LLM integration (existing LLMManager)
**Storage**: File system via ONE.core objects
**Testing**: Jest for unit/integration, Playwright for E2E
**Target Platform**: Electron cross-platform desktop (macOS, Windows, Linux)
**Project Type**: single (Electron with IPC architecture)
**Performance Goals**: <500ms for keyword extraction, <2s for summary generation
**Constraints**: All AI processing in Node.js, UI receives results via IPC
**Scale/Scope**: Support 100+ subjects per topic, 1000+ keywords total
**AI Integration Context**: We want to integrate topic analysis with AI assistant

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (LAMA Electron - single codebase) ✓
- Using framework directly? Yes - ONE.core, Electron IPC ✓
- Single data model? Yes - ONE.core objects only ✓
- Avoiding patterns? Yes - direct IPC handlers ✓

**Architecture**:
- EVERY feature as library? Topic analysis as ONE.core package ✓
- Libraries listed:
  - one.ai package (new) - Topic/Subject/Summary/Keyword models
  - Existing: LLMManager for AI operations
- CLI per library: N/A for this feature
- Library docs: Will follow existing ONE.core documentation patterns ✓

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes ✓
- Git commits show tests before implementation? Will enforce ✓
- Order: Contract→Integration→E2E→Unit strictly followed? Yes ✓
- Real dependencies used? Yes - actual ONE.core, real LLM ✓
- Integration tests for: new libraries, contract changes, shared schemas? Yes ✓
- FORBIDDEN: Implementation before test - understood ✓

**Observability**:
- Structured logging included? Yes - existing console.log pattern ✓
- Frontend logs → backend? Yes - via IPC ✓
- Error context sufficient? Will include topic/subject IDs ✓

**Versioning**:
- Version number assigned? Using existing LAMA version ✓
- BUILD increments on every change? Following existing pattern ✓
- Breaking changes handled? Backward compatible design ✓

## Project Structure

### Documentation (this feature)
```
specs/005-we-must-change/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# LAMA Electron Structure (existing + new additions)
main/
├── core/
│   ├── node-one-core.js     # Existing ONE.core instance
│   └── one-ai/               # NEW: AI analysis package
│       ├── models/
│       │   ├── Subject.js
│       │   ├── Keyword.js
│       │   └── Summary.js
│       └── services/
│           └── TopicAnalyzer.js
├── ipc/
│   └── handlers/
│       └── topic-analysis.js # NEW: IPC handlers for topic analysis
└── services/
    └── llm-manager.js        # Existing AI integration

electron-ui/
└── src/
    └── components/
        └── TopicSummary/     # NEW: UI components for summaries

tests/
├── integration/
│   └── topic-analysis/       # NEW: Integration tests
└── unit/
    └── one-ai/               # NEW: Unit tests for models
```

**Structure Decision**: Option 1 (Single project) - LAMA Electron is a unified Electron application

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - Subject creation triggers (AI automatic vs manual)
   - Keyword extraction algorithms and thresholds
   - Summary versioning limits and retention
   - Integration with existing LLMManager

2. **Generate and dispatch research agents**:
   ```
   Task: "Research keyword extraction best practices for conversation analysis"
   Task: "Find patterns for versioned object storage in ONE.core"
   Task: "Research summary generation techniques for multi-subject conversations"
   Task: "Investigate existing LAMA AI integration patterns"
   ```

3. **Consolidate findings** in `research.md`

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Subject: topic, keywords[], timestamp, id
   - Keyword: value, frequency, contexts[]
   - Summary: topicId, version, subjects[], content, created, updated

2. **Generate API contracts** from functional requirements:
   - IPC: `topicAnalysis:analyzeMessages`
   - IPC: `topicAnalysis:getSubjects`
   - IPC: `topicAnalysis:getSummary`
   - IPC: `topicAnalysis:updateSummary`

3. **Generate contract tests** from contracts:
   - Test each IPC handler schema
   - Test versioning behavior
   - Test keyword uniqueness

4. **Extract test scenarios** from user stories:
   - Multi-subject conversation analysis
   - Summary update on new message
   - Keyword overlap handling

5. **Update CLAUDE.md incrementally**:
   - Add one.ai package information
   - Document IPC handlers for topic analysis

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md update

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Create ONE.core object definitions for Subject, Keyword, Summary
- Implement IPC handlers for topic analysis operations
- Create TopicAnalyzer service integrating with LLMManager
- Build UI components for displaying summaries
- Write integration tests for AI-driven analysis

**Ordering Strategy**:
- Models first (Subject, Keyword, Summary) [P]
- Services next (TopicAnalyzer)
- IPC handlers after services
- UI components last
- Tests throughout following TDD

**Estimated Output**: 20-25 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No violations - all constitutional principles followed*

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
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*