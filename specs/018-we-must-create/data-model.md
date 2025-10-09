# Data Model: Ollama Structured Output Integration

**Feature**: 018-we-must-create | **Version**: 1.0.0 | **Date**: 2025-10-06

---

## Overview

This data model defines how Ollama's structured JSON outputs are stored using ONE.core's existing recipes. No new recipes needed - we use existing Subject, Keyword, and Summary models with ONE.core references for traceability.

---

## 1. Message (Existing - Enhanced Usage)

**Purpose**: Store user and AI messages - already exists in ONE.core

### Usage Enhancement

- Messages serve as the anchor for traceability
- Extracted Keywords/Subjects link back to the Message that created them
- Use ONE.core's native reference system (`SHA256IdHash<Message>`)

### No Changes Needed

- Existing Message recipe works as-is
- No new fields required
- ONE.core already handles message storage and references

---

## 2. Keyword (Existing - Enhanced Usage)

**Purpose**: Store extracted keywords with reference to source message

**EXISTING MODEL** - Use with ONE.core references

### Current Recipe

```typescript
{
  $type$: 'Keyword',
  term: string,                      // Normalized keyword term
  frequency: number,                 // Occurrence count
  subjects: SHA256IdHash[],          // Bag of Subject ID hashes
  score?: number,                    // Confidence/relevance (0.0-1.0)
  createdAt: number,
  lastSeen: number
}
```

### Traceability

- Link to source message via ONE.core references (not stored in Keyword object)
- Use `addIdProof()` or similar ONE.core mechanism to link Keyword → Message
- Query relationships using ONE.core's graph traversal

---

## 3. Subject (Existing - Enhanced Usage)

**Purpose**: Store extracted subjects (themes) with reference to source message

**EXISTING MODEL** - Use with ONE.core references

### Current Recipe

```typescript
{
  $type$: 'Subject',
  id: string,                        // Keyword combination (e.g., "children+education")
  topic: string,                     // FK to Topic
  keywords: string[],                // Array of keyword terms
  timeRanges: Array<{start: number, end: number}>,
  messageCount: number,
  createdAt: number,
  lastSeenAt: number,
  archived: boolean
}
```

### Traceability

- Link to source message via ONE.core references (not stored in Subject object)
- Use ONE.core's native reference system to track Subject → Message relationship
- Enables verification without adding fields to recipe

---

## 4. Summary (Existing - Enhanced Usage)

**Purpose**: Store conversation summaries with reference to source message

**EXISTING MODEL** - Use with ONE.core references

### Current Recipe

```typescript
{
  $type$: 'Summary',
  id: string,                        // Format: "topicId-v1", "topicId-v2"
  topic: string,                     // FK to Topic
  content: string,                   // Summary text
  subjects: string[],                // Subject IDs referenced
  keywords: string[],                // Keyword terms referenced
  version: number,                   // Version number (1, 2, 3...)
  previousVersion?: string,          // ID of previous Summary
  createdAt: number,
  updatedAt: number,
  changeReason?: string
}
```

### Traceability

- Link to source message via ONE.core references (not stored in Summary object)
- Track which message triggered summary update using ONE.core graph

---

## 5. Data Flow

### From Ollama JSON to ONE.core Objects

```
1. Ollama returns JSON (guaranteed structure via format parameter)
   ↓
2. Parse JSON using native JSON.parse()
   ↓
3. Extract analysis data (subjects, keywords, summaryUpdate)
   ↓
4. Create/update ONE.core objects using existing recipes
   ↓
5. Link objects to source Message using ONE.core references
```

### JSON Schema (defined in `/main/schemas/llm-response.schema.ts`)

```json
{
  "response": "Natural language response",
  "analysis": {
    "subjects": [
      {
        "name": "subject-name",
        "description": "Brief explanation",
        "isNew": true,
        "keywords": [
          {"term": "keyword", "confidence": 0.8}
        ]
      }
    ],
    "summaryUpdate": "Brief summary of exchange"
  }
}
```

### Mapping JSON → ONE.core

| JSON Path | ONE.core Object | Notes |
|-----------|-----------------|-------|
| `response` | Message content | Natural language text |
| `analysis.subjects[].name` | Subject.id | Subject identifier |
| `analysis.subjects[].description` | Subject metadata | Used for display |
| `analysis.subjects[].keywords[]` | Keyword objects | Create/update Keywords |
| `analysis.summaryUpdate` | Summary.content | Update conversation summary |

