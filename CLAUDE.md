# CLAUDE.md

This file provides guidance to Claude Code when working with LAMA Electron.

## NodeOneCore: Comprehensive ONE.core Instance

**CRITICAL**: The Node.js process runs a FULL ONE.core instance (`NodeOneCore`) with complete capabilities:

### Available Models & Services
- `leuteModel` - Full Leute model (people, contacts, profiles, groups)
- `channelManager` - Complete channel management
- `connectionsModel` - P2P connections, pairing, CHUM sync
- `topicModel` - Chat topics and messages
- `aiAssistantModel` - AI contact management
- `llmManager` - LLM provider integration
- `llmObjectManager` - LLM configuration storage
- `topicGroupManager` - Group chat management
- `contentSharing` - Content sharing capabilities
- `federationAPI` - Federation features
- `accessRightsManager` - Access control
- `quicTransport` - QUIC transport layer
- `apiServer` - Refinio API server (QuicVC)

### Storage & Persistence
- Full ONE.core storage via `@refinio/one.core/lib/storage-*`
- BLOB storage for attachments
- Versioned object storage
- Access control and encryption
- Recipe-based object definitions

### DO NOT Castrate Functionality
- **DO NOT** stub out or disable methods because types aren't perfect
- **DO** use proper TypeScript types from `@refinio/one.core/lib/recipes.js`
- **DO** import union types like `PersonDescriptionTypes`, `CommunicationEndpointTypes`
- **DO** use type guards with proper typing (not `any`)
- **DO** trust that NodeOneCore has comprehensive ONE.core capabilities

### TypeScript Type Strategy
1. Import proper types from `@refinio/one.core/lib/recipes.js`
2. Use TypeScript's `Extract<>` utility for union type narrowing
3. Create type guards that preserve type information
4. Avoid `as any` - use proper type assertions or guards

## ONE.core Fundamentals

### Everything is a Hash

**CRITICAL PRINCIPLE**: In ONE, everything is content-addressed by its SHA-256 hash. This drives all architecture decisions:

- All objects are stored using their hash as the filename
- References between objects are hashes, not pointers
- Objects are **immutable** once created
- Identical objects naturally deduplicate

### Object Categories

1. **Unversioned Objects** - Immutable, no version tracking
   - `Keys` - Encryption/signing keypairs
   - `VersionNode*` - Version graph nodes

2. **Versioned Objects** - Have ID properties (`isId: true`), support versioning
   - `Person` - Identity (ID: email)
   - `Instance` - App instance (ID: name + owner)
   - `Group` - Named groups (ID: name)
   - `Recipe` - Type definitions (ID: name)
   - `Access`/`IdAccess` - Access control
   - Custom app objects with ID properties

3. **Virtual Types**
   - `BLOB` - Binary data
   - `CLOB` - UTF-8 text data

### Hash Types

**Object Hash** (`SHA256Hash<T>`): Hash of the complete object
```typescript
const objectHash = await calculateHashOfObj(person);
```

**ID Hash** (`SHA256IdHash<T>`): Hash of only ID properties
```typescript
const idHash = await calculateIdHashOfObj(person);
```

**Key Difference**: ID hashes reference ALL versions of an object, object hashes reference ONE specific version.

### Microdata Format

ONE objects are serialized as HTML5 microdata for storage:

```html
<div itemscope itemtype="//refin.io/Person">
  <span itemprop="email">user@example.com</span>
  <span itemprop="name">John Doe</span>
</div>
```

This format ensures:
- Platform-independent serialization
- Human-readable structure
- Consistent hashing across implementations

### Recipe System

Recipes define the schema for ONE object types. **CRITICAL**: Array properties must include a `rules` array, even if empty:

```typescript
// ✅ CORRECT - provides rules array
{
    itemprop: 'devices',
    itemtype: {
        type: 'array',
        item: {
            type: 'object',
            rules: []  // Required! Prevents parser crash
        }
    }
}

// ❌ INCORRECT - missing rules array crashes parser
{
    itemprop: 'devices',
    itemtype: {
        type: 'array',
        item: {
            type: 'object'
            // Missing rules causes: "Cannot read property 'forEach' of undefined"
        }
    }
}
```

