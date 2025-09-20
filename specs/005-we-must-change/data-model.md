# Data Model: Topic-Subject-Summary Analysis

## Overview
This document defines the data structures for AI-powered topic analysis in LAMA Electron. All models are ONE.core objects stored in the Node.js instance and accessed via IPC.

## Core Entities

### Subject
Represents a distinct theme within a Topic, identified by its unique keyword combination.

```typescript
interface Subject {
  $type$: 'Subject';
  id: string;           // Format: `${topicId}:${sortedKeywords.join('-')}`
  topic: string;        // Hash reference to parent Topic
  keywords: string[];   // Sorted array of keywords identifying this subject
  timestamp: number;    // Unix timestamp from latest source message
  messageCount: number; // Number of messages contributing to this subject
  lastAnalyzed: number; // Timestamp of last AI analysis
  created: number;      // Creation timestamp
  updated: number;      // Last update timestamp
}
```

**Validation Rules:**
- `keywords` must contain 1-10 unique, lowercase strings
- `keywords` minimum length: 2 characters
- `topic` must reference an existing Topic object
- `timestamp` must be <= current time
- `messageCount` must be >= 1

**State Transitions:**
- Created → Active (on first analysis)
- Active → Updated (on new keywords/messages)
- Active → Merged (when combined with another subject)
- Active → Archived (after 30 days of inactivity)

### Keyword
Individual term or concept extracted from conversations.

```typescript
interface Keyword {
  $type$: 'Keyword';
  value: string;        // The keyword itself (lowercase, normalized)
  topics: string[];     // Array of topic hashes where this keyword appears
  subjects: string[];   // Array of subject IDs using this keyword
  frequency: number;    // Global occurrence count
  contexts: Context[];  // Recent usage contexts (last 10)
  created: number;      // First extraction timestamp
  lastSeen: number;     // Most recent occurrence
}

interface Context {
  topicId: string;
  messageId: string;
  snippet: string;      // 50 chars before/after keyword
  timestamp: number;
}
```

**Validation Rules:**
- `value` must be 2-50 characters, lowercase, alphanumeric + hyphens
- `frequency` must be >= 1
- `contexts` array maximum 10 entries
- `topics` and `subjects` must reference existing objects

### Summary
Versioned comprehensive overview of a Topic's subjects and discussions.

```typescript
interface Summary {
  $type$: 'Summary';
  id: string;                // Same as topicId (1:1 relationship)
  topic: string;             // Hash reference to Topic
  version: number;           // Incremental version number
  subjects: SubjectRef[];    // References to all subjects in this topic
  content: string;           // AI-generated summary text
  keywords: string[];        // Aggregate keywords from all subjects
  created: number;           // Version creation timestamp
  updated: number;           // Last modification timestamp
  previousVersion?: string;  // Hash of previous Summary version
  changeReason?: string;     // Why this version was created
}

interface SubjectRef {
  id: string;              // Subject ID
  keywords: string[];      // Subject's keywords (denormalized for performance)
  weight: number;          // Relative importance (0-1)
}
```

**Validation Rules:**
- `version` must be > 0 and increment sequentially
- `content` maximum 500 words (approximately 3000 characters)
- `subjects` must reference existing Subject objects
- `previousVersion` must reference existing Summary if version > 1
- Sum of all `weight` values in subjects must equal 1.0

## Relationships

### Entity Relationship Diagram
```
Topic (existing)
  │
  ├── 1:N Subject (via topic field)
  │     └── N:M Keyword (via keywords array)
  │
  └── 1:1 Summary (current version)
        └── 1:N Summary (version history via previousVersion)
```

### Access Control
- Subjects inherit access permissions from their parent Topic
- Keywords are globally accessible (no sensitive data)
- Summaries inherit access permissions from their parent Topic

## Operations

### Create Subject
```typescript
async function createSubject(params: {
  topicId: string;
  keywords: string[];
  sourceMessageId: string;
  timestamp: number;
}): Promise<Subject>
```

### Update Summary
```typescript
async function updateSummary(params: {
  topicId: string;
  subjects: SubjectRef[];
  content: string;
  changeReason: string;
}): Promise<Summary>
```

### Extract Keywords
```typescript
async function extractKeywords(params: {
  messages: Message[];
  existingKeywords?: string[];
}): Promise<string[]>
```

## Indexes
For efficient querying, the following indexes should be maintained:

1. **Subject by Topic**: `topic` → `Subject[]`
2. **Summary by Topic**: `topic` → `Summary` (current version)
3. **Keyword by Value**: `value` → `Keyword`
4. **Subject by Keywords**: `keywords.join('-')` → `Subject`
5. **Summary Versions**: `topic + version` → `Summary`

## Storage Estimates

### Per Entity
- Subject: ~500 bytes
- Keyword: ~1KB (with contexts)
- Summary: ~4KB (with content)

### Per Topic (average)
- 5 subjects × 500 bytes = 2.5KB
- 20 unique keywords × 1KB = 20KB
- 10 summary versions × 4KB = 40KB
- **Total: ~65KB per topic**

### System Scale (1000 topics)
- Storage: ~65MB
- Memory (active): ~10MB (cached entities)

## Migration Strategy

### Phase 1: Coexistence
- New entities created alongside existing Topic/Message structure
- No modification to existing data
- Feature flag for activation per topic

### Phase 2: Backfill (optional)
- Analyze existing topics on request
- Generate subjects and summaries for historical data
- User-triggered, not automatic

### Phase 3: Integration
- UI components display summaries
- Search includes keyword matches
- Export includes summary data

## Consistency Rules

1. **Subject Uniqueness**: No two subjects in the same topic can have identical keyword sets
2. **Summary Currency**: Current summary must reference all active subjects
3. **Keyword Normalization**: All keywords lowercase, trimmed, no special characters
4. **Version Integrity**: Summary versions form unbroken chain via previousVersion
5. **Timestamp Ordering**: Updated timestamp >= created timestamp
6. **Reference Integrity**: All references must point to existing objects

## Error Handling

### Invalid References
- Log error with context
- Skip invalid reference
- Continue processing
- Notify user if critical

### Storage Failures
- Retry with exponential backoff (3 attempts)
- Queue for later processing if persistent failure
- Maintain UI responsiveness via async processing

### Analysis Failures
- Fallback to basic keyword extraction
- Mark subject as "needs review"
- Allow manual correction

## Performance Optimizations

1. **Batch Processing**: Analyze messages in groups of 10
2. **Incremental Updates**: Only process new messages since lastAnalyzed
3. **Denormalization**: Store keywords in SubjectRef for quick access
4. **Caching**: Keep recent summaries in memory
5. **Lazy Loading**: Load version history only when requested

## Security Considerations

1. **No PII in Keywords**: Filter out emails, phone numbers, SSNs
2. **Sanitized Snippets**: Remove sensitive data from contexts
3. **Access Inheritance**: All entities respect Topic permissions
4. **Audit Trail**: Log all summary version changes
5. **Data Retention**: Auto-delete old versions after 30 days

---
*Generated for LAMA Electron v1.0.0 - Topic Analysis Feature*