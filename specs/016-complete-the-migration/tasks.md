# Tasks: Complete TypeScript Migration

**Feature**: Complete TypeScript Migration
**Branch**: `016-complete-the-migration`
**Input**: Design documents from `/specs/016-complete-the-migration/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Extracted: TypeScript 5.7.2, Electron 32.3.3, incremental migration strategy
2. Load optional design documents ✓
   → research.md: Incremental directory-based migration strategy
   → contracts/: IPC and build contracts (must be preserved)
   → quickstart.md: Step-by-step execution guide
3. Generate tasks by category ✓
   → Phase 1: Low-risk directories (types/, utils/)
   → Phase 2: Medium-risk directories (services/, ipc/)
   → Phase 3: High-risk directory (core/)
   → Phase 4: Cleanup and verification
4. Apply task rules ✓
   → Different directories = can be parallel [P]
   → Same directory = sequential (no [P])
   → Build verification after each phase
   → Critical files migrated individually
5. Number tasks sequentially (T001-T015) ✓
6. Generate dependency graph ✓
7. Create parallel execution examples ✓
8. Validate task completeness ✓
   → All 73 JavaScript files covered
   → Build verification after each phase
   → Smoke tests included
   → Cleanup tasks included
9. Return: SUCCESS (tasks ready for execution) ✓
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different directories, no dependencies)
- Include exact file paths in task descriptions
- **Process**: All tasks are main process (Node.js) - no renderer changes

## Migration Summary

**Total JavaScript files**: 73
- types/: 4 files
- utils/: 2 files
- services/: 14 files
- ipc/: 1 file
- ipc/handlers/: 19 files
- core/: 33 files

**Strategy**: Incremental migration by directory, low-risk → high-risk

**Verification**: Build + smoke test after each phase

## Phase 1: Low-Risk Directories (Types & Utils)

### T001 [P] Migrate main/types/ directory (4 files)
**Process**: Main (Node.js)
**Files**:
- main/types/ipc.js → ipc.ts
- main/types/custom-objects.js → custom-objects.ts
- main/types/extended-types.js → extended-types.ts
- main/types/one-core.js → one-core.ts

**Approach**:
1. Rename each .js file to .ts
2. Convert module.exports to export statements
3. Add type annotations where obvious (use `any` liberally)
4. Preserve all type definitions and interfaces

**Verification**:
```bash
npm run build:main
# Should succeed with no errors
test -d dist/main/types
```

**Estimated Complexity**: Low (type-only files, no runtime logic)

---

### T002 [P] Migrate main/utils/ directory (2 files)
**Process**: Main (Node.js)
**Files**:
- main/utils/ipc-logger.js → ipc-logger.ts
- main/utils/message-utils.js → message-utils.ts

**Approach**:
1. Rename .js files to .ts
2. Add parameter types (use `any` if complex)
3. Convert exports to ESM
4. Preserve logging and utility logic exactly

**Verification**:
```bash
npm run build:main
test -d dist/main/utils
```

**Estimated Complexity**: Low (simple utility functions)

---

### T003 Build verification after Phase 1
**Process**: Main (Node.js)
**Verification**:
```bash
# Clean build
rm -rf dist/
npm run build:main

# Verify structure
test -f dist/lama-electron-shadcn.js
test -d dist/main/types
test -d dist/main/utils

# Launch app (smoke test)
timeout 10 npm run electron
# Should launch without errors
```

**Criteria**:
- ✓ Build exits with code 0
- ✓ Output directory contains compiled files
- ✓ Application launches successfully
- ✓ No console errors

**Git Commit**:
```bash
git add main/types/ main/utils/
git commit -m "Migrate main/types/ and main/utils/ to TypeScript

