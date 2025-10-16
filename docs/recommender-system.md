# Recommender System (Proposal Engine)

## Overview

The Recommender System is a context-aware knowledge sharing feature that suggests relevant past conversations based on subject and keyword matching. It displays proposals above the chat input field, helping users discover related discussions and bring context into current conversations.

**Feature Code**: Feature 019 - "Above the Chat"
**Status**: Implemented and Active
**Specification**: `/specs/019-above-the-chat/spec.md`

## Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│ UI Layer (React)                                            │
│ - ProposalCarousel (swipeable container)                   │
│ - ProposalCard (single proposal display)                   │
│ - useProposals (state management hook)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ IPC Bridge
┌──────────────────────▼──────────────────────────────────────┐
│ IPC Layer (Electron Main)                                   │
│ - proposals:getForTopic                                     │
│ - proposals:share / proposals:dismiss                       │
│ - proposals:getConfig / proposals:updateConfig              │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ Engine Layer (Node.js Services)                             │
│ - ProposalEngine (matching logic)                           │
│ - ProposalRanker (scoring & ranking)                        │
│ - ProposalCache (LRU cache with TTL)                        │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Opens Chat
    ↓
useProposals Hook → IPC: proposals:getForTopic
    ↓
Check Cache (60s TTL)
    ↓ (cache miss)
TopicAnalysisModel.getSubjects(topicId) → Current Subjects
    ↓
ProposalEngine.getProposalsForTopic()
    ↓
Fetch ALL Subjects from ALL Topics
    ↓
For each current subject:
    For each past subject (different topic):
        Calculate Jaccard Similarity
        Calculate Recency Boost
        Compute Relevance Score
        Filter by minJaccard threshold
    ↓
ProposalRanker.rankProposals()
    ↓
Sort by relevance (descending)
Limit to maxProposals (10)
    ↓
Filter against dismissed proposals
    ↓
Cache results
    ↓
Return proposals → UI Display
```

## Core Components

### ProposalEngine (`/main/services/proposal-engine.ts`)

**Responsibility**: Generate proposals by matching current subjects with past subjects

**Key Method**: `getProposalsForTopic(topicId, currentSubjects, config)`

**Algorithm**:
1. Fetch current subject objects from ONE.core using ID hashes
2. Fetch all subjects from all topics (or use pre-fetched array)
3. Filter out subjects from the same topic
4. For each current-past subject pair:
   - Calculate Jaccard similarity between keyword sets
   - Skip if below `minJaccard` threshold
   - Calculate recency boost based on past subject age
   - Compute combined relevance score
   - Extract matched keywords (intersection)
   - Create proposal object

**Jaccard Similarity Formula**:
```javascript
// Measure keyword overlap
const intersection = currentKeywords.filter(k => pastKeywords.has(k))
const union = [...new Set([...currentKeywords, ...pastKeywords])]
const jaccard = intersection.size / union.size

// Example:
// Current: [pizza, dough, yeast]
// Past:    [pizza, recipe, dough]
// Intersection: [pizza, dough] = 2
// Union: [pizza, dough, yeast, recipe] = 4
// Jaccard: 2/4 = 0.5 (50% similarity)
```

**Recency Boost Formula**:
```javascript
// Linear decay over recency window
const age = Date.now() - pastSubject.createdAt
const recencyBoost = Math.max(0, 1 - (age / config.recencyWindow))

// Example (30-day window):
// 0 days old:  recencyBoost = 1.0 (100%)
// 15 days old: recencyBoost = 0.5 (50%)
// 30 days old: recencyBoost = 0.0 (0%)
// 45 days old: recencyBoost = 0.0 (capped at 0)
```

**Relevance Score Formula**:
```javascript
const relevanceScore =
    jaccard * config.matchWeight +
    recencyBoost * config.recencyWeight

