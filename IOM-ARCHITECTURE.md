# Internet of Me (IoM) - Hybrid Storage Architecture

## Core Concept

A single user's "Internet of Me" consists of multiple ONE.CORE instances across devices, all owned by the same identity, with optimized storage strategies per device.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Internet of Me (IoM)                         │
│                     Owner: <user-identity-hash>                     │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │  Node Instance   │  │Browser Instance │  │ Mobile Instance  │ │
│  │  (Full Storage)  │◄─┤ (Sparse Storage)│◄─┤(Minimal Storage) │ │
│  │                  │  │                  │  │                  │ │
│  │  - All versions  │  │  - Recent only   │  │  - Active only   │ │
│  │  - All objects   │  │  - Cached subset │  │  - On-demand     │ │
│  │  - Archive data  │  │  - Working set   │  │  - Essentials    │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│           ▲                     ▲                      ▲           │
│           └─────────────────────┼──────────────────────┘           │
│                          CHUM Protocol                              │
│                    (Same Owner, Trust Verified)                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Storage Strategies

### 1. Node Instance (Full Node)
```javascript
const nodeStorageConfig = {
  role: 'archive',
  storage: {
    keepAllVersions: true,
    keepAllObjects: true,
    pruneStrategy: 'never',
    maxStorage: 'unlimited'
  },
  responsibilities: [
    'long-term-archive',
    'version-history',
    'large-file-storage',
    'backup-provider'
  ]
}
```

### 2. Browser Instance (Smart Cache)
```javascript
const browserStorageConfig = {
  role: 'working-cache',
  storage: {
    keepAllVersions: false,      // Only latest
    keepRecentDays: 30,           // Recent activity
    maxObjectAge: '30d',          // Auto-prune old
    maxStorage: '500MB',          // Browser limit
    cacheStrategy: 'lru'          // Least recently used
  },
  loadOnDemand: {
    provider: 'node-instance',    // Fetch from Node
    prefetch: ['contacts', 'recent-messages'],
    lazy: ['old-messages', 'files']
  }
}
```

### 3. Mobile Instance (Minimal)
```javascript
const mobileStorageConfig = {
  role: 'minimal',
  storage: {
    keepAllVersions: false,
    keepRecentDays: 7,
    maxStorage: '50MB',
    essentialsOnly: true
  },
  essentials: [
    'active-conversations',
    'recent-messages',
    'user-profile',
    'contacts'
  ]
}
```

## On-Demand Loading Protocol

### Browser requests missing object:

```javascript
// Browser Instance
class SparseBrowserStorage {
  async getObject(hash) {
    // 1. Check local IndexedDB
    let obj = await this.localDB.get(hash)
    
    if (!obj) {
      // 2. Request from Node instance via CHUM
      obj = await this.requestFromPeer('node-instance', hash)
      
      // 3. Cache for future use
      if (obj) {
        await this.cacheObject(obj)
      }
    }
    
    return obj
  }
  
  async requestFromPeer(peerId, hash) {
    // CHUM protocol extension for on-demand loading
    return await this.chum.request(peerId, {
      type: 'object-request',
      hash: hash,
      requester: this.instanceId
    })
  }
  
  async cacheObject(obj) {
    // Smart caching with LRU eviction
    if (await this.shouldCache(obj)) {
      await this.localDB.put(obj)
      await this.evictIfNeeded()
    }
  }
}
```

### Node Instance serves requests:

```javascript
// Node Instance
class FullNodeStorage {
  constructor() {
    this.chum.on('object-request', this.handleObjectRequest.bind(this))
  }
  
  async handleObjectRequest(request) {
    const { hash, requester } = request
    
    // Verify requester is same owner (IoM member)
    if (!this.verifyIoMMember(requester)) {
      throw new Error('Unauthorized request')
    }
    
    // Serve object from full storage
    const obj = await this.storage.get(hash)
    
    // Track what browser has cached for optimization
    this.trackPeerCache(requester, hash)
    
    return obj
  }
}
```

## Smart Sync Strategies

### 1. Predictive Prefetching

```javascript
class PredictivePrefetch {
  async analyzeBehavior() {
    // Learn user patterns
    const patterns = await this.ml.analyzeUsage({
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      recentActivity: this.recentHashes
    })
    
    // Prefetch likely needed objects
    for (const hash of patterns.likelyNeeded) {
      await this.prefetchObject(hash)
    }
  }
}
```

### 2. Conversation-Based Loading