- Migrated 6 files from JavaScript to TypeScript
- Phase 1 complete: low-risk directories
- Build verified, smoke test passed"
```

---

## Phase 2: Medium-Risk Directories (Services & IPC)

### T004 Migrate main/services/ directory (14 files)
**Process**: Main (Node.js)
**Files**:
- main/services/attachment-service.js → attachment-service.ts
- main/services/chum-monitor.js → chum-monitor.ts
- main/services/chum-settings.js → chum-settings.ts
- main/services/credentials-manager.js → credentials-manager.ts
- main/services/html-export/formatter.js → formatter.ts
- main/services/html-export/html-template.js → html-template.ts
- main/services/html-export/implode-wrapper.js → implode-wrapper.ts
- main/services/keyword-enrichment.js → keyword-enrichment.ts
- main/services/llm-manager.js → llm-manager.ts
- main/services/lmstudio.js → lmstudio.ts
- main/services/mcp-manager.js → mcp-manager.ts
- main/services/node-provisioning.js → node-provisioning.ts
- main/services/ollama.js → ollama.ts
- main/services/subjects/SubjectService.js → SubjectService.ts

**Approach**:
1. Rename all .js files to .ts
2. Add parameter types for public methods
3. Use `any` for complex ONE.core or LLM types
4. Preserve async/await patterns
5. Keep error handling unchanged
6. Convert exports to ESM

**Special Attention**:
- llm-manager.js: Complex async streaming logic
- html-export/*: ONE.core implode() integration
- credentials-manager.js: Sensitive data handling

**Verification**:
```bash
npm run build:main
test -d dist/main/services
test -d dist/main/services/html-export

# Smoke test specific features:
# 1. AI chat (llm-manager)
# 2. HTML export (html-export/*)
# 3. Authentication (credentials-manager)
```

**Estimated Complexity**: Medium (business logic, async operations)

---

### T005 Build verification after services migration
**Process**: Main (Node.js)
**Verification**:
```bash
npm run build:main
npm run electron

# Manual smoke tests:
# 1. ✓ Log in with credentials
# 2. ✓ Send message to AI assistant
# 3. ✓ Verify AI responds
# 4. ✓ Export conversation as HTML
# 5. ✓ Check for console errors
```

**Git Commit**:
```bash
git add main/services/
git commit -m "Migrate main/services/ to TypeScript

- Migrated 14 service files
- Preserved async patterns and error handling
- LLM integration and HTML export verified"
```

---

### T006 Migrate main/ipc/handlers/ directory (19 files)
**Process**: Main (Node.js)
**Files**:
- main/ipc/handlers/ai.js → ai.ts
- main/ipc/handlers/attachments.js → attachments.ts
- main/ipc/handlers/audit.js → audit.ts
- main/ipc/handlers/auth.js → auth.ts
- main/ipc/handlers/chat.js → chat.ts
- main/ipc/handlers/contacts.js → contacts.ts
- main/ipc/handlers/crypto.js → crypto.ts
- main/ipc/handlers/devices.js → devices.ts
- main/ipc/handlers/export.js → export.ts
- main/ipc/handlers/feed-forward.js → feed-forward.ts
- main/ipc/handlers/iom.js → iom.ts
- main/ipc/handlers/keyword-detail.js → keyword-detail.ts
- main/ipc/handlers/one-core.js → one-core.ts
- main/ipc/handlers/settings.js → settings.ts
- main/ipc/handlers/state.js → state.ts
- main/ipc/handlers/subjects.js → subjects.ts
- main/ipc/handlers/topic-analysis.js → topic-analysis.ts
- main/ipc/handlers/topics.js → topics.ts
- main/ipc/handlers/word-cloud-settings.js → word-cloud-settings.ts

**Approach**:
1. Rename all .js files to .ts
2. **CRITICAL**: Preserve exact function signatures (IPC contracts)
3. Add parameter types matching IPC contracts
4. Use `any` for return types initially
5. Keep error handling patterns unchanged
6. Convert exports to ESM

**CRITICAL - IPC Contract Preservation**:
- Handler names must not change
- Parameter structures must remain identical
- Return types must remain identical
- Error types must remain consistent
- See: `/specs/016-complete-the-migration/contracts/ipc-handlers.md`

**Special Attention**:
- one-core.js: Core initialization handlers
- chat.js: Message sending/receiving
- contacts.js: Contact management
- topic-analysis.js: AI analysis features

**Verification**:
```bash
npm run build:main
test -d dist/main/ipc/handlers

