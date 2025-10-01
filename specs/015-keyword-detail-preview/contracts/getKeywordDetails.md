# IPC Contract: getKeywordDetails

**Handler**: `keyword-detail.js` → `getKeywordDetails()`

**Channel**: `keywordDetail:getKeywordDetails`

**Purpose**: Fetch complete keyword details including subjects, access states, and topic references for display in the keyword detail panel.

---

## Request Schema

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `keyword` | `string` | Yes | The keyword term (will be normalized) |
| `topicId` | `string` | No | Optional topic ID to filter subjects (defaults to all topics) |

### Example Request

```typescript
// From UI (via IPC)
const response = await window.electronAPI.invoke('keywordDetail:getKeywordDetails', {
  keyword: 'blockchain',
  topicId: 'crypto-discussion' // optional
});
```

---

## Response Schema

### Success Response

```typescript
{
  success: true,
  data: {
    keyword: {
      $type$: 'Keyword',
      term: string,                    // Normalized keyword
      category: string | null,
      frequency: number,               // Total occurrence count
      score: number,                   // Relevance score (0-1)
      extractedAt: string,             // ISO timestamp
      lastSeen: string,                // ISO timestamp
      subjects: SHA256Hash[],          // Subject references
      topicReferences: TopicReference[] // See below
    },
    subjects: EnrichedSubject[],       // Array of subjects (see below)
    accessStates: KeywordAccessState[] // Array of access states (see below)
  }
}
```

### TopicReference Structure

```typescript
{
  topicId: string,
  topicName: string,
  messageCount: number,
  lastMessageDate: string,            // ISO timestamp
  authors: SHA256Hash[]                // User IDs who mentioned keyword
}
```

### EnrichedSubject Structure

```typescript
{
  $type$: 'Subject',
  topicId: string,
  keywordCombination: string,         // e.g., 'blockchain+ethereum+smart'
  description: string,                // Subject description
  confidence: number,                 // AI confidence (0-1)
  keywords: SHA256Hash[],             // Keyword references
  extractedAt: number,
  firstSeen: string,
  lastSeen: string,
  messageCount: number,
  archived: boolean,

  // Runtime enrichment
  relevanceScore: number,             // Calculated relevance
  placesMentioned: number,            // Number of topics
  authors: SHA256Hash[],              // Users who discussed this
  sortTimestamp: string               // For time-based sorting
}
```

### KeywordAccessState Structure

```typescript
{
  $type$: 'KeywordAccessState',
  keywordTerm: string,
  principalId: SHA256Hash,
  principalType: 'user' | 'group',
  state: 'allow' | 'deny' | 'none',
  updatedAt: string,
  updatedBy: SHA256Hash
}
```

### Error Response

```typescript
{
  success: false,
  error: string,                      // Error message
  data: {
    keyword: null,
    subjects: [],
    accessStates: []
  }
}
```

---

## Error Conditions

| Condition | Error Message | HTTP Equivalent |
|-----------|---------------|-----------------|
| Keyword not found | `Keyword not found: {keyword}` | 404 Not Found |
| Topic not found | `Topic not found: {topicId}` | 404 Not Found |
| ONE.core not initialized | `ONE.core not initialized` | 503 Service Unavailable |
| TopicAnalysisModel not initialized | `TopicAnalysisModel not initialized` | 503 Service Unavailable |
| Invalid keyword format | `Invalid keyword: must be non-empty string` | 400 Bad Request |

---

## Behavior Specification

### Normalization

- **Keyword term** is normalized to lowercase and trimmed before lookup
- If `topicId` is provided, subjects are filtered to that topic only
- If `topicId` is omitted, subjects from ALL topics containing the keyword are returned

### Enrichment

The handler enriches the basic Keyword object with:

1. **Topic References**: Derived from subjects containing the keyword
   - Groups subjects by `topicId`
   - Aggregates `messageCount` and `authors`
   - Fetches topic name from ChannelManager

2. **Subject Enrichment**: Each subject is enriched with:
   - `relevanceScore`: Calculated from places, recency, frequency
   - `placesMentioned`: Count of distinct topics (always 1 when filtered by topicId)
   - `authors`: Extracted from message metadata
   - `sortTimestamp`: Defaults to `lastSeen`

3. **Access States**: All access states for the keyword are loaded

### Sorting

Subjects are pre-sorted by `relevanceScore` (descending) before return. UI can re-sort as needed.

### Caching

- Results are cached for 5 seconds with key: `${keyword}:${topicId}`
- Cache is bypassed if keyword was modified recently (<5s)

---

## Example Response

### Request

```typescript
{
  keyword: 'blockchain',
  topicId: 'crypto-discussion'
}
```

### Response

