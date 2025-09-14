# LAMA Electron Connection Architecture

## Overview

This document describes the connection establishment between Browser (Renderer) and Node.js (Main) instances in LAMA Electron, tracing the actual code paths and phases based on ONE.core architecture.

## Profile-Based Chat Management

### Key Principle: Someone Objects as Address Book Containers

Someone objects are containers for the address book - they represent contacts as profiles. Chat topics and channels are managed by profile (Someone ID), not by underlying Person IDs.

### Topic Creation with Profile IDs

When creating P2P conversations:
1. **Topic ID = Someone ID**: The topic uses the Someone hash as its identifier
2. **Channel ID = Someone ID**: Channels also use the Someone hash
3. **Person IDs for permissions only**: Person IDs are used for access control and CHUM sync

Example:
```javascript
// Profile-based topic creation
const someoneId = "e466cc4a..."  // Someone hash (profile)
const personId = "650f45cb..."   // Person ID (for permissions)

// Create topic with profile ID
await topicModel.createGroupTopic(
  someoneId,  // Topic name = Someone ID
  someoneId,  // Topic ID = Someone ID  
  myPersonId  // Owner for permissions
)

// Create channel with profile ID
await channelManager.createChannel(someoneId, myPersonId)
```

This ensures:
- One conversation per profile (no duplicates)
- Topics exist for TopicModel operations
- CHUM sync works with Person IDs for permissions

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

##### CommServer Architecture Details

**CRITICAL**: Both peers are CLIENTS to the CommServer. The CommServer is a relay service, not a peer.

```
┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│   LAMA      │  WebSocket Client  │  CommServer │  WebSocket Client  │  one.leute  │
│  (Node.js)  │───────────────────▶│   (Relay)   │◀───────────────────│   (Peer)    │
└─────────────┘                    └─────────────┘                    └─────────────┘
      │                                    │                                  │
      │ 1. Connect as client              │                                  │
      │    wss://comm10.dev.refinio.one   │                                  │
      │                                   │                                  │
      │ 2. Authenticate to CommServer    │                                  │
      │    {"command": "register"}       │                                  │
      │                                   │                                  │
      │ 3. CommServer authenticates      │  4. Peer also connects          │
      │    both clients                   │     as client & authenticates   │
      │                                   │                                  │
      │ 5. CommServer relays messages    │                                  │
      │    between authenticated clients │                                  │
      │                                   │                                  │
      │ 6. End-to-end encryption         │                                  │
      │    established THROUGH relay     │                                  │
      └───────────────────────────────────┴──────────────────────────────────┘
```

##### CommServer Protocol Layers

1. **Transport Layer (WebSocket to CommServer)**
   - Both peers establish WebSocket connections to CommServer
   - Each peer authenticates independently to CommServer
   - CommServer maintains mapping of peer IDs to WebSocket connections

2. **Relay Layer (CommServer Message Routing)**
   - CommServer receives messages from one peer
   - Routes messages to target peer based on recipient ID
   - Does NOT decrypt or modify message content

3. **Application Layer (Peer-to-Peer Encryption)**
   - Peers establish end-to-end encryption THROUGH the relay
   - Invitation creator acts as "server" (even nonces: 0, 2, 4...)
   - Invitation acceptor acts as "client" (odd nonces: 1, 3, 5...)
   - CommServer cannot decrypt these messages

##### CommServer Connection Flow

```javascript
// LAMA (invitation creator) - connects to CommServer as client
1. WebSocket.connect("wss://comm10.dev.refinio.one")
2. Send: {"command": "register", "publicKey": "..."}
3. Receive: {"command": "authentication_request", "challenge": "..."}
4. Send: {"command": "authentication_response", "response": "..."}
5. Receive: {"command": "authentication_success"}
6. Now ready to receive relayed pairing connections

// one.leute (invitation acceptor) - also connects to CommServer as client
1. WebSocket.connect("wss://comm10.dev.refinio.one")
2. Send: {"command": "register", "publicKey": "..."}
3. Receive: {"command": "authentication_request", "challenge": "..."}
4. Send: {"command": "authentication_response", "response": "..."}
5. Receive: {"command": "authentication_success"}
6. Send pairing request with invitation token (relayed to LAMA)
7. CommServer relays the encrypted pairing messages
```

