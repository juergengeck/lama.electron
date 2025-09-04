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

## CRITICAL: Pairing Invitation Creation Principles

### Instance Ownership Principle
**NEVER** manually construct pairing invitations. Each ONE.core instance MUST create its own invitations through its pairing manager. Manual construction violates the security model.

### Correct Pairing Flow

#### Node.js Side (Creating Invitation)
```javascript
// CORRECT: Let the instance create its own invitation
const invitation = await nodeOneCore.connectionsModel.pairing.createInvitation()

// Override only the URL for local socket connection
const pairingInvite = {
    ...invitation,
    url: 'ws://localhost:8765'  // Point to local socket instead of CommServer
}

// Return invitation to browser
return { nodeId, endpoint, pairingInvite }
```

#### WRONG Approach (Never Do This)
```javascript
// NEVER manually construct invitations like this:
const pairingInvite = {
    token: crypto.randomBytes(32).toString('hex'),  // WRONG
    publicKey: instancePublicKey,                    // WRONG
    url: 'ws://localhost:8765'                      // WRONG
}

// NEVER manipulate internal maps:
nodeOneCore.connectionsModel.pairing.activeInvitations.set(token, {...})  // WRONG
```

### Key Principles

1. **Instance Creates Own Invitations**: Each instance must use its own `pairingManager.createInvitation()` method
2. **Token Validates Against Instance**: The authentication token validates against the instance ID that handles the connection, NOT the person ID
3. **URL Override Only**: When modifying invitations, only override the URL field to point to local socket
4. **No Internal Map Manipulation**: Never access or modify `activeInvitations` map directly

### Token Validation

The pairing token validates against the **instance** handling the connection:
- Token is generated by the instance's pairing manager
- Validation checks against the instance ID, not person ID
- This ensures the connection is established with the correct instance

## WebSocket Server Protocol Implementation

**CRITICAL**: ONE.core doesn't provide a WebSocket server - only clients. We must implement a custom server that follows the exact protocol that one.leute expects.

### ONE.models Connection Protocol

The protocol for connecting to any ONE.models instance (including one.leute) follows this exact sequence:

#### Client Side (e.g., one.leute connecting)
```javascript
// From connectToInstance in ConnectToInstance.ts
1. connectWithEncryption(url, encryptionApi)
   - Creates WebSocket connection
   - Performs encryption handshake
   - Returns encrypted connection

2. exchangeConnectionGroupName(conn, 'pairing'/'chum')
   - Sends connection group name through encrypted channel
   - Server responds with acknowledgment

3. sync(conn, true)
   - Synchronization step

4. For pairing specifically:
   - Send authentication token
   - Exchange person/instance identities
```

#### Server Side Protocol Handling

The server must handle connections through this event-driven flow:

```javascript
1. IncomingConnectionManager (handles encryption)
   - acceptWithEncryption(connection, cryptoApis)
   - Emits: onConnection(encryptedConn, localKey, remoteKey, listenerId)

2. ConnectionRouteManager (handles protocol)
   - Listens to onConnection event
   - Calls private acceptConnection()
   - exchangeConnectionGroupName() - receives group name
   - Routes to catch-all for unknown peers
   - Emits: onConnectionViaCatchAll

3. LeuteConnectionsModule (handles pairing)
   - Listens to onConnectionViaCatchAll
   - acceptConnectionViaCatchAll()
   - Handles pairing protocol messages
```

### Custom WebSocket Server Implementation

Located in `node-one-core.js:startLocalFederationServer()`:

```javascript
this.localWebSocketServer.on('connection', async (ws, req) => {
  // 1. Wrap WebSocket for ONE.models compatibility
  const Connection = await import('@refinio/one.models/lib/misc/Connection/Connection.js')
  const PromisePlugin = await import('@refinio/one.models/lib/misc/Connection/plugins/PromisePlugin.js')
  
  const wrappedConnection = new Connection(ws)
  wrappedConnection.addPlugin(new PromisePlugin.default())
  
  // 2. Get instance crypto API
  const { getInstanceIdHash } = await import('@refinio/one.core/lib/instance.js')
  const { createCryptoApiFromDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js')
  const instanceId = getInstanceIdHash()
  const cryptoApi = await createCryptoApiFromDefaultKeys(instanceId)
  
  // 3. Perform encryption handshake and emit to ConnectionRouteManager
  const { acceptWithEncryption } = await import('@refinio/one.models/lib/misc/ConnectionEstablishment/protocols/EncryptedConnectionHandshake.js')
  
  acceptWithEncryption(wrappedConnection, [cryptoApi]).then(connInfo => {
    // Emit to trigger ConnectionRouteManager's protocol handling
    // This will handle connection group name exchange and route to catch-all for pairing
    const incomingManager = this.connectionsModel.leuteConnectionsModule?.connectionRouteManager?.incomingConnectionManager
    incomingManager.onConnection.emit(
      connInfo.connection,
      connInfo.myKey,
      connInfo.remoteKey,
      'direct-ws-8765'
    )
  }).catch(error => {
    console.error('Encryption handshake failed:', error)
    wrappedConnection.close()
  })
})
```

### Key Protocol Requirements

1. **PromisePlugin Required**: The Connection must have PromisePlugin for encryption handshake
2. **Async Event Flow**: Don't await encryption - let events drive the protocol
3. **Connection Groups**: Must handle 'pairing', 'chum', etc. through ConnectionRouteManager
4. **Catch-All Routes**: Unknown peers must route through catch-all for pairing
5. **Instance Keys**: Use instance keys, not person keys, for connection encryption

### Protocol Flow for IoP Pairing

The ONE.models IoP (Internet of People) pairing protocol flow:

1. **Browser Side (Client)**:
   - Creates encrypted connection using instance public key from invitation
   - Sends connection group name ('pairing')
   - Sends sync message
   - Sends authentication token
   - Exchanges identities
   
2. **Node Side (Server)**:
   - Accepts encrypted connection
   - **ConnectionRouteManager** handles connection group name
   - **ConnectionRouteManager** routes to catch-all (unknown peer)
   - **LeuteConnectionsModule** handles pairing protocol via catch-all
   - Validates token and exchanges identities
   
**CRITICAL**: The server must NOT manually handle protocol steps - ConnectionRouteManager handles the protocol flow after encryption.

### Current Status

The WebSocket server:
- ✅ Listens on port 8765
- ✅ Accepts connections from any ONE.models client
- ✅ Performs encryption handshake
- ✅ Emits to ConnectionRouteManager for protocol handling
- ✅ Compatible with one.leute connection expectations
- ⚠️ Catch-all routing for pairing needs verification

## Pairing Protocol Flow - Decryption Error Analysis

### What Actually Happens During Pairing

The pairing protocol follows these exact steps:

#### Client Side (Browser - PairingManager.connectUsingInvitation)
1. **connectToInstance()** is called with:
   - URL from invitation (ws://localhost:8765)
   - Public key from invitation (instance key, not person key)
   - Connection group name: 'pairing'

2. **Inside connectToInstance():**
   - Creates CryptoApi using INSTANCE ID (not person ID)
   - Calls `connectWithEncryption()` to establish encrypted connection
   - Sends connection group name ('pairing')
   - **Calls `sync(conn, true)`** - WAITS for sync message
   - Exchanges person IDs
   - Exchanges instance ID objects

3. **After connectToInstance returns:**
   - Sends authentication token
   - Waits for remote identity
   - Sends local identity
   - Closes connection

#### Server Side (Node - Must Handle Protocol)

The server must respond to the protocol in the correct sequence:

1. **Accept encrypted connection** with instance keys
2. **Receive connection group name** ('pairing')
3. **Send sync message** - The client is waiting for this!
4. **Receive authentication token**
5. **Send identity**
6. **Receive identity**

### The Decryption Error

The error "Decryption of message failed" occurs at the sync step because:

1. **Client waits for sync message**: `await sync(conn, true)` at line 73 of ConnectToInstance.ts
2. **Server must send sync message**: But if the server doesn't properly handle the protocol...
3. **Decryption fails**: The message received can't be decrypted, likely because:
   - The server closed the connection
   - Or sent an unencrypted message
   - Or the encryption handshake wasn't completed properly

### Root Cause

The WebSocket server in node-one-core.js performs the encryption handshake but doesn't properly handle the subsequent protocol steps. After encryption, it should:

1. Wait for connection group name
2. Route to appropriate handler based on group ('pairing')
3. For 'pairing', handle the pairing protocol including sending the sync message

But currently, the server only does the encryption handshake and emits to ConnectionRouteManager. If ConnectionRouteManager isn't properly set up or doesn't have catch-all routes enabled for pairing, the protocol fails.

### The Fix

The Node.js instance must have:
1. ConnectionRouteManager properly initialized with catch-all routes
2. LeuteConnectionsModule listening for catch-all connections
3. Proper handling of the 'pairing' connection group

This is why CHUM works despite the pairing error - CHUM uses a different connection group and doesn't require the pairing protocol.

## Encryption Role Assignment Issue - CRITICAL BUG

### Root Cause Analysis

The decryption error in pairing protocol was caused by both sides using the wrong encryption roles:

#### Expected Encryption Roles
In commserver connections:
- **Client** (connecting): `connectWithEncryption()` → `new EncryptionPlugin(sharedKey, false)` (odd nonces: 1,3,5...)
- **Server** (accepting): `acceptWithEncryption()` → `new EncryptionPlugin(sharedKey, true)` (even nonces: 0,2,4...)

#### Current Direct Connection Issue
Both sides using `acceptWithEncryption()`:
- **Node.js** (invite creator): `acceptWithEncryption()` → `true` (server mode) ✓ CORRECT
- **Browser** (invite acceptor): `acceptWithEncryption()` → `true` (server mode) ✗ WRONG

The browser should use `connectWithEncryption()` with `false` (client mode).

### The Fix Required

The fundamental principle: **The side creating the invite should be the server, the side accepting the invite should be the client.**

#### Correct Roles
- **Node.js** creates invite → uses `acceptWithEncryption()` (server, `evenLocalNonceCounter: true`)
- **Browser** accepts invite → should use `connectWithEncryption()` (client, `evenLocalNonceCounter: false`)

#### Nonce Counter Fix Applied
Fixed server initialization in EncryptionPlugin.js:
```javascript
// Before: remoteNonceCounter = -1 (causing decrypt with nonce -1)
// After:  remoteNonceCounter = 1  (correctly decrypt client's first message with nonce 1)
```

#### Implementation Details
In direct WebSocket connections, encryption is set up at connection creation time before pairing protocol messages are exchanged, unlike commserver connections which have an unencrypted handshake phase first.

**CommServer Flow:**
1. Unencrypted handshake: `communication_request` → `communication_ready`
2. Key exchange and encryption setup
3. Encrypted communication begins

**Direct WebSocket Flow:**
1. Connection created with encryption already established
2. Pairing protocol messages sent over already-encrypted connection
3. Role mismatch causes nonce counter synchronization failure

### Current Status
- ✅ Fixed server nonce counter initialization (1 instead of -1)
- ⚠️ Still need to fix browser to use client role instead of server role
- ⚠️ Both sides currently use `acceptWithEncryption()`, need browser to use `connectWithEncryption()`

## References

- `/init.md` - Overall initialization flow
- `/FEDERATION-ARCHITECTURE.md` - Federation design
- `/packages/one.models/src/misc/ConnectionEstablishment/` - Connection code
- `/main/core/node-one-core.js` - Node.js instance setup
- `/electron-ui/src/models/AppModel.ts` - Browser connection setup