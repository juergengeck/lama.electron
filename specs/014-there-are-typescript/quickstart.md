# TypeScript Fix Quickstart Guide

This guide provides step-by-step instructions to fix TypeScript errors in LAMA Electron without using type casts.

## Prerequisites
- Node.js 18+ installed
- LAMA Electron repository cloned
- On branch `014-there-are-typescript`

## Quick Validation
```bash
# Check current error count
npm run typecheck 2>&1 | grep "error TS" | wc -l
# Expected: 383 errors initially
```

## Phase 1: Foundation Fixes (Week 1)

### 1.1 Fix Import Paths
```bash
# Update ONE.core imports to beta-3 paths
find main -name "*.ts" -exec grep -l "@refinio/one.core" {} \; | head -5

# Fix each file's imports:
# OLD: import { Something } from '@refinio/one.core/lib/old-path'
# NEW: import { Something } from '@refinio/one.core'
```

### 1.2 Add Type Declarations
```bash
# Create type definition files
touch main/types/one-core.d.ts
touch main/types/ipc.d.ts

# Add missing type declarations for globals
```

### 1.3 Remove Duplicates
```bash
# Find duplicate implementations
find . -name "*.ts" -o -name "*.js" | xargs grep -l "class.*{" | sort | uniq -d

# Keep TypeScript versions, remove JavaScript duplicates
```

**Validation**: Run `npm run typecheck` - errors should drop to ~250

## Phase 2: Type System Updates (Week 2-3)

### 2.1 Update Interfaces
```typescript
// Apply type contracts from specs/014-there-are-typescript/contracts/
// Example: Update IPC handlers
import type { MessageSendContract } from '../specs/014-there-are-typescript/contracts/ipc-contracts';
```

### 2.2 Add Null Safety
```typescript
// Before (with cast):
const value = someValue as string;

// After (with type guard):
if (typeof someValue !== 'string') {
  throw new Error('Expected string value');
}
const value = someValue; // TypeScript knows it's string
```

### 2.3 Implement Type Guards
```typescript
// Use type guards from contracts
import { isLLM, isKeyword } from '../specs/014-there-are-typescript/contracts/one-core-types';

// Validate unknown values
if (!isLLM(obj)) {
  throw new TypeError('Invalid LLM object');
}
// obj is now typed as LLM
```

**Validation**: Run `npm run typecheck` - errors should drop to ~100

## Phase 3: API Alignment (Week 4-6)

### 3.1 Align with ONE.core beta-3
```bash
# Check ONE.core version
npm list @refinio/one.core

# Update API calls to match beta-3
# See research.md for specific API changes
```

### 3.2 Fix IPC Contracts
```typescript
// Update all IPC handlers with typed contracts
// main/ipc/handlers/*.ts
```

### 3.3 Add Tests
```bash
# Run existing tests to ensure no regressions
npm test

# Add type-specific tests
npm run test:types
```

**Final Validation**:
```bash
npm run typecheck
# Expected: 0 errors

npm run build
# Expected: Successful build

npm run electron
# Expected: App runs without runtime errors
```

## Common Patterns to Fix

### Pattern 1: Undefined Handling
```typescript
// ❌ Bad (with cast)
const id = obj.id as string;

// ✅ Good (with validation)
const id = obj.id;
if (!id) {
  throw new Error('ID is required');
}
```

### Pattern 2: Unknown Types
```typescript
// ❌ Bad (with any)
function process(data: any) {
  return data.value;
}

// ✅ Good (with type guard)
function process(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    throw new TypeError('Invalid data');
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.value !== 'string') {
    throw new TypeError('Value must be string');
  }
  return obj.value;
}
```

### Pattern 3: API Mismatches
```typescript
// ❌ Bad (forcing wrong types)
const result = await storage.getObject(hash) as MyType;

// ✅ Good (using correct API)
const result = await storage.retrieveObject(hash);
if (!isMyType(result)) {
  throw new TypeError('Unexpected object type');
}
```

## Success Criteria
- [ ] npm run typecheck passes with 0 errors
- [ ] npm run build completes successfully
- [ ] npm test passes all tests
- [ ] App runs without runtime type errors
- [ ] No type casts (`as Type`) in codebase except where absolutely necessary
- [ ] All IPC calls use typed contracts
- [ ] Type guards validate all unknown values

## Troubleshooting

### "Property does not exist" errors
- Check if using correct ONE.core beta-3 API
- Verify import paths are correct
- Add proper type definitions

### "Type is not assignable" errors
- Add null checks before use
- Use type guards to narrow types
- Check for version mismatches

### "Cannot find module" errors
- Update import paths to beta-3
- Remove references to old ONE.models
- Check tsconfig.json paths

## Next Steps
After completing all phases:
1. Run full test suite
2. Update CLAUDE.md with type patterns
3. Document any necessary type casts with justification
4. Create PR for review