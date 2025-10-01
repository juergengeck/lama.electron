# IPC Contracts: TypeScript Migration

**Feature**: Complete TypeScript Migration
**Phase**: 1 - Design
**Date**: 2025-10-01

## Overview

This document defines the IPC contracts that **MUST remain unchanged** during the TypeScript migration. These contracts are the interface between the browser renderer process and the Node.js main process.

## Contract Stability Guarantee

**CRITICAL**: All IPC handlers must maintain:
1. **Exact same channel names** (e.g., 'onecore:getContacts')
2. **Exact same parameter types** (structure and fields)
3. **Exact same return types** (structure and fields)
4. **Exact same error handling** (error types and messages)

**Migration Rule**: TypeScript conversion is **internal implementation only** - IPC contracts are external API and cannot change.

## IPC Handler Contract Format

```typescript
interface IPCContract {
  channel: string              // IPC channel name
  handler: string              // Handler function name
  params: object               // Parameter types
  returns: object | void       // Return type
  throws?: string[]            // Possible error types
}
```

## Core Contracts (onecore namespace)

### onecore:initializeNode
```typescript
{
  channel: "onecore:initializeNode",
  handler: "initializeNode",
  params: {
    email: string
    password: string
  },
  returns: {
    success: boolean
    instanceId?: string
  },
  throws: ["InitializationError"]
}
```

### onecore:getContacts
```typescript
{
  channel: "onecore:getContacts",
  handler: "getContacts",
  params: {},
  returns: {
    contacts: Contact[]
  }
}

interface Contact {
  personId: string
  name: string
  email?: string
  isAIAssistant: boolean
  status?: 'online' | 'offline' | 'away'
}
```

### onecore:createConversation
```typescript
{
  channel: "onecore:createConversation",
  handler: "createConversation",
  params: {
    participantIds: string[]
    topicName?: string
  },
  returns: {
    topicId: string
    channelId: string
  },
  throws: ["ConversationCreationError"]
}
```

### onecore:getConversations
```typescript
{
  channel: "onecore:getConversations",
  handler: "getConversations",
  params: {},
  returns: {
    conversations: Conversation[]
  }
}

interface Conversation {
  topicId: string
  name: string
  participants: string[]
  lastMessage?: {
    content: string
    timestamp: number
    author: string
  }
  unreadCount?: number
}
```

### onecore:getMessages
```typescript
{
  channel: "onecore:getMessages",
  handler: "getMessages",
  params: {
    topicId: string
    limit?: number
    offset?: number
  },
  returns: {
    messages: MessageData[]
  }
}

interface MessageData {
  id: string
  content: string
  author: string
  authorName: string
  timestamp: number
  topicId: string
  isOwn: boolean
}
```

### onecore:sendMessage
```typescript
{
  channel: "onecore:sendMessage",
  handler: "sendMessage",
  params: {
    topicId: string
    content: string
    replyToId?: string
  },
  returns: {
    messageId: string
    timestamp: number
  },
  throws: ["SendMessageError"]
}
```

## Topic Analysis Contracts (topicAnalysis namespace)

### topicAnalysis:analyzeMessages
```typescript
{
  channel: "topicAnalysis:analyzeMessages",
  handler: "analyzeMessages",
  params: {
    topicId: string
    messageIds?: string[]
  },
  returns: {
    subjects: Subject[]
    keywords: Keyword[]
  }
}
```

### topicAnalysis:getSummary
```typescript
{
  channel: "topicAnalysis:getSummary",
  handler: "getSummary",
  params: {
    topicId: string
    version?: number
  },
  returns: {
    summary: Summary | null
  }
}
```

### topicAnalysis:getSubjects
```typescript
{
  channel: "topicAnalysis:getSubjects",
  handler: "getSubjects",
  params: {
    topicId: string
  },
  returns: {
    subjects: Subject[]
  }
}
```

## Export Contracts (export namespace)

