# Quickstart: Context-Aware Knowledge Sharing Proposals

**Feature**: 019-above-the-chat
**Date**: 2025-01-11

## Purpose

This document provides step-by-step manual testing procedures to validate Feature 019. Follow these steps to verify that the proposal system works correctly before considering the feature complete.

## Prerequisites

- LAMA Electron app running
- Feature 018 (Subject/Keyword extraction) operational
- At least 2 past conversations with identified subjects
- User logged in and authenticated

## Test Scenario 1: Display Single Most Relevant Proposal

**User Story**: Display proposal when current conversation matches past subjects

**Steps**:
1. Start a new conversation about "pizza recipes"
2. Send 5+ messages mentioning: pizza, recipes, cooking, italian-food
3. Wait for Feature 018 to extract subjects (check UI indicators)
4. Look above the chat entry field

**Expected Result**:
- ✓ Exactly ONE proposal card displayed
- ✓ Card shows a past subject name (e.g., "Italian Cooking Techniques")
- ✓ Matched keywords are highlighted (e.g., "cooking", "italian-food")
- ✓ Card displays source conversation reference
- ✓ No proposals shown if no keyword matches exist

**Validation**:
```javascript
// Node.js console check:
const proposals = await ipcHandlers['proposals:getForTopic']({
  topicId: 'current-topic-id',
  forceRefresh: true
});
console.log('Proposal count:', proposals.count);
console.log('Top proposal score:', proposals.proposals[0]?.relevanceScore);
```

---

## Test Scenario 2: Swipe Through Multiple Proposals

**User Story**: Navigate through proposals using horizontal swipe

**Steps**:
1. Continue from Scenario 1 (proposal displayed)
2. Use mouse to drag proposal card LEFT (or swipe left on trackpad)
3. Observe the next proposal appearing
4. Swipe LEFT again
5. Swipe RIGHT to go back

**Expected Result**:
- ✓ Proposal changes on swipe gesture
- ✓ Proposals are ordered by relevanceScore (descending)
- ✓ Swipe left shows next lower-scored proposal
- ✓ Swipe right shows previous higher-scored proposal
- ✓ Smooth transition animation (<50ms response)
- ✓ No swipe effect when only 1 proposal exists

**Validation**:
```javascript
// Check proposal order:
const proposals = await ipcHandlers['proposals:getForTopic']({
  topicId: 'current-topic-id'
});
const scores = proposals.proposals.map(p => p.relevanceScore);
console.log('Scores are descending:', scores.every((s, i) => i === 0 || s <= scores[i-1]));
```

---

## Test Scenario 3: Share Proposal Into Conversation

**User Story**: Click proposal to share its context into current chat

**Steps**:
1. Continue from Scenario 2 (proposal displayed)
2. Click on the proposal card
3. Observe the chat input or conversation

**Expected Result**:
- ✓ Proposal content is inserted into conversation
- ✓ Past subject name is shared
- ✓ Matched keywords are included
- ✓ Proposal card remains visible (or dismissed based on design)
- ✓ User can continue typing after share action

**Validation**:
```javascript
// After clicking, check that proposal was shared:
const response = await ipcHandlers['proposals:share']({
  proposalId: 'prop-uuid-1234',
  topicId: 'current-topic-id',
  pastSubjectIdHash: 'past-subj-hash-xyz',
  includeMessages: false
});
console.log('Share successful:', response.success);
console.log('Shared content:', response.sharedContent);
```

---

## Test Scenario 4: Dismiss Proposal

**User Story**: Dismiss proposal without sharing

**Steps**:
1. Display a proposal (from Scenario 1)
2. Click dismiss button (X or swipe down, per UI design)
3. Observe that proposal disappears
4. Refresh the view or navigate away and back

**Expected Result**:
- ✓ Dismissed proposal no longer visible
- ✓ Next most relevant proposal appears (if available)
- ✓ Dismissed proposal does NOT reappear in same session
- ✓ Dismissed proposal MAY reappear after app restart (session-only dismissal)

**Validation**:
```javascript
// Dismiss and verify:
await ipcHandlers['proposals:dismiss']({
  proposalId: 'prop-uuid-1234',
  topicId: 'current-topic-id',
  pastSubjectIdHash: 'past-subj-hash-xyz'
});

// Get proposals again:
const updated = await ipcHandlers['proposals:getForTopic']({
  topicId: 'current-topic-id'
});
console.log('Remaining proposals:', updated.remainingCount);
console.log('Dismissed not present:', !updated.proposals.find(p => p.id === 'prop-uuid-1234'));
```

---

## Test Scenario 5: Configure Matching Algorithm

**User Story**: Adjust algorithm parameters in settings

**Steps**:
1. Open Settings UI
2. Navigate to "Proposal Matching" section
3. Adjust matchWeight from 0.7 to 0.9
4. Adjust minJaccard from 0.2 to 0.3
5. Save settings
6. Return to a conversation with proposals

**Expected Result**:
- ✓ Settings UI displays current config values
- ✓ Sliders or inputs allow adjustment of:
  - matchWeight (0.0-1.0)
  - recencyWeight (0.0-1.0)
  - recencyWindow (milliseconds)
  - minJaccard (0.0-1.0)
  - maxProposals (1-50)
