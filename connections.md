# LAMA Electron Connection Architecture

## Overview

This document describes the connection establishment between Browser (Renderer) and Node.js (Main) instances in LAMA Electron, tracing the actual code paths and phases based on ONE.core architecture.

## Key Concepts

### Instance vs Person vs Keys
- **Instance**: Each ONE.core runtime has an Instance object with:
  - Its own instance encryption/sign keys (for connection establishment)
  - An owner reference (Person ID)
- **Person**: The identity that owns the instance:
  - Has separate person encryption/sign keys (for data ownership)
  - Derived from email hash
- **Keys**: TWO separate key pairs:
  - Instance keys: Used for connection handshake and transport encryption
  - Person keys: Used for signing/encrypting data objects

### Different Person IDs Required

**CRITICAL**: For federation to work, Browser and Node.js instances MUST have different Person IDs.
- Browser uses: `demo@lama.local` → Person ID
- Node.js uses: `node-demo@lama.local` → Different Person ID
- Person ID is derived from email hash, NOT password

## Connection Architecture

### ONE.core Connection Protocol
ALL connections in ONE.core follow the same protocol, regardless of transport:
1. **Invitation Creation**: Source instance creates a pairing invitation with instance public key
2. **Invitation Acceptance**: Target instance connects using invitation's instance key
3. **Instance Key Exchange**: Both instances verify each other's instance keys
4. **Person ID Exchange**: Exchange and verify person IDs (owners of instances)
5. **CHUM Sync**: Continuous data synchronization between instances

### Connection Transports in LAMA

Both use the SAME protocol above, just different transports:

#### 1. CommServer Transport (External Peers)
- **Endpoint**: `wss://comm10.dev.refinio.one`
- **Purpose**: External peer connections via relay
- **Transport**: WebSocket through CommServer relay
- **Managed by**: ConnectionsModel

#### 2. Direct Socket Transport (Internal Federation)
- **Endpoint**: `ws://localhost:8765`
- **Purpose**: Browser ↔ Node.js direct connection
- **Transport**: Direct WebSocket (no relay)
- **Managed by**: LeuteConnectionsModule

## Connection Phases

### Phase 1: Instance Initialization

#### Browser (Renderer)
```javascript
// browser-init-simple.ts
1. User logs in: authenticator.loginOrRegister(username, password)
2. Creates instance with owner: demo@lama.local
3. Instance gets its own encryption/sign keys
4. Person (demo) gets separate encryption/sign keys
```

#### Node.js (Main)
```javascript
// node-provisioning.js
1. Receive provisioning via IPC: provision:node
2. Create different identity: email = `node-${username}@lama.local`
3. Creates instance with owner: node-demo@lama.local
4. Instance gets its own encryption/sign keys
5. Person (node-demo) gets separate encryption/sign keys
```

### Phase 2: Pairing Invitation

#### Node.js Creates Invitation
```javascript
// node-provisioning.js
1. Start socket listener on ws://localhost:8765
2. Create pairing invitation:
   const invitation = await pairingManager.createInvitation()
   // Returns: {
   //   token: 'random-secret',
   //   publicKey: instancePublicKey, // NOT person key!
   //   url: 'ws://localhost:8765'
   // }
3. Return invitation to browser via IPC
```

#### Browser Accepts Invitation
```javascript
// browser-init-simple.ts
1. Receive invitation from IPC response
2. Store invitation for later connection:
   window.nodeInstanceInfo = {
     nodeId,
     endpoint,
     pairingInvite: invitation
   }
```

### Phase 3: Connection Establishment

#### Browser Connects Using Invitation
```javascript
// AppModel.ts - setupNodeConnection()
1. Check if pairing invitation exists
2. Connect using invitation:
   await pairingManager.connectUsingInvitation(
     invitation,
     myPersonId
   )
```

#### Connection Protocol Steps
```javascript
// ConnectToInstance.ts protocol
1. Encrypted handshake using instance public key from invitation
2. Exchange connection group name ('chum' for data sync)
3. Send authentication token from invitation
4. Exchange identities (OneInstanceEndpoint objects)
5. Trust establishment (certify keys)
```

### Phase 4: Post-Connection Setup

#### Contact Establishment
```javascript
// After successful pairing:
1. Node person becomes a contact of browser person
2. Browser person becomes a contact of node person
3. Both can now discover each other's endpoints
```

#### OneInstanceEndpoint Creation
```javascript
// Both sides create endpoints:
{
  $type$: 'OneInstanceEndpoint',
  personId: myPersonId,        // Owner's person ID
  instanceId: myInstanceId,    // This instance's ID
  personKeys: myPersonKeys,    // Owner's keys hash
  instanceKeys: myInstanceKeys,// Instance's keys hash
  url: 'ws://localhost:8765'   // How to reach this instance
}
```

### Phase 5: CHUM Synchronization

#### CHUM Protocol
```javascript
// After connection established:
1. Exchange highest timestamps
2. Share accessible objects
3. Continuous bidirectional sync
```

#### Data Synchronized
```javascript
// CHUM automatically syncs:
- Contacts (Person objects)
- Messages (Channel entries)
- Access rights
- Any objects shared between instances
```

## Correct Connection Flow

### Node.js Side (Accepting Connections)
```javascript
1. Initialize with node-${username}@lama.local
2. Create PairingManager with socket listener
3. Generate pairing invitation with:
   - Random token
   - Instance public key (NOT person key)
   - Socket URL (ws://localhost:8765)
4. Return invitation via IPC to browser
5. Wait for incoming connection with token
```

