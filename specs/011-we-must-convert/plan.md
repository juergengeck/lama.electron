# TypeScript Migration Plan for LAMA Electron

**Feature**: Complete TypeScript Migration
**Branch**: `011-we-must-convert`
**Status**: Implementation Ready

## Current State Analysis

### Progress Summary
- **Renderer Process**: ~72% migrated (110 TS files, 42 JS remaining)
- **Main Process**: ~5% migrated (5 TS files, 108 JS remaining)
- **Total Files to Migrate**: ~150 JavaScript files

### Build Infrastructure Status
- ✅ TypeScript installed and configured for renderer
- ✅ Vite handles renderer TypeScript compilation
- ❌ No TypeScript compilation for main process
- ⚠️ Mixed module systems (ESM declared, CommonJS used)

## Migration Phases

### Phase 0: Infrastructure Setup (2-3 days)
**Goal**: Establish TypeScript build pipeline for main process

**Tasks**:
1. Configure TypeScript for main process
   - Create `tsconfig.main.json` for main process
   - Set up build scripts for TypeScript compilation
   - Configure source maps for debugging

2. Resolve module system conflict
   - Decide: Convert to full ESM or maintain CommonJS
   - Update package.json type field accordingly
   - Configure TypeScript module resolution

3. Set up type definitions
   - Create shared types directory
   - Define IPC channel types
   - Import existing ONE.core type definitions

**Success Criteria**:
- Can compile a test .ts file in main process
- Build process handles both JS and TS files
- Electron app still launches successfully

---

### Phase 1: Entry Points (3-4 days)
**Goal**: Migrate critical entry points to establish TypeScript foundation

**Files to Convert**:
```
1. main-one-core.js → main-one-core.ts
2. electron-preload.js → electron-preload.ts
3. lama-electron-shadcn.js → lama-electron-shadcn.ts
4. main/ipc/controller.js → main/ipc/controller.ts
```

**Approach**:
- Start with minimal type annotations (any where needed)
- Focus on getting files to compile
- Add proper types incrementally
- Maintain backward compatibility

**Risks**:
- Entry points are critical - app won't start if broken
- Dynamic imports may need special handling
- Electron API types need careful attention

---

### Phase 2: IPC Layer (1 week)
**Goal**: Type-safe communication between main and renderer

**Files to Convert** (20 handlers):
```
main/ipc/handlers/
├── ai.js → ai.ts
├── auth.js → auth.ts
├── channels.js → channels.ts
├── chat.js → chat.ts
├── contacts.js → contacts.ts
├── export.js → export.ts
├── feed-forward.js → feed-forward.ts
├── iom.js → iom.ts
├── misc.js → misc.ts
├── one-core.js → one-core.ts
├── recipes.js → recipes.ts
├── topic-analysis.js → topic-analysis.ts
└── [remaining handlers]
```

**Approach**:
1. Define IPC channel types first
2. Create shared request/response types
3. Convert handlers in dependency order
4. Add runtime type validation

**Benefits**:
- Immediate type safety for UI↔backend communication
- Catch protocol mismatches at compile time
- Better IDE support for IPC calls

---

### Phase 3: Core Services (1 week)
**Goal**: Migrate business logic services

**Files to Convert** (16 services):
```
main/services/
├── llm-manager.js → llm-manager.ts (32KB)
├── node-provisioning.js → node-provisioning.ts (17KB)
├── attachments.js → attachments.ts
├── mcp-server.js → mcp-server.ts
└── [remaining services]
```

**Approach**:
- Start with leaf services (no dependencies)
- Define service interfaces
- Add proper error types
- Maintain service contracts

**Challenges**:
- LLM manager has complex streaming logic
- External API integrations need type definitions
- State management patterns vary

---

### Phase 4: Core ONE.core Integration (2 weeks)
**Goal**: Migrate the heart of the application

**Critical Files**:
```
main/core/
├── node-one-core.js → node-one-core.ts (79KB!)
├── ai-assistant-model.js → ai-assistant-model.ts (45KB)
├── ai-settings-manager.js → ai-settings-manager.ts
├── channel-manager.js → channel-manager.ts
└── [remaining core files]
```

**Approach**:
1. Study ONE.core type definitions thoroughly
2. Create wrapper types for dynamic patterns
3. Migrate in small, testable chunks
4. Extensive testing after each file

