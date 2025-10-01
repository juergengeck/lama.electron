# Implementation Plan: LAMA Feed-Forward Information Sharing

**Branch**: `010-lama-feed-forward` | **Date**: 2025-01-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-lama-feed-forward/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ SUCCESS: Feature spec loaded and analyzed
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ All clarifications resolved (user control, retention, scale)
3. Evaluate Constitution Check section below
   → ✅ PASS: No violations, fully compliant with LAMA architecture
4. Execute Phase 0 → research.md
   → ✅ COMPLETE: Research findings documented
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → ✅ COMPLETE: All artifacts generated
6. Re-evaluate Constitution Check section
   → ✅ PASS: Design maintains compliance
7. Plan Phase 2 → Describe task generation approach
   → ✅ COMPLETE: Task strategy defined
8. STOP - Ready for /tasks command
   → ✅ READY: Tasks.md already generated
```

## Summary
Enable AI instances to continuously learn and share information through conversations by implementing a feed-forward mechanism using ONE.core versioned recipes for Supply, Demand, and Score objects (Pattern deferred to Phase 2), propagated through existing CHUM sync protocol with privacy-preserving SHA-256 keyword hashing and progressive trust-based context sharing.

## Technical Context
**Language/Version**: JavaScript (Node.js 18+), TypeScript
**Primary Dependencies**: ONE.core, Electron, React, Jest
**Storage**: ONE.core content-addressed storage (file system)
**Testing**: Jest for unit/integration tests
**Target Platform**: Electron desktop app (macOS, Windows, Linux)
**Project Type**: Single (Electron app with Node.js backend)
**Performance Goals**: <1s keyword extraction, <5s Supply/Demand propagation
**Constraints**: No central servers, fully decentralized, user privacy preserved
**Scale/Scope**: Network of any size, indefinite data retention

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**: ✅
- Projects: 1 (LAMA Electron app)
- Using framework directly? Yes (ONE.core, Electron)
- Single data model? Yes (ONE.core objects)
- Avoiding patterns? Yes (direct implementation)

**Architecture**: ✅
- EVERY feature as library? Yes (feed-forward module)
- Libraries listed:
  - `feed-forward-manager`: Orchestrates Supply/Demand lifecycle
  - `keyword-hasher`: Deterministic SHA-256 keyword hashing
  - `pattern-detector`: Network pattern analysis (Phase 2)
  - `trust-manager`: Trust score calculations
- CLI per library: N/A (IPC handlers instead)
- Library docs: Will be added to CLAUDE.md

**Testing (NON-NEGOTIABLE)**: ✅
- RED-GREEN-Refactor cycle enforced? Yes
- Git commits show tests before implementation? Yes
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (actual ONE.core, real file system)
- Integration tests for: IPC handlers, ONE.core storage, CHUM sync
- FORBIDDEN: Implementation before test ✅

**Observability**: ✅
- Structured logging included? Yes (existing LAMA logging)
- Frontend logs → backend? Yes (via IPC)
- Error context sufficient? Yes

**Versioning**: ✅
- Version number assigned? 1.0.0 (for recipes)
- BUILD increments on every change? Yes
- Breaking changes handled? Recipe versioning handles evolution

## Project Structure

### Documentation (this feature)
```
specs/010-lama-feed-forward/
├── spec.md              # Feature specification ✅
├── plan.md              # This file (updated) ✅
├── research.md          # Phase 0 output ✅
├── data-model.md        # Phase 1 output ✅
├── quickstart.md        # Phase 1 output ✅
├── contracts/           # Phase 1 output ✅
│   └── ipc-handlers.json
├── tasks.md             # Phase 2 output ✅
├── CONSOLIDATION-ANALYSIS.md  # Consistency analysis
└── RESOLVED-CONSOLIDATION.md  # Resolution documentation
```

### Source Code (repository root)
```
# LAMA Electron structure (existing + new)
main/
├── core/
│   ├── feed-forward/    # NEW
│   │   ├── manager.js
│   │   ├── recipes.js   # Supply, Demand, Score (Pattern in Phase 2)
│   │   ├── hasher.js
│   │   ├── trust.js
│   │   ├── matcher.js
│   │   └── patterns.js  # Stub for Phase 1, full in Phase 2
│   └── node-one-core.js # Existing
├── ipc/
│   ├── controller.js    # Register new handlers
│   └── handlers/
│       └── feed-forward.js # NEW - 8 IPC handlers
└── services/

