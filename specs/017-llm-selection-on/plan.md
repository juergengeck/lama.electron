# Implementation Plan: Ollama Network Service Support

**Branch**: `017-llm-selection-on` | **Date**: 2025-10-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-llm-selection-on/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ All context resolved via research
   → Detect Project Type: Electron (main+renderer)
   → Set Structure Decision: Electron architecture
3. Evaluate Constitution Check section below
   → ✅ No violations detected
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → ✅ Complete - see research.md
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → ✅ Complete - all artifacts generated
6. Re-evaluate Constitution Check section
   → ✅ Post-design check passed
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
   → ✅ Described below
8. STOP - Ready for /tasks command
   → ✅ Planning complete
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Adding network Ollama support to LAMA Electron enables users to configure remote Ollama servers instead of being limited to localhost. This supports team collaboration, remote GPU access, and flexible deployment architectures. Implementation extends the existing LLM recipe with network configuration fields, adds IPC handlers for configuration management, and updates UI components to support network endpoints with optional authentication.

**Key Technical Approach**:
- Extend existing LLM recipe (backward compatible)
- Add IPC handlers for network config (maintains LAMA architecture)
- Secure credential storage via Electron safeStorage
- Pre-validate connections before saving (fail-fast philosophy)
- Dynamic model discovery from configured servers

## Technical Context
**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Electron (safeStorage), node-fetch, @refinio/one.core
**Storage**: ONE.core versioned objects (existing LLM recipe)
**Testing**: Integration tests with real Ollama instances
**Target Platform**: Electron (macOS/Linux/Windows)
**Project Type**: Electron (main process + renderer process)
**Performance Goals**: <2s connection validation, <100ms config retrieval
**Constraints**: No browser-side ONE.core, all config via IPC, fail-fast error handling
**Scale/Scope**: Single user, 1-10 network Ollama configurations, encrypted credential storage

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 2 (main process, renderer process) ✅
- Using framework directly? Yes - Electron IPC, ONE.core storage ✅
- Single data model? Yes - LLM recipe extension only ✅
- Avoiding patterns? Yes - No repository/UoW, direct ONE.core access ✅

**Architecture**:
- EVERY feature as library? N/A - Electron app, not library-based ✅
- Libraries listed: Using existing services (llm-manager, ollama service) ✅
- CLI per library: N/A - Electron GUI app ✅
- Library docs: N/A - Internal modules ✅

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES - Contract tests written first ✅
- Git commits show tests before implementation? YES - TDD workflow ✅
- Order: Contract→Integration→E2E→Unit strictly followed? YES ✅
- Real dependencies used? YES - Real Ollama, real ONE.core storage ✅
- Integration tests for: new IPC handlers, LLM recipe changes, config flows? YES ✅
- FORBIDDEN: Implementation before test, skipping RED phase ✅

**Observability**:
- Structured logging included? YES - Console logs with [LLMConfig] prefix ✅
- Frontend logs → backend? YES - Via main-process-log IPC ✅
- Error context sufficient? YES - Error codes + human messages ✅

**Versioning**:
- Version number assigned? Feature #017 ✅
- BUILD increments on every change? YES - Git commits tracked ✅
- Breaking changes handled? N/A - Backward compatible extension ✅

**LAMA-Specific (Constitution)**:
- Single ONE.core (Node.js only)? YES - No browser ONE.core ✅
- All data via IPC? YES - All config operations via IPC ✅
- Fail-fast (no fallbacks)? YES - Connection errors fail immediately ✅
- No browser AppModel? YES - UI uses IPC bridge only ✅

## Project Structure

### Documentation (this feature)
```
specs/017-llm-selection-on/
├── plan.md              # This file (/plan command output)
├── spec.md              # Feature specification (already exists)
├── research.md          # Phase 0 output (/plan command) ✅
├── data-model.md        # Phase 1 output (/plan command) ✅
├── quickstart.md        # Phase 1 output (/plan command) ✅
├── contracts/           # Phase 1 output (/plan command) ✅
│   └── ipc-contracts.md
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (Electron architecture)
```
main/                           # Node.js main process
├── ipc/handlers/
│   └── llm-config.ts          # NEW: Network Ollama IPC handlers
├── services/
│   ├── llm-manager.ts         # MODIFY: Use configurable Ollama endpoint
│   └── ollama.ts              # MODIFY: Accept baseUrl parameter
├── recipes/
│   └── LLM.ts                 # MODIFY: Add network config fields
└── types/
    └── llm-config.ts          # NEW: Type definitions

electron-ui/                    # Browser renderer process
├── src/components/
│   ├── ModelOnboarding.tsx    # MODIFY: Add network option
│   └── Settings/
│       └── LLMSettings.tsx    # NEW: Settings page for LLM config
└── src/services/
    └── ollama.ts              # NO CHANGES (browser helper only)

tests/
├── integration/
│   └── ipc-llm-config.test.ts # NEW: Integration tests for IPC handlers
└── e2e/
    └── network-ollama.test.ts # NEW: End-to-end scenarios
