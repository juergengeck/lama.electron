# Recommender System FAQ

## General Questions

### What is the recommender system?

The recommender system (also called the "proposal engine") is a context-aware feature that suggests relevant past conversations while you're chatting. It analyzes the topics and keywords in your current conversation and finds similar discussions from your history.

When you're chatting about "making pizza at home," for example, it might suggest a past conversation about "bread baking" because they share keywords like "dough," "yeast," and "oven."

### Where do I see recommendations?

Recommendations appear as a blue card **above the message input field** at the bottom of the chat window. If multiple recommendations are available, you can swipe left/right (or use navigation buttons) to browse through them.

### How does it work?

1. **AI extracts topics** - As you chat, the AI identifies subjects (themes) and keywords from your messages
2. **System finds matches** - The recommender compares your current keywords with past conversations
3. **Proposals are ranked** - Matches are scored based on keyword overlap and recency
4. **Best matches appear** - Up to 10 proposals are shown, ranked by relevance

### What can I do with a recommendation?

- **Share**: Click the "Share" button to insert context into your current chat
  - Example: "Related context from 'pizza-making': pizza, dough, yeast"
- **Dismiss**: Click the X to hide the recommendation
- **Navigate**: Swipe or use arrows to see other recommendations
- **Ignore**: Just keep chatting - recommendations don't interrupt your flow

## How Recommendations Work

### How are conversations matched?

The system uses **Jaccard similarity** to measure keyword overlap:

```
Similarity = (Shared Keywords) / (Total Unique Keywords)
```

**Example**:
- Current conversation: [pizza, dough, yeast]
- Past conversation: [pizza, recipe, dough]
- Shared: [pizza, dough] = 2 keywords
- Total: [pizza, dough, yeast, recipe] = 4 keywords
- **Similarity: 2/4 = 50%**

### What is the relevance score?

The relevance score combines two factors:

1. **Keyword Match (70%)** - How many keywords are shared
2. **Recency (30%)** - How recent the past conversation is

**Formula**:
```
Relevance = (Keyword Match × 0.7) + (Recency Boost × 0.3)
```

**Example**:
- 60% keyword match, 50% recency boost
- Relevance = (0.6 × 0.7) + (0.5 × 0.3) = 0.42 + 0.15 = **57%**

### How does recency work?

Recency gives a boost to recent conversations within a 30-day window:

- **0 days old**: 100% boost
- **15 days old**: 50% boost
- **30+ days old**: 0% boost (no penalty, just no boost)

This ensures you see relevant recent conversations first, but old conversations can still match if keywords overlap strongly.

### Why don't I see any recommendations?

**Possible reasons**:

1. **Not enough messages yet** - The AI needs at least 5 messages to extract subjects
2. **No matching conversations** - Your current topic is unique or very different from past chats
3. **Similarity too low** - Matches must have at least 20% keyword overlap (configurable)
4. **You dismissed them all** - Dismissed recommendations are hidden until you restart the app

**How to check**:
- Keep chatting until you have 5+ messages
- Look for the hashtag/keyword bar in the chat header (indicates subjects were extracted)
- Try restarting the app to clear dismissals

### Can I see recommendations from other users?

Not yet. Currently, recommendations only come from your own conversation history. Cross-user recommendations are planned for a future release with privacy controls.

## Using Recommendations

### What happens when I click "Share"?

1. The system retrieves the past subject's details (name and keywords)
2. A context message is inserted into your current chat:
   ```
   Related context from "pizza-making": pizza, dough, yeast
   ```
3. The recommendation is automatically dismissed
4. You can continue chatting normally

**Note**: The AI sees this context message and can use it to provide more relevant responses.

### What happens when I dismiss a recommendation?

1. The recommendation disappears immediately
2. It won't reappear for the rest of your session
3. When you restart the app, it may reappear if still relevant

**Note**: Dismissals are session-only (not saved to disk). This prevents accidentally hiding useful recommendations forever.

### Can I get dismissed recommendations back?

