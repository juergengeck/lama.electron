# Data Model: Context-Aware Knowledge Sharing Proposals

**Feature**: 019-above-the-chat
**Date**: 2025-01-11

## Core Entities

### 1. Proposal (Computed, Not Stored)

**Purpose**: Represents a suggestion to share past knowledge with the current conversation

**Structure**:
```typescript
interface Proposal {
  id: string;                    // Unique identifier for this proposal instance
  pastSubject: SHA256IdHash<Subject>;    // Reference to past Subject ID hash
  currentSubject: SHA256IdHash<Subject>; // Reference to current Subject ID hash
  matchedKeywords: string[];     // Keywords that matched between subjects
  relevanceScore: number;        // 0.0 to 1.0, calculated by ranking algorithm
  sourceTopicId: string;         // Topic ID where past subject originated
  pastSubjectName: string;       // Human-readable name of past subject
  createdAt: number;             // When past subject was created (for recency)
}
```

**Lifecycle**:
- Computed on-demand when current topic has subjects
- Not persisted in ONE.core (ephemeral)
- Cached in-memory for 60 seconds
- Invalidated when current subjects change or config updates

**Validation**:
- `relevanceScore` must be >= ProposalConfig.minJaccard
- `matchedKeywords` must have length >= 1
- `pastSubject` and `currentSubject` must exist in ONE.core
- `sourceTopicId` must be different from current topic

### 2. ProposalConfig (ONE.core Versioned Object)

**Purpose**: User's configuration for proposal matching and ranking algorithm

**Recipe**:
```javascript
const ProposalConfigRecipe = {
  $type$: 'Recipe',
  name: 'ProposalConfig',
  rule: [
    {
      itemprop: 'userEmail',
      itemtype: { type: 'string' },
      isId: true  // Makes this a versioned object per user
    },
    {
      itemprop: 'matchWeight',
      itemtype: { type: 'number' }  // 0.0 to 1.0
    },
    {
      itemprop: 'recencyWeight',
      itemtype: { type: 'number' }  // 0.0 to 1.0
    },
    {
      itemprop: 'recencyWindow',
      itemtype: { type: 'integer' }  // milliseconds
    },
    {
      itemprop: 'minJaccard',
      itemtype: { type: 'number' }  // 0.0 to 1.0, minimum threshold
    },
    {
      itemprop: 'maxProposals',
      itemtype: { type: 'integer' }  // Maximum proposals to return
    },
    {
      itemprop: 'updated',
      itemtype: { type: 'integer' }  // Last update timestamp
    }
  ]
};
```

**Default Values**:
```javascript
const DEFAULT_CONFIG = {
  $type$: 'ProposalConfig',
  userEmail: currentUser.email,  // ID property
  matchWeight: 0.7,               // 70% importance to keyword overlap
  recencyWeight: 0.3,             // 30% importance to subject age
  recencyWindow: 30 * 24 * 60 * 60 * 1000,  // 30 days
  minJaccard: 0.2,                // 20% minimum keyword overlap
  maxProposals: 10,               // Show up to 10 proposals
  updated: Date.now()
};
```

**Lifecycle**:
- Created on first app use (defaults)
- Updated via settings UI
- Stored as versioned object in ONE.core
- Retrieved by ID hash (userEmail)

**Validation**:
- `matchWeight + recencyWeight` should equal ~1.0 (but not enforced)
- `matchWeight`, `recencyWeight`, `minJaccard` must be 0.0-1.0
- `recencyWindow` must be > 0
- `maxProposals` must be 1-50

### 3. DismissedProposal (Session-Only, Not Stored)

**Purpose**: Track proposals user has dismissed in current session to avoid re-showing

**Structure**:
```typescript
interface DismissedProposal {
  topicId: string;
  pastSubjectIdHash: SHA256IdHash<Subject>;
  dismissedAt: number;
}
```

**Lifecycle**:
- Stored in-memory only
- Cleared on app restart
- Cleared when switching topics
- Prevents same proposal from appearing multiple times in one session

**Validation**:
- None (ephemeral session data)

## Relationships

### Proposal ↔ Subject
- Many-to-many: One past Subject can appear in multiple Proposals (for different current Subjects)
- One-to-one: Each Proposal references exactly one past Subject and one current Subject
- Computed relationship (not stored)

### ProposalConfig ↔ User
- One-to-one: Each user has one ProposalConfig (via userEmail ID)
- Versioned: Config updates create new versions
- Retrieval via ID hash

### DismissedProposal ↔ Proposal
- One-to-one: Dismissing a Proposal creates a DismissedProposal entry
- Temporal: Only valid for current session
- Filtering: Proposals are filtered against dismissed list before display

## Computed Properties

### Relevance Score Calculation

