# Data Model: XML-Based LLM Communication

**Feature**: 018-we-must-create | **Version**: 1.0.0 | **Date**: 2025-10-06

---

## Overview

This data model defines ONE.core versioned objects and BLOB attachments for storing XML-formatted LLM communications. All objects are stored via ONE.core storage in the Node.js main process.

---

## 1. XMLMessageAttachment (New)

**Purpose**: Store complete XML-formatted messages (queries and responses) as attachments

### Recipe Definition

```typescript
{
  $type$: 'XMLMessageAttachment',
  topicId: string,              // FK to Topic/conversation
  messageId: string,             // FK to Message object
  xmlContent?: string,           // Inline XML if ≤1KB
  xmlBlob?: SHA256IdHash<BLOB>,  // BLOB reference if >1KB
  format: 'llm-query' | 'llm-response',
  version: number,               // Schema version (currently 1)
  createdAt: number,             // Unix timestamp (ms)
  size: number                   // XML byte size
}
```

### Field Specifications

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$type$` | string | YES | Always "XMLMessageAttachment" |
| `topicId` | string | YES | Topic/conversation identifier |
| `messageId` | string | YES | Associated Message object ID |
| `xmlContent` | string | NO | Inline XML (only if ≤1KB) |
| `xmlBlob` | SHA256IdHash<BLOB> | NO | BLOB hash (only if >1KB) |
| `format` | enum | YES | "llm-query" or "llm-response" |
| `version` | number | YES | XML schema version (1.0.0 → 1) |
| `createdAt` | number | YES | Creation timestamp (Date.now()) |
| `size` | number | YES | XML byte size (for monitoring) |

### Storage Rules

- **≤1KB**: Store in `xmlContent` field (inline), `xmlBlob` is undefined
- **>1KB**: Store in BLOB, `xmlBlob` contains hash, `xmlContent` is undefined
- **Both fields**: Never populate both - exactly ONE must be defined
- **BLOB Creation**: Use `@refinio/one.core/lib/storage-blob.js` `createBlob()`

### Access Patterns

- **By Message**: Query by `messageId` to get XML for specific message
- **By Topic**: Query by `topicId` to get all XML messages in conversation
- **By Format**: Filter by `format` to separate queries from responses

### Example Objects

**Small Response (Inline)**:
```typescript
{
  $type$: 'XMLMessageAttachment',
  topicId: 'family-planning-2025',
  messageId: 'msg-abc123',
  xmlContent: '<llmResponse><response>Yes, 529 plans are great.</response>...</llmResponse>',
  format: 'llm-response',
  version: 1,
  createdAt: 1728234567890,
  size: 345
}
```

**Large Response (BLOB)**:
```typescript
{
  $type$: 'XMLMessageAttachment',
  topicId: 'family-planning-2025',
  messageId: 'msg-def456',
  xmlBlob: 'sha256://abc123...' as SHA256IdHash<BLOB>,
  format: 'llm-response',
  version: 1,
  createdAt: 1728234590123,
  size: 4567
}
```

---

## 2. Keyword (Enhanced)

**Purpose**: Store extracted keywords with reference to source XML

**EXISTING MODEL** - Enhanced with new field

### Enhanced Recipe

```typescript
{
  $type$: 'Keyword',
  term: string,                      // Normalized keyword term
  frequency: number,                 // Occurrence count
  subjects: SHA256IdHash[],          // Bag of Subject ID hashes
  score?: number,                    // Confidence/relevance (0.0-1.0)
  createdAt: number,
  lastSeen: number,
  sourceXmlHash?: SHA256IdHash<XMLMessageAttachment>  // NEW: Reference to XML that created it
}
```

### New Field

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sourceXmlHash` | SHA256IdHash | NO | Hash of XMLMessageAttachment that extracted this keyword |

### Usage

- When creating Keyword from XML response, set `sourceXmlHash` to attachment hash
- Enables tracing keywords back to original LLM analysis
- Optional field - not set for manually created keywords

---

## 3. Subject (Enhanced)

**Purpose**: Store extracted subjects (themes) with reference to source XML

**EXISTING MODEL** - Enhanced with new field

### Enhanced Recipe

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
  archived: boolean,
  sourceXmlHash?: SHA256IdHash<XMLMessageAttachment>  // NEW: Reference to XML that created it
}
```

### New Field

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sourceXmlHash` | SHA256IdHash | NO | Hash of XMLMessageAttachment that created this subject |

### Usage