### Browser Side (Initiating Connection)
```javascript
1. Initialize with ${username}@lama.local
2. Receive pairing invitation from Node.js
3. Connect using invitation:
   - Use instance key from invitation for encryption
   - Send token for authentication
   - Exchange OneInstanceEndpoint objects
4. Establish contact relationship
5. Begin CHUM sync
```

## Current Implementation Issues (from log)

### 1. Missing Pairing Invitation
**Log**: `pairingInvite: undefined`
**Issue**: Node.js not creating/returning pairing invitation
**Impact**: No token for authentication, no contact establishment
**Fix**: Node.js must create and return invitation in provision:node

### 2. No Contact Relationship
**Log**: `Node person as contact: NO`
**Issue**: Without pairing, instances aren't contacts
**Impact**: Can't discover endpoints, can't connect
**Fix**: Use pairing invitation to establish contact

### 3. Connection Fails
**Log**: `Federation status after 10s: 0 total connections`
**Issue**: Browser can't connect to Node.js
**Root Cause**: No pairing invitation → no authentication token
**Fix**: Implement proper pairing flow

## Key Finding: Pairing is Required

The log shows the critical issue:
```
pairingInvite: undefined
⚠️ No pairing invitation - contacts not established
Auto-discovery won't work without contact relationship!
```

### Why Pairing is Essential
1. **Authentication**: Token validates the connection
2. **Contact Creation**: Establishes trust relationship
3. **Key Exchange**: Shares instance and person keys
4. **Endpoint Discovery**: Only contacts' endpoints are discoverable

### The Solution Path

#### Step 1: Fix Node.js Provisioning
```javascript
// node-provisioning.js must:
1. Create PairingManager
2. Generate invitation with token
3. Return invitation in IPC response
```

#### Step 2: Fix Browser Connection
```javascript
// AppModel.ts must:
1. Receive pairing invitation
2. Use PairingManager.connectUsingInvitation()
3. NOT try to discover endpoints (won't work without contact)
```

#### Step 3: Verify Contact Establishment
```javascript
// After pairing:
- Check contacts: leuteModel.getSomeones()
- Should include Node.js person
- Endpoints now discoverable
```

## Implementation Fix Required

The core issue is in `/main/hybrid/node-provisioning.js`:
- Currently: Returns `{nodeId, endpoint}` only
- Required: Must return `{nodeId, endpoint, pairingInvite}`

And in `/electron-ui/src/models/AppModel.ts`:
- Currently: Tries to discover endpoints
- Required: Must use pairing invitation to connect

## Socket Listener vs WebServer Architecture

**CRITICAL FINDING**: There are TWO separate WebSocket systems in LAMA Electron:

### 1. ConnectionsModel Socket Listener (ONE.core Integration)
- **Location**: Managed by `@refinio/one.models/lib/models/ConnectionsModel.js`
- **Configuration**: `node-one-core.js:340` - Standard ONE.core ConnectionsModel
- **Purpose**: ONE.core's built-in connection management system
- **Integration**: Part of LeuteConnectionsModule/ConnectionRouteManager
- **Status**: Configured but delegates to catchAllRoutes system
- **Log Evidence**: "Socket listener registered CryptoApi keys", "Catch-all routes registered: 1"

### 2. Local Federation WebServer (Custom Implementation)
- **Location**: `node-one-core.js:1352` - `startLocalFederationServer()`
- **Implementation**: Direct `ws.WebSocketServer({ port: 8765 })`
- **Purpose**: Simple WebSocket server for browser-to-Node.js federation
- **Integration**: **MINIMAL** - Only logs messages, doesn't handle pairing protocol
- **Status**: **RUNNING** but not integrated with ONE.core pairing system
- **Log Evidence**: "Local federation server started", "WebSocket connection from browser"

### The Integration Problem

**Current State**: The app hangs because:
1. **ConnectionsModel** expects to handle pairing through its route system
2. **Local Federation Server** intercepts WebSocket connections but doesn't process them
3. **Browser** connects to simple WebServer, but pairing data isn't forwarded to ConnectionsModel
4. **Pairing Protocol** never completes because the two systems don't communicate

### Resolution Required

The local federation WebServer needs to be **either**:
1. **Removed** - Let ConnectionsModel handle port 8765 directly via socketConfig
2. **Integrated** - Forward pairing messages from WebServer to ConnectionsModel.pairing

From the logs, **Option 1** is preferred - the ConnectionsModel already has the infrastructure via:
- `socketConfig` (commented out but defined in code)
- `catchAllRoutes` system for unknown persons
- `pairing` module for invitation handling

### Current Connection Flow Issue

```
Browser --WebSocket--> LocalWebServer (logs only)
                           ❌ (no forwarding)
                       ConnectionsModel.pairing (waiting)
```

**Should be**:
```
Browser --WebSocket--> ConnectionsModel.pairing (direct)
```

## References

- `/init.md` - Overall initialization flow
- `/FEDERATION-ARCHITECTURE.md` - Federation design
- `/packages/one.models/src/misc/ConnectionEstablishment/` - Connection code
- `/main/core/node-one-core.js` - Node.js instance setup
- `/electron-ui/src/models/AppModel.ts` - Browser connection setup