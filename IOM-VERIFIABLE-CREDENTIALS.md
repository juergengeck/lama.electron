# IoM Verifiable Credentials System

## Overview

IoM (Internet of Me) devices can have different identities but prove membership through Verifiable Credentials (VCs). This allows users to maintain separate identities across devices while maintaining trust.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Internet of Me (IoM)                              │
│                                                                          │
│  ┌────────────────────┐                    ┌────────────────────┐      │
│  │   Master Device    │  Issues VCs         │  Secondary Device  │      │
│  │  Identity: Alice   │◄────────────────────┤  Identity: Bob     │      │
│  │  Role: Issuer      │  Verifies VCs       │  Role: Holder      │      │
│  └────────────────────┘                    └────────────────────┘      │
│           │                                           │                  │
│           └───────────────┬───────────────────────────┘                  │
│                           │                                              │
│                    Verifiable Credential                                 │
│                    "Bob is IoM member of Alice"                         │
└──────────────────────────────────────────────────────────────────────────┘
```

## Credential Structure

### IoM Membership Credential

```javascript
const iomCredential = {
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://one.core/contexts/iom/v1"
  ],
  
  // Credential metadata
  id: "urn:uuid:3978344f-8596-4c3a-a978-8fcaba3903c5",
  type: ["VerifiableCredential", "IoMMembershipCredential"],
  
  // Issuer (Master device/identity)
  issuer: {
    id: "did:one:alice-master-device",
    name: "Alice's Primary Device"
  },
  
  // When issued
  issuanceDate: "2024-01-01T00:00:00Z",
  expirationDate: "2025-01-01T00:00:00Z",
  
  // Subject (device requesting membership)
  credentialSubject: {
    id: "did:one:bob-secondary-device",
    
    // IoM membership claim
    iomMembership: {
      role: "member",              // member, admin, guest
      permissions: [
        "read",
        "write", 
        "sync",
        "delegate"
      ],
      
      // Storage permissions
      storagePolicy: {
        maxStorage: "10GB",
        allowedTypes: ["Message", "File", "Contact"],
        syncPriority: "normal"
      },
      
      // Delegation rights
      canIssueCredentials: false,
      maxDelegationDepth: 0
    }
  },
  
  // Cryptographic proof
  proof: {
    type: "Ed25519Signature2020",
    created: "2024-01-01T00:00:00Z",
    verificationMethod: "did:one:alice-master-device#keys-1",
    proofPurpose: "assertionMethod",
    proofValue: "z58DAdFfaGxWZPgVMvLKcNZcvVqfUvjhMvP..."
  }
}
```

## Authorization Flow

### 1. Device Onboarding

```javascript
class IoMOnboarding {
  async requestMembership(masterDevice, myIdentity) {
    // 1. Generate device identity
    const deviceDID = await this.generateDID(myIdentity)
    
    // 2. Create membership request
    const request = {
      requester: deviceDID,
      masterDevice: masterDevice,
      requestedPermissions: ['read', 'write', 'sync'],
      deviceInfo: {
        type: 'browser',
        platform: navigator.platform,
        storage: 'indexeddb'
      }
    }
    
    // 3. Sign request with device key
    const signedRequest = await this.signRequest(request)
    
    // 4. Send to master device (out-of-band)
    return await this.sendRequest(masterDevice, signedRequest)
  }
}
```

### 2. Master Device Issues Credential

```javascript
class IoMIssuer {
  async issueCredential(request) {
    // 1. Verify request signature
    if (!await this.verifyRequest(request)) {
      throw new Error('Invalid request signature')
    }
    
    // 2. User approves (UI interaction)
    const approval = await this.getUserApproval(request)
    if (!approval) {
      throw new Error('User denied request')
    }
    
    // 3. Create credential
    const credential = {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", "IoMMembershipCredential"],
      issuer: this.deviceDID,
      issuanceDate: new Date().toISOString(),
      expirationDate: this.calculateExpiry(),
      credentialSubject: {
        id: request.requester,
        iomMembership: approval.permissions
      }
    }
    
    // 4. Sign credential
    const signedCredential = await this.signCredential(credential)
    
    // 5. Store credential reference
    await this.storeIssuedCredential(signedCredential)
    
    return signedCredential
  }
}
```

### 3. Verifying Credentials During Sync

```javascript
class IoMVerifier {
  async verifyPeer(peerId, credential) {
    // 1. Verify credential structure
    if (!this.isValidCredentialFormat(credential)) {
      return false
    }
    
    // 2. Check if we trust the issuer
    const issuer = credential.issuer.id
    if (!await this.trustIssuer(issuer)) {
      return false
    }
    
    // 3. Verify cryptographic proof
    const valid = await this.verifyProof(credential)
    if (!valid) {
      return false
    }
    
    // 4. Check expiration
    if (this.isExpired(credential)) {
      return false
    }
    
    // 5. Verify subject matches peer
    if (credential.credentialSubject.id !== peerId) {
      return false
    }
    
    // 6. Extract and return permissions
    return credential.credentialSubject.iomMembership
  }
}
```

## Trust Models

### 1. Direct Trust
- Master device directly issues credentials to all members
- Simple but doesn't scale well

```javascript
const directTrust = {
  master: "did:one:alice-master",
  members: [
    { did: "did:one:alice-browser", credential: "..." },
    { did: "did:one:alice-mobile", credential: "..." },
    { did: "did:one:alice-tablet", credential: "..." }
  ]
}
```

### 2. Delegated Trust
- Master can delegate credential issuance to trusted devices
- Better scalability

```javascript
const delegatedTrust = {
  master: "did:one:alice-master",
  delegates: [
    {
      did: "did:one:alice-laptop",
      canIssue: true,
      maxDepth: 1,  // Can't create more delegates
      credential: "..."
    }
  ]
}
```

### 3. Federated Trust
- Multiple users can form trust federations
- Cross-IoM sharing

```javascript
const federatedTrust = {
  federation: "family-iom",
  members: [
    { iom: "did:one:alice-master", role: "admin" },
    { iom: "did:one:bob-master", role: "member" },
    { iom: "did:one:charlie-master", role: "member" }
  ],
  sharedCredentials: [...]
}
```

## Revocation

### Immediate Revocation

```javascript
class CredentialRevocation {
  async revokeCredential(credentialId) {
    // 1. Add to revocation list
    await this.revocationList.add({
      credentialId,
      revokedAt: new Date().toISOString(),
      reason: "deviceCompromised"
    })
    
    // 2. Broadcast revocation to all peers
    await this.broadcastRevocation(credentialId)
    
    // 3. Disconnect affected peer
    await this.disconnectPeer(credentialId)
  }
}
```

### Time-based Expiration

```javascript
const shortLivedCredential = {
  // ... credential fields ...
  expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  
  // Auto-renewal policy
  renewal: {
    automatic: true,
    renewBefore: 60 * 60 * 1000, // 1 hour before expiry
    maxRenewals: 30
  }
}
```

## Implementation in CHUM Sync

```javascript
class CHUMWithCredentials {
  constructor(instance) {
    this.instance = instance
    this.credentials = new Map()
    this.verifier = new IoMVerifier()
  }
  
