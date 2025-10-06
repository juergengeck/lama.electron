# Tasks: Ollama Network Service Support

**Input**: Design documents from `/specs/017-llm-selection-on/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Loaded - Electron architecture, TypeScript, IPC-based
   → Extract: Electron IPC, ONE.core storage, safeStorage encryption
2. Load optional design documents:
   → data-model.md: OllamaConfig entity (LLM recipe extension)
   → contracts/: 5 IPC handlers (llm:testOllamaConnection, etc.)
   → research.md: Bearer token auth, URL validation decisions
3. Generate tasks by category:
   → Setup: Type definitions, recipe extension
   → Tests: IPC handler contract tests (TDD)
   → Core: IPC handlers, validation, encryption
   → UI: ModelOnboarding update, LLMSettings component
   → Polish: E2E tests, quickstart validation
4. Apply task rules:
   → Main process IPC handlers = sequential
   → UI components = [P] parallel
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All 5 IPC contracts have tests? YES
   → LLM recipe extended? YES
   → UI components for setup + settings? YES
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **Process**: (main) = Node.js main process, (renderer) = Browser UI
- Include exact file paths in descriptions

## Path Conventions (Electron Architecture)
- **Main process**: `/main/` - Node.js, CommonJS, ONE.core operations
- **Renderer process**: `/electron-ui/src/` - Browser, ESM, React UI
- **Tests**: `/tests/integration/` and `/tests/e2e/`

---

## Phase 3.1: Setup & Foundation

### T001: Create type definitions for Ollama network configuration
**Process**: (main)
**File**: `/main/types/llm-config.ts`
**Description**: Create TypeScript types for OllamaConfig, TestConnectionRequest/Response, error codes, and all IPC handler contracts. Include ModelType ('local' | 'remote'), AuthType ('none' | 'bearer'), and all request/response interfaces from contracts/ipc-contracts.md.

### T002 [P]: Extend LLM recipe with network configuration fields
**Process**: (main)
**File**: `/main/recipes/LLM.ts`
**Description**: Add optional fields to LLM recipe: `baseUrl` (string), `authType` (string with regexp /^(none|bearer)$/), `encryptedAuthToken` (string). All fields must be optional to maintain backward compatibility with existing LLM objects.

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### T003 [P]: Contract test for llm:testOllamaConnection IPC handler
**Process**: (main)
**File**: `/tests/integration/ipc-llm-config.test.ts`
**Description**: Write integration test for `llm:testOllamaConnection` handler. Test success case (valid localhost), invalid URL error, network error, and auth failure. Use real Ollama instance (localhost:11434). Test MUST fail initially (handler doesn't exist yet).

### T004 [P]: Contract test for llm:setOllamaConfig IPC handler
**Process**: (main)
**File**: `/tests/integration/ipc-llm-config.test.ts`
**Description**: Write integration test for `llm:setOllamaConfig` handler. Test saving network config with encryption, validation failures, and ONE.core storage persistence. Verify auth token is encrypted with safeStorage. Test MUST fail initially.

### T005 [P]: Contract test for llm:getOllamaConfig IPC handler
**Process**: (main)
**File**: `/tests/integration/ipc-llm-config.test.ts`
**Description**: Write integration test for `llm:getOllamaConfig` handler. Test retrieving active config, verify token is NOT returned (only hasAuthToken boolean), test empty state. Test MUST fail initially.

### T006 [P]: Contract test for llm:getAvailableModels IPC handler
**Process**: (main)
**File**: `/tests/integration/ipc-llm-config.test.ts`
**Description**: Write integration test for `llm:getAvailableModels` handler. Test fetching from active config, fetching from specified URL, and NO_CONFIG error case. Test MUST fail initially.

### T007 [P]: Contract test for llm:deleteOllamaConfig IPC handler
**Process**: (main)
**File**: `/tests/integration/ipc-llm-config.test.ts`
**Description**: Write integration test for `llm:deleteOllamaConfig` handler. Test soft delete (sets deleted: true), verify config no longer active, test NOT_FOUND error. Test MUST fail initially.

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### T008: Implement URL validation utility
**Process**: (main)
**File**: `/main/services/ollama-validator.ts`
**Description**: Create validation function to check URL format (http/https protocol, valid hostname/IP, optional port). Return ValidationResult with error messages. Use Node.js URL class for parsing.

### T009: Implement Ollama connection testing utility
**Process**: (main)
**File**: `/main/services/ollama-validator.ts`
**Description**: Create async function to test Ollama server connectivity. Fetch /api/tags endpoint with 2-second timeout, verify response, extract models list. Handle network errors, auth failures, and no-models case. Return structured result matching TestConnectionResponse type.

### T010: Implement token encryption/decryption utilities
**Process**: (main)
**File**: `/main/services/ollama-config-manager.ts`
**Description**: Create functions using Electron safeStorage to encrypt/decrypt bearer tokens. `encryptToken(plainToken)` returns base64 string, `decryptToken(encryptedBase64)` returns plain string. Handle encryption errors gracefully.

### T011: Modify Ollama service to accept configurable endpoint
**Process**: (main)
**File**: `/main/services/ollama.ts`
**Description**: Refactor hardcoded `http://localhost:11434` to accept `baseUrl` parameter in all functions (isOllamaRunning, chatWithOllama, etc.). Default to localhost if not provided. Add optional auth headers parameter for bearer token.

