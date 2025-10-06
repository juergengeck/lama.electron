# Data Model: Ollama Network Configuration

## Overview
Extends the existing LLM recipe to support network-based Ollama instances with optional authentication. The data model maintains backward compatibility while enabling remote server configuration.

## Entity: OllamaConfig

### Description
Configuration for Ollama service connection, supporting both local and network deployments.

### Storage
- **Location**: ONE.core versioned object (extends existing LLM recipe)
- **Type**: LLM object with network configuration fields
- **Persistence**: File-based ONE.core storage in Node.js main process

### Fields

#### Core Identity (Existing)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$type$` | string | Yes | Always "LLM" |
| `name` | string | Yes | Model identifier (e.g., "llama3.2:latest") |
| `filename` | string | Yes | Display name |
| `modelType` | `'local' \| 'remote'` | Yes | **Key field**: 'local' for localhost, 'remote' for network |
| `active` | boolean | Yes | Whether this config is currently active |
| `deleted` | boolean | Yes | Soft delete flag |

#### Network Configuration (NEW)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `baseUrl` | string | No | Ollama server address (e.g., "http://192.168.1.100:11434") |
| `authType` | `'none' \| 'bearer'` | No | Authentication method (default: 'none') |
| `encryptedAuthToken` | string | No | Base64-encoded encrypted token (via Electron safeStorage) |

#### Metadata (Existing)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `creator` | string | No | User who created this config |
| `created` | number | Yes | Creation timestamp |
| `modified` | number | Yes | Last modification timestamp |
| `createdAt` | string | Yes | ISO timestamp |
| `lastUsed` | string | Yes | Last usage timestamp |
| `personId` | SHA256IdHash | No | Associated AI contact Person ID |

### Validation Rules

#### URL Format Validation
- Must start with `http://` or `https://`
- Must include hostname or IP address
- Port is optional (defaults to 11434)
- No trailing slash required (normalized internally)

**Examples**:
- ✅ `http://localhost:11434`
- ✅ `http://192.168.1.100:11434`
- ✅ `https://ollama.example.com`
- ✅ `http://10.0.0.5` (port 11434 implied)
- ❌ `localhost:11434` (missing protocol)
- ❌ `https://` (missing hostname)

#### Authentication Rules
- If `authType` is 'bearer', `encryptedAuthToken` must be present
- If `authType` is 'none', `encryptedAuthToken` must be absent
- Token encryption uses Electron safeStorage (OS-level keychain)

#### ModelType Rules
- `modelType: 'local'` → `baseUrl` is optional (defaults to localhost:11434)
- `modelType: 'remote'` → `baseUrl` is required and must be validated

### State Transitions

```
[New Config]
    ↓
[Validating URL] → (invalid) → [Error: Invalid Format]
    ↓ (valid)
[Testing Connection] → (unreachable) → [Error: Cannot Connect]
    ↓ (connected)
[Fetching Models] → (no models) → [Warning: No Models Available]
    ↓ (models found)
[Active Config] ← (user selects model)
    ↓
[In Use] → (connection lost) → [Error: Server Unreachable]
```

### Relationships

```
OllamaConfig (LLM object)
    ├── personId → Person (AI contact in ONE.core)
    ├── Used by → LLMManager (service layer)
    └── Displayed in → UI components (ModelOnboarding, Settings)
```

## Entity: OllamaConnection (Runtime)

### Description
Runtime connection state (NOT persisted to ONE.core). Managed in memory by LLMManager.

### Fields
| Field | Type | Description |
|-------|------|-------------|
| `config` | OllamaConfig | Active configuration |
| `baseUrl` | string | Computed URL (from config or default) |
| `authHeaders` | Record<string,string> | Computed auth headers (if auth enabled) |
| `availableModels` | string[] | Cached list of models from server |
| `lastChecked` | number | Timestamp of last connectivity check |
| `isReachable` | boolean | Current reachability status |

### Methods (Service Layer)
- `testConnection()` → boolean: Validate server reachability
- `fetchModels()` → string[]: Get available models from server
- `makeRequest(endpoint, options)` → Response: Authenticated fetch to Ollama API

## Data Flow

### 1. Configuration Creation (First-Time Setup)
```
User Input (UI)
    ↓
Validate URL format (Browser)
    ↓
IPC: llm:testOllamaConnection { baseUrl, authToken? }
    ↓
Node.js: Test connectivity + fetch models
    ↓
IPC Response: { success, models[], error? }
    ↓
IPC: llm:setOllamaConfig { ...config }
    ↓
Node.js: Encrypt token + store LLM object
    ↓
ONE.core: Persist versioned object
```