### Storage Patterns

**For Versioned Objects** (have ID properties):
```typescript
// Creates version nodes AND stores object
const result = await storeVersionedObject(subject);
// Returns: { hash, idHash, versionHash }
```

**For Unversioned Objects**:
```typescript
// Stores object only (no versioning)
const hash = await storeUnversionedObject(keys);
```

**For Binary Data**:
```typescript
// Store BLOB
const result = await storeArrayBufferAsBlob(arrayBuffer);
// Returns: { hash: SHA256Hash<BLOB>, status: 'new' | 'exists' }

// Read BLOB
const data = await readBlobAsArrayBuffer(blobHash);
```

### Versioning System

Versioned objects use a DAG (Directed Acyclic Graph):

```typescript
interface VersionNode {
    depth: number;
    creationTime: number;
    data: SHA256Hash;  // Hash of actual object data
}

// Version node types:
// - VersionNodeEdge: First version
// - VersionNodeChange: Linear update (prev: hash)
// - VersionNodeMerge: Merge versions (nodes: Set<hash>)
```

**Version Map**: Maps `ID hash → Set<version hashes>`

**Retrieval**:
- `getObject(objectHash)` - Get specific version
- `getObjectByIdHash(idHash)` - Get latest version
- Requires vheads files created by `storeVersionedObject()`

### Reference Types in Recipes

```typescript
// Reference to specific object version
{
    itemprop: 'attachment',
    itemtype: {
        type: 'referenceToObj',
        allowedTypes: new Set(['Message'])
    }
}

// Reference to all versions via ID
{
    itemprop: 'owner',
    itemtype: {
        type: 'referenceToId',
        allowedTypes: new Set(['Person'])
    }
}

// Reference to BLOB
{
    itemprop: 'photo',
    itemtype: { type: 'referenceToBlob' }
}

// Collection types
{
    itemprop: 'keywords',
    itemtype: {
        type: 'bag',  // Also: array, set, map
        item: {
            type: 'referenceToId',
            allowedTypes: new Set(['Keyword'])
        }
    }
}
```

### TypeScript Type System

ONE.core uses declaration merging for extensible types:

```typescript
// Extend ONE's type system (in @OneCoreTypes.d.ts)
declare module '@OneObjectInterfaces' {
    export interface OneVersionedObjectInterfaces {
        Subject: Subject;
        Keyword: Keyword;
    }
}

// Now Subject and Keyword are recognized ONE types
```

### Common Pitfalls

1. **Using postToChannel() without storeVersionedObject()**
   - `postToChannel()` syncs objects across instances
   - `storeVersionedObject()` creates persistent vheads files
   - **Both are required** for versioned objects retrieved via ID hash

2. **Incorrect Recipe Definitions**
   - Missing `rules: []` in array item definitions crashes parser
   - Using `type: 'string'` instead of `referenceToId` breaks references
   - Forgetting `isId: true` makes objects unversioned

3. **Hash Type Confusion**
   - Don't use object hashes where ID hashes are expected
   - Keywords with Subject ID hashes must match what `storeVersionedObject()` returns

4. **ID Hash Calculation**
   - Use `calculateIdHashOfObj()` for consistent ID hashes
   - Only ID properties (marked `isId: true`) are included in ID hash

### Creating Custom Versioned Objects

