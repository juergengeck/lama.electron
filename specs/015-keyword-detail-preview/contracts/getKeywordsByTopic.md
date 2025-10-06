# IPC Contract: getKeywordsByTopic

**Handler**: `keyword-detail.js` → `getKeywordsByTopic()`

**Channel**: `keywordDetail:getKeywordsByTopic`

**Purpose**: Retrieve all keywords for a specific topic, with basic frequency and score information. Used for displaying keyword lists in chat interface.

---

## Request Schema

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `topicId` | `string` | Yes | Topic identifier |
| `limit` | `number` | No | Maximum keywords to return (default: 100) |
| `includeArchived` | `boolean` | No | Include archived keywords (default: false) |

### Example Request

```typescript
// From UI (via IPC)
const response = await window.electronAPI.invoke('keywordDetail:getKeywordsByTopic', {
  topicId: 'crypto-discussion',
  limit: 50
});
```

---

## Response Schema

### Success Response

```typescript
{
  success: true,
  data: {
    keywords: Array<{
      $type$: 'Keyword',
      term: string,
      category: string | null,
      frequency: number,
      score: number,
      extractedAt: string,
      lastSeen: string,
      subjects: SHA256Hash[],
      subjectCount: number          // Number of subjects containing this keyword
    }>,
    topicId: string,                // Echo of request topicId
    totalCount: number              // Total before limit applied
  }
}
```

### Error Response

```typescript
{
  success: false,
  error: string,
  data: {
    keywords: [],
    topicId: string,
    totalCount: 0
  }
}
```

---

## Error Conditions

| Condition | Error Message | HTTP Equivalent |
|-----------|---------------|-----------------|
| Topic not found | `Topic not found: {topicId}` | 404 Not Found |
| ONE.core not initialized | `ONE.core not initialized` | 503 Service Unavailable |
| TopicAnalysisModel not initialized | `TopicAnalysisModel not initialized` | 503 Service Unavailable |
| Invalid topicId | `Invalid topicId: must be non-empty string` | 400 Bad Request |
| Invalid limit | `Invalid limit: must be positive number` | 400 Bad Request |

---

## Behavior Specification

### Keyword Filtering

1. Load all keywords from TopicAnalysisModel
2. Filter keywords that appear in subjects belonging to `topicId`
3. If `includeArchived` is false, exclude keywords from archived subjects only
4. Sort by frequency (descending), then by score (descending)
5. Apply `limit` to top results

### Subject Count Enrichment

For each keyword, count the number of subjects it appears in:

```typescript
keyword.subjectCount = subjects.filter(s =>
  s.topicId === topicId &&
  s.keywords.includes(keywordHash)
).length;
```

### Sorting Order

1. Primary: `frequency` (descending)
2. Secondary: `score` (descending)
3. Tertiary: `term` (alphabetical)

### Caching

- Results cached with key: `keywords:${topicId}:${limit}`
- TTL: 5 seconds
- Cache invalidated when new keywords extracted

---

## Example Response

### Request

```typescript
{
  topicId: 'crypto-discussion',
  limit: 10,
  includeArchived: false
}
```

### Response

```typescript
{
  success: true,
  data: {
    keywords: [
      {
        $type$: 'Keyword',
        term: 'blockchain',
        category: null,
        frequency: 23,
        score: 0.85,
        extractedAt: '2025-09-15T10:00:00.000Z',
        lastSeen: '2025-10-01T09:30:00.000Z',
        subjects: ['sha256:abc...', 'sha256:def...'],
        subjectCount: 2
      },
      {
        $type$: 'Keyword',
        term: 'ethereum',
        category: null,
        frequency: 18,
        score: 0.78,
        extractedAt: '2025-09-15T10:05:00.000Z',
        lastSeen: '2025-10-01T09:25:00.000Z',
        subjects: ['sha256:abc...'],
        subjectCount: 1
      },
      {
        $type$: 'Keyword',
        term: 'smartcontract',
        category: null,
        frequency: 15,
        score: 0.72,
        extractedAt: '2025-09-15T11:00:00.000Z',
        lastSeen: '2025-10-01T08:45:00.000Z',
        subjects: ['sha256:def...'],
        subjectCount: 1
      }
    ],
    topicId: 'crypto-discussion',
    totalCount: 47
  }
}
```

---

## Implementation Notes

### Handler Implementation Pattern

```typescript
export async function getKeywordsByTopic(event, { topicId, limit = 100, includeArchived = false }) {
  console.log('[KeywordDetail] Getting keywords for topic:', { topicId, limit });

  try {
    // Validate inputs
    if (!topicId || typeof topicId !== 'string') {
      throw new Error('Invalid topicId: must be non-empty string');
    }

    if (limit < 1) {
      throw new Error('Invalid limit: must be positive number');
    }

    // Check cache
    const cacheKey = `keywords:${topicId}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5000) {
      return { success: true, data: cached.data };
    }

    // Get model
    const model = await getTopicAnalysisModel();

    // Get all subjects for topic
    const subjects = await model.getSubjects(topicId);
    const activeSubjects = includeArchived
      ? subjects
      : subjects.filter(s => !s.archived);

    // Get all keywords
    const allKeywords = await model.getKeywords(topicId);

    // Filter to keywords in active subjects
    const keywordMap = new Map();

    for (const subject of activeSubjects) {
      for (const keywordHash of subject.keywords) {
        const keyword = allKeywords.find(k => k.id === keywordHash);
        if (keyword) {
          if (!keywordMap.has(keyword.term)) {
            keywordMap.set(keyword.term, {
              ...keyword,
              subjectCount: 0
            });
          }
          keywordMap.get(keyword.term).subjectCount++;
        }
      }
    }

    // Sort and limit
    const keywords = Array.from(keywordMap.values())
      .sort((a, b) => {
        if (b.frequency !== a.frequency) return b.frequency - a.frequency;
        if (b.score !== a.score) return b.score - a.score;
        return a.term.localeCompare(b.term);
      })
      .slice(0, limit);

    const result = {
      keywords,
      topicId,
      totalCount: keywordMap.size
    };

    // Cache result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return { success: true, data: result };

  } catch (error) {
    console.error('[KeywordDetail] Error getting keywords:', error);
    return {
      success: false,
      error: error.message,
      data: {
        keywords: [],
        topicId,
        totalCount: 0
      }
    };
  }
}
```

---

## UI Usage Example

```typescript
// KeywordCloud.tsx
async function loadKeywords() {
  const response = await window.electronAPI.invoke(
    'keywordDetail:getKeywordsByTopic',
    {
      topicId: currentTopicId,
      limit: 30
    }
  );

  if (response.success) {
    const { keywords } = response.data;
    setKeywords(keywords);
  }
}
```

---

## Performance Notes

- **Typical latency**: <50ms for topics with <100 keywords
- **Max keywords**: Limited to 100 by default to prevent UI lag
- **Memory usage**: ~50KB for 100 keywords with metadata
- **Cache benefits**: 5s TTL reduces redundant queries when switching views

---

## Related Contracts

- `getKeywordDetails.md` - Full keyword details with subjects
- `getAllKeywords.md` - All keywords across all topics
- `extractConversationKeywords` (existing) - Real-time keyword extraction

---

## References

- Data Model: `/specs/015-keyword-detail-preview/data-model.md`
- Existing Handler: `/main/ipc/handlers/topic-analysis.js` → `getKeywords()`
- Feature Spec: `/specs/015-keyword-detail-preview/spec.md`
