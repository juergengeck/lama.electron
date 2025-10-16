# Wikipedia Integration via MCP

**Status**: Planning
**Feature ID**: 020
**Dependencies**: Feature 018 (Structured LLM Communication), MCP Manager

## Overview

Integrate Wikipedia as a knowledge source for subject enrichment using the Model Context Protocol (MCP). This allows the LLM to access Wikipedia content during subject analysis, enriching subjects with verified knowledge, additional keywords, and related topics.

## Architecture

### MCP Server Design

**Wikipedia MCP Server** (external, standalone):
- **Name**: `wikipedia-mcp-server`
- **Type**: MCP server providing Wikipedia API access
- **Communication**: stdio-based MCP protocol
- **Location**: Separate npm package/repository

**Tools Provided**:

1. `search_wikipedia`
   - Input: `{ query: string, limit?: number }`
   - Output: `{ results: Array<{ title, snippet, url, pageid }> }`
   - Purpose: Search Wikipedia articles by query

2. `get_article_summary`
   - Input: `{ title: string }`
   - Output: `{ title, extract, url, categories: string[] }`
   - Purpose: Get article summary and metadata

3. `get_article_keywords`
   - Input: `{ title: string }`
   - Output: `{ keywords: string[], categories: string[], links: string[] }`
   - Purpose: Extract keywords from article structure

4. `find_related_articles`
   - Input: `{ title: string, limit?: number }`
   - Output: `{ related: Array<{ title, snippet }> }`
   - Purpose: Get related Wikipedia articles

### Integration with Subject Analysis

**Flow**:
```
User sends message
    ↓
LLM analyzes message (with Wikipedia tools available)
    ↓
LLM identifies subject (e.g., "quantum computing")
    ↓
LLM calls search_wikipedia("quantum computing")
    ↓
LLM calls get_article_keywords(top result)
    ↓
LLM merges Wikipedia keywords with conversation keywords
    ↓
Subject created with enriched keywords
```

## Data Model Changes

### Subject Model Extension

```typescript
interface Subject {
  $type$: 'Subject';
  id: string;
  name: string;
  keywords: SHA256IdHash<Keyword>[];
  description?: string;

  // NEW: Wikipedia enrichment metadata
  wikipedia?: {
    articleUrl: string;        // Full Wikipedia URL
    articleTitle: string;      // Canonical Wikipedia title
    pageid: number;            // Wikipedia page ID (stable)
    extractedKeywords: string[]; // Keywords from Wikipedia structure
    relatedSubjects: string[]; // Related article titles
    categories: string[];      // Wikipedia categories
    lastEnriched: number;      // Timestamp for cache invalidation
    confidence: number;        // 0.0-1.0 match confidence
  };
}
```

**Recipe Update** (in `/main/core/one-ai/recipes/SubjectRecipe.ts`):
```typescript
{
  itemprop: 'wikipedia',
  itemtype: {
    type: 'object',
    rules: [
      { itemprop: 'articleUrl' },
      { itemprop: 'articleTitle' },
      { itemprop: 'pageid', itemtype: { type: 'number' } },
      {
        itemprop: 'extractedKeywords',
        itemtype: {
          type: 'array',
          item: { type: 'string' }
        }
      },
      {
        itemprop: 'relatedSubjects',
        itemtype: {
          type: 'array',
          item: { type: 'string' }
        }
      },
      {
        itemprop: 'categories',
        itemtype: {
          type: 'array',
          item: { type: 'string' }
        }
      },
      { itemprop: 'lastEnriched', itemtype: { type: 'number' } },
      { itemprop: 'confidence', itemtype: { type: 'number' } }
    ]
  }
}
```

## Implementation

### Phase 1: MCP Server Setup

**File**: External repository `wikipedia-mcp-server`

