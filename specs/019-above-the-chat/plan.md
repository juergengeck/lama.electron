# Implementation Plan: Context-Aware Knowledge Sharing Proposals

**Branch**: `019-above-the-chat` | **Date**: 2025-01-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/gecko/src/lama.electron/specs/019-above-the-chat/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → SUCCESS: Spec loaded and analyzed
2. Fill Technical Context
   → Project Type: Electron (web-like: frontend + backend)
   → Structure Decision: Split (electron-ui + main process)
3. Evaluate Constitution Check section
   → PASS: Single ONE.core in Node.js, IPC-first, fail-fast
   → Update Progress Tracking: Initial Constitution Check ✓
4. Execute Phase 0 → research.md
   → Research: Subject matching algorithm, proposal ranking, swipe gestures
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → Design: Proposal engine, IPC handlers, React components
6. Re-evaluate Constitution Check
   → PASS: Design follows LAMA architecture
   → Update Progress Tracking: Post-Design Constitution Check ✓
7. Plan Phase 2 → Describe task generation approach
   → Tasks will follow TDD: Contract tests → Integration tests → Implementation
8. STOP - Ready for /tasks command
```

## Summary

This feature adds context-aware knowledge sharing proposals displayed above the chat entry field. Users see automatic suggestions of relevant past conversations based on subject/keyword matching. A single proposal is shown at a time, with horizontal swipe navigation to cycle through ranked proposals.

**Technical Approach**:
- Node.js proposal engine scans past subjects for keyword matches
- Configurable ranking algorithm (initial: any keyword overlap)
- IPC handler provides ranked proposals to UI
- React component above chat input with swipe gesture support
- Settings UI for algorithm configuration
- Real-time updates as current conversation subjects change

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 18+, React 18)
**Primary Dependencies**:
- Node.js: Existing Subject/Keyword models from Feature 018
- React: swiper or react-spring for gesture handling
- IPC: electronAPI bridge
**Storage**: ONE.core (existing Subject storage)
**Testing**: Jest (integration tests), React Testing Library (UI)
**Target Platform**: Electron (macOS/Linux/Windows)
**Project Type**: Electron app (split: electron-ui + main)
**Performance Goals**: <100ms proposal generation, <50ms swipe response
**Constraints**:
- Must work offline (local-only subject matching)
- Non-blocking (proposals generated asynchronously)
- Graceful degradation (no subjects = no proposals)
**Scale/Scope**:
- 100-1000 past subjects per user
- 1-10 proposals per context
- Keyword sets: 5-20 keywords per subject

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 2 (electron-ui, main) ✓
- Using framework directly? YES (React, ONE.core) ✓
- Single data model? YES (Proposal = computed from Subjects) ✓
- Avoiding patterns? YES (no repository, direct IPC) ✓

**Architecture**:
- EVERY feature as library? N/A (Electron app architecture) ✓
- Libraries listed: N/A (using existing Subject/Keyword models)
- CLI per library: N/A (Electron GUI app)
- Library docs: N/A

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES ✓
- Git commits show tests before implementation? PLANNED ✓
- Order: Contract→Integration→E2E→Unit? YES ✓
- Real dependencies used? YES (real ONE.core, real Subject storage) ✓
- Integration tests for: IPC handlers, Subject queries, proposal ranking ✓
- FORBIDDEN: Implementation before test ✓

**Observability**:
- Structured logging included? YES (proposal matches, algorithm used) ✓
- Frontend logs → backend? YES (via IPC error handlers) ✓
- Error context sufficient? YES (keyword mismatches, empty proposals) ✓

**Versioning**:
- Version number assigned? N/A (feature within existing app)
- BUILD increments on every change? Follows app versioning
- Breaking changes handled? N/A (new feature, no API changes)

**LAMA-Specific (Constitution)**:
- Single ONE.core in Node.js only? YES ✓
- Browser UI only, no ONE.core? YES ✓
- ALL data via IPC? YES ✓
- Fail fast, no fallbacks? YES ✓

## Project Structure

### Documentation (this feature)
```
specs/019-above-the-chat/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── ipc-proposals.json
└── tasks.md             # Phase 2 output (/tasks command)
```

### Source Code (LAMA Electron)
```
main/
├── ipc/handlers/
│   └── proposals.js          # NEW: IPC handler for proposals
├── services/
│   ├── proposal-engine.js    # NEW: Core matching logic
│   └── proposal-ranker.js    # NEW: Ranking algorithm
└── config/
    └── proposal-config.js    # NEW: Default algorithm settings

