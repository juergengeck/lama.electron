# CLAUDE.md

This file provides guidance to Claude Code when working with LAMA Electron.

## Single ONE.core Architecture

**CRITICAL**: This Electron app runs ONE ONE.core instance in Node.js ONLY:

1. **Browser** (Renderer Process)
   - Location: `/electron-ui/`
   - Role: UI ONLY - NO ONE.core instance
   - Communication: ALL data operations via IPC
   - NO AppModel, NO LeuteModel, NO ChannelManager
   - NO SingleUserNoAuth - authentication handled by Node.js

2. **Node.js Instance** (Main Process)
   - Location: `/main/core/node-one-core.js`
   - Platform: Node.js with file system
   - Role: SINGLE ONE.core instance - handles EVERYTHING
   - Models: SingleUserNoAuth, LeuteModel, ChannelManager, AI contacts, etc.
   - Storage: File system based

## Channel Architecture

**IMPORTANT**: The app uses different architectures for P2P and group chats:

### P2P Conversations (Two Participants Only)

1. **Single Shared Channel**
   - ONE channel for both participants
   - Channel ID format: `personId1<->personId2` (lexicographically sorted)
   - Channel owner: `null` or `undefined` (no owner)
   - Both participants read AND write to the same channel

2. **Access Control for P2P**
   - Direct person-based access to the channel
   - Both participants are granted individual access
   - NO Group objects needed or used for P2P
   - Simple IdAccess: `{id: channelHash, person: [person1, person2]}`

3. **Why P2P is Different**
   - Simpler: Only two people, no need for complex group management
   - Compatible: Works with one.leute's P2P expectations
   - No CHUM issues: No Group objects to be rejected

### Group Chats (3+ Participants including AI)

1. **One Topic ID per Conversation**
   - Each group chat has ONE topic ID
   - The topic ID acts as the grouping mechanism for all messages
   - All participants use the SAME topic ID

2. **Multiple Channels per Topic**
   - Each participant has their OWN channel with the same topic ID
   - Channel = {id: topic_id, owner: participant_person_id}
   - Example: For topic "abc123" with 3 participants:
     - Channel 1: {id: "abc123", owner: "person1"}
     - Channel 2: {id: "abc123", owner: "person2"}
     - Channel 3: {id: "abc123", owner: "person3"}

3. **Writing Messages - Decentralized**
   - Each participant writes ONLY to their OWN channel
   - You cannot write to another participant's channel (will throw error)
   - The channel must exist in your local cache to write to it
   - In code: Messages are posted with YOUR person ID as the channel owner

4. **Reading Messages - Aggregated**
   - `TopicRoom.retrieveAllMessages()` queries by topic ID only
   - ChannelManager's `getMatchingChannelInfos()` finds ALL channels with that topic ID
   - `multiChannelObjectIterator()` aggregates messages from ALL matching channels
   - Result: Messages from all participants are merged and sorted by timestamp

5. **Access Control for Groups**
   - Group-based access: All participants are in a Group object
   - Each participant's channel grants read access to the group
   - Groups are LOCAL objects - NEVER synced through CHUM
   - Only IdAccess objects referencing the group hash are shared

### Key Differences Summary

| Aspect | P2P (2 participants) | Group (3+ participants) |
|--------|---------------------|------------------------|
| Channels | 1 shared channel | 1 channel per participant |
| Channel Owner | null/undefined | Each participant owns their channel |
| Write Access | Both write to same channel | Each writes to own channel only |
| Access Control | Person-based | Group-based (local groups) |
| Topic ID Format | `id1<->id2` | Any string |

### Authentication Flow

The app follows a simple authentication flow:

1. **UI Login**: User enters credentials in browser UI
2. **IPC Call**: Browser calls `onecore:initializeNode` via IPC
3. **Node.js Init**: Node.js initializes ONE.core with SingleUserNoAuth
4. **Ready**: Node.js ONE.core is ready, UI gets data via IPC

### Architecture Principles

**NO FALLBACKS**: 
- Browser ONLY uses IPC - no fallback to local models
- If IPC fails, operations fail - no mitigation
- Fix the problem, don't work around it

**NO BROWSER ONE.CORE**:
- Browser has NO ONE.core imports
- Browser has NO AppModel
- Browser is JUST a UI layer
- ALL data comes from Node.js via IPC

### Common Issues

**"User not authenticated - node not provisioned"**
- This occurs when trying to create conversations before login
- Solution: User must log in first via the browser UI
- The Node instance is initialized after login

**Browser AppModel references**
- REMOVE THEM - Browser should NOT have AppModel
- Use IPC instead: `window.electronAPI.invoke()`
- All data operations go through Node.js

**Messages not visible to other participants**
- Check that each participant writes to their OWN channel
- Verify group access is granted to all channels
- Ensure TopicRoom.retrieveAllMessages() is used (not manual channel queries)
- Debug: Log all channels with `getMatchingChannelInfos()` to see channel owners

### Key Files

- `/main/core/node-one-core.js` - SINGLE Node.js ONE.core instance
- `/main/ipc/handlers/` - IPC handlers for all operations
- `/electron-ui/src/services/browser-init.ts` - UI initialization (NO ONE.core)
- `/electron-ui/src/bridge/lama-bridge.ts` - IPC bridge for UI

### Development Notes

- Main process uses CommonJS (`require`)
- Renderer uses ESM (`import`) 
- IPC communication via contextBridge for ALL operations
- NO direct ONE.core access from browser
- NO fallbacks - fail fast and fix

For consistency and simplicity:
- ONE instance (Node.js)
- ONE source of truth
- IPC for everything
- No complex federation/pairing needed
- reference implementations are in ./reference