```

**Structure Decision**: Electron architecture (main process for logic, renderer for UI, IPC for communication)

## Phase 0: Outline & Research
**Status**: ✅ Complete

**Output**: [research.md](./research.md)

**Key Findings**:
- Existing LLM recipe already has `modelType: 'local' | 'remote'` - perfect for extension
- Ollama service hardcoded to localhost - needs endpoint configuration
- No existing settings UI for LLM config - need to create
- Electron safeStorage provides OS-level encryption for credentials
- Bearer token authentication sufficient for most use cases

**Decisions Made**:
1. Extend LLM recipe with `baseUrl`, `authType`, `encryptedAuthToken` fields
2. Make Ollama service endpoint-configurable with localhost fallback
3. Use bearer token auth with Electron safeStorage encryption
4. Validate URL format + test connectivity before saving
5. Add network option to ModelOnboarding + create LLMSettings component
6. Create 5 new IPC handlers for config management
7. Pre-fill localhost:11434 for local mode
8. Fail fast with clear errors, no retries

## Phase 1: Design & Contracts
**Status**: ✅ Complete

**Outputs**:
- [data-model.md](./data-model.md) - LLM recipe extension, validation rules, state transitions
- [contracts/ipc-contracts.md](./contracts/ipc-contracts.md) - 5 IPC handler contracts with request/response schemas
- [quickstart.md](./quickstart.md) - 10 acceptance test scenarios

**Key Entities**:

### OllamaConfig (extends LLM recipe)
- `baseUrl?: string` - Ollama server address
- `authType?: 'none' | 'bearer'` - Authentication method
- `encryptedAuthToken?: string` - Encrypted bearer token
- Validation: URL format, connectivity test, model availability

### IPC Contracts (5 handlers)
1. `llm:testOllamaConnection` - Validate server & fetch models
2. `llm:setOllamaConfig` - Save configuration (with encryption)
3. `llm:getOllamaConfig` - Retrieve current config (never expose token)
4. `llm:getAvailableModels` - List models from server
5. `llm:deleteOllamaConfig` - Remove configuration (soft delete)

**Contract Tests**: Integration tests in `/tests/integration/ipc-llm-config.test.ts` (RED-GREEN-Refactor)

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

### From Contracts (IPC Handlers)
For each of 5 IPC contracts:
1. **Contract Test Task** [P] - Write failing integration test
2. **Implementation Task** - Implement handler to pass test
3. **Error Handling Task** - Add all error code paths

### From Data Model (LLM Recipe)
1. **Recipe Extension Task** [P] - Add optional fields to LLM.ts
2. **Validation Task** - Implement URL + connectivity validation
3. **Encryption Task** - Add safeStorage integration for tokens
4. **Migration Task** - Ensure backward compatibility for existing configs

### From UI Components
1. **ModelOnboarding Update** [P] - Add network Ollama option
2. **LLMSettings Component** [P] - Create settings page
3. **Network Config Form** - Build input fields + validation
4. **Connection Test UI** - Add test button + loading states
5. **Error Display** - Show clear error messages

### From Services
1. **Ollama Service Update** - Make endpoint configurable
2. **LLMManager Update** - Load network config, use dynamic endpoint
3. **Config Manager** - Create service for config CRUD operations

### From Quickstart Scenarios
For each of 10 scenarios:
1. **E2E Test Task** - Automate scenario or manual test checklist

### Ordering Strategy:
1. **Foundation** (parallel where possible):
   - [P] Recipe extension
   - [P] Type definitions
   - [P] Contract test stubs

2. **Core Services** (sequential on foundation):
   - Config validation logic
   - Encryption integration
   - IPC handler implementations

3. **UI Layer** (parallel after services):
   - [P] ModelOnboarding updates
   - [P] LLMSettings component
   - [P] Error handling UI

4. **Integration** (after UI + services):
   - E2E test scenarios
   - Quickstart validation
   - Error flow testing

5. **Verification** (final):
   - Run all tests (contract, integration, e2e)
   - Execute quickstart scenarios
   - Constitutional compliance check

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md

**Task Categories**:
- 15 tasks: IPC handlers (contracts + implementations)
- 8 tasks: Data model & services
- 10 tasks: UI components & forms
- 5 tasks: Testing & validation
- 2 tasks: Final verification

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

**No violations detected** - All constitutional requirements met:
- ✅ Single ONE.core in Node.js only
- ✅ All operations via IPC
- ✅ Fail-fast error handling
- ✅ TDD approach (tests before implementation)
- ✅ Real dependencies in tests
- ✅ No browser-side ONE.core

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

**Artifacts Generated**:
- [x] research.md - Technical decisions and analysis
- [x] data-model.md - LLM recipe extension and validation
- [x] contracts/ipc-contracts.md - IPC handler contracts
- [x] quickstart.md - Acceptance test scenarios
- [x] plan.md - This implementation plan

**Next Steps**:
1. Run `/tasks` command to generate tasks.md from this plan
2. Execute tasks in order (TDD: tests first)
3. Validate with quickstart.md scenarios
4. Verify constitutional compliance

---
*Based on LAMA Constitution v1.0.0 - See `/spec/memory/constitution.md`*
*Phase template: `/spec/templates/plan-template.md`*