- When creating Subject from XML `<analysis><subject>`, set `sourceXmlHash`
- Enables verification of subject extraction
- Optional field - not set for manually created subjects

---

## 4. Summary (Enhanced)

**Purpose**: Store conversation summaries with reference to source XML

**EXISTING MODEL** - Enhanced with new field

### Enhanced Recipe

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
  changeReason?: string,
  sourceXmlHash?: SHA256IdHash<XMLMessageAttachment>  // NEW: Reference to XML that updated it
}
```

### New Field

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sourceXmlHash` | SHA256IdHash | NO | Hash of XMLMessageAttachment whose `<summaryUpdate>` triggered this version |

---

## 5. SystemPromptTemplate (New)

**Purpose**: Store LLM system prompts with XML format instructions per model

### Recipe Definition

```typescript
{
  $type$: 'SystemPromptTemplate',
  modelId: string,               // LLM model identifier (e.g., "gpt-4")
  promptText: string,            // Complete system prompt with XML instructions
  xmlSchemaVersion: number,      // XML schema version (1, 2, 3...)
  version: number,               // Template version (increments on changes)
  createdAt: number,
  updatedAt: number,
  active: boolean                // Only one active template per modelId
}
```

### Field Specifications

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$type$` | string | YES | Always "SystemPromptTemplate" |
| `modelId` | string | YES | LLM model (e.g., "gpt-4-turbo", "claude-3") |
| `promptText` | string | YES | Complete system prompt text |
| `xmlSchemaVersion` | number | YES | XML schema version this template uses |
| `version` | number | YES | Template version (1, 2, 3...) |
| `createdAt` | number | YES | Creation timestamp |
| `updatedAt` | number | YES | Last update timestamp |
| `active` | boolean | YES | True if this is the active template for modelId |

### Usage

- **Creation**: When configuring LLM model, create template with XML instructions
- **Versioning**: Incrementing `version` creates new template, old becomes `active: false`
- **Retrieval**: LLM Manager queries for `{modelId: '...', active: true}`
- **Storage**: ONE.core versioned object (not BLOB - prompts are ~400 tokens)

### Example

```typescript
{
  $type$: 'SystemPromptTemplate',
  modelId: 'gpt-4-turbo',
  promptText: `You are an AI assistant. Always respond using this XML format:

<llmResponse>
  <response>[Your natural language response]</response>
  <analysis>
    <subject name="topic-name" description="..." isNew="true|false">
      <keyword term="..." confidence="0.8" />
    </subject>
    <summaryUpdate>[Brief summary]</summaryUpdate>
  </analysis>
</llmResponse>

Rules:
- Extract 1-3 subjects per response
- Include 3-7 keywords per subject
- Use lowercase, hyphenated names`,
  xmlSchemaVersion: 1,
  version: 1,
  createdAt: 1728234567890,
  updatedAt: 1728234567890,
  active: true
}
```

---

## 6. Data Relationships

### Entity Relationship Diagram

```
Topic (existing)
  ├─ 1:N → Message (existing)
  │         ├─ 1:1 → XMLMessageAttachment (NEW)
  │         └─ 1:N → Keyword (via sourceXmlHash)
  │
  ├─ 1:N → Subject (enhanced)
  │         └─ N:1 → XMLMessageAttachment (via sourceXmlHash)
  │
  ├─ 1:N → Summary (enhanced)
  │         └─ N:1 → XMLMessageAttachment (via sourceXmlHash)
  │
  └─ 1:N → Keyword (enhanced)

LLMModel (existing)
  └─ 1:N → SystemPromptTemplate (NEW)