electron-ui/src/
├── components/
│   ├── ProposalCard.tsx      # NEW: Single proposal display
│   ├── ProposalCarousel.tsx  # NEW: Swipeable container
│   └── ChatView.tsx          # MODIFY: Add proposal above input
├── services/
│   └── proposal-service.ts   # NEW: IPC bridge for proposals
└── hooks/
    └── useProposals.ts       # NEW: React hook for proposal state

tests/integration/
└── proposals/
    ├── test-proposal-matching.js
    ├── test-proposal-ranking.js
    └── test-proposal-ipc.js
```

**Structure Decision**: Electron split architecture (electron-ui + main process)

## Phase 0: Outline & Research

**Unknowns to Research**:
1. Subject relevance scoring algorithm
2. React swipe gesture libraries for Electron
3. Proposal caching strategy
4. Algorithm configuration storage

**Research Tasks**:
- Compare swipe libraries: react-swiper vs react-spring vs custom touch handlers
- Research keyword matching algorithms: Jaccard similarity, TF-IDF, cosine similarity
- Investigate proposal caching: when to invalidate, LRU strategy
- Review ONE.core config storage patterns for algorithm settings

**Consolidated Findings** → see [research.md](./research.md)

## Phase 1: Design & Contracts

**Data Model** → see [data-model.md](./data-model.md):
- Proposal (computed): pastSubject, currentSubject, matchedKeywords, relevanceScore, sourceTopicId
- ProposalConfig: matchingAlgorithm, minKeywordOverlap, maxProposals, rankingWeights

**API Contracts** → see [contracts/ipc-proposals.json](./contracts/ipc-proposals.json):
- `proposals:getForTopic` - Get ranked proposals for current topic
- `proposals:updateConfig` - Update matching algorithm configuration
- `proposals:dismiss` - Mark proposal as dismissed for session
- `proposals:share` - Share selected proposal into conversation

**Contract Tests**:
- test-proposal-ipc-contract.js (validates request/response schemas)

**Integration Tests from User Stories**:
- Story 1: Display single most relevant proposal
- Story 2-3: Swipe through multiple proposals by relevance
- Story 4: Share proposal into conversation
- Story 5: Configure algorithm in settings

**Agent Context Update** → see [CLAUDE.md](../../CLAUDE.md):
- Add: Feature 019 proposal system architecture
- Add: ProposalEngine service patterns
- Add: IPC handler patterns for proposals

**Output**: data-model.md, contracts/ipc-proposals.json, quickstart.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. Load contracts → generate contract test tasks
2. Extract from data-model.md → generate Node.js service tasks
3. Extract from UI mockups → generate React component tasks
4. Generate integration tests from user stories
5. Generate implementation tasks to make tests pass

**Ordering Strategy** (TDD):
1. Contract tests [P] (can run in parallel per contract)
2. Integration tests for Node.js:
   - Proposal matching (Subject query integration)
   - Proposal ranking (algorithm integration)
   - IPC handler (full flow integration)
3. React component tests:
   - ProposalCard display
   - ProposalCarousel swipe behavior
   - ChatView integration
4. Implementation (Node.js):
   - ProposalEngine service
   - ProposalRanker service
   - IPC handler
5. Implementation (React):
   - ProposalCard component
   - ProposalCarousel component
   - ChatView modifications
6. Settings UI for configuration
7. E2E validation

**Estimated Output**: 18-22 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following TDD)
**Phase 5**: Validation (run tests, execute quickstart.md)

## Complexity Tracking
*No constitutional violations - all checks pass*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

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
*Based on LAMA Constitution - See `/spec/memory/constitution.md`*
