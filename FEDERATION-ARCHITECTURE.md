# LAMA Federation Architecture

## Overview

LAMA uses a federated architecture with two ONE.core instances that communicate via direct WebSocket connections. This enables local-first operation with automatic synchronization between browser and Node.js instances.

## Instance Federation

### Dual Instance Setup

1. **Browser Instance** (Renderer Process)
   - Lightweight, UI-focused
   - Sparse storage (IndexedDB)
   - Outgoing connections only
   - No external network listener

2. **Node.js Instance** (Main Process)
   - Archive storage (file system)
   - Direct socket listener on ws://localhost:8765
   - CommServer connection for external peers
   - Handles heavy computation and network operations

The instances connect via OneInstanceEndpoint discovery regardless of their person IDs.

### Connection Architecture

```
Browser Instance                    Node.js Instance
     |                                    |
     | OneInstanceEndpoint                | OneInstanceEndpoint
     | (no URLs)                         | (ws://localhost:8765)
     |                                    |
     |---------> Discovers endpoint ----->|
     |                                    |
     |---------> WebSocket Connect ------>| Socket Listener (8765)
     |                                    |
     |<======== CHUM Protocol ==========>|
     |         (Data Sync)                |
```

## Implementation Components

### 1. Federation API (`/main/core/federation-api.js`)

Implements refinio.api patterns for managing federated instances:

```javascript
class FederationAPI {
  // Create OneInstanceEndpoint for discovery
  async createContactWithEndpoint(personId, instanceId, instanceName, urls)
  
  // Register local Node with socket listener
  async registerLocalNode()
  
  // Register browser instance for federation
  async registerBrowserInstance(browserInfo)
}
```

### 2. Connection Layer

#### Node.js Side (`/main/core/node-one-core.js`)

```javascript
// LeuteConnectionsModule with dual listeners
{
  incomingConnectionConfigurations: [
    {
      type: 'socket',
      host: 'localhost',
      port: 8765,
      url: 'ws://localhost:8765',
      catchAll: true  // Accept browser
    },
    {
      type: 'commserver',
      url: 'wss://comm10.dev.refinio.one',
      catchAll: true  // Accept external peers
    }
  ],
  incomingRoutesGroupIds: ['chum', 'debug'],
  outgoingRoutesGroupIds: ['chum']
}
```

#### Browser Side (`/electron-ui/src/models/AppModel.ts`)

```javascript
// ConnectionsModel for outgoing connections only
{
  commServerUrl: '',  // No incoming listener
  acceptIncomingConnections: false,
  establishOutgoingConnections: true,
  noImport: false,  // Import from Node
  noExport: false   // Export to Node  
}
```

### 3. OneInstanceEndpoint

Advertises where instances can be reached:

```javascript
{
  $type$: 'OneInstanceEndpoint',
  personId: SHA256IdHash<Person>,
  instanceId: SHA256IdHash<Instance>,
  personKeys: SHA256Hash<Keys>,
  instanceKeys: SHA256Hash<Keys>,
  url: 'ws://localhost:8765'  // For Node (browser has no URL)
}
```

### 4. CHUM Synchronization

The CHUM protocol runs OVER established connections to synchronize:
- Contacts and profiles
- Chat messages and channels
- Access rights and permissions
- Any other ONE.core objects

## Connection Flow

1. **Login and Node Provisioning**
   - User logs in via browser UI
   - Browser provisions Node.js instance via IPC with credentials
   - Node.js initializes ONE.core with same credentials

2. **Local Pairing Invitation**
   - Node.js creates pairing invitation via ConnectionsModel
   - Invitation modified to point to ws://localhost:8765 (not commserver)
   - Invitation stored and passed back to browser via IPC

3. **Browser Instance Initialization**
   - Browser initializes its ONE.core instance AFTER Node.js is ready
   - Browser accepts the local pairing invitation from Node.js
   - Direct WebSocket connection established to ws://localhost:8765

4. **Connection Establishment**
   - Browser uses acceptInvitation() with local invitation
   - Node accepts incoming connection on socket listener
   - Federation connection established

5. **CHUM Sync**
   - Connection triggers CHUM protocol automatically
   - Bidirectional sync based on Access objects
   - Continuous sync as data changes

## Access Control

Content sharing is managed by Access objects (`/main/core/content-sharing.js`):

```javascript
class ContentSharingManager {
  // Grant access to browser for specific content
  async grantAccessToContacts(browserPersonId)
  async grantAccessToChannels(browserPersonId)
  
  // Automatically grant access to new content
  setupNewContentListeners()
}
```

## Benefits

1. **Local-First**: Browser can operate offline, sync when Node available
2. **Performance**: UI remains responsive, heavy work offloaded to Node
3. **Security**: No external browser exposure, all external connections via Node
4. **Flexibility**: Each instance optimized for its environment
5. **Automatic Sync**: CHUM handles all synchronization transparently

## Configuration

### Node Configuration
- Storage: `one-core-storage/node/`
- Socket: `ws://localhost:8765`
- CommServer: `wss://comm10.dev.refinio.one`

### Browser Configuration  
- Storage: IndexedDB
- No incoming connections
- Discovers Node via OneInstanceEndpoint

## Troubleshooting

### Connection Issues
1. Check Node socket listener is running on 8765
2. Verify OneInstanceEndpoint objects are created
3. Check LeuteConnectionsModule logs for discovery
4. Verify no firewall blocking localhost:8765

### Sync Issues
1. Check Access objects are created for content
2. Verify CHUM import/export settings
3. Check ConnectionsModel initialization
4. Review channel/contact access grants

## Future Enhancements

1. **Multiple Nodes**: Support connecting to remote Node instances
2. **Peer Discovery**: Use mDNS/Bonjour for local network discovery
3. **Encrypted Channels**: E2E encryption for remote connections
4. **Selective Sync**: Fine-grained control over what syncs
5. **Conflict Resolution**: Advanced CRDT-based conflict handling