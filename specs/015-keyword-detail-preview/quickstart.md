# Quickstart Guide: Keyword Detail Preview

**Feature**: 015-keyword-detail-preview
**Date**: 2025-10-01
**Status**: Testing Guide

## Purpose

This guide provides step-by-step instructions for testing the keyword detail preview feature both manually and programmatically.

## Prerequisites

### Environment Setup

1. **LAMA Electron app** running in development mode
2. **ONE.core** initialized with test user
3. **Test data** with at least:
   - 1 conversation with messages
   - Keywords extracted from conversation
   - 2+ users/contacts available
   - 1+ AI assistant configured

### Starting the App

```bash
cd /Users/gecko/src/lama.electron
npm run dev
```

---

## Manual Testing

### Test Scenario 1: Open Keyword Detail Panel

**Objective**: Verify keyword detail panel opens when clicking a keyword.

**Steps**:
1. Navigate to a conversation with existing messages
2. Wait for topic summary to load (shows keyword cloud)
3. Click on any keyword in the keyword cloud
4. **Expected**: Keyword detail panel opens in the same location as topic summary
5. **Verify**:
   - Panel shows keyword name in header
   - Subject list is visible (may be empty if no subjects)
   - Access control section is visible at bottom
   - Close button is present

**Pass Criteria**:
- ✓ Panel opens without errors
- ✓ UI is responsive (no lag)
- ✓ Keyword name displayed correctly
- ✓ Layout matches TopicSummary panel positioning

---

### Test Scenario 2: Toggle Panel On/Off

**Objective**: Verify clicking same keyword closes panel.

**Steps**:
1. Open keyword detail panel (see Scenario 1)
2. Click the same keyword again
3. **Expected**: Panel closes, returns to topic summary view
4. Click the keyword a third time
5. **Expected**: Panel opens again

**Pass Criteria**:
- ✓ Panel toggles open/closed on repeated clicks
- ✓ No errors in console
- ✓ Smooth transition between summary and keyword detail

---

### Test Scenario 3: Switch Between Keywords

**Objective**: Verify switching between different keywords.

**Steps**:
1. Open keyword detail panel for keyword A
2. Click on a different keyword B (without closing panel)
3. **Expected**: Panel content updates to show keyword B details
4. **Verify**:
   - Header shows keyword B name
   - Subject list updates to show keyword B subjects
   - Access states update to show keyword B access controls

**Pass Criteria**:
- ✓ Panel content switches without closing/reopening
- ✓ All sections update correctly
- ✓ No stale data from previous keyword

---

### Test Scenario 4: Subject List Display

**Objective**: Verify subjects are displayed with correct data.

**Steps**:
1. Open keyword detail panel for a keyword with 2+ subjects
2. **Verify each subject shows**:
   - Subject description text
   - Keyword combination (e.g., "blockchain+ethereum")
   - Topic reference (topic name)
   - Last seen timestamp or message count
3. Scroll through subject list if more than 5 subjects
4. **Expected**: List is scrollable without UI jank

**Pass Criteria**:
- ✓ All subjects render correctly
- ✓ Description text is readable
- ✓ Topic references are accurate
- ✓ Scrolling is smooth (60fps)

---

### Test Scenario 5: Subject Sorting (Relevance)

**Objective**: Verify default relevance-based sorting.

**Steps**:
1. Open keyword detail panel for keyword with 3+ subjects
2. Note the order of subjects
3. **Expected**: Subjects sorted by relevance score (highest first)
4. **Relevance factors**:
   - Number of places mentioned (topics)
   - Recency of mentions
   - Message frequency
5. Subject with highest relevance score should be at top

**Pass Criteria**:
- ✓ Subjects sorted by relevance
- ✓ Most relevant subject appears first
- ✓ Order is consistent across reloads

---

### Test Scenario 6: Subject Sorting (Time/Author)

**Objective**: Verify configurable sorting options.

**Steps**:
1. Open keyword detail panel
2. Click sort control dropdown
3. Select "Sort by Time"
4. **Expected**: Subjects re-sort by `lastSeen` timestamp (most recent first)
5. Select "Sort by Author"
6. **Expected**: Subjects re-sort by author name (alphabetical)

**Pass Criteria**:
- ✓ Sort controls are visible and interactive
- ✓ Each sort option works correctly
- ✓ Sort order updates without page reload
- ✓ Scroll position maintained during sort

---

### Test Scenario 7: Access Control Display

**Objective**: Verify access control list shows all users/groups.