### export:htmlWithMicrodata
```typescript
{
  channel: "export:htmlWithMicrodata",
  handler: "htmlWithMicrodata",
  params: {
    topicId: string
    format: 'html'
    options?: {
      includeSignatures?: boolean
      maxMessages?: number
    }
  },
  returns: {
    html: string
    metadata: {
      topicName: string
      participantCount: number
      messageCount: number
      exportedAt: number
    }
  }
}
```

## LLM Contracts (llm namespace)

### llm:chat
```typescript
{
  channel: "llm:chat",
  handler: "chat",
  params: {
    messages: Array<{
      role: 'user' | 'assistant' | 'system'
      content: string
    }>
    stream?: boolean
  },
  returns: {
    response: string
    tokens?: number
  }
}
```

### llm:streamChat
```typescript
{
  channel: "llm:streamChat",
  handler: "streamChat",
  params: {
    messages: Array<{
      role: 'user' | 'assistant' | 'system'
      content: string
    }>
  },
  returns: "streaming" // Uses event emitter pattern
}
```

## Federation Contracts (federation namespace)

### federation:pair
```typescript
{
  channel: "federation:pair",
  handler: "pair",
  params: {
    pairingCode?: string
    generateCode?: boolean
  },
  returns: {
    pairingCode?: string
    success: boolean
  }
}
```

### federation:getConnectionStatus
```typescript
{
  channel: "federation:getConnectionStatus",
  handler: "getConnectionStatus",
  params: {
    personId: string
  },
  returns: {
    status: 'connected' | 'disconnected' | 'syncing'
    lastSyncTime?: number
  }
}
```

## Contract Verification

### Verification Process

**After each directory migration**:
1. Build project: `npm run build:main`
2. Launch app: `npm run electron`
3. Test each IPC handler via UI
4. Check browser console for IPC errors

**Automated Contract Testing** (future):
```typescript
// Example contract test (not implemented yet)
describe('IPC Contracts', () => {
  test('onecore:getContacts returns Contact[]', async () => {
    const result = await ipcRenderer.invoke('onecore:getContacts')
    expect(result.contacts).toBeArray()
    expect(result.contacts[0]).toHaveProperty('personId')
    expect(result.contacts[0]).toHaveProperty('name')
  })
})
```

### Breaking Change Detection

**Signs of broken contracts**:
- UI shows "handler not found" errors
- TypeError on IPC response handling
- Missing fields in returned data
- Incorrect field types

**If contract breaks**:
1. STOP migration immediately
2. Revert last changes
3. Identify what changed
4. Fix to restore exact contract
5. Verify fix before continuing

## Migration Implementation Notes

### Preserving CommonJS vs ESM

**Some handlers use CommonJS**:
```javascript
// JavaScript (CommonJS)
module.exports = {
  getContacts: async () => { ... }
}
```

**TypeScript options**:
```typescript
// Option 1: Convert to ESM (preferred)
export async function getContacts() { ... }

// Option 2: Keep CommonJS (if needed)
export = {
  getContacts: async () => { ... }
}
```

**Rule**: Choose pattern that maintains contract stability. Test after conversion.

### Type Annotations

**Handler function signatures**:
```typescript
// Before (JavaScript)
async function getContacts() {
  return { contacts: [...] }
}

// After (TypeScript) - loose types OK during migration
async function getContacts(): Promise<any> {
  return { contacts: [...] }
}

// Future improvement (post-migration)
async function getContacts(): Promise<{ contacts: Contact[] }> {
  return { contacts: [...] }
}
```

**Rule**: Use `any` or loose types during migration, improve types later.

## Contract Evolution (Post-Migration)

**After migration is complete**, contracts can evolve following these rules:

**Backward Compatible Changes** (allowed):
- Add optional parameters
- Add optional return fields
- Add new IPC handlers

**Breaking Changes** (require version bump):
- Remove parameters
- Remove return fields
- Change field types
- Rename handlers

**Migration Process for Breaking Changes**:
1. Create new handler with v2 suffix
2. Keep old handler for compatibility
3. Update UI to use new handler
4. Deprecate old handler
5. Remove old handler in next major version

---

**IPC Contracts Documented**: Migration must preserve all contracts exactly as defined
