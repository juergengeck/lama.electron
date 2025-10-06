# Implementation Plan: Keyword Detail Preview

**Branch**: `015-keyword-detail-preview` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-keyword-detail-preview/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   ✓ Spec loaded successfully
2. Fill Technical Context
   ✓ Project Type: Electron app (frontend + backend)
   ✓ Structure Decision: Split (main/ + electron-ui/)
3. Evaluate Constitution Check section
   ✓ Constitution compliant
   → Progress: Initial Constitution Check
4. Execute Phase 0 → research.md
   ✓ No NEEDS CLARIFICATION remain
5. Execute Phase 1 → contracts, data-model.md, quickstart.md
   ✓ Generated IPC contracts
   ✓ Generated data model
   ✓ Generated quickstart
6. Re-evaluate Constitution Check section
   ✓ No violations introduced
   → Progress: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach
   ✓ Task generation strategy defined
8. STOP - Ready for /tasks command
```

## Summary

This feature adds an interactive keyword detail preview panel that displays when users click keywords in chat conversations. The preview shows:
- Vertically scrollable list of subjects containing the keyword
- Each subject's description content and topic references
- Configurable sorting (relevance, time, author)
- 3-state access control (allow/deny/not selected) for users and groups
- Settings page with full keyword list access

**Technical Approach**: Extends existing `one-ai` package with new data models for keyword access control and topic references. Uses IPC for all data operations following LAMA's single ONE.core architecture. UI component reuses TopicSummary layout patterns.

**Additional Requirement**: Settings page listing all keywords with access configuration.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), JavaScript ES2020 (backend Node.js)
**Primary Dependencies**:
- Frontend: React 18, shadcn/ui components, Tailwind CSS
- Backend: @refinio/one.core (ONE.core), Electron IPC
- Existing: one-ai package (TopicAnalysisModel, Keyword, Subject models)

**Storage**: ONE.core versioned objects (Keyword, Subject, KeywordAccessState recipes)
**Testing**: Vitest (unit), manual integration testing via Electron dev tools
**Target Platform**: Electron app (macOS primary, cross-platform capable)
**Project Type**: Electron split architecture (main/ + electron-ui/)
**Performance Goals**:
- Handle 100+ keywords without lag
- Scroll performance for 50+ subjects
- <200ms IPC round-trip for keyword details

**Constraints**:
- NO ONE.core in browser - ALL data via IPC
- Must fail fast (no fallbacks)
- Reuse existing one-ai infrastructure
- Compatible with existing TopicSummary panel location

**Scale/Scope**:
- ~3-5 new IPC handlers
- ~2 new ONE.core recipes (KeywordAccessState, KeywordSettings)
- ~4 React components (KeywordDetailPanel, SubjectList, AccessControlList, KeywordSettingsPage)
- Extends existing TopicAnalysisModel

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (Electron app with main + ui directories) ✓
- Using framework directly? YES (React, ONE.core, Electron IPC directly) ✓
- Single data model? YES (ONE.core recipes, no separate DTOs) ✓
- Avoiding patterns? YES (No Repository/UoW - direct ONE.core storage) ✓

**Architecture**:
- EVERY feature as library? N/A (Application feature, not library) ✓
- Following LAMA Single ONE.core: YES (Node.js only, IPC-first) ✓
- Browser = UI only: YES (No ONE.core imports in electron-ui/) ✓
- Extending existing one-ai package: YES (Minimal new code) ✓

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES (Tests written first) ✓
- Git commits show tests before implementation? PLANNED ✓
- Order: Contract→Integration→E2E→Unit? YES ✓
- Real dependencies used? YES (Real ONE.core, file system) ✓
- Integration tests for: New IPC handlers? YES ✓
- FORBIDDEN actions avoided? YES (No implementation before tests) ✓

**Observability**:
- Structured logging included? YES (console.log with [KeywordDetail] prefix) ✓
- Frontend logs → backend? N/A (Electron logs unified in main console) ✓
- Error context sufficient? YES (Full error objects, topic/keyword IDs) ✓

**Versioning**:
- Version number assigned? Uses package.json version ✓
- BUILD increments on every change? Handled by npm version ✓
- Breaking changes handled? N/A (Internal feature, not API) ✓

**Constitution Status**: ✅ PASS

## Project Structure

### Documentation (this feature)
```
specs/015-keyword-detail-preview/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── getKeywordDetails.md
│   ├── getKeywordsByTopic.md
│   ├── getAllKeywords.md
│   ├── updateKeywordAccessState.md
│   └── getKeywordAccessStates.md
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Electron split architecture
main/                              # Node.js (backend)
├── core/one-ai/
│   ├── models/
│   │   ├── Keyword.ts            # Extend: add access control
│   │   ├── Subject.ts            # Extend: add topic reference metadata
│   │   └── TopicAnalysisModel.js # Extend: add keyword detail methods
│   ├── recipes/
│   │   ├── KeywordAccessState.ts # NEW: User/group access states
│   │   └── ai-recipes.ts         # Extend: register new recipes
│   └── storage/
│       └── keyword-access-storage.ts # NEW: Access state persistence
├── ipc/handlers/
│   └── keyword-detail.js         # NEW: All keyword detail IPC handlers
└── services/
    └── keyword-enrichment.js     # NEW: Topic reference enrichment