// Example with defaults (matchWeight=0.7, recencyWeight=0.3):
// jaccard = 0.6, recencyBoost = 0.5
// relevanceScore = 0.6 × 0.7 + 0.5 × 0.3 = 0.42 + 0.15 = 0.57 (57%)
```

### ProposalRanker (`/main/services/proposal-ranker.ts`)

**Responsibility**: Rank proposals by relevance and limit results

**Key Method**: `rankProposals(proposals, config)`

**Algorithm**:
1. Sort proposals by `relevanceScore` (descending)
2. Slice to `config.maxProposals` (default: 10)
3. Return ranked list

**Utility Methods**:
- `calculateRelevanceScore(jaccard, recency, config)` - Recalculate score
- `calculateRecencyBoost(createdAt, recencyWindow)` - Recency calculation

### ProposalCache (`/main/services/proposal-cache.ts`)

**Responsibility**: LRU cache with TTL for proposal results

**Configuration**:
- Max Size: 50 entries
- TTL: 60 seconds (60,000ms)

**Cache Key Format**: `${topicId}:${sortedSubjectIds.join(',')}`

**Operations**:
- `get(topicId, currentSubjects)` - Retrieve cached proposals (null if expired)
- `set(topicId, currentSubjects, proposals)` - Store proposals
- `invalidate(topicId)` - Clear all entries for topic
- `clear()` - Clear entire cache

**LRU Eviction**: When cache is full, oldest entry is removed (FIFO)

**TTL Expiration**: Entries checked on `get()`, deleted if expired

### IPC Handlers (`/main/ipc/handlers/proposals.ts`)

**Available Handlers**:

#### `proposals:getForTopic`
Get ranked proposals for a specific topic.

**Request**:
```typescript
{
  topicId: string
  currentSubjects?: SHA256IdHash<any>[]  // Optional - auto-queried if missing
  forceRefresh?: boolean                 // Skip cache
}
```

**Response**:
```typescript
{
  proposals: Proposal[]      // Ranked proposals
  count: number              // Number of proposals
  cached: boolean            // Whether from cache
  computeTimeMs: number      // Generation time
}
```

**Error Codes**:
- `TOPIC_NOT_FOUND`: topicId is required
- `NO_SUBJECTS`: Topic has no identified subjects yet
- `COMPUTATION_ERROR`: Engine or ranker error

#### `proposals:share`
Share a proposal's past subject into current conversation.

**Request**:
```typescript
{
  proposalId: string
  topicId: string
  pastSubjectIdHash: SHA256IdHash<any>
  includeMessages?: boolean  // Include sample messages (future)
}
```

**Response**:
```typescript
{
  success: boolean
  sharedContent: {
    subjectName: string      // Human-readable name
    keywords: string[]       // Matched keyword terms
    messages?: any[]         // Sample messages (future)
  }
}
```

**Side Effects**:
- Automatically dismisses proposal (added to session-only dismissed set)

**Error Codes**:
- `SUBJECT_NOT_FOUND`: Past subject no longer exists
- `SHARE_FAILED`: Storage or retrieval error

#### `proposals:dismiss`
Dismiss a proposal for the current session.

**Request**:
```typescript
{
  proposalId: string
  topicId: string
  pastSubjectIdHash: string
}
```

**Response**:
```typescript
{
  success: boolean
  remainingCount: number     // Number of remaining proposals
}
```

**Note**: Dismissals are session-only (in-memory), cleared on app restart

#### `proposals:getConfig`
Get current user's proposal configuration.

**Response**:
```typescript
{
  config: ProposalConfig
  isDefault: boolean         // True if using default config
}
```

#### `proposals:updateConfig`
Update user's proposal configuration.

**Request**:
```typescript
{
  config: Partial<ProposalConfig>
}
```

**Response**:
```typescript
{
  success: boolean
  config: ProposalConfig     // Updated config
  versionHash?: string       // ONE.core version hash
}
```

**Side Effects**:
- Invalidates entire proposal cache
- Stores config as versioned object in ONE.core

**Validation**:
- `matchWeight`: 0.0-1.0
- `recencyWeight`: 0.0-1.0
- `minJaccard`: 0.0-1.0
- `maxProposals`: 1-50

## Data Models

### Proposal (Ephemeral - Computed on Demand)

```typescript
interface Proposal {
  id: string                           // Unique ID: prop-{timestamp}-{random}
  pastSubject: SHA256IdHash<Subject>   // Reference to past subject
  currentSubject: SHA256IdHash<Subject> // Reference to current subject
  matchedKeywords: string[]            // Keyword terms (intersection)
  relevanceScore: number               // 0.0-1.0
  sourceTopicId: string                // Where past subject came from
  pastSubjectName: string              // Human-readable label
  createdAt: number                    // Past subject timestamp
}
```

**Lifecycle**: Generated per request, not stored in ONE.core

### ProposalConfig (ONE.core Versioned Object)

```typescript
interface ProposalConfig {
  $type$: 'ProposalConfig'
  userEmail: string        // ID property (versioned by user)
  matchWeight: number      // 0.0-1.0 (default: 0.7)
  recencyWeight: number    // 0.0-1.0 (default: 0.3)
  recencyWindow: number    // Milliseconds (default: 30 days)
  minJaccard: number       // 0.0-1.0 (default: 0.2 = 20%)
  maxProposals: number     // 1-50 (default: 10)
  updated: number          // Last update timestamp
}
```

**Storage**: Versioned object in ONE.core (ID: userEmail)

**Recipe**: `/main/recipes/proposal-recipes.ts`

### DismissedProposal (Session-Only - In-Memory)

```typescript
// Stored in Set<string> with key format:
const dismissKey = `${topicId}:${pastSubjectIdHash}`
```

**Lifecycle**: Created on dismiss/share, cleared on app restart

## UI Components

### ProposalCarousel (`/electron-ui/src/components/ProposalCarousel.tsx`)

**Responsibility**: Swipeable container for navigating proposals

**Features**:
- Swipe gestures (left/right) via `react-swipeable`
- Mouse drag support for desktop
- Navigation buttons (prev/next)
- Position indicator (e.g., "2 / 5")

**Props**:
```typescript
interface ProposalCarouselProps {
  proposals: Proposal[]
  currentIndex: number
  onNext: () => void
  onPrevious: () => void
  onShare: (proposalId: string, pastSubjectIdHash: string) => Promise<void>
  onDismiss: (proposalId: string, pastSubjectIdHash: string) => Promise<void>
}
```

**Positioning**: Absolutely positioned above message input field in `MessageView.tsx:416-437`

### ProposalCard (`/electron-ui/src/components/ProposalCard.tsx`)

**Responsibility**: Display a single proposal

**Visual Elements**:
- Subject name with relevance score (e.g., "Related: pizza-making (60% match)")
- Matched keywords as blue pills
- Share button (blue, primary action)
- Dismiss button (X icon, secondary action)

**Styling**:
- Semi-transparent blue background (`bg-blue-50/80 dark:bg-blue-900/30`)
- Backdrop blur effect
- Hover shadow transition

### useProposals Hook (`/electron-ui/src/hooks/useProposals.ts`)

**Responsibility**: React state management for proposals

**Features**:
- Auto-refresh when topic or subjects change
- Carousel navigation (next/previous)
- Share and dismiss actions
- Loading and error states
- Manual refresh capability

**Usage**:
```typescript
const {
  proposals,        // Array of proposals
  currentIndex,     // Current carousel position
  currentProposal,  // Currently displayed proposal
  loading,          // Fetching state
  error,            // Error message
  nextProposal,     // Navigate forward
  previousProposal, // Navigate backward
  dismissProposal,  // Dismiss proposal
  shareProposal,    // Share proposal
  refresh           // Force refresh
} = useProposals({
  topicId: 'topic-123',
  currentSubjects: [subjectHash1, subjectHash2],
  autoRefresh: true
})
```

**Auto-Refresh Triggers**:
- Topic ID changes
- Current subjects change (via dependency array)

**Error Handling**:
- `NO_SUBJECTS` errors are silently handled (expected for new conversations)
- Other errors are logged and exposed via `error` state

## Integration Points

### Depends on Feature 018 (Structured LLM Communication)

The recommender system relies on Topic Analysis to extract subjects and keywords:

1. **TopicAnalysisModel** provides subjects for current topic
2. **Subject objects** contain keyword ID hashes
3. **Keyword objects** provide terms for display

**Data Flow**:
```
Chat Messages → AI Analysis → Keywords → Subjects → Proposals
```

### Integration with MessageView

**Location**: `/electron-ui/src/components/MessageView.tsx:416-437`

**Positioning**:
- Absolutely positioned at `bottom: 64px` (16px = 4rem)
- Full width with horizontal padding
- Pointer events disabled on container, enabled on carousel

**Padding Compensation**:
- Message area gets `paddingBottom: '120px'` when proposals are visible
- Prevents messages from being hidden behind proposal bar

**Share Action**:
```typescript
onShare={async (proposalId, pastSubjectIdHash) => {
  const result = await shareProposal(proposalId, pastSubjectIdHash, false)
  if (result.success && result.sharedContent) {
    const contextMessage =
      `Related context from "${result.sharedContent.subjectName}": ` +
      result.sharedContent.keywords.join(', ')
    await onSendMessage(contextMessage)
  }
}}
```

**Result**: Inserts context message into chat like a normal user message

## Configuration

### Default Configuration

```typescript
const DEFAULT_CONFIG: ProposalConfig = {
  userEmail: '',
  matchWeight: 0.7,              // 70% weight on keyword overlap
  recencyWeight: 0.3,            // 30% weight on recency
  recencyWindow: 30 * 24 * 60 * 60 * 1000,  // 30 days
  minJaccard: 0.2,               // 20% minimum similarity
  maxProposals: 10,              // Show up to 10 proposals
  updated: Date.now()
}
```

### Customization

Users can customize via IPC handler (future UI integration):

```typescript
await window.electronAPI.invoke('proposals:updateConfig', {
  config: {
    matchWeight: 0.8,      // Prioritize keyword match
    recencyWeight: 0.2,    // De-prioritize recency
    maxProposals: 5        // Show fewer proposals
  }
})
```

**Effects**:
- Clears proposal cache (forces regeneration with new weights)
- Stores config as versioned object (persists across sessions)

## Performance

### Targets

- **Proposal Generation**: <100ms (includes subject query + matching + ranking)
- **Cache Lookup**: <1ms (O(1) map access)
- **Swipe Gesture Response**: <50ms
- **IPC Round-Trip**: <10ms

### Optimization Strategies

#### 1. Caching
- **LRU Cache**: Max 50 entries, 60-second TTL
- **Cache Key**: Includes sorted subject IDs for consistency
- **Hit Rate**: Typically 80%+ for active conversations

#### 2. Lazy Initialization
- ProposalEngine initialized only when first proposal is requested
- Reduces startup overhead

#### 3. Pre-fetching
- Option to pass `allSubjects` array to avoid repeated queries
- Useful for batch operations

#### 4. Parallel Processing
- Keyword retrieval uses `Promise.all()` for concurrent fetches
- Subject queries parallelized across topics

### Monitoring

**Metrics Available**:
- `computeTimeMs`: Time to generate proposals (includes all operations)
- `cached`: Whether result was from cache
- `count`: Number of proposals returned

**Logging**:
```javascript
console.log(
  `[useProposals] Fetched ${count} proposals in ${computeTimeMs}ms ` +
  `(cached: ${cached})`
)
```

## Testing

### Integration Tests

Location: `/tests/integration/proposals/`

**Test Suites**:
- `test-proposals-ipc-contract.ts` - IPC handler contracts
- `test-proposals-config-contract.ts` - Configuration validation
- `test-proposals-dismiss-contract.ts` - Dismiss functionality
- `test-proposals-share-contract.ts` - Share functionality

**Coverage**:
- Jaccard similarity calculations
- Recency boost calculations
- Ranking and sorting
- Cache hit/miss scenarios
- Config validation and storage
- Error handling (NO_SUBJECTS, INVALID_CONFIG, etc.)

### Manual Testing

**Scenario 1: Basic Matching**
1. Create conversation A about "pizza making" with keywords: pizza, dough, yeast
2. Create conversation B about "bread baking" with keywords: dough, yeast, flour
3. Open conversation A
4. Verify proposal appears for conversation B
5. Check relevance score (should be ~0.5 with 2/4 match)

**Scenario 2: Share Action**
1. Click "Share" on proposal
2. Verify context message inserted into chat
3. Verify proposal dismissed automatically
4. Verify proposal doesn't reappear on refresh

**Scenario 3: Swipe Navigation**
1. Generate multiple proposals (3+)
2. Swipe left to navigate forward
3. Swipe right to navigate backward
4. Verify position indicator updates (e.g., "2 / 5")

**Scenario 4: Cache Behavior**
1. Generate proposals for topic
2. Refresh within 60 seconds
3. Verify `cached: true` in logs
4. Wait 60+ seconds and refresh
5. Verify `cached: false` (cache expired)

## Common Issues

### No Proposals Appear

**Possible Causes**:
1. **No subjects extracted yet** - Wait for AI analysis (triggered after 5 messages)
2. **No matching past subjects** - Create more diverse conversations
3. **Jaccard below threshold** - Lower `minJaccard` in config (default: 0.2)
4. **All proposals dismissed** - Restart app to clear session dismissals

**Debug**:
```javascript
// Check if subjects exist
const subjects = await window.electronAPI.invoke('topicAnalysis:getSubjects', {
  topicId: 'topic-123'
})
console.log('Current subjects:', subjects)

