# Contact Acceptance Flow

## Overview

The contact acceptance system implements a two-phase process for establishing trusted relationships between peers in the LAMA Electron application. This ensures users have full control over who they connect with and what permissions they grant.

## Architecture

### Two-Phase Contact Flow

```
Phase 1: Discovery & Pending Review
┌─────────────┐     VC Exchange      ┌─────────────┐
│   Peer A    │ ◄──────────────────► │   Peer B    │
│  (Sender)   │    via QUIC-VC       │ (Receiver)  │
└─────────────┘                      └─────────────┘
                                            │
                                            ▼
                                    ┌──────────────┐
                                    │   Pending    │
                                    │   Contacts   │
                                    │     List     │
                                    └──────────────┘
                                            │
Phase 2: User Decision                     ▼
                                    ┌──────────────┐
                                    │  UI Review   │
                                    │   Dialog     │
                                    └──────────────┘
                                         │    │
                              Accept ────┘    └──── Reject
                                 │                    │
                                 ▼                    ▼
                          ┌─────────────┐    ┌─────────────┐
                          │  Create     │    │   Notify    │
                          │  Contact    │    │   Sender    │
                          └─────────────┘    └─────────────┘
                                 │
                                 ▼
                          ┌─────────────┐
                          │  Dedicated  │
                          │     VC      │
                          │  Exchange   │
                          └─────────────┘
```

## Components

### 1. ContactAcceptanceManager (`main/core/contact-acceptance-manager.js`)

Central manager for the contact acceptance flow:

```javascript
class ContactAcceptanceManager {
  // Phase 1: Store pending contacts
  async addPendingContact(credential, peerId, connectionInfo)
  
  // Get pending contacts for UI
  getPendingContacts()
  getPendingContact(pendingId)
  
  // Phase 2: User decision
  async acceptContact(pendingId, options)
  async rejectContact(pendingId, reason)
  
  // Contact management
  async createDedicatedVC(pendingContact, options)
  async createOneContact(pendingContact, dedicatedVC)
  
  // VC operations
  async handleReceivedDedicatedVC(dedicatedVC, peerId)
  async revokeContactVC(personId)
}
```

### 2. QUIC-VC Transport Integration (`main/core/quic-vc-transport.js`)

Handles the network layer of contact exchange:

```javascript
// Initial VC exchange
async handleVCExchange(vc, peerId) {
  // Verify credential
  const isValid = await this.verifyCredential(vc)
  
  if (isValid) {
    // Add to pending contacts for user review
    const pendingId = await this.contactManager.addPendingContact(
      vc, 
      peerId, 
      connectionInfo
    )
  }
}

// After contact acceptance
async handleContactAccepted(event) {
  // Initialize CHUM sync for the new contact
  await this.initializeChumSync(event.personId)
}
```

### 3. IPC Handlers (`main/ipc/handlers/contacts.js`)

Bridge between Node.js backend and Electron renderer:

```javascript
// Pending contact operations
ipcMain.handle('contacts:pending:list')
ipcMain.handle('contacts:pending:get')
ipcMain.handle('contacts:pending:accept')
ipcMain.handle('contacts:pending:reject')

// Contact management
ipcMain.handle('contacts:list')
ipcMain.handle('contacts:add')
ipcMain.handle('contacts:remove')
ipcMain.handle('contacts:revoke')

// Real-time events to renderer
- 'contacts:pending:new'
- 'contacts:accepted'
- 'contacts:vc:received'
```

### 4. UI Components (To be implemented)

```typescript
// Pending contacts list
<PendingContactsList>
  - Shows all pending contact requests
  - Displays contact info (name, ID, capabilities)
  - Quick accept/reject actions

// Contact review dialog
<ContactReviewDialog>
  - Detailed contact information
  - Credential verification status
  - Permission configuration
  - Accept/Reject with reason

// Contact status indicator
<ContactStatusIndicator>
  - Shows mutual acceptance status
  - Indicates active connections
  - VC validity status
```

## Data Structures

