# Data Model: HTML Export with Microdata Markup

**Feature**: HTML Export with comprehensive microdata markup
**Date**: 2025-09-22

## Core Entities

### 1. ExportRequest
Represents a user's request to export a conversation in HTML format.

**Properties**:
- `topicId`: string - The conversation/topic identifier to export
- `format`: 'html-microdata' | 'markdown' - Export format selection
- `options`: ExportOptions - Optional configuration for export

**Validation Rules**:
- topicId must be a valid existing topic
- format must be supported export type
- options are optional with defaults

### 2. ExportOptions
Configuration options for HTML export customization.

**Properties**:
- `includeSignatures`: boolean (default: true) - Include cryptographic signatures
- `includeAttachments`: boolean (default: true) - Include file attachments inline
- `maxMessages`: number (default: 10000) - Maximum messages to export
- `dateRange`: { start?: Date, end?: Date } - Optional date filtering
- `styleTheme`: 'light' | 'dark' | 'auto' (default: 'light') - Visual theme

### 3. MessageMicrodata
Individual message representation with embedded microdata.

**Properties**:
- `hash`: SHA256Hash - Message object hash
- `idHash`: SHA256IdHash - ID hash for versioned messages
- `signature`: string - Cryptographic signature
- `author`: PersonMicrodata - Message author information
- `content`: string - Message content (HTML escaped)
- `timestamp`: ISO8601 string - Message creation time
- `attachments`: AttachmentMicrodata[] - File attachments

**Microdata Structure**:
```html
<div itemscope itemtype="//refin.io/Message"
     data-hash="[hash]"
     data-signature="[signature]">
  <span itemprop="author">[PersonMicrodata]</span>
  <span itemprop="content">[escaped content]</span>
  <time itemprop="timestamp" datetime="[ISO8601]">[human readable]</time>
</div>
```

### 4. PersonMicrodata
Author information with cryptographic identity.

**Properties**:
- `email`: string - Person's email (ID property)
- `name`: string - Display name
- `personHash`: SHA256IdHash - Person object hash
- `publicKey`: string - Public signing key

**Microdata Structure**:
```html
<span itemscope itemtype="//refin.io/Person"
      data-hash="[personHash]">
  <span itemprop="email">[email]</span>
  <span itemprop="name">[name]</span>
</span>
```

### 5. ConversationMetadata
Header information about the exported conversation.

**Properties**:
- `topicId`: string - Conversation identifier
- `title`: string - Conversation title/topic
- `participants`: PersonMicrodata[] - All participants
- `messageCount`: number - Total messages in export
- `dateRange`: { start: Date, end: Date } - Time span of messages
- `exportDate`: Date - When export was generated
- `exportVersion`: string - Export format version

**Microdata Structure**:
```html
<header itemscope itemtype="//refin.io/ConversationExport">
  <h1 itemprop="title">[title]</h1>
  <meta itemprop="topicId" content="[topicId]">
  <meta itemprop="messageCount" content="[count]">
  <time itemprop="dateRange">[start] to [end]</time>
  <div itemprop="participants">[PersonMicrodata list]</div>
</header>
```

### 6. ExportedHTML
Complete HTML document with all components.

**Properties**:
- `metadata`: ConversationMetadata - Conversation header
- `messages`: MessageMicrodata[] - All messages
- `styles`: string - Inline CSS for formatting
- `verificationScript`: string - Optional JS for hash verification

**Structure**:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>[Conversation Title]</title>
  <style>[Inline CSS]</style>
</head>
<body>
  [ConversationMetadata]
  <main>
    [MessageMicrodata list]
  </main>
  <script>[Optional verification script]</script>
</body>
</html>
```

### 7. AttachmentMicrodata
File attachment representation.

**Properties**:
- `filename`: string - Original filename
- `mimeType`: string - File MIME type
- `size`: number - File size in bytes
- `hash`: SHA256Hash - File content hash
- `data`: string - Base64 encoded content (if included)

**Microdata Structure**:
```html
<div itemscope itemtype="//refin.io/Attachment"
     data-hash="[hash]">
  <span itemprop="filename">[filename]</span>
  <meta itemprop="mimeType" content="[mimeType]">
  <meta itemprop="size" content="[size]">
  <data itemprop="content">[base64 data]</data>
</div>
```

## State Transitions

### Export Process States
1. **IDLE**: No export in progress
2. **LOADING**: Fetching messages from storage
3. **PROCESSING**: Running implode() and formatting
4. **COMPLETE**: HTML generated successfully
5. **ERROR**: Export failed

### State Flow
```
IDLE → LOADING → PROCESSING → COMPLETE
         ↓           ↓
       ERROR       ERROR
```

## Relationships

```
ExportRequest
    ↓
ConversationMetadata
    ↓
ExportedHTML
    ├── ConversationMetadata (1)
    └── MessageMicrodata (0..n)
         ├── PersonMicrodata (1)
         └── AttachmentMicrodata (0..n)
```

## Data Constraints

### Size Limits
- Maximum messages: 10,000 per export
- Maximum message size: 1MB per message
- Maximum total export: 100MB HTML file
- Maximum attachments: 10 per message

### Validation Rules
- All hashes must be valid SHA-256 format
- Timestamps must be valid ISO 8601
- HTML content must be properly escaped
- Signatures must match public keys

### Performance Requirements
- Export 1,000 messages: <2 seconds
- Export 10,000 messages: <10 seconds
- Memory usage: <500MB during export

## Error Conditions

### Validation Errors
- `INVALID_TOPIC`: Topic ID not found
- `INVALID_DATE_RANGE`: Start date after end date
- `EXCEEDS_MAX_MESSAGES`: More than 10,000 messages

### Processing Errors
- `IMPLODE_FAILED`: ONE.core implode() error
- `SIGNATURE_MISSING`: Required signature not available
- `MEMORY_EXCEEDED`: Export too large for memory

### Storage Errors
- `READ_FAILED`: Cannot read message objects
- `HASH_MISMATCH`: Calculated hash doesn't match stored

## Security Considerations

### Data Sanitization
- All user content HTML escaped via `escapeForHtml()`
- No external resource loading (all inline)
- Content-Security-Policy header included
- No executable JavaScript by default

### Cryptographic Verification
- Each message includes SHA-256 hash
- Signatures use Ed25519 algorithm
- Public keys embedded for verification
- Hash chain for message ordering

## Migration & Compatibility

### Version 1.0 (Initial Release)
- Basic HTML export with microdata
- Message hashes and signatures
- Inline styling

### Future Versions (Planned)
- Version 1.1: Add attachment preview
- Version 1.2: Add search functionality
- Version 1.3: Add print stylesheet
- Version 2.0: Add interactive verification