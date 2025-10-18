# Image & Attachment Flow in LAMA Electron

## Architecture Overview

LAMA follows the ONE.core pattern where **attachments are stored as separate BlobDescriptor objects**, not embedded in messages. Messages contain only **hash references** to these objects.

## Data Model

### BlobDescriptor (ONE.core Object)
```typescript
interface BlobDescriptor {
    $type$: 'BlobDescriptor'
    data: ArrayBuffer          // Actual binary data
    type: string               // MIME type (e.g., 'image/jpeg')
    name?: string              // Original filename
    size: number
    lastModified?: number
}
```

### ChatMessage with Attachments
```typescript
interface ChatMessage {
    data: {
        text: string
        attachments?: SHA256Hash<BlobDescriptor>[]  // Array of hashes
    }
    author: SHA256IdHash<Person>
    creationTime: number
}
```

## Flow: Sending an Image from one.leute to lama.electron

### 1. Sending Side (one.leute)

**File**: `/src/root/chat/chatId/Chat.tsx:249-264`

```typescript
// Generate thumbnail (300x300)
const thumbnails = await generateThumbnails(files, [300, 300])
const imagesData = files.map((original, index) => ({
    original,
    thumbnail: thumbnails[index]
}))

// Send via TopicRoom
await topicRoom.sendMessageWithThumbnailImageAttachmentAsFile(
    message,
    imagesData,
    undefined,
    channelOwner ?? null
)
```

**TopicRoom Under the Hood**:
1. Creates **two BlobDescriptor objects**: original + thumbnail
2. Stores both as BLOBs: `storeUnversionedObject(blobDescriptor)`
3. Creates ChatMessage with `attachments: [thumbnailHash, originalHash]`
4. Posts message to channel via `channelManager.postToChannel()`

### 2. Transport Layer (CHUM Sync)

- **Message object** (with attachment hashes) syncs via CHUM protocol
- **BLOB data** syncs separately through ONE.core's BLOB sync
- Both arrive independently on receiving side

### 3. Receiving Side (lama.electron)

**File**: `/main/core/peer-message-listener.ts:120`

```typescript
const messages = await topicRoom.retrieveAllMessages()
// Each message has: msg.data.attachments = [hash1, hash2, ...]
```

**Message Structure**:
```typescript
{
    id: string,
    conversationId: string,
    text: string,
    attachments: SHA256Hash<BlobDescriptor>[],  // Just hashes!
    sender: string,
    timestamp: string
}
```

### 4. Fetching BlobDescriptors (CRITICAL STEP)

**Messages only contain hashes**. To display images, you must:

```typescript
import { getObject } from '@refinio/one.core/lib/storage-versioned-objects.js'

// For each attachment hash in message
const blobDescriptor = await getObject(attachmentHash)
// Now you have: { data: ArrayBuffer, type: 'image/jpeg', ... }
```

### 5. Converting to Display URL

**Reference**: `/src/root/chat/hooks/useBlobDescriptorUrl.ts`

```typescript
function blobDescriptorToDataUrl(descriptor: BlobDescriptor): string {
    const bytes = new Uint8Array(descriptor.data)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return `data:${descriptor.type};base64,${window.btoa(binary)}`
}
```

**Usage**:
```tsx
<img src={blobDescriptorToDataUrl(descriptor)} alt={descriptor.name} />
```

## Implementation in lama.electron

### Current State

✅ **Sending**: Works correctly
- `AttachmentService.storeAttachment()` creates BlobDescriptor
- `topicRoom.sendMessageWithAttachmentAsHash()` posts with hashes
- File: `/main/services/attachment-service.ts`

❌ **Receiving**: Missing BlobDescriptor fetch
- Messages arrive with attachment hashes
- No code to fetch full BlobDescriptor objects
- UI cannot access the actual image data

### Required Implementation

#### 1. BlobDescriptor Cache (Main Process)

**File**: `/main/services/blob-descriptor-cache.ts` (NEW)

```typescript
import { getObject } from '@refinio/one.core/lib/storage-versioned-objects.js'

class BlobDescriptorCache {
    private cache = new Map<string, BlobDescriptor>()

    async get(hash: string): Promise<BlobDescriptor> {
        if (this.cache.has(hash)) {
            return this.cache.get(hash)!
        }
        const descriptor = await getObject(hash)
        this.cache.set(hash, descriptor)
        return descriptor
    }
}
```