**Steps**:
1. Open keyword detail panel
2. Scroll to access control section
3. **Verify**:
   - All known users are listed
   - All known groups are listed
   - Users and groups visually distinguished (icon/label)
   - Each entry has 3-state selector (allow/deny/not selected)
4. Check if existing access states are pre-selected

**Pass Criteria**:
- ✓ All principals (users + groups) displayed
- ✓ Visual distinction between users and groups
- ✓ 3-state selector renders correctly
- ✓ Existing states loaded from storage

---

### Test Scenario 8: Update Access State

**Objective**: Verify access state changes are saved.

**Steps**:
1. Open keyword detail panel
2. Find a user without an access state
3. Click "Allow" on the 3-state selector
4. **Expected**: State changes to "allow" immediately
5. Close panel and reopen for same keyword
6. **Expected**: User still shows "allow" state (persisted)
7. Change state to "Deny"
8. **Expected**: State updates and persists
9. Change state to "Not Selected" (none)
10. **Expected**: State clears (back to default)

**Pass Criteria**:
- ✓ State changes reflected in UI immediately
- ✓ State persists across panel close/reopen
- ✓ All three states (allow/deny/none) work correctly
- ✓ No errors in console during state changes

---

### Test Scenario 9: Settings Page Navigation

**Objective**: Verify navigation to settings page with full keyword list.

**Steps**:
1. Open app settings (Settings menu)
2. Navigate to "Keywords" section
3. **Expected**: Full list of all keywords across all topics
4. **Verify**:
   - Keywords from multiple topics are shown
   - Columns: Keyword, Frequency, Topics (count), Last Seen
   - Inline access control editors present
   - Sorting controls available
   - Pagination controls visible if >50 keywords

**Pass Criteria**:
- ✓ Settings page accessible
- ✓ All keywords listed (cross-topic aggregation)
- ✓ Metadata (frequency, topic count) accurate
- ✓ Access controls functional in settings

---

### Test Scenario 10: Edge Cases

**Objective**: Verify edge case handling.

**Test 10.1 - Keyword with No Subjects**:
1. Open keyword detail for a keyword with 0 subjects
2. **Expected**: Empty state message "No subjects found"

**Test 10.2 - Keyword with 50+ Subjects**:
1. Open keyword detail for a keyword with many subjects
2. **Expected**: Smooth scrolling, no performance issues

**Test 10.3 - Topic References with Restricted Access**:
1. Open keyword detail showing topics user doesn't have access to
2. **Expected**: Restricted topics are hidden (not shown in references)

**Test 10.4 - Concurrent Access State Updates**:
1. Open two instances of the app (different users)
2. Both update same keyword's access state
3. **Expected**: Last update wins, no data corruption

**Pass Criteria**:
- ✓ Empty states handled gracefully
- ✓ Large datasets perform well
- ✓ Permission filtering works
- ✓ Concurrent updates don't break data

---

## IPC Handler Testing

### Test IPC: getKeywordDetails

**Setup**:
```javascript
// In browser console (Electron DevTools)
const response = await window.electronAPI.invoke(
  'keywordDetail:getKeywordDetails',
  {
    keyword: 'blockchain',
    topicId: 'crypto-discussion'
  }
);

console.log('Response:', response);
```

**Expected Response**:
```javascript
{
  success: true,
  data: {
    keyword: {
      $type$: 'Keyword',
      term: 'blockchain',
      frequency: 23,
      score: 0.85,
      topicReferences: [
        { topicId: '...', topicName: '...', messageCount: 15, ... }
      ]
    },
    subjects: [
      { $type$: 'Subject', description: '...', relevanceScore: 47.5, ... }
    ],
    accessStates: [
      { $type$: 'KeywordAccessState', principalId: '...', state: 'allow', ... }
    ]
  }
}
```

**Verify**:
- ✓ `success: true`
- ✓ `keyword` object present with `topicReferences`
- ✓ `subjects` array with enriched fields (`relevanceScore`, etc.)
- ✓ `accessStates` array present (may be empty)

---

### Test IPC: getKeywordsByTopic

**Setup**:
```javascript
const response = await window.electronAPI.invoke(
  'keywordDetail:getKeywordsByTopic',
  {
    topicId: 'crypto-discussion',
    limit: 20
  }
);

console.log('Keywords:', response.data.keywords);
```

**Expected Response**:
```javascript
{
  success: true,
  data: {
    keywords: [
      {
        term: 'blockchain',
        frequency: 23,
        score: 0.85,
        subjectCount: 2
      },
      // ... more keywords
    ],
    topicId: 'crypto-discussion',
    totalCount: 47
  }
}
```