- ✓ Config saved to ONE.core as versioned object
- ✓ Proposal cache invalidated after config change
- ✓ New proposals reflect updated config

**Validation**:
```javascript
// Get current config:
const configBefore = await ipcHandlers['proposals:getConfig']({});
console.log('Config before:', configBefore.config);

// Update config:
const result = await ipcHandlers['proposals:updateConfig']({
  config: {
    matchWeight: 0.9,
    recencyWeight: 0.1,
    minJaccard: 0.3
  }
});
console.log('Update successful:', result.success);
console.log('New config:', result.config);

// Verify proposals changed:
const newProposals = await ipcHandlers['proposals:getForTopic']({
  topicId: 'current-topic-id',
  forceRefresh: true
});
console.log('Proposals recomputed with new config:', newProposals.cached === false);
```

---

## Test Scenario 6: No Current Subjects

**User Story**: No proposals shown when conversation has no subjects

**Steps**:
1. Start a brand new conversation
2. Send 1-2 brief messages (not enough for subject extraction)
3. Look above the chat entry field

**Expected Result**:
- ✓ No proposal card displayed
- ✓ No error messages or UI glitches
- ✓ Chat entry field fully functional
- ✓ Once 5+ messages sent and subjects extracted, proposals appear

**Validation**:
```javascript
// For new topic with no subjects:
try {
  const proposals = await ipcHandlers['proposals:getForTopic']({
    topicId: 'new-topic-no-subjects'
  });
  console.log('Should have NO_SUBJECTS error or empty proposals');
} catch (err) {
  console.log('Error code:', err.code); // Should be 'NO_SUBJECTS'
}
```

---

## Test Scenario 7: Performance Validation

**User Story**: Proposal generation completes within performance targets

**Steps**:
1. Create 50+ past conversations with subjects
2. Start a new conversation with overlapping keywords
3. Measure time to generate proposals

**Expected Result**:
- ✓ Proposal computation completes in <100ms
- ✓ Swipe gesture response in <50ms
- ✓ No UI lag or freezing
- ✓ Cache hit on second request (when no subjects changed)

**Validation**:
```javascript
// Time proposal generation:
const start = Date.now();
const proposals = await ipcHandlers['proposals:getForTopic']({
  topicId: 'current-topic-id',
  forceRefresh: true
});
const elapsed = Date.now() - start;
console.log('Generation time:', elapsed, 'ms');
console.log('Meets target (<100ms):', elapsed < 100);
console.log('Compute time from response:', proposals.computeTimeMs);

// Test cache hit:
const start2 = Date.now();
const cached = await ipcHandlers['proposals:getForTopic']({
  topicId: 'current-topic-id',
  forceRefresh: false
});
const elapsed2 = Date.now() - start2;
console.log('Cache hit time:', elapsed2, 'ms');
console.log('From cache:', cached.cached === true);
```

---

## Integration Test Checklist

Run these checks to ensure Feature 019 integrates correctly with existing features:

### Integration with Feature 018 (Subject Extraction)
- [ ] Proposals appear after subjects are extracted
- [ ] Proposals update when new subjects added to current conversation
- [ ] Keyword changes in subjects trigger proposal cache invalidation
- [ ] Subject ID hashes correctly match between current and past

### IPC Handler Integration
- [ ] All 5 IPC handlers respond correctly
- [ ] Error codes match contract definitions
- [ ] Request/response schemas validated
- [ ] No IPC timeouts or hangs

### ONE.core Integration
- [ ] ProposalConfig stored as versioned object
- [ ] userEmail used as ID property
- [ ] Config retrieval by ID hash works
- [ ] Version history tracked for config changes

### UI Integration
- [ ] Proposal card fits above chat entry field
- [ ] No layout shifts when proposal appears/disappears
- [ ] Swipe gestures don't interfere with scrolling
- [ ] Mobile-responsive (if applicable)

---

## Known Limitations

- Proposals are session-scoped (dismissals cleared on restart)
- Cache is in-memory only (cleared on app restart)
- No machine learning ranking (simple Jaccard + recency)
- No user feedback on proposal quality

---

## Troubleshooting

**Proposals not appearing:**
1. Check Feature 018 is working (subjects extracted)
2. Verify past conversations have subjects with keywords
3. Check minJaccard threshold isn't too high
4. Verify no IPC errors in console

**Performance issues:**
1. Check number of past subjects (<2000 recommended)
2. Verify cache is enabled and hitting
3. Check for excessive logging in IPC handlers
4. Profile keyword matching algorithm

**Config changes not applying:**
1. Verify config saved to ONE.core (check versionHash)
2. Force refresh proposals with `forceRefresh: true`
3. Clear cache manually if needed
4. Check for IPC handler errors

---

## Success Criteria

Feature 019 is considered complete when:

✅ All 7 test scenarios pass
✅ Integration checklist items verified
✅ Performance targets met (<100ms generation, <50ms swipe)
✅ No IPC errors or crashes
✅ User can configure algorithm parameters
✅ Proposals update in real-time as conversation evolves