##### Key Points
- **Both peers are clients**: Neither peer is a server to the other at the WebSocket level
- **CommServer is the relay**: It forwards encrypted messages between clients
- **End-to-end encryption**: Established between peers, CommServer can't decrypt
- **Role assignment**: "Server" and "client" roles only apply to the encryption protocol between peers, not to CommServer connections

#### 2. Direct Socket Transport (Internal Federation)
- **Endpoint**: `ws://localhost:8765`
- **Purpose**: Browser ↔ Node.js direct connection
- **Transport**: Direct WebSocket (no relay)
- **Managed by**: LeuteConnectionsModule

## Connection Phases

### Phase 1: Instance Initialization

#### Browser (Renderer)
```javascript
// browser-init.ts
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
// browser-init.ts
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

## CORRECTED ANALYSIS: CommServer Works Fine - We're The Problem

### The Real Issues

1. **CommServer works perfectly** - It's been in production for years without issues
2. **We're misusing spare connections** - Trying to run pairing on ALL connections instead of just one
3. **Encryption roles are correct** - Both are clients to CommServer until handover (which is correct)

### Original Incorrect Analysis (Preserved for Learning)

The decryption error in pairing protocol was incorrectly attributed to CommServer issues:

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

## CommServer Works Correctly - We're Using It Wrong

### The Problem
CommServer has been working perfectly in production for years. The issue is that we're incorrectly trying to use ALL spare connections for pairing instead of just ONE connection with spares held for later protocol phases.

### Understanding the CommServer Relay Protocol

After extensive investigation, here's how the CommServer relay actually works:

#### Intended Flow

1. **Initiator connects to CommServer**
   - Creates WebSocket to `wss://comm10.dev.refinio.one`
   - Sends `communication_request` with `sourcePublicKey` (initiator) and `targetPublicKey` (listener)
   - Uses `connectWithEncryption` which will use CLIENT mode