// Check proposal generation
const response = await window.electronAPI.invoke('proposals:getForTopic', {
  topicId: 'topic-123',
  forceRefresh: true
})
console.log('Proposals:', response)
```

### Proposals Not Updating

**Possible Causes**:
1. **Cache not invalidated** - Use `forceRefresh: true`
2. **Subjects not changing** - Verify new keywords are being extracted
3. **Auto-refresh disabled** - Check `autoRefresh: true` in `useProposals`

**Fix**:
```typescript
// Force refresh
await refresh()

// Or clear cache entirely (requires IPC handler extension)
proposalCache.clear()
```

### Low Relevance Scores

**Possible Causes**:
1. **Low keyword overlap** - Subjects are genuinely different
2. **Old conversations** - Recency boost is low (>30 days)
3. **Config mismatch** - Check `matchWeight` and `recencyWeight`

**Tune Configuration**:
```typescript
// Prioritize keyword match over recency
await window.electronAPI.invoke('proposals:updateConfig', {
  config: {
    matchWeight: 0.9,
    recencyWeight: 0.1
  }
})
```

### Performance Degradation

**Possible Causes**:
1. **Too many subjects** - Reduce `maxProposals` limit
2. **Cache thrashing** - Increase cache size or TTL
3. **Large topic count** - Consider pagination or filtering

**Optimize**:
```typescript
// Reduce max proposals
await window.electronAPI.invoke('proposals:updateConfig', {
  config: {
    maxProposals: 5
  }
})