**Verify**:
- ✓ `keywords` array sorted by frequency (descending)
- ✓ `subjectCount` present for each keyword
- ✓ `totalCount` matches expected keyword count
- ✓ Limited to requested `limit` value

---

### Test IPC: getAllKeywords

**Setup**:
```javascript
const response = await window.electronAPI.invoke(
  'keywordDetail:getAllKeywords',
  {
    sortBy: 'frequency',
    limit: 50,
    offset: 0
  }
);

console.log('All keywords:', response.data.keywords);
```

**Expected Response**:
```javascript
{
  success: true,
  data: {
    keywords: [
      {
        term: 'blockchain',
        frequency: 45,
        topicCount: 3,
        subjectCount: 5,
        topTopics: [
          { topicId: '...', topicName: '...', frequency: 23 }
        ],
        accessControlCount: 5,
        hasRestrictions: true
      },
      // ... more keywords
    ],
    totalCount: 156,
    hasMore: true
  }
}
```

**Verify**:
- ✓ Keywords aggregated across all topics
- ✓ `topicCount` and `subjectCount` accurate
- ✓ `topTopics` shows top 3 topics by frequency
- ✓ `hasMore` indicates pagination correctly

---

### Test IPC: updateKeywordAccessState

**Setup**:
```javascript
// Get a user ID first
const contacts = await window.electronAPI.invoke('onecore:getContacts');
const userId = contacts.contacts[0].personId;

// Update access state
const response = await window.electronAPI.invoke(
  'keywordDetail:updateKeywordAccessState',
  {
    keyword: 'blockchain',
    principalId: userId,
    principalType: 'user',
    state: 'allow'
  }
);

console.log('Update result:', response);
```

**Expected Response**:
```javascript
{
  success: true,
  data: {
    accessState: {
      $type$: 'KeywordAccessState',
      keywordTerm: 'blockchain',
      principalId: 'sha256:...',
      principalType: 'user',
      state: 'allow',
      updatedAt: '2025-10-01T14:30:00.000Z',
      updatedBy: 'sha256:...'
    },
    created: true  // or false if updated existing
  }
}
```

**Verify**:
- ✓ `success: true`
- ✓ `accessState` object with correct `state` value
- ✓ `created` indicates if new or updated
- ✓ `updatedAt` is recent timestamp
- ✓ `updatedBy` is current user

---

### Test IPC: getKeywordAccessStates

**Setup**:
```javascript
const response = await window.electronAPI.invoke(
  'keywordDetail:getKeywordAccessStates',
  {
    keyword: 'blockchain',
    includePrincipalDetails: true
  }
);

console.log('Access states:', response.data.accessStates);
console.log('All principals:', response.data.allPrincipals);
```

**Expected Response**:
```javascript
{
  success: true,
  data: {
    keyword: 'blockchain',
    accessStates: [
      {
        principalId: '...',
        principalType: 'user',
        state: 'allow',
        principalName: 'Alice Smith',
        principalEmail: 'alice@example.com'
      },
      // ... more states
    ],
    allPrincipals: {
      users: [
        { id: '...', name: 'Alice', hasState: true },
        { id: '...', name: 'Bob', hasState: false }
      ],
      groups: [
        { id: '...', name: 'Developers', memberCount: 8, hasState: true }
      ]
    },
    totalStates: 5
  }
}
```

**Verify**:
- ✓ `accessStates` includes principal details (name, email)
- ✓ `allPrincipals` lists ALL users and groups
- ✓ `hasState` flag indicates if access state exists
- ✓ `totalStates` matches `accessStates.length`

---

## Integration Testing

### Full Flow Test: Keyword Click to Access Update

**Objective**: Test complete user journey from keyword click to access state update.

**Steps**:
1. **Setup**: Ensure conversation has keywords and 2+ contacts
2. **Action 1**: Click keyword in chat → panel opens
3. **Verify**: Keyword details load (subjects, access states)
4. **Action 2**: Change access state for User A to "allow"
5. **Verify**: IPC call succeeds, UI updates
6. **Action 3**: Close panel, reopen for same keyword
7. **Verify**: User A still shows "allow" state
8. **Action 4**: Navigate to Settings → Keywords
9. **Verify**: Keyword shows access control count > 0
10. **Action 5**: Edit access state in settings (change to "deny")
11. **Verify**: Change persists
12. **Action 6**: Return to chat, reopen keyword detail
13. **Verify**: User A now shows "deny" state

**Expected Behavior**:
- ✓ All IPC calls succeed (no errors)
- ✓ UI updates reflect data changes immediately
- ✓ Data persists across panel close/reopen
- ✓ Settings and chat views stay in sync