```typescript
// index.ts
import { MCPServer } from '@modelcontextprotocol/sdk/server';

const server = new MCPServer({
  name: 'wikipedia',
  version: '1.0.0'
});

// Register tools
server.tool('search_wikipedia', {
  description: 'Search Wikipedia articles',
  parameters: {
    query: { type: 'string', required: true },
    limit: { type: 'number', default: 5 }
  }
}, async ({ query, limit }) => {
  const url = `https://en.wikipedia.org/w/api.php?` +
    `action=query&list=search&srsearch=${encodeURIComponent(query)}` +
    `&srlimit=${limit}&format=json`;

  const response = await fetch(url);
  const data = await response.json();

  return {
    results: data.query.search.map(r => ({
      title: r.title,
      snippet: r.snippet,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title)}`,
      pageid: r.pageid
    }))
  };
});

server.tool('get_article_summary', {
  description: 'Get Wikipedia article summary',
  parameters: {
    title: { type: 'string', required: true }
  }
}, async ({ title }) => {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

  const response = await fetch(url);
  const data = await response.json();

  return {
    title: data.title,
    extract: data.extract,
    url: data.content_urls.desktop.page,
    categories: [] // TODO: Fetch from separate API call
  };
});

server.tool('get_article_keywords', {
  description: 'Extract keywords from Wikipedia article structure',
  parameters: {
    title: { type: 'string', required: true }
  }
}, async ({ title }) => {
  // Fetch article data with categories and links
  const url = `https://en.wikipedia.org/w/api.php?` +
    `action=query&titles=${encodeURIComponent(title)}` +
    `&prop=categories|links&format=json`;

  const response = await fetch(url);
  const data = await response.json();
  const page = Object.values(data.query.pages)[0];

  const categories = page.categories?.map(c =>
    c.title.replace('Category:', '')
  ) || [];

  const links = page.links?.map(l => l.title) || [];

  // Extract keywords from categories and first N links
  const keywords = [
    ...categories,
    ...links.slice(0, 10)
  ].filter(k => !k.includes(':') && k.length > 2);

  return {
    keywords: [...new Set(keywords)],
    categories,
    links: links.slice(0, 20)
  };
});

server.tool('find_related_articles', {
  description: 'Find related Wikipedia articles',
  parameters: {
    title: { type: 'string', required: true },
    limit: { type: 'number', default: 5 }
  }
}, async ({ title, limit }) => {
  // Use "links" or search for related topics
  const url = `https://en.wikipedia.org/w/api.php?` +
    `action=query&titles=${encodeURIComponent(title)}` +
    `&prop=links&pllimit=${limit}&format=json`;

  const response = await fetch(url);
  const data = await response.json();
  const page = Object.values(data.query.pages)[0];

  const related = page.links?.slice(0, limit).map(l => ({
    title: l.title,
    snippet: '' // Could fetch summaries in parallel
  })) || [];

  return { related };
});