```typescript
function calculateRelevanceScore(
  currentSubject: Subject,
  pastSubject: Subject,
  config: ProposalConfig
): number {
  // Jaccard similarity: |intersection| / |union|
  const currentKeywords = new Set(currentSubject.keywords);
  const pastKeywords = new Set(pastSubject.keywords);

  const intersection = new Set(
    [...currentKeywords].filter(k => pastKeywords.has(k))
  );
  const union = new Set([...currentKeywords, ...pastKeywords]);

  const jaccard = intersection.size / union.size;

  // Recency boost: linear decay over recency window
  const age = Date.now() - pastSubject.created;
  const recencyBoost = Math.max(0, 1 - (age / config.recencyWindow));

  // Weighted combination
  const score = jaccard * config.matchWeight + recencyBoost * config.recencyWeight;

  return score;
}
```

### Matched Keywords

```typescript
function getMatchedKeywords(
  currentSubject: Subject,
  pastSubject: Subject
): string[] {
  const currentKeywords = new Set(currentSubject.keywords);
  const pastKeywords = new Set(pastSubject.keywords);

  return [...currentKeywords].filter(k => pastKeywords.has(k));
}
```

## State Transitions

### Proposal Lifecycle

```
[No Current Subjects]
         ↓
[Current Subjects Identified] → Generate Proposals
         ↓
[Proposals Ranked by Relevance]
         ↓
[Display Top Proposal]
         ↓
   ↙          ↘
[User Swipes]  [User Clicks]
         ↓              ↓
[Show Next]    [Share to Chat] → [Dismiss]
         ↓              ↓
[Loop Back]    [Proposal Dismissed]
```

### ProposalConfig Lifecycle

```
[First App Launch]
         ↓
[Create Default Config]
         ↓
[Store in ONE.core]
         ↓
[User Opens Settings]
         ↓
[User Modifies Config]
         ↓
[Store New Version]
         ↓
[Invalidate Proposal Cache]
```

## Storage Strategy

### ONE.core Storage
- **ProposalConfig**: Versioned object (stored)
- **Subject**: Versioned object (exists from Feature 018, queried)
- **Keyword**: Versioned object (exists from Feature 018, queried)

### In-Memory Storage
- **Proposal**: Computed and cached (not stored)
- **DismissedProposal**: Session-only Set<string>

### Cache Strategy
- **Proposal Cache**: LRU cache, max 50 entries, 60-second TTL
- **Config Cache**: Single entry, invalidated on config update
- **Subject Query Cache**: Leverage existing Feature 018 caching

## Performance Considerations

### Query Optimization
- Index subjects by keyword for faster matching (if >2000 subjects)
- Limit past subject query to recent N months (configurable)
- Batch subject queries when possible

### Computation Optimization
- Cache proposals per (topicId, currentSubjects) tuple
- Precompute keyword sets (Set vs Array)
- Short-circuit when relevanceScore < minJaccard

### Memory Optimization
- Limit proposal cache to 50 entries (LRU)
- Clear dismissed proposals on topic switch
- Don't store full Subject objects in proposals (only ID hashes)

---

## Example Data Flow

**Scenario**: User is discussing "pizza recipes" and system finds "italian cooking" from past conversation

1. **Current Subjects**:
```javascript
[
  {
    $type$: 'Subject',
    id: 'pizza-recipes',
    topic: currentTopicIdHash,
    keywords: ['pizza', 'recipes', 'cooking', 'italian-food']
  }
]
```

2. **Past Subject Found**:
```javascript
{
  $type$: 'Subject',
  id: 'italian-cooking-techniques',
  topic: pastTopicIdHash,
  keywords: ['cooking', 'italian-food', 'pasta', 'techniques'],
  created: Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days ago
}
```

3. **Generated Proposal**:
```javascript
{
  id: 'prop-uuid-1234',
  pastSubject: pastSubjectIdHash,
  currentSubject: currentSubjectIdHash,
  matchedKeywords: ['cooking', 'italian-food'], // intersection
  relevanceScore: 0.68,  // (2/6)*0.7 + (1-7/30)*0.3 = 0.23*0.7 + 0.77*0.3 = 0.392
  sourceTopicId: 'past-conversation-id',
  pastSubjectName: 'Italian Cooking Techniques',
  createdAt: pastSubject.created
}
```

4. **Display**: Show as card above chat input with matched keywords highlighted

---

## Migration Notes

**From Feature 018**:
- Reuse existing Subject and Keyword models
- No schema changes needed
- Add ProposalConfig recipe to existing recipes

**Future Compatibility**:
- ProposalConfig is versioned for future algorithm changes
- Can add new ranking factors without breaking existing configs
- Proposal structure can be extended (e.g., add confidence score)