```

### Referential Integrity

- **XMLMessageAttachment.messageId** → Message (required, enforced)
- **XMLMessageAttachment.topicId** → Topic (required, enforced)
- **Keyword.sourceXmlHash** → XMLMessageAttachment (optional, not enforced)
- **Subject.sourceXmlHash** → XMLMessageAttachment (optional, not enforced)
- **Summary.sourceXmlHash** → XMLMessageAttachment (optional, not enforced)

### Cascade Behavior

- **Delete Topic**: XMLMessageAttachments remain (orphaned) - manual cleanup required
- **Delete Message**: XMLMessageAttachment should be deleted (implement in service layer)
- **Delete XMLMessageAttachment**: Keywords/Subjects remain (sourceXmlHash becomes dangling reference)

---

## 7. Storage Layer

### File Structure

```
main/
├── core/
│   └── one-ai/
│       ├── models/
│       │   ├── Keyword.ts               # MODIFY: Add sourceXmlHash field
│       │   ├── Subject.ts               # MODIFY: Add sourceXmlHash field
│       │   ├── Summary.ts               # MODIFY: Add sourceXmlHash field
│       │   ├── XMLMessageAttachment.ts  # NEW
│       │   └── SystemPromptTemplate.ts  # NEW
│       └── recipes/
│           ├── keyword.ts               # MODIFY: Add sourceXmlHash to recipe
│           ├── subject.ts               # MODIFY: Add sourceXmlHash to recipe
│           ├── summary.ts               # MODIFY: Add sourceXmlHash to recipe
│           ├── xml-message-attachment.ts # NEW
│           └── system-prompt-template.ts # NEW
```

### Recipe Registration

**Location**: `/main/core/one-ai/recipes/index.ts`

```typescript
import { XMLMessageAttachmentRecipe } from './xml-message-attachment.js';
import { SystemPromptTemplateRecipe } from './system-prompt-template.js';

export const recipes = {
  XMLMessageAttachment: XMLMessageAttachmentRecipe,
  SystemPromptTemplate: SystemPromptTemplateRecipe,
  // ... existing recipes
};
```

### BLOB Management

**Service**: `/main/services/attachment-service.ts` (existing)

**New Methods**:
- `storeXMLAttachment(topicId, messageId, xmlString, format)` - Store XML as attachment
- `retrieveXMLAttachment(attachmentHash)` - Retrieve XML content
- `getAttachmentSize(attachmentHash)` - Get byte size

**Implementation**:
```typescript
import { createBlob, retrieveBlob } from '@refinio/one.core/lib/storage-blob.js';

async storeXMLAttachment(topicId, messageId, xmlString, format) {
  const size = Buffer.byteLength(xmlString, 'utf8');

  if (size <= 1024) {
    // Inline storage
    return await storeVersionedObject({
      $type$: 'XMLMessageAttachment',
      topicId,
      messageId,
      xmlContent: xmlString,
      format,
      version: 1,
      createdAt: Date.now(),
      size
    });
  } else {
    // BLOB storage
    const blobHash = await createBlob(Buffer.from(xmlString, 'utf8'));
    return await storeVersionedObject({
      $type$: 'XMLMessageAttachment',
      topicId,
      messageId,
      xmlBlob: blobHash,
      format,
      version: 1,
      createdAt: Date.now(),
      size
    });
  }
}
```

---

## 8. Performance Characteristics

### Storage Size Estimates

| Object Type | Avg Size | Count per Topic | Total per 1000 Messages |
|-------------|----------|-----------------|-------------------------|
| XMLMessageAttachment (query) | 500 bytes | 1000 | 500 KB |
| XMLMessageAttachment (response) | 3 KB | 1000 | 3 MB |
| Keyword (with sourceXmlHash) | 150 bytes | ~5000 | 750 KB |
| Subject (with sourceXmlHash) | 200 bytes | ~100 | 20 KB |
| SystemPromptTemplate | 1 KB | 1 per model | 1 KB |

**Total overhead per 1000 messages**: ~4.3 MB (acceptable for local storage)

### Query Performance

- **Retrieve XML by Message**: O(1) - direct hash lookup
- **Retrieve all XML for Topic**: O(N) - N = message count (with index)
- **Trace Keyword → XML**: O(1) - sourceXmlHash direct lookup
- **List all Templates**: O(M) - M = model count (~10)

---

## 9. Migration Strategy

**NO LEGACY MIGRATION** (per stakeholder decision in spec.md)

- Existing Keywords/Subjects/Summaries: Keep as-is, no `sourceXmlHash` field
- New conversations: Use XML format from first message
- Mixed state: Acceptable - old data without references, new data with references

---

## 10. Validation & Constraints

### XMLMessageAttachment

- **Exactly one content field**: `xmlContent` XOR `xmlBlob` (not both)
- **Size accuracy**: `size` field must match actual byte length
- **Version compatibility**: `version` must match supported schema versions
- **Format enum**: `format` must be "llm-query" or "llm-response"

### SystemPromptTemplate

- **Unique active template**: Only one `active: true` per `modelId`
- **Version increment**: Each new version must be `previousVersion + 1`
- **XML schema compatibility**: `xmlSchemaVersion` must match deployed schema

---

*Data model v1.0.0 - Defines storage for XML-based LLM communication with ONE.core*