Yes, just **restart the app**. Dismissals are cleared when the app restarts, so you'll see fresh recommendations based on current relevance.

### How many recommendations will I see?

Up to **10 recommendations** by default, ranked by relevance. You can customize this limit (see "Configuration" section).

### Do recommendations update as I chat?

Yes! The system monitors your conversation and refreshes recommendations when:
- New subjects are identified (every ~5 messages)
- You switch to a different conversation
- You manually refresh (future feature)

Recommendations are cached for 60 seconds to avoid unnecessary recomputation.

## Configuration

### Can I customize how recommendations work?

Yes, but currently only via the developer console (UI coming soon). You can adjust:

**Match Weight** (default: 70%)
- How much keyword overlap matters
- Higher = prioritize keyword match
- Lower = prioritize recency

**Recency Weight** (default: 30%)
- How much recency matters
- Higher = prioritize recent conversations
- Lower = prioritize keyword match

**Recency Window** (default: 30 days)
- Time window for recency boost
- Longer = boost older conversations
- Shorter = only boost very recent ones

**Minimum Similarity** (default: 20%)
- Minimum keyword overlap to show recommendation
- Higher = fewer, more relevant recommendations
- Lower = more recommendations, less relevant

**Max Recommendations** (default: 10)
- Maximum number of recommendations to show
- Range: 1-50

### How do I change configuration? (Developer)

```javascript
await window.electronAPI.invoke('proposals:updateConfig', {
  config: {
    matchWeight: 0.8,      // 80% weight on keywords
    recencyWeight: 0.2,    // 20% weight on recency
    minJaccard: 0.3,       // 30% minimum similarity
    maxProposals: 5        // Show max 5 recommendations
  }
})
```

**Effects**:
- Clears the cache (recommendations regenerate with new settings)
- Saves configuration (persists across sessions)

### What configuration should I use?

**Depends on your use case**:

**For deep research** (prioritize relevance over recency):
```javascript
{
  matchWeight: 0.9,
  recencyWeight: 0.1,
  minJaccard: 0.3,
  maxProposals: 5
}
```

**For daily conversations** (prioritize recent topics):
```javascript
{
  matchWeight: 0.5,
  recencyWeight: 0.5,
  recencyWindow: 7 * 24 * 60 * 60 * 1000,  // 7 days
  minJaccard: 0.2,
  maxProposals: 10
}
```

**For discovery** (see more recommendations):
```javascript
{
  matchWeight: 0.7,
  recencyWeight: 0.3,
  minJaccard: 0.1,   // Lower threshold
  maxProposals: 20   // More recommendations
}
```

## Performance

### How fast are recommendations?

**Target performance**:
- **Generation**: <100ms (from request to display)
- **Cache lookup**: <1ms
- **Swipe navigation**: <50ms

**Typical performance**:
- First request: 50-80ms (needs to fetch all subjects)
- Cached requests: <5ms
- Cache expires after 60 seconds

### Do recommendations slow down the app?

No. The recommender system is designed to be lightweight:

1. **Lazy initialization** - Only starts when first needed
2. **Caching** - Results are cached for 60 seconds
3. **Non-blocking** - Runs in background, doesn't block UI
4. **Efficient algorithms** - Jaccard similarity is O(n) where n = keyword count

### What if I have thousands of conversations?

The system handles large conversation histories efficiently:

1. **Parallel fetching** - Subjects are queried concurrently across topics
2. **Early filtering** - Non-matching subjects are skipped quickly
3. **Limit results** - Only top N (default: 10) are returned
4. **Cache persistence** - Popular queries are cached

**Performance scales linearly** with conversation count, not exponentially.

## Troubleshooting

### Why don't recommendations update when I chat?

**Check**:
1. Are new keywords appearing in the chat header?
   - If no: AI hasn't identified new subjects yet (wait for 5+ messages)
   - If yes: Recommendations should update within 60 seconds

2. Is the topic very similar to your current conversation?
   - Recommendations from the **same topic** are filtered out
   - Only different conversations are suggested

