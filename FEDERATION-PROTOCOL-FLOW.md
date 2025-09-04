# Federation Protocol Flow

## Problem Statement
Browser and Node.js instances have different person IDs but cannot connect because:
1. They are NOT contacts of each other
2. OneInstanceEndpoint discovery only works for established contacts
3. No automatic contact creation is happening

## Current State
- Browser Person ID: `90d997fc...` (email: `demo@lama.local`)
- Node.js Person ID: `a5ab7b00...` (email: `node-demo@lama.local`)
- Both instances create OneInstanceEndpoints successfully
- Node.js listens on ws://localhost:8765
- Browser's ConnectionsModel with `acceptUnknownPersons: true` is initialized
- BUT: No connection established because they're not contacts

## Protocol Flow (What Should Happen)

### Phase 1: Instance Initialization
✅ **Browser Instance**
1. User logs in with username/password
2. SingleUserNoAuth.register() with email: `demo@lama.local`
3. Person ID generated: `90d997fc...`
4. ONE.core initialized with browser platform

✅ **Node.js Instance** (via IPC provision:node)
1. Receives provisioning request from browser
2. SingleUserNoAuth.register() with email: `node-demo@lama.local`  
3. Person ID generated: `a5ab7b00...`
4. ONE.core initialized with Node platform
5. Socket listener started on ws://localhost:8765

### Phase 2: Contact Establishment (MISSING!)
❌ **What's Missing**: Browser and Node must become contacts BEFORE endpoint discovery

**Option A: Manual Contact Addition**
- Browser explicitly adds Node.js person as contact
- Node.js explicitly adds Browser person as contact
- Requires exchanging person IDs between instances

**Option B: Pairing/Invitation Flow**
- Node.js creates pairing invitation
- Browser accepts invitation via pairing code
- Automatically establishes bidirectional contact

**Option C: Local Trust**
- Special case for same-device instances
- Auto-trust based on shared secret or IPC verification

### Phase 3: Endpoint Creation & Discovery
✅ **Node.js Creates Endpoint**
```javascript
await createOneInstanceEndpoint({
  name: 'LAMA-Node',
  url: 'ws://localhost:8765'
})
```

⚠️ **Browser Discovers Endpoint** (Only works if contact exists!)
```javascript
// ConnectionsModel iterates contacts
for (const contact of contacts) {
  // Retrieves OneInstanceEndpoints for contact
  const endpoints = await contact.endpoints()
  // Only finds endpoints if contact relationship exists!
}
```

### Phase 4: Connection Establishment
⚠️ **Browser Connects** (Blocked by missing contact)
```javascript
await connectToEndpoint({
  url: 'ws://localhost:8765',
  personId: nodePersonId // Must be a contact!
})
```

### Phase 5: CHUM Synchronization
⚠️ **Data Sync** (Blocked by no connection)
- Channels synchronized
- Messages replicated
- State updates propagated

## Root Cause Analysis

The fundamental issue is that `acceptUnknownPersons: true` in ConnectionsModel doesn't help with:
1. **Discovery**: OneInstanceEndpoints are only discovered for existing contacts
2. **Initial Contact**: There's no mechanism to add the Node.js person as a contact

## Solution Approaches

### 1. Pairing Flow (Recommended)
During `provision:node`, return a pairing invitation:
```javascript
// Node.js side
const pairingInvite = await createPairingInvite()
return { 
  nodeId, 
  endpoint, 
  pairingInvite: pairingInvite.raw 
}

// Browser side  
await acceptPairingInvite(nodeResult.pairingInvite)
```

### 2. Direct Contact Addition
Exchange person IDs via IPC and add contacts:
```javascript
// Browser adds Node as contact
await leuteModel.addContact(nodePersonId)

// Node adds Browser as contact (via IPC)
await nodeInstance.addContact(browserPersonId)
```

### 3. Shared Secret Trust
Use the shared login credentials as trust basis:
```javascript
// Both instances use same secret for initial trust
const sharedSecret = hash(username + password)
await establishLocalTrust(sharedSecret)
```

## Current Code Locations

**Contact Management**:
- `/electron-ui/src/models/AppModel.ts:setupNodeConnection()` - Missing contact setup
- `/main/core/node-one-core.js:provisionNode()` - Could return pairing data

**Connection Discovery**:
- `ConnectionsModel` - Only discovers endpoints for contacts
- `LeuteConnectionsModule` - Manages the discovery process

**Missing Implementation**:
- No pairing invitation creation in Node.js provisioning
- No pairing acceptance in browser after provisioning
- No IPC channel for exchanging person IDs
- No mechanism to establish initial contact relationship

## Next Steps

1. **Implement Pairing Flow**:
   - Node.js creates pairing invitation during provisioning
   - Browser accepts invitation after receiving provision response
   - Contact relationship automatically established

2. **Or Simple IPC Exchange**:
   - Browser sends its person ID to Node via IPC
   - Node adds browser as contact
   - Node sends its person ID back
   - Browser adds Node as contact

3. **Then Connection Works**:
   - ConnectionsModel discovers Node's endpoint
   - Connection established to ws://localhost:8765
   - CHUM sync begins