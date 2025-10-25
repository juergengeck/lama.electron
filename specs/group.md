# Group Architecture: HashGroup and Group

## Core Concepts

### HashGroup - Pure Content-Addressed Set

```typescript
interface HashGroup<T> {
    $type$: 'HashGroup';
    members: Array<SHA256IdHash<T>>;
}
```

**Identity**: `hash(members)` - The content IS the identity

**Characteristics**:
- **Immutable**: Same members = same hash, always
- **Content-addressed**: The member list defines the HashGroup
- **Reusable**: Multiple Groups can reference the same HashGroup
- **No metadata**: Just members, nothing else

**Examples**:
```typescript
// These are the SAME HashGroup (same hash):
HashGroup { members: [alice, bob, charlie] }
HashGroup { members: [alice, bob, charlie] }

// These are DIFFERENT HashGroups (different hashes):
HashGroup { members: [alice, bob] }
HashGroup { members: [alice, bob, charlie] }
```

---

### Group - Versioned Named Reference

```typescript
interface Group {
    $type$: 'Group';
    name: string;              // Versioning key
    hashGroup: SHA256IdHash<HashGroup<Person>>;
}
```

**Identity**: Versioned by `name`

**Characteristics**:
- **Versioned**: Multiple versions of "Engineers" over time
- **Named**: Stable human-readable identifier
- **References HashGroup**: Points to a specific member set
- **Historical**: Can track how membership changed

**Version History Example**:
```typescript
// Version 1 (Jan 2025)
Group {
    name: "Engineers",
    hashGroup: hash([alice, bob])
}

// Version 2 (Feb 2025) - Charlie added
Group {
    name: "Engineers",
    hashGroup: hash([alice, bob, charlie])
}

// Version 3 (Mar 2025) - Bob removed
Group {
    name: "Engineers",
    hashGroup: hash([alice, charlie])
}
```

All three are versions of the same Group (same name), but point to different HashGroups.

---

## Access Control Semantics

### "Without Spillover" - Critical Property

When a Group is referenced in an access grant (certificate/IdAccess), it creates a **frozen snapshot**:

```typescript
// January 2025: Grant access
await createAccess([{
    id: documentIdHash,
    person: [],
    group: [engineersGroupIdHash],  // References Group v1
    mode: SET_ACCESS_MODE.ADD
}]);

// At this time, Group "Engineers" v1 points to HashGroup([alice, bob])
```

**What happens when membership changes?**

```typescript
// February 2025: Charlie joins Engineers
// This creates Group "Engineers" v2 → HashGroup([alice, bob, charlie])
```

**Result**:
- The old access grant STILL references Group v1
- Group v1 STILL points to HashGroup([alice, bob])
- Charlie does NOT automatically get access to the document
- **No spillover**: Old certificates don't see new members

---

## Why HashGroup is NOT Dynamic

I previously stated "HashGroup is dynamic" - this was **incorrect**. Let me clarify:

### Both are Static at Access-Grant Time

**HashGroup reference in access control**:
```typescript
await createAccess([{
    id: documentIdHash,
    hashGroup: [hashGroupIdHash]  // Specific member set
}]);
```
- References: `HashGroup([alice, bob, charlie])`
- **Frozen**: This exact member set, forever
- **No versioning**: No history, just this snapshot

**Group reference in access control**:
```typescript
await createAccess([{
    id: documentIdHash,
    group: [groupIdHash]  // Specific Group VERSION
}]);
```
- References: `Group v2` which points to `HashGroup([alice, bob, charlie])`
- **Frozen**: This Group version, this HashGroup, forever
- **With versioning context**: Can see v1, v2, v3 history

### The Actual Difference

| Aspect | HashGroup Reference | Group Reference |
|--------|---------------------|-----------------|
| **Member set** | Frozen | Frozen |
| **Versioning** | None - pure set | Versioned by name |
| **Semantics** | "These exact people" | "Engineers team as of Feb 2025" |
| **History** | No context | Historical context (v1, v2, v3...) |
| **Metadata** | None | Name, versioning metadata |

### When to Use Each

**Use HashGroup directly**:
- Ad-hoc member sets with no semantic meaning
- "Just these three people, I don't care about naming"
- No need for historical tracking

