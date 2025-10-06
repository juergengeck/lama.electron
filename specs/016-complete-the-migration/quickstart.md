# Quickstart: TypeScript Migration

**Feature**: Complete TypeScript Migration
**Phase**: 1 - Design
**Date**: 2025-10-01

## Overview

This guide provides step-by-step instructions to execute the TypeScript migration of 82 JavaScript files in the main/ directory.

## Prerequisites

**Before starting**:
- ✓ Clean working directory (commit or stash changes)
- ✓ On branch: `016-complete-the-migration`
- ✓ All dependencies installed: `npm install`
- ✓ Current build works: `npm run build:main && npm run electron`

**Verify prerequisites**:
```bash
# Check branch
git branch --show-current
# Should output: 016-complete-the-migration

# Check working directory
git status
# Should be clean or only show planned changes

# Test current build
npm run build:main
npm run electron
# Should launch without errors
```

## Migration Process

### Phase 1: Low-Risk Directories

#### Step 1.1: Migrate main/types/

**Files to migrate** (4 files):
- main/types/ipc.js
- main/types/custom-objects.js
- main/types/extended-types.js
- main/types/one-core.js

**Commands**:
```bash
# Navigate to types directory
cd main/types/

# Rename each file
mv ipc.js ipc.ts
mv custom-objects.js custom-objects.ts
mv extended-types.js extended-types.ts
mv one-core.js one-core.ts

# Return to root
cd ../..

# Build and verify
npm run build:main

# Check for errors
echo $?  # Should be 0
```

**Expected changes**:
- Module exports → ESM exports
- Type annotations may be needed for complex types
- Use `any` for ONE.core types temporarily

**Verification**:
```bash
# Check output directory
ls dist/main/types/
# Should show: ipc.js, custom-objects.js, extended-types.js, one-core.js

# Test runtime
npm run electron
# Should launch without errors

# Commit changes
git add main/types/
git commit -m "Migrate main/types/ to TypeScript

- Renamed 4 files from .js to .ts
- Converted exports to ESM
- Build succeeds, runtime verified"
```

#### Step 1.2: Migrate main/utils/

**Files to migrate** (1 file):
- Any utility files found

**Commands**:
```bash
# Find utils files
find main/utils -name "*.js" 2>/dev/null || echo "No utils directory"

# If files exist, rename them
cd main/utils/
for file in *.js; do
  [ -e "$file" ] && mv "$file" "${file%.js}.ts"
done
cd ../..

# Build and verify
npm run build:main
npm run electron
```

**Verification**:
```bash
# Check output
ls dist/main/utils/ 2>/dev/null || echo "No utils in output"

# Commit if changes made
git add main/utils/
git commit -m "Migrate main/utils/ to TypeScript"
```

### Phase 2: Medium-Risk Directories

#### Step 2.1: Migrate main/services/

**Files to migrate** (3 files):
- main/services/html-export/ (subdirectory)
- Other service files

**Commands**:
```bash
# List files to migrate
find main/services -name "*.js" -type f

# Rename files
cd main/services/
for file in $(find . -name "*.js" -type f); do
  mv "$file" "${file%.js}.ts"
done
cd ../..

# Build and verify
npm run build:main

# Test runtime
npm run electron
```

**Important notes**:
- Services may have async/await - ensure types are correct
- Check for dynamic imports (require with variables)
- Preserve error handling patterns

**Verification**:
```bash
# Check output
find dist/main/services -name "*.js"

# Smoke test: Export conversation feature
# (Manual test in UI - export a conversation as HTML)

# Commit
git add main/services/
git commit -m "Migrate main/services/ to TypeScript

- Renamed 3+ files from .js to .ts
- Preserved async patterns
- Build succeeds, export feature tested"
```

#### Step 2.2: Migrate main/ipc/handlers/