---

## 6. Data Relationships

### Entity Relationship Diagram

```
Topic (existing)
  ├─ 1:N → Message (existing)
  │         ├─ 1:N → Keyword (via ONE.core references)
  │         └─ 1:N → Subject (via ONE.core references)
  │
  ├─ 1:N → Subject (existing)
  │
  ├─ 1:N → Summary (existing)
  │         └─ N:1 → Message (via ONE.core references - which message triggered update)
  │
  └─ 1:N → Keyword (existing)
```

### Referential Integrity

- **Message → Topic**: Existing ONE.core relationship
- **Keyword → Message**: ONE.core reference (traceability)
- **Subject → Message**: ONE.core reference (traceability)
- **Summary → Message**: ONE.core reference (which message triggered update)

### Cascade Behavior

- **Delete Topic**: Messages deleted per existing ONE.core behavior
- **Delete Message**: Keywords/Subjects remain (references become historical)
- ONE.core handles reference cleanup automatically

---

## 7. Storage Layer

### File Structure

```
main/
├── schemas/
│   └── llm-response.schema.ts      # NEW: JSON schema for Ollama
├── core/
│   └── one-ai/
│       ├── models/
│       │   ├── Keyword.ts          # EXISTING: No changes
│       │   ├── Subject.ts          # EXISTING: No changes
│       │   └── Summary.ts          # EXISTING: No changes
│       ├── recipes/
│       │   ├── keyword.ts          # EXISTING: No changes
│       │   ├── subject.ts          # EXISTING: No changes
│       │   └── summary.ts          # EXISTING: No changes
│       └── services/
│           └── TopicAnalyzer.ts    # MODIFY: Parse JSON, create objects
└── services/
    ├── llm-manager.ts              # MODIFY: Pass format to Ollama
    └── ollama.ts                   # MODIFY: Support format parameter
```

### Implementation Strategy

**No Recipe Changes Required**:
- Use existing Keyword/Subject/Summary recipes as-is
- Use ONE.core's native reference system for traceability
- No new fields or types needed

**Service Layer Changes**:
- `llm-manager.ts`: Parse JSON from Ollama
- `TopicAnalyzer.ts`: Create ONE.core objects from parsed JSON
- Use `storeVersionedObject()` for objects
- Use ONE.core reference APIs to link objects

---

## 8. Performance Characteristics

### Storage Size Estimates

| Object Type | Avg Size | Count per Topic | Total per 1000 Messages |
|-------------|----------|-----------------|-------------------------|
| Keyword | 120 bytes | ~5000 | 600 KB |
| Subject | 180 bytes | ~100 | 18 KB |
| Summary | 300 bytes | ~50 versions | 15 KB |
| ONE.core references | 64 bytes each | ~5000 | 320 KB |

**Total overhead per 1000 messages**: ~950 KB (minimal - no redundant XML storage)

### Query Performance

- **Retrieve Keywords by Message**: O(1) - ONE.core reference lookup
- **Retrieve Subjects for Topic**: O(N) - N = subject count (with index)
- **Trace Keyword → Message**: O(1) - ONE.core reference lookup
- **List Summaries**: O(V) - V = version count (~50)

---

## 9. Migration Strategy

**NO LEGACY MIGRATION** (per stakeholder decision in spec.md)

- Existing Keywords/Subjects/Summaries: Keep as-is
- New conversations: Use Ollama structured outputs from first message
- Mixed state: Acceptable - old data without references, new data with references
- ONE.core handles both seamlessly

---

## 10. Validation & Constraints

### JSON Response (enforced by Ollama)

- **Structure**: Ollama guarantees JSON matches schema (no malformed responses)
- **Required fields**: All required fields present (enforced by schema)
- **Type safety**: Types match schema definition

### Business Logic (enforced by application)

- **Keyword confidence**: Only store keywords with confidence ≥ 0.6
- **Subject limit**: Maximum 3 subjects per response
- **Keyword limit**: Maximum 10 keywords per subject
- **Summary length**: 10-500 characters

### ONE.core Constraints

- **Object hashing**: ONE.core ensures content-addressable storage
- **Reference integrity**: ONE.core validates reference hashes
- **Version control**: ONE.core handles object versioning automatically

---

*Data model v1.0.0 - Defines Ollama structured output integration with ONE.core native storage*