// Increase cache TTL (requires code change)
const proposalCache = new ProposalCache(50, 120000) // 2 minutes
```

## Future Enhancements

### Planned Features

1. **Message Snippets** (`includeMessages: true`)
   - Show sample messages from past subject
   - Preview context before sharing

2. **Persistent Dismissals**
   - Store dismissed proposals in ONE.core
   - Persist across sessions

3. **Advanced Algorithms**
   - TF-IDF weighting for keyword importance
   - Embedding-based similarity (vector search)
   - Collaborative filtering (user behavior patterns)

4. **UI Improvements**
   - Settings panel for config editing
   - Proposal preview modal
   - Batch share (multiple proposals)

5. **Analytics**
   - Proposal acceptance rate
   - Average relevance scores
   - Cache hit rate dashboard

### Research Areas

- **Optimal Thresholds**: A/B testing for `minJaccard` and weights
- **Temporal Patterns**: Time-of-day or day-of-week boosting
- **User Feedback**: Explicit relevance ratings to tune algorithm
- **Cross-User Matching**: Suggest conversations from other users (with privacy controls)

## References

### Specifications
- `/specs/019-above-the-chat/spec.md` - Feature specification
- `/specs/019-above-the-chat/plan.md` - Implementation plan
- `/specs/019-above-the-chat/data-model.md` - Data model design
- `/specs/019-above-the-chat/research.md` - Algorithm research

### Contracts
- `/specs/019-above-the-chat/contracts/ipc-proposals.json` - IPC contract definitions

### Quickstart
- `/specs/019-above-the-chat/quickstart.md` - Developer quickstart guide

### Related Features
- **Feature 018**: Structured LLM Communication (topic analysis foundation)
- **Keyword Detail Panel**: Keyword exploration UI
- **Topic Analysis**: Subject and keyword extraction

### External Resources
- [Jaccard Similarity](https://en.wikipedia.org/wiki/Jaccard_index) - Similarity measure
- [LRU Cache](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU)) - Caching strategy
- [react-swipeable](https://github.com/FormidableLabs/react-swipeable) - Swipe gesture library
