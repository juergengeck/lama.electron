# Tasks: Keyword Detail Preview

**Feature**: 015-keyword-detail-preview
**Branch**: `015-keyword-detail-preview`
**Input**: Design documents from `/Users/gecko/src/lama.electron/specs/015-keyword-detail-preview/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/

---

## Execution Flow

```
1. Load plan.md from feature directory
   → Tech Stack: TypeScript 5.x, React 18, ONE.core, Electron IPC
   → Structure: Split architecture (main/ + electron-ui/)
2. Load design documents:
   → data-model.md: KeywordAccessState, enriched Keyword/Subject
   → contracts/: 5 IPC handlers (getKeywordDetails, etc.)
   → research.md: Extend existing models, conditional rendering
3. Generate tasks by category:
   → PHASE 1: Data Layer (recipes, storage) - SEQUENTIAL
   → PHASE 2: IPC Layer (tests first, then handlers) - SEQUENTIAL
   → PHASE 3: UI Components - PARALLEL where possible
   → PHASE 4: Integration & Polish - PARALLEL where possible
4. Apply LAMA rules:
   → TDD: ALL tests before implementation
   → Fail-fast: No fallbacks
   → Browser = UI only, ALL data via IPC
5. Total: 30 tasks with clear dependencies
6. Validation: All contracts tested, all entities implemented
```

---

## Format Legend

- **[main]**: Node.js main process task
- **[renderer]**: Browser renderer process task
- **[both]**: Affects both processes
- **[P]**: Can run in parallel (different files, no dependencies)
- **Dependencies**: Task IDs that must complete first

---

## PHASE 1: Data Layer (Sequential)

### T001 - Create KeywordAccessState Recipe
**Process**: [main]
**Files**:
- `/Users/gecko/src/lama.electron/main/core/one-ai/recipes/KeywordAccessState.ts`
- `/Users/gecko/src/lama.electron/main/core/one-ai/recipes/ai-recipes.ts`

**Description**:
Create new ONE.core recipe for KeywordAccessState entity. Define TypeScript interface with fields: $type$, keywordTerm (string), principalId (SHA256Hash), principalType ('user' | 'group'), state ('allow' | 'deny' | 'none'), updatedAt (string), updatedBy (SHA256Hash). Register recipe in ai-recipes.ts exports.

**Acceptance Criteria**:
- [ ] KeywordAccessState.ts exports interface matching data-model.md schema
- [ ] Recipe registered in ai-recipes.ts with correct field types
- [ ] TypeScript compiles without errors
- [ ] Recipe uses proper ONE.core SHA256Hash branded type

**Dependencies**: None
**Notes**: This is a new recipe, no existing code to modify. Follow pattern from existing Keyword.ts and Subject.ts.

---

### T002 - Create Keyword Access Storage Module
**Process**: [main]
**Files**:
- `/Users/gecko/src/lama.electron/main/core/one-ai/storage/keyword-access-storage.ts`

**Description**:
Create storage module for KeywordAccessState objects. Implement functions: createAccessState(keywordTerm, principalId, principalType, state, updatedBy), updateAccessState(existing, newState, updatedBy), getAccessStatesByKeyword(keywordTerm), getAccessStateByPrincipal(keywordTerm, principalId), deleteAccessState(keywordTerm, principalId). Use ONE.core's storeVersionedObject() and loadVersionedObjects() functions. Implement composite key pattern (keywordTerm + principalId).

**Acceptance Criteria**:
- [ ] All CRUD functions implemented and exported
- [ ] Uses storeVersionedObject() for persistence
- [ ] Implements upsert logic for composite key
- [ ] Handles missing keyword or principal gracefully (throws error)
- [ ] Returns SHA256Hash on successful create/update
- [ ] TypeScript types match KeywordAccessState interface

**Dependencies**: T001
**Notes**: Follow pattern from existing keyword-storage.ts. No caching at storage layer - caching happens in IPC handlers.

---

### T003 - Extend TopicAnalysisModel with Keyword Detail Methods
**Process**: [main]
**Files**:
- `/Users/gecko/src/lama.electron/main/core/one-ai/models/TopicAnalysisModel.js`

**Description**:
Add methods to TopicAnalysisModel: getKeywordWithAccessStates(keyword, topicId?), getAllKeywords(), getSubjectsForKeyword(keyword, topicId?). Methods should load base Keyword/Subject data and prepare for enrichment (no enrichment logic in model). Return plain objects ready for IPC handlers to enrich.

**Acceptance Criteria**:
- [ ] getKeywordWithAccessStates returns keyword + raw access states array
- [ ] getAllKeywords returns all keywords across all topics
- [ ] getSubjectsForKeyword filters subjects containing specified keyword
- [ ] Methods use existing storage layers (keyword-storage, subject-storage)
- [ ] No enrichment logic (topicReferences, relevanceScore) in model
- [ ] Error handling with descriptive messages

**Dependencies**: T002
**Notes**: Model layer is data-only. Enrichment happens in enrichment service (T004).

---

### T004 - Create Keyword Enrichment Service
**Process**: [main]
**Files**:
- `/Users/gecko/src/lama.electron/main/services/keyword-enrichment.js`

**Description**:
Create enrichment service with functions: enrichKeywordWithTopicReferences(keyword), enrichSubjectsWithMetadata(subjects), calculateRelevanceScore(subject, placesMentioned). Enrichment adds runtime fields to Keyword (topicReferences array) and Subject (relevanceScore, placesMentioned, authors, sortTimestamp) objects. Use ChannelManager to fetch topic names. Implement relevance formula: (placesMentioned * 10) + (recencyFactor * 5) + (frequency * 2).

**Acceptance Criteria**:
- [ ] enrichKeywordWithTopicReferences returns keyword with topicReferences array
- [ ] TopicReference objects include topicId, topicName, messageCount, lastMessageDate, authors
- [ ] enrichSubjectsWithMetadata adds relevanceScore, placesMentioned, authors, sortTimestamp
- [ ] calculateRelevanceScore implements formula from data-model.md
- [ ] Handles missing topics gracefully (skip, don't throw)
- [ ] All functions are pure (no side effects)

**Dependencies**: T003
**Notes**: Service is stateless. Called by IPC handlers for each request. No caching here.

---

## PHASE 2: IPC Layer (Sequential, TDD)

### T005 - Write Test for getKeywordDetails Handler [P]
**Process**: [main]
**Files**:
- `/Users/gecko/src/lama.electron/tests/ipc/handlers/keyword-detail.getKeywordDetails.test.js`

**Description**:
Write integration test for getKeywordDetails IPC handler. Test scenarios: (1) successful retrieval with valid keyword + topicId, (2) keyword not found error, (3) topic filtering works, (4) enrichment includes topicReferences and enriched subjects, (5) access states loaded, (6) cache hit on second call. Use real ONE.core instance, create test keywords/subjects/access states. Assert response structure matches contract in getKeywordDetails.md.

**Acceptance Criteria**:
- [ ] Test initializes ONE.core with test data
- [ ] Test creates keyword with subjects and access states
- [ ] Test calls handler via ipcMain.handle mock
- [ ] All 6 scenarios covered with assertions
- [ ] Test cleans up after execution
- [ ] Test FAILS (handler not implemented yet)

**Dependencies**: T004
**Notes**: Write this test BEFORE implementing handler. Test must fail initially.

---

### T006 - Implement getKeywordDetails Handler
**Process**: [main]
**Files**:
- `/Users/gecko/src/lama.electron/main/ipc/handlers/keyword-detail.js`

**Description**:
Implement getKeywordDetails(event, { keyword, topicId }) handler. Normalize keyword to lowercase. Check 5-second TTL cache with key `${keyword}:${topicId}`. Load keyword via TopicAnalysisModel.getKeywordWithAccessStates(). Filter subjects by topicId if provided. Call enrichment service to add topicReferences to keyword and metadata to subjects. Sort subjects by relevanceScore descending. Return { success: true, data: { keyword, subjects, accessStates } }. Handle errors with { success: false, error, data: { keyword: null, subjects: [], accessStates: [] } }.

**Acceptance Criteria**:
- [ ] Handler registered as 'keywordDetail:getKeywordDetails'
- [ ] Keyword normalization (lowercase, trim) works
- [ ] Cache hit returns cached data within 5 seconds
- [ ] Calls TopicAnalysisModel and enrichment service correctly
- [ ] Subjects filtered by topicId when provided
- [ ] Subjects sorted by relevanceScore descending
- [ ] Response matches contract schema exactly
- [ ] Error handling returns structured error response
- [ ] Test T005 now PASSES

**Dependencies**: T005
**Notes**: Follow pattern from topic-analysis.js handlers. Use existing cache pattern from one-core.js.

---

### T007 - Write Test for getKeywordsByTopic Handler [P]
**Process**: [main]
**Files**:
- `/Users/gecko/src/lama.electron/tests/ipc/handlers/keyword-detail.getKeywordsByTopic.test.js`

**Description**:
Write integration test for getKeywordsByTopic IPC handler. Test scenarios: (1) returns keywords for valid topicId sorted by frequency, (2) subjectCount enrichment accurate, (3) limit parameter works, (4) includeArchived parameter filters correctly, (5) topic not found error, (6) totalCount reflects all keywords before limit. Create test data with multiple keywords and subjects. Assert response matches contract in getKeywordsByTopic.md.

**Acceptance Criteria**:
- [ ] Test creates topic with multiple keywords and subjects
- [ ] All 6 scenarios have assertions
- [ ] Test verifies sorting (frequency desc, score desc, term asc)
- [ ] Test validates subjectCount calculation
- [ ] Test confirms limit and pagination work
- [ ] Test FAILS (handler not implemented yet)

**Dependencies**: T004
**Notes**: Can write in parallel with T005. Both are independent test files.

---

### T008 - Implement getKeywordsByTopic Handler
**Process**: [main]
**Files**:
- `/Users/gecko/src/lama.electron/main/ipc/handlers/keyword-detail.js`

**Description**:
Implement getKeywordsByTopic(event, { topicId, limit = 100, includeArchived = false }) handler. Validate topicId and limit inputs. Load all subjects for topic. Filter to non-archived if includeArchived = false. Extract unique keywords from subjects. For each keyword, count subjects containing it (subjectCount). Sort by frequency (desc), score (desc), term (asc). Apply limit. Return { success: true, data: { keywords, topicId, totalCount } }.

**Acceptance Criteria**:
- [ ] Handler registered as 'keywordDetail:getKeywordsByTopic'
- [ ] Input validation throws on invalid topicId or limit
- [ ] Archived subjects filtered when includeArchived = false
- [ ] subjectCount calculated correctly for each keyword
- [ ] Sorting order matches contract (frequency → score → term)
- [ ] Limit applied correctly
- [ ] totalCount reflects count before limit
- [ ] Response matches contract schema
- [ ] Test T007 now PASSES

**Dependencies**: T007
**Notes**: No caching for this handler due to limit variability.

---

### T009 - Write Test for getAllKeywords Handler [P]
**Process**: [main]
**Files**:
- `/Users/gecko/src/lama.electron/tests/ipc/handlers/keyword-detail.getAllKeywords.test.js`

**Description**:
Write integration test for getAllKeywords IPC handler. Test scenarios: (1) aggregates keywords across all topics, (2) topicCount and subjectCount accurate, (3) topTopics shows 3 highest frequency topics, (4) accessControlCount reflects access states, (5) hasRestrictions true when 'deny' state exists, (6) sorting by frequency/alphabetical/lastSeen works, (7) pagination with limit/offset. Create test data spanning multiple topics.

**Acceptance Criteria**:
- [ ] Test creates keywords in 3+ different topics
- [ ] Test creates access states with allow and deny
- [ ] All 7 scenarios have assertions
- [ ] Test validates aggregation logic (sum frequencies, weighted average scores)
- [ ] Test confirms topTopics limited to 3 and sorted
- [ ] Test verifies pagination (hasMore flag)
- [ ] Test FAILS (handler not implemented yet)

**Dependencies**: T004
**Notes**: Can write in parallel with T005, T007. Independent test file.

---

### T010 - Implement getAllKeywords Handler
**Process**: [main]
**Files**:
- `/Users/gecko/src/lama.electron/main/ipc/handlers/keyword-detail.js`

**Description**:
Implement getAllKeywords(event, { includeArchived = false, sortBy = 'frequency', limit = 500, offset = 0 }) handler. Validate sortBy enum, limit, offset. Load all subjects and keywords across topics. Aggregate keywords: sum frequency, weighted average score, earliest extractedAt, latest lastSeen. Calculate topicCount, subjectCount, topTopics (top 3 by frequency). Load all access states, count per keyword, check for 'deny'. Sort by sortBy option. Paginate with limit/offset. Return { success: true, data: { keywords, totalCount, hasMore } }.

**Acceptance Criteria**:
- [ ] Handler registered as 'keywordDetail:getAllKeywords'
- [ ] Input validation for sortBy, limit, offset
- [ ] Keyword aggregation across topics correct
- [ ] topTopics limited to 3, sorted by frequency desc
- [ ] accessControlCount and hasRestrictions calculated
- [ ] Sorting works for all 3 options (frequency, alphabetical, lastSeen)
- [ ] Pagination: hasMore = (offset + limit) < totalCount
- [ ] Response matches contract schema
- [ ] Test T009 now PASSES

**Dependencies**: T009
**Notes**: No caching due to sorting and pagination variability.

---

### T011 - Write Test for updateKeywordAccessState Handler [P]
**Process**: [main]
**Files**:
- `/Users/gecko/src/lama.electron/tests/ipc/handlers/keyword-detail.updateKeywordAccessState.test.js`

**Description**:
Write integration test for updateKeywordAccessState IPC handler. Test scenarios: (1) create new access state (created: true), (2) update existing access state (created: false), (3) keyword not found error, (4) principal not found error, (5) invalid principalType error, (6) invalid state error, (7) cache invalidation after update. Mock getCurrentUserId(). Assert response matches contract in updateKeywordAccessState.md.

**Acceptance Criteria**:
- [ ] Test creates keyword and principal (user/group)
- [ ] Test verifies upsert logic (create vs update)
- [ ] All 7 scenarios have assertions
- [ ] Test validates updatedBy and updatedAt fields
- [ ] Test confirms cache invalidated after update
- [ ] Test verifies principalType and state validation
- [ ] Test FAILS (handler not implemented yet)

**Dependencies**: T004
**Notes**: Can write in parallel with T005, T007, T009. Independent test file.

---

### T012 - Implement updateKeywordAccessState Handler
**Process**: [main]
**Files**:
- `/Users/gecko/src/lama.electron/main/ipc/handlers/keyword-detail.js`

**Description**:
Implement updateKeywordAccessState(event, { keyword, principalId, principalType, state }) handler. Validate inputs (keyword exists, principal exists, principalType in ['user', 'group'], state in ['allow', 'deny', 'none']). Normalize keyword. Get current user via nodeOneCoreInstance.getCurrentUserId(). Call keyword-access-storage upsert function. Invalidate cache for keyword. Return { success: true, data: { accessState, created } }.

**Acceptance Criteria**:
- [ ] Handler registered as 'keywordDetail:updateKeywordAccessState'
- [ ] All input validations throw descriptive errors
- [ ] Keyword normalization applied
- [ ] Current user ID retrieved correctly
- [ ] Upsert logic creates or updates access state
- [ ] Cache invalidated for affected keyword
- [ ] Response includes created boolean flag
- [ ] Response matches contract schema
- [ ] Test T011 now PASSES

**Dependencies**: T011
**Notes**: Use verifyPrincipal helper to check if user/group exists in leuteModel or topicGroupManager.

---

### T013 - Write Test for getKeywordAccessStates Handler [P]
**Process**: [main]
**Files**:
- `/Users/gecko/src/lama.electron/tests/ipc/handlers/keyword-detail.getKeywordAccessStates.test.js`

**Description**:
Write integration test for getKeywordAccessStates IPC handler. Test scenarios: (1) returns access states for keyword with principal details, (2) allPrincipals includes all users and groups with hasState flag, (3) sorting by principalType then name, (4) keyword not found error, (5) includePrincipalDetails = false omits enrichment. Create test data with users, groups, and access states.

**Acceptance Criteria**:
- [ ] Test creates keyword with multiple access states
- [ ] Test creates users and groups
- [ ] All 5 scenarios have assertions
- [ ] Test validates principal enrichment (name, email, memberCount)
- [ ] Test confirms allPrincipals structure and hasState flags
- [ ] Test verifies sorting order
- [ ] Test FAILS (handler not implemented yet)

**Dependencies**: T004
**Notes**: Can write in parallel with T005, T007, T009, T011. Independent test file.

---

### T014 - Implement getKeywordAccessStates Handler
**Process**: [main]
**Files**:
- `/Users/gecko/src/lama.electron/main/ipc/handlers/keyword-detail.js`

**Description**:
Implement getKeywordAccessStates(event, { keyword, includePrincipalDetails = true }) handler. Validate keyword exists. Normalize keyword. Load access states for keyword. If includePrincipalDetails = true, fetch contacts and groups, enrich each state with principalName, principalEmail (users), principalMemberCount (groups). Build allPrincipals list with hasState flags. Sort by principalType (users first), then principalName, then updatedAt. Return { success: true, data: { keyword, accessStates, allPrincipals, totalStates } }.

**Acceptance Criteria**:
- [ ] Handler registered as 'keywordDetail:getKeywordAccessStates'
- [ ] Keyword validation and normalization work
- [ ] Principal enrichment fetches names, emails, member counts
- [ ] allPrincipals includes ALL users and groups
- [ ] hasState flag correctly indicates if access state exists
- [ ] Sorting order: principalType → principalName → updatedAt
- [ ] includePrincipalDetails = false omits enrichment
- [ ] Response matches contract schema
- [ ] Test T013 now PASSES

**Dependencies**: T013
**Notes**: Use 5-second TTL cache with key `access-states:${keywordTerm}`.

---

### T015 - Register All IPC Handlers in Controller
**Process**: [main]
**Files**:
- `/Users/gecko/src/lama.electron/main/ipc/controller.js`

**Description**:
Import all 5 handlers from keyword-detail.js and register them with ipcMain.handle(). Channels: 'keywordDetail:getKeywordDetails', 'keywordDetail:getKeywordsByTopic', 'keywordDetail:getAllKeywords', 'keywordDetail:updateKeywordAccessState', 'keywordDetail:getKeywordAccessStates'. Add registration calls in IPC controller initialization.

**Acceptance Criteria**:
- [ ] All 5 handlers imported from keyword-detail.js
- [ ] All 5 channels registered with ipcMain.handle()
- [ ] Channel names match contract specifications exactly
- [ ] Registration happens in controller init function
- [ ] No errors on Electron app startup

**Dependencies**: T006, T008, T010, T012, T014
**Notes**: Follow pattern from existing topic-analysis.js handler registration.

---

## PHASE 3: UI Components (Parallel where possible)

### T016 - Create TypeScript Interfaces for Keyword Detail [P]
**Process**: [renderer]
**Files**:
- `/Users/gecko/src/lama.electron/electron-ui/src/types/keyword-detail.ts`

**Description**:
Create TypeScript interfaces matching IPC response structures: KeywordAccessState, TopicReference, EnrichedKeyword, EnrichedSubject, AccessStateValue, PrincipalType, KeywordDetailResponse, KeywordsByTopicResponse, AllKeywordsResponse, AccessStatesResponse. Import SHA256Hash type from ONE.core types. Export all interfaces for use in UI components.

**Acceptance Criteria**:
- [ ] All interfaces match contract schemas exactly
- [ ] SHA256Hash imported from @refinio/one.core types
- [ ] AccessStateValue = 'allow' | 'deny' | 'none'
- [ ] PrincipalType = 'user' | 'group'
- [ ] Response interfaces include success, data, error? fields
- [ ] TypeScript compiles without errors
- [ ] Interfaces exported as named exports

**Dependencies**: None (can start immediately)
**Notes**: Parallel with other Phase 3 tasks. No dependencies.

---

### T017 - Create useKeywordDetails Hook [P]
**Process**: [renderer]
**Files**:
- `/Users/gecko/src/lama.electron/electron-ui/src/hooks/useKeywordDetails.ts`

**Description**:
Create React hook useKeywordDetails(keyword: string | null, topicId?: string). Hook calls window.electronAPI.invoke('keywordDetail:getKeywordDetails', { keyword, topicId }) when keyword changes. Return { data, loading, error, refetch }. Handle null keyword (no-op). Use React.useEffect for IPC call. Cache result in state. Provide refetch function to force reload.

**Acceptance Criteria**:
- [ ] Hook accepts keyword and optional topicId parameters
- [ ] Hook returns { data, loading, error, refetch } object
- [ ] IPC call triggered on keyword change
- [ ] Null keyword handled (no IPC call, loading = false)
- [ ] Loading state managed correctly
- [ ] Error state captured from IPC response
- [ ] refetch function re-calls IPC
- [ ] TypeScript types from keyword-detail.ts

**Dependencies**: T016
**Notes**: Parallel with T018, T019, T020. Different files.

---

### T018 - Create KeywordDetailPanel Component [P]
**Process**: [renderer]
**Files**:
- `/Users/gecko/src/lama.electron/electron-ui/src/components/KeywordDetail/KeywordDetailPanel.tsx`

**Description**:
Create main KeywordDetailPanel component. Props: keyword (string), topicId (optional), onClose (function). Use useKeywordDetails hook to fetch data. Render header with keyword name and close button. Render SortControls component. Render SubjectList component with subjects. Render AccessControlList component with access states. Handle loading and error states. Use same layout/styling as TopicSummary panel.

**Acceptance Criteria**:
- [ ] Component accepts keyword, topicId?, onClose props
- [ ] Uses useKeywordDetails hook for data fetching
- [ ] Header shows keyword name and close button
- [ ] SortControls rendered with sort options
- [ ] SubjectList rendered with subjects data
- [ ] AccessControlList rendered with access states
- [ ] Loading spinner shown during fetch
- [ ] Error message shown on fetch failure
- [ ] Styling matches TopicSummary panel
- [ ] TypeScript types correct

**Dependencies**: T017
**Notes**: Parallel with T019, T020. Imports SubjectList and AccessControlList (T019, T020).

---

### T019 - Create SubjectList Component [P]
**Process**: [renderer]
**Files**:
- `/Users/gecko/src/lama.electron/electron-ui/src/components/KeywordDetail/SubjectList.tsx`

**Description**:
Create SubjectList component. Props: subjects (EnrichedSubject[]), sortBy (SortOption), onSortChange (function). Render vertically scrollable list of subjects. Each subject shows: description, keyword combination, topic references, last seen date. Implement sorting: relevance (default), time, author. Each subject item clickable to expand details. Handle empty state ("No subjects found"). Use React virtualization if >50 subjects.

**Acceptance Criteria**:
- [ ] Component accepts subjects, sortBy, onSortChange props
- [ ] Renders scrollable list with custom scrollbar styling
- [ ] Each subject shows description, keywords, topic refs
- [ ] Sorting applied: relevance, time, author
- [ ] Empty state message when subjects.length = 0
- [ ] Smooth scroll performance (60fps)
- [ ] TypeScript types correct
- [ ] Accessible keyboard navigation

**Dependencies**: T016
**Notes**: Parallel with T018, T020. No component dependencies (standalone).

---

### T020 - Create AccessControlList Component [P]
**Process**: [renderer]
**Files**:
- `/Users/gecko/src/lama.electron/electron-ui/src/components/KeywordDetail/AccessControlList.tsx`

**Description**:
Create AccessControlList component. Props: keyword (string), accessStates (KeywordAccessState[]), allPrincipals ({ users, groups }), onAccessChange (function). Render list of users and groups with 3-state selectors (allow/deny/none). Visually distinguish users from groups (icon/label). Each selector calls onAccessChange(principalId, principalType, newState). Show loading state during state change. Handle empty state ("No users or groups").

**Acceptance Criteria**:
- [ ] Component accepts keyword, accessStates, allPrincipals, onAccessChange props
- [ ] Renders users section with user icon
- [ ] Renders groups section with group icon
- [ ] Each entry has 3-state selector (allow/deny/none)
- [ ] Selector calls onAccessChange on click
- [ ] Current state highlighted in selector
- [ ] Loading indicator during IPC call
- [ ] Empty state message when no principals
- [ ] TypeScript types correct
- [ ] Accessible ARIA labels

**Dependencies**: T016
**Notes**: Parallel with T018, T019. No component dependencies (standalone).

---

### T021 - Create SortControls Component [P]
**Process**: [renderer]
**Files**:
- `/Users/gecko/src/lama.electron/electron-ui/src/components/KeywordDetail/SortControls.tsx`

**Description**:
Create SortControls component. Props: sortBy (SortOption), onSortChange (function). Render dropdown or button group with options: Relevance, Time, Author. Current sort option highlighted. Calls onSortChange when user selects different option. Use shadcn/ui Select or RadioGroup component.

**Acceptance Criteria**:
- [ ] Component accepts sortBy, onSortChange props
- [ ] Renders sort options: Relevance, Time, Author
- [ ] Current sort option highlighted
- [ ] onSortChange called with new sort value
- [ ] Uses shadcn/ui components
- [ ] TypeScript types correct
- [ ] Accessible keyboard control

**Dependencies**: T016
**Notes**: Parallel with T018, T019, T020. Standalone component.

---

### T022 - Extend KeywordCloud Component with Click Handler
**Process**: [renderer]
**Files**:
- `/Users/gecko/src/lama.electron/electron-ui/src/components/TopicSummary/KeywordCloud.tsx`

**Description**:
Modify existing KeywordCloud component to add onKeywordClick prop. When keyword clicked, call onKeywordClick(keyword.term). Add visual feedback on hover (cursor pointer, highlight). Ensure click handler doesn't interfere with existing functionality. TypeScript prop validation.

**Acceptance Criteria**:
- [ ] onKeywordClick prop added (optional function)
- [ ] Keyword click calls onKeywordClick(keyword.term)
- [ ] Hover state shows pointer cursor and highlight
- [ ] Existing keyword cloud functionality unchanged
- [ ] TypeScript types updated with new prop
- [ ] No console errors on click

**Dependencies**: None (modifying existing component)
**Notes**: Small change to existing component. Sequential after T021 to avoid conflicts.

---

### T023 - Integrate KeywordDetailPanel into TopicSummary Container
**Process**: [renderer]
**Files**:
- `/Users/gecko/src/lama.electron/electron-ui/src/components/TopicSummary/TopicSummary.tsx`

**Description**:
Modify TopicSummary container component to support conditional rendering. Add state: view ('summary' | 'keyword-detail'), selectedKeyword (string | null). When KeywordCloud keyword clicked, set view = 'keyword-detail' and selectedKeyword = keyword. Render KeywordDetailPanel when view = 'keyword-detail'. Render TopicSummary when view = 'summary'. Close button on KeywordDetailPanel sets view = 'summary'.

**Acceptance Criteria**:
- [ ] State for view and selectedKeyword added
- [ ] KeywordCloud onKeywordClick sets view and keyword
- [ ] Conditional rendering: TopicSummary vs KeywordDetailPanel
- [ ] Same keyword click toggles panel closed
- [ ] Different keyword click switches content
- [ ] Close button returns to summary view
- [ ] No layout shift during transition
- [ ] TypeScript types correct

**Dependencies**: T018, T022
**Notes**: Sequential after T022 to avoid conflicts in same file.

---

### T024 - Create KeywordSettingsPage Component [P]
**Process**: [renderer]
**Files**:
- `/Users/gecko/src/lama.electron/electron-ui/src/components/Settings/KeywordSettingsPage.tsx`

**Description**:
Create settings page component for keyword management. Use useEffect to call window.electronAPI.invoke('keywordDetail:getAllKeywords', { sortBy, limit: 50, offset: page * 50 }). Render table with columns: Keyword, Frequency, Topics (count), Last Seen, Access Control. Inline access control editors (3-state selectors). Sorting controls in header. Pagination controls at bottom. Search/filter input at top.

**Acceptance Criteria**:
- [ ] Component renders table with 5 columns
- [ ] IPC call loads keywords on mount and page change
- [ ] Table shows keyword data with correct formatting
- [ ] Inline access control editors functional
- [ ] Sorting controls change sortBy parameter
- [ ] Pagination controls change page offset
- [ ] Search input filters keywords client-side
- [ ] Loading state during IPC call
- [ ] TypeScript types correct

**Dependencies**: T016
**Notes**: Parallel with other UI components. Standalone page.

---

### T025 - Add Keyboard Settings Navigation Entry
**Process**: [renderer]
**Files**:
- `/Users/gecko/src/lama.electron/electron-ui/src/components/Settings/SettingsNav.tsx` (or equivalent)

**Description**:
Add navigation entry for "Keywords" in settings menu. Link to KeywordSettingsPage route. Icon: Tag icon from lucide-react or similar. Position: after existing settings sections. Ensure navigation highlights active section.

**Acceptance Criteria**:
- [ ] "Keywords" entry added to settings navigation
- [ ] Entry links to correct route
- [ ] Icon displayed (Tag icon)
- [ ] Active state highlights when on keywords page
- [ ] Navigation accessible via keyboard
- [ ] No layout issues

**Dependencies**: T024
**Notes**: Small change to existing settings navigation.

---

## PHASE 4: Integration & Polish (Parallel where possible)

### T026 - Write Integration Test for Full Keyword Click Flow [P]
**Process**: [both]
**Files**:
- `/Users/gecko/src/lama.electron/tests/integration/keyword-detail-flow.test.js`

**Description**:
Write end-to-end integration test: (1) Initialize Electron app with test data, (2) Navigate to conversation with keywords, (3) Click keyword in cloud, (4) Verify KeywordDetailPanel opens, (5) Verify subjects loaded and displayed, (6) Change sort option, verify re-sort, (7) Change access state, verify IPC call and UI update, (8) Click keyword again, verify panel closes. Use Playwright or Spectron for Electron testing.

**Acceptance Criteria**:
- [ ] Test launches Electron app in test mode
- [ ] Test creates conversation with keywords
- [ ] All 8 steps automated with assertions
- [ ] Test verifies UI state at each step
- [ ] Test verifies IPC calls made correctly
- [ ] Test cleans up after execution
- [ ] Test passes with all implementations complete

**Dependencies**: T015, T023
**Notes**: Parallel with T027, T028. Integration test can be written while polish happens.

---

### T027 - Run TypeScript Type Checks [P]
**Process**: [both]
**Files**:
- All TypeScript files in feature

**Description**:
Run TypeScript compiler in check mode (`tsc --noEmit`) on all feature files. Fix any type errors: missing types, incorrect interfaces, type mismatches. Ensure all IPC call parameters typed correctly. Verify ONE.core types imported properly. Add missing type annotations where inference fails.

**Acceptance Criteria**:
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] All IPC calls have correct parameter types
- [ ] All component props typed correctly
- [ ] No `any` types (except where unavoidable)
- [ ] ONE.core types imported and used correctly
- [ ] Type errors resolved without type assertions

**Dependencies**: T016, T017, T018, T019, T020, T021, T024
**Notes**: Parallel with T026, T028. Type check task.

---

### T028 - Performance Test and Optimization [P]
**Process**: [both]
**Files**:
- IPC handlers, UI components with performance impact

**Description**:
Run performance tests: (1) IPC round-trip time for getKeywordDetails (<200ms), (2) SubjectList scroll performance with 50+ subjects (60fps), (3) Access state update latency (<50ms), (4) Settings page load time with 100+ keywords (<500ms). Profile with Chrome DevTools. Optimize bottlenecks: add React.memo to list items, debounce sort changes, implement virtual scrolling if needed.

**Acceptance Criteria**:
- [ ] getKeywordDetails IPC <200ms average
- [ ] SubjectList scroll maintains 60fps
- [ ] Access state update <50ms
- [ ] Settings page loads in <500ms
- [ ] No unnecessary re-renders in components
- [ ] Virtual scrolling implemented if >50 subjects
- [ ] Chrome DevTools profiling shows no long tasks

**Dependencies**: T018, T019, T020, T024
**Notes**: Parallel with T026, T027. Performance optimization task.

---

### T029 - Execute Quickstart Manual Testing Scenarios [P]
**Process**: [both]
**Files**:
- `/Users/gecko/src/lama.electron/specs/015-keyword-detail-preview/quickstart.md`

**Description**:
Execute all manual testing scenarios from quickstart.md: (1) Open keyword detail panel, (2) Toggle panel on/off, (3) Switch between keywords, (4) Subject list display, (5) Subject sorting (relevance), (6) Subject sorting (time/author), (7) Access control display, (8) Update access state, (9) Settings page navigation, (10) Edge cases. Document any issues found. Verify all acceptance criteria met.

**Acceptance Criteria**:
- [ ] All 10 test scenarios executed
- [ ] All acceptance criteria from spec.md verified
- [ ] Screenshots/recordings captured for review
- [ ] All issues documented with steps to reproduce
- [ ] Performance metrics recorded (IPC latency, scroll fps)
- [ ] Edge cases tested and handled correctly

**Dependencies**: T026, T027, T028
**Notes**: Final validation before feature complete. Can run in parallel with other polish tasks.

---

### T030 - Update Feature Documentation
**Process**: [both]
**Files**:
- `/Users/gecko/src/lama.electron/specs/015-keyword-detail-preview/README.md` (create if needed)

**Description**:
Create or update README.md for feature with: overview, architecture diagram, IPC contract summary, UI component hierarchy, usage examples, testing instructions, troubleshooting tips. Include links to all spec documents (plan.md, data-model.md, contracts/). Document known limitations or future enhancements.

**Acceptance Criteria**:
- [ ] README.md created with all sections
- [ ] Architecture diagram shows data flow
- [ ] IPC contracts summarized with examples
- [ ] UI components documented with props
- [ ] Testing instructions reference quickstart.md
- [ ] Troubleshooting section covers common issues
- [ ] Links to all spec documents working
- [ ] Markdown renders correctly

**Dependencies**: T029
**Notes**: Documentation task. Final step after all testing complete.

---

## Dependencies Summary

**Phase 1 (Sequential)**:
- T001 → T002 → T003 → T004

**Phase 2 (Sequential, TDD pairs)**:
- T004 → T005 → T006
- T004 → T007 → T008
- T004 → T009 → T010
- T004 → T011 → T012
- T004 → T013 → T014
- T006, T008, T010, T012, T014 → T015

**Phase 3 (Parallel)**:
- T016 starts immediately
- T016 → T017 → T018
- T016 → T019 (parallel with T018)
- T016 → T020 (parallel with T018, T019)
- T016 → T021 (parallel with T018, T019, T020)
- T021 → T022 → T023
- T016 → T024 (parallel with T018-T021)
- T024 → T025

**Phase 4 (Parallel)**:
- T015, T023 → T026
- T016-T024 → T027
- T018-T020, T024 → T028
- T026, T027, T028 → T029 → T030

---

## Parallel Execution Examples

**Phase 1** (all sequential):
```
T001 → T002 → T003 → T004
```

**Phase 2 Tests** (can write in parallel):
```
T005, T007, T009, T011, T013 (all write tests together)
```

**Phase 2 Implementations** (sequential after each test):
```
T005 → T006
T007 → T008
T009 → T010
T011 → T012
T013 → T014
```

**Phase 3 UI Components** (parallel):
```
T016 (start)
  ├→ T017 → T018
  ├→ T019
  ├→ T020
  ├→ T021 → T022 → T023
  └→ T024 → T025
