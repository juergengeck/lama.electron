# Group Implementation Plan

## Target Workflow

### Topic Creation with Group-based Access

1. **Create Topic** → triggers:
2. **Create Group** (named after topic, contains participants)
3. **Grant Group access** to topic's channels (via IdAccess)
4. **Create Certificate** for the Group
5. **Share Group + Certificate** with participants (via objectFilter in topic channels)

### Example Flow

```typescript
// 1. Create topic "Project Alpha"
const topic = await createTopic("Project Alpha", [alice, bob, charlie]);

// 2. Create Group named "Project Alpha"
const group = await GroupModel.constructWithNewGroup("Project Alpha");
group.persons = [alice, bob, charlie];
await group.saveAndLoad();

// 3. Grant Group access to topic channels
await createAccess([{
    id: topic.channelInfoIdHash,
    person: [],
    group: [group.groupIdHash],  // Group has access
    mode: SET_ACCESS_MODE.ADD
}]);

// 4. Create certificate for this Group
const certificate = await createCertificateForGroup(group.groupIdHash);

// 5. Configure objectFilter to share Group + certificate in topic channels
await topic.setObjectFilter({
    allowTypes: ['Group', 'HashGroup', 'Certificate'],
    allowIds: [group.groupIdHash, certificate.idHash]
});
```

---

## Implementation Steps (Incremental)

### Step 1: Core Type Definitions
**File**: `lama.electron/reference/one.core.refinio/src/recipes.ts`

**Changes**:
```typescript
// Add HashGroup type
export interface HashGroup<T> {
    $type$: 'HashGroup';
    members: Array<SHA256IdHash<T>>;
}

// Update Group type
export interface Group {
    $type$: 'Group';
    name: string;
    hashGroup: SHA256IdHash<HashGroup<Person>>;  // Changed from: person: Array<...>
}
```

**Test**: Type definitions compile, no runtime changes yet

**Commit**: `feat: add HashGroup type and update Group schema`

---

### Step 2: GroupModel Updates
**File**: `lama.electron/packages/one.models/src/models/Leute/GroupModel.ts`

**Changes**:
- `constructWithNewGroup()`: Create empty HashGroup first
- `constructFromLatestProfileVersionByGroupName()`: Calculate groupIdHash with hashGroup
- `saveAndLoad()`: Create new HashGroup on member changes, update Group version
- `updateModelDataFromGroupAndProfile()`: Resolve HashGroup to get members
- Member diff logic: Resolve old HashGroup before comparing

**Test**: Create Group, add/remove members, verify HashGroup creation

**Commit**: `feat: update GroupModel to use HashGroup for members`

---

### Step 3: Access Resolution Updates
**File**: `lama.electron/reference/one.core.refinio/src/util/determine-accessible-hashes.ts`

**Changes**:
```typescript
// Old: Direct lookup Person → Group
const groupsContainingPerson = await getOnlyLatestReferencingObjsHashAndId(person, 'Group');

// New: Two-step Person → HashGroup → Group
const hashGroups = await getOnlyLatestReferencingObjsHashAndId(person, 'HashGroup');
const groupsContainingPerson = [];
for (const hg of hashGroups) {
    const groups = await getOnlyLatestReferencingObjsHashAndId(hg.idHash, 'Group');
    groupsContainingPerson.push(...groups);
}
```

**Test**: Grant access to Group, verify Person in HashGroup can access

**Commit**: `feat: update access resolution for HashGroup indirection`

---

### Step 4: AI Assistant Model Update
**File**: `lama.electron/main/core/ai-assistant-model.ts:284`

**Changes**:
```typescript
// Old:
const participants = group.person || []

// New:
const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
const hashGroup = await getObjectByIdHash(group.hashGroup)
const participants = hashGroup.obj.members || []
```

**Test**: AI assistant can still read group participants

**Commit**: `fix: resolve HashGroup in ai-assistant-model`

---

### Step 5: Topic Group Creation
**New functionality** - implement the workflow

