# LAMA Electron Architecture V3 - Simplified Single Instance

## Core Principle

**Single ONE.core instance in Node.js**. The browser renderer is a pure UI layer that communicates exclusively via IPC. No browser ONE.core instance. Direct peer-to-peer communication via QUIC-VC with CommServer fallback.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                MAIN PROCESS (Node.js) - Single Instance      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              ONE.CORE INSTANCE (Full Archive)          │  │
│  │                                                        │  │
│  │  - Single user/identity                                │  │
│  │  - Full storage (file system)                          │  │
│  │  - All business logic                                  │  │
│  │  - Channel management                                  │  │
│  │  - Topic/conversation handling                         │  │
│  │  - AI integration                                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               refinio.api Server                       │  │
│  │                                                        │  │
│  │  - QUIC-based API endpoint                             │  │
│  │  - Orchestrates ONE.core instance                      │  │
│  │  - CLI access (refinio lama status, etc)               │  │
│  │  - ObjectHandler for data operations                   │  │
│  │  - RecipeHandler for recipes                           │  │
│  │  - InstanceAuthManager for authentication              │  │
│  │  - AIHandler for AI operations                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                 NETWORK LAYER                          │  │
│  │                                                        │  │
│  │  QUIC-VC Transport (Port 49497)                        │  │
│  │  - mDNS/Bonjour service: _lama-quic._udp               │  │
│  │  - Direct QUIC connections for CHUM traffic            │  │
│  │  - Automatic peer discovery on local network           │  │
│  │  - High-performance, low-latency transport             │  │
│  │                                                        │  │
│  │  CommServer (wss://comm10.dev.refinio.one)             │  │
│  │  - Primary transport for internet connections          │  │
│  │  - Fallback when QUIC-VC unavailable                  │  │
│  │  - WebSocket-based relay                               │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  IPC API LAYER                         │  │
│  │                                                        │  │
│  │  Complete ONE.core API exposed via IPC:                │  │
│  │  - auth:login / auth:logout                            │  │
│  │  - chat:send / chat:receive / chat:list                │  │
│  │  - contacts:add / contacts:remove / contacts:list      │  │
│  │  - topic:create / topic:join / topic:leave             │  │
│  │  - ai:chat / ai:configure                              │  │
│  │  - storage:get / storage:set                           │  │
│  │  - network:status / network:peers                     │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                               │
                               │ IPC
                               ▼
┌──────────────────────────────────────────────────────────────┐
│           RENDERER PROCESS (Browser) - Pure UI              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    UI COMPONENTS                       │  │
│  │                                                        │  │
│  │  - React components                                    │  │
│  │  - No ONE.core dependencies                            │  │
│  │  - No local storage (except UI preferences)           │  │
│  │  - All data fetched via IPC                           │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   IPC BRIDGE                           │  │
│  │                                                        │  │
│  │  Simple API client that forwards all calls to Node:    │  │
│  │  - Promises for request/response                       │  │
│  │  - Event emitters for real-time updates                │  │
│  │  - No business logic                                   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Key Changes from V2

### Removed
- Browser ONE.core instance
- Browser-Node federation
- Dual user architecture
- Browser IndexedDB storage
- Complex provisioning flow
- WebSocket connection between browser and node instances

### Added
- QUIC-VC local discovery as primary transport
- Complete IPC API surface
- Simplified authentication (single user)
- Direct IPC for all operations

### Benefits
1. **Simpler Architecture** - Single source of truth
2. **Better Performance** - No duplicate processing
3. **Easier Debugging** - All logic in one place
4. **Reduced Complexity** - No cross-instance synchronization
5. **Native Feel** - Direct file system access
6. **Local-First** - QUIC-VC prioritizes local connections

## refinio.api Integration

The refinio.api server provides a QUIC-based API interface for external tools and CLI access:

### Key Components
- **QuicVCServer**: QUIC transport for API endpoints
- **InstanceAuthManager**: Manages authentication for API access
- **ObjectHandler**: CRUD operations on ONE objects
- **RecipeHandler**: Recipe execution and management
- **AIHandler**: AI assistant integration

### Benefits
1. **CLI Access**: `refinio lama status`, `refinio lama chat`, etc.
2. **External Tool Integration**: Other apps can interact with LAMA
3. **Unified Orchestration**: Single point of control for ONE.core
4. **QUIC Performance**: Fast, reliable API transport

### API Usage Examples
```bash
# Check LAMA status
refinio lama status

# Send a message via CLI
refinio lama chat send "Hello from CLI"

# List conversations
refinio lama chat list
```

## Contact Acceptance System

### Two-Phase Contact Flow

The QUIC-VC transport implements a two-phase contact acceptance system for secure peer relationships:

**Phase 1: Discovery & Pending Review**
- Peers discover each other via UDP broadcast on port 49497
- Initial Verifiable Credentials (VC) are exchanged
- Contacts are stored as "pending" for user review
- No data synchronization occurs until acceptance

**Phase 2: User Acceptance**
- User reviews pending contact information in UI
- Configures permissions (messaging, calls, files, presence)
- Upon acceptance:
  - ONE.core contact objects created (Person, Profile, Someone)
  - Dedicated contact VC generated and exchanged
  - CHUM synchronization begins for shared channels
  - Mutual acceptance enables full communication

### Security Model

- **No automatic acceptance**: All contacts require explicit user approval
- **Cryptographic verification**: All VCs are signed and verified
- **Participant-based access**: CHUM sync only for shared channels
- **Revocable permissions**: Contacts and permissions can be revoked
- **Dedicated VCs**: Each accepted contact gets a unique relationship VC

### Components

```
main/core/
├── contact-acceptance-manager.js  # Two-phase contact flow
├── quic-vc-transport.js          # VC exchange & discovery
└── node-one-core.js              # Integration point

main/ipc/handlers/
└── contacts.js                   # IPC handlers for UI

electron-ui/src/components/
└── PendingContacts.tsx           # UI for contact review
```

## QUIC-VC Transport Details

### Discovery
- **mDNS/Bonjour**: Automatic discovery of LAMA instances on local network
- **Service Type**: `_lama-quic._udp` 
- **Port**: 49497 (standard QUIC-VC port)
- **TXT Records**: Include instance ID, person ID, protocol info

### Connection Flow
1. Node starts QUIC server on port 49497
2. Advertises service via mDNS/Bonjour
3. Discovers other LAMA instances automatically
4. Establishes direct QUIC connections
5. CHUM protocol runs over QUIC streams
6. Falls back to CommServer if QUIC unavailable

### Benefits
- **Local-First**: Prioritizes local network connections
- **High Performance**: QUIC provides better throughput than WebSocket
- **Automatic Discovery**: No manual configuration needed
- **Resilient**: Automatic fallback to CommServer

## Implementation Status

### ✅ Completed
1. Removed browser ONE.core instance and WebSocket listener
2. Created QUIC-VC transport module with UDP discovery
3. Implemented two-phase contact acceptance system
4. Created ContactAcceptanceManager for pending contacts
5. Added dedicated VC generation for accepted contacts
6. Integrated CHUM sync with participant-based channel access
7. Created IPC handlers for contact management
8. Built UI component for pending contact review
9. Added comprehensive documentation (ACCEPTANCE.md)

### 🚧 Next Steps
1. Extend ConnectionsModel to handle QUIC streams natively
2. Add QUIC connection type to LeuteConnectionsModule
3. Implement contact verification UI (QR codes, fingerprints)
4. Add contact import/export functionality
5. Create contact groups and permission templates

### Phase 4: Clean Up
1. Remove unused federation code
2. Simplify authentication flow
3. Update documentation
4. Test CLI access via refinio.api