### Verifiable Credential (Initial Exchange)

```javascript
{
  $type$: 'VerifiableCredential',
  issuer: 'SHA256IdHash<Person>',
  subject: 'SHA256IdHash<Person>',
  instanceId: 'SHA256Hash',
  instanceName: 'string',
  publicKey: 'base64-encoded-key',
  capabilities: ['chum', 'quic-vc'],
  issuedAt: timestamp,
  expiresAt: timestamp,
  signature: 'base64-signature'
}
```

### Dedicated Contact VC (After Acceptance)

```javascript
{
  $type$: 'ContactVerifiableCredential',
  issuer: 'my-person-id',
  subject: 'contact-person-id',
  
  relationship: {
    type: 'contact',
    establishedAt: timestamp,
    acceptedBy: 'my-person-id',
    acceptedAt: timestamp,
    nickname: 'optional-nickname',
    groups: ['friends', 'work'],
    tags: ['trusted'],
    notes: 'optional-notes'
  },
  
  contactInfo: {
    personId: 'contact-person-id',
    instanceId: 'contact-instance-id',
    instanceName: 'Contact Device',
    publicKey: 'contact-public-key'
  },
  
  permissions: {
    canMessage: true,
    canCall: false,
    canShareFiles: false,
    canSeePresence: true,
    customPermissions: {}
  },
  
  issuedAt: timestamp,
  expiresAt: timestamp,
  revocable: true,
  vcId: 'unique-vc-id',
  signature: 'base64-signature'
}
```

### Pending Contact Display Info

```javascript
{
  id: 'pending-contact-id',
  displayInfo: {
    name: 'Contact Name',
    personId: 'SHA256IdHash',
    instanceId: 'SHA256Hash',
    capabilities: ['chum', 'quic-vc'],
    publicKey: 'base64-key',
    issuer: 'issuer-id',
    expiresAt: timestamp
  },
  receivedAt: timestamp
}
```

## User Flow

### 1. Receiving a Contact Request

```
1. Peer discovers via UDP broadcast
2. VC exchange over QUIC transport
3. ContactAcceptanceManager stores as pending
4. UI notification appears
5. User opens pending contacts list
```

### 2. Reviewing a Contact

```
1. User clicks on pending contact
2. Contact details dialog opens
3. Shows:
   - Contact name and ID
   - Instance information
   - Capabilities
   - Credential validity
4. User can:
   - Set nickname
   - Configure permissions
   - Add to groups
   - Add notes
```

### 3. Accepting a Contact

```
1. User clicks Accept
2. System creates:
   - Person object
   - Profile with endpoint
   - Someone object
   - Adds to LeuteModel
3. Generates dedicated VC
4. Sends dedicated VC to peer
5. Initializes CHUM sync
6. Contact appears in contacts list
```

### 4. Mutual Acceptance

```
1. Both peers must accept each other
2. Dedicated VCs are exchanged
3. Mutual acceptance flag is set
4. Full communication enabled
5. CHUM sync activated for shared channels
```

## Security Considerations

### Credential Verification

- All VCs are cryptographically signed
- Signature verification using public keys
- Expiration dates are enforced
- Revocation checks are performed

### Permission Model

- Fine-grained permissions per contact
- Default minimal permissions (messaging + presence)
- User must explicitly grant additional permissions
- Permissions can be revoked at any time

### Privacy Protection

- No automatic contact acceptance
- User reviews all information before accepting
- Contacts can be rejected with reason
- Rejected contacts are notified but not given details

## Implementation Status

### ✅ Completed

- ContactAcceptanceManager class
- Two-phase acceptance flow
- Pending contact storage
- Dedicated VC generation
- ONE.core contact creation
- QUIC-VC transport integration
- CHUM sync initialization
- IPC handlers for UI communication
- Event system for real-time updates

### 🚧 In Progress

- UI components for pending contacts
- Contact review dialog
- Permission configuration UI
- Contact status indicators

### 📋 TODO