# Count compiled handlers
find dist/main/ipc/handlers -name "*.js" | wc -l
# Should be 19
```

**Estimated Complexity**: Medium-High (critical for app functionality)

---

### T007 Migrate main/ipc/controller.js (1 file)
**Process**: Main (Node.js)
**File**: main/ipc/controller.js → controller.ts

**Approach**:
1. Rename controller.js to controller.ts
2. Add types for handler registration
3. Preserve routing logic exactly
4. Keep error handling unchanged
5. Convert exports to ESM

**CRITICAL**: Controller routes ALL IPC calls - any errors break entire app

**Verification**:
```bash
npm run build:main
test -f dist/main/ipc/controller.js
```

**Estimated Complexity**: Medium (critical routing logic)

---

### T008 IPC contract verification after Phase 2
**Process**: Main (Node.js)
**Verification**:
```bash
npm run build:main
npm run electron

# COMPLETE IPC handler smoke test:
# 1. ✓ onecore:initializeNode (login)
# 2. ✓ onecore:getContacts (contacts list)
# 3. ✓ onecore:createConversation (new conversation)
# 4. ✓ onecore:sendMessage (send message)
# 5. ✓ onecore:getMessages (load messages)
# 6. ✓ topicAnalysis:analyzeMessages (AI analysis)
# 7. ✓ topicAnalysis:getSummary (get summary)
# 8. ✓ export:htmlWithMicrodata (export)
# 9. ✓ llm:chat (AI chat)
# 10. ✓ Check console for IPC errors
```

**Contract Validation**:
- All IPC handlers respond
- No "handler not found" errors
- Parameter structures unchanged
- Return data matches expectations
- Error handling works

**Git Commit**:
```bash
git add main/ipc/
git commit -m "Migrate main/ipc/ to TypeScript

