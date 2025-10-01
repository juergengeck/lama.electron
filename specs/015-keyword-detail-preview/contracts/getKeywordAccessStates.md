# IPC Contract: getKeywordAccessStates

**Handler**: `keyword-detail.js` → `getKeywordAccessStates()`

**Channel**: `keywordDetail:getKeywordAccessStates`

**Purpose**: Retrieve all access control states for a specific keyword. Used for displaying and managing access permissions.

---

## Request Schema

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `keyword` | `string` | Yes | Keyword term (will be normalized) |
| `includePrincipalDetails` | `boolean` | No | Include principal names/metadata (default: true) |

### Example Request

```typescript
// From UI (via IPC)
const response = await window.electronAPI.invoke('keywordDetail:getKeywordAccessStates', {
  keyword: 'blockchain',
  includePrincipalDetails: true
});
```

---

## Response Schema

### Success Response (with principal details)

```typescript
{
  success: true,
  data: {
    keyword: string,                    // Normalized keyword term
    accessStates: Array<{
      $type$: 'KeywordAccessState',
      keywordTerm: string,
      principalId: SHA256Hash,
      principalType: 'user' | 'group',
      state: 'allow' | 'deny' | 'none',
      updatedAt: string,
      updatedBy: SHA256Hash,

      // Principal details (if includePrincipalDetails: true)
      principalName: string,            // Display name
      principalEmail?: string,          // Email (for users only)
      principalMemberCount?: number     // Member count (for groups only)
    }>,
    allPrincipals: {                    // All known users/groups for UI
      users: Array<{
        id: SHA256Hash,
        name: string,
        email?: string,
        hasState: boolean               // True if access state exists
      }>,
      groups: Array<{
        id: SHA256Hash,
        name: string,
        memberCount: number,
        hasState: boolean
      }>
    },
    totalStates: number                 // Total access states for this keyword
  }
}
```

### Success Response (without principal details)

```typescript
{
  success: true,
  data: {
    keyword: string,
    accessStates: Array<{
      $type$: 'KeywordAccessState',
      keywordTerm: string,
      principalId: SHA256Hash,
      principalType: 'user' | 'group',
      state: 'allow' | 'deny' | 'none',
      updatedAt: string,
      updatedBy: SHA256Hash
    }>,
    allPrincipals: null,
    totalStates: number
  }
}
```

### Error Response

```typescript
{
  success: false,
  error: string,
  data: {
    keyword: string,
    accessStates: [],
    allPrincipals: null,
    totalStates: 0
  }
}
```

---

## Error Conditions

| Condition | Error Message | HTTP Equivalent |
|-----------|---------------|-----------------|
| Keyword not found | `Keyword not found: {keyword}` | 404 Not Found |
| ONE.core not initialized | `ONE.core not initialized` | 503 Service Unavailable |
| Invalid keyword | `Invalid keyword: must be non-empty string` | 400 Bad Request |

---

## Behavior Specification

### Normalization

- `keyword` is normalized to lowercase and trimmed before lookup
- Access states are matched against normalized `keywordTerm`

### Principal Details Enrichment

When `includePrincipalDetails: true`:

1. For each access state, fetch principal details:
   - **Users**: Name and email from `leuteModel.getContacts()`
   - **Groups**: Name and member count from `topicGroupManager.getAllGroups()`

2. Build `allPrincipals` list:
   - Include ALL known users and groups
   - Mark each with `hasState: true` if access state exists
   - This enables UI to show "Add access for..." options

### Sorting

Access states are sorted by:

1. `principalType` (users first, then groups)
2. `principalName` (alphabetical)
3. `updatedAt` (most recent first for same name)

### Caching

- Results cached with key: `access-states:${keywordTerm}`
- TTL: 5 seconds
- Cache invalidated on `updateKeywordAccessState`

---

## Example Response

### Request

```typescript
{
  keyword: 'blockchain',
  includePrincipalDetails: true
}
```

### Response

```typescript
{
  success: true,
  data: {
    keyword: 'blockchain',
    accessStates: [
      {
        $type$: 'KeywordAccessState',
        keywordTerm: 'blockchain',
        principalId: 'sha256:abc123...',
        principalType: 'user',
        state: 'allow',
        updatedAt: '2025-10-01T14:30:00.000Z',
        updatedBy: 'sha256:admin...',

        // Enriched principal details
        principalName: 'Alice Smith',
        principalEmail: 'alice@example.com'
      },
      {
        $type$: 'KeywordAccessState',
        keywordTerm: 'blockchain',
        principalId: 'sha256:def456...',
        principalType: 'user',
        state: 'deny',
        updatedAt: '2025-09-28T10:15:00.000Z',
        updatedBy: 'sha256:admin...',

        principalName: 'Bob Johnson',
        principalEmail: 'bob@example.com'
      },
      {
        $type$: 'KeywordAccessState',
        keywordTerm: 'blockchain',
        principalId: 'sha256:group1...',
        principalType: 'group',
        state: 'allow',
        updatedAt: '2025-09-25T16:00:00.000Z',
        updatedBy: 'sha256:admin...',

        principalName: 'Crypto Enthusiasts',
        principalMemberCount: 12
      }
    ],
    allPrincipals: {
      users: [
        {
          id: 'sha256:abc123...',
          name: 'Alice Smith',
          email: 'alice@example.com',
          hasState: true
        },
        {
          id: 'sha256:def456...',
          name: 'Bob Johnson',
          email: 'bob@example.com',
          hasState: true
        },
        {
          id: 'sha256:xyz789...',
          name: 'Carol Williams',
          email: 'carol@example.com',
          hasState: false              // No access state set yet
        }
      ],
      groups: [
        {
          id: 'sha256:group1...',
          name: 'Crypto Enthusiasts',
          memberCount: 12,
          hasState: true
        },
        {
          id: 'sha256:group2...',
          name: 'Developers',
          memberCount: 8,
          hasState: false
        }
      ]
    },
    totalStates: 3
  }
}
```

