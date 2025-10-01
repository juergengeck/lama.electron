# Implementation Plan: Feed-Forward Training Infrastructure

**Branch**: `013-today-s-feed` | **Date**: 2025-09-29 | **Spec**: [/specs/013-today-s-feed/spec.md]
**Input**: Feature specification from `/specs/013-today-s-feed/spec.md`

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

## Summary
The Feed-Forward Training Infrastructure transforms LAMA conversations into a living training corpus, replacing static datasets with continuous, verified, attributed conversation data. Building on existing keyword extraction and trust management components, we add Supply/Demand object management to create a self-organizing knowledge marketplace.

## Technical Context
**Language/Version**: TypeScript 5.7.2, Node.js 18+
**Primary Dependencies**: @refinio/one.core, @refinio/one.models (existing)
**Storage**: ONE.core object storage (file-based)
**Testing**: Jest with real ONE.core instances
**Target Platform**: Electron desktop (Windows/Mac/Linux)
**Project Type**: single - Electron app with IPC architecture
**Performance Goals**: < 100ms keyword extraction, < 500ms matching, 10K concurrent users
**Constraints**: < 200ms p95 latency, must work offline, respect user privacy
**Scale/Scope**: Initial: 10K users, 1M messages/day, 100K Supply objects

*User guidance: use existing components wherever possible. fix issues you find along the way without cutting corners, invest the effort to do this properly*

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**: ✅
- Projects: 1 (Electron app with IPC handlers)
- Using framework directly? YES - ONE.core directly, no wrappers
- Single data model? YES - ONE objects only
- Avoiding patterns? YES - No Repository/UoW, direct ONE.core usage

**Architecture**: ✅
- EVERY feature as library? YES - FeedForwardManager as library
- Libraries listed:
  - FeedForwardManager: Supply/Demand management and matching
  - TrustCalculator: Trust score computation
  - CorpusGenerator: Training data preparation
- CLI per library: feedforward CLI with --supply/--demand/--match commands
- Library docs: Will generate llms.txt for each library

**Testing (NON-NEGOTIABLE)**: ✅
- RED-GREEN-Refactor cycle enforced? YES
- Git commits show tests before implementation? YES
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? YES - Real ONE.core, no mocks
- Integration tests for: All new IPC handlers, ONE object operations

**Observability**: ✅
- Structured logging included? YES - Using existing LAMA logging
- Frontend logs → backend? YES - Via IPC
- Error context sufficient? YES - Include conversation ID, keywords, trust scores

**Versioning**: ✅
- Version number assigned? 1.0.0
- BUILD increments on every change? YES
- Breaking changes handled? N/A - New feature

## Project Structure

### Documentation (this feature)
```
specs/013-today-s-feed/
├── plan.md              # This file (/plan command output) ✅
├── research.md          # Phase 0 output (/plan command) ✅
├── data-model.md        # Phase 1 output (/plan command) ✅
├── quickstart.md        # Phase 1 output (/plan command) ✅
├── contracts/           # Phase 1 output (/plan command) ✅
│   ├── ipc-feed-forward.json
│   └── api-training-corpus.json
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
main/
├── core/
│   └── feed-forward/
│       ├── manager.ts          # Main FeedForwardManager class
│       ├── supply-demand.ts    # Supply/Demand object handling
│       ├── trust-calculator.ts # Trust score computation
│       └── corpus-generator.ts # Training corpus creation
├── ipc/
│   └── handlers/
│       └── feed-forward.ts     # IPC handlers (exists, needs implementation)
└── recipes/
    └── feed-forward-recipes.ts # ONE.core recipes for new objects

tests/
├── integration/
│   └── feed-forward/
│       ├── supply-demand.test.ts
│       ├── trust-scoring.test.ts
│       └── corpus-generation.test.ts
└── contract/
    └── feed-forward-api.test.ts
```

