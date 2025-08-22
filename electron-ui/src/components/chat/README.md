# Enhanced Chat Components Integration Guide

This guide explains how to integrate the enhanced chat components with Subject hashtag functionality into the existing LAMA desktop chat UI.

## Components Overview

### 1. EnhancedMessageInput.tsx
- **Purpose**: Enhanced message input with media upload and hashtag suggestions
- **Features**: 
  - Subject hashtag detection and suggestions
  - Drag & drop file upload
  - Attachment preview with Subject tags
  - Trust-aware media handling
  - HTML5 File API integration

### 2. EnhancedMessageBubble.tsx
- **Purpose**: Message display with Subject hashtags and trust indicators
- **Features**:
  - Subject hashtag display and interaction
  - Trust level indicators
  - Enhanced attachment viewing
  - Clickable hashtags for discovery

## Integration Steps

### Step 1: Update MessageView.tsx

Replace the current simple input in `MessageView.tsx` (lines 209-231) with the enhanced input:

```typescript
// Before (current simple input)
<div className="message-input">
  <input 
    type="text" 
    placeholder="Type a message..."
    value={inputValue}
    onChange={(e) => setInputValue(e.target.value)}
    onKeyPress={handleKeyPress}
  />
  <button onClick={handleSend}>Send</button>
</div>

// After (enhanced input)
import { EnhancedMessageInput } from './chat/EnhancedMessageInput';

<EnhancedMessageInput
  onSendMessage={handleEnhancedSend}
  onHashtagClick={handleHashtagClick}
  placeholder="Type a message..."
  disabled={isLoading}
  theme="dark"
/>
```

### Step 2: Update Message Rendering

Replace message rendering in `MessageView.tsx` (lines 94-204) with enhanced bubbles:

```typescript
// Before (current message display)
<div className="message">
  <div className="message-sender">{message.sender}</div>
  <div className="message-content">{message.text}</div>
  <div className="message-timestamp">{message.timestamp}</div>
</div>

// After (enhanced message bubble)
import { EnhancedMessageBubble } from './chat/EnhancedMessageBubble';

<EnhancedMessageBubble
  message={{
    ...message,
    subjects: extractSubjectsFromMessage(message.text),
    trustLevel: getTrustLevel(message.senderId),
    attachments: message.attachments
  }}
  onHashtagClick={handleHashtagClick}
  onAttachmentClick={handleAttachmentClick}
  onDownloadAttachment={handleDownloadAttachment}
  theme="dark"
/>
```

### Step 3: Add Bridge Methods

Extend `lama-bridge.ts` to support enhanced functionality:

```typescript
// Add to LamaAPI interface
interface LamaAPI {
  // ... existing methods
  
  // Enhanced functionality
  uploadMedia: (file: File, options: MediaUploadOptions) => Promise<UploadResult>
  extractSubjects: (content: string) => Promise<string[]>
  suggestHashtags: (context: { text: string; chatId?: string }) => Promise<string[]>
  setTrustLevel: (personId: string, level: number) => Promise<void>
  getTrustLevel: (personId: string) => Promise<number>
  searchByHashtag: (hashtag: string) => Promise<any[]>
}

// Implement in bridge
const api: LamaAPI = {
  // ... existing implementations
  
  uploadMedia: async (file, options) => {
    // Convert File to buffer and send to backend
    const buffer = await file.arrayBuffer();
    return await window.electronAPI.uploadMedia(buffer, file.name, options);
  },
  
  extractSubjects: async (content) => {
    // Extract hashtags from text content
    const hashtagRegex = /#[\w-]+/g;
    const hashtags = content.match(hashtagRegex) || [];
    return hashtags.map(tag => tag.slice(1)); // Remove #
  },
  
  suggestHashtags: async (context) => {
    // Simple context-based suggestions
    return await window.electronAPI.suggestHashtags(context);
  },
  
  setTrustLevel: async (personId, level) => {
    return await window.electronAPI.setTrustLevel(personId, level);
  },
  
  getTrustLevel: async (personId) => {
    return await window.electronAPI.getTrustLevel(personId) || 3; // Default colleague
  },
  
  searchByHashtag: async (hashtag) => {
    return await window.electronAPI.searchByHashtag(hashtag);
  }
};
```

### Step 4: Add Event Handlers

Add event handlers to MessageView.tsx:

```typescript
// Add to MessageView component
const [messages, setMessages] = useState<EnhancedMessageData[]>([]);

// Enhanced send handler
const handleEnhancedSend = async (text: string, attachments?: EnhancedAttachment[]) => {
  try {
    // Process attachments
    const processedAttachments = [];
    if (attachments) {
      for (const attachment of attachments) {
        const uploadResult = await lamaAPI.uploadMedia(attachment.file, {
          trustLevel: attachment.trustLevel,
          subjects: attachment.subjects
        });
        
        if (uploadResult.success) {
          processedAttachments.push({
            ...attachment,
            url: uploadResult.url,
            id: uploadResult.mediaId
          });
        }
      }
    }
    
    // Extract subjects from text
    const subjects = await lamaAPI.extractSubjects(text);
    
    // Send message with enhanced data
    const messageData = {
      text,
      subjects,
      attachments: processedAttachments,
      timestamp: new Date(),
      senderId: currentUserId,
      senderName: currentUserName,
      isOwn: true,
      trustLevel: 3
    };
    
    // Add to messages and send via existing logic
    setMessages(prev => [...prev, messageData]);
    await sendMessage(messageData);
    
  } catch (error) {
    console.error('Enhanced send failed:', error);
    alert('Failed to send message');
  }
};

// Hashtag click handler
const handleHashtagClick = async (hashtag: string) => {
  try {
    // Search for content with this hashtag
    const results = await lamaAPI.searchByHashtag(hashtag);
    
    // Show hashtag discovery results
    // Could open a modal or navigate to hashtag view
    console.log(`Found ${results.length} items for #${hashtag}`);
    
  } catch (error) {
    console.error('Hashtag search failed:', error);
  }
};

// Attachment handlers
const handleAttachmentClick = (attachmentId: string) => {
  // Open attachment in full screen viewer
  console.log('View attachment:', attachmentId);
};

const handleDownloadAttachment = async (attachmentId: string) => {
  try {
    // Trigger download
    await lamaAPI.downloadAttachment(attachmentId);
  } catch (error) {
    console.error('Download failed:', error);
    alert('Failed to download attachment');
  }
};
```

### Step 5: Add CSS Imports

Add CSS imports to MessageView.tsx or your main CSS file:

```css
/* Add to MessageView.css or main styles */
@import './chat/EnhancedMessageInput.css';
@import './chat/EnhancedMessageBubble.css';

/* Override existing message styles if needed */
.message-container {
  /* Adjust container to work with enhanced bubbles */
}
```

## Configuration Options

### Theme Support
Both components support light/dark themes:

```typescript
<EnhancedMessageInput theme="dark" />
<EnhancedMessageBubble theme="dark" />
```

### Hashtag Click Handling
Customize hashtag behavior:

```typescript
const handleHashtagClick = (hashtag: string) => {
  // Option 1: Search and filter messages
  filterMessagesByHashtag(hashtag);
  
  // Option 2: Open hashtag discovery
  openHashtagDiscovery(hashtag);
  
  // Option 3: Navigate to hashtag view
  navigate(`/hashtag/${hashtag}`);
};
```

### Trust Level Integration
Integrate with existing user management:

```typescript
const getTrustLevel = (userId: string): number => {
  // Get from existing user/contact system
  const contact = contacts.find(c => c.id === userId);
  return contact?.trustLevel || 3; // Default colleague
};
```

## Testing

### Manual Testing Steps
1. **Message Input**: 
   - Type "#" and verify hashtag suggestions appear
   - Upload files and verify Subject extraction
   - Send messages with hashtags and attachments

2. **Message Display**:
   - Verify hashtags are clickable
   - Check trust level indicators
   - Test attachment viewing/downloading

3. **File Upload**:
   - Test drag & drop functionality
   - Verify file type detection
   - Check attachment preview

### Unit Testing
```typescript
// Test hashtag extraction
test('extracts hashtags from message', () => {
  const text = "Check out this #photography #landscape shot!";
  const subjects = extractSubjects(text);
  expect(subjects).toEqual(['photography', 'landscape']);
});

// Test file upload
test('handles file upload', async () => {
  const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
  const result = await handleFileUpload(file);
  expect(result.subjects).toContain('photo');
});
```

## Backwards Compatibility

The enhanced components are designed to be drop-in replacements:

- **Existing message data**: Works with current message format
- **Existing send logic**: Enhanced send handler wraps existing logic
- **Existing styling**: Components inherit LAMA's dark theme
- **Gradual adoption**: Can integrate one component at a time

## Performance Considerations

- **File uploads**: Use Web Workers for large file processing
- **Hashtag suggestions**: Debounce input to avoid excessive API calls
- **Message rendering**: Virtualize message list for large conversations
- **Thumbnail generation**: Cache thumbnails to avoid regeneration

## Next Steps

1. **Integrate EnhancedMessageInput** first - immediate hashtag functionality
2. **Add EnhancedMessageBubble** - enhanced message display
3. **Extend bridge methods** - connect to backend services
4. **Add hashtag discovery** - search and filtering
5. **Implement trust management** - user trust level controls

This integration provides immediate value while maintaining compatibility with existing LAMA functionality.