electron-ui/
├── src/
│   ├── components/
│   │   ├── Settings.tsx # Update with feed-forward
│   │   └── FeedForward/ # NEW UI components
│   │       ├── Settings.tsx
│   │       ├── SupplyDemandList.tsx
│   │       ├── NetworkStatus.tsx
│   │       └── TrustManager.tsx
│   └── services/
└── tests/

tests/
└── integration/
    └── feed-forward/    # NEW test suite
        ├── test-create-supply.js
        ├── test-create-demand.js
        ├── test-matching.js
        ├── test-trust.js
        ├── test-patterns.js
        ├── test-preferences.js
        ├── test-recipes.js
        └── test-hasher.js
```

**Structure Decision**: Single project (LAMA Electron app with feed-forward module)

## Phase 0: Outline & Research
✅ **COMPLETE** - See `research.md` for detailed findings:

Key decisions made:
1. **ONE.core Versioned Recipes**: Use Recipe system for Supply, Demand, Score (Pattern deferred)
2. **CHUM Integration**: Use existing chat channels for propagation
3. **Keyword Hashing**: SHA-256 with normalization pipeline
4. **Privacy Model**: Progressive context revelation based on trust (4 levels)
5. **Pattern Detection**: Local aggregation with network snapshots (Phase 2)

**Output**: research.md with all technical decisions documented ✅

## Phase 1: Design & Contracts
✅ **COMPLETE** - All Phase 1 artifacts generated:

1. **Extract entities from feature spec** → `data-model.md`: ✅
   - Supply Recipe v1.0.0 with keywords, source, context levels
   - Demand Recipe v1.0.0 with keywords, urgency, criteria
   - Score Recipe v1.0.0 for trust relationships
   - Pattern Recipe v1.0.0 (defined but deferred to Phase 2)

2. **Generate API contracts** → `/contracts/ipc-handlers.json`: ✅
   - 8 IPC handlers for feed-forward operations
   - Message formats for Supply/Demand exchange
   - Trust score calculation contracts
   - Network status and preferences

3. **Generate contract tests**: ✅
   - 8 test files planned (one per handler)
   - Tests will fail initially (TDD approach)

4. **Extract test scenarios** → `quickstart.md`: ✅
   - 5 complete test scenarios
   - All 4 context levels tested
   - Performance validation metrics

5. **Update CLAUDE.md**: Pending (T032 in tasks.md)

**Output**: data-model.md ✅, contracts/ ✅, quickstart.md ✅

## Phase 2: Task Planning Approach
✅ **COMPLETE** - See `tasks.md` for 40 executable tasks:

**Task Generation Strategy**:
- Setup tasks (T001-T004)
- Test tasks [P] (T005-T012) - Must fail first
- Core implementation (T013-T018)
- IPC handlers (T019-T024)
- UI components [P] (T025-T029)
- Polish tasks (T030-T034)
- Pattern implementation deferred (T035-T040) for Phase 2

**Ordering Strategy**:
- TDD order: Tests before implementation ✅
- Dependency order: Core → IPC → UI ✅
- 16 tasks marked [P] for parallel execution ✅

**Output**: 40 numbered, ordered tasks in tasks.md ✅

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (tasks.md ready for execution)
**Phase 4**: Implementation (follow TDD approach)
**Phase 5**: Validation (run quickstart.md scenarios)

## Complexity Tracking
*No violations - feature fits within LAMA's existing architecture*

All design decisions align with LAMA principles:
- Single ONE.core instance (Node.js only)
- IPC for all browser communication
- Fail-fast philosophy (no fallbacks)
- Simple, direct implementation

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - approach described)
- [x] Phase 3: Tasks generated (/tasks command already run)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

## Key Clarifications Applied
Based on consolidation analysis:
1. **Knowledge Unit** = SHA-256 hashed word (no separate implementation)
2. **Pattern Recipe** = Deferred to Phase 2 for emergent properties
3. **Trust Scores** = Create first, retrieve via standard queries
4. **Retention** = Indefinite, no auto-pruning requirement
5. **Channels** = Use existing chat channels, no special feed-forward channels

---
*Based on Constitution v1.0.0 - See `/spec/memory/constitution.md`*
*All artifacts verified and consistent as of 2025-01-28*