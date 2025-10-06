# Research: TypeScript Migration Strategy

**Feature**: Complete TypeScript Migration
**Phase**: 0 - Research
**Date**: 2025-10-01

## Overview

This document captures research findings for migrating 82 JavaScript files in the main/ directory to TypeScript.

## Migration Strategy

### Decision: Incremental Directory-Based Migration

**Rationale**:
1. **Risk Mitigation**: Migrate and verify one directory at a time reduces blast radius of errors
2. **Build Verification**: Can test build after each directory to catch issues early
3. **Rollback Capability**: Easy to revert a single directory if issues arise
4. **Parallel Work**: Independent directories can be migrated in parallel if needed

**Alternatives Considered**:
- **File-by-file**: Too granular, 82 separate tasks is unwieldy
- **Big bang**: Too risky, 82 files at once makes debugging difficult
- **By feature**: Files are not organized by feature, organized by layer (types, services, etc.)

### TypeScript Conversion Approach

**Decision**: Minimal type annotations, preserve functionality exactly

**Key Principles**:
1. **Rename only**: Change .js → .ts, make minimal code changes
2. **Use `any` liberally**: Don't spend time on perfect types during migration
3. **No refactoring**: Keep existing patterns (CommonJS, function styles, etc.)
4. **Preserve exports**: Maintain exact same export signatures for IPC contracts

**TypeScript Configuration**:
- Current tsconfig.main.json has strict checking disabled (`strict: false`)
- This allows gradual type improvement post-migration
- Migration can use `any`, `@ts-ignore`, or loose types as needed

**Example Migration Pattern**:
```javascript
// Before (JavaScript)
function createContact(personId, name) {
  return {
    personId: personId,
    name: name
  }
}
module.exports = { createContact }

// After (TypeScript)
function createContact(personId: any, name: any): any {
  return {
    personId: personId,
    name: name
  }
}
export { createContact }
```

### Build System Changes

**Decision**: Remove `"exclude": ["**/*.js"]` from tsconfig.main.json after migration

**Rationale**:
- Currently needed to prevent tsc from failing on .js files
- Once all files are .ts, exclusion is unnecessary
- Removing it prevents confusion and ensures all source is compiled

**Build Verification Process**:
```bash
# After each directory migration:
npm run build:main          # Compile TypeScript
npm run electron            # Launch app (smoke test)
```

**Build Output Validation**:
- All main/ files must appear in dist/ directory
- No manual file copying required
- Application launches and runs without errors

## Directory Analysis

### Low Risk Directories (Migrate First)

