# IPC Contract: updateKeywordAccessState

**Handler**: `keyword-detail.js` → `updateKeywordAccessState()`

**Channel**: `keywordDetail:updateKeywordAccessState`

**Purpose**: Create or update an access control state for a user or group regarding a specific keyword.

---

## Request Schema

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `keyword` | `string` | Yes | Keyword term (will be normalized) |
| `principalId` | `SHA256Hash` | Yes | User or Group ID |
| `principalType` | `'user' \| 'group'` | Yes | Type of principal |
| `state` | `'allow' \| 'deny' \| 'none'` | Yes | New access state |

### Example Request

```typescript
// From UI (via IPC)
const response = await window.electronAPI.invoke('keywordDetail:updateKeywordAccessState', {
  keyword: 'blockchain',
  principalId: 'sha256:user123...',
  principalType: 'user',
  state: 'allow'
});
```

---

## Response Schema

### Success Response

```typescript
{
  success: true,
  data: {
    accessState: {
      $type$: 'KeywordAccessState',
      keywordTerm: string,
      principalId: SHA256Hash,
      principalType: 'user' | 'group',
      state: 'allow' | 'deny' | 'none',
      updatedAt: string,              // ISO timestamp
      updatedBy: SHA256Hash           // Current user ID
    },
    created: boolean                  // True if new state, false if updated
  }
}
```

### Error Response

```typescript
{
  success: false,
  error: string,
  data: {
    accessState: null,
    created: false
  }
}
```

---

## Error Conditions

| Condition | Error Message | HTTP Equivalent |
|-----------|---------------|-----------------|
| Keyword not found | `Keyword not found: {keyword}` | 404 Not Found |
| Principal not found | `Principal not found: {principalId}` | 404 Not Found |
| Invalid principalType | `Invalid principalType: must be 'user' or 'group'` | 400 Bad Request |
| Invalid state value | `Invalid state: must be 'allow', 'deny', or 'none'` | 400 Bad Request |
| Current user not authenticated | `User not authenticated` | 401 Unauthorized |
| ONE.core not initialized | `ONE.core not initialized` | 503 Service Unavailable |

---

## Behavior Specification

### Normalization

- `keyword` is normalized to lowercase and trimmed before lookup
- `principalId` must be a valid SHA256Hash
- `principalType` must be exactly 'user' or 'group'
- `state` must be exactly 'allow', 'deny', or 'none'

### Upsert Logic

1. Load all existing `KeywordAccessState` objects
2. Search for existing state with matching `keywordTerm` + `principalId`
3. If exists:
   - Update `state`, `updatedAt`, `updatedBy`
   - Store new version (ONE.core versioned object)
   - Return with `created: false`
4. If not exists:
   - Create new `KeywordAccessState` object
   - Store as versioned object
   - Return with `created: true`

### Current User Detection

The `updatedBy` field is populated with the current user's ID from ONE.core:

```typescript
const updatedBy = nodeOneCoreInstance.getCurrentUserId();
```

### State Value Semantics

| State | Meaning |
|-------|---------|
| `allow` | Principal has explicit access to keyword-related information |
| `deny` | Principal is explicitly denied access to keyword-related information |
| `none` | No explicit state set (inherits default permissions) |

**Note**: State enforcement is NOT implemented in this feature - this stores preference only.

---

## Example Response

### Request

```typescript
{
  keyword: 'blockchain',
  principalId: 'sha256:abc123...',
  principalType: 'user',
  state: 'allow'
}
```

### Response (New State)

```typescript
{
  success: true,
  data: {
    accessState: {
      $type$: 'KeywordAccessState',
      keywordTerm: 'blockchain',
      principalId: 'sha256:abc123...',
      principalType: 'user',
      state: 'allow',
      updatedAt: '2025-10-01T14:30:00.000Z',
      updatedBy: 'sha256:currentuser...'
    },
    created: true
  }
}
```

### Response (Updated State)

```typescript
{
  success: true,
  data: {
    accessState: {
      $type$: 'KeywordAccessState',
      keywordTerm: 'blockchain',
      principalId: 'sha256:abc123...',
      principalType: 'user',
      state: 'deny',                        // Changed from 'allow'
      updatedAt: '2025-10-01T15:45:00.000Z', // New timestamp
      updatedBy: 'sha256:currentuser...'
    },
    created: false
  }
}
```

---

## Implementation Notes

### Handler Implementation Pattern

