# LAMA Electron WebSocket Connection Flow Analysis

## Root Cause Analysis - SIMPLIFIED

### The Core Issue
Browser and Node.js instances with the same person ID cannot connect via ConnectionsModel. The solution: use different person IDs for browser and Node instances.

## Actual Connection Issues Identified

### 1. **Key Type Mismatch in Pairing Invitations**
**Primary Issue**: PairingManager creates invitations with person-based keys, but WebSocket connections expect instance-based keys.

**Node.js Invitation Creation** (in `node-provisioning.js`):
```javascript
// PairingManager.createInvitation() returns person-based publicKey
const invitation = await nodeOneCore.connectionsModel.pairing.createInvitation()

// But WebSocket server registers instance-based CryptoApi
const instanceKeys = await getDefaultKeys(instanceId)  // Instance keys needed!
```

**Browser Connection Attempt**:
```javascript
// Browser tries to connect using person-based publicKey from invitation
connectionResult = await pairingManager.connectUsingInvitation(invitation, this.ownerId)
// Server expects instance-based publicKey for decryption
```

### 2. **Instance Identity Flow (CORRECT USAGE)**
Each ONE.core instance has:
- **Person ID**: `getInstanceOwnerIdHash()` - WHO owns the instance 
- **Instance ID**: `getInstanceIdHash()` - WHICH device/instance this is
- **Instance Keys**: Used for WebSocket encryption/decryption
- **Person Keys**: Used for identity verification only

**OneInstanceEndpoint Structure**:
```javascript
{
  $type$: 'OneInstanceEndpoint',
  personId: this.ownerId,        // WHO (same for browser & node)
  instanceId: instanceId,        // WHICH device (different for each)
  personKeys: personKeys,        // Identity verification
  instanceKeys: instanceKeys,    // Connection encryption ← THIS is what matters
  url: 'ws://localhost:8765'
}
```

**Browser Side (Client)** - ✅ WORKS:
```javascript
// connectWithEncryption in EncryptedConnectionHandshake.js
const connection = new Connection(createWebSocket(url), 5000);
connection.addPlugin(new PromisePlugin(), { after: 'websocket' }); // ✅ Plugin added
```

**Server Side (Node.js)** - Status depends on ONE.models version:
```javascript
// acceptWithEncryption in EncryptedConnectionHandshake.js  
const connection = new Connection(ws);
// PromisePlugin addition varies by version
const request = await waitForUnencryptedClientMessage(connection, 'communication_request');
```

### 4. **Connection Registration Mismatch**
**Node.js ConnectionsModel Setup**:
```javascript
// ConnectionsModel registers CryptoApi with instance-based keys
this.connectionsModel = new ConnectionsModel(this.leuteModel, {
  // ...config includes instance-based CryptoApi registration
})
```

**PairingManager Invitation**:
```javascript
// But PairingManager.createInvitation() uses person-based keys  
const invitation = await this.connectionsModel.pairing.createInvitation()
// invitation.publicKey = person-based key (WRONG for WebSocket server)
```

## Architecture Analysis - CORRECTED

### Federation Connection Flow (Different Person IDs)
```
Browser Instance                      Node.js Instance
├── Person ID: hash("user@lama.local") ←→ Person ID: hash("demo-node@lama.local") [DIFFERENT]
├── Instance ID: browser-specific      ←→ Instance ID: node-specific               [DIFFERENT] 
├── Instance Keys: browser crypto      ←→ Instance Keys: node crypto               [DIFFERENT]
└── WebSocket: outgoing only           ←→ WebSocket: listener :8765                [COMPLEMENTARY]
```

### Simplified Connection Establishment
1. **Node.js**: Initializes with `demo-node@lama.local` identity
2. **Browser**: Initializes with `user@lama.local` identity  
3. **Node.js**: ConnectionsModel creates socket listener on :8765
4. **Node.js**: Creates OneInstanceEndpoint advertising ws://localhost:8765
5. **Browser**: ConnectionsModel discovers Node's endpoint (different person ID)
6. **Browser**: Connects to ws://localhost:8765
7. **Both**: ConnectionsModel handles endpoint sync and CHUM protocol automatically

## Implementation Summary

The key insight: ConnectionsModel won't connect instances with the same person ID. By giving the Node instance a different identity (`demo-node@lama.local`), we enable automatic federation between browser and Node instances.

### What ConnectionsModel Does Automatically
- Creates and syncs OneInstanceEndpoints
- Discovers endpoints from other person IDs
- Establishes WebSocket connections
- Handles CHUM protocol for data sync

### Our Changes
1. Node uses `demo-node@lama.local` instead of user's email
2. Removed redundant manual endpoint creation
3. Let ConnectionsModel handle all connection logic

## Current Status

