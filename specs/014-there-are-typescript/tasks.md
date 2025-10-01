# Tasks: TypeScript Code Quality and Type Safety Restoration

**Input**: Design documents from `/specs/014-there-are-typescript/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Extract: TypeScript 5.x, Electron, @refinio/one.core, 383 errors
2. Load optional design documents: ✓
   → data-model.md: IPC contracts, ONE.core types, LAMA objects
   → contracts/: ipc-contracts.ts, one-core-types.ts
   → research.md: 6 error categories, import fixes, null safety
3. Generate tasks by category: ✓
   → Setup: type definitions, configuration
   → Tests: failing tests for type validation (TDD)
   → Core: fix errors by category without casts
   → Integration: IPC type safety, ONE.core alignment
   → Polish: typecheck validation, lint fixes
4. Apply task rules: ✓
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- Process designation: (main), (renderer), (shared)

## Phase 3.1: Setup & Foundation

### T001 Create Type Definition Files
**Process**: (shared)
**Objective**: Establish type definition structure without casts
```
- Create main/types/one-core.d.ts with proper beta-3 types
- Create main/types/ipc-contracts.d.ts for IPC type safety
- Create main/types/lama-objects.d.ts for custom LAMA types
- NO type assertions - only proper interface definitions
```

### T002 [P] Install Missing Type Dependencies
**Process**: (shared)
**Objective**: Add missing @types packages
```
- Add @types/node-fetch to resolve TS2307 errors
- Update @refinio/one.core to ensure beta-3 compatibility
- Verify electron types are current
- Update tsconfig.json with proper module resolution
```

### T003 [P] Configure TypeScript Strict Mode
**Process**: (shared)
**Objective**: Enable proper null safety checking
```
- Update tsconfig.json with strictNullChecks: true
- Add noImplicitAny: true to catch unknown types
- Configure exactOptionalPropertyTypes: true
- Set strict: true for all type checking
```

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

### T004 Create Type Contract Validation Tests
**Process**: (main)
**Objective**: Tests that will fail with current type errors
```
- Create tests/integration/type-contracts.test.ts
- Test IPC handler type contracts from contracts/ipc-contracts.ts
- Test ONE.core object type validation from contracts/one-core-types.ts
- Tests MUST fail initially - proving type errors exist
```

### T005 [P] Create Import Resolution Tests
**Process**: (main)
**Objective**: Test that all imports resolve correctly
```
- Create tests/unit/import-resolution.test.ts
- Test each problematic import from research.md findings
- Verify ONE.core beta-3 API compatibility
- Tests MUST fail with current import errors
```

### T006 [P] Create Null Safety Validation Tests
**Process**: (main)
**Objective**: Test null/undefined handling without casts
```
- Create tests/unit/null-safety.test.ts
- Test undefined handling patterns from data-model.md
- Validate type guard functions work correctly
- Tests MUST fail with current null safety issues
```

## Phase 3.3: Core Implementation (Fix TypeScript Errors)

### T007 Fix Import/Module Resolution Errors (42 errors)
**Process**: (main)
**Priority**: Critical - foundation for all other fixes
```
File: main/core/message-assertion-certificates.ts
- Fix: import '@refinio/one.core/lib/keychain/certificates.js'
- Replace with correct ONE.core beta-3 import path
- NO type casts - use proper import resolution

File: main/core/message-versioning.ts
- Fix: import from '@refinio/one.models/lib/models/Chat/ChatModel.js'
- Replace with ONE.core beta-3 equivalent or remove if obsolete