3. Is the cache stale?
   - Cache expires after 60 seconds
   - Try switching topics and switching back to force refresh

### Why do I see the same recommendations repeatedly?

**Possible reasons**:
1. **Limited conversation history** - Not many matching conversations exist
2. **Distinctive keywords** - Your current topic only matches a few past conversations
3. **High similarity threshold** - Lower `minJaccard` to see more recommendations
4. **Cache not expiring** - Wait 60 seconds or restart app

### Why are recommendations not relevant?

**Possible causes**:
1. **Low keyword overlap** - Similarity score is low (check the percentage)
2. **Generic keywords** - Matches are based on common words (e.g., "the", "and")
   - **Note**: The AI filters stop words, but some generic terms may slip through
3. **Config mismatch** - Adjust `matchWeight` to prioritize keyword overlap

**How to improve**:
```javascript
// Prioritize keyword match, increase threshold
await window.electronAPI.invoke('proposals:updateConfig', {
  config: {
    matchWeight: 0.9,
    minJaccard: 0.4  // Only show 40%+ matches
  }
})
```

### Recommendations disappeared suddenly

**Likely causes**:
1. **You dismissed them** - They'll return on app restart
2. **Topic changed** - Recommendations are context-specific
3. **Cache expired** - New recommendations generated with different results
4. **No matching subjects** - Current conversation diverged from past topics

**How to recover**:
- Restart app to clear dismissals
- Switch back to original topic
- Wait for cache to refresh (60 seconds)

### Can I force refresh recommendations?

Not in the UI yet, but developers can:

```javascript
// Force refresh (skip cache)
const response = await window.electronAPI.invoke('proposals:getForTopic', {
  topicId: 'topic-123',
  forceRefresh: true
})
```

Or in React:
```typescript
const { refresh } = useProposals({ topicId: 'topic-123' })
await refresh()  // Forces fresh computation
```

## Technical Details

### Where is recommendation data stored?

**Subjects and Keywords**: Stored in ONE.core as versioned objects
- Persists across sessions
- Synced across devices (if connected)
- Content-addressed by SHA-256 hash

**Proposals**: **Not stored** - computed on demand
- Generated fresh each time
- Cached for 60 seconds in memory
- Cleared on app restart

**Dismissals**: Stored in memory only
- Session-scoped (cleared on restart)
- Not synced across devices

**Configuration**: Stored in ONE.core as versioned object
- Persists across sessions
- Versioned by user email
- Can be synced across devices

### How does caching work?

**LRU Cache with TTL**:
- **Max size**: 50 entries
- **TTL**: 60 seconds
- **Eviction**: Oldest entry removed when full
- **Key format**: `${topicId}:${sortedSubjectIds}`

**Cache invalidation**:
- Automatically expires after 60 seconds
- Cleared when configuration updates
- Can be manually cleared (developer only)

**Hit rate**: Typically 80%+ for active conversations

### What is the data flow?

```
User Opens Chat
    ↓
React Component (useProposals)
    ↓ IPC
Main Process (proposals:getForTopic handler)
    ↓
Check Cache → Cache Hit? → Return Cached Proposals
    ↓ No
TopicAnalysisModel.getSubjects(topicId)
    ↓
ProposalEngine.getProposalsForTopic()
    ↓
Fetch All Subjects from All Topics
    ↓
Calculate Jaccard Similarity (for each pair)
    ↓
Calculate Recency Boost
    ↓
Compute Relevance Score
    ↓
Filter by minJaccard Threshold
    ↓
ProposalRanker.rankProposals()
    ↓
Sort by Relevance (descending)
    ↓
Limit to maxProposals
    ↓
Filter Dismissed Proposals
    ↓
Cache Results
    ↓
Return to UI
```

### What algorithms are used?

**Jaccard Similarity**:
- Measures set overlap
- Formula: `|intersection| / |union|`
- Time complexity: O(n) where n = number of keywords
- Used by: Netflix, Amazon, recommendation systems