---

## Implementation Notes

### Handler Implementation Pattern

```typescript
export async function getKeywordAccessStates(event, {
  keyword,
  includePrincipalDetails = true
}) {
  console.log('[KeywordDetail] Getting access states for keyword:', keyword);

  try {
    // Validate input
    if (!keyword || typeof keyword !== 'string') {
      throw new Error('Invalid keyword: must be non-empty string');
    }

    // Normalize keyword
    const keywordTerm = keyword.toLowerCase().trim();

    // Check cache
    const cacheKey = `access-states:${keywordTerm}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5000) {
      return { success: true, data: cached.data };
    }

    // Verify keyword exists
    const model = await getTopicAnalysisModel();
    const keywords = await model.getAllKeywords();
    const keywordExists = keywords.some(k => k.term === keywordTerm);

    if (!keywordExists) {
      throw new Error(`Keyword not found: ${keyword}`);
    }

    // Load access states
    const allStates = await loadVersionedObjects('KeywordAccessState');
    let accessStates = allStates.filter(s => s.keywordTerm === keywordTerm);

    let allPrincipals = null;

    if (includePrincipalDetails) {
      // Get all users and groups
      const contacts = await nodeOneCoreInstance.leuteModel.getContacts();
      const groups = await nodeOneCoreInstance.topicGroupManager.getAllGroups();

      // Enrich access states with principal details
      for (const state of accessStates) {
        if (state.principalType === 'user') {
          const user = contacts.find(c => c.personId === state.principalId);
          if (user) {
            state.principalName = user.name || 'Unknown User';
            state.principalEmail = user.email;
          }
        } else if (state.principalType === 'group') {
          const group = groups.find(g => g.id === state.principalId);
          if (group) {
            state.principalName = group.name || 'Unknown Group';
            state.principalMemberCount = group.members?.length || 0;
          }
        }
      }

      // Build allPrincipals list
      allPrincipals = {
        users: contacts.map(c => ({
          id: c.personId,
          name: c.name || 'Unknown',
          email: c.email,
          hasState: accessStates.some(s => s.principalId === c.personId)
        })),
        groups: groups.map(g => ({
          id: g.id,
          name: g.name || 'Unknown',
          memberCount: g.members?.length || 0,
          hasState: accessStates.some(s => s.principalId === g.id)
        }))
      };

      // Sort access states
      accessStates.sort((a, b) => {
        // Users first, then groups
        if (a.principalType !== b.principalType) {
          return a.principalType === 'user' ? -1 : 1;
        }
        // Alphabetical by name
        const nameA = a.principalName || '';
        const nameB = b.principalName || '';
        if (nameA !== nameB) {
          return nameA.localeCompare(nameB);
        }
        // Most recent first
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    }

    const result = {
      keyword: keywordTerm,
      accessStates,
      allPrincipals,
      totalStates: accessStates.length
    };

    // Cache result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return { success: true, data: result };

  } catch (error) {
    console.error('[KeywordDetail] Error getting access states:', error);
    return {
      success: false,
      error: error.message,
      data: {
        keyword: keyword?.toLowerCase().trim() || '',
        accessStates: [],
        allPrincipals: null,
        totalStates: 0
      }
    };
  }
}
```

---

## UI Usage Example

```typescript
// AccessControlList.tsx
const [accessStates, setAccessStates] = useState([]);
const [allPrincipals, setAllPrincipals] = useState(null);

async function loadAccessStates() {
  const response = await window.electronAPI.invoke(
    'keywordDetail:getKeywordAccessStates',
    {
      keyword: selectedKeyword,
      includePrincipalDetails: true
    }
  );

  if (response.success) {
    const { accessStates, allPrincipals } = response.data;

    setAccessStates(accessStates);
    setAllPrincipals(allPrincipals);

    // Show users/groups without access states as "Add..." options
    const usersWithoutAccess = allPrincipals.users.filter(u => !u.hasState);
    const groupsWithoutAccess = allPrincipals.groups.filter(g => !g.hasState);

    setAvailableForAdd([...usersWithoutAccess, ...groupsWithoutAccess]);
  }
}
```

---

## Performance Notes

- **Typical latency**: <50ms with principal details
- **Principal lookup overhead**: ~20ms for 50 users + 10 groups
- **Cache benefits**: Reduces repeated queries when toggling access states
- **Memory usage**: ~10KB for 50 access states with full details

---

## UI/UX Considerations

### Display Patterns

**With Access State**:
```
✓ Alice Smith (allow)         [Change to Deny] [Remove]
✗ Bob Johnson (deny)          [Change to Allow] [Remove]
⊙ Crypto Enthusiasts (none)   [Allow] [Deny]
```

**Without Access State** (from allPrincipals):
```
+ Carol Williams              [Add Access...]
+ Developers Group            [Add Access...]
```

### State Change Flow

1. User clicks state change (e.g., "Allow" → "Deny")
2. Call `updateKeywordAccessState` with new state
3. On success, refresh access states via `getKeywordAccessStates`
4. UI updates automatically with new state and timestamp

---

## Related Contracts

- `updateKeywordAccessState.md` - Update or create access state
- `getKeywordDetails.md` - Includes access states in response
- `getAllKeywords.md` - Shows access control summary

---

## References

- Data Model: `/specs/015-keyword-detail-preview/data-model.md`
- Feature Spec: `/specs/015-keyword-detail-preview/spec.md`
- Access Rights Manager: `/main/core/access-rights-manager.js`