2. **CommServer processes the request**
   - Finds a spare connection registered for `targetPublicKey`
   - Sends `connection_handover` message to listener
   - Sends `communication_request` message to listener (forwarding initiator's request)
   - Calls `releaseWebSocket()` on both connections
   - Sets up raw WebSocket relay between the two peers

3. **Listener receives handover**
   - `CommunicationServerListener` receives `connection_handover`
   - Emits `onConnection` event with the Connection object
   - `IncomingConnectionManager.acceptConnection` is called
   - Calls `acceptWithEncryption` with the Connection

4. **Key Exchange Protocol**
   - `acceptWithEncryption` waits for `communication_request` message
   - The message SHOULD arrive because it was sent in step 2
   - Listener identifies itself as target, uses SERVER mode
   - Initiator already using CLIENT mode
   - Encryption handshake proceeds with asymmetric roles

#### The Critical Race Condition

The `communication_request` message is sent by CommServer AFTER the `connection_handover` but BEFORE releasing the WebSockets. There's a race condition:

- The listener's callback fires immediately when `connection_handover` arrives
- `acceptWithEncryption` starts waiting for `communication_request`
- Meanwhile, CommServer releases the WebSockets, breaking the Connection wrappers
- The `communication_request` may arrive at the raw WebSocket level, not through the Connection wrapper that `acceptWithEncryption` expects

#### Why It Works in Production

The reference implementation (one.leute) has been working for 7 years with this exact flow. The key is timing:
- CommServer sends `communication_request` with `await`
- Then immediately releases WebSockets
- The message should be buffered in the Connection before the WebSocket is hijacked
- `acceptWithEncryption` should receive it from the buffer

However, the TODO comment in the CommServer code acknowledges this is a race condition that could theoretically fail if timing is wrong.

### Encryption Roles Are Correct Until Handover
The encryption roles work correctly:

1. **Before handover**:
   - Both sides are clients to CommServer (correct)
   - CommServer handles the relay between them
   - Each side maintains proper client role to CommServer

2. **After handover**:
   - Initiator becomes client in peer-to-peer connection
   - Listener becomes server in peer-to-peer connection
   - This role switch happens AFTER CommServer steps out

### The Symmetric Issue
Both LAMA and one.leute can create and accept invitations. When using CommServer:
- Both sides register listening connections with CommServer
- Both sides can initiate connections through CommServer
- The CommServer relay breaks the protocol for BOTH directions

### Why Direct Connections Work
Direct WebSocket connections (like Browser↔Node.js on port 8765) work because:
- No CommServer relay involved
- No WebSocket hijacking
- Connection wrappers remain intact throughout protocol
- Encryption roles correctly assigned

### Potential Solutions

1. **Fix CommServer relay timing** (in ONE.models):
   - Don't release WebSockets until after handshake completes
   - Let Connection wrappers handle the initial protocol
   - Only set up raw relay after encryption is established

2. **Different protocol for CommServer** (in ONE.models):
   - Design a protocol aware of relay limitations
   - Handle the WebSocket hijacking gracefully
   - Ensure roles are correctly assigned despite relay

3. **Workaround** (application level):
   - Use direct connections when possible
   - Implement custom relay that preserves Connection wrappers
   - Add retry logic with role detection

### Current Status After Investigation

#### What We Fixed
- ✅ Corrected nonce counter initialization (was -1, now 1 for server's remote counter)
- ✅ Server now correctly expects client's first message with nonce 1

#### What Still Fails
- ❌ Decryption STILL fails even with correct nonce (1)
- ❌ The ciphertext cannot be decrypted despite correct nonce values
- ❌ This indicates the shared key itself may be wrong

#### New Discovery
The logs show:
```
[EncryptionPlugin] Remote nonce generated with counter: 1
[EncryptionPlugin] Nonce: 00 00 00 00 ... 00 00 00 01 (correct!)
[EncryptionPlugin] ✅ tweetnacl.box.open.after completed successfully
BUT: Decryption failed - tweetnacl returned null/undefined
```

This means:
1. The nonce counter is now correct (1, not -1)
2. The nonce array is correctly formed
3. tweetnacl.box.open.after runs without error
4. But returns null, meaning the decryption mathematically failed

#### Root Cause Hypothesis
The shared key derivation is incorrect. Possible causes:
1. Wrong public key used in ephemeral key exchange
2. Keys corrupted during CommServer relay
3. Encryption/decryption using different derived shared keys
4. The ciphertext was encrypted with a different key than we're using

#### Deep Dive: Encryption Protocol Analysis

##### CryptoApi Types Used

**Client (one.leute) uses `SymmetricCryptoApiWithKeys`:**
```javascript
// In ConnectToInstance.js
const cryptoApi = await createCryptoApiFromDefaultKeys(myInstanceId);
const connInfo = await connectWithEncryption(url, 
    cryptoApi.createEncryptionApiWithKeysAndPerson(remotePublicEncryptionKey));
```

This creates a `SymmetricCryptoApiWithKeys` with:
- Pre-derived symmetric key from client's instance secret key and server's instance public key
- `localPublicKey`: client's instance public key
- `remotePublicKey`: server's instance public key

**Server (LAMA) uses regular `CryptoApi`:**
```javascript
// In acceptWithEncryption
const cryptoApi = /* one of the CryptoApi objects from cryptoApis array */
```

##### Ephemeral Key Exchange Protocol

**Phase 2.1 - Client sends ephemeral public key:**
```javascript
// Client (connectWithEncryption line 68)
const tempKeyPair = tweetnacl.box.keyPair();
connection.send(cryptoApi.encryptAndEmbedNonce(tempKeyPair.publicKey));
```

Since `cryptoApi` is `SymmetricCryptoApiWithKeys`, this calls:
```javascript
// SymmetricCryptoApi.encryptAndEmbedNonce(data, nonce)
symmetricEncryptAndEmbedNonce(tempKeyPair.publicKey, this.#symmetricKey, undefined)
```
Result: 72 bytes = 32 (encrypted key) + 24 (nonce) + 16 (MAC)

**Phase 2.2 - Server receives and decrypts:**
```javascript
// Server (acceptWithEncryption line 222-223)
const encKey = await connection.promisePlugin().waitForBinaryMessage();
const publicKeyOther = cryptoApi.decryptWithEmbeddedNonce(encKey, remotePublicKey);
```
✅ This works! Server successfully decrypts the 72-byte message.

**Phase 2.3 - Server sends its ephemeral public key:**
```javascript
// Server (acceptWithEncryption line 233-234)
const tempKeyPair = tweetnacl.box.keyPair();
connection.send(cryptoApi.encryptAndEmbedNonce(tempKeyPair.publicKey, remotePublicKey));
```

**Phase 2.4 - Both derive shared key:**
```javascript
// Client line 74 & Server line 237
const sharedKey = tweetnacl.box.before(publicKeyOther, tempKeyPair.secretKey);
```

**Phase 2.5 - Both create EncryptionPlugin:**
```javascript
// Client (line 76): false = odd nonces (1,3,5...)
connection.addPlugin(new EncryptionPlugin(sharedKey, false), {before: 'promise'});

// Server (line 240): true = even nonces (0,2,4...)  
connection.addPlugin(new EncryptionPlugin(sharedKey, true), {before: 'promise'});
```

##### The 197-byte Message

After encryption setup, the client immediately sends something that results in a 197-byte encrypted message. This happens AFTER `connectWithEncryption` returns but BEFORE the server sends its ephemeral key response.

The sequence of events suggests the CommServer relay issue:
1. Server receives client's ephemeral key (72 bytes) ✅
2. Server sends its ephemeral key back
3. But client may have already proceeded without waiting for server's key
4. Client sends next protocol message (197 bytes)
5. Server receives 197 bytes but hasn't established same shared key

##### The Real Problem

The 197-byte message arrives at the server BEFORE the client has received the server's ephemeral key! This is the CommServer relay timing issue:

1. Client sends ephemeral key
2. Server receives it, sends response  
3. CommServer forwards client's NEXT message (197 bytes) before forwarding server's response
4. Server tries to decrypt with shared key derived from exchanged keys
5. Client encrypted with different key (hasn't received server's ephemeral key yet)

This is a fundamental race condition in the CommServer relay protocol.

## The 197-byte Message Bug - Complete Analysis

### Summary
The 197-byte message is the encrypted `connection_group` command that fails decryption due to a timing issue in the CommServer relay protocol. The client sends this message before the encryption handshake is fully synchronized.

### The Message Breakdown

#### What the 197-byte message contains:
```json
{"command":"connection_group","connectionGroupName":"pairing"}
```
- Unencrypted: ~63 bytes
- Encrypted with padding and MAC: 197 bytes
- Sent immediately after `connectWithEncryption` completes

### The Root Cause: CommServer Message Ordering

The bug occurs because CommServer doesn't guarantee message ordering during the handshake:

1. **Client sends ephemeral key** (72 bytes)
2. **Server receives it and sends response**
3. **Client proceeds without waiting** - sends `connection_group` (197 bytes)
4. **CommServer relays messages out of order**:
   - Client's 197-byte message arrives at server
   - Server's ephemeral key response still in transit
5. **Encryption mismatch**:
   - Server tries to decrypt with shared key
   - Client encrypted with different key state
   - Decryption fails

### Why This is a CommServer-Specific Issue

#### Direct Connection (Works)
```
Client ──────────► Server
       ephemeral
       
Server ──────────► Client  
       ephemeral
       
[Both derive same shared key]

Client ──────────► Server
       197-byte encrypted message
       ✅ Decrypts successfully
```

#### CommServer Relay (Fails)
```
Client ──────────► CommServer ──────────► Server
       ephemeral                          
                                          
Server ──────────► CommServer ──┐         
       ephemeral                │
                                │ (delayed/reordered)
Client ──────────► CommServer ──┼────────► Server
       197-byte message         │          ❌ Can't decrypt
                                │          (wrong key state)
                                └────────► Client
                                           (arrives late)
```

### The Fix Applied

We fixed the server-side nonce initialization bug:

```javascript
// Before (EncryptionPlugin.js constructor):
this.remoteNonceCounter = -1;  // Wrong! First decrypt would use nonce -1

// After:
this.remoteNonceCounter = 1;   // Correct! First decrypt uses nonce 1
```

However, this only fixes part of the issue. The CommServer message ordering problem remains.

### Workaround for CommServer Connections

To work around the CommServer relay issue, we need to ensure proper synchronization:

1. **Add explicit acknowledgment** after ephemeral key exchange
2. **Delay sending connection_group** until handshake confirmed
3. **Implement retry logic** with backoff for failed decryptions
4. **Use direct connections** when possible (federation via port 8765)

### Testing the Fix

To verify the fix works:

1. **Direct connection test** (should work):
   ```bash
   # Both instances on same machine
   # Browser connects to Node.js on ws://localhost:8765
   ```

2. **CommServer relay test** (may still fail):
   ```bash
   # Instances on different networks
   # Both use wss://comm10.dev.refinio.one
   ```

### Long-term Solution

The proper fix requires changes to ONE.models library:
1. Make CommServer preserve message ordering during handshake
2. Or redesign the protocol to be order-independent
3. Or add explicit synchronization points in the protocol

## The Real Issue: We're Misusing Spare Connections

### The Problem
We're incorrectly trying to handle the pairing protocol on ALL spare connections simultaneously. The correct behavior (as implemented in production systems) is to use ONE connection for pairing and keep the spares for later protocol phases.

### How Spare Connections Should Be Used
CommServer creates ONE spare connection (as configured) for protocol handover:
1. Client sends pairing request to CommServer
2. ONE connection is used for the pairing protocol
3. Spare connection(s) are held ready for later use after handover
4. We're wrongly trying to run pairing on all connections simultaneously

### The Encryption State Problem
Each connection has its own EncryptionPlugin with separate nonce counters:
- Connection 3: EncryptionPlugin with nonces starting at 0/1
- Connection 9: Different EncryptionPlugin with its own nonces
- Connection 14: Yet another EncryptionPlugin instance

When a pairing message encrypted for connection 3 arrives on connection 14, decryption fails because:
1. Different shared keys (derived from different ephemeral keys)
2. Different nonce counters (each connection tracks its own)
3. The message was never meant for that connection

### Correct Behavior (as in one.leute.replicant)
The proper handling should be:
1. **Accept first connection for pairing**: Use ONE connection for the handshake
2. **Keep spares idle**: Don't process pairing messages on spare connections
3. **After pairing succeeds**: Use spare connections for data exchange
4. **Protocol isolation**: Pairing protocol confined to single connection

### Why This Happens
We're treating every incoming connection as if it should handle the full pairing protocol:
```javascript
// Our buggy behavior - WRONG
onConnection(conn) {
  // Every connection tries to handle pairing
  acceptWithEncryption(conn)
  handlePairingProtocol(conn)  // ❌ Running on ALL connections = chaos
}

// Correct behavior (as in production)
onConnection(conn) {
  if (isPairingConnection(conn)) {
    handlePairingProtocol(conn)  // ✅ Only the designated pairing connection
  } else {
    keepAsSpare(conn)           // ✅ Spares wait for handover
  }
}
```

### The Fix Required
We need to fix our implementation to match production behavior:
1. Use ONE connection for the pairing protocol
2. Keep spare connections idle until needed for handover
3. Don't try to run pairing on multiple connections simultaneously
4. Let ConnectionsModel properly manage spare connections

This is NOT a CommServer issue - CommServer works correctly. This is our implementation bug where we're misusing the spare connections that are meant for later protocol phases.

## References

- `/init.md` - Overall initialization flow
- `/FEDERATION-ARCHITECTURE.md` - Federation design
- `/packages/one.models/src/misc/ConnectionEstablishment/` - Connection code
- `/main/core/node-one-core.js` - Node.js instance setup
- `/electron-ui/src/models/AppModel.ts` - Browser connection setup
- `/src/one.leute.replicant/` - Reference implementation that handles this correctly