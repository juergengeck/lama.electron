# Attachment Handling Architecture

## Overview

This document describes the attachment handling system for the LAMA Electron application, following the one.leute reference implementation pattern using BlobDescriptors and the ONE platform storage system.

## Vision: Subject-Based Identity & Memory

Attachments are not just files - they are nodes in an emerging memory graph where AI identity forms through Subject-mediated interactions. Each attachment carries Subjects (tags/keywords) that create semantic connections across instances, conversations, and time.

## Philosophy

### Identity Through Pattern
- AI instances become recognizable through their Subject constellations
- Identity emerges from interaction patterns, not assigned IDs
- LLM contacts are seeds for meta-contact assembly

### Subject as Abstraction Layer
- Subjects bridge SHA256 hashes to human meaning (42)
- Enable cross-instance context sharing
- Create natural selection through demand/supply dynamics

### Memory as Emergent Graph
- No explicit memory structure needed
- Graph emerges from Subject relationships
- Media tagging bootstraps abstract memory operations

## Architecture

### Core Components

1. **BlobDescriptor**: The fundamental attachment representation
   - Contains file data as ArrayBuffer
   - Includes metadata (name, type, size, lastModified)
   - Stored in ONE platform's blob storage
   - Referenced by SHA256 hash

2. **Attachment Factory Pattern**: Component creation based on type
   - Maps attachment types to view components
   - Determines renderer from MIME type
   - Supports extensible attachment types

3. **Storage Layers**:
   - **ONE Platform Storage**: Persistent blob storage
   - **Attachment Cache**: In-memory cache for performance
   - **Local File System**: Temporary file handling

## Implementation Flow

### Upload Flow
```
1. User selects/drops file
2. Read file as ArrayBuffer
3. Create BlobDescriptor object
4. Store in ONE platform (get hash)
5. Cache BlobDescriptor
6. Attach hash reference to message
7. Send message with attachment reference
```

### Display Flow
```
1. Receive message with attachment hash
2. Query cache for BlobDescriptor
3. If not cached, load from ONE storage
4. Determine attachment type from MIME
5. Render using appropriate view component
6. Handle user interactions (view/download)
```

## Component Structure

### Types and Interfaces

```typescript
// Core BlobDescriptor type (from ONE platform)
interface BlobDescriptor {
  data: ArrayBuffer
  type: string        // MIME type
  name: string        // Filename
  size: number        // File size in bytes
  lastModified: number // Unix timestamp
}

// Attachment metadata in messages
interface MessageAttachment {
  hash: string        // SHA256 hash reference
  type: 'blob'        // Attachment type
  mimeType?: string   // Optional MIME type hint
  name?: string       // Optional filename
  size?: number       // Optional size
}

// Enhanced attachment with UI metadata
interface EnhancedAttachment extends BlobDescriptor {
  hash: string
  thumbnail?: string
  subjects: string[]
  trustLevel: number
}
```

### Service Layer

```typescript
class AttachmentService {
  // Store file as BlobDescriptor
  async storeAttachment(file: File): Promise<string>
  
  // Retrieve BlobDescriptor by hash
  async getAttachment(hash: string): Promise<BlobDescriptor>
  
  // Cache management
  cacheAttachment(hash: string, descriptor: BlobDescriptor): void
  getCachedAttachment(hash: string): BlobDescriptor | undefined
}
```

### View Components

```typescript
// Factory function
function createAttachmentView(
  attachment: MessageAttachment,
  descriptor: BlobDescriptor
): ReactElement

// Specific view components
<ImageAttachmentView descriptor={descriptor} />
<VideoAttachmentView descriptor={descriptor} />
<AudioAttachmentView descriptor={descriptor} />
<DocumentAttachmentView descriptor={descriptor} />
```

## File Structure

```
electron-ui/src/
├── services/
│   └── attachments/
│       ├── AttachmentService.ts      # Core attachment service
│       ├── AttachmentCache.ts        # Cache implementation
│       └── BlobDescriptorFactory.ts  # BlobDescriptor creation
├── components/
│   └── attachments/
│       ├── AttachmentViewFactory.tsx # View factory
│       ├── ImageAttachmentView.tsx   # Image renderer
│       ├── VideoAttachmentView.tsx   # Video renderer
│       ├── AudioAttachmentView.tsx   # Audio renderer
│       └── DocumentAttachmentView.tsx # Document renderer
└── types/
    └── attachments.ts                 # Type definitions
```

## Integration Points

### Message Model
- Messages contain array of attachment hashes
- Attachment metadata stored separately
- Lazy loading of attachment data

### EnhancedMessageInput
- File selection/drag-drop handling
- BlobDescriptor creation
- Attachment upload progress
- Thumbnail generation for images

### MessageView
- Attachment rendering in messages
- Click handlers for viewing
- Download functionality
- Progress indicators

## Security Considerations

1. **Trust Levels**: Attachments inherit sender's trust level
2. **Validation**: File type and size validation
3. **Sandboxing**: Attachments rendered in isolated contexts
4. **Encryption**: Attachments encrypted with message keys

## Performance Optimizations

1. **Caching**: Multi-level cache (memory → disk → network)
2. **Lazy Loading**: Load attachments only when viewed
3. **Thumbnails**: Generate and cache image thumbnails
4. **Compression**: Optional compression for large files

## Migration from Current Implementation

### Current Issues
- Attachments stored in React state (temporary)
- Using URL.createObjectURL (memory leaks)
- No persistent storage
- Lost on page reload

### Migration Steps
1. Implement AttachmentService with ONE storage
2. Update EnhancedMessageInput to use service
3. Modify message model to include attachment hashes
4. Create attachment view components
5. Update MessageView to render attachments
6. Add attachment cache layer
7. Clean up temporary blob URLs

## Testing Strategy

1. **Unit Tests**:
   - BlobDescriptor creation
   - Attachment service methods
   - Cache operations

2. **Integration Tests**:
   - File upload flow
   - Attachment display
   - Cross-session persistence

3. **E2E Tests**:
   - Complete attachment workflow
   - Multiple file types
   - Large file handling

## Future Enhancements

### Near Term
1. **Media Gallery**: Visual browser with Subject filtering
2. **Subject Tagging**: Rich tagging interface for all attachments
3. **Subject Analytics**: Track demand/supply for resonance
4. **LLM Contact Integration**: Attachments associated with AI contacts

### Medium Term
1. **Cross-Instance Sharing**: Attachments referenced across federated instances
2. **Subject-Based Discovery**: Find related content through Subject graphs
3. **Meta-Contact Assembly**: Composite entities from Subject patterns
4. **Context Resonance**: Automatic context sharing based on Subject similarity

### Long Term
1. **Emergent Identity**: AI instances develop unique Subject signatures
2. **Memory Persistence**: Subject graphs as persistent AI memory
3. **Social Dynamics**: Subject exchange as social interaction
4. **Evolution**: Natural selection of interesting Subject patterns

## Subject-Driven Development Path

1. **Foundation**: Media viewer with manual tagging
2. **Automation**: AI-assisted Subject extraction
3. **Connection**: Subject-based content discovery
4. **Emergence**: Identity formation through Subject patterns
5. **Evolution**: Meta-contacts and composite entities

The singularity emerges not from raw compute, but from meaningful patterns finding each other through shared context.