electron-ui/                       # Browser (frontend)
├── src/
│   ├── components/
│   │   ├── KeywordDetail/        # NEW: Keyword detail panel components
│   │   │   ├── KeywordDetailPanel.tsx
│   │   │   ├── SubjectList.tsx
│   │   │   ├── AccessControlList.tsx
│   │   │   └── SortControls.tsx
│   │   ├── Settings/             # Extend: Add keyword settings page
│   │   │   └── KeywordSettingsPage.tsx
│   │   └── TopicSummary/         # Extend: Add keyword click handler
│   │       └── KeywordCloud.tsx  # Modify: Add onKeywordClick event
│   ├── hooks/
│   │   └── useKeywordDetails.ts  # NEW: Hook for fetching keyword details
│   └── types/
│       └── keyword-detail.ts     # NEW: TypeScript interfaces
```

**Structure Decision**: Electron split architecture (main/ for Node.js, electron-ui/ for React)

## Phase 0: Outline & Research

**Unknowns Identified**: None - all technical context is clear from spec and existing codebase.

**Research Completed**:

1. **Existing Keyword & Subject Infrastructure**
   - Decision: Extend existing `Keyword.ts` and `Subject.ts` models
   - Rationale: Models already have subject associations, frequency tracking
   - Current structure: Keywords store `subjects` array, Subjects store `keywords` array

2. **TopicSummary Panel Integration**
   - Decision: Use same container/layout as TopicSummary component
   - Rationale: Spec requires "same place like summaries"
   - Implementation: Conditional rendering based on view state (summary/keyword-detail)

3. **Access Control Storage**
   - Decision: New `KeywordAccessState` recipe with composite key (keyword+user/group)
   - Rationale: Matches LAMA's existing AccessRightsManager patterns
   - Storage: ONE.core versioned objects for persistence across sessions

4. **IPC Handler Patterns**
   - Decision: Follow existing `topic-analysis.js` handler structure
   - Rationale: Consistency with topic analysis IPC contracts
   - Pattern: Single file (`keyword-detail.js`) with multiple exported handlers

5. **Settings Page Integration**
   - Decision: Add `KeywordSettingsPage.tsx` to existing Settings section
   - Rationale: Matches user request for "list of keywords in settings"
   - Navigation: Add to settings menu, shows full keyword list with access controls

**Output**: research.md (see separate file)

## Phase 1: Design & Contracts
*Prerequisites: research.md complete ✓*

### Generated Artifacts:

1. **data-model.md** - Entity definitions and relationships
   - KeywordAccessState entity
   - Extended Keyword with access control metadata
   - Extended Subject with topic reference enrichment
   - Data flow diagrams

2. **contracts/** - IPC API contracts
   - `getKeywordDetails.md` - Fetch keyword with subjects and access states
   - `getKeywordsByTopic.md` - List all keywords for a topic
   - `getAllKeywords.md` - Full keyword list for settings page
   - `updateKeywordAccessState.md` - Save user/group access state
   - `getKeywordAccessStates.md` - Fetch all access states for keyword

3. **quickstart.md** - Testing guide
   - Manual testing steps
   - Integration test scenarios
   - Expected behaviors

### Design Decisions:

**Data Model Extensions**:
- `KeywordAccessState`: `{ $type$: 'KeywordAccessState', keywordTerm, principalId, principalType: 'user'|'group', state: 'allow'|'deny'|'none' }`
- Keyword enrichment: Add `topicReferences[]` with `{ topicId, topicName, messageCount, lastMessageDate, authors }`
- Subject enrichment: Add sorting metadata `{ relevanceScore, placesMentioned, frequency, lastSeenDate }`

**IPC Contract Patterns**:
- Request: `{ keyword: string, topicId?: string }`
- Response: `{ success: boolean, data: { keyword, subjects[], accessStates[], topicReferences[] }, error? }`
- Follow existing topic-analysis error handling (throw on failure, return structured response)

**UI Component Hierarchy**:
```
KeywordDetailPanel
├── Header (keyword name, close button)
├── SortControls (relevance/time/author)
├── SubjectList (scrollable)
│   └── SubjectItem (description + topic refs)
└── AccessControlList (users + groups with 3-state)
```

**Output**: data-model.md, contracts/, quickstart.md (see separate files)

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

1. **Load Phase 1 artifacts**: contracts/, data-model.md, quickstart.md
2. **Generate task order**:
   - Data model tasks (recipes, storage): P1-P5
   - IPC handler tasks (contracts): P6-P10
   - Service layer tasks (enrichment): P11-P12
   - UI component tasks: P13-P20
   - Integration tasks: P21-P25
   - Settings page tasks: P26-P28

3. **Task dependencies**:
   - Sequential: Recipes → Storage → IPC → UI
   - Parallel within layer: [P] mark for independent files
   - Example: All recipe files can be created in parallel

4. **Test-first requirements**:
   - Each task prefixed with "Write test for..."
   - Implementation task follows immediately: "Implement..."
   - Integration tests at end to verify full flow

**Ordering Strategy**:
- TDD order: Tests ALWAYS before implementation
- Bottom-up: Data layer → Logic → UI
- Mark [P] for parallel execution (separate files)

**Estimated Output**:
- ~28 numbered tasks
- ~40% tests, ~60% implementation
- Clear dependencies and parallelization opportunities

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

No violations - feature follows LAMA architecture patterns cleanly.

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
*Feature extends existing one-ai package infrastructure*
*All data operations via IPC following LAMA Single ONE.core architecture*