| Component | Status | Issue |
|-----------|---------|-------|
| WebSocket Server | ✅ Working | Port 8765 listening correctly |
| Browser WebSocket Connection | ✅ Working | Connects to ws://localhost:8765 |
| Invitation Creation | ❌ **KEY MISMATCH** | Person keys vs Instance keys |
| CryptoApi Registration | ❌ **MISALIGNED** | Instance keys not matching invitation |
| Connection Handshake | ❌ **FAILS** | Key decryption failure |
| CHUM Protocol | ❌ **NEVER STARTS** | Connection drops before CHUM |

## Root Cause - CRITICAL BUG IN ONE.MODELS

### The Bug Location
`/node_modules/@refinio/one.models/lib/misc/ConnectionEstablishment/protocols/ConnectToInstance.js` line 15

### The Code Flow

#### Server Side (Creating Invitation)
```javascript
// PairingManager.createInvitation() - CORRECT
const defaultInstance = await getLocalInstanceOfPerson(myPersonId);
const defaultInstanceKeys = await getDefaultKeys(defaultInstance);
const keys = await getObject(defaultInstanceKeys);
return {
    token: token,
    publicKey: keys.publicKey,  // Instance keys - CORRECT
    url: this.url
};
```

#### Client Side (Connecting with Invitation)
```javascript
// connectToInstance() - BUG HERE
const cryptoApi = await createCryptoApiFromDefaultKeys(myPersonId); // WRONG - uses person keys
const myInstanceId = await getLocalInstanceOfPerson(myPersonId);
// Should use myInstanceId for CryptoApi!
```

### Socket Listener Architecture

#### How Direct Socket Listeners Work
1. **IncomingConnectionManager** manages WebSocket servers
2. **Registration**: When socket listener starts, it registers CryptoApis in `registeredPublicKeys` map
3. **Multiple Keys**: One socket can handle multiple CryptoApis (different instances)
4. **Accept Flow**: When connection arrives, ALL registered CryptoApis are passed to `acceptWithEncryption`
5. **Key Matching**: Server checks if requested `targetPublicKey` matches any registered CryptoApi

#### The Mismatch
1. **Invitation**: Contains instance publicKey (from `getLocalInstanceOfPerson`)
2. **Socket Listener**: Registers instance CryptoApi correctly
3. **Client Connect**: Uses PERSON keys instead of instance keys
4. **Result**: Server can't find matching CryptoApi, decryption fails

### Two Pairing Scenarios

1. **External Pairing (via commserver)**
   - Browser creates invitation with commserver URL
   - Other browsers/devices connect via commserver
   - Uses standard ONE.models pairing protocol
   
2. **Internal Federation (ws://localhost)**  
   - Browser connects to local Node.js instance
   - Uses same pairing protocol but with local WebSocket
   - Node.js acts as archive/compute backend

### Fix Applied

Fixed `connectToInstance` in ONE.models to use instance keys consistently. This should resolve both commserver and local WebSocket pairing.

## Socket Listener Configuration in ConnectionsModel

### Setting up Direct Socket Listeners

```javascript
// In ConnectionsModel constructor options:
{
  incomingConnectionConfigurations: [
    {
      type: 'socket',
      host: 'localhost',
      port: 8765,
      catchAll: true  // IMPORTANT: Must be true for catch-all routes
    }
  ]
}
```

### How ConnectionsModel Processes Socket Config

1. **LeuteConnectionsModule.init()** processes `incomingConnectionConfigurations`
2. For each config with `catchAll: true` and `type: 'socket'`:
   - Calls `connectionRouteManager.addIncomingWebsocketRouteCatchAll_Direct()`
   - Creates `IncomingWebsocketRouteDirect` with the instance CryptoApi
   - Initially disabled (`disabled: true`)
   - Calls `enableCatchAllRoutes()` to start the listener

3. **IncomingWebsocketRouteDirect.start()** calls:
   - `incomingConnectionManager.listenForDirectConnections()`
   - Creates WebSocket server on specified host:port
   - Registers the CryptoApi in `registeredPublicKeys` map

### The CryptoApi Registration Chain

```
ConnectionsModel.init()
  → LeuteConnectionsModule.init()
    → Processes incomingConnectionConfigurations
      → Creates IncomingWebsocketRouteDirect
        → Calls IncomingConnectionManager.listenForDirectConnections()
          → Creates WebSocket server
          → Registers CryptoApi in registeredPublicKeys map
```

## Key Takeaways

- ✅ **WebSocket infrastructure works correctly**
- ✅ **Socket listeners start automatically from config**
- ❌ **ONE.models bug: connectToInstance uses wrong keys**
- 🔧 **Fix**: Patch connectToInstance to use instance keys for CryptoApi