**Files to create/modify**:
- Topic creation logic (wherever topics are created)
- Group creation helper
- Access granting helper

**Flow**:
```typescript
async function createTopicWithGroup(
    topicName: string,
    participants: SHA256IdHash<Person>[]
): Promise<{topic: Topic, group: GroupModel}> {
    // 1. Create Group named after topic
    const group = await GroupModel.constructWithNewGroup(topicName);
    group.persons = participants;
    await group.saveAndLoad();

    // 2. Create topic channels
    const topic = await createTopic(topicName);

    // 3. Grant Group access to channels
    await createAccess([{
        id: topic.channelInfoIdHash,
        person: [],
        group: [group.groupIdHash],
        mode: SET_ACCESS_MODE.ADD
    }]);

    return {topic, group};
}
```

**Test**: Create topic, verify Group created, verify access works

**Commit**: `feat: create topic-scoped Groups with automatic access`

---

### Step 6: AssertionVerifier Integration for Group Sharing
**Use AssertionVerifier pattern for topic Group sharing**

**Setup AssertionVerifier** (one-time, at app initialization):
```typescript
import { createAssertionVerifier } from '@refinio/one.models';

// During app/ConnectionsModel initialization
const instanceOwner = await leuteModel.me().mainIdentity();
const instanceId = /* get instance id */;

const assertionVerifier = createAssertionVerifier(instanceOwner, instanceId, {
    checkExpiration: false,  // Optional: enable expiration checking
    requireSignature: false   // Optional: require signatures
});

// Set objectFilter on ConnectionsModel
const connectionsModel = new ConnectionsModel({
    // ... other config
    objectFilter: assertionVerifier.createObjectFilter()
});
```

**Create Topic with Group Access**:
```typescript
async function createTopicWithGroupAccess(
    topicName: string,
    participants: SHA256IdHash<Person>[],
    assertionVerifier: AssertionVerifier
) {
    // 1. Create Group with participants
    const group = await GroupModel.constructWithNewGroup(topicName);
    group.persons = participants;
    await group.saveAndLoad();

    // 2. Get HashGroup reference
    const groupObj = await getObjectByIdHash(group.groupIdHash);
    const hashGroupIdHash = groupObj.obj.hashGroup;

    // 3. Create Assertions for Group and HashGroup
    // This marks them as "approved for sharing"
    await assertionVerifier.createAssertion(group.groupIdHash);
    await assertionVerifier.createAssertion(hashGroupIdHash);

    // 4. Create certificates for each participant
    for (const participant of participants) {
        const cert = await storeVersionedObject({
            $type$: 'AccessVersionedObjectCertificate',
            person: participant,
            data: group.groupIdHash,
            license: AccessVersionedObjectLicense.hash
        });

        // Also create assertion for certificate (optional)
        await assertionVerifier.createAssertion(cert.hash);
    }

    // 5. Grant Group access to topic channels
    await createAccess([{
        id: topic.channelInfoIdHash,
        person: [],
        group: [group.groupIdHash],
        mode: SET_ACCESS_MODE.ADD
    }]);

    return {
        group,
        groupIdHash: group.groupIdHash,
        hashGroupIdHash
    };
}
```

**How it works**:
1. **AssertionVerifier.createObjectFilter()** returns a filter function
2. Filter checks for **Assertion** objects that reference Group/HashGroup
3. If Assertion exists and is valid → allow sharing
4. If no Assertion → block (default security)

**Assertion object**:
```typescript
interface Assertion {
    $type$: 'Assertion';
    target: SHA256Hash | SHA256IdHash;        // Group or HashGroup being approved
    assertedBy: SHA256IdHash<Person>;         // Instance owner
    instanceId: SHA256IdHash<Instance>;       // This instance
    createdAt: number;
    expiresAt?: number;
}
```

**Test**:
- Participants receive Group object via CHUM
- Participants receive HashGroup via CHUM
- Participants receive AccessVersionedObjectCertificate
- Participants can resolve complete Group structure
- Non-participants are blocked from receiving Group