**main/types/** (4 files):
- Type definition files only
- No runtime logic
- Simple to convert
- Files: ipc.js, custom-objects.js, extended-types.js, one-core.js

**main/utils/** (1 file):
- Simple utility functions
- Minimal dependencies
- Low complexity

### Medium Risk Directories (Migrate Second)

**main/services/** (3 files):
- Business logic services
- May have complex async operations
- Well-isolated, clear boundaries

**main/ipc/handlers/** (17 files):
- IPC handler implementations
- CRITICAL: Must maintain exact signatures
- Each handler is independent (good for parallel migration)

**main/ipc/** (5 files at root):
- Controller and routing logic
- Depends on handlers (migrate after handlers)

### High Risk Directories (Migrate Last)

**main/core/** (52 files):
- Complex ONE.core integration
- Federation, QUIC, LLM integration
- State management, async coordination
- Largest directory by far
- Some files are critical (instance.js, node-one-core.js)

**Migration Order Rationale**:
- Build confidence with easy directories first
- Tackle critical/complex code when migration process is proven
- Leave core/ for last when we have experience with migration patterns

## Risk Assessment

### Critical Files Requiring Extra Care

**main/core/node-one-core.js**:
- Initializes entire ONE.core instance
- Any errors prevent app from starting
- Recommendation: Test thoroughly, pair review

**main/core/instance.js**:
- Singleton instance management
- Critical for app lifecycle
- Recommendation: Add extra logging during migration

**main/ipc/controller.js**:
- Routes all IPC calls
- Failure breaks all UI communication
- Recommendation: Verify IPC still works after migration

**main/core/llm-manager.js**:
- LLM integration and streaming
- Complex async operations
- Recommendation: Test with actual LLM requests

### Common Migration Pitfalls

**Module System Mixing**:
- Issue: Some files use CommonJS (require/module.exports)
- Solution: Convert to ESM (import/export) OR keep CommonJS with proper types
- Recommendation: Keep existing pattern to minimize risk

**Dynamic Imports**:
- Issue: require() with variables doesn't work well in TypeScript
- Solution: Use import() or keep as require() with type assertion
- Example: `const module = require(modulePath)` → `const module = require(modulePath) as any`

**Node.js Built-ins**:
- Issue: Node.js types must be imported
- Solution: Add `import type { ... } from 'node:fs'` etc.
- Already have @types/node installed ✓

**ONE.core Type Definitions**:
- Issue: ONE.core types may not be perfect
- Solution: Use `any` for complex ONE.core objects initially
- Future: Improve types incrementally post-migration

## Testing Strategy

### Build Verification (Automated)

```bash
# Test script to run after each directory
#!/bin/bash
set -e

# Clean build
rm -rf dist/

# Compile
npm run build:main

# Verify key files exist
test -f dist/lama-electron-shadcn.js || exit 1
test -d dist/main/core || exit 1
test -d dist/main/ipc/handlers || exit 1

echo "✓ Build verification passed"
```

### Smoke Testing (Manual)

**Smoke Test Checklist**:
1. ✓ App launches without crash
2. ✓ Login screen appears
3. ✓ Can log in with credentials
4. ✓ Contacts list loads
5. ✓ Can create new conversation
6. ✓ Can send message to contact
7. ✓ Can send message to AI assistant
8. ✓ AI responds to message
9. ✓ Can export conversation
10. ✓ No console errors during operations

**When to Run Smoke Tests**:
- After each directory migration
- After final cleanup
- Before marking migration complete

### Rollback Strategy

**If Build Fails**:
1. Check TypeScript compiler errors
2. Fix obvious issues (import paths, type errors)
3. If not quickly fixable → revert directory
4. Document issue for future attempt

**If Runtime Fails**:
1. Check console errors
2. Verify IPC handlers still work
3. Check ONE.core initialization
4. If not quickly fixable → revert directory

## Timeline Estimation

**Per-Directory Estimates**:
- types/ (4 files): 30 minutes
- utils/ (1 file): 15 minutes
- services/ (3 files): 45 minutes
- ipc/handlers/ (17 files): 2 hours
- ipc/ (5 files): 45 minutes
- core/ (52 files): 4-5 hours

**Total Estimated Time**: 8-9 hours of active work

**Buffer for Issues**: +2-3 hours

**Total Timeline**: 1-2 days of focused work

## Success Criteria

**Migration is complete when**:
1. ✓ All 82 .js files converted to .ts
2. ✓ `npm run build:main` succeeds with no errors
3. ✓ `npm run electron` launches application
4. ✓ All smoke tests pass
5. ✓ No console errors during normal operations
6. ✓ tsconfig.main.json updated (exclusions removed)
7. ✓ Documentation updated if needed

## References

**TypeScript Migration Guides**:
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html
- Electron + TypeScript: https://www.electronjs.org/docs/latest/tutorial/typescript

**LAMA-Specific Documentation**:
- CLAUDE.md: Architecture principles
- Constitution: Fail-fast, IPC-first, single ONE.core

**Configuration Files**:
- tsconfig.json: Base TypeScript configuration
- tsconfig.main.json: Main process specific configuration
- package.json: Build scripts and dependencies

---

**Research Complete**: Ready for Phase 1 (Design & Contracts)