**Use Group**:
- Named teams/roles: "Engineers", "Admins", "Berlin Office"
- Want versioning history: when did membership change?
- Human-readable semantics matter
- Certificates should capture "who was in Engineers at grant time"

---

## Implementation Flow

### Adding a Member to a Group

```typescript
// 1. Current state
const currentGroup = await getObjectByIdHash(groupIdHash);
const currentHashGroup = await getObjectByIdHash(currentGroup.obj.hashGroup);
const currentMembers = currentHashGroup.obj.members;

// 2. Create new HashGroup with added member
const newHashGroup = await storeVersionedObject({
    $type$: 'HashGroup',
    members: [...currentMembers, newPersonIdHash]
});

// 3. Create new Group version pointing to new HashGroup
const newGroup = await storeVersionedObject({
    $type$: 'Group',
    $versionHash$: currentGroup.obj.$versionHash$,  // Link to previous version
    name: currentGroup.obj.name,                     // Same name
    hashGroup: newHashGroup.idHash                   // New member set
});
```

**Result**:
- New HashGroup created (new member set = new hash)
- New Group version created (same name, new version)
- Old Group version still exists, still points to old HashGroup
- Old certificates still reference old Group version → old members

---

## Access Resolution Logic

### Finding Groups a Person Belongs To

**Current (wrong)**:
```typescript
// Direct reverse map: Person → Group
const groups = await getOnlyLatestReferencingObjsHashAndId(personIdHash, 'Group');
```

**New (correct)**:
```typescript
// Two-step: Person → HashGroup → Group
// 1. Find HashGroups containing this Person
const hashGroups = await getOnlyLatestReferencingObjsHashAndId(personIdHash, 'HashGroup');

// 2. For each HashGroup, find Groups referencing it
const groups = [];
for (const hashGroupRef of hashGroups) {
    const groupsRefThis = await getOnlyLatestReferencingObjsHashAndId(
        hashGroupRef.idHash,
        'Group'
    );
    groups.push(...groupsRefThis);
}
```

**Why this works**:
- HashGroup.members contains Person references (reverse map works)
- Group.hashGroup contains HashGroup reference (reverse map works)
- Chain them together to find Person → Groups

---

## Migration Considerations

### Breaking Change

This is a **fundamental schema change**:
- Old: `Group.person: Array<SHA256IdHash<Person>>`
- New: `Group.hashGroup: SHA256IdHash<HashGroup<Person>>`

### Migration Strategy

```typescript
async function migrateGroup(oldGroupIdHash: SHA256IdHash<Group>) {
    // 1. Load old Group
    const oldGroup = await getObjectByIdHash(oldGroupIdHash);

    // 2. Create HashGroup from old person array
    const hashGroup = await storeVersionedObject({
        $type$: 'HashGroup',
        members: oldGroup.obj.person  // Old property
    });

    // 3. Create new Group version with new structure
    await storeVersionedObject({
        $type$: 'Group',
        $versionHash$: oldGroup.obj.$versionHash$,
        name: oldGroup.obj.name,
        hashGroup: hashGroup.idHash  // New property
    });
}
```

### Version Compatibility

During transition, may need code that handles both:
```typescript
function getGroupMembers(group: Group): SHA256IdHash<Person>[] {
    if ('person' in group) {
        // Old format
        return group.person;
    } else {
        // New format - need to resolve HashGroup
        const hashGroup = await getObjectByIdHash(group.hashGroup);
        return hashGroup.obj.members;
    }
}
```

---

## Benefits of This Architecture

### 1. Correct Semantics
- Group identity = name (can change members without changing identity)
- HashGroup identity = members (mathematical set)

### 2. Deduplication
```typescript
// Two different Groups can share the same members
Group "Engineering Team" → HashGroup([alice, bob, charlie])
Group "Product Team"     → HashGroup([alice, bob, charlie])

// Only ONE HashGroup stored, both Groups reference it
```

### 3. No Spillover in Certificates
- Old access grants frozen at Group version
- New members don't automatically get old permissions
- Correct temporal semantics

### 4. Separation of Concerns
- **HashGroup**: Pure data (member sets)
- **Group**: Metadata + versioning (name + history)

