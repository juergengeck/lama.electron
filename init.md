# LAMA Electron Initialization Flow

## The Architecture

This Electron app runs **TWO separate ONE.core instances** with distinct roles:

### Browser Instance (Renderer Process)
- **Location**: `/electron-ui/`
- **Platform**: Browser environment with IndexedDB
- **Role**: UI responsiveness, temporary storage, user interactions
- **State**: Managed locally in browser
- **Networking**: No pairing (disabled), no direct external connections

### Node.js Instance (Main Process)
- **Location**: `/main/core/node-one-core.js`
- **Platform**: Node.js with file system storage
- **Role**: Archive storage, network operations, external connections
- **State**: Provisioned from browser credentials
- **Networking**: ConnectionsModel with pairing, commserver connections

## The Critical Constraints

1. **Node.js Must Initialize First** - Browser needs pairing invitation from Node.js
2. **Browser Cannot Create Invitations** - Pairing is disabled in browser
3. **Node.js Handles All External Connections** - Via commserver (wss://comm10.dev.refinio.one)
4. **CHUM Sync Between Instances** - Automatic content replication
5. **Single Owner Identity** - Both instances share the same person ID

## The Correct Initialization Sequence

```javascript
// 1. User Login in Browser
await authenticator.loginOrRegister(username, password)
const ownerId = getInstanceOwnerIdHash()

// 2. Provision Node.js BEFORE AppModel.init()
await window.electronAPI.invoke('provision:node', {
  user: { id: ownerId, name: username, password: password },
  config: { storageRole: 'archive', capabilities: ['network', 'storage'] }
})

// 3. Node.js Initialization Sequence
await nodeOneCore.initialize(instanceName, password)
// - Sets storage directory
// - Checks if instance exists
// - Initializes ONE.core with recipes
// - Gets owner ID

await nodeOneCore.initializeModels()
// - LeuteModel with commserver URL
// - IoMManager with commserver URL
// - ChannelManager
// - TopicModel
// - ConnectionsModel with:
//   - commServerUrl
//   - acceptUnknownPersons: true
//   - allowPairing: true
//   - catch-all routes enabled

// 4. Create Pairing Invitation for Browser
const invitation = await connectionsModel.pairing.createInvitation()
stateManager.setState('browserInvite', { invitation, expiresAt })

// 5. Browser AppModel.init() - AFTER Node.js is ready
await appModel.init(ownerId)
// - Tries to get pairing invitation from Node.js
// - Connects to Node.js hub if invitation available
// - Sets up IoM connection for CHUM sync

// 6. Browser-Node Connection Established
// - CHUM protocol syncs content automatically
// - Contacts replicate from Node.js to browser
// - Messages sync between instances
```

## Key Connection Flow

### Creating External Invitations (Add Contact)
```javascript
// 1. UI requests invitation
await window.electronAPI.invoke('invitation:create')

// 2. Node.js creates invitation
const invitation = await nodeOneCore.connectionsModel.pairing.createInvitation()
const url = `https://edda.dev.refinio.one/invites/invitePartner/?invited=true/#${token}`

// 3. User shares invitation URL

// 4. When accepted, Node.js handles connection
// - Connection established via commserver
// - onConnectionsChange fires
// - Contact detected and logged
// - CHUM sync replicates to browser
```

### Contact Sync Flow
```javascript
// 1. Node.js detects new connection
connectionsModel.onConnectionsChange(() => {
  const others = await leuteModel.others()
  // Process contacts (access rights handled by CHUM)
})

// 2. Browser receives via CHUM sync
// - Contacts appear in LeuteModel automatically
// - UI updates through model events
```

### Message Exchange Flow
```javascript
// 1. Sending messages (Browser → External)
// Browser UI → IPC → Node.js chat handler
await window.electronAPI.invoke('chat:sendMessage', { conversationId, text })

// 2. Node.js sends via TopicModel
const topicRoom = await nodeInstance.topicModel.joinTopic(conversationId)
await topicRoom.sendMessage(text)
// Message syncs via ChannelManager → commserver → other instances

// 3. Receiving messages (External → Browser)
// commserver → Node.js ChannelManager.onUpdated()
channelManager.onUpdated((channelInfoIdHash, channelId, channelOwner, time, data) => {
  // Messages arrive here
  // CHUM automatically syncs to browser instance
})

// 4. Browser receives via CHUM
// Messages appear in TopicModel automatically
// UI updates through model events
```

## Common Issues and Solutions

### "No browser invitation available"
**Cause**: AppModel.init() called before Node.js provisioning
**Fix**: Provision Node.js BEFORE initializing AppModel

### "Browser cannot create invitations - pairing disabled"
**Cause**: Browser trying to create pairing invitation
**Fix**: Browser must get invitation FROM Node.js, not create one

### "Node.js instance not provisioned yet"
**Cause**: Trying operations before login/provisioning
**Fix**: Ensure login completes and provisions Node.js first

### "Key does not match your previous visit"
**Cause**: Stale connection data in storage
**Fix**: Clear `one-core-storage` directory and restart fresh

### "Invalid Set-Access request parameters"
**Cause**: Incorrect access rights creation format
**Fix**: Use array format: `createAccess([{...}])` not `createAccess({...})`

### "someoneElseIterator is not a function"
**Cause**: Using old API method name
**Fix**: Use `leuteModel.others()` instead of `someoneElseIterator()`

## File Locations

### Browser Instance
- `/electron-ui/src/services/browser-init-simple.ts` - Browser initialization
- `/electron-ui/src/models/AppModel.ts` - AppModel with IoM setup
- `/electron-ui/src/services/iom-client.ts` - IoM client for browser-node connection

### Node.js Instance
- `/main/core/node-one-core.js` - Node.js ONE.core instance
- `/main/hybrid/node-provisioning.js` - Provisioning from browser
- `/main/ipc/handlers/devices.js` - Invitation creation handler
- `/main/ipc/handlers/one-core.js` - Contact retrieval handler

### Shared
- `/main/state/manager.js` - State shared between instances
- `/electron-preload.js` - IPC bridge for browser-node communication

## State Management

### Browser State
- Login credentials stored temporarily
- Contacts synced from Node.js via CHUM
- Messages stored in IndexedDB
- UI state managed by React

### Node.js State
- Persistent storage in `one-core-storage/node/`
- Archive of all messages and contacts
- Network connections and pairing tokens
- Access rights and trust relationships

### Shared State (via StateManager)
- User authentication status
- Browser pairing invitation
- Configuration settings

## Network Architecture

### Browser Connections
- No direct external connections
- Connected to Node.js instance via internal pairing
- CHUM sync for content replication
- IPC for control operations

### Node.js Connections
- CommServer WebSocket (wss://comm10.dev.refinio.one)
- Catch-all routes for incoming connections
- Pairing protocol for new contacts
- CHUM protocol for content sync

## Security Considerations

1. **Password Handling** - Pass actual user password to Node.js, not hardcoded
2. **Invitation Expiry** - Set reasonable expiry times for pairing invitations
3. **Access Rights** - Let CHUM protocol handle access rights automatically
4. **State Isolation** - Browser and Node.js have separate storage

## Development Workflow

### Fresh Start
```bash
rm -rf one-core-storage
rm -rf ~/Library/Application\ Support/LAMA
NODE_ENV=development npx electron lama-electron-shadcn.js
```

### Testing Invitations
1. Login with test credentials
2. Go to Settings → Instances
3. Click "Add Contact" to get invitation
4. Use invitation in another instance
5. Check NodeJS Contacts shows new contact

### Debugging
- Check console for browser errors
- Check terminal for Node.js logs
- Look for provisioning order issues
- Verify ConnectionsModel initialization
- Check for catch-all routes registration

## Key Principles

1. **Node.js First** - Always provision Node.js before browser AppModel
2. **No Browser Pairing** - Browser never creates external invitations
3. **CHUM Handles Sync** - Don't manually sync data between instances
4. **CommServer for External** - All external connections via commserver
5. **IPC for Control** - Use IPC for control operations, CHUM for data

---

**Remember**: The browser is for UI, Node.js is for networking and storage. They work together through CHUM sync, not manual data copying.