- Migrated 20 IPC-related files (19 handlers + controller)
- IPC contracts preserved and verified
- All handlers tested and functional"
```

---

## Phase 3: High-Risk Directory (Core)

**Strategy**: Migrate core/ in batches to manage risk

### T009 Migrate main/core/ utility files (10 files) - Batch 1
**Process**: Main (Node.js)
**Files**:
- main/core/qr-generation.js → qr-generation.ts
- main/core/topic-export.js → topic-export.ts
- main/core/message-versioning.js → message-versioning.ts
- main/core/access-rights-manager.js → access-rights-manager.ts
- main/core/attestation-manager.js → attestation-manager.ts
- main/core/device-manager.js → device-manager.ts
- main/core/pairing-trust-handler.js → pairing-trust-handler.ts
- main/core/content-sharing.js → content-sharing.ts
- main/core/message-assertion-certificates.js → message-assertion-certificates.ts
- main/core/ai-settings-manager.js → ai-settings-manager.ts

**Approach**:
1. Rename files to .ts
2. Add basic type annotations
3. Use `any` for ONE.core types
4. Preserve logic exactly
5. Convert exports to ESM

**Verification**:
```bash
npm run build:main
npm run electron
# Basic smoke test
```

**Estimated Complexity**: Medium (utility logic, some ONE.core integration)

---

### T010 Build verification after core batch 1
**Verification**:
```bash
npm run build:main && npm run electron
# Verify app launches and basic features work
```

**Git Commit**:
```bash
git add main/core/*.ts
git commit -m "Migrate main/core/ utility files to TypeScript (batch 1)

- Migrated 10 utility files
- QR generation, exports, versioning verified"
```

---

### T011 Migrate main/core/ integration files (12 files) - Batch 2
**Process**: Main (Node.js)
**Files**:
- main/core/llm-object-manager.js → llm-object-manager.ts
- main/core/ai-message-listener.js → ai-message-listener.ts
- main/core/contact-creation-proper.js → contact-creation-proper.ts
- main/core/contact-trust-manager.js → contact-trust-manager.ts
- main/core/p2p-channel-access.js → p2p-channel-access.ts
- main/core/p2p-topic-creator.js → p2p-topic-creator.ts
- main/core/peer-message-listener.js → peer-message-listener.ts
- main/core/topic-group-manager.js → topic-group-manager.ts
- main/core/federation-api.js → federation-api.ts
- main/core/quicvc-connection-manager.js → quicvc-connection-manager.ts
- main/core/quic-transport.js → quic-transport.ts
- main/core/feed-forward/manager.js → manager.ts

**Approach**:
1. Rename files to .ts
2. Add parameter types for public APIs
3. Preserve async patterns and error handling
4. Use `any` for complex ONE.core types
5. Keep state management logic unchanged

**Special Attention**:
- quic-transport.js: Low-level networking
- federation-api.js: CHUM sync logic
- p2p-topic-creator.js: Channel creation

**Verification**:
```bash
npm run build:main
npm run electron

# Test P2P and federation features:
# - Create P2P conversation
# - Send message
# - Verify delivery
```

**Estimated Complexity**: High (complex integration logic)

---

### T012 Build verification after core batch 2
**Verification**:
```bash
npm run build:main && npm run electron
# Test messaging and P2P features
```

**Git Commit**:
```bash
git add main/core/*.ts
git commit -m "Migrate main/core/ integration files to TypeScript (batch 2)

- Migrated 12 integration files
- P2P, federation, LLM integration verified"
```

---

### T013 Migrate main/core/ AI files (5 files) - Batch 3
**Process**: Main (Node.js)
**Files**:
- main/core/one-ai/models/TopicAnalysisModel.js → TopicAnalysisModel.ts
- main/core/one-ai/models/TopicAnalysisRoom.js → TopicAnalysisRoom.ts
- main/core/one-ai/recipes/ai-recipes.js → ai-recipes.ts
- main/core/one-ai/recipes/WordCloudSettingsRecipe.js → WordCloudSettingsRecipe.ts
- main/core/one-ai/services/ContextEnrichmentService.js → ContextEnrichmentService.ts

**Approach**:
1. Rename files to .ts
2. Add types for AI models and recipes
3. Preserve ONE.core recipe definitions
4. Keep analysis logic unchanged

**Verification**:
```bash
npm run build:main
npm run electron

# Test AI analysis features:
# - Analyze conversation
# - Generate summary
# - Extract keywords
```

**Estimated Complexity**: High (AI integration, ONE.core recipes)

---

### T014 Migrate main/core/ remaining AI files (2 files) - Batch 4
**Process**: Main (Node.js)
**Files**:
- main/core/one-ai/services/RealTimeKeywordExtractor.js → RealTimeKeywordExtractor.ts
- main/core/one-ai/storage/word-cloud-settings-manager.js → word-cloud-settings-manager.ts

**Approach**:
1. Rename files to .ts
2. Add types for keyword extraction
3. Preserve storage logic

**Verification**:
```bash
npm run build:main
npm run electron
# Test real-time keyword extraction
```

---

### T015 Migrate main/core/ critical files (4 files) - Batch 5 ONE AT A TIME
**Process**: Main (Node.js)
**Files** (migrate individually):
1. main/core/instance.js → instance.ts
2. main/core/ai-assistant-model.js → ai-assistant-model.ts
3. main/core/node-one-core.js → node-one-core.ts
4. main/core/federation-channel-sync.js → federation-channel-sync.ts

**Approach for EACH file**:
1. Migrate ONE file
2. Build immediately: `npm run build:main`
3. Test thoroughly: `npm run electron`
4. Commit immediately if successful
5. Only then proceed to next file

**CRITICAL FILES - Extra Caution**:

**instance.js** (singleton management):
- Handles instance lifecycle
- Error breaks app startup
- Test: App launches successfully

**node-one-core.js** (ONE.core initialization):
- Initializes entire ONE.core instance
- Most critical file in codebase
- Test: Login works, ONE.core initializes

**ai-assistant-model.js** (AI contact model):
- AI contact management
- Test: AI contacts load, AI responds

**federation-channel-sync.js** (CHUM sync):
- Federation and channel synchronization
- Test: Messages sync between devices

**Verification PER FILE**:
```bash
# After EACH file migration:
npm run build:main || { echo "Build failed!"; exit 1; }
npm run electron &
sleep 5
pkill -f electron

# Full smoke test after instance.js
# Full smoke test after node-one-core.js (CRITICAL)
# AI test after ai-assistant-model.js
# Federation test after federation-channel-sync.js
```

**Git Commit PER FILE**:
```bash
# After EACH successful file migration:
git add main/core/[filename].ts
git commit -m "Migrate main/core/[filename].ts to TypeScript

Critical file - tested and verified"
```

**Estimated Complexity**: CRITICAL (highest risk, must do carefully)

---

### T016 Final core verification
**Verification**:
```bash
# Verify all core files migrated
find main/core -name "*.js" -type f
# Should output nothing

# Count TypeScript files
find main/core -name "*.ts" -type f | wc -l
# Should be 33

# Full build
npm run build:main

# Full smoke test
npm run electron
# Complete all smoke test checklist items
```

**Git Commit**:
```bash
git add main/core/
git commit -m "Complete main/core/ TypeScript migration

- All 33 core files migrated
- Critical files verified individually
- Full smoke test passed"
```

---

## Phase 4: Cleanup & Final Verification

### T017 Update tsconfig.main.json
**Process**: Configuration
**File**: tsconfig.main.json

**Changes**:
1. Remove `"**/*.js"` from `exclude` array
2. Verify `allowJs: false` is set
3. Verify `include` patterns are correct