  async connect(peerEndpoint, credential) {
    // 1. Establish connection
    const peer = await this.establishConnection(peerEndpoint)
    
    // 2. Exchange credentials
    await this.sendCredential(peer, credential)
    const peerCredential = await this.receiveCredential(peer)
    
    // 3. Verify peer credential
    const permissions = await this.verifier.verifyPeer(
      peer.id,
      peerCredential
    )
    
    if (!permissions) {
      await this.disconnect(peer)
      throw new Error('Invalid peer credential')
    }
    
    // 4. Store peer permissions
    this.credentials.set(peer.id, {
      credential: peerCredential,
      permissions
    })
    
    // 5. Start syncing with permission checks
    await this.startSync(peer, permissions)
  }
  
  async handleSyncRequest(peer, request) {
    // Check peer permissions for requested operation
    const permissions = this.credentials.get(peer.id)?.permissions
    
    if (!permissions) {
      throw new Error('No credentials for peer')
    }
    
    if (!this.checkPermission(request.type, permissions)) {
      throw new Error('Permission denied')
    }
    
    // Process sync request
    return await this.processSync(request)
  }
}
```

## Privacy Considerations

### Selective Disclosure

```javascript
const selectiveCredential = {
  // Only reveal necessary claims
  credentialSubject: {
    id: "did:one:device",
    iomMembership: {
      role: "member",
      // Hide specific permissions
      permissions: zkProof("hasPermission:sync")
    }
  }
}
```

### Anonymous Credentials

```javascript
const anonymousCredential = {
  // Use zero-knowledge proofs
  credentialSubject: {
    // Prove membership without revealing identity
    membershipProof: zkProof("isMemberOf:alice-iom"),
    // Prove permissions without specifics
    permissionProof: zkProof("canAccess:messages")
  }
}
```

## Configuration

```javascript
// config/iom-credentials.js
module.exports = {
  identity: {
    did: 'did:one:device-xxx',
    keys: {
      signing: 'ed25519-private-key',
      encryption: 'x25519-private-key'
    }
  },
  
  credentials: {
    storage: './credentials',
    
    issuance: {
      defaultExpiry: '30d',
      autoRenewal: true,
      requireUserApproval: true
    },
    
    verification: {
      trustedIssuers: [
        'did:one:alice-master',
        'did:one:trusted-authority'
      ],
      checkRevocation: true,
      allowExpired: false
    }
  },
  
  permissions: {
    default: ['read', 'sync'],
    admin: ['read', 'write', 'sync', 'delegate', 'revoke'],
    guest: ['read']
  }
}
```

## Benefits

1. **Multi-Identity Support**: Devices can maintain separate identities
2. **Fine-grained Permissions**: Control exactly what each device can do
3. **Revocation**: Instantly revoke compromised devices
4. **Privacy**: Selective disclosure and anonymous credentials
5. **Interoperability**: Standard W3C Verifiable Credentials format
6. **Delegation**: Devices can onboard other devices
7. **Audit Trail**: Track who has access to what

This system allows IoM devices to have different identities while maintaining trust and security through verifiable credentials!