```typescript
export async function updateKeywordAccessState(event, {
  keyword,
  principalId,
  principalType,
  state
}) {
  console.log('[KeywordDetail] Updating access state:', {
    keyword,
    principalId,
    principalType,
    state
  });

  try {
    // Validate inputs
    if (!keyword || typeof keyword !== 'string') {
      throw new Error('Invalid keyword: must be non-empty string');
    }

    if (!principalId) {
      throw new Error('Invalid principalId: required');
    }

    if (!['user', 'group'].includes(principalType)) {
      throw new Error(`Invalid principalType: ${principalType}`);
    }

    if (!['allow', 'deny', 'none'].includes(state)) {
      throw new Error(`Invalid state: ${state}`);
    }

    // Normalize keyword
    const keywordTerm = keyword.toLowerCase().trim();

    // Verify keyword exists
    const model = await getTopicAnalysisModel();
    const keywords = await model.getAllKeywords();
    const keywordExists = keywords.some(k => k.term === keywordTerm);

    if (!keywordExists) {
      throw new Error(`Keyword not found: ${keyword}`);
    }

    // Verify principal exists
    const principalExists = await verifyPrincipal(principalId, principalType);
    if (!principalExists) {
      throw new Error(`Principal not found: ${principalId}`);
    }

    // Get current user
    const updatedBy = nodeOneCoreInstance.getCurrentUserId();
    if (!updatedBy) {
      throw new Error('User not authenticated');
    }

    // Load existing access states
    const allStates = await loadVersionedObjects('KeywordAccessState');
    const existing = allStates.find(s =>
      s.keywordTerm === keywordTerm &&
      s.principalId === principalId
    );

    let accessState;
    let created = false;

    if (existing) {
      // Update existing state
      accessState = {
        ...existing,
        state,
        updatedAt: new Date().toISOString(),
        updatedBy
      };
      await storeVersionedObject(accessState);
      created = false;
    } else {
      // Create new state
      accessState = {
        $type$: 'KeywordAccessState',
        keywordTerm,
        principalId,
        principalType,
        state,
        updatedAt: new Date().toISOString(),
        updatedBy
      };
      await storeVersionedObject(accessState);
      created = true;
    }

    // Invalidate cache for this keyword
    invalidateKeywordCache(keywordTerm);

    console.log('[KeywordDetail] Access state updated:', {
      keywordTerm,
      created
    });

    return {
      success: true,
      data: {
        accessState,
        created
      }
    };

  } catch (error) {
    console.error('[KeywordDetail] Error updating access state:', error);
    return {
      success: false,
      error: error.message,
      data: {
        accessState: null,
        created: false
      }
    };
  }
}

// Helper function
async function verifyPrincipal(principalId, principalType) {
  if (principalType === 'user') {
    const contacts = await nodeOneCoreInstance.leuteModel.getContacts();
    return contacts.some(c => c.personId === principalId);
  } else if (principalType === 'group') {
    const groups = await nodeOneCoreInstance.topicGroupManager.getAllGroups();
    return groups.some(g => g.id === principalId);
  }
  return false;
}
```

---

## UI Usage Example

```typescript
// AccessControlList.tsx
async function handleAccessChange(userId: string, newState: AccessStateValue) {
  const response = await window.electronAPI.invoke(
    'keywordDetail:updateKeywordAccessState',
    {
      keyword: selectedKeyword,
      principalId: userId,
      principalType: 'user',
      state: newState
    }
  );

  if (response.success) {
    const { accessState, created } = response.data;

    // Update local state
    setAccessStates(prev => {
      if (created) {
        return [...prev, accessState];
      } else {
        return prev.map(s =>
          s.principalId === userId ? accessState : s
        );
      }
    });

    // Show feedback
    toast.success(`Access ${created ? 'granted' : 'updated'} for user`);
  } else {
    toast.error(`Failed to update access: ${response.error}`);
  }
}
```

---

## Atomic Operations

**Important**: ONE.core versioned objects provide atomicity at the object level:

- Each `storeVersionedObject()` is atomic
- Concurrent updates create separate versions (no lost updates)
- Last write wins for composite key (keyword + principal)

**Race Condition Handling**:
- If two users update same access state simultaneously
- Both create new versions
- Latest version (by `updatedAt`) is authoritative
- UI should refresh after update to show latest state

---

## Cache Invalidation

After updating an access state:

```typescript
// Invalidate all cache entries for this keyword
keywordDetailsCache.delete(`${keywordTerm}:*`);
keywordAccessStatesCache.delete(keywordTerm);
```

This ensures subsequent `getKeywordDetails` and `getKeywordAccessStates` calls fetch fresh data.

---

## Performance Notes

- **Typical latency**: <30ms (local storage)
- **Validation overhead**: ~10ms (verify principal exists)
- **Cache invalidation**: <5ms
- **No network calls**: All operations local to Node.js process

---

## Related Contracts

- `getKeywordAccessStates.md` - Fetch all access states for keyword
- `getKeywordDetails.md` - Includes access states in response
- `getAllKeywords.md` - Shows access control summary

---

## References

- Data Model: `/specs/015-keyword-detail-preview/data-model.md`
- Feature Spec: `/specs/015-keyword-detail-preview/spec.md`
- Access Rights Pattern: `/main/core/access-rights-manager.js`