**High Risk Areas**:
- Dynamic module loading patterns
- Complex object manipulation
- Callback-based async patterns
- Global state management

---

### Phase 5: Feature Modules (1 week)
**Goal**: Complete migration of specialized features

**Directories**:
```
main/core/one-ai/ (AI analysis features)
main/core/feed-forward/ (content routing)
main/recipes/ (automation recipes)
```

**Approach**:
- These are relatively isolated
- Can be migrated independently
- Good candidates for strict TypeScript

---

### Phase 6: Renderer Cleanup (3-4 days)
**Goal**: Complete renderer migration and unify types

**Remaining Files** (42 JS files in electron-ui/src):
- Legacy components
- Utility functions
- Test files

**Tasks**:
1. Migrate remaining JS files
2. Unify type definitions with main process
3. Remove any type workarounds
4. Enable strict mode everywhere

---

## Implementation Strategy

### Incremental Migration Rules
1. **Never break the build** - maintain dual JS/TS support
2. **Test after each file** - catch issues immediately
3. **Type gradually** - use `any` initially, refine later
4. **Document patterns** - create migration guide for team

### Type Definition Strategy
```typescript
// Start permissive
function processMessage(msg: any): any

// Iterate to specific
interface Message { id: string; content: string }
function processMessage(msg: Message): ProcessedMessage

// End with strict
function processMessage(msg: Message): Result<ProcessedMessage, Error>
```

### Testing Strategy
1. **Unit tests** for each migrated module
2. **Integration tests** for IPC communication
3. **E2E tests** for critical user flows
4. **Regression suite** after each phase

### Rollback Strategy
- Git branch for each phase
- Feature flags for new TypeScript code
- Parallel JS files during transition
- Quick revert capability

---

## Resource Requirements

### Team Allocation
- **Lead Developer**: Architecture decisions, core files
- **Senior Developer**: IPC layer, services
- **Developer**: Feature modules, testing
- **QA**: Continuous testing, regression

### Timeline
- **Total Duration**: 6-8 weeks
- **Phase 0-1**: Week 1
- **Phase 2**: Week 2
- **Phase 3**: Week 3
- **Phase 4**: Weeks 4-5
- **Phase 5**: Week 6
- **Phase 6**: Week 7
- **Buffer/Testing**: Week 8

---

## Success Metrics

### Technical Metrics
- [ ] 100% TypeScript migration complete
- [ ] Zero runtime type errors
- [ ] Build time < current + 20%
- [ ] Bundle size < current + 5%

### Quality Metrics
- [ ] Type coverage > 95%
- [ ] Strict mode enabled
- [ ] All tests passing
- [ ] No performance regression

### Developer Experience
- [ ] Full IntelliSense support
- [ ] Refactoring confidence
- [ ] Reduced debugging time
- [ ] Better onboarding for new devs

---

## Risk Mitigation

### High-Risk Areas
1. **ONE.core Integration**
   - Mitigation: Extensive testing, gradual migration

2. **Module System Conflicts**
   - Mitigation: Clear decision upfront, consistent approach

3. **Breaking Changes**
   - Mitigation: Parallel implementations, feature flags

4. **Performance Impact**
   - Mitigation: Benchmark critical paths, optimize hot code

### Contingency Plans
- **If migration stalls**: Focus on IPC layer for immediate value
- **If bugs increase**: Pause and stabilize, add more tests
- **If performance degrades**: Profile and optimize, consider partial migration

---

## Next Steps

1. **Immediate Actions**:
   - [ ] Get team buy-in on approach
   - [ ] Set up TypeScript build for main process
   - [ ] Create shared types directory
   - [ ] Start Phase 0 infrastructure

2. **Week 1 Goals**:
   - [ ] Complete infrastructure setup
   - [ ] Migrate first entry point
   - [ ] Establish migration patterns
   - [ ] Document learnings

3. **Communication**:
   - Daily standup updates
   - Weekly progress reports
   - Phase completion reviews
   - Final migration celebration 🎉

---

## Appendix: Migration Checklist Template

For each file migration:
- [ ] Create .ts file alongside .js
- [ ] Copy code and add minimal types
- [ ] Fix compilation errors
- [ ] Update imports in other files
- [ ] Test functionality
- [ ] Add proper types iteratively
- [ ] Update documentation
- [ ] Remove .js file
- [ ] Commit with clear message