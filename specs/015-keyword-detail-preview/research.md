# Research: Keyword Detail Preview

**Feature**: 015-keyword-detail-preview
**Date**: 2025-10-01
**Status**: Complete

## Research Questions

### 1. Existing Keyword & Subject Infrastructure

**Question**: How are keywords and subjects currently stored and associated?

**Findings**:
- **Keyword Model** (`main/core/one-ai/models/Keyword.ts`):
  - Stored as ONE.core versioned objects with `$type$: 'Keyword'`
  - Fields: `term, category, frequency, score, extractedAt, lastSeen, subjects[]`
  - Subjects array contains SHA256Hash references to Subject objects
  - Normalization: Lowercase, trimmed, deduplicated

- **Subject Model** (`main/core/one-ai/models/Subject.ts`):
  - Stored as ONE.core versioned objects with `$type$: 'Subject'`
  - Fields: `topicId, keywordCombination, description, confidence, keywords[], messageCount`
  - Keywords array contains SHA256Hash references to Keyword objects
  - Bidirectional relationship: Keywords ↔ Subjects

- **TopicAnalysisModel** (`main/core/one-ai/models/TopicAnalysisModel.js`):
  - Manages keyword extraction and subject identification
  - Creates/updates keywords and subjects via storage layers
  - Singleton pattern initialized through `topic-analysis.js` IPC handler

**Decision**: Extend existing models rather than create new ones. Add methods to Keyword and Subject models for access control and enrichment.

**Rationale**: Reuses proven infrastructure, maintains data consistency, follows LAMA's principle of using what exists first.

**Alternatives Considered**:
- Create separate KeywordDetail model → Rejected: Would duplicate data and break existing relationships
- Flatten into single KeywordWithDetails object → Rejected: Violates normalized data structure

---

### 2. TopicSummary Panel Integration

**Question**: How should the keyword detail panel share space with the TopicSummary panel?

**Findings**:
- **Current Architecture** (`electron-ui/src/components/TopicSummary/TopicSummary.tsx`):
  - TopicSummary component renders in right sidebar/panel area
  - Displays conversation summary with keyword cloud
  - KeywordCloud component (`KeywordCloud.tsx`) already has optional `onKeywordClick` prop
  - Uses state management for visibility and content

- **Integration Pattern**:
  - Parent component manages view state: `'summary' | 'keyword-detail'`
  - Conditional rendering based on active view
  - Toggle between summary and keyword detail using state
  - Close button returns to summary view

**Decision**: Use conditional rendering with view state management. KeywordDetailPanel and TopicSummary render in same container, mutually exclusive.

**Rationale**: Matches spec requirement "same place like summaries", follows React best practices, minimal changes to existing code.

**Implementation**:
```typescript
// Pseudo-code
const [view, setView] = useState<'summary' | 'keyword-detail'>('summary');
const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

return (
  <div className="panel-container">
    {view === 'summary' && (
      <TopicSummary onKeywordClick={(kw) => {
        setSelectedKeyword(kw);
        setView('keyword-detail');
      }} />
    )}
    {view === 'keyword-detail' && (
      <KeywordDetailPanel
        keyword={selectedKeyword}
        onClose={() => setView('summary')}
      />
    )}
  </div>
);
```

**Alternatives Considered**:
- Side-by-side layout → Rejected: Spec says "same place", not additional space
- Tab interface → Rejected: More complex, not requested in spec
- Modal overlay → Rejected: Would obscure chat messages

---

### 3. Access Control Storage

**Question**: How should keyword access states be stored and queried efficiently?

**Findings**:
- **LAMA Access Rights Pattern** (`main/core/access-rights-manager.js`):
  - Uses ONE.core IdAccess objects for object-level permissions
  - Stores access rules as versioned objects
  - Query pattern: Load all relevant access rules, filter in memory

- **ONE.core Storage Capabilities**:
  - Versioned objects support composite structures
  - Can store arrays of SHA256Hash references
  - Supports querying by object type via `loadVersionedObjects()`

**Decision**: Create `KeywordAccessState` recipe as versioned object with composite key pattern.

**Data Structure**:
```typescript
{
  $type$: 'KeywordAccessState',
  keywordTerm: string,              // Normalized keyword text
  principalId: SHA256Hash,          // User or Group ID
  principalType: 'user' | 'group',
  state: 'allow' | 'deny' | 'none',
  updatedAt: string,                // ISO timestamp
  updatedBy: SHA256Hash             // User who made the change
}
```

**Query Strategy**:
1. Load all KeywordAccessState objects (assumed small dataset: <1000)
2. Filter by keywordTerm in memory
3. Cache results with 5-second TTL (matches existing cache pattern)

**Rationale**: Follows LAMA's AccessRightsManager patterns, efficient for expected scale, uses proven ONE.core storage.

**Alternatives Considered**:
- Store access array on Keyword object → Rejected: Makes keyword object too large, harder to update
- Separate database table → Rejected: LAMA uses ONE.core exclusively
- Store as unversioned object → Rejected: Need version history for audit/debugging

---

### 4. IPC Handler Patterns

**Question**: What IPC handler structure should we follow for keyword detail operations?