```javascript
class ConversationLoader {
  async openConversation(convId) {
    // Load recent messages immediately
    const recent = await this.loadRecentMessages(convId, 50)
    
    // Background load older messages
    this.backgroundLoad(async () => {
      await this.loadOlderMessages(convId, 200)
    })
    
    // Predict and preload likely next conversations
    const likely = await this.predictNextConversation(convId)
    this.prefetchConversation(likely)
  }
}
```

### 3. Storage Pressure Management

```javascript
class StoragePressureManager {
  async handleStoragePressure() {
    const usage = await navigator.storage.estimate()
    const percentUsed = usage.usage / usage.quota
    
    if (percentUsed > 0.9) {
      // Critical - aggressive cleanup
      await this.evictOldObjects(30) // Over 30 days
      await this.removeVersionHistory()
      await this.compressImages()
    } else if (percentUsed > 0.7) {
      // Warning - moderate cleanup
      await this.evictOldObjects(60)
      await this.removeOldVersions()
    }
  }
}
```

## IoM Membership & Trust

### Instance Registration

```javascript
class IoMRegistry {
  async registerInstance(instance) {
    // All instances share same owner identity
    const registration = {
      instanceId: instance.id,
      ownerId: this.ownerId,
      deviceType: instance.deviceType,
      storageRole: instance.storageRole,
      capabilities: instance.capabilities,
      publicKey: instance.publicKey
    }
    
    // Sign with owner key
    const signature = await this.signRegistration(registration)
    
    // Broadcast to other IoM members
    await this.broadcastNewMember(registration, signature)
  }
}
```

### Trust Verification

```javascript
class IoMTrust {
  async verifyIoMMember(instanceId) {
    // Check if instance belongs to same owner
    const registration = await this.getRegistration(instanceId)
    
    // Verify signature with owner's public key
    const valid = await this.verifySignature(
      registration,
      registration.signature,
      this.ownerPublicKey
    )
    
    return valid && registration.ownerId === this.ownerId
  }
}
```

## Benefits for LAMA

1. **Responsive UI**: Browser only loads what's needed
2. **Unlimited Storage**: Node instance handles archive
3. **Fast Startup**: Browser doesn't load everything
4. **Offline Capable**: Each instance works independently
5. **Scalable**: Add more devices to IoM seamlessly

## Implementation Phases

### Phase 1: Basic Sparse Storage
- Browser stores last 30 days
- Node stores everything
- Simple on-demand loading

### Phase 2: Smart Caching
- LRU eviction
- Predictive prefetching
- Storage pressure management

### Phase 3: Advanced IoM
- Multiple device support
- Role-based storage
- Distributed computation

### Phase 4: Optimization
- ML-based prediction
- Compression strategies
- Differential sync

## Configuration Example

```javascript
// config/iom.js
module.exports = {
  owner: {
    identity: 'user-hash-xxx',
    publicKey: 'owner-public-key'
  },
  
  instances: {
    node: {
      role: 'archive',
      endpoint: 'ws://localhost:8765',
      storage: 'unlimited'
    },
    browser: {
      role: 'cache', 
      endpoint: 'indexeddb',
      storage: '500MB',
      retention: '30d'
    }
  },
  
  sync: {
    protocol: 'chum',
    encryption: true,
    compression: true,
    strategies: {
      Message: 'recent-first',
      File: 'on-demand',
      Contact: 'full-sync'
    }
  }
}
```

## Real-Time Monitoring

### Data Dashboard Integration

The LAMA desktop app includes a comprehensive Data Dashboard for monitoring IOM replication:

```javascript
// Real-time monitoring via IPC
const iomState = await electronAPI.invoke('iom:getInstances')
const events = await electronAPI.invoke('iom:getReplicationEvents')
const stats = await electronAPI.invoke('iom:getDataStats')
```

### CHUM Protocol Monitoring

```javascript
class ChumMonitor extends EventEmitter {
  trackConnection(connId, connection) {
    // Monitor WebSocket state
    // Track data transfer
    // Collect errors
  }
  
  updateSyncProgress(connId, progress) {
    // Real-time sync updates
  }
  
  completeSyncSession(connId, chumObj) {
    // Log completion stats
  }
}
```

### Metrics Collection

1. **Storage Metrics**
   - Actual filesystem usage (Node)
   - Browser Storage API quotas
   - No hardcoded limits

2. **Sync Events**
   - Connection establishment
   - Object transfers
   - Error conditions
   - Completion statistics

3. **Performance Tracking**
   - Queue sizes
   - Transfer rates
   - Error counts
   - Connection duration

This architecture makes LAMA a true IoM application - the desktop app is just one node in the user's personal internet!