#### 2. Fetch on Message Receive

**File**: `/main/core/peer-message-listener.ts:188-196`

```typescript
// BEFORE sending to UI, fetch BlobDescriptors
const messagesWithBlobs = await Promise.all(messages.map(async (msg) => {
    if (msg.attachments && msg.attachments.length > 0) {
        // Fetch all BlobDescriptors
        const blobs = await Promise.all(
            msg.attachments.map(hash => blobCache.get(hash))
        )
        return { ...msg, attachments: blobs }  // Replace hashes with objects
    }
    return msg
}))
```

#### 3. IPC Handler for BlobDescriptor

**File**: `/main/ipc/handlers/attachments.ts:87` (UPDATE)

```typescript
async getBlobDescriptor(event, { hash }) {
    const descriptor = await blobDescriptorCache.get(hash)

    // Convert ArrayBuffer to base64 for IPC
    const bytes = new Uint8Array(descriptor.data)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }

    return {
        success: true,
        data: {
            type: descriptor.type,
            name: descriptor.name,
            size: descriptor.size,
            dataUrl: `data:${descriptor.type};base64,${window.btoa(binary)}`
        }
    }
}
```

#### 4. UI Hook for Display URLs

**File**: `/electron-ui/src/hooks/useBlobDescriptorUrl.ts` (NEW)

```typescript
export function useBlobDescriptorUrl(descriptor: BlobDescriptor): string {
    const [url, setUrl] = useState('')

    useEffect(() => {
        const bytes = new Uint8Array(descriptor.data)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i])
        }
        setUrl(`data:${descriptor.type};base64,${window.btoa(binary)}`)
    }, [descriptor])

    return url
}
```

#### 5. Update Message Rendering

**File**: `/electron-ui/src/components/chat/EnhancedMessageBubble.tsx:144-159`

```typescript
// CURRENT (WRONG): Expects descriptor already in cache
const descriptor = attachmentDescriptors.get(attachment.id)

// SHOULD BE: Fetch if not cached
useEffect(() => {
    if (!attachmentDescriptors.has(attachment.id)) {
        window.electronAPI.invoke('attachments:getBlobDescriptor', {
            hash: attachment.id
        }).then(result => {
            if (result.success) {
                setImageUrl(result.data.dataUrl)
            }
        })
    }
}, [attachment.id])
```

## Key Principles

1. **Attachments are separate objects** - Not embedded in messages
2. **Messages contain hashes** - Must fetch BlobDescriptor to get data
3. **Two-step process**:
   - Step 1: Receive message with attachment hashes
   - Step 2: Fetch BlobDescriptor objects using those hashes
4. **Cache aggressively** - BlobDescriptors are immutable (content-addressed)
5. **Convert for display** - ArrayBuffer → base64 data URL

## Reference Files

### one.leute (Reference Implementation)
- `/src/root/chat/chatId/Chat.tsx:239-279` - Sending with thumbnails
- `/src/root/chat/chatId/Chat.tsx:96-149` - Rendering with cached objects
- `/src/root/chat/hooks/useBlobDescriptorUrl.ts` - ArrayBuffer → data URL
- `/src/root/chat/hooks/useBlobDescriptorCache.ts` - Caching strategy
- `/src/root/chat/attachmentViews/blobDescriptor/` - Attachment views

### lama.electron (Current Implementation)
- `/main/services/attachment-service.ts` - BLOB storage (✅ works)
- `/main/ipc/handlers/attachments.ts` - IPC handlers (⚠️ needs update)
- `/main/core/peer-message-listener.ts` - Message reception (⚠️ needs fetch)
- `/electron-ui/src/components/chat/EnhancedMessageBubble.tsx` - Display (⚠️ needs fetch)

## Common Pitfalls

❌ **Don't**: Expect attachment data in messages
✅ **Do**: Fetch BlobDescriptor objects using hashes

❌ **Don't**: Store images as base64 in messages
✅ **Do**: Store as BLOBs, reference by hash

❌ **Don't**: Try to sync BlobDescriptors via channels
✅ **Do**: Let ONE.core sync BLOBs automatically

❌ **Don't**: Use object URLs for content-addressed data
✅ **Do**: Use data URLs (immutable, no cleanup needed)