**Linear Recency Decay**:
- Simple linear decay over time window
- Formula: `max(0, 1 - age / window)`
- Alternative: Exponential decay (future enhancement)

**Weighted Scoring**:
- Combines multiple signals (keyword match + recency)
- Formula: `score = w1×signal1 + w2×signal2`
- Weights sum to 1.0 for normalized scores

## Privacy & Security

### What data is shared?

**Local only**:
- Subjects, keywords, proposals (ONE.core storage)
- Configuration (ONE.core storage)
- Dismissals (in-memory only)

**Synced (if connected to peers)**:
- Subjects and keywords from analyzed conversations
- Your configuration (stored as ONE.core object)

**Never shared**:
- Dismissed proposals (session-only)
- Proposal cache (in-memory only)
- Which recommendations you clicked

### Can other users see my recommendations?

**No**. Recommendations are computed locally on your device based on **your** conversation history. Other users cannot see:
- Which recommendations you received
- Which recommendations you dismissed
- Which recommendations you shared

### Are my conversations analyzed on a server?

**No**. All AI analysis happens locally using your configured LLM (e.g., Ollama). Conversation content never leaves your device unless you explicitly share it with conversation participants.

### Can I disable the recommender?

Not yet (UI option coming). Developers can comment out the ProposalCarousel component in `MessageView.tsx`:

```typescript
// {/* Proposal Carousel - Absolutely positioned above message input */}
// {proposals.length > 0 && (
//   <div className="absolute bottom-16 left-0 right-0 px-4 pointer-events-none">
//     ...
//   </div>
// )}
```

Or set `maxProposals: 0` in config (will prevent display).

## Future Features

### What's planned for the recommender?

**Near-term**:
- UI for configuration settings
- Manual refresh button
- Persistent dismissals (save to ONE.core)
- Message snippets (preview past conversation)

**Medium-term**:
- Advanced algorithms (TF-IDF, embeddings)
- Cross-user recommendations (with privacy controls)
- Batch sharing (share multiple proposals at once)
- Proposal preview modal (see messages before sharing)

**Long-term**:
- Collaborative filtering (learn from usage patterns)
- Temporal patterns (time-of-day, day-of-week boosting)
- Explicit feedback (thumbs up/down to tune algorithm)
- Analytics dashboard (acceptance rate, cache hit rate, etc.)

### Can I suggest features?

Yes! File an issue on GitHub or discuss in the community channels. The recommender system is actively developed and we welcome feedback.

### How can I contribute?

**As a user**:
- Report bugs and unexpected behavior
- Share feedback on recommendation relevance
- Suggest configuration improvements

**As a developer**:
- Read `/docs/recommender-system.md` for technical details
- Check `/specs/019-above-the-chat/` for specification
- Run integration tests in `/tests/integration/proposals/`
- Submit PRs for enhancements or bug fixes

## Additional Resources

### Documentation
- **Comprehensive Guide**: `/docs/recommender-system.md`
- **Feature Specification**: `/specs/019-above-the-chat/spec.md`
- **Implementation Plan**: `/specs/019-above-the-chat/plan.md`
- **Data Model**: `/specs/019-above-the-chat/data-model.md`

### Code Locations
- **UI Components**: `/electron-ui/src/components/Proposal*.tsx`
- **React Hook**: `/electron-ui/src/hooks/useProposals.ts`
- **Backend Services**: `/main/services/proposal-*.ts`
- **IPC Handlers**: `/main/ipc/handlers/proposals.ts`

### Related Features
- **Topic Analysis** (Feature 018): Extracts subjects and keywords
- **Keyword Detail Panel**: Explore keywords in depth
- **Chat Header**: Shows current subjects/keywords

### External References
- [Jaccard Similarity](https://en.wikipedia.org/wiki/Jaccard_index)
- [Recommender Systems](https://en.wikipedia.org/wiki/Recommender_system)
- [LRU Cache](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU))
- [Content-Based Filtering](https://en.wikipedia.org/wiki/Recommender_system#Content-based_filtering)
