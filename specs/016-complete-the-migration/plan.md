# Implementation Plan: Complete TypeScript Migration

**Branch**: `016-complete-the-migration` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-complete-the-migration/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
   → Feature spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION) ✓
   → Detect Project Type: Electron desktop app (single project with main/renderer split)
   → Set Structure Decision: Option 1 (single project) with Electron-specific structure
3. Evaluate Constitution Check section below ✓
   → No violations - migration task aligns with simplicity principles
   → Update Progress Tracking: Initial Constitution Check ✓
4. Execute Phase 0 → research.md ✓
   → Technical migration - no unknowns to resolve
5. Execute Phase 1 → contracts, data-model.md, quickstart.md [IN PROGRESS]
6. Re-evaluate Constitution Check section
   → Post-design validation pending
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Complete the TypeScript migration of 82 remaining JavaScript files in the main/ directory to enable proper build process without manual file copying. The migration will allow the build system to process all source files uniformly, ensuring all modules are compiled to dist/ and the application runs correctly.

**Technical Approach**: Convert JavaScript files to TypeScript while maintaining exact functionality, update tsconfig.main.json to remove exclusions, and ensure build process handles all files uniformly.

## Technical Context

**Language/Version**: TypeScript 5.7.2 (Node.js ESM runtime)
**Primary Dependencies**: Electron 32.3.3, @refinio/one.core (beta-3), @refinio/one.models (beta-6)
**Storage**: ONE.core file-based storage in OneDB directory
**Testing**: Manual smoke testing + build verification (no existing test suite)
**Target Platform**: Electron desktop (macOS/Windows/Linux), Node.js main process
**Project Type**: Electron app (main process = backend, renderer = frontend UI)
**Performance Goals**: Build time <30s for incremental builds, no runtime overhead
**Constraints**: Must maintain exact functionality, no breaking changes to IPC contracts, preserve CommonJS module patterns where needed
**Scale/Scope**: 82 JavaScript files across main/types/, main/core/, main/ipc/, main/services/

**Additional Context**:
- tsconfig.main.json currently excludes all .js files (`"exclude": ["**/*.js"]`)
- Build process: `npm run build:main` compiles TypeScript via tsc
- Runtime: `npm run electron` launches from dist/lama-electron-shadcn.js
- Current workaround: Manual file copying to dist/ directory

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 2 (main process + renderer UI)
- Using framework directly? YES (Electron API, ONE.core API directly)
- Single data model? YES (ONE.core object model used throughout)
- Avoiding patterns? YES (direct function calls, no unnecessary abstractions)

**Architecture**:
- EVERY feature as library? N/A (application code, not libraries)
- Libraries listed: N/A (migration task, not new feature)
- CLI per library: N/A
- Library docs: N/A

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? N/A (migration maintains existing functionality)
- Git commits show tests before implementation? N/A (no test suite exists)
- Order: Contract→Integration→E2E→Unit strictly followed? N/A (no tests being written)
- Real dependencies used? N/A
- Integration tests for: contract changes? NO contract changes (migration only)
- **Migration-specific validation**: Build must succeed, application must launch, smoke test all features

**Observability**:
- Structured logging included? YES (existing console logging preserved)
- Frontend logs → backend? YES (existing IPC error forwarding preserved)
- Error context sufficient? YES (existing error handling preserved)

**Versioning**:
- Version number assigned? N/A (internal migration, no API changes)
- BUILD increments on every change? N/A
- Breaking changes handled? NO breaking changes (migration maintains compatibility)

