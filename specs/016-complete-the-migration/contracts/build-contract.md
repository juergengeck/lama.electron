# Build Contract: TypeScript Migration

**Feature**: Complete TypeScript Migration
**Phase**: 1 - Design
**Date**: 2025-10-01

## Overview

This document defines the "contract" between the source code and the build system. The migration is successful when this contract is satisfied.

## Build System Contract

### Contract Definition

```typescript
interface BuildContract {
  // Build command must succeed
  command: "npm run build:main"
  exitCode: 0

  // All source files must be compiled
  inputFiles: {
    typescript: "main/**/*.ts"
    entryPoint: "lama-electron-shadcn.ts"
  }

  // Output directory must contain compiled JavaScript
  outputFiles: {
    directory: "dist/"
    entryPoint: "dist/lama-electron-shadcn.js"
    structure: {
      "dist/main/types/": "*.js",
      "dist/main/core/": "*.js",
      "dist/main/ipc/": "*.js",
      "dist/main/ipc/handlers/": "*.js",
      "dist/main/services/": "*.js",
      "dist/main/models/": "*.js",
      "dist/main/utils/": "*.js"
    }
  }

  // No manual file copying required
  manualSteps: []

  // Build must be repeatable
  repeatability: "idempotent" // Same input → same output
}
```

## Pre-Migration State (Current)

**Build Process**:
```bash
npm run build:main
# Compiles only TypeScript files
# JavaScript files are excluded via tsconfig.main.json

# Manual workaround required:
cp main/**/*.js dist/main/ -R
# Copy JavaScript files manually to dist/
```

**Problems**:
- ❌ Build incomplete without manual steps
- ❌ Easy to forget manual copying
- ❌ Manual copying not automated in CI/CD
- ❌ Inconsistent between developers

**tsconfig.main.json (current)**:
```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "allowJs": false
  },
  "exclude": [
    "**/*.js"
  ]
}
```

## Post-Migration State (Target)

**Build Process**:
```bash
npm run build:main
# Compiles ALL TypeScript files to JavaScript in dist/
# No manual steps required
```

**Success Criteria**:
- ✓ Build completes with exit code 0
- ✓ All source files compiled to dist/
- ✓ No manual file copying needed
- ✓ Repeatable and automatable

**tsconfig.main.json (target)**:
```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "allowJs": false
  },
  "exclude": [
    // JavaScript exclusion removed - no .js files exist
    "electron-ui/**",
    "node_modules",
    "dist",
    "specs/**",
    "tests/**"
  ]
}
```

## Build Verification Tests

### Test 1: Clean Build

```bash
#!/bin/bash
# Test: Clean build produces complete output

set -e  # Exit on error

# Step 1: Clean
echo "Cleaning dist/ directory..."
rm -rf dist/

# Step 2: Build
echo "Running build..."
npm run build:main

# Step 3: Verify entry point
echo "Verifying entry point..."
test -f dist/lama-electron-shadcn.js || {
  echo "❌ FAIL: Entry point missing"
  exit 1
}

# Step 4: Verify directory structure
echo "Verifying directory structure..."
test -d dist/main/types || { echo "❌ FAIL: types/ missing"; exit 1; }
test -d dist/main/core || { echo "❌ FAIL: core/ missing"; exit 1; }
test -d dist/main/ipc/handlers || { echo "❌ FAIL: handlers/ missing"; exit 1; }
test -d dist/main/services || { echo "❌ FAIL: services/ missing"; exit 1; }

# Step 5: Count files
echo "Verifying file count..."
SOURCE_COUNT=$(find main -name "*.ts" -type f | wc -l)
OUTPUT_COUNT=$(find dist/main -name "*.js" -type f | wc -l)
if [ "$OUTPUT_COUNT" -lt "$SOURCE_COUNT" ]; then
  echo "❌ FAIL: Expected $SOURCE_COUNT files, got $OUTPUT_COUNT"
  exit 1
fi

echo "✅ PASS: Clean build successful"
```

### Test 2: Incremental Build

```bash
#!/bin/bash
# Test: Incremental build updates only changed files

set -e

# Step 1: Initial build
npm run build:main

# Step 2: Record timestamp
ORIGINAL_TIME=$(stat -f %m dist/main/core/instance.js)

# Step 3: Touch a source file
touch main/core/llm-manager.ts

# Step 4: Rebuild
npm run build:main

# Step 5: Verify instance.js unchanged (not rebuilt)
NEW_TIME=$(stat -f %m dist/main/core/instance.js)
if [ "$NEW_TIME" != "$ORIGINAL_TIME" ]; then
  echo "⚠️  WARNING: Unnecessary rebuilds (not critical)"
fi

# Step 6: Verify llm-manager.js rebuilt
LLM_TIME=$(stat -f %m dist/main/core/llm-manager.js)
if [ "$LLM_TIME" -le "$ORIGINAL_TIME" ]; then
  echo "❌ FAIL: Changed file not rebuilt"
  exit 1
fi

echo "✅ PASS: Incremental build working"
```

