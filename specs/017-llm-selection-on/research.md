# Phase 0: Research & Technical Decisions

## Feature Context
Adding network-based Ollama support to allow users to configure remote Ollama servers in addition to local instances. This enables team collaboration, remote hardware access, and flexible deployment options.

## Current Implementation Analysis

### Existing Ollama Integration
**Location**: `/main/services/ollama.ts`, `/main/services/llm-manager.ts`

**Current Behavior**:
- Hardcoded to `http://localhost:11434`
- No configuration for custom endpoints
- No authentication support
- Direct fetch calls to local Ollama API

**Key Discovery**: The ollama.ts service already abstracts Ollama API calls - we can modify it to support configurable endpoints.

### LLM Configuration Storage
**Location**: `/main/recipes/LLM.ts`, `/main/core/llm-object-manager.ts`

**Current Model**:
- LLM objects stored as ONE.core versioned objects
- Recipe includes `modelType: 'local' | 'remote'` (already exists!)
- Has optional `provider` field
- Missing: server address/URL field

**Key Discovery**: The LLM recipe already distinguishes between local and remote models via `modelType`. We can extend this without breaking changes.

### UI Components
**Location**: `/electron-ui/src/components/ModelOnboarding.tsx`

**Current Behavior**:
- First-time setup for model selection
- Checks for local Ollama availability via `isOllamaRunning()`
- Displays available Ollama models
- No settings/configuration UI for Ollama server address

**Missing**:
- Settings page for LLM configuration
- Network address input fields
- Connection testing UI

## Technical Decisions

### 1. Configuration Storage Approach
**Decision**: Extend existing LLM Recipe with network configuration fields

**Rationale**:
- Recipe already has `modelType: 'local' | 'remote'`
- Versioned objects support schema evolution
- Consistent with existing ONE.core patterns
- No breaking changes to existing data

**Fields to Add**:
- `baseUrl?: string` - Ollama server address (e.g., "http://192.168.1.100:11434")
- `authToken?: string` - Optional bearer token for authentication
- `authType?: 'none' | 'bearer'` - Authentication method

### 2. Service Layer Architecture
**Decision**: Make Ollama service endpoint-configurable with fallback to localhost

**Rationale**:
- Minimal changes to existing code
- Backward compatible (defaults to localhost)
- Single source of truth for endpoint configuration
- Testable without modifying fetch calls

**Implementation Pattern**:
```typescript
// Instead of hardcoded:
// const url = 'http://localhost:11434/api/tags'

// Use configurable:
// const baseUrl = this.config.baseUrl || 'http://localhost:11434'
// const url = `${baseUrl}/api/tags`
```

### 3. Authentication Strategy
**Decision**: Support bearer token authentication with secure storage

**Rationale**:
- Ollama can be proxied behind auth-enabled reverse proxies
- Bearer tokens are HTTP standard (Authorization header)
- Electron's safeStorage API provides OS-level encryption
- Future-proof for API key support

**Alternatives Considered**:
- Basic Auth: Less secure, credentials in base64
- OAuth: Too complex for private Ollama deployments
- mTLS: Requires certificate management

**Rejected Because**: Bearer tokens offer security + simplicity balance for this use case

### 4. URL Validation Approach
**Decision**: Validate format + test connectivity before saving

**Rationale**:
- Spec requirement FR-006 & FR-007
- Prevents invalid configurations
- Immediate user feedback
- No silent failures

**Validation Steps**:
1. Parse URL format (protocol, host, port)
2. Test connectivity (GET /api/tags)
3. Verify response indicates Ollama server
4. List available models for confirmation

### 5. UI Integration Points
**Decision**: Add network option to ModelOnboarding + create Settings page

**Rationale**:
- FR-001: Must be available in first-time setup
- FR-002: Must be available in settings
- Consistent with existing UI patterns
- Non-disruptive to current flow

**UI Components Needed**:
- Network address input field (with validation)
- "Test Connection" button
- Authentication fields (conditional)
- Provider type selector (Local / Network)
- Available models list (dynamic based on server)

### 6. IPC Contract Design
**Decision**: Add new IPC handlers for network Ollama configuration