```typescript
{
  success: true,
  data: {
    keyword: {
      $type$: 'Keyword',
      term: 'blockchain',
      category: null,
      frequency: 23,
      score: 0.85,
      extractedAt: '2025-09-15T10:00:00.000Z',
      lastSeen: '2025-10-01T09:30:00.000Z',
      subjects: ['sha256:abc...', 'sha256:def...'],
      topicReferences: [
        {
          topicId: 'crypto-discussion',
          topicName: 'Crypto Discussion',
          messageCount: 15,
          lastMessageDate: '2025-10-01T09:30:00.000Z',
          authors: ['sha256:user1...', 'sha256:user2...']
        },
        {
          topicId: 'tech-trends',
          topicName: 'Tech Trends 2025',
          messageCount: 8,
          lastMessageDate: '2025-09-28T14:20:00.000Z',
          authors: ['sha256:user3...']
        }
      ]
    },
    subjects: [
      {
        $type$: 'Subject',
        topicId: 'crypto-discussion',
        keywordCombination: 'blockchain+ethereum+smartcontract',
        description: 'Discussion about Ethereum smart contracts',
        confidence: 0.9,
        keywords: ['sha256:kw1...', 'sha256:kw2...'],
        extractedAt: 1696147200000,
        firstSeen: '2025-09-15T10:00:00.000Z',
        lastSeen: '2025-10-01T09:30:00.000Z',
        messageCount: 15,
        archived: false,
        relevanceScore: 47.5,
        placesMentioned: 1,
        authors: ['sha256:user1...', 'sha256:user2...'],
        sortTimestamp: '2025-10-01T09:30:00.000Z'
      }
    ],
    accessStates: [
      {
        $type$: 'KeywordAccessState',
        keywordTerm: 'blockchain',
        principalId: 'sha256:user1...',
        principalType: 'user',
        state: 'allow',
        updatedAt: '2025-09-20T12:00:00.000Z',
        updatedBy: 'sha256:admin...'
      },
      {
        $type$: 'KeywordAccessState',
        keywordTerm: 'blockchain',
        principalId: 'sha256:group1...',
        principalType: 'group',
        state: 'deny',
        updatedAt: '2025-09-22T15:30:00.000Z',
        updatedBy: 'sha256:admin...'
      }
    ]
  }
}
```

---

## Implementation Notes

### Handler Implementation Pattern

```typescript
export async function getKeywordDetails(event, { keyword, topicId }) {
  console.log('[KeywordDetail] Getting keyword details:', { keyword, topicId });

  try {
    // Normalize keyword
    const normalizedKeyword = keyword.toLowerCase().trim();

    // Check cache
    const cached = getCachedKeywordDetails(normalizedKeyword, topicId);
    if (cached) {
      return { success: true, data: cached };
    }

    // Get base keyword data
    const model = await getTopicAnalysisModel();
    const keywords = await model.getKeywords(topicId);
    const keywordObj = keywords.find(k => k.term === normalizedKeyword);

    if (!keywordObj) {
      throw new Error(`Keyword not found: ${keyword}`);
    }

    // Get subjects containing keyword
    const allSubjects = await model.getSubjects(topicId);
    const subjects = allSubjects.filter(s =>
      s.keywords.some(k => k.term === normalizedKeyword)
    );

    // Enrich with topic references
    const enrichment = await import('../../services/keyword-enrichment.js');
    keywordObj.topicReferences = await enrichment.getTopicReferences(keywordObj);

    // Enrich subjects with metadata
    const enrichedSubjects = await enrichment.enrichSubjects(subjects);

    // Get access states
    const accessStates = await getKeywordAccessStates(normalizedKeyword);

    const result = {
      keyword: keywordObj,
      subjects: enrichedSubjects,
      accessStates
    };

    // Cache result
    setCachedKeywordDetails(normalizedKeyword, topicId, result);

    return { success: true, data: result };
  } catch (error) {
    console.error('[KeywordDetail] Error:', error);
    return {
      success: false,
      error: error.message,
      data: {
        keyword: null,
        subjects: [],
        accessStates: []
      }
    };
  }
}
```

---

## UI Usage Example

```typescript
// KeywordDetailPanel.tsx
const { data, error } = await window.electronAPI.invoke(
  'keywordDetail:getKeywordDetails',
  { keyword: selectedKeyword, topicId: currentTopicId }
);

if (data.success) {
  const { keyword, subjects, accessStates } = data.data;

  // Display keyword info
  setKeywordInfo(keyword);

  // Display subjects sorted by relevance
  setSubjects(subjects);

  // Display access controls
  setAccessStates(accessStates);
}
```

---

## References

- Data Model: `/specs/015-keyword-detail-preview/data-model.md`
- Related Handlers: `getKeywordsByTopic.md`, `getAllKeywords.md`
- IPC Pattern: `/main/ipc/handlers/topic-analysis.js`
