# IPC Contract: getAllKeywords

**Handler**: `keyword-detail.js` → `getAllKeywords()`

**Channel**: `keywordDetail:getAllKeywords`

**Purpose**: Retrieve all keywords across all topics for display in settings page. Includes aggregated statistics and access control information.

---

## Request Schema

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeArchived` | `boolean` | No | Include archived keywords (default: false) |
| `sortBy` | `string` | No | Sort field: 'frequency', 'alphabetical', 'lastSeen' (default: 'frequency') |
| `limit` | `number` | No | Maximum keywords to return (default: 500) |
| `offset` | `number` | No | Pagination offset (default: 0) |

### Example Request

```typescript
// From Settings UI (via IPC)
const response = await window.electronAPI.invoke('keywordDetail:getAllKeywords', {
  sortBy: 'frequency',
  limit: 100,
  offset: 0
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
      frequency: number,              // Total across all topics
      score: number,                  // Average score
      extractedAt: string,            // First extraction timestamp
      lastSeen: string,               // Most recent occurrence
      subjects: SHA256Hash[],

      // Aggregated statistics
      topicCount: number,             // Number of distinct topics
      subjectCount: number,           // Total subjects across all topics
      topTopics: Array<{              // Top 3 topics by frequency
        topicId: string,
        topicName: string,
        frequency: number
      }>,

      // Access control summary
      accessControlCount: number,     // Number of access states set
      hasRestrictions: boolean        // True if any 'deny' states exist
    }>,
    totalCount: number,               // Total keywords (before limit)
    hasMore: boolean                  // True if more results exist
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
    totalCount: 0,
    hasMore: false
  }
}
```

---

## Error Conditions

| Condition | Error Message | HTTP Equivalent |
|-----------|---------------|-----------------|
| ONE.core not initialized | `ONE.core not initialized` | 503 Service Unavailable |
| TopicAnalysisModel not initialized | `TopicAnalysisModel not initialized` | 503 Service Unavailable |
| Invalid sortBy value | `Invalid sortBy: must be 'frequency', 'alphabetical', or 'lastSeen'` | 400 Bad Request |
| Invalid limit | `Invalid limit: must be positive number` | 400 Bad Request |
| Invalid offset | `Invalid offset: must be non-negative number` | 400 Bad Request |

---

## Behavior Specification

### Keyword Aggregation

Keywords with the same `term` from different topics are **aggregated**:

- `frequency`: Sum of frequencies across all topics
- `score`: Weighted average by frequency
- `extractedAt`: Earliest extraction timestamp
- `lastSeen`: Most recent occurrence timestamp
- `topicCount`: Count of distinct topics containing keyword
- `subjectCount`: Total subjects across all topics

### Sorting Options

| Sort By | Order | Secondary Sort |
|---------|-------|----------------|
| `frequency` | Descending | `score` (desc) |
| `alphabetical` | Ascending | `frequency` (desc) |
| `lastSeen` | Descending | `frequency` (desc) |

### Pagination

- Results are paginated using `limit` and `offset`
- `hasMore` is `true` if `(offset + limit) < totalCount`
- Default page size: 100 keywords
- Max page size: 500 keywords

### Access Control Summary

For each keyword, compute:

```typescript
const accessStates = await loadAccessStates(keyword.term);

keyword.accessControlCount = accessStates.length;
keyword.hasRestrictions = accessStates.some(s => s.state === 'deny');
```

### Top Topics Calculation

For each keyword, identify the 3 topics with highest frequency:

```typescript
const topTopics = subjects
  .filter(s => s.keywords.includes(keywordHash))
  .reduce((acc, subject) => {
    const existing = acc.find(t => t.topicId === subject.topicId);
    if (existing) {
      existing.frequency += subject.messageCount;
    } else {
      acc.push({
        topicId: subject.topicId,
        topicName: await getTopicName(subject.topicId),
        frequency: subject.messageCount
      });
    }
    return acc;
  }, [])
  .sort((a, b) => b.frequency - a.frequency)
  .slice(0, 3);