**Rationale**:
- LAMA Constitution: All operations via IPC
- Browser has NO business logic
- Node.js manages configuration and connectivity
- Clear separation of concerns

**New IPC Handlers**:
- `llm:setOllamaConfig` - Save network configuration
- `llm:testOllamaConnection` - Validate connectivity
- `llm:getOllamaConfig` - Retrieve current config
- `llm:getAvailableModels` - List models from configured server

### 7. Default Values Strategy
**Decision**: Pre-fill localhost:11434, allow override

**Rationale**:
- FR-014: Pre-fill local interface
- Most users start with local setup
- Easy to modify for network deployments
- Clear indication of default behavior

### 8. Error Handling Strategy
**Decision**: Fail fast with clear error messages, no retries

**Rationale**:
- LAMA Constitution: No fallbacks, fix the problem
- Network issues are user-actionable (wrong URL, server down)
- Clear errors guide troubleshooting
- No silent degradation

**Error Scenarios**:
- Invalid URL format → Parse error with correction hint
- Server unreachable → Network error with connectivity check
- Authentication failed → Auth error with credential prompt
- No models available → Empty state with guidance

## Technology Stack (Existing)

**Language/Version**: TypeScript 5.x (existing)
**Primary Dependencies**:
- `node-fetch` (HTTP client, existing)
- `electron` (safeStorage for credentials)
- `@refinio/one.core` (storage layer, existing)

**Storage**: ONE.core versioned objects (existing LLM recipe)
**Testing**: Integration tests with real Ollama instances
**Target Platform**: Electron (macOS/Linux/Windows)

## Security Considerations

### Credential Storage
**Approach**: Use Electron's safeStorage API

**Implementation**:
```typescript
import { safeStorage } from 'electron'

// Encrypt before storage
const encrypted = safeStorage.encryptString(authToken)
await storeInOneCore({ encryptedToken: encrypted.toString('base64') })

// Decrypt when needed
const decrypted = safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
```

**Why**: OS-level encryption (Keychain on macOS, DPAPI on Windows, libsecret on Linux)

### Network Security
- Support HTTPS endpoints for encrypted transport
- Validate SSL certificates (don't bypass verification)
- Warn users about HTTP connections to remote servers
- No credential transmission over unencrypted connections

## Performance Considerations

### Connection Testing
**Approach**: 2-second timeout for validation requests

**Rationale**:
- Quick feedback to user
- Prevents UI blocking
- Distinguishes between slow and unreachable servers

### Model Discovery
**Approach**: Cache available models list per endpoint

**Rationale**:
- Reduces redundant API calls
- Faster UI rendering
- Invalidate cache on config change

## Migration Strategy

### Existing Users
**Impact**: Zero - localhost remains default

**Upgrade Path**:
1. Existing configs continue working (localhost implicit)
2. New `baseUrl` field is optional
3. UI shows "Local Ollama" by default
4. Settings unlock network configuration

### New Users
**Experience**:
1. First-time setup offers "Local" or "Network" Ollama
2. Local pre-filled with localhost:11434
3. Network requires address input + connection test
4. Cannot proceed without valid configuration

## Open Questions Resolved

1. **Authentication methods**: Bearer token (future: extend as needed)
2. **Credential storage**: Electron safeStorage (OS-encrypted)
3. **Validation timing**: Before saving (not at runtime)
4. **Default address**: http://localhost:11434 (pre-filled, editable)
5. **HTTPS support**: Yes, with proper certificate validation
6. **Error recovery**: Fail fast, clear messages, no retries
7. **Model discovery**: Dynamic from configured server, cached

## Phase 0 Completion Checklist

- [x] Analyzed existing Ollama integration
- [x] Reviewed LLM data model and recipe
- [x] Evaluated UI components and integration points
- [x] Decided configuration storage approach
- [x] Chose authentication strategy
- [x] Designed URL validation flow
- [x] Planned IPC contract additions
- [x] Addressed security requirements
- [x] Considered performance implications
- [x] Planned migration for existing users
- [x] Resolved all open questions from spec

**Status**: ✅ Phase 0 Complete - Ready for Phase 1 (Design & Contracts)