**Before**:
```json
{
  "exclude": [
    "**/*.js",
    "electron-ui/**",
    "node_modules",
    "dist"
  ]
}
```

**After**:
```json
{
  "exclude": [
    "electron-ui/**",
    "node_modules",
    "dist",
    "specs/**",
    "tests/**",
    "reference/**"
  ]
}
```

**Verification**:
```bash
# Verify no .js files remain in main/
find main -name "*.js" -type f | wc -l
# Should be 0

# Build should still work
npm run build:main
```

**Git Commit**:
```bash
git add tsconfig.main.json
git commit -m "Remove JavaScript exclusion from tsconfig.main.json

All files migrated to TypeScript, exclusion no longer needed"
```

---

### T018 Final build verification
**Process**: Build system
**Verification**:

```bash
# Clean build from scratch
rm -rf dist/
npm run build:main

# Verify output structure
test -f dist/lama-electron-shadcn.js && echo "✓ Entry point exists"
test -d dist/main/types && echo "✓ types/ compiled"
test -d dist/main/utils && echo "✓ utils/ compiled"
test -d dist/main/services && echo "✓ services/ compiled"
test -d dist/main/ipc && echo "✓ ipc/ compiled"
test -d dist/main/ipc/handlers && echo "✓ handlers/ compiled"
test -d dist/main/core && echo "✓ core/ compiled"

# Count output JavaScript files
OUTPUT_COUNT=$(find dist/main -name "*.js" -type f | wc -l)
echo "Compiled $OUTPUT_COUNT JavaScript files"

# Verify no source .js files remain
SOURCE_JS=$(find main -name "*.js" -type f | wc -l)
if [ "$SOURCE_JS" -eq 0 ]; then
  echo "✓ No JavaScript source files remain"
else
  echo "✗ Found $SOURCE_JS JavaScript files still in main/"
  find main -name "*.js" -type f
  exit 1
fi
```

**Success Criteria**:
- ✓ Build exits with code 0
- ✓ All directories present in dist/
- ✓ No .js files in main/ directory
- ✓ All source files compiled

---

### T019 Complete smoke test
**Process**: Manual testing
**Checklist**:

```bash
# Launch application
npm run electron
```

**Manual Test Steps**:
1. ✓ App launches without errors
2. ✓ Login screen appears
3. ✓ Can log in with credentials
4. ✓ Contacts list loads successfully
5. ✓ Can create new P2P conversation
6. ✓ Can send message to contact
7. ✓ Message appears in conversation
8. ✓ Can send message to AI assistant
9. ✓ AI responds to message
10. ✓ AI streaming works correctly
11. ✓ Can analyze conversation (topic analysis)
12. ✓ Summary and keywords appear
13. ✓ Can export conversation as HTML
14. ✓ Export file is valid HTML
15. ✓ No console errors during operations
16. ✓ No TypeScript type errors in console
17. ✓ App can be closed cleanly

**Performance Checks**:
- App startup time: <5 seconds
- Message send: <1 second
- AI response: <10 seconds (depends on LLM)
- Export: <5 seconds

**If ANY test fails**:
- Document the failure
- Check console for errors
- Identify which file may be causing issue
- Fix or rollback that file

---

### T020 Final commit and cleanup
**Process**: Git
**Actions**:

```bash
# Verify git status
git status
# Should show clean working directory

# Review all commits in this branch
git log --oneline origin/main..HEAD

# Optional: Squash commits if desired
# (Keep individual commits for audit trail recommended)

# Final commit (if any loose changes)
git add .
git commit -m "Complete TypeScript migration - Final cleanup

Migration summary:
- 73 JavaScript files migrated to TypeScript
- All phases completed successfully
- Build verified, smoke tests passed
- IPC contracts preserved
- No breaking changes

Files migrated:
- main/types/: 4 files
- main/utils/: 2 files
- main/services/: 14 files
- main/ipc/: 20 files (handlers + controller)
- main/core/: 33 files

Build verification:
✓ npm run build:main succeeds
✓ npm run electron launches
✓ All features functional
✓ No console errors

Ready for merge to main."
```