```

---

## Example Response

### Request

```typescript
{
  sortBy: 'frequency',
  limit: 10,
  offset: 0
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
        frequency: 45,                          // Sum across all topics
        score: 0.82,                            // Weighted average
        extractedAt: '2025-09-15T10:00:00.000Z',
        lastSeen: '2025-10-01T09:30:00.000Z',
        subjects: ['sha256:abc...', 'sha256:def...'],
        topicCount: 3,                          // Appears in 3 topics
        subjectCount: 5,                        // 5 subjects total
        topTopics: [
          {
            topicId: 'crypto-discussion',
            topicName: 'Crypto Discussion',
            frequency: 23
          },
          {
            topicId: 'tech-trends',
            topicName: 'Tech Trends 2025',
            frequency: 15
          },
          {
            topicId: 'innovation-ideas',
            topicName: 'Innovation Ideas',
            frequency: 7
          }
        ],
        accessControlCount: 5,                  // 5 access states set
        hasRestrictions: true                   // At least one 'deny'
      },
      {
        $type$: 'Keyword',
        term: 'ai',
        category: null,
        frequency: 38,
        score: 0.75,
        extractedAt: '2025-09-20T11:00:00.000Z',
        lastSeen: '2025-10-01T10:15:00.000Z',
        subjects: ['sha256:ghi...', 'sha256:jkl...'],
        topicCount: 2,
        subjectCount: 3,
        topTopics: [
          {
            topicId: 'ai-research',
            topicName: 'AI Research',
            frequency: 25
          },
          {
            topicId: 'product-roadmap',
            topicName: 'Product Roadmap',
            frequency: 13
          }
        ],
        accessControlCount: 0,
        hasRestrictions: false
      }
    ],
    totalCount: 156,
    hasMore: true
  }
}
```

---

## Implementation Notes

### Handler Implementation Pattern

```typescript
export async function getAllKeywords(event, {
  includeArchived = false,
  sortBy = 'frequency',
  limit = 500,
  offset = 0
}) {
  console.log('[KeywordDetail] Getting all keywords:', { sortBy, limit, offset });

  try {
    // Validate inputs
    if (!['frequency', 'alphabetical', 'lastSeen'].includes(sortBy)) {
      throw new Error(`Invalid sortBy: ${sortBy}`);
    }

    if (limit < 1 || limit > 500) {
      throw new Error('Invalid limit: must be between 1 and 500');
    }

    if (offset < 0) {
      throw new Error('Invalid offset: must be non-negative');
    }

    // Get model
    const model = await getTopicAnalysisModel();

    // Load all subjects
    const allSubjects = includeArchived
      ? await model.getAllSubjects()
      : (await model.getAllSubjects()).filter(s => !s.archived);

    // Load all keywords
    const allKeywords = await model.getAllKeywords();

    // Load all access states
    const allAccessStates = await loadVersionedObjects('KeywordAccessState');

    // Aggregate keywords
    const keywordMap = new Map();

    for (const keyword of allKeywords) {
      if (!keywordMap.has(keyword.term)) {
        keywordMap.set(keyword.term, {
          ...keyword,
          topicCount: 0,
          subjectCount: 0,
          topTopics: [],
          accessControlCount: 0,
          hasRestrictions: false
        });
      }
    }

    // Aggregate statistics
    for (const subject of allSubjects) {
      for (const keywordHash of subject.keywords) {
        const keyword = allKeywords.find(k => k.id === keywordHash);
        if (keyword && keywordMap.has(keyword.term)) {
          const agg = keywordMap.get(keyword.term);
          agg.subjectCount++;

          // Track topics
          if (!agg.topTopics.find(t => t.topicId === subject.topicId)) {
            agg.topicCount++;
            agg.topTopics.push({
              topicId: subject.topicId,
              topicName: await getTopicName(subject.topicId),
              frequency: 0
            });
          }

          // Update topic frequency
          const topTopic = agg.topTopics.find(t => t.topicId === subject.topicId);
          topTopic.frequency += subject.messageCount;
        }
      }
    }

    // Finalize top topics (sort and limit to 3)
    for (const [term, agg] of keywordMap.entries()) {
      agg.topTopics = agg.topTopics
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 3);

      // Add access control summary
      const accessStates = allAccessStates.filter(s => s.keywordTerm === term);
      agg.accessControlCount = accessStates.length;
      agg.hasRestrictions = accessStates.some(s => s.state === 'deny');
    }

    // Convert to array and sort
    let keywords = Array.from(keywordMap.values());

    switch (sortBy) {
      case 'frequency':
        keywords.sort((a, b) => b.frequency - a.frequency || b.score - a.score);
        break;
      case 'alphabetical':
        keywords.sort((a, b) => a.term.localeCompare(b.term) || b.frequency - a.frequency);
        break;
      case 'lastSeen':
        keywords.sort((a, b) =>
          new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime() ||
          b.frequency - a.frequency
        );
        break;
    }

    // Paginate
    const totalCount = keywords.length;
    keywords = keywords.slice(offset, offset + limit);

    return {
      success: true,
      data: {
        keywords,
        totalCount,
        hasMore: (offset + limit) < totalCount
      }
    };

  } catch (error) {
    console.error('[KeywordDetail] Error getting all keywords:', error);
    return {
      success: false,
      error: error.message,
      data: {
        keywords: [],
        totalCount: 0,
        hasMore: false
      }
    };
  }
}
```

---

## UI Usage Example

```typescript
// KeywordSettingsPage.tsx
const [keywords, setKeywords] = useState([]);
const [page, setPage] = useState(0);
const [hasMore, setHasMore] = useState(false);

async function loadKeywords() {
  const response = await window.electronAPI.invoke(
    'keywordDetail:getAllKeywords',
    {
      sortBy: sortOption,
      limit: 50,
      offset: page * 50
    }
  );

  if (response.success) {
    const { keywords, hasMore: more } = response.data;
    setKeywords(keywords);
    setHasMore(more);
  }
}
```

---

## Performance Notes

- **Typical latency**: <200ms for 200 total keywords
- **Max latency**: <500ms for 1000 keywords
- **Memory usage**: ~2MB for 500 keywords with full metadata
- **Optimization**: Results NOT cached due to pagination and sorting variance

---

## Related Contracts

- `getKeywordDetails.md` - Detailed view for single keyword
- `getKeywordsByTopic.md` - Keywords for specific topic
- `getKeywordAccessStates.md` - Access states for keyword

---

## References

- Data Model: `/specs/015-keyword-detail-preview/data-model.md`
- Feature Spec: `/specs/015-keyword-detail-preview/spec.md`
- Settings Page: `/electron-ui/src/components/Settings/KeywordSettingsPage.tsx` (to be created)