File: main/core/message-replication.ts
- Fix: import '../../electron-ui/node_modules/@refinio/one.models/lib/models/Topics/TopicModel.js'
- Use direct ONE.core import instead of electron-ui path
```

### T008 [P] Fix Property Access Errors - Keychain API (main/core/instance.ts)
**Process**: (main)
**Objective**: Align with ONE.core beta-3 keychain API
```
- Fix: keychain.createKeys() property access error
- Research correct beta-3 keychain API method name
- Update call to use proper API without type assertions
- Validate with type contract tests
```

### T009 [P] Fix Property Access Errors - NodeOneCore Interface
**Process**: (main)
**Files**: main/core/node-one-core.ts, main/core/federation-api.ts
```
- Fix missing 'commServerUrl' property on NodeOneCore
- Fix missing 'connectionRouteManager' property access
- Add proper interface definitions or use correct API paths
- NO property access casts - fix interface definitions
```

### T010 Fix Type Assignment Errors - LLM Object Construction (main/core/llm-object-manager.ts)
**Process**: (main)
**Objective**: Add missing required properties
```
- Fix: LLM object missing 'modelId' property (TS2769)
- Add required 'modelId' field to LLM object construction
- Use type guards from contracts/one-core-types.ts
- Validate object shapes before storage operations
```

### T011 [P] Fix Null Safety - Instance ID Handling
**Process**: (main)
**Files**: main/core/federation-api.ts, main/core/instance-manager.ts
```
- Fix: undefined instanceId passed to getInstanceEndpoint
- Add null checks before API calls
- Use type guards instead of type assertions
- Pattern: if (!instanceId) throw new Error('Instance ID required')
```

### T012 [P] Fix Type Assignment - SHA256IdHash String Conversion
**Process**: (main)
**Files**: main/core/feed-forward/manager.ts
```
- Fix: string not assignable to SHA256IdHash<OneVersionedObjectTypes>
- Use proper type construction from contracts/one-core-types.ts
- Implement createTopicId/createChannelId helper functions
- NO 'as SHA256IdHash' casts - use validation functions
```

### T013 Fix Unknown Type Handling (main/core/device-manager.ts, main/core/llm-object-manager.ts)
**Process**: (main)
**Objective**: Replace 'unknown' with proper types using type guards
```
- Fix: 'd' is of type 'unknown' errors
- Fix: 'llm' is of type 'unknown' errors
- Implement type guard functions from contracts/one-core-types.ts
- Pattern: if (!isValidType(obj)) throw new TypeError('Invalid type')
```

### T014 [P] Fix Message Flow Tracer Math Operations
**Process**: (main)
**File**: main/core/message-flow-tracer.ts
```
- Fix: arithmetic operations with non-numeric types
- Add proper type checks before math operations
- Convert timestamp strings to numbers with validation
- NO numeric type casts - validate input types first
```

### T015 [P] Fix Recipe Type Assignment (main/core/node-one-core.ts)
**Process**: (main)
**Objective**: Align recipe objects with ONE.core beta-3 Recipe interface
```
- Fix: $type$ string not assignable to "Recipe" literal
- Update recipe object construction to match beta-3 interface
- Use proper Recipe type from ONE.core imports
- Validate recipe structure before registration
```

### T016 Fix Async Iterator Type Issues
**Process**: (main)
**Files**: main/core/llm-object-manager.ts, main/core/node-one-core.ts
```
- Fix: AsyncIterableIterator missing properties from ChannelManager
- Fix: missing Symbol.asyncIterator and Symbol.iterator methods
- Implement proper iterator interfaces or use correct API patterns
- NO iterator type casts - fix interface implementations
```

### T017 [P] Fix Storage API Migration (main/core/message-assertion-certificates.ts)
**Process**: (main)
**Objective**: Update to ONE.core beta-3 storage API
```
- Fix: getObject property does not exist on storage-versioned-objects
- Replace with correct beta-3 storage API method names
- Research: retrieveObject vs getObject vs other beta-3 methods
- Update all storage.getObject() calls to proper API
```

### T018 [P] Fix Configuration Object Properties
**Process**: (main)
**File**: main/core/node-one-core.ts
```
- Fix: 'incomingConnectionConfigurations' does not exist on ConnectionsModelConfiguration
- Research correct configuration property names in beta-3
- Update configuration objects to match proper interface
- Add type definitions if missing from ONE.core types
```

### T019 Fix Event Handler Registration (main/core/node-one-core.ts)
**Process**: (main)
**Objective**: Fix OEvent interface usage
```
- Fix: Property 'on' does not exist on OEvent
- Research correct event handler registration API in beta-3
- Update event listener patterns to match beta-3
- NO event handler type casts - use proper OEvent API
```

### T020 [P] Fix Grant Access Object Structure
**Process**: (main)
**Files**: main/core/grant-access.ts, main/core/node-one-core.ts
```
- Fix: 'appId' does not exist in type Access
- Fix: object missing properties from GroupProfile
- Add required properties: name, picture to GroupProfile objects
- Use proper Access object structure from ONE.core beta-3
```

## Phase 3.4: IPC Handler Type Safety

### T021 Apply IPC Type Contracts to Handlers
**Process**: (main)
**Files**: main/ipc/handlers/*.ts
```
- Apply contracts from contracts/ipc-contracts.ts to all IPC handlers
- Update handler signatures to match typed contracts
- Add request/response validation using type guards
- NO parameter type casts - validate inputs properly
```

### T022 [P] Update IPC Handler - Topics
**Process**: (main)
**File**: main/ipc/handlers/topics.ts
```
- Apply TopicCreateContract and TopicListContract
- Add input validation for topic creation requests
- Type return values according to contracts
- Test with T004 type contract validation tests
```

### T023 [P] Update IPC Handler - Messages
**Process**: (main)
**File**: main/ipc/handlers/chat.ts
```
- Apply MessageSendContract and MessageRetrieveContract
- Add message content validation
- Handle optional analysis parameter properly
- Return typed message objects per contract
```

### T024 [P] Update IPC Handler - Topic Analysis
**Process**: (main)
**File**: main/ipc/handlers/topic-analysis.ts
```
- Apply TopicAnalysisContract from IPC contracts
- Add keyword and subject validation
- Type analysis results according to contract
- Handle optional summary generation
```

## Phase 3.5: Renderer Process Type Safety (UI Only)

### T025 [P] Update Renderer IPC Bridge Types
**Process**: (renderer)
**File**: electron-ui/src/bridge/lama-bridge.ts
```
- Apply IPC contracts to electronAPI interface
- Add type safety for all IPC invoke calls
- NO casting of IPC responses - use type guards
- Maintain renderer = UI only principle
```

### T026 [P] Fix React Component Type Issues
**Process**: (renderer)
**Files**: electron-ui/src/components/**/*.tsx
```
- Fix component prop type mismatches
- Add proper TypeScript interfaces for component props
- Handle undefined/null props safely without casts
- Use React TypeScript patterns properly
```

### T027 [P] Update Service Layer Types
**Process**: (renderer)
**Files**: electron-ui/src/services/*.ts
```
- Apply IPC contract types to service functions
- Remove any ONE.core imports (renderer = UI only)
- Add proper error handling for IPC failures
- Type all service return values properly
```

## Phase 3.6: Polish & Validation

### T028 Run Type Contract Tests
**Process**: (main)
**Objective**: Verify all type fixes work correctly
```
- Run tests/integration/type-contracts.test.ts (from T004)
- All tests MUST pass - proving type errors are fixed
- Run tests/unit/import-resolution.test.ts (from T005)
- Run tests/unit/null-safety.test.ts (from T006)
```

### T029 [P] Full TypeScript Validation
**Process**: (shared)
**Objective**: Confirm zero TypeScript errors
```
- Run: npm run typecheck
- Expected: 0 errors (down from 383)
- Fix any remaining errors without type casts
- Document any absolutely necessary casts with justification
```

### T030 [P] Build and Runtime Validation
**Process**: (shared)
**Objective**: Ensure no runtime regressions
```
- Run: npm run build - must complete successfully
- Run: npm run electron - app must start without errors
- Test core IPC functionality: login, create topic, send message
- Verify no runtime type-related errors in console
```

### T031 [P] Lint and Code Quality
**Process**: (shared)
**Objective**: Maintain code quality standards
```
- Run: npm run lint - fix any new linting issues
- Ensure all added code follows existing patterns
- Verify CLAUDE.md guidelines are followed
- Update any outdated type-related documentation
```

## Parallel Execution Examples

### Example 1: Foundation Setup (Can run simultaneously)
```bash
# Terminal 1
claude-cli task T001  # Type definition files

