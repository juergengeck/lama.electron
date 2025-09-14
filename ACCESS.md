# CHUM Data Sharing and Access Control Findings

## Key Discovery: How CHUM Syncs Group-Accessible Objects

CHUM (the synchronization protocol in ONE.core) DOES support group-based access control. The implementation in `/node_modules/@refinio/one.core/lib/util/determine-accessible-hashes.js` shows:

1. **CHUM determines what to sync by:**
   - Finding all Access/IdAccess objects that grant access directly to a person
   - Finding all Groups that contain the person as a member
   - For each group, finding all Access/IdAccess objects that grant access to that group
   - Combining all accessible objects from both direct and group access

2. **The sync process:**
   - When CHUM connects two instances, it uses `getAccessibleRootHashes(personId)` 
   - This function checks both direct person access AND group membership
   - Objects accessible through groups ARE automatically synced

## The Architecture Issue

### Current Setup (INCORRECT)
- Browser: Has NO ONE.core instance (UI only)
- Node.js: Has the ONLY ONE.core instance
- Problem: Trying to add "browser person" to groups, but browser has no person/instance

### Correct Understanding
- The Node.js instance owns all the data
- There is only ONE person involved (the Node.js instance owner)
- The browser connects via IPC, not via CHUM
- CHUM is for connecting to OTHER Node.js instances (other users)

## The Real Issue with Group Chats

The problem is NOT about browser-node federation. It's about:

1. **When creating group topics:** The Node.js person needs to be a member of the conversation group
2. **For CHUM to sync with other users:** Those other users need to be members of the same group
3. **Channel access:** Channels should be accessible to the group, not to individual persons

## Current Implementation Problems

### In TopicGroupManager (`/main/core/topic-group-manager.js`)
- Line 92-95: Incorrectly tries to add "browser person" to groups
- Should only add the Node.js person and any other actual ONE instances (like AI contacts or remote users)

### In chat.js
- Lines 46-77: Now correctly uses TopicGroupManager for group topics
- Lines 171-179: Also correctly uses TopicGroupManager

### In node-one-core.js  
- Lines 947-952: Correctly relies on group membership for channel access
- No need to grant direct access to all channels

## How It Should Work

1. **Group Creation:**
   - Create a group with members: [nodeOwner, remoteUser1, remoteUser2, aiContact]
   - NO "browser person" - the browser accesses data via IPC through the Node instance

2. **Channel Access:**
   - Grant the GROUP access to the channel
   - All group members can then access the channel through their group membership

3. **CHUM Sync:**
   - When Node connects to another Node via CHUM
   - Each node's person is checked for group membership
   - Channels accessible to shared groups are automatically synced

## Security Considerations

1. **Never grant blanket access** to all channels to all connections
2. **Use group-based access** for shared topics - more secure and manageable
3. **System channels** (like contacts) should NOT be shared with everyone
4. **P2P channels** can have direct person-to-person access

## The Fix Required

The TopicGroupManager needs to be corrected to:
1. NOT look for a "browser person" 
2. Only add actual ONE instance persons (Node owner, remote users, AI contacts)
3. Ensure the Node.js person is always a member of conversation groups it creates

The browser will access all data through IPC calls to the Node.js instance, which has full access to all local data.