### 2. Configuration Update (Settings)
```
Load existing config (IPC: llm:getOllamaConfig)
    ↓
User modifies baseUrl/authToken
    ↓
Validate + Test connection
    ↓
Update LLM object (modify existing, don't create new)
    ↓
Invalidate model cache
    ↓
Re-fetch models from new server
```

### 3. Runtime Usage (Chat Request)
```
User sends message
    ↓
LLMManager retrieves active OllamaConfig
    ↓
Compute baseUrl + auth headers
    ↓
Make fetch request to ${baseUrl}/api/chat
    ↓
Stream response to UI
    ↓
(On error) → Show clear error message, don't retry
```

## Schema Evolution

### Version 1 (Current - Pre-Feature)
```typescript
{
  $type$: "LLM",
  name: "llama3.2:latest",
  modelType: "local",
  // ... other fields
  // Implicit: baseUrl = localhost:11434
}
```

### Version 2 (Post-Feature)
```typescript
{
  $type$: "LLM",
  name: "llama3.2:latest",
  modelType: "remote", // Changed
  baseUrl: "http://192.168.1.100:11434", // NEW
  authType: "bearer", // NEW
  encryptedAuthToken: "b64_encrypted_token...", // NEW
  // ... other fields
}
```

### Backward Compatibility
- Existing configs without `baseUrl` default to localhost:11434
- Missing `authType` defaults to 'none'
- ONE.core handles optional fields automatically (recipe allows optional)
- No data migration required

## Index/Query Patterns

### Find Active Network Ollama Config
```typescript
// Query LLM objects where modelType === 'remote' AND active === true
channelManager.objectIteratorWithType('LLM', {
  channelId: 'lama',
  filter: (llm) => llm.modelType === 'remote' && llm.active
})
```

### Find Config by Base URL
```typescript
// Query for specific server configuration
channelManager.objectIteratorWithType('LLM', {
  channelId: 'lama',
  filter: (llm) => llm.baseUrl === targetUrl
})
```

## Encryption Details

### Token Encryption Flow
```typescript
// On save:
import { safeStorage } from 'electron'

const plainToken = "user-provided-token"
const encrypted = safeStorage.encryptString(plainToken)
const base64 = encrypted.toString('base64')

await storeVersionedObject({
  ...llmConfig,
  encryptedAuthToken: base64
})

// On use:
const stored = await loadVersionedObject(hash)
const buffer = Buffer.from(stored.encryptedAuthToken, 'base64')
const decrypted = safeStorage.decryptString(buffer)
// Use decrypted token in Authorization header
```

### Security Properties
- **At Rest**: Encrypted by OS (Keychain/DPAPI/libsecret)
- **In Transit**: HTTPS endpoint encryption (when using https://)
- **In Memory**: Decrypted only when making request
- **No Logging**: Token never appears in console logs

## Validation Implementation

### Pre-Save Validation
```typescript
async function validateOllamaConfig(config: OllamaConfig): Promise<ValidationResult> {
  // 1. URL format
  try {
    const url = new URL(config.baseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: 'Protocol must be http or https' }
    }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }

  // 2. Connectivity
  const response = await fetch(`${config.baseUrl}/api/tags`, {
    signal: AbortSignal.timeout(2000)
  })
  if (!response.ok) {
    return { valid: false, error: 'Cannot reach Ollama server' }
  }

  // 3. Model availability
  const data = await response.json()
  if (!data.models || data.models.length === 0) {
    return { valid: false, error: 'No models available on server' }
  }

  return { valid: true, models: data.models }
}
```

## Error States

| State | Cause | UI Display | Recovery |
|-------|-------|------------|----------|
| Invalid URL | Parse failure | "Invalid format: must be http://host:port" | User corrects input |
| Unreachable | Network/DNS error | "Cannot connect to server. Check address and network." | User checks connectivity |
| Auth Failed | 401/403 response | "Authentication failed. Check credentials." | User updates token |
| No Models | Empty model list | "Server has no models installed." | User installs models on server |
| Connection Lost | Runtime failure | "Lost connection to Ollama server." | User checks server status |

## Migration Checklist

- [x] Extend LLM recipe with optional network fields
- [x] Maintain backward compatibility (defaults for missing fields)
- [x] Define validation rules for new fields
- [x] Specify encryption approach for credentials
- [x] Document state transitions
- [x] Define error states and recovery
- [x] Specify query patterns for configs
- [x] Plan schema evolution path

**Status**: ✅ Data Model Complete