---

## Performance Testing

### Metrics to Measure

1. **Panel Open Time**:
   - Target: <200ms from click to full render
   - Measure: `performance.now()` in click handler

2. **Subject List Scroll**:
   - Target: 60fps with 50+ subjects
   - Measure: Chrome DevTools → Performance → Record scroll

3. **Access State Update**:
   - Target: <50ms for IPC round-trip
   - Measure: Time between click and UI update

4. **Cache Hit Rate**:
   - Target: >80% for repeated keyword clicks
   - Measure: Console logs showing cache hits vs misses

### Performance Test Script

```javascript
// Run in browser console
async function testPerformance() {
  const keyword = 'blockchain';
  const iterations = 10;
  const timings = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    const response = await window.electronAPI.invoke(
      'keywordDetail:getKeywordDetails',
      { keyword, topicId: 'crypto-discussion' }
    );

    const end = performance.now();
    timings.push(end - start);

    console.log(`Iteration ${i + 1}: ${(end - start).toFixed(2)}ms`);
  }

  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const max = Math.max(...timings);
  const min = Math.min(...timings);

  console.log(`\nPerformance Summary:`);
  console.log(`Average: ${avg.toFixed(2)}ms`);
  console.log(`Min: ${min.toFixed(2)}ms`);
  console.log(`Max: ${max.toFixed(2)}ms`);

  return { avg, min, max };
}

// Run test
testPerformance();
```

**Expected Results**:
- Average: <100ms (due to caching)
- First call: <200ms (cache miss)
- Subsequent calls: <50ms (cache hits)

---

## Troubleshooting

### Issue: Panel doesn't open on keyword click

**Diagnosis**:
1. Check browser console for errors
2. Verify `onKeywordClick` handler attached to KeywordCloud
3. Check IPC channel registration: `keywordDetail:getKeywordDetails`

**Fix**:
- Ensure IPC handlers registered in `/main/ipc/controller.js`
- Verify KeywordCloud component has `onKeywordClick` prop

---

### Issue: Access states not persisting

**Diagnosis**:
1. Check if `updateKeywordAccessState` IPC call succeeds
2. Verify ONE.core initialized (`nodeOneCoreInstance.initialized === true`)
3. Check console for "KeywordAccessState" object storage errors

**Fix**:
- Ensure `KeywordAccessState` recipe registered in `ai-recipes.ts`
- Verify `storeVersionedObject()` returns SHA256Hash
- Check cache invalidation after update

---

### Issue: Subjects not sorted correctly

**Diagnosis**:
1. Log `relevanceScore` for each subject
2. Verify enrichment service calculates scores
3. Check sort comparator logic in handler

**Fix**:
- Ensure `enrichSubjects()` adds `relevanceScore` field
- Verify `placesMentioned`, `recencyFactor`, `frequency` values
- Check array sort order (descending vs ascending)

---

### Issue: Performance lag with 50+ subjects

**Diagnosis**:
1. Profile with Chrome DevTools → Performance
2. Check for excessive re-renders in React DevTools
3. Verify virtual scrolling enabled for long lists

**Fix**:
- Implement `react-window` for subject list virtualization
- Memoize subject components with `React.memo()`
- Debounce sort control changes (300ms)

---

## Acceptance Checklist

Use this checklist to verify all acceptance scenarios from the spec are met:

- [ ] **AS-001**: Keyword click toggles panel open
- [ ] **AS-002**: Same keyword click toggles panel closed
- [ ] **AS-003**: Different keyword click switches content
- [ ] **AS-004**: Subjects display in scrollable list
- [ ] **AS-005**: Subjects sorted by relevance (default)
- [ ] **AS-006**: Subjects re-sortable by time/author
- [ ] **AS-007**: Topic references visible for each subject
- [ ] **AS-008**: All users/groups shown with 3-state selectors
- [ ] **AS-009**: Access state changes persist

**Pass Criteria**: All 9 acceptance scenarios must pass ✓

---

## Next Steps

After completing this quickstart:

1. **Document Issues**: Log any bugs found in GitHub Issues
2. **Performance Baseline**: Record metrics for future optimization
3. **User Feedback**: Share with alpha users for feedback
4. **Iterate**: Address issues and re-test

---

## References

- Feature Spec: `/specs/015-keyword-detail-preview/spec.md`
- Data Model: `/specs/015-keyword-detail-preview/data-model.md`
- IPC Contracts: `/specs/015-keyword-detail-preview/contracts/`
- Plan: `/specs/015-keyword-detail-preview/plan.md`