**Files to migrate** (17 files):
- All handler files in main/ipc/handlers/*.js

**Commands**:
```bash
# List handlers
ls main/ipc/handlers/*.js

# Rename all handlers
cd main/ipc/handlers/
for file in *.js; do
  mv "$file" "${file%.js}.ts"
done
cd ../../..

# Build and verify
npm run build:main

# Test runtime
npm run electron
```

**CRITICAL**: IPC handlers must maintain exact contracts!

**Verification checklist**:
```bash
# Build succeeds
npm run build:main && echo "✓ Build OK"

# Launch app
npm run electron &
APP_PID=$!
sleep 3

# Smoke test all IPC handlers:
# 1. Login screen appears
# 2. Can log in
# 3. Contacts load
# 4. Can create conversation
# 5. Can send message
# 6. AI responds
# 7. Can export

# Kill app
kill $APP_PID

# Commit
git add main/ipc/handlers/
git commit -m "Migrate main/ipc/handlers/ to TypeScript

- Renamed 17 handler files from .js to .ts
- IPC contracts preserved
- All handlers tested and verified"
```

#### Step 2.3: Migrate main/ipc/ (root files)

**Files to migrate** (5 files):
- main/ipc/controller.js (CRITICAL)
- Other IPC infrastructure files

**Commands**:
```bash
# List files
ls main/ipc/*.js

# Rename files
cd main/ipc/
for file in *.js; do
  mv "$file" "${file%.js}.ts"
done
cd ../..

# Build and verify
npm run build:main
npm run electron
```

**Special attention**:
- controller.js routes all IPC calls - test thoroughly
- Check handler registration logic
- Verify error handling

**Verification**:
```bash
# Full smoke test required (all IPC must work)
# Launch app and test every feature

# Commit
git add main/ipc/
git commit -m "Migrate main/ipc/ root files to TypeScript

- Renamed IPC infrastructure files
- Controller routing verified
- All IPC handlers functional"
```

### Phase 3: High-Risk Directory

#### Step 3.1: Migrate main/core/ (Part 1: Safe files)

**Strategy**: Migrate core/ in smaller batches to reduce risk.

**Batch 1: Utility and support files** (10-15 files):
```bash
# Identify low-risk core files
# Examples: qr-generation.js, topic-export.js, etc.

# Migrate one at a time or small batches
cd main/core/
mv qr-generation.js qr-generation.ts
mv topic-export.js topic-export.ts
# ... continue with safe files

cd ../..

# Build and test after each batch
npm run build:main
npm run electron
```

**Commit frequently**:
```bash
git add main/core/qr-generation.ts main/core/topic-export.ts
git commit -m "Migrate core utility files to TypeScript (batch 1)"
```

#### Step 3.2: Migrate main/core/ (Part 2: Integration files)

**Batch 2: ONE.core integration** (20-25 files):
```bash
# Examples: llm-manager.js, ai-assistant-model.js, etc.

cd main/core/
mv llm-manager.js llm-manager.ts
mv ai-assistant-model.js ai-assistant-model.ts
# ... continue with integration files

cd ../..

# Build and test
npm run build:main
npm run electron

# Specific tests:
# - Send message to AI
# - Verify AI responds
# - Check LLM streaming works
```

**Commit after verification**:
```bash
git add main/core/*.ts
git commit -m "Migrate core integration files to TypeScript (batch 2)"
```

#### Step 3.3: Migrate main/core/ (Part 3: Critical files)

**Batch 3: Critical infrastructure** (LAST - most risky):
- node-one-core.js (initialization)
- instance.js (singleton management)
- federation-channel-sync.js (CHUM sync)
- quic-transport.js (networking)

**Commands**:
```bash
# Do ONE file at a time for critical files
cd main/core/

# Start with instance.js
mv instance.js instance.ts
cd ../..
npm run build:main
npm run electron
# Test thoroughly
git add main/core/instance.ts
git commit -m "Migrate main/core/instance.ts to TypeScript"

# Then node-one-core.js
cd main/core/
mv node-one-core.js node-one-core.ts
cd ../..
npm run build:main
npm run electron
# Test thoroughly
git add main/core/node-one-core.ts
git commit -m "Migrate main/core/node-one-core.ts to TypeScript"

# Continue one by one...
```

**Critical file checklist**:
- [ ] instance.ts migrated and verified
- [ ] node-one-core.ts migrated and verified
- [ ] federation-channel-sync.ts migrated and verified
- [ ] quic-transport.ts migrated and verified
- [ ] All other core files migrated
- [ ] Full smoke test passed

### Phase 4: Cleanup

#### Step 4.1: Update TypeScript Configuration

**Edit tsconfig.main.json**:
```bash
# Remove JavaScript exclusion
# Open tsconfig.main.json and remove "**/*.js" from exclude array