### 5. Flexible Access Control
- Grant to HashGroup: "these exact people"
- Grant to Group: "this team as of this time"

---

## objectFilter for CHUM Synchronization

### Overview

**objectFilter** is a callback function in one.core's CHUM sync that controls which objects are shared with remote peers.

**Signature**:
```typescript
objectFilter?: (hash: SHA256Hash | SHA256IdHash, type: string) => Promise<boolean>
```

**Default Behavior** (without objectFilter):
- Group objects: **NOT shared** (security)
- Access/IdAccess objects: **NOT shared** (security)
- Other objects: Shared based on access grants

### Implementation Locations

**one.core**:
- `src/chum-sync.ts` - objectFilter parameter
- `src/chum-exporter-service.ts` - Filter enforcement
- `src/accessManager.ts` - Filter integration with access determination

**one.models**:
- `src/models/ConnectionsModel.ts` - objectFilter config option
- `src/misc/AssertionVerifier.ts` - Creates filter based on Assertions
- `src/misc/ConnectionEstablishment/protocols/Chum.ts` - Passes filter to one.core

### Usage Patterns

#### 1. Direct objectFilter on ConnectionsModel

```typescript
const connectionsModel = new ConnectionsModel({
    objectFilter: async (hash, type) => {
        if (type === 'Group' || type === 'HashGroup') {
            // Custom logic: check certificates
            return await hasValidCertificateForObject(hash);
        }
        return true;
    }
});
```

#### 2. AssertionVerifier Pattern

```typescript
import { createAssertionVerifier } from '@refinio/one.models';

const verifier = createAssertionVerifier(instanceOwner, instanceId);
const objectFilter = verifier.createObjectFilter();

const connectionsModel = new ConnectionsModel({
    objectFilter
});

// Create assertions to allow specific objects
await verifier.createAssertion(groupIdHash);
await verifier.createAssertion(hashGroupIdHash);
```

#### 3. Topic-Specific Filter

```typescript
async function createTopicObjectFilter(
    groupIdHash: SHA256IdHash<Group>,
    hashGroupIdHash: SHA256IdHash<HashGroup<Person>>
) {
    return async (hash: SHA256Hash | SHA256IdHash, type: string) => {
        // Allow topic's Group and HashGroup
        if (type === 'Group' && hash === groupIdHash) return true;
        if (type === 'HashGroup' && hash === hashGroupIdHash) return true;

        // Allow certificates for this Group
        if (type === 'AccessVersionedObjectCertificate') {
            const cert = await getObject(hash);
            return cert.data === groupIdHash;
        }

        return true;  // Allow other types
    };
}
```

### Integration with Topic Groups

When creating a topic with Group-based access:

1. **Create Group** with topic participants
2. **Create certificates** for each participant
3. **Configure objectFilter** to allow:
   - The specific Group (by idHash)
   - The Group's HashGroup (by idHash)
   - Certificates referencing the Group
4. **Set filter** on ConnectionsModel

This ensures:
- Only authorized participants receive the Group
- Group structure is complete (Group → HashGroup → members)
- Certificates provide proof of authorization
- Non-participants are blocked from seeing the Group

---

## Open Questions

1. **Should access control use HashGroup or Group?**
   - Currently: `IdAccess.group: Array<SHA256IdHash<Group>>`
   - With HashGroup: Both are valid - Group for versioned access, HashGroup for pure member set
   - Decision: Keep Group in IdAccess, access resolution will follow Group → HashGroup

2. **Generic HashGroup vs. specialized?**
   - `HashGroup<Person>` for people
   - Could extend to `HashGroup<T>` for general grouping
   - Decision: Start with `HashGroup<T>` generic, use `HashGroup<Person>` for Group

3. **Reverse map updates needed?**
   - HashGroup needs reverse maps for Person references
   - Enables: Person → HashGroup → Group lookups
   - Required for access resolution

4. **GroupProfile changes?**
   - Currently references Group (correct)
   - No changes needed - GroupProfile → Group → HashGroup works

5. **objectFilter composition?**
   - Multiple topics may need different filters
   - Need pattern for composing filters
   - Options: Chain filters (AND), merge filters (OR), or topic-scoped filters