**Findings**:
- **Existing Pattern** (`main/ipc/handlers/topic-analysis.js`):
  - Single file with multiple exported async functions
  - Each function matches IPC channel name
  - Pattern: `async function handlerName(event, { params })`
  - Returns structured response: `{ success: boolean, data, error? }`
  - Errors thrown, caught by IPC framework

- **Registration** (`main/ipc/controller.js`):
  - Handlers imported and registered via `ipcMain.handle()`
  - Channel naming: `namespace:action` (e.g., `topicAnalysis:getSubjects`)

**Decision**: Create `main/ipc/handlers/keyword-detail.js` following exact pattern of `topic-analysis.js`.

**Handler Signatures**:
```javascript
// Get full keyword details
export async function getKeywordDetails(event, { keyword, topicId }) {
  return { success: true, data: { keyword, subjects, accessStates, topicReferences } };
}

// Get all keywords for a topic
export async function getKeywordsByTopic(event, { topicId }) {
  return { success: true, data: { keywords } };
}

// Get all keywords (for settings page)
export async function getAllKeywords(event, {}) {
  return { success: true, data: { keywords } };
}

// Update access state
export async function updateKeywordAccessState(event, { keyword, principalId, principalType, state }) {
  return { success: true, data: { accessState } };
}

// Get access states for keyword
export async function getKeywordAccessStates(event, { keyword }) {
  return { success: true, data: { accessStates } };
}
```

**Rationale**: Consistency with existing code, proven pattern, easy to test, follows fail-fast principle.

**Alternatives Considered**:
- REST-style generic handler → Rejected: Doesn't match LAMA patterns
- Class-based handler → Rejected: LAMA uses functional approach
- Combined handler with action parameter → Rejected: Less type-safe, harder to test

---

### 5. Settings Page Integration

**Question**: Where and how should the full keyword list be accessible in settings?

**Findings**:
- **Settings Structure** (inferred from Electron app patterns):
  - Settings likely in sidebar or dedicated page
  - Need navigation entry for "Keywords" section
  - Existing word cloud settings in `useWordCloudSettings` hook

**Decision**: Create `KeywordSettingsPage.tsx` component in `electron-ui/src/components/Settings/`.

**Page Features**:
- Full searchable/filterable keyword list
- Columns: Keyword, Frequency, Topics (count), Last Seen
- Inline access control editors (3-state toggles)
- Sorting by frequency, alphabetical, date
- Pagination for large lists (50 per page)

**Navigation**:
- Add "Keywords" entry to settings menu
- Route: `/settings/keywords`
- Icon: Tag or similar semantic icon

**Rationale**: Follows standard settings page patterns, provides comprehensive keyword management, matches user request.

**Alternatives Considered**:
- Add to existing word cloud settings → Rejected: Different concerns (display vs management)
- Separate keywords window → Rejected: Less discoverable, more complex
- Context menu from keyword cloud → Rejected: Doesn't provide full list access

---

## Technical Decisions Summary

| Decision Area | Choice | Rationale |
|--------------|--------|-----------|
| Data Model | Extend existing Keyword/Subject | Reuse infrastructure |
| UI Layout | Conditional rendering in same container | Spec requirement |
| Access Storage | New KeywordAccessState recipe | Follows LAMA patterns |
| IPC Structure | Follow topic-analysis.js pattern | Consistency |
| Settings Location | New KeywordSettingsPage component | Standard pattern |

---

## Dependencies Confirmed

**Existing Infrastructure** (no changes needed):
- ONE.core versioned object storage
- TopicAnalysisModel singleton
- Keyword and Subject models
- KeywordCloud component structure
- IPC handler framework

**New Dependencies** (to be created):
- KeywordAccessState recipe
- keyword-access-storage.ts module
- keyword-detail.js IPC handlers
- KeywordDetailPanel UI components
- KeywordSettingsPage component

---

## Performance Considerations

**Keyword List Size**:
- Expected: 50-200 keywords per user
- Max design: 1000 keywords
- Strategy: Client-side filtering with virtual scrolling for >100 items

**Subject List Performance**:
- Expected: 5-20 subjects per keyword
- Max design: 50 subjects
- Strategy: Native scroll, no virtualization needed

**IPC Round-trip**:
- Target: <200ms
- Strategy: Batch access state queries, cache keyword details

**Access State Queries**:
- Expected: <100 access states per keyword (users + groups)
- Strategy: Load all for keyword, filter in memory

---

## Open Questions for Implementation

1. **Topic References**: Should clicking a topic reference in subject list navigate to that topic? → **Defer to implementation phase**

2. **Bulk Access Control**: Should settings page support bulk "allow all" / "deny all"? → **Defer to future enhancement**

3. **Group Hierarchy**: How to display nested groups in access control? → **Use flat list with indentation, defer nesting to future**

4. **Permission Filtering**: Should restricted topics be hidden or grayed out in subject list? → **Hide completely (fail-fast principle)**

---

## Conclusion

All research complete. No blocking unknowns. Ready for Phase 1 (Design & Contracts).

**Key Insight**: Feature cleanly extends existing one-ai infrastructure with minimal new concepts. Primary complexity is UI state management and access control UX, both solvable with standard React patterns.
