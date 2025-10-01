# Data Model: TypeScript Migration

**Feature**: Complete TypeScript Migration
**Phase**: 1 - Design
**Date**: 2025-10-01

## Overview

This document describes the data models used in LAMA Electron. **No new data models are introduced** by this migration - this is purely a technical migration from JavaScript to TypeScript.

## Existing Data Models

The LAMA Electron application uses ONE.core's object model throughout. All data is stored as versioned objects with cryptographic hashes.

### ONE.core Object Model

**Core Concepts**:
- **Objects**: Immutable versioned data structures
- **Hashes**: SHA-256 content-addressed identifiers
- **Recipes**: Schema definitions for object types
- **References**: Cryptographic links between objects

**Key Object Types Used**:

#### Person
```typescript
interface Person {
  $type$: 'Person'
  name: string
  email?: Email
  chatAccounts?: ChatAccount[]
  publicKey?: CryptoKey
}
```

#### Topic (Conversation)
```typescript
interface Topic {
  $type$: 'Topic'
  id: string
  name?: string
  participants: SHA256Hash<Person>[]
  channelId: string
}
```

#### Message
```typescript
interface Message {
  $type$: 'Message'
  content: string
  author: SHA256Hash<Person>
  timestamp: number
  topic: SHA256Hash<Topic>
  replyTo?: SHA256Hash<Message>
}
```

#### ChannelInfo
```typescript
interface ChannelInfo {
  $type$: 'ChannelInfo'
  id: string
  owner?: SHA256Hash<Person>
  topic?: SHA256Hash<Topic>
  createdAt: number
}
```

#### Group
```typescript
interface Group {
  $type$: 'Group'
  name: string
  members: SHA256Hash<Person>[]
  owner?: SHA256Hash<Person>
}
```

### IPC Data Contracts

**IPC handlers exchange plain JavaScript objects** (not ONE.core objects directly):

#### Contact (IPC)
```typescript
interface Contact {
  personId: string           // SHA256Hash as string
  name: string
  email?: string
  isAIAssistant: boolean
  status?: 'online' | 'offline' | 'away'
}
```

#### Conversation (IPC)
```typescript
interface Conversation {
  topicId: string            // Topic ID (may not be hash)
  name: string
  participants: string[]     // Person hashes as strings
  lastMessage?: {
    content: string
    timestamp: number
    author: string
  }
  unreadCount?: number
}
```

#### MessageData (IPC)
```typescript
interface MessageData {
  id: string                 // Message hash as string
  content: string
  author: string             // Person hash as string
  authorName: string
  timestamp: number
  topicId: string
  isOwn: boolean
}
```

### AI-Specific Models (one.ai package)

**Subject**:
```typescript
interface Subject {
  $type$: 'Subject'
  topicId: string
  keywords: string[]         // Combination defines subject
  description?: string
  createdAt: number
  messageCount: number
}
```

**Keyword**:
```typescript
interface Keyword {
  $type$: 'Keyword'
  term: string
  topicId: string
  firstSeen: number
  lastSeen: number
  frequency: number
}
```

**Summary**:
```typescript
interface Summary {
  $type$: 'Summary'
  topicId: string
  version: number
  content: string            // AI-generated summary
  subjects: SHA256Hash<Subject>[]
  createdAt: number
}
```

## Type Migration Strategy

### No Schema Changes

**Important**: This migration does NOT change any schemas or data structures. All objects remain compatible.

**What stays the same**:
- ONE.core object types (Person, Topic, Message, etc.)
- IPC message formats
- Database storage format
- Network protocol (CHUM)

**What changes**:
- File extensions (.js → .ts)
- Type annotations in code
- Import/export syntax (CommonJS → ESM where appropriate)

### Type Annotation Approach

**Minimal Types Initially**:
```typescript
// During migration, use loose types
function getContact(personId: any): any {
  // Implementation unchanged
}
```

**Future Type Improvements** (post-migration):
```typescript
// Can improve types incrementally later
function getContact(personId: SHA256Hash<Person>): Contact | null {
  // Implementation unchanged
}
```

### Branded Types (Existing Pattern)

LAMA uses branded types for hashes:

```typescript
// Existing type definition (in @OneCoreTypes.d.ts)
type SHA256Hash<T = unknown> = string & { __type: 'SHA256Hash<T>' }
type SHA256IdHash<T = unknown> = string & { __type: 'SHA256IdHash<T>' }
```

**Migration preserves these patterns** - no changes to branded types.

## Storage Model

### File System Storage (Node.js)

**ONE.core Storage** (managed by @refinio/one.core):
- Location: `OneDB/` directory
- Format: Binary object storage
- Index: SQLite database for queries

**Configuration Storage**:
- Location: `OneDB/config/` directory
- Format: JSON files
- Contains: User settings, LLM configurations

**No changes to storage** during migration.

### In-Memory State

**Cache structures** (existing patterns):
```typescript
// Contact cache (in node-one-core.js)
const contactCache: Map<string, any> = new Map()

// Topic cache
const topicCache: Map<string, any> = new Map()

// Channel cache
const channelCache: Map<string, any> = new Map()
```

**Migration preserves cache patterns** - types can be improved later.

## Validation Rules

**Existing validation preserved**:
- Email format validation (if present)
- Person name required
- Topic must have at least one participant
- Message content cannot be empty
- Channel ID format requirements

**No new validation added** during migration.

## State Transitions

**Conversation lifecycle** (unchanged):
```
[Created] → [Active] → [Archived]
```

**Message lifecycle** (unchanged):
```
[Pending] → [Sent] → [Delivered] → [Read]
```

**Connection lifecycle** (unchanged):
```
[Disconnected] → [Connecting] → [Connected] → [Syncing] → [Synced]
```

**Migration does not affect state transitions**.

## Relationships

**Data relationships** (unchanged):

```
Person 1 ─────── * Topic
  ↓                  ↓
  1                  1
  |                  |
  * ←─────────────── *
     Message
```

**Group relationships** (unchanged):
```
Group 1 ─────── * Person
  ↓
  1
  |
  *
Topic
```

**ONE.core manages relationships** via hash references - migration does not change this.

## Migration Impact

**Data Safety**:
- ✓ No data model changes
- ✓ No schema changes
- ✓ No database migrations needed
- ✓ No data loss risk
- ✓ Existing data remains valid

**Type Safety Improvements**:
- Better IDE autocomplete
- Compile-time error detection
- Easier refactoring in future
- Self-documenting code

**No Breaking Changes**:
- IPC contracts unchanged
- ONE.core API usage unchanged
- Storage format unchanged
- Network protocol unchanged

---

**Data Model Documentation Complete**: Ready for contract definition