**Constitution Compliance Notes**:
- Single ONE.core in Node.js: ✓ Preserved (migration doesn't change architecture)
- IPC-first communication: ✓ Preserved (IPC handlers remain unchanged)
- Fail-fast philosophy: ✓ Preserved (error handling unchanged)
- No browser ONE.core: ✓ Already compliant (main/ is Node.js only)

## Project Structure

### Documentation (this feature)
```
specs/016-complete-the-migration/
├── spec.md             # Feature specification
├── plan.md             # This file (/plan command output)
├── research.md         # Phase 0 output (/plan command)
├── data-model.md       # Phase 1 output (/plan command)
├── quickstart.md       # Phase 1 output (/plan command)
└── tasks.md            # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Electron application structure (existing)
main/                    # Node.js main process (TO BE MIGRATED)
├── types/              # 4 .js files → .ts
├── core/               # 52 .js files → .ts
├── ipc/                # 5 .js files → .ts
│   └── handlers/       # 17 .js files → .ts
├── services/           # 3 .js files → .ts
├── models/             # 0 .js files (already TypeScript)
└── utils/              # 1 .js file → .ts

electron-ui/            # React renderer process (already TypeScript)
├── src/
│   ├── components/
│   ├── pages/
│   └── services/

dist/                   # Build output (generated by tsc)
├── main/
├── electron-ui/
└── lama-electron-shadcn.js
```

**Structure Decision**: Existing Electron structure preserved - main/ directory migration only

## Phase 0: Outline & Research

### Migration Analysis

**Decision**: Convert all 82 JavaScript files to TypeScript using incremental migration strategy

**Rationale**:
1. **Build System Requirement**: tsconfig.main.json excludes .js files, requiring manual copying
2. **Type Safety**: TypeScript provides better IDE support and catches errors at compile time
3. **Consistency**: Codebase is already 60% TypeScript (119 .ts files vs 82 .js files)
4. **Zero Runtime Cost**: TypeScript is erased at compile time, no performance impact

**Migration Strategy**:
1. **Preserve Functionality**: Rename .js → .ts, add minimal types (use `any` where needed)
2. **Maintain Module System**: Keep CommonJS patterns where they exist (require/module.exports)
3. **No Refactoring**: Do not change logic, structure, or patterns during migration
4. **Incremental Validation**: Build and test after each directory migration

**Alternatives Considered**:
- **Keep JavaScript**: Rejected - requires ongoing manual file copying, inconsistent codebase
- **Update tsconfig allowJs**: Rejected - doesn't solve build output issue, .js files still not compiled
- **Big Bang Migration**: Rejected - too risky, prefer directory-by-directory approach

### TypeScript Configuration Changes

**Decision**: Remove `"exclude": ["**/*.js"]` from tsconfig.main.json after migration

**Rationale**: Once all files are TypeScript, exclusion is unnecessary and can cause confusion

**Build Process Verification**:
- `npm run build:main` must compile all files to dist/
- `npm run electron` must launch without errors
- All IPC handlers must remain functional

### Risk Assessment

**Low Risk Items**:
- Type definitions (can use `any` temporarily)
- Simple utility functions
- Type-only files

**Medium Risk Items**:
- IPC handlers (critical for app functionality)
- ONE.core integration code (complex API surface)
- LLM integration (async operations)

**High Risk Items**:
- Node.js-specific modules (instance.js, node-one-core.js)
- Federation/sync code (complex state management)
- QUIC transport (low-level networking)

**Mitigation Strategy**: Test after each directory, maintain smoke test checklist

**Output**: research.md with migration strategy documented

## Phase 1: Design & Contracts

### Data Model

**No new data models** - This is a migration task that preserves existing models.

See: `data-model.md` for documentation of existing ONE.core object models used.

### API Contracts

**No API changes** - All IPC contracts remain identical. Migration is internal implementation only.

**Preserved Contracts**:
- IPC handlers in `/main/ipc/handlers/*.js` maintain exact signatures
- ONE.core API usage patterns remain unchanged
- Electron IPC protocol unchanged

See: `contracts/ipc-handlers.md` for existing contract documentation

### Migration Contracts (Build Verification)

The "contract" for this migration is successful build + runtime:

```typescript
// Contract: Build succeeds
interface BuildContract {
  command: "npm run build:main"
  exitCode: 0
  distFiles: string[] // All main/ files present in dist/
}

// Contract: Application launches
interface RuntimeContract {
  command: "npm run electron"
  exitCode: 0 | "running" // App starts without crashes
  features: {
    login: "functional"
    createConversation: "functional"
    sendMessage: "functional"
    aiResponse: "functional"
  }
}
```

### Test Scenarios

**Build Verification Test** (automated):
```bash
# Clean build test
rm -rf dist/
npm run build:main
test -f dist/lama-electron-shadcn.js
test -d dist/main/core
test -d dist/main/ipc/handlers
```

**Smoke Test Checklist** (manual):
1. Launch app: `npm run electron`
2. Login with test credentials
3. Create new conversation
4. Send message to contact
5. Send message to AI assistant
6. Verify AI response received
7. Export conversation
8. Check console for errors

### Quickstart

See: `quickstart.md` for step-by-step migration execution guide

### Agent Context Update

LAMA already has comprehensive CLAUDE.md - no updates needed for migration task.

**Phase 1 Output Summary**:
- ✓ data-model.md: Documents existing models (no new models)
- ✓ contracts/ipc-handlers.md: Documents existing IPC contracts (no changes)
- ✓ quickstart.md: Migration execution guide
- ✓ No agent updates needed (migration-specific, not feature)

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. **Load task template** from `/spec/templates/tasks-template.md`
2. **Generate directory-based migration tasks**:
   - Each directory (types/, core/, ipc/, services/) → one migration task
   - Each task includes: rename files, add types, verify build
3. **Generate verification tasks**:
   - Build verification after each directory
   - Final smoke test after all migrations
4. **Generate cleanup tasks**:
   - Update tsconfig.main.json (remove .js exclusion)
   - Update documentation (CLAUDE.md if needed)

**Task Ordering**:
1. Migrate low-risk directories first (types/, utils/)
2. Migrate medium-risk directories (services/, ipc/handlers)
3. Migrate high-risk directories last (core/)
4. Final verification and cleanup

**Parallelization**:
- Directory migrations are independent → mark [P] for parallel execution
- Verification tasks are sequential → no [P] marker

**Estimated Output**: 12-15 numbered tasks in tasks.md
- 4-5 migration tasks (one per directory group)
- 4-5 build verification tasks
- 2-3 smoke test tasks
- 1-2 cleanup tasks

**Task Template Example**:
```
### Task 1: Migrate main/types/ directory [P]
**File**: main/types/*.js → *.ts
**Approach**: Rename files, add basic type annotations
**Verification**: `npm run build:main` succeeds
**Estimated Complexity**: Low
```

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run build, smoke tests, verify all features work)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - Migration task is straightforward and follows simplicity principles.

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
- [x] All NEEDS CLARIFICATION resolved (none existed)
- [x] Complexity deviations documented (none exist)

**Execution Notes**:
- Migration is technical task with clear scope and low risk
- No new features, APIs, or data models introduced
- Constitution compliance maintained throughout
- Ready for /tasks command to generate detailed implementation tasks

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