### T012: Implement llm:testOllamaConnection IPC handler
**Process**: (main)
**File**: `/main/ipc/handlers/llm-config.ts`
**Description**: Implement handler that validates URL, tests connectivity, fetches models, and returns TestConnectionResponse. Use ollama-validator utilities. Handle all error codes (INVALID_URL, NETWORK_ERROR, AUTH_FAILED, NO_MODELS). This should make T003 pass.

### T013: Implement llm:setOllamaConfig IPC handler
**Process**: (main)
**File**: `/main/ipc/handlers/llm-config.ts`
**Description**: Implement handler to save Ollama config to ONE.core. Validate config, encrypt auth token (if provided), store as LLM versioned object, create AI contact Person if needed. Set active flag. This should make T004 pass.

### T014: Implement llm:getOllamaConfig IPC handler
**Process**: (main)
**File**: `/main/ipc/handlers/llm-config.ts`
**Description**: Implement handler to retrieve active Ollama config. Query LLM objects where active=true, return config with hasAuthToken boolean (NEVER return decrypted token). Compute baseUrl (default to localhost for local type). This should make T005 pass.

### T015: Implement llm:getAvailableModels IPC handler
**Process**: (main)
**File**: `/main/ipc/handlers/llm-config.ts`
**Description**: Implement handler to fetch models from Ollama server. If baseUrl provided, use it directly. Otherwise, load active config and use its baseUrl. Return models array with source indicator. This should make T006 pass.

### T016: Implement llm:deleteOllamaConfig IPC handler
**Process**: (main)
**File**: `/main/ipc/handlers/llm-config.ts`
**Description**: Implement handler to soft-delete config (set deleted: true on LLM object). If deleting active config, deactivate first. Return deleted hash. Handle NOT_FOUND error. This should make T007 pass.

### T017: Register all new IPC handlers in main process
**Process**: (main)
**File**: `/main/ipc/index.ts` (or wherever handlers are registered)
**Description**: Register all 5 new IPC handlers (llm:testOllamaConnection, llm:setOllamaConfig, llm:getOllamaConfig, llm:getAvailableModels, llm:deleteOllamaConfig) with ipcMain.handle(). Import from llm-config.ts.

### T018: Update LLMManager to use network Ollama configuration
**Process**: (main)
**File**: `/main/services/llm-manager.ts`
**Description**: Modify LLMManager to load active Ollama config from ONE.core (via llm:getOllamaConfig logic). Use config's baseUrl instead of hardcoded localhost. Include auth headers if token is configured. Update preWarmConnection() and all model operations.

---

## Phase 3.4: UI Implementation

### T019 [P]: Add network Ollama option to ModelOnboarding component
**Process**: (renderer)
**File**: `/electron-ui/src/components/ModelOnboarding.tsx`
**Description**: Add "Ollama (Network Service)" option alongside "Ollama (Local)". Show network address input field when network is selected. Pre-fill "http://localhost:11434" for local mode, empty for network mode. Add "Test Connection" button that calls llm:testOllamaConnection IPC handler.

### T020 [P]: Create LLMSettings component for settings page
**Process**: (renderer)
**File**: `/electron-ui/src/components/Settings/LLMSettings.tsx`
**Description**: Create new Settings page component for LLM configuration. Display current config (provider type, address, model). Provide "Change Provider" button to switch between local and network. Form fields for network address and authentication. Save calls llm:setOllamaConfig.