```

**Phase 4 Polish** (parallel):
```
T026, T027, T028 (parallel) → T029 → T030
```

---

## Validation Checklist

### Contract Coverage
- [x] getKeywordDetails: Test T005, Implementation T006
- [x] getKeywordsByTopic: Test T007, Implementation T008
- [x] getAllKeywords: Test T009, Implementation T010
- [x] updateKeywordAccessState: Test T011, Implementation T012
- [x] getKeywordAccessStates: Test T013, Implementation T014

### Entity Coverage
- [x] KeywordAccessState: Recipe T001, Storage T002
- [x] Enriched Keyword: Enrichment T004
- [x] Enriched Subject: Enrichment T004
- [x] TopicReference: Enrichment T004

### TDD Compliance
- [x] All Phase 2 tests before implementations
- [x] Each test task followed by implementation task
- [x] Tests marked as "MUST FAIL" initially

### Architecture Compliance
- [x] All data operations in Node.js (main process)
- [x] Browser = UI only (no ONE.core)
- [x] All data flows through IPC
- [x] Fail-fast error handling (no fallbacks)

### Task Specificity
- [x] Each task has exact file paths
- [x] Parallel tasks [P] are truly independent
- [x] No task modifies same file as another [P] task
- [x] All acceptance criteria are testable

---

## Total Task Count: 30

**Breakdown**:
- Phase 1 (Data Layer): 4 tasks
- Phase 2 (IPC Layer): 11 tasks (5 test + 5 impl + 1 registration)
- Phase 3 (UI Components): 10 tasks
- Phase 4 (Integration & Polish): 5 tasks

**Estimated Timeline**:
- Phase 1: 4-6 hours (sequential)
- Phase 2: 12-16 hours (sequential with TDD)
- Phase 3: 10-14 hours (parallel possible)
- Phase 4: 6-8 hours (parallel possible)
- **Total**: 32-44 hours (~5-6 working days)

---

## Notes

- **TDD Required**: All Phase 2 tests MUST be written before implementations
- **Fail-Fast**: No fallbacks or mitigation - fix problems directly
- **IPC-First**: ALL data operations from browser go through IPC
- **No Browser ONE.core**: Browser has NO access to ONE.core - main process only
- **Type Safety**: Use proper ONE.core types (SHA256Hash, etc.), avoid `any`
- **Performance**: Target <200ms IPC round-trip, 60fps scroll
- **Testing**: Execute quickstart.md scenarios before marking complete

---

**Status**: Ready for execution
**Generated**: 2025-10-01
**Constitution**: v2.1.1 compliant
