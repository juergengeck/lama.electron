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

## XML-Based LLM Communication (Feature 018 - IN DEVELOPMENT)

**Status**: Planning complete, ready for implementation

### Overview
Structured XML protocol for LLM queries and responses, replacing text-based [RESPONSE]/[ANALYSIS] format. Enables reliable extraction of keywords, subjects, and summaries with full traceability.

### XML Format

**Query Format**:
```xml
<llmQuery>
  <userMessage>[User's message]</userMessage>
  <context topicId="..." messageCount="...">
    <activeSubjects>subject1, subject2</activeSubjects>
    <recentKeywords>keyword1, keyword2</recentKeywords>
  </context>
</llmQuery>
```

**Response Format**:
```xml
<llmResponse>
  <response>[Human-readable text]</response>
  <analysis>
    <subject name="topic-name" description="..." isNew="true|false">
      <keyword term="keyword" confidence="0.8" />
    </subject>
    <summaryUpdate>[Incremental summary]</summaryUpdate>
  </analysis>
</llmResponse>
```

### New Data Models

**XMLMessageAttachment**:
- Stores complete XML messages as BLOB (>1KB) or inline (≤1KB)
- Fields: `topicId`, `messageId`, `xmlContent`/`xmlBlob`, `format`, `version`, `size`
- Enables verification and debugging of LLM extractions

**SystemPromptTemplate**:
- Per-model system prompts with XML format instructions
- Fields: `modelId`, `promptText`, `xmlSchemaVersion`, `version`, `active`
- Templates teach LLMs the expected XML structure

**Enhanced Models** (added `sourceXmlHash` field):
- Keyword: Links to XMLMessageAttachment that extracted it
- Subject: Links to XMLMessageAttachment that created it
- Summary: Links to XMLMessageAttachment that triggered update

### Implementation Files

**New**:
- `/main/core/one-ai/models/XMLMessageAttachment.ts` - BLOB/inline storage model
- `/main/core/one-ai/models/SystemPromptTemplate.ts` - System prompt management
- `/main/core/one-ai/recipes/xml-message-attachment.ts` - Recipe definition
- `/main/core/one-ai/recipes/system-prompt-template.ts` - Recipe definition

**Modified**:
- `/main/services/llm-manager.ts` - Add `formatQueryAsXML()`, `parseXMLResponse()`
- `/main/services/attachment-service.ts` - Add `storeXMLAttachment()`, `retrieveXMLAttachment()`
- `/main/core/ai-assistant-model.ts` - Use XML protocol, set `sourceXmlHash` on objects
- `/main/ipc/handlers/llm.ts` - Return `{text, xmlAttachmentId, analysis}`

### Key Principles

- **Fail Fast**: Malformed XML throws error, no fallback to text
- **No Legacy Migration**: Old conversations stay as-is, new use XML
- **Real-time Processing**: Extraction during chat with `setImmediate()` for non-blocking
- **Traceability**: Every extracted object links back to source XML via `sourceXmlHash`
- **Performance**: <100ms parsing overhead, <1MB average attachment size

### Technical Decisions

- **Parser**: fast-xml-parser v4.x (3-5ms for 10KB)
- **System Prompt**: One-shot learning, ~400 tokens, temperature=0
- **Storage**: BLOB for >1KB, inline for ≤1KB
- **Schema**: 3-level max depth, camelCase tags, attributes for metadata

### Documentation

- Spec: `/specs/018-we-must-create/spec.md`
- Plan: `/specs/018-we-must-create/plan.md`
- Research: `/specs/018-we-must-create/research.md`
- Contracts: `/specs/018-we-must-create/contracts/xml-schema.md`
- Data Model: `/specs/018-we-must-create/data-model.md`
- Quickstart: `/specs/018-we-must-create/quickstart.md`

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
- Triggers after 5 messages in conversation
- Identifies subjects by keyword combinations
- Generates AI summary referencing all subjects
- Updates summary when subjects change significantly

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