# Phase 0: Research - HTML Export with Microdata Markup

**Feature**: HTML Export with comprehensive microdata markup including hashes and signatures
**Date**: 2025-09-22

## Research Findings

### 1. ONE.core implode() Function

**Decision**: Use ONE.core's native `implode()` function directly
**Rationale**:
- ONE.core already has a robust implode() function that recursively embeds referenced objects into microdata
- Located in `packages/one.core/src/microdata-imploder.ts`
- Handles all object types (objects, CLOBs, BLOBs) automatically
- Preserves hash references as data attributes in the HTML

**Alternatives considered**:
- Building custom microdata generator: Rejected - would duplicate existing functionality
- Using external microdata libraries: Rejected - ONE.core has native support

**Key API**:
```javascript
async function implode(
    hash: SHA256Hash,
    idReferenceCallback?: (idHash: SHA256IdHash) => SHA256Hash | Promise<SHA256Hash>
): Promise<string>
```

### 2. Microdata Schema Format

**Decision**: Use ONE.core's native microdata format (refin.io schema)
**Rationale**:
- ONE.core objects are already stored as microdata with itemscope/itemtype/itemprop attributes
- Format is `<div itemscope itemtype="//refin.io/[TYPE]">`
- Each property uses `<span itemprop="[property]">value</span>`
- Hash references embedded as `<a itemprop="[prop]" data-type="[type]" href="[hash]">[hash]</a>`

**Alternatives considered**:
- Schema.org vocabulary: Rejected - Would require translation layer
- Custom schema: Rejected - ONE.core format is already comprehensive

**Example microdata structure**:
```html
<div itemscope itemtype="//refin.io/Person">
  <span itemprop="email">user@example.com</span>
  <span itemprop="name">John Doe</span>
</div>
```

### 3. Hash and Signature Integration

**Decision**: Embed hashes and signatures as HTML data attributes
**Rationale**:
- implode() already adds `data-hash` attributes for referenced objects
- Can extend with `data-signature` for cryptographic signatures
- Maintains machine-readability while preserving human readability

**Implementation approach**:
- Object hash: Available via `calculateHashOfObj()` from ONE.core
- ID hash: Available via `calculateIdHashOfObj()` for versioned objects
- Signatures: Available from Keys objects with publicSignKey

**Data attributes to include**:
- `data-hash`: SHA-256 hash of the object
- `data-id-hash`: ID hash for versioned objects (if applicable)
- `data-signature`: Cryptographic signature (when available)
- `data-timestamp`: Message timestamp for ordering

### 4. Human Readability Enhancement

**Decision**: Add CSS styling and semantic HTML wrapper
**Rationale**:
- Raw microdata from implode() is machine-readable but needs formatting
- Add conversation structure (header, messages, metadata)
- Include inline CSS for self-contained viewing

**Enhancement layers**:
1. **Semantic wrapper**: Conversation container with metadata header
2. **Message formatting**: Styled message bubbles with author info
3. **Timestamp display**: Human-readable dates alongside ISO timestamps
4. **Code block styling**: Preserve markdown code formatting
5. **Link handling**: Clickable links with proper styling

### 5. Performance Considerations

**Decision**: Stream processing for large conversations
**Rationale**:
- implode() is async and can handle large object graphs
- Process messages in batches to avoid memory issues
- Target: <2s for 1000 messages, <10s for 10k messages

**Optimization strategies**:
- Batch message processing (100 messages at a time)
- Use string concatenation vs DOM manipulation
- Cache imploded objects during export session
- Progressive rendering for UI feedback

### 6. IPC Architecture

**Decision**: Single IPC handler with options parameter
**Rationale**:
- Follows LAMA's IPC-first architecture
- All ONE.core operations stay in Node.js
- Browser only handles UI and file save dialog

**IPC Contract**:
```typescript
interface ExportHTMLRequest {
  topicId: string;
  format: 'html-microdata';
  options?: {
    includeSignatures?: boolean;
    includeAttachments?: boolean;
    maxMessages?: number;
  };
}

interface ExportHTMLResponse {
  html: string;
  metadata: {
    messageCount: number;
    exportDate: string;
    topicId: string;
  };
}
```

## Resolved Clarifications

### From Spec NEEDS CLARIFICATION Items:

1. **Microdata schema/vocabulary**: Use ONE.core's native refin.io schema
2. **Signature format/algorithm**: Use ONE.core's existing cryptographic signatures from Keys objects
3. **Performance requirements**:
   - Max size: 10k messages
   - Timeout: 30 seconds for export operation
   - Batch processing to maintain responsiveness

## Technical Dependencies Confirmed

- **ONE.core implode()**: Available in `packages/one.core/src/microdata-imploder.ts`
- **Hash calculation**: `calculateHashOfObj()` and `calculateIdHashOfObj()`
- **Signature access**: Via Keys objects in ONE.core
- **HTML escaping**: `escapeForHtml()` function in object-to-microdata.ts
- **File operations**: Existing IPC handlers for file system access

## Security Considerations

- **XSS Prevention**: Use ONE.core's `escapeForHtml()` for all user content
- **Content-Security-Policy**: Include CSP meta tag in exported HTML
- **No external resources**: All styling inline, no external dependencies
- **Hash verification**: Include verification instructions in HTML comments

## Next Steps for Phase 1

1. Design data model for export request/response
2. Create IPC handler contract
3. Design HTML template structure
4. Create test scenarios for implode() integration
5. Document quickstart guide for using the feature