---

## Dependencies

**Phase 1 → Phase 2**:
- T001, T002, T003 must complete before T004

**Phase 2 → Phase 3**:
- T004-T008 must complete before T009

**Phase 3 batches**:
- T009 → T010 (build verification)
- T011 → T012 (build verification)
- T013 → T014 (can be combined)
- T015 (critical files - sequential, one at a time)
- T016 (final verification)

**Phase 3 → Phase 4**:
- T009-T016 must complete before T017

**Sequential within Phase 4**:
- T017 → T018 → T019 → T020

## Parallel Execution Examples

**Phase 1 - Low risk directories (parallel)**:
```bash
# Can run T001 and T002 in parallel (different directories):
# Task 1: Migrate main/types/ (4 files)
# Task 2: Migrate main/utils/ (2 files)
# Then: Task 3 build verification
```

**Phase 3 - Core files (mostly sequential due to complexity)**:
```bash
# Batch 1: T009 (10 files - can be done in parallel if careful)
# Build verification: T010
# Batch 2: T011 (12 files - sequential due to interdependencies)
# Build verification: T012
# Batch 3+4: T013, T014 (can be combined, 7 files)
# Batch 5: T015 (4 CRITICAL files - MUST be sequential, one at a time)
# Final verification: T016
```

**Note**: Given the risk and interdependencies in core/, recommend sequential execution for Phase 3, even though some tasks are marked for potential parallel execution. Better safe than sorry.

## Risk Mitigation

**High-Risk Tasks**:
- T015: Critical core files (instance.js, node-one-core.js)
  - **Mitigation**: Migrate one file at a time, test immediately, commit before next
- T006: IPC handlers (19 files)
  - **Mitigation**: Preserve exact signatures, comprehensive IPC testing
- T011: Core integration files (federation, QUIC)
  - **Mitigation**: Test federation and P2P features thoroughly

**Rollback Strategy**:
```bash
# If any task fails:
git log --oneline -10
git reset --hard <last-good-commit>
npm run build:main
npm run electron
# Verify app works, then retry failed task more carefully
```

## Task Completion Checklist

**After each task**:
- [ ] Files renamed successfully
- [ ] Build succeeds: `npm run build:main`
- [ ] Output directory updated: `ls dist/main/...`
- [ ] Application launches: `npm run electron`
- [ ] Relevant features tested
- [ ] No new console errors
- [ ] Git committed with clear message

**After Phase 1**:
- [ ] 6 files migrated (types + utils)
- [ ] Build passes
- [ ] App launches

**After Phase 2**:
- [ ] 34 files migrated (services + ipc)
- [ ] All IPC handlers functional
- [ ] Complete IPC contract test

**After Phase 3**:
- [ ] 33 core files migrated
- [ ] Critical files verified individually
- [ ] Full smoke test passed

**After Phase 4**:
- [ ] tsconfig.main.json updated
- [ ] No .js files in main/
- [ ] Final build clean
- [ ] Complete smoke test passed
- [ ] Performance verified

## Success Criteria

**Migration complete when**:
- [x] All 73 JavaScript files converted to TypeScript
- [x] `npm run build:main` exits with code 0
- [x] `npm run electron` launches successfully
- [x] Complete smoke test checklist passes (19 items)
- [x] No JavaScript files remain in main/ directory
- [x] tsconfig.main.json updated (JavaScript exclusion removed)
- [x] All changes committed to git with clear messages
- [x] Build performance acceptable (<30s full, <5s incremental)
- [x] Runtime performance unchanged
- [x] No new console errors or warnings
- [x] IPC contracts preserved and verified
- [x] All features functional

---

**Tasks Generated**: 20 tasks across 4 phases
**Estimated Total Time**: 10-12 hours of focused work
**Risk Level**: Medium-High (critical files require extra care)
**Recommendation**: Execute sequentially, commit frequently, test thoroughly

**Ready for execution**: Run tasks T001-T020 in order, following verification steps carefully.