**Structure Decision**: Option 1 (Single project) - Electron app with IPC architecture

## Phase 0: Outline & Research ✅
**Completed**: See `research.md`

Key findings:
- Existing keyword extraction can be reused
- Trust management infrastructure partially exists
- Feed-forward handler skeleton already in place
- All clarifications resolved with pragmatic decisions

## Phase 1: Design & Contracts ✅
**Completed**:
- `data-model.md` - 5 new ONE object types defined
- `/contracts/ipc-feed-forward.json` - 6 IPC endpoints specified
- `/contracts/api-training-corpus.json` - External REST API defined
- `quickstart.md` - Test scenarios and verification steps

Key designs:
- Supply/Demand objects as versioned ONE objects
- Trust scores with 5-component calculation
- Training corpus entries as unversioned objects
- Privacy-first with opt-in sharing per conversation

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
The /tasks command will generate approximately 35-40 tasks:

1. **Recipe Definition Tasks** (5 tasks) [P]
   - Define Supply recipe
   - Define Demand recipe
   - Define SupplyDemandMatch recipe
   - Define TrustScore recipe
   - Define TrainingCorpusEntry recipe

2. **Contract Test Tasks** (6 tasks) [P]
   - Test feedForward:createSupply endpoint
   - Test feedForward:createDemand endpoint
   - Test feedForward:matchSupplyDemand endpoint
   - Test feedForward:updateTrust endpoint
   - Test feedForward:getCorpusStream endpoint
   - Test feedForward:enableSharing endpoint

3. **Core Implementation Tasks** (10 tasks)
   - Implement FeedForwardManager class
   - Implement Supply object creation
   - Implement Demand object creation
   - Implement keyword hashing utility
   - Implement Supply-Demand matching algorithm
   - Implement TrustCalculator class
   - Implement trust score components
   - Implement CorpusGenerator class
   - Implement message sanitization
   - Implement privacy controls

4. **Integration Tasks** (8 tasks)
   - Connect to existing keyword extractor
   - Integrate with ContactTrustManager
   - Hook into message creation flow
   - Add sharing settings to Topics
   - Implement IPC handler methods
   - Add corpus streaming
   - Implement trust updates
   - Add federation support hooks

5. **UI Tasks** (5 tasks)
   - Add sharing toggle to conversation UI
   - Display trust scores
   - Show Supply/Demand counts
   - Add corpus statistics view
   - Create API key management UI

6. **Testing Tasks** (6 tasks)
   - Integration tests for Supply/Demand flow
   - Integration tests for trust calculation
   - Integration tests for corpus generation
   - Performance tests for matching
   - Load tests for keyword extraction
   - E2E test for complete flow

**Ordering Strategy**:
- Recipes first (foundation)
- Contract tests second (TDD)
- Core implementation third
- Integration fourth
- UI fifth
- Testing throughout

**Parallel Execution**:
- All recipe tasks [P]
- All contract test tasks [P]
- UI tasks [P] after core complete

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks following TDD)
**Phase 5**: Validation (run quickstart.md scenarios)

## Complexity Tracking
No violations - design follows all constitutional principles:
- Single project (Electron app)
- Direct framework usage (ONE.core)
- No unnecessary patterns
- Real dependencies in tests
- IPC-first architecture

## Progress Tracking

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

## Implementation Notes

### Critical Success Factors
1. **Reuse existing components** - Don't reinvent keyword extraction or trust
2. **Privacy by default** - Opt-in sharing, no automatic exposure
3. **Performance first** - Cache aggressively, compute async
4. **Federation ready** - Design for multi-instance from start

### Risk Mitigations
1. **Spam prevention** - Rate limiting, trust requirements
2. **Quality control** - Multi-factor trust scoring
3. **Privacy protection** - Sanitization, consent tracking
4. **Scale preparation** - Efficient matching algorithms

### Next Command
Ready for `/tasks` command to generate detailed implementation tasks.