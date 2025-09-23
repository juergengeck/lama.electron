# Quickstart: HTML Export with Microdata Markup

## Overview
Export LAMA conversations as self-contained HTML files with comprehensive microdata markup, including cryptographic hashes and signatures for message verification.

## Quick Usage

### Export a Conversation
1. Open a conversation in LAMA
2. Click the **Export** button (or use Cmd/Ctrl+E)
3. Select **HTML with Microdata** from the format dropdown
4. Click **Export**
5. Choose where to save the HTML file

### View Exported HTML
1. Open the exported HTML file in any web browser
2. Messages display with formatting preserved
3. Hover over messages to see hash and signature info
4. Print or share the file - it's completely self-contained

## Features

### What's Included
- ✅ All messages with original formatting
- ✅ Participant information
- ✅ Cryptographic hashes for each message
- ✅ Digital signatures (when available)
- ✅ Timestamps with both human-readable and ISO formats
- ✅ Inline attachments (images, files)
- ✅ Self-contained HTML (no external dependencies)

### Microdata Structure
Every message includes embedded microdata that can be read by machines:
```html
<div itemscope itemtype="//refin.io/Message"
     data-hash="abc123..."
     data-signature="xyz789...">
  <span itemprop="author">John Doe</span>
  <span itemprop="content">Message text</span>
  <time itemprop="timestamp">2025-09-22T10:30:00Z</time>
</div>
```

## Export Options

### Basic Export
```javascript
// From UI - just click Export
// From code:
await window.electronAPI.invoke('export:htmlWithMicrodata', {
  topicId: 'current-topic-id',
  format: 'html-microdata'
});
```

### Advanced Options
```javascript
await window.electronAPI.invoke('export:htmlWithMicrodata', {
  topicId: 'current-topic-id',
  format: 'html-microdata',
  options: {
    includeSignatures: true,    // Include crypto signatures
    includeAttachments: true,   // Embed files inline
    maxMessages: 1000,          // Limit message count
    styleTheme: 'light',        // or 'dark', 'auto'
    dateRange: {                // Filter by date
      start: '2025-09-01T00:00:00Z',
      end: '2025-09-22T23:59:59Z'
    }
  }
});
```

## Verification

### Verify Message Integrity
The exported HTML includes data attributes for verification:

1. **Hash Verification**: Each message has a `data-hash` attribute
2. **Signature Verification**: Messages include `data-signature` when signed
3. **Author Verification**: Author info includes public keys

### Extract Microdata
Use any microdata parser to extract structured data:
```javascript
// Example with a microdata parser
const messages = document.querySelectorAll('[itemtype*="Message"]');
messages.forEach(msg => {
  const hash = msg.getAttribute('data-hash');
  const signature = msg.getAttribute('data-signature');
  const author = msg.querySelector('[itemprop="author"]').textContent;
  const content = msg.querySelector('[itemprop="content"]').textContent;
  console.log({hash, signature, author, content});
});
```

## Testing the Feature

### Manual Test
1. Create a conversation with multiple messages
2. Add some formatted text (bold, italic, code blocks)
3. Export as HTML with microdata
4. Open in browser - verify all content displays correctly
5. View page source - verify microdata attributes present

### Automated Test
```javascript
// Integration test example
describe('HTML Export with Microdata', () => {
  it('should export conversation with hashes', async () => {
    // Create test conversation
    const topicId = await createTestConversation();

    // Export as HTML
    const result = await electronAPI.invoke('export:htmlWithMicrodata', {
      topicId,
      format: 'html-microdata'
    });

    // Verify response
    expect(result.html).toContain('itemtype="//refin.io/Message"');
    expect(result.html).toContain('data-hash=');
    expect(result.metadata.messageCount).toBeGreaterThan(0);

    // Parse and verify microdata
    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    const messages = doc.querySelectorAll('[itemtype*="Message"]');
    expect(messages.length).toBe(result.metadata.messageCount);
  });
});
```

## Troubleshooting

### Export Takes Too Long
- Reduce the number of messages with `maxMessages` option
- Use date range filtering to limit scope
- Check that attachments aren't too large

### Missing Signatures
- Signatures are only available for signed messages
- System messages may not have signatures
- Check that the sender has a valid signing key

### File Too Large to Open
- Use `maxMessages` to limit export size
- Disable `includeAttachments` if files are large
- Consider splitting into multiple exports by date range

## Technical Details

### How It Works
1. **Retrieve Messages**: Fetch from TopicRoom by topic ID
2. **Run implode()**: ONE.core's implode() embeds referenced objects
3. **Add Formatting**: Wrap in HTML with CSS styling
4. **Embed Metadata**: Add hashes, signatures, timestamps
5. **Return HTML**: Complete self-contained document

### Performance
- 1,000 messages: ~2 seconds
- 10,000 messages: ~10 seconds
- Memory usage: ~50MB per 1,000 messages

### Security
- All user content is HTML-escaped
- No external resources loaded
- Content-Security-Policy prevents XSS
- Hashes allow content verification

## API Reference

### IPC Handler
**Channel**: `export:htmlWithMicrodata`

**Request**:
```typescript
{
  topicId: string;
  format: 'html-microdata';
  options?: {
    includeSignatures?: boolean;
    includeAttachments?: boolean;
    maxMessages?: number;
    dateRange?: {
      start?: string;
      end?: string;
    };
    styleTheme?: 'light' | 'dark' | 'auto';
  };
}
```

**Response**:
```typescript
{
  html: string;
  metadata: {
    messageCount: number;
    exportDate: string;
    topicId: string;
    fileSize: number;
    participants?: Array<{
      email: string;
      name: string;
      personHash?: string;
    }>;
    dateRange?: {
      start: string;
      end: string;
    };
  };
}
```

## Next Steps

- Try exporting a conversation
- Verify the microdata in browser dev tools
- Build verification tools using the embedded hashes
- Customize the styling for your needs