```typescript
// 1. Define interface
interface Subject {
    $type$: 'Subject';
    id: string;  // ID property
    topic: SHA256IdHash<Topic>;
    keywords: SHA256IdHash<Keyword>[];
}

// 2. Extend type system
declare module '@OneObjectInterfaces' {
    export interface OneVersionedObjectInterfaces {
        Subject: Subject;
    }
}

// 3. Create recipe
const SubjectRecipe: Recipe = {
    $type$: 'Recipe',
    name: 'Subject',
    rule: [
        { itemprop: 'id', isId: true },  // Marks as versioned
        {
            itemprop: 'topic',
            itemtype: {
                type: 'referenceToId',
                allowedTypes: new Set(['Topic'])
            }
        },
        {
            itemprop: 'keywords',
            itemtype: {
                type: 'bag',
                item: {
                    type: 'referenceToId',
                    allowedTypes: new Set(['Keyword'])
                }
            }
        }
    ]
};

// 4. Register recipe (during init)
await registerRecipes([SubjectRecipe]);

// 5. Create and store objects
const subject = {
    $type$: 'Subject',
    id: 'my-subject',
    topic: topicIdHash,
    keywords: [keywordIdHash1, keywordIdHash2]
};

// CRITICAL: Store before posting to channel
const result = await storeVersionedObject(subject);
await channelManager.postToChannel(topicId, subject);
```

## Recent Optimizations (January 2025)

### Performance Improvements
- **LLM Pre-warming**: Added `preWarmConnection()` in llm-manager.js to reduce cold start from 12+ seconds to <1 second
- **Contact Caching**: Added 5-second TTL cache in one-core.js handlers to prevent redundant `getContacts` calls
- **Log Reduction**: Commented out excessive "OBJECT RECEIVED" logging, batched MCP tool registration logs
- **Race Condition Fix**: Added proper mutex cleanup in `finally` block for topic creation
- **AI Topic Registration Fix**: Fixed initialization order in ai-assistant-model.js - AI contacts must be loaded before scanning topics

### AI Response + Analysis Combined
- **Single LLM Call**: New `chatWithAnalysis()` method in llm-manager.js combines response generation with keyword/subject extraction
- **Non-blocking**: Uses `setImmediate()` to process analysis in background while streaming response
- **Structured Output**: LLM returns formatted response with [RESPONSE] and [ANALYSIS] sections
- **Automatic Processing**: Keywords and subjects are created/updated without blocking user interaction

## Structured LLM Communication (Feature 018 - IN DEVELOPMENT)

**Status**: Planning complete, using Ollama native structured outputs

### Overview
Structured JSON-based protocol for LLM responses using Ollama's native `format` parameter. Guarantees valid JSON structure (no parsing errors), extracts keywords/subjects/summaries reliably, stores directly as ONE.core objects using existing recipes. Eliminates need for prompt engineering to teach format.

### JSON Schema (Ollama Structured Outputs)

**Response Schema** (enforced by Ollama at generation time):
```json
{
  "response": "Natural language response",
  "analysis": {
    "subjects": [
      {
        "name": "subject-name",
        "description": "Brief explanation",
        "isNew": true,
        "keywords": [
          {"term": "keyword", "confidence": 0.8}
        ]
      }
    ],
    "summaryUpdate": "Brief summary of exchange"
  }
}
```

### Storage

**ONE.core Objects** (using existing recipes):
- JSON is parsed and stored directly as ONE.core objects
- Subject: Created/updated from analysis.subjects
- Keyword: Created from subject keywords
- Summary: Updated from analysis.summaryUpdate
- Message: Links to extracted subjects/keywords via ONE.core references
- No intermediate XML storage - parse JSON and create objects directly

### Implementation Files

**New**:
- `/main/schemas/llm-response.schema.ts` - JSON schema for Ollama `format` parameter
- `/specs/018-we-must-create/contracts/json-schema.md` - JSON schema contract

**Modified**:
- `/main/services/ollama.ts` - Added `format` parameter support in chatWithOllama()
- `/main/services/llm-manager.ts` - Pass `format` option through, parse JSON response
- `/main/core/ai-assistant-model.ts` - Parse JSON, create ONE.core objects directly
- `/main/ipc/handlers/llm.ts` - Return `{text, analysis}` with parsed data

### Key Principles