server.start();
```

### Phase 2: App Configuration

**File**: User config `~/.config/lama/mcp-config.json`

```json
{
  "mcpServers": {
    "wikipedia": {
      "command": "node",
      "args": ["/path/to/wikipedia-mcp-server/dist/index.js"],
      "env": {}
    }
  }
}
```

**Auto-detection**: MCP Manager already loads this config (`/main/services/mcp-manager.ts`)

### Phase 3: LLM System Prompt Update

**File**: `/main/services/llm-manager.ts`

Update system prompt to guide Wikipedia tool usage:

```typescript
const SYSTEM_PROMPT = `You are an AI assistant analyzing conversations...

When identifying subjects, you can use Wikipedia to enrich your analysis:
1. Search Wikipedia for the subject name
2. Extract additional keywords from the article
3. Include Wikipedia metadata in your response

Available Wikipedia tools:
- search_wikipedia: Find Wikipedia articles by query
- get_article_summary: Get article summary and metadata
- get_article_keywords: Extract keywords from article structure
- find_related_articles: Find related Wikipedia topics

When you use Wikipedia, include the metadata in your analysis response:

{
  "analysis": {
    "subjects": [
      {
        "name": "quantum computing",
        "description": "Discussion of quantum computing principles",
        "wikipedia": {
          "articleUrl": "https://en.wikipedia.org/wiki/Quantum_computing",
          "articleTitle": "Quantum computing",
          "pageid": 25674,
          "extractedKeywords": ["qubit", "superposition", "entanglement"],
          "relatedSubjects": ["Quantum mechanics", "Quantum information"],
          "categories": ["Quantum computing", "Theoretical computer science"],
          "confidence": 0.95
        },
        "keywords": [...]
      }
    ]
  }
}
`;
```

### Phase 4: Subject Storage Update

**File**: `/main/core/ai-assistant-model.ts`

Parse Wikipedia metadata from LLM response and store in Subject:

```typescript
async processAnalysisResponse(analysisData: any, topicId: string) {
  for (const subjectData of analysisData.subjects) {
    // Create subject with Wikipedia metadata
    const subject: Subject = {
      $type$: 'Subject',
      id: this.generateSubjectId(subjectData.name, topicId),
      name: subjectData.name,
      description: subjectData.description,
      keywords: [], // Populated below

      // NEW: Include Wikipedia metadata if provided
      ...(subjectData.wikipedia && {
        wikipedia: {
          articleUrl: subjectData.wikipedia.articleUrl,
          articleTitle: subjectData.wikipedia.articleTitle,
          pageid: subjectData.wikipedia.pageid,
          extractedKeywords: subjectData.wikipedia.extractedKeywords || [],
          relatedSubjects: subjectData.wikipedia.relatedSubjects || [],
          categories: subjectData.wikipedia.categories || [],
          lastEnriched: Date.now(),
          confidence: subjectData.wikipedia.confidence || 0.8
        }
      })
    };

    // Merge conversation keywords with Wikipedia keywords
    const allKeywords = [
      ...subjectData.keywords.map(k => k.term),
      ...(subjectData.wikipedia?.extractedKeywords || [])
    ];

    // Create/link keyword objects
    for (const keywordTerm of [...new Set(allKeywords)]) {
      const keywordHash = await this.createOrGetKeyword(keywordTerm);
      subject.keywords.push(keywordHash);
    }

    await storeVersionedObject(subject);
  }
}
```

### Phase 5: UI Display

**File**: `/electron-ui/src/components/chat/SubjectBadge.tsx`

Display Wikipedia indicator on subjects:

```typescript
function SubjectBadge({ subject }: { subject: Subject }) {
  const hasWikipedia = !!subject.wikipedia;

  return (
    <div className="subject-badge">
      <span className="subject-name">{subject.name}</span>
      {hasWikipedia && (
        <a
          href={subject.wikipedia.articleUrl}
          target="_blank"
          className="wikipedia-icon"
          title={`View on Wikipedia: ${subject.wikipedia.articleTitle}`}
        >
          <WikipediaIcon />
        </a>
      )}
    </div>
  );
}
```

**File**: `/electron-ui/src/components/chat/SubjectDetailPanel.tsx`

Show enriched information:

```typescript
function SubjectDetailPanel({ subject }: { subject: Subject }) {
  return (
    <div className="subject-detail">
      <h3>{subject.name}</h3>
      <p>{subject.description}</p>

      {subject.wikipedia && (
        <div className="wikipedia-section">
          <h4>Wikipedia Information</h4>
          <a href={subject.wikipedia.articleUrl} target="_blank">
            {subject.wikipedia.articleTitle}
          </a>

          <div className="categories">
            <strong>Categories:</strong>
            {subject.wikipedia.categories.map(cat => (
              <Badge key={cat}>{cat}</Badge>
            ))}
          </div>

          <div className="related-subjects">
            <strong>Related Topics:</strong>
            <ul>
              {subject.wikipedia.relatedSubjects.map(related => (
                <li key={related}>{related}</li>
              ))}
            </ul>
          </div>

          <div className="enriched-keywords">
            <strong>Wikipedia Keywords:</strong>
            {subject.wikipedia.extractedKeywords.map(kw => (
              <Badge key={kw} variant="secondary">{kw}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="conversation-keywords">
        <strong>Conversation Keywords:</strong>
        {subject.keywords.map(kwHash => (
          <KeywordBadge key={kwHash} keywordHash={kwHash} />
        ))}
      </div>
    </div>
  );
}
```

## IPC Handlers (Optional - Manual Enrichment)

**File**: `/main/ipc/handlers/wikipedia.ts`

For manual "Enrich from Wikipedia" functionality:

```typescript
ipcMain.handle('wikipedia:enrichSubject', async (event, subjectIdHash) => {
  const subject = await getObjectByIdHash(subjectIdHash);

  // Call MCP Wikipedia tools
  const searchResults = await mcpManager.callTool('wikipedia', 'search_wikipedia', {
    query: subject.name,
    limit: 1
  });

  if (searchResults.results.length === 0) {
    throw new Error('No Wikipedia article found');
  }

  const topResult = searchResults.results[0];

  const keywords = await mcpManager.callTool('wikipedia', 'get_article_keywords', {
    title: topResult.title
  });

  const related = await mcpManager.callTool('wikipedia', 'find_related_articles', {
    title: topResult.title,
    limit: 5
  });

  // Update subject with Wikipedia data
  const enrichedSubject: Subject = {
    ...subject,
    wikipedia: {
      articleUrl: topResult.url,
      articleTitle: topResult.title,
      pageid: topResult.pageid,
      extractedKeywords: keywords.keywords,
      relatedSubjects: related.related.map(r => r.title),
      categories: keywords.categories,
      lastEnriched: Date.now(),
      confidence: 0.9
    }
  };

  // Merge Wikipedia keywords into subject
  const newKeywords = keywords.keywords.filter(kw =>
    !subject.keywords.includes(kw)
  );

  for (const keyword of newKeywords) {
    const kwHash = await createOrGetKeyword(keyword);
    enrichedSubject.keywords.push(kwHash);
  }

  await storeVersionedObject(enrichedSubject);
  return enrichedSubject;
});
```

## Performance Considerations

### Caching Strategy

**Wikipedia API Responses**:
- Cache in-memory for 1 hour (Wikipedia content rarely changes)
- Cache key: `wikipedia:${tool}:${JSON.stringify(params)}`
- LRU cache, max 100 entries
- Implemented in MCP server, not app

**Subject Enrichment**:
- Only enrich once per subject (check `wikipedia.lastEnriched`)
- Re-enrich if subject is older than 30 days
- Skip enrichment if confidence < 0.7

### Rate Limiting

**Wikipedia API Limits**:
- 200 requests/second (generous)
- User-Agent required: "LAMA-Electron/1.0 (contact@example.com)"
- Respect `Retry-After` headers

**Implementation**:
```typescript
// In wikipedia-mcp-server
const rateLimiter = new RateLimiter({
  requestsPerSecond: 50, // Conservative
  burstSize: 10
});

await rateLimiter.acquire();
const response = await fetch(url, {
  headers: {
    'User-Agent': 'LAMA-Electron/1.0 (https://github.com/your-repo)'
  }
});
```

## Testing

### Unit Tests

**File**: `/tests/integration/wikipedia/wikipedia-enrichment.test.ts`

```typescript
describe('Wikipedia Subject Enrichment', () => {
  it('should enrich subject with Wikipedia data', async () => {
    const subject = await createSubject('Quantum computing', topicId);

    // Trigger enrichment
    const enriched = await enrichSubjectWithWikipedia(subject);

    expect(enriched.wikipedia).toBeDefined();
    expect(enriched.wikipedia.articleTitle).toBe('Quantum computing');
    expect(enriched.wikipedia.extractedKeywords).toContain('qubit');
  });

  it('should merge Wikipedia keywords with conversation keywords', async () => {
    const subject = {
      name: 'Machine learning',
      keywords: ['neural networks', 'training']
    };

    const enriched = await enrichSubjectWithWikipedia(subject);

    // Should have both conversation and Wikipedia keywords
    expect(enriched.keywords).toContain('neural networks');
    expect(enriched.keywords).toContain('deep learning'); // From Wikipedia
  });
});
```

### Manual Testing

1. Start app with Wikipedia MCP server configured
2. Start conversation about "quantum computing"
3. Verify subject is created with Wikipedia metadata
4. Check subject detail panel shows Wikipedia info
5. Verify Wikipedia icon appears on subject badge
6. Click Wikipedia link to verify URL correctness

## Configuration

### User Settings

**File**: `/electron-ui/src/components/SettingsView.tsx`

Add Wikipedia settings section:

```typescript
function WikipediaSettings() {
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [enrichmentThreshold, setEnrichmentThreshold] = useState(0.7);

  return (
    <div className="wikipedia-settings">
      <h3>Wikipedia Integration</h3>

      <label>
        <input
          type="checkbox"
          checked={autoEnrich}
          onChange={e => setAutoEnrich(e.target.checked)}
        />
        Automatically enrich subjects with Wikipedia
      </label>

      <label>
        Minimum confidence threshold:
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={enrichmentThreshold}
          onChange={e => setEnrichmentThreshold(parseFloat(e.target.value))}
        />
        {enrichmentThreshold.toFixed(1)}
      </label>
    </div>
  );
}
```

## Future Enhancements

1. **Multi-language Support**: Allow Wikipedia language selection (en, de, fr, etc.)
2. **Disambiguation**: Handle Wikipedia disambiguation pages intelligently
3. **Wikidata Integration**: Link to structured Wikidata entities
4. **Offline Cache**: Download Wikipedia summaries for offline access
5. **Custom Knowledge Bases**: Support other wikis (Fandom, etc.)

## Documentation

- **Spec**: This file
- **MCP Server**: README in `wikipedia-mcp-server` repo
- **User Guide**: How to enable Wikipedia enrichment
- **API Docs**: Wikipedia MediaWiki API documentation

## Success Metrics

- **Enrichment Rate**: % of subjects enriched with Wikipedia data
- **Keyword Quality**: User feedback on Wikipedia keyword relevance
- **Performance**: Wikipedia API calls < 500ms p95
- **Cache Hit Rate**: > 60% for Wikipedia API responses