### T021 [P]: Add authentication fields to network Ollama UI
**Process**: (renderer)
**File**: `/electron-ui/src/components/Settings/LLMSettings.tsx` (or shared component)
**Description**: Add authentication section with AuthType selector ("None" / "Bearer Token"). Show token input field when Bearer is selected. Mask token input (password field). Display "configured" indicator for existing tokens (don't show plaintext).

### T022 [P]: Implement connection test UI with loading states
**Process**: (renderer)
**File**: `/electron-ui/src/components/Settings/OllamaConnectionTest.tsx`
**Description**: Create component for "Test Connection" button. Show loading spinner during test, display success message with model count, show error messages with clear guidance. Use llm:testOllamaConnection IPC handler. Handle all error codes with user-friendly messages.

### T023 [P]: Add error display components for network failures
**Process**: (renderer)
**File**: `/electron-ui/src/components/Settings/OllamaErrorDisplay.tsx`
**Description**: Create error display component that maps error codes to user-friendly messages. INVALID_URL → "URL must start with http:// or https://", NETWORK_ERROR → "Cannot connect to server. Check address and network.", etc. Include actionable guidance.

### T024: Update IPC bridge type definitions for new handlers
**Process**: (renderer)
**File**: `/electron-ui/src/bridge/lama-bridge.ts`
**Description**: Add TypeScript type definitions for all 5 new IPC handlers to the electronAPI interface. Include request/response types matching the contracts. Ensure type safety when calling window.electronAPI.invoke().

---

## Phase 3.5: Integration & Testing

### T025: Write E2E test for first-time setup with network Ollama
**Process**: (e2e)
**File**: `/tests/e2e/network-ollama-setup.test.ts`
**Description**: Automate Quickstart Scenario 2 (first-time setup with network Ollama). Test selecting network option, entering remote address, testing connection, selecting model, saving config. Verify config persists across restart.

### T026: Write E2E test for switching from local to network in settings
**Process**: (e2e)
**File**: `/tests/e2e/network-ollama-settings.test.ts`
**Description**: Automate Quickstart Scenario 3 (configure network Ollama in settings). Start with local config, switch to network, test connection, save, verify persistence. Test switching back to local.

### T027: Write E2E test for authentication with bearer token
**Process**: (e2e)
**File**: `/tests/e2e/ollama-auth.test.ts`
**Description**: Automate Quickstart Scenario 4 (authenticate to remote Ollama). Configure network server with bearer token, verify token is encrypted in storage, verify token is included in requests (check network logs), test token persists.

### T028: Write E2E test for network failure scenarios
**Process**: (e2e)
**File**: `/tests/e2e/ollama-errors.test.ts`
**Description**: Automate Quickstart Scenario 5 (handle network failures). Test unreachable server during setup, server going down during use, auth failure. Verify clear error messages, no crashes, ability to recover.

### T029 [P]: Validate all URL test cases from quickstart
**Process**: (integration)
**File**: `/tests/integration/url-validation.test.ts`
**Description**: Implement Quickstart Scenario 6 URL validation matrix. Test all valid formats (http, https, with/without port) and invalid formats (missing protocol, wrong protocol, malformed). Verify correct validation results and error messages.

---

## Phase 3.6: Polish & Validation

### T030: Run all integration tests and verify they pass
**Process**: (verification)
**Command**: `npm run test:integration`
**Description**: Execute all integration tests (T003-T007, T029). Verify all tests pass. All IPC handlers must work correctly with real ONE.core storage and real Ollama instances. Fix any failures.

### T031: Run all E2E tests and verify they pass
**Process**: (verification)
**Command**: `npm run test:e2e`
**Description**: Execute all E2E tests (T025-T028). Verify complete user flows work end-to-end. Test with real Electron app, real UI, real IPC. Fix any failures.

### T032 [P]: Execute manual quickstart validation scenarios
**Process**: (verification)
**File**: Execute `/specs/017-llm-selection-on/quickstart.md`
**Description**: Manually execute remaining quickstart scenarios not automated: Scenario 7 (switch between servers), Scenario 8 (pre-filled default), Scenario 9 (persistence), Scenario 10 (model discovery). Verify all acceptance criteria pass.

### T033 [P]: Run typecheck and lint
**Process**: (verification)
**Commands**: `npm run typecheck && npm run lint`
**Description**: Run TypeScript type checking on all new files. Run ESLint on all modified code. Fix all type errors and lint warnings. Ensure code quality standards.

### T034: Verify constitutional compliance
**Process**: (verification)
**Checklist**: LAMA Constitution v1.0.0
**Description**: Verify: (1) NO ONE.core in browser/renderer, (2) ALL data operations via IPC, (3) Fail-fast error handling (no retries), (4) Tests written before implementation, (5) Real dependencies used. Document compliance.

### T035: Update CLAUDE.md with network Ollama context
**Process**: (documentation)
**File**: `/CLAUDE.md`
**Description**: Add section documenting network Ollama feature. Include: LLM recipe fields (baseUrl, authType), IPC handlers (5 new handlers), authentication approach (safeStorage encryption), UI components (ModelOnboarding, LLMSettings). Keep additions concise (<50 lines).

---

## Dependencies

**Foundation** (can run in parallel):
- T001 (types) blocks nothing initially
- T002 (recipe) blocks T013 (needs recipe fields for storage)

**Tests Before Implementation** (TDD):
- T003-T007 [P] → Must complete and FAIL before T012-T016
- T003 blocks T012 (test must exist first)
- T004 blocks T013 (test must exist first)
- T005 blocks T014 (test must exist first)
- T006 blocks T015 (test must exist first)
- T007 blocks T016 (test must exist first)

**Core Services** (sequential):
- T008 (validation) blocks T009, T012
- T009 (connection test) blocks T012
- T010 (encryption) blocks T013
- T011 (ollama service) blocks T012, T015, T018
- T012-T016 (handlers) → sequential, block T017
- T017 (registration) blocks T018
- T018 (LLMManager) blocks E2E tests (T025-T028)

**UI Components** (can run in parallel after T024):
- T019-T023 [P] → Different files, no dependencies
- T024 (bridge types) blocks T019-T023

**Testing & Validation** (after implementation):
- T025-T029 require T012-T018 complete
- T030 runs after all integration tests written
- T031 runs after all E2E tests written
- T032-T035 [P] → Final validation, can run together

---

## Parallel Execution Examples

### Parallel Set 1: Foundation (after T001 complete)
```bash
# These tasks modify different files and have no dependencies
Task: "Extend LLM recipe with network fields in /main/recipes/LLM.ts"
```

### Parallel Set 2: Contract Tests (TDD - must fail initially)
```bash
# Launch T003-T007 together (all write to same file but independent test cases)
# Note: Same file means NOT truly parallel - run sequentially
Task: "Contract test llm:testOllamaConnection in /tests/integration/ipc-llm-config.test.ts"
Task: "Contract test llm:setOllamaConfig in /tests/integration/ipc-llm-config.test.ts"
Task: "Contract test llm:getOllamaConfig in /tests/integration/ipc-llm-config.test.ts"
Task: "Contract test llm:getAvailableModels in /tests/integration/ipc-llm-config.test.ts"
Task: "Contract test llm:deleteOllamaConfig in /tests/integration/ipc-llm-config.test.ts"
```

### Parallel Set 3: UI Components (after core implementation complete)
```bash
# Launch T019-T023 together (different files, renderer process)
Task: "Add network Ollama option to ModelOnboarding in /electron-ui/src/components/ModelOnboarding.tsx"
Task: "Create LLMSettings component in /electron-ui/src/components/Settings/LLMSettings.tsx"
Task: "Add authentication fields in /electron-ui/src/components/Settings/LLMSettings.tsx"
Task: "Implement connection test UI in /electron-ui/src/components/Settings/OllamaConnectionTest.tsx"
Task: "Add error display in /electron-ui/src/components/Settings/OllamaErrorDisplay.tsx"
```

### Parallel Set 4: Final Validation
```bash
# Launch T032-T035 together (independent verification tasks)
Task: "Execute manual quickstart scenarios"
Task: "Run typecheck and lint"
Task: "Verify constitutional compliance"
Task: "Update CLAUDE.md documentation"
```

---

## Task Execution Order (Recommended)

1. **Setup**: T001, T002
2. **Tests (TDD)**: T003, T004, T005, T006, T007 (verify all FAIL)
3. **Validation Utils**: T008, T009, T010
4. **Service Updates**: T011
5. **IPC Handlers**: T012, T013, T014, T015, T016, T017
6. **LLM Integration**: T018
7. **UI Bridge**: T024
8. **UI Components**: T019, T020, T021, T022, T023
9. **E2E Tests**: T025, T026, T027, T028
10. **Integration Tests**: T029
11. **Verification**: T030, T031
12. **Final Polish**: T032, T033, T034, T035

---

## Notes

- **[P] tasks**: Different files, can theoretically run in parallel (use judgment)
- **TDD Critical**: T003-T007 MUST be written and FAIL before T012-T016
- **Process designation**: (main) = Node.js only, (renderer) = Browser only
- **IPC Convention**: All handlers in main process, called via window.electronAPI.invoke()
- **Security**: NEVER return decrypted tokens in IPC responses
- **Testing**: Use real Ollama instance (localhost:11434) for integration tests
- **Commit strategy**: Commit after each task completion
- **Constitutional**: NO ONE.core in renderer, ALL operations via IPC

---

## Validation Checklist
*GATE: Checked before marking feature complete*

- [x] All 5 IPC contracts have corresponding tests (T003-T007)
- [x] LLM recipe extended with network fields (T002)
- [x] All tests come before implementation (T003-T007 before T012-T016)
- [x] Parallel tasks truly independent (different files verified)
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task (UI components in different files)
- [x] TDD workflow enforced (tests must fail first)
- [x] Constitutional compliance verified (T034)

**Total Tasks**: 35
**Estimated Completion**: 3-5 days (with TDD, testing, and validation)
