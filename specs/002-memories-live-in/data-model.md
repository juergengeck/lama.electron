# Data Model: one.memory Module

## Module Overview
`one.memory` is a new ONE.core module that provides memory-specific data types and logic for organizing conversations into topics with persistent memories. It builds on ONE.core primitives (recipes, versioned objects) and integrates with ONE.models for synchronization.

## Module Architecture

### Module Location
```
@refinio/one.memory/
├── src/
│   ├── models/
│   │   ├── TopicModel.ts
│   │   ├── MemoryModel.ts
│   │   └── MemoryManager.ts
│   ├── recipes/
│   │   ├── Topic.ts
│   │   ├── Memory.ts
│   │   └── MemoryReference.ts
│   └── index.ts
```

## ONE.core Recipe Definitions

### Topic Recipe
```typescript
// @refinio/one.memory/src/recipes/Topic.ts
import { Recipe } from '@refinio/one.core';

export const TopicRecipe = new Recipe({
  $type: 'Topic',
  name: 'string',
  description: 'string?',
  createdAt: 'Date',
  lastModified: 'Date',
  isArchived: 'boolean',
  owner: 'Person',
  participants: 'Person[]',
  memoryRefs: 'Memory[]'  // References to Memory objects
});
```

### Memory Recipe
```typescript
// @refinio/one.memory/src/recipes/Memory.ts
import { Recipe } from '@refinio/one.core';

export const MemoryRecipe = new Recipe({
  $type: 'Memory',
  content: 'string',
  memoryType: 'string',  // conversation, fact, reference, note, summary
  timestamp: 'Date',
  importance: 'number',  // 0-1 relevance score
  tags: 'string[]',
  author: 'Person',
  topicRef: 'Topic',     // Back-reference to parent topic
  contextRef: 'SHA256?', // Optional conversation context
  references: 'MemoryReference[]'
});
```

### MemoryReference Recipe
```typescript
// @refinio/one.memory/src/recipes/MemoryReference.ts
import { Recipe } from '@refinio/one.core';

export const MemoryReferenceRecipe = new Recipe({
  $type: 'MemoryReference',
  sourceMemory: 'Memory',
  targetMemory: 'Memory',
  relationshipType: 'string', // related, contradicts, supports, extends, replaces
  createdAt: 'Date'
});
```

## Model Classes

### TopicModel
```typescript
// @refinio/one.memory/src/models/TopicModel.ts
import { Model } from '@refinio/one.models';

export class TopicModel extends Model {
  // Manages Topic objects
  // Handles topic CRUD operations
  // Integrates with ChannelManager for sync
  
  async createTopic(name: string, description?: string): Promise<Topic>
  async listTopics(includeArchived: boolean = false): Promise<Topic[]>
  async archiveTopic(topicId: SHA256): Promise<void>
  async restoreTopic(topicId: SHA256): Promise<void>
  async addMemoryToTopic(topicId: SHA256, memory: Memory): Promise<void>
}
```

### MemoryModel
```typescript
// @refinio/one.memory/src/models/MemoryModel.ts
import { Model } from '@refinio/one.models';

export class MemoryModel extends Model {
  // Manages Memory objects within topics
  // Handles memory versioning and search
  
  async createMemory(content: string, type: string, topicId: SHA256): Promise<Memory>
  async getMemoriesForTopic(topicId: SHA256, limit?: number): Promise<Memory[]>
  async searchMemories(topicId: SHA256, query: string): Promise<Memory[]>
  async updateMemory(memoryId: SHA256, updates: Partial<Memory>): Promise<Memory>
  async createReference(sourceId: SHA256, targetId: SHA256, type: string): Promise<MemoryReference>
}
```

### MemoryManager
```typescript
// @refinio/one.memory/src/models/MemoryManager.ts
import { TopicModel } from './TopicModel';
import { MemoryModel } from './MemoryModel';

export class MemoryManager {
  // Orchestrates TopicModel and MemoryModel
  // Handles cross-topic operations
  // Manages memory lifecycle
  
  constructor(
    private topicModel: TopicModel,
    private memoryModel: MemoryModel,
    private channelManager: ChannelManager,
    private connectionsModel: ConnectionsModel
  )
  
  async init(): Promise<void>
  async shutdown(): Promise<void>
  
  // High-level operations
  async importConversation(messages: Message[], topicId: SHA256): Promise<Memory[]>
  async exportTopic(topicId: SHA256): Promise<ExportData>
  async syncWithPeers(): Promise<void>
}
```

## Integration with Existing ONE.core/ONE.models

### Storage Layer
- Uses ONE.core's content-addressed storage (SHA256)
- Leverages versioned objects for memory history
- Integrates with existing file system storage

### Synchronization
- Topics sync through ChannelManager
- Memories sync via CHUM protocol
- CommServer handles peer discovery and relay

### Identity & Access
- Uses existing Person/Profile/Someone models
- Inherits access control from ChannelManager
- Respects existing trust relationships

## CommServer Communication Fix

### Current Issues
- Hardcoded CommServer URLs in multiple locations
- Inconsistent error handling for connection failures
- No centralized connection state management

### Solution in one.memory
```typescript
// Centralized CommServer configuration
export class MemoryManager {
  private commServerConfig = {
    url: process.env.COMM_SERVER_URL || 'wss://comm10.dev.refinio.one',
    reconnectInterval: 30000,
    keepaliveInterval: 60000,
    maxRetries: 5
  };
  
  // Unified connection state tracking
  private connectionState = {
    connected: false,
    lastPing: null,
    reconnectCount: 0,
    lastError: null
  };
  
  // Proper error handling and recovery
  private handleCommServerError(error: Error): void {
    this.connectionState.lastError = error;
    this.connectionState.connected = false;
    
    if (error.message.includes('decryption')) {
      // Protocol error, not connection error
      this.handleProtocolError(error);
    } else if (error.message.includes('timeout')) {
      // Connection timeout, attempt reconnect
      this.scheduleReconnect();
    }
  }
}
```

## Data Constraints

### Storage Limits
- Max 1000 topics per user
- Max 10KB per memory content
- Max 100 tags per memory

### Performance Targets
- Topic operations: <50ms
- Memory queries: <100ms
- Sync operations: <500ms

## Module Export

```typescript
// @refinio/one.memory/src/index.ts
export { TopicModel } from './models/TopicModel';
export { MemoryModel } from './models/MemoryModel';
export { MemoryManager } from './models/MemoryManager';
export { TopicRecipe } from './recipes/Topic';
export { MemoryRecipe } from './recipes/Memory';
export { MemoryReferenceRecipe } from './recipes/MemoryReference';
```