- **Guaranteed Structure**: Ollama validates JSON schema before returning (no malformed responses)
- **Fail Fast**: JSON parse errors throw (but shouldn't happen - Ollama guarantees structure)
- **No Legacy Migration**: Old conversations stay as-is, new use structured outputs
- **Real-time Processing**: Extraction during chat with `setImmediate()` for non-blocking
- **Traceability**: Extracted objects link back to source message via ONE.core references
- **Performance**: <5ms JSON parsing overhead

### Technical Decisions

- **Schema Enforcement**: Ollama's native `format` parameter (no parsing errors possible)
- **JSON Parsing**: Native JSON.parse() (~1-2ms for 10KB)
- **System Prompt**: Simplified (~100 tokens vs 400 - no format teaching needed), temperature=0
- **Storage**: ONE.core native objects using existing recipes (Subject, Keyword, Summary)

### Documentation

- Spec: `/specs/018-we-must-create/spec.md`
- Plan: `/specs/018-we-must-create/plan.md` (updated for Ollama structured outputs)
- Research: `/specs/018-we-must-create/research.md`
- Contracts: `/specs/018-we-must-create/contracts/json-schema.md` (JSON schema for Ollama)
- Data Model: `/specs/018-we-must-create/data-model.md`
- Quickstart: `/specs/018-we-must-create/quickstart.md`
- Ollama Blog: https://ollama.com/blog/structured-outputs

### Topic ID Determinism
- **Name-based IDs**: Topics use cleaned conversation names as IDs (e.g., "pizza-discussion" not "topic-1758610172370")
- **Duplicate Prevention**: System checks for existing topics and appends counter if needed
- **No Auto-creation**: Topic analysis no longer creates topics when checking for messages
- **Consistent References**: All topic IDs are deterministic and predictable

## HTML Export with Microdata (NEW)

**Feature**: Export conversations as HTML with comprehensive microdata markup using ONE.core's implode() function.

### Core Concept
- Uses ONE.core's native `implode()` function to embed referenced objects
- Generates HTML with microdata attributes for hashes and signatures
- Creates self-contained HTML files with inline styling

### IPC Handler
- `export:htmlWithMicrodata` - Export conversation as HTML with embedded microdata
- Location: `/main/ipc/handlers/export.js`
- Request: topicId, format, options (includeSignatures, maxMessages, etc.)
- Response: HTML string and metadata

### Implementation Architecture
**Services**:
- `/main/services/html-export/implode-wrapper.js` - ONE.core implode() integration
- `/main/services/html-export/formatter.js` - Human-readable HTML formatting

**Key Functions**:
- `implode(hash)` - Recursively embed referenced ONE objects as microdata
- `escapeForHtml()` - Sanitize user content for safe HTML rendering
- `calculateHashOfObj()` - Get SHA-256 hash for verification

**Microdata Format**:
```html
<div itemscope itemtype="//refin.io/Message" data-hash="[hash]" data-signature="[sig]">
  <span itemprop="content">[message]</span>
</div>
```

## Topic Analysis with AI

**Feature**: AI-powered analysis of conversations to extract subjects, keywords, and generate summaries.

### Data Model (one.ai package)
- **Subject**: Distinct theme identified by keyword combination (e.g., "children+education")
- **Keyword**: Extracted term/concept from conversations
- **Summary**: Versioned overview of all subjects in a topic

### IPC Handlers for Topic Analysis
- `topicAnalysis:analyzeMessages` - Extract subjects and keywords from messages
- `topicAnalysis:getSubjects` - Retrieve subjects for a topic
- `topicAnalysis:getSummary` - Get current or historical summary
- `topicAnalysis:updateSummary` - Manually trigger summary update
- `topicAnalysis:extractKeywords` - Extract keywords from text
- `topicAnalysis:mergeSubjects` - Combine related subjects

### Integration Points
- Uses existing LLMManager for AI operations
- Stores as ONE.core objects in Node.js
- UI components in `/electron-ui/src/components/TopicSummary/`
- All processing happens in Node.js, UI receives via IPC

### Implementation Details
**Core Files**:
- `/main/core/one-ai/` - Package root with models, services, and storage
- `/main/core/one-ai/models/` - Subject.js, Keyword.js, Summary.js
- `/main/core/one-ai/services/TopicAnalyzer.js` - Main analysis service
- `/main/core/one-ai/storage/` - Persistence layer for all objects
- `/main/ipc/handlers/topic-analysis.js` - IPC handler implementations

**UI Components**:
- `TopicSummary.tsx` - Main summary display with version history
- `SubjectList.tsx` - List of identified subjects with merge capability
- `KeywordCloud.tsx` - Visual keyword display
- `SummaryHistory.tsx` - Version history browser

**Performance Features**:
- LRU cache for keyword extraction (100 entry limit)
- Batch message processing with parallelization
- Async summary pruning (10 versions, 30-day retention)
- Cache hit rate tracking and optimization

**Auto-Analysis**:
- Triggers after every message (immediate analysis)
- Identifies subjects by keyword combinations
- Generates AI summary referencing all subjects
- Updates summary when subjects change significantly

## Context-Aware Knowledge Sharing (Feature 019 - PLANNED)

**Status**: Planning complete, design artifacts ready for implementation

### Overview
Displays context-aware proposals above the chat entry field to suggest relevant past conversations based on subject/keyword matching. Users see a single proposal at a time, with horizontal swipe navigation through ranked proposals. Configurable matching algorithm with initial implementation using Jaccard similarity.

### Data Model
- **Proposal** (computed, not stored): Links past subject to current subject via matched keywords
  - `pastSubject`: SHA256IdHash<Subject> - Reference to past subject
  - `currentSubject`: SHA256IdHash<Subject> - Reference to current subject
  - `matchedKeywords`: string[] - Keywords shared between subjects
  - `relevanceScore`: number (0.0-1.0) - Computed relevance via algorithm
  - `sourceTopicId`: string - Origin conversation
  - `pastSubjectName`: string - Human-readable label
  - `createdAt`: number - Past subject timestamp for recency

- **ProposalConfig** (ONE.core versioned object, userEmail as ID):
  - `matchWeight`: number (0.0-1.0) - Weight for keyword overlap
  - `recencyWeight`: number (0.0-1.0) - Weight for subject age
  - `recencyWindow`: integer - Time window in milliseconds for recency boost
  - `minJaccard`: number (0.0-1.0) - Minimum similarity threshold
  - `maxProposals`: integer (1-50) - Maximum proposals to return
  - `updated`: integer - Last config update timestamp

- **DismissedProposal** (session-only, in-memory):
  - `topicId`: string - Current conversation
  - `pastSubjectIdHash`: SHA256IdHash<Subject> - Dismissed past subject
  - `dismissedAt`: number - Dismissal timestamp

### Matching Algorithm (Phase 1: Jaccard Similarity)
```javascript
// Jaccard similarity: |intersection| / |union|
const intersection = currentKeywords.filter(k => pastKeywords.has(k));
const union = [...new Set([...currentKeywords, ...pastKeywords])];
const jaccard = intersection.size / union.size;

// Recency boost: Linear decay over recency window
const age = Date.now() - pastSubject.created;
const recencyBoost = Math.max(0, 1 - (age / config.recencyWindow));

// Weighted combination
const relevanceScore = jaccard * config.matchWeight + recencyBoost * config.recencyWeight;
```

### IPC Handlers for Proposals
- `proposals:getForTopic` - Get ranked proposals for topic based on current subjects
- `proposals:updateConfig` - Update user's matching algorithm configuration
- `proposals:getConfig` - Retrieve current configuration (or defaults)
- `proposals:dismiss` - Mark proposal as dismissed for current session
- `proposals:share` - Share proposal's past subject context into conversation

### Integration Points
- **Depends on Feature 018**: Uses Subject and Keyword objects from topic analysis
- **Node.js Services**:
  - `/main/services/proposal-engine.js` - Core matching logic
  - `/main/services/proposal-ranker.js` - Ranking algorithm
  - `/main/ipc/handlers/proposals.js` - IPC handler implementations
- **React UI Components**:
  - `/electron-ui/src/components/ProposalCard.tsx` - Single proposal display
  - `/electron-ui/src/components/ProposalCarousel.tsx` - Swipeable container
  - `/electron-ui/src/hooks/useProposals.ts` - React hook for proposal state
- **Gesture Library**: react-swipeable (mouse + touch support for desktop)

### Caching Strategy
- **In-Memory LRU Cache**: Max 50 entries, 60-second TTL
- **Cache Key**: `${topicId}:${currentSubjectIds.sort().join(',')}`
- **Invalidation Triggers**:
  - New subject added to current topic
  - Proposal config changed
  - Topic switched
  - 60-second TTL expired

### Performance Targets
- Proposal generation: <100ms (includes subject query + matching + ranking)
- Swipe gesture response: <50ms
- Cache lookup: <1ms (O(1) map access)

### Key Principles
- **Proposals are ephemeral**: Computed on-demand, not stored in ONE.core
- **Config is versioned**: ProposalConfig stored as versioned object (userEmail as ID)
- **Session-scoped dismissals**: DismissedProposal cleared on app restart
- **Real-time updates**: Proposals regenerate when current subjects change
- **Fail-fast**: No proposals when no subjects exist (no empty state handling)

### Documentation
- Spec: `/specs/019-above-the-chat/spec.md`
- Plan: `/specs/019-above-the-chat/plan.md`
- Research: `/specs/019-above-the-chat/research.md`
- Data Model: `/specs/019-above-the-chat/data-model.md`
- Contracts: `/specs/019-above-the-chat/contracts/ipc-proposals.json`
- Quickstart: `/specs/019-above-the-chat/quickstart.md`

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
   - Direct person-based access to BOTH channel AND Topic object
   - Both participants are granted individual access
   - NO Group objects needed or used for P2P
   - Channel access: `{id: channelHash, person: [person1, person2]}`
   - Topic access: `{object: topicHash, person: [person1, person2]}`

3. **Why P2P is Different**
   - Simpler: Only two people, no need for complex group management
   - Compatible: Works with one.leute's P2P expectations
   - No CHUM issues: No Group objects to be rejected

4. **Critical Implementation Detail**
   - Must grant access to Topic object itself (not just channel)
   - one.leute pattern: Always grants access to both ChannelInfo and Topic
   - Without Topic access, peer cannot see conversation structure

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

## Transport Architecture

**IMPORTANT**: Clean separation between transport and protocol layers:

```
Application Layer:  [CHUM Sync Protocol]
                           |
Protocol Layer:     [ConnectionsModel]
                           |
                    ---------------
                    |             |
Transport Layer:  [QUIC]    [WebSocket]
                 (future)    (legacy)
```

### Transport Layers

- **QUIC** (`/main/core/quic-transport.js`): Future direct P2P transport
  - Direct peer-to-peer connections
  - No relay server needed
  - Lower latency, better performance
  - Placeholder implementation until node:quic is stable

- **WebSocket** (via commserver): Current transport
  - Uses relay server (commserver)
  - Works today, proven reliable
  - Will be phased out once QUIC is ready

### Protocol Layer

- **CHUM**: Application-level sync protocol
  - Handles data synchronization between peers
  - Transport-agnostic - works over ANY transport
  - Managed by ConnectionsModel

- **ConnectionsModel**: Protocol manager
  - Implements CHUM protocol logic
  - Uses pluggable transports (QUIC, WebSocket, etc.)
  - Transport selection is transparent to CHUM

### Key Principles

1. **Transports are dumb** - They only move bytes, no application logic
2. **CHUM is transport-agnostic** - Works over any reliable transport
3. **Clean separation** - Transport layer doesn't know about channels, sync, or application concepts
4. **Pluggable architecture** - New transports can be added without changing CHUM

### Common Mistakes to Avoid

- **DON'T** implement CHUM logic in transport layer (like quic-vc-transport.js did)
- **DON'T** create channels from transport layer
- **DON'T** mix trust/verification with transport
- **DO** keep transport as a simple byte pipe
- **DO** let ConnectionsModel handle all CHUM protocol logic