**Commit**: `feat: integrate objectFilter for topic Group sharing`

---

## Safety & Rollback Strategy

### Each Step is Independently Committable

1. **Step 1**: Pure type changes, no behavior change
2. **Step 2**: GroupModel internal changes, backward compatible if we handle both formats
3. **Step 3**: Access resolution change, can be feature-flagged
4. **Step 4**: Small fix, easy to revert
5. **Step 5**: New feature, doesn't break existing
6. **Step 6**: New feature, doesn't break existing

### Rollback Points

- After Step 1: Can rollback types if issues found
- After Step 2: Can revert GroupModel if creation fails
- After Step 3: Can rollback access resolution if permissions break
- After Step 4: Can revert AI model fix
- After Step 5: Can disable topic Group creation
- After Step 6: Can disable objectFilter sharing

### Migration Considerations

**Option A: Hard cutover**
- All new Groups use HashGroup immediately
- Old Groups remain in old format
- Code handles both during transition

**Option B: Lazy migration**
- Read old format, write new format
- Gradually migrate on save
- Eventually remove old format support

**Recommendation**: Start with Option A (code handles both), then migrate existing data separately

---

## Design Decisions (RESOLVED)

### 1. Certificate Format - Use Existing AccessVersionedObjectCertificate
```typescript
// Use existing certificate from one.models
interface AccessVersionedObjectCertificate {
    $type$: 'AccessVersionedObjectCertificate';
    person: SHA256IdHash<Person>;           // Recipient
    data: SHA256IdHash;                     // Group being shared
    license: SHA256Hash<License>;           // AccessVersionedObjectLicense
}

// For each participant:
await createAccessCertificate(participant, groupIdHash);
```

### 2. objectFilter - ALREADY IMPLEMENTED IN ONE.CORE

**Location**: `one.core/src/chum-sync.ts`, `one.models/src/misc/AssertionVerifier.ts`

**Implementation**:
```typescript
// one.core signature
objectFilter?: (hash: SHA256Hash | SHA256IdHash, type: string) => Promise<boolean>
```

**Default Behavior** (without objectFilter):
- Group objects: **NOT shared** (blocked for security)
- Access/IdAccess objects: **NOT shared** (blocked for security)
- Other objects: Shared based on access grants

**one.models Integration**:
- **ConnectionsModel.config.objectFilter** - Set filter for all CHUM connections
- **AssertionVerifier.createObjectFilter()** - Creates filter based on Assertion objects
- **startChumProtocol()** - Passes objectFilter to one.core

**Usage in ConnectionsModel**:
```typescript
const connectionsModel = new ConnectionsModel({
    // ... other config
    objectFilter: async (hash, type) => {
        if (type === 'Group' || type === 'HashGroup') {
            // Custom logic: check certificates, assertions, etc.
            return await hasValidCertificateForGroup(hash);
        }
        return true;  // Allow other types
    }
});
```

**AssertionVerifier Pattern** (existing in one.models):
```typescript
import { createAssertionVerifier } from '@refinio/one.models';

const verifier = createAssertionVerifier(instanceOwner, instanceId);
const objectFilter = verifier.createObjectFilter();

// Use in ConnectionsModel
const connectionsModel = new ConnectionsModel({
    objectFilter
});
```

### 3. Backward Compatibility - NO LEGACY SUPPORT
- **Hard cutover**: All new code uses HashGroup structure
- **No migration**: Old Group format not supported
- Existing Groups (if any) must be manually recreated

### 4. HashGroup Sharing - EXPLICIT IN FILTER
```typescript
// objectFilter must explicitly allow:
{
    allowTypes: new Set(['Group', 'HashGroup', 'AccessVersionedObjectCertificate']),
    // Group references HashGroup, so both must be allowed
    // Certificate is needed for sharing permissions
}
```

---

## Next Steps

1. Answer open questions
2. Start with Step 1: Define types
3. Commit after each step
4. Test each step independently
5. Proceed to next only if tests pass