# Before:
# "exclude": ["**/*.js", "electron-ui/**", ...]

# After:
# "exclude": ["electron-ui/**", ...]
```

**Verify**:
```bash
# Ensure no .js files remain in main/
find main -name "*.js" -type f
# Should output nothing

# Build should still work
npm run build:main

# Commit
git add tsconfig.main.json
git commit -m "Remove JavaScript exclusion from tsconfig.main.json

All files migrated to TypeScript, exclusion no longer needed"
```

#### Step 4.2: Final Verification

**Complete build test**:
```bash
# Clean build from scratch
rm -rf dist/
npm run build:main

# Verify output structure
test -f dist/lama-electron-shadcn.js && echo "✓ Entry point"
test -d dist/main/types && echo "✓ types/"
test -d dist/main/core && echo "✓ core/"
test -d dist/main/ipc/handlers && echo "✓ handlers/"
test -d dist/main/services && echo "✓ services/"

# Count output files
find dist/main -name "*.js" | wc -l
# Should be approximately same as TypeScript source count
```

**Full smoke test**:
```bash
# Launch app
npm run electron

# Manual testing checklist:
# 1. ✓ App launches without errors
# 2. ✓ Login screen appears
# 3. ✓ Can log in with credentials
# 4. ✓ Contacts list loads
# 5. ✓ Can create new conversation
# 6. ✓ Can send message to contact
# 7. ✓ Can send message to AI
# 8. ✓ AI responds correctly
# 9. ✓ Can export conversation
# 10. ✓ No console errors

# If all pass:
echo "🎉 Migration complete!"
```

#### Step 4.3: Documentation Update (if needed)

**Check if CLAUDE.md needs updates**:
```bash
# Review CLAUDE.md for outdated information
grep -n ".js" CLAUDE.md

# Update any references to .js files if needed
# Commit updates
git add CLAUDE.md
git commit -m "Update CLAUDE.md post TypeScript migration"
```

## Rollback Procedure

**If something goes wrong**:

```bash
# Rollback to last good commit
git log --oneline -10
# Find last working commit

# Hard reset
git reset --hard <commit-hash>

# Or revert specific directory
git checkout HEAD~1 -- main/core/
npm run build:main
```

## Troubleshooting

### Build Fails with "Cannot find module"

**Cause**: Import path may have changed or need .js extension for ESM

**Fix**:
```typescript
// Before
import { foo } from './bar'

// After (if needed for Node.js ESM)
import { foo } from './bar.js'
```

### Build Fails with Type Errors

**Quick fix**: Use `any` type
```typescript
// Before
function process(data) {
  return data.value
}

// After (temporary fix)
function process(data: any): any {
  return data.value
}
```

### Runtime Error: "handler not found"

**Cause**: IPC handler export changed

**Check**:
1. Handler is exported correctly
2. Handler registration in controller.ts
3. Handler name unchanged

**Fix**: Revert IPC handler file and migrate more carefully

### App Crashes on Startup

**Cause**: Critical file (node-one-core.ts or instance.ts) has error

**Steps**:
1. Check console for error message
2. Check dist/ has the file
3. Check file exports are correct
4. If not quickly fixable: revert file

## Performance Monitoring

**Build time tracking**:
```bash
# Before migration
time npm run build:main
# Record baseline time

# After each phase
time npm run build:main
# Compare to baseline

# Target: <30s for full build, <5s for incremental
```

**Runtime monitoring**:
- Startup time should remain <5 seconds
- No new memory leaks
- No performance degradation

## Success Criteria

**Migration complete when**:
- [x] All 82 .js files converted to .ts
- [x] `npm run build:main` exits with code 0
- [x] `npm run electron` launches successfully
- [x] Full smoke test checklist passes
- [x] No JavaScript files remain in main/
- [x] tsconfig.main.json updated
- [x] All changes committed to git

## Post-Migration

**Next steps** (future work, not part of this migration):
1. Enable stricter TypeScript checks
2. Improve type annotations (remove `any`)
3. Add type tests
4. Consider enabling `strict: true` in tsconfig

---

**Quickstart Complete**: Follow these steps sequentially for successful migration