# Terminal 2
claude-cli task T002  # Install dependencies

# Terminal 3
claude-cli task T003  # Configure TypeScript
```

### Example 2: Property Access Fixes (Independent files)
```bash
# Terminal 1
claude-cli task T008  # Fix keychain API (instance.ts)

# Terminal 2
claude-cli task T009  # Fix NodeOneCore interface

# Terminal 3
claude-cli task T011  # Fix null safety in federation-api.ts
```

### Example 3: Final Validation (All together)
```bash
# Terminal 1
claude-cli task T029  # TypeScript validation

# Terminal 2
claude-cli task T030  # Build validation

# Terminal 3
claude-cli task T031  # Lint validation
```

## Task Dependencies

```
Setup Phase:
T001, T002, T003 → No dependencies (can run parallel)

Test Phase:
T004, T005, T006 → Depend on T001, T002, T003

Implementation Phase:
T007 → Must complete first (import foundation)
T008-T020 → Depend on T007, can run parallel within same error category
T021-T024 → Depend on T007-T020 (IPC handlers need core fixes)
T025-T027 → Depend on T021-T024 (renderer needs IPC contracts)

Validation Phase:
T028 → Depends on all implementation tasks
T029, T030, T031 → Depend on T028, can run parallel
```

## Success Criteria

- [ ] TypeScript compilation: 0 errors (down from 383)
- [ ] Build process: Completes without errors
- [ ] App runtime: Starts and functions without type errors
- [ ] IPC type safety: All handlers use typed contracts
- [ ] No type casts: Only absolutely necessary casts documented
- [ ] Tests pass: All type validation tests succeed
- [ ] LAMA architecture: Maintained (Node.js = logic, Browser = UI)

## Implementation Notes

1. **Avoid Type Casts**: Every task emphasizes proper type fixes over `as Type` assertions
2. **TDD Approach**: Tests created first (T004-T006) that fail, then implementation makes them pass
3. **LAMA Architecture**: Maintains single ONE.core in Node.js, IPC-only communication
4. **Parallel Execution**: [P] tasks can run simultaneously to speed up development
5. **Error Categories**: Tasks grouped by research.md error analysis (imports, null safety, etc.)
6. **ONE.core Beta-3**: All fixes align with current ONE.core version, no backwards compatibility hacks