### Test 3: No JavaScript Files Remain

```bash
#!/bin/bash
# Test: No .js files in source (main/) directory

set -e

JS_FILES=$(find main -name "*.js" -type f | wc -l)
if [ "$JS_FILES" -ne 0 ]; then
  echo "❌ FAIL: Found $JS_FILES JavaScript files in main/"
  find main -name "*.js" -type f
  exit 1
fi

echo "✅ PASS: All files migrated to TypeScript"
```

## Runtime Contract

### Application Launch Contract

```typescript
interface RuntimeContract {
  // Launch command
  command: "npm run electron"

  // Expected behavior
  behavior: {
    exitCode: 0 | "running"    // 0 = clean exit, "running" = still running
    windowAppears: true         // Electron window opens
    errorMessages: []           // No errors in console
  }

  // Initialization sequence
  initialization: {
    electronStart: "success"
    nodeOneCoreInit: "success"
    ipcHandlersRegistered: "success"
    uiRendered: "success"
  }

  // Performance
  performance: {
    startupTime: "<5 seconds"   // App window appears within 5s
  }
}
```

### Runtime Verification Test

```bash
#!/bin/bash
# Test: Application launches without errors

set -e

# Step 1: Build
npm run build:main

# Step 2: Launch app with timeout
echo "Launching application..."
timeout 10 npm run electron &
APP_PID=$!

# Step 3: Wait for window to appear (check for process)
sleep 3

# Step 4: Check if process is still running
if ps -p $APP_PID > /dev/null; then
  echo "✅ PASS: Application launched successfully"
  kill $APP_PID
  exit 0
else
  echo "❌ FAIL: Application crashed on startup"
  exit 1
fi
```

## TypeScript Compiler Contract

### Compiler Configuration Contract

```typescript
interface CompilerContract {
  // TypeScript configuration
  config: "tsconfig.main.json"

  // Compiler options that MUST be set
  requiredOptions: {
    target: "ES2022"           // Modern JavaScript output
    module: "ES2022"           // ESM module format
    moduleResolution: "Node"   // Node.js resolution
    outDir: "./dist"           // Output directory
    allowJs: false             // No JavaScript files
    declaration: true          // Generate .d.ts files
  }

  // Type checking strictness (current settings)
  strictness: {
    strict: false              // Loose checking during migration
    noImplicitAny: false       // Allow implicit any
    strictNullChecks: false    // Allow null/undefined
  }

  // What files to compile
  include: [
    "lama-electron-shadcn.ts",
    "main/**/*.ts"
  ]

  // What to exclude
  exclude: [
    "electron-ui/**",
    "node_modules",
    "dist",
    "specs/**",
    "tests/**",
    "reference/**"
  ]
}
```

### Compiler Error Contract

```typescript
interface CompilerErrorContract {
  // Allowed during migration (temporary)
  allowedWarnings: [
    "Implicit any",
    "Unused variable",
    "Property might be undefined"
  ]

  // Never allowed (must fix immediately)
  forbiddenErrors: [
    "Cannot find module",
    "Syntax error",
    "Duplicate identifier",
    "Import cycle detected"
  ]
}
```

## Migration Checkpoint Contract

After each directory migration, verify:

```typescript
interface MigrationCheckpoint {
  // Directory just migrated
  directory: string  // e.g., "main/types/"

  // Verification checklist
  checks: {
    // All .js files renamed to .ts
    filesRenamed: boolean

    // Build succeeds
    buildSucceeds: boolean

    // Output directory updated
    outputExists: boolean

    // No new TypeScript errors (except allowed warnings)
    noNewErrors: boolean

    // Git committed
    committed: boolean
  }

  // Next action
  nextAction: "continue" | "rollback" | "fix"
}
```

## Continuous Integration Contract

**CI/CD Pipeline Requirements** (future):

```yaml
# .github/workflows/build.yml (example)
name: Build Check
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build:main
      - run: test -f dist/lama-electron-shadcn.js
      - run: find main -name "*.js" | wc -l | grep "^0$"
```

**CI Contract**:
- ✓ Build must pass on every commit
- ✓ No JavaScript files allowed in main/
- ✓ Output structure validated
- ✓ No manual steps required

## Contract Evolution

**After migration completes**, build contract can evolve:

**Phase 1 (Current Migration)**:
- ✓ Convert .js → .ts
- ✓ Build succeeds
- ✓ Runtime works

**Phase 2 (Future Type Improvement)**:
- Enable stricter TypeScript checks
- Improve type annotations
- Add type tests

**Phase 3 (Future Build Optimization)**:
- Enable incremental compilation
- Add build caching
- Optimize build performance

---

**Build Contract Defined**: Migration success is measurable and verifiable
