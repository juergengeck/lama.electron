# Research: Context-Aware Knowledge Sharing Proposals

**Feature**: 019-above-the-chat
**Date**: 2025-01-11

## Research Questions

1. React swipe gesture libraries for Electron
2. Keyword matching/relevance algorithms
3. Proposal caching strategies
4. ONE.core configuration storage

---

## 1. Swipe Gesture Libraries for Electron

### Decision: **react-swipeable**

**Rationale**:
- Lightweight (11KB) and focused on swipe gestures only
- Works with both mouse and touch events (critical for Electron desktop)
- Provides onSwipedLeft/Right callbacks with velocity tracking
- No animation library needed (just state changes)
- Better for desktop than react-spring (which is animation-focused)

**Alternatives Considered**:
- **react-spring**: Excellent for animations but overkill for simple carousel
- **Custom handlers**: More control but requires handling mouse drag, touch, and edge cases
- **react-swiper**: Heavy (Swiper.js wrapper), designed for mobile web

**Implementation**:
```tsx
import { useSwipeable } from 'react-swipeable';

const handlers = useSwipeable({
  onSwipedLeft: () => nextProposal(),
  onSwipedRight: () => previousProposal(),
  preventScrollOnSwipe: true,
  trackMouse: true  // Enable mouse drag for desktop
});

<div {...handlers}>
  <ProposalCard proposal={current} />
</div>
```

---

## 2. Keyword Matching & Relevance Algorithms

### Decision: **Jaccard Similarity with Recency Weight**

**Rationale**:
- Fast: O(n+m) set operations, <1ms for 20 keywords
- Simple: intersection size / union size
- Intuitive: 0.0 (no overlap) to 1.0 (identical)
- Scales well: 1000 subjects × 10 keywords = 10,000 comparisons in ~50ms

**Formula**:
```javascript
function calculateRelevance(currentKeywords, pastKeywords, pastSubjectAge) {
  const intersection = new Set(
    [...currentKeywords].filter(k => pastKeywords.has(k))
  );
  const union = new Set([...currentKeywords, ...pastKeywords]);

  const jaccard = intersection.size / union.size;
  const recencyBoost = Math.max(0, 1 - (pastSubjectAge / (30 * 24 * 60 * 60 * 1000))); // 30 day decay

  return jaccard * (0.7 + 0.3 * recencyBoost); // 70% match, 30% recency
}
```

**Alternatives Considered**:
- **Simple overlap count**: Too coarse, doesn't normalize for keyword set size
- **TF-IDF**: Requires global keyword frequency stats, too complex
- **Cosine similarity**: Requires vector representation, unnecessary for exact keyword matches

**Configuration Parameters**:
- `matchWeight` (default 0.7): Importance of keyword overlap
- `recencyWeight` (default 0.3): Importance of subject age
- `recencyWindow` (default 30 days): Time window for recency boost
- `minJaccard` (default 0.2): Minimum similarity threshold

---

## 3. Proposal Caching Strategy

### Decision: **In-Memory LRU Cache with Invalidation**

**Rationale**:
- Fast: O(1) lookup, no disk I/O
- Sufficient: Proposals are computed (not stored), cache prevents recomputation
- Invalidation clear: New subject added, config changed, or topic switch

**Implementation**:
```javascript
class ProposalCache {
  constructor(maxSize = 50) {
    this.cache = new Map(); // topicId -> { proposals, timestamp }
    this.maxSize = maxSize;
  }

  get(topicId, currentSubjects) {
    const key = this.cacheKey(topicId, currentSubjects);
    if (!this.cache.has(key)) return null;

    const entry = this.cache.get(key);
    // Invalidate after 60 seconds
    if (Date.now() - entry.timestamp > 60000) {
      this.cache.delete(key);
      return null;
    }
    return entry.proposals;
  }

  set(topicId, currentSubjects, proposals) {
    const key = this.cacheKey(topicId, currentSubjects);

    // LRU eviction
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      proposals,
      timestamp: Date.now()
    });
  }

  invalidate(topicId) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(topicId)) {
        this.cache.delete(key);
      }
    }
  }

  cacheKey(topicId, subjects) {
    const subjectIds = subjects.map(s => s.id).sort().join(',');
    return `${topicId}:${subjectIds}`;
  }
}
```

**Invalidation Triggers**:
1. New subject added to current topic
2. Proposal config changed
3. Topic switched
4. 60-second TTL expired

**Alternatives Considered**:
- **Persistent cache**: Unnecessary complexity, proposals recompute quickly
- **No cache**: Recomputation every render would cause lag
- **Infinite cache**: Memory leak risk with many topics

---

## 4. ONE.core Configuration Storage

### Decision: **Versioned UserConfig Object**

**Rationale**:
- Follows ONE.core patterns for user preferences
- Versioned: Can update config without losing history
- ID-based: One config per user (email as ID)
- Type-safe: Recipe defines schema

**Recipe**:
```javascript
const ProposalConfigRecipe = {
  $type$: 'Recipe',
  name: 'ProposalConfig',
  rule: [
    {
      itemprop: 'userEmail',
      itemtype: { type: 'string' },
      isId: true
    },
    {
      itemprop: 'matchWeight',
      itemtype: { type: 'number' }
    },
    {
      itemprop: 'recencyWeight',
      itemtype: { type: 'number' }
    },
    {
      itemprop: 'recencyWindow',
      itemtype: { type: 'integer' } // milliseconds
    },
    {
      itemprop: 'minJaccard',
      itemtype: { type: 'number' }
    },
    {
      itemprop: 'updated',
      itemtype: { type: 'integer' }
    }
  ]
};
```

**Storage**:
```javascript
// Store user's proposal config
const config = {
  $type$: 'ProposalConfig',
  userEmail: currentUser.email,
  matchWeight: 0.7,
  recencyWeight: 0.3,
  recencyWindow: 30 * 24 * 60 * 60 * 1000, // 30 days
  minJaccard: 0.2,
  updated: Date.now()
};

await storeVersionedObject(config);

// Retrieve latest config
const configIdHash = await calculateIdHashOfObj(config);
const latestConfig = await getObjectByIdHash(configIdHash);
```

**Alternatives Considered**:
- **Unversioned object**: Can't track config changes over time
- **File system config**: Doesn't integrate with ONE.core patterns
- **In-memory only**: Lost on restart, no sync across instances

---

## Summary of Decisions

| Area | Decision | Key Benefit |
|------|----------|-------------|
| Swipe | react-swipeable | Mouse + touch support for desktop |
| Matching | Jaccard + Recency | Fast (<100ms), intuitive scoring |
| Caching | In-memory LRU | O(1) lookup, clear invalidation |
| Config | Versioned ONE.core | Follows app patterns, history tracking |

---

## Performance Validation

**Target**: <100ms proposal generation

**Estimated**:
- Subject query: ~10ms (100 subjects)
- Keyword matching: ~40ms (1000 comparisons @ 0.04ms each)
- Sorting: ~5ms (10 proposals)
- Cache lookup: <1ms
- **Total**: ~55ms ✓

**Bottlenecks**:
- If >2000 past subjects: Consider indexing by keyword
- If >50 keywords per subject: Consider keyword pruning

---

## Open Questions
*All resolved - ready for Phase 1*

None.
