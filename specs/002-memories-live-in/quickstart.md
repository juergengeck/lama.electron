# Quickstart: Topic-Based Memory System

## Overview
This quickstart demonstrates the topic-based memory system with CommServer communication fixes. It shows how to create topics, add memories, and verify synchronization.

## Prerequisites
- LAMA Electron running with Node.js ONE.core instance
- User authenticated (logged in via browser UI)
- CommServer connection established

## Quick Test Scenarios

### 1. Initialize Memory System
```javascript
// In Node.js process - automatically done on startup
const { MemoryManager } = require('@refinio/one.memory');
const memoryManager = new MemoryManager(
  topicModel, 
  memoryModel, 
  channelManager, 
  connectionsModel
);
await memoryManager.init();
```

### 2. Create Your First Topic
```javascript
// Via IPC from browser
const result = await window.electronAPI.invoke('memory:createTopic', {
  name: 'Project Ideas',
  description: 'Collection of project brainstorming sessions'
});

// Expected result:
{
  success: true,
  topic: {
    idHash: 'abc123...',
    name: 'Project Ideas',
    createdAt: '2025-09-11T...'
  }
}
```

### 3. Add Memories to Topic
```javascript
// Add a conversation memory
const memory = await window.electronAPI.invoke('memory:addMemory', {
  topicId: 'abc123...',
  content: 'Discussed implementing federated AI memory system',
  memoryType: 'conversation',
  tags: ['ai', 'federation', 'architecture'],
  importance: 0.8
});

// Add a fact memory
const fact = await window.electronAPI.invoke('memory:addMemory', {
  topicId: 'abc123...',
  content: 'CommServer URL: wss://comm10.dev.refinio.one',
  memoryType: 'fact',
  tags: ['config', 'commserver'],
  importance: 1.0
});
```

### 4. Search Memories
```javascript
// Search within topic
const results = await window.electronAPI.invoke('memory:searchMemories', {
  topicId: 'abc123...',
  query: 'federation'
});

// Expected: Returns memories containing 'federation'
```

### 5. Verify CommServer Sync
```javascript
// Check sync status
const status = await window.electronAPI.invoke('memory:syncStatus');

// Expected result:
{
  success: true,
  status: {
    syncing: false,
    lastSync: '2025-09-11T...',
    pendingChanges: 0,
    connectedPeers: 2,
    commServerConnected: true
  }
}
```

## Test Scenarios

### Scenario 1: Topic Creation and Memory Storage
1. **Given**: User is authenticated and connected
2. **When**: User creates topic "Daily Notes"
3. **Then**: Topic appears in topic list
4. **When**: User adds 5 memories to the topic
5. **Then**: All memories are retrievable and searchable

### Scenario 2: Memory Synchronization
1. **Given**: Two LAMA instances connected via CommServer
2. **When**: Instance A creates topic with memories
3. **Then**: Instance B receives topic and memories via CHUM sync
4. **When**: Instance B adds new memory
5. **Then**: Instance A receives the new memory

### Scenario 3: CommServer Reconnection
1. **Given**: Active topic with memories
2. **When**: CommServer connection drops
3. **Then**: System shows disconnected status
4. **When**: Connection restored
5. **Then**: Pending changes sync automatically

### Scenario 4: Cross-Topic References
1. **Given**: Two topics with memories
2. **When**: Create reference between memories
3. **Then**: Reference is read-only in target topic
4. **When**: Query references
5. **Then**: Shows relationship type correctly

## Validation Steps

### Step 1: Module Installation
```bash
# Verify one.memory module exists
ls node_modules/@refinio/one.memory

# Check module exports
node -e "const m = require('@refinio/one.memory'); console.log(Object.keys(m))"
# Expected: ['TopicModel', 'MemoryModel', 'MemoryManager', ...]
```

### Step 2: IPC Handler Registration
```javascript
// In main process
const handlers = ipcMain.listenerCount('memory:createTopic');
console.log('Memory handlers registered:', handlers > 0);
// Expected: true
```

### Step 3: CommServer Configuration
```javascript
// Check centralized config
const config = memoryManager.getCommServerConfig();
console.log('CommServer URL:', config.url);
// Expected: 'wss://comm10.dev.refinio.one' or env override
```

### Step 4: Data Persistence
```bash
# Check stored topics
ls one-core-storage/node/topics/

# Verify memory objects
ls one-core-storage/node/memories/
```

## Performance Benchmarks

### Expected Performance
- Topic creation: <50ms
- Memory addition: <100ms
- Memory search (100 items): <100ms
- Sync operation: <500ms
- CommServer reconnect: <5s

### Load Test
```javascript
// Create 100 memories
const start = Date.now();
for (let i = 0; i < 100; i++) {
  await window.electronAPI.invoke('memory:addMemory', {
    topicId: 'abc123...',
    content: `Test memory ${i}`,
    memoryType: 'note'
  });
}
const elapsed = Date.now() - start;
console.log(`Created 100 memories in ${elapsed}ms`);
// Expected: <10,000ms (100ms per memory)
```

## Troubleshooting

### Issue: "MemoryManager not initialized"
**Solution**: Ensure Node.js ONE.core is initialized before creating MemoryManager

### Issue: "CommServer connection failed"
**Solution**: Check CommServer URL configuration and network connectivity

### Issue: "Memories not syncing"
**Solution**: Verify CHUM protocol is active and peers are connected

### Issue: "Topic not found"
**Solution**: Ensure topic was created and not archived

## Success Criteria

✅ **Module Integration**
- one.memory module properly installed
- IPC handlers registered and working
- Integration with existing models successful

✅ **Core Functionality**
- Topics can be created, listed, archived
- Memories can be added, searched, referenced
- Cross-topic references work (read-only)

✅ **CommServer Communication**
- Centralized configuration working
- Proper error handling for disconnections
- Automatic reconnection successful
- Sync via CHUM protocol operational

✅ **Performance**
- All operations within target times
- No memory leaks observed
- Scales to 1000 memories per topic

## Next Steps

After successful quickstart:
1. Run full integration test suite
2. Test with multiple peer instances
3. Verify CommServer failover scenarios
4. Load test with 100 topics, 10,000 memories
5. Document any edge cases discovered