- Persistence of pending contacts across restarts
- Contact import/export functionality
- Bulk contact operations
- Contact verification UI (QR codes, etc.)
- Contact search and filtering
- Group management for contacts
- Advanced permission templates

## Testing

### Manual Testing Flow

1. **Start two instances** of LAMA Electron
2. **Enable QUIC discovery** on both
3. **Wait for discovery** (UDP broadcast)
4. **Check pending contacts** list
5. **Review contact** details
6. **Accept/Reject** contact
7. **Verify dedicated VC** exchange
8. **Test CHUM sync** between contacts

### Automated Tests

```javascript
// Test contact acceptance
describe('ContactAcceptanceManager', () => {
  it('should add pending contact')
  it('should accept contact and create objects')
  it('should reject contact with reason')
  it('should generate dedicated VC')
  it('should verify received dedicated VC')
  it('should revoke contact VC')
})

// Test QUIC-VC integration
describe('QUIC-VC Contact Exchange', () => {
  it('should exchange initial VCs')
  it('should store pending contacts')
  it('should handle acceptance flow')
  it('should initialize CHUM sync')
  it('should respect channel permissions')
})
```

## Configuration

### Settings

```javascript
{
  contacts: {
    autoAccept: false,          // Never auto-accept
    requireMutual: true,        // Require mutual acceptance
    vcValidityDays: 365,        // VC expiration period
    defaultPermissions: {       // Default permissions
      canMessage: true,
      canCall: false,
      canShareFiles: false,
      canSeePresence: true
    },
    pendingTimeout: 604800000,  // 7 days in ms
    maxPendingContacts: 100     // Limit pending list
  }
}
```

## Troubleshooting

### Common Issues

**Pending contact not appearing**
- Check QUIC-VC transport is running
- Verify UDP discovery on port 49497
- Check firewall settings
- Verify VC signature is valid

**Contact acceptance fails**
- Check ONE.core is initialized
- Verify LeuteModel is ready
- Ensure sufficient permissions
- Check storage availability

**Dedicated VC not received**
- Verify QUIC connection is active
- Check both peers accepted contact
- Verify network connectivity
- Check for VC expiration

**CHUM sync not working**
- Verify mutual acceptance
- Check channel permissions
- Verify CHUM adapter is initialized
- Check for sync conflicts

## API Reference

### IPC API

```typescript
// List pending contacts
await window.electronAPI.invoke('contacts:pending:list')
// Returns: { success: boolean, pendingContacts: PendingContact[] }

// Get specific pending contact
await window.electronAPI.invoke('contacts:pending:get', pendingId)
// Returns: { success: boolean, pendingContact: PendingContact }

// Accept contact
await window.electronAPI.invoke('contacts:pending:accept', pendingId, {
  nickname: 'Friend',
  groups: ['personal'],
  canCall: true
})
// Returns: { success: boolean, personId: string, contact: Contact }

// Reject contact
await window.electronAPI.invoke('contacts:pending:reject', pendingId, 'Not interested')
// Returns: { success: boolean }
```

### Event Listeners

```typescript
// New pending contact
window.electronAPI.on('contacts:pending:new', (data) => {
  // data: { id, displayInfo, receivedAt }
})

// Contact accepted
window.electronAPI.on('contacts:accepted', (data) => {
  // data: { pendingId, personId, contact, dedicatedVC }
})

// Dedicated VC received
window.electronAPI.on('contacts:vc:received', (data) => {
  // data: { personId, dedicatedVC, peerId }
})
```

## Future Enhancements

### Planned Features

1. **Contact Verification**
   - QR code exchange for in-person verification
   - Fingerprint comparison
   - Social proof integration

2. **Advanced Permissions**
   - Time-based permissions
   - Location-based permissions
   - Content-type permissions

3. **Contact Discovery**
   - DNS-based discovery
   - DHT-based discovery
   - Social graph traversal

4. **Federation**
   - Cross-instance contact sync
   - Contact recommendation system
   - Trust network visualization

5. **Backup & Recovery**
   - Contact export/import
   - Encrypted contact backups
   - Contact recovery mechanisms