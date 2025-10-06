# IPC Contracts: Ollama Network Configuration

## Overview
IPC handlers for configuring and managing network-based Ollama instances. All handlers run in Node.js main process and are called from the renderer via `window.electronAPI.invoke()`.

---

## 1. Test Ollama Connection

### Handler: `llm:testOllamaConnection`

**Purpose**: Validate connectivity to an Ollama server and retrieve available models.

**Request**:
```typescript
{
  baseUrl: string        // e.g., "http://192.168.1.100:11434"
  authToken?: string     // Optional bearer token
}
```

**Response Success**:
```typescript
{
  success: true
  models: Array<{
    name: string         // e.g., "llama3.2:latest"
    size: number        // bytes
    modified: string    // ISO timestamp
  }>
  serverInfo: {
    version?: string
  }
}
```

**Response Error**:
```typescript
{
  success: false
  error: string          // Human-readable error message
  errorCode: 'INVALID_URL' | 'NETWORK_ERROR' | 'AUTH_FAILED' | 'NO_MODELS'
}
```

**Error Codes**:
- `INVALID_URL`: URL format is invalid
- `NETWORK_ERROR`: Cannot reach server (DNS, timeout, connection refused)
- `AUTH_FAILED`: 401/403 response from server
- `NO_MODELS`: Server reachable but has no models

**Implementation Location**: `/main/ipc/handlers/llm-config.ts`

**Test Scenario**:
```typescript
// Should succeed with valid local Ollama
const result = await window.electronAPI.invoke('llm:testOllamaConnection', {
  baseUrl: 'http://localhost:11434'
})
assert(result.success === true)
assert(result.models.length > 0)

// Should fail with invalid URL
const result = await window.electronAPI.invoke('llm:testOllamaConnection', {
  baseUrl: 'not-a-url'
})
assert(result.success === false)
assert(result.errorCode === 'INVALID_URL')
```

---

## 2. Set Ollama Configuration

### Handler: `llm:setOllamaConfig`

**Purpose**: Save Ollama network configuration to ONE.core storage.

**Request**:
```typescript
{
  modelType: 'local' | 'remote'
  baseUrl?: string              // Required if modelType='remote'
  authType?: 'none' | 'bearer'  // Default: 'none'
  authToken?: string            // Required if authType='bearer'
  modelName: string             // Selected model name
  setAsActive: boolean          // Whether to make this the active config
}
```

**Response Success**:
```typescript
{
  success: true
  configHash: string           // SHA256 hash of stored LLM object
  personId: string            // AI contact Person ID (if created)
}
```

**Response Error**:
```typescript
{
  success: false
  error: string
  errorCode: 'VALIDATION_FAILED' | 'STORAGE_ERROR' | 'ENCRYPTION_ERROR'
}
```

**Validation Rules**:
- If `modelType='remote'`, `baseUrl` must be provided and valid
- If `authType='bearer'`, `authToken` must be provided
- `modelName` must not be empty
- Connection must be tested before calling this handler

**Implementation Location**: `/main/ipc/handlers/llm-config.ts`

**Test Scenario**:
```typescript
// Should save network Ollama config
const result = await window.electronAPI.invoke('llm:setOllamaConfig', {
  modelType: 'remote',
  baseUrl: 'http://192.168.1.100:11434',
  authType: 'bearer',
  authToken: 'secret-token',
  modelName: 'llama3.2:latest',
  setAsActive: true
})
assert(result.success === true)
assert(result.configHash.length === 64) // SHA256 length
```

---

## 3. Get Ollama Configuration

### Handler: `llm:getOllamaConfig`

**Purpose**: Retrieve current active Ollama configuration.

**Request**:
```typescript
{
  includeInactive?: boolean    // Default: false (only active config)
}
```

**Response Success**:
```typescript
{
  success: true
  config: {
    modelType: 'local' | 'remote'
    baseUrl: string            // Computed (localhost if local, stored if remote)
    authType: 'none' | 'bearer'
    hasAuthToken: boolean      // True if encrypted token stored (don't return token)
    modelName: string
    isActive: boolean
    created: number           // Timestamp
    lastUsed: string          // ISO timestamp
  } | null                     // null if no config exists
}
```

**Response Error**:
```typescript
{
  success: false
  error: string
  errorCode: 'STORAGE_ERROR'
}
```

**Security Note**: Never return decrypted `authToken` in response. Only indicate its presence with `hasAuthToken` boolean.

**Implementation Location**: `/main/ipc/handlers/llm-config.ts`

**Test Scenario**:
```typescript
// Should retrieve active config
const result = await window.electronAPI.invoke('llm:getOllamaConfig', {})
assert(result.success === true)
if (result.config) {
  assert(result.config.modelType === 'remote')
  assert(result.config.hasAuthToken === true)
  assert(!('authToken' in result.config)) // Never expose token
}
```

---

## 4. Get Available Models

### Handler: `llm:getAvailableModels`

**Purpose**: Fetch models from configured or specified Ollama server.

**Request**:
```typescript
{
  baseUrl?: string             // Optional: specify server, else use active config
  authToken?: string           // Optional: for ad-hoc queries
}
```

**Response Success**:
```typescript
{
  success: true
  models: Array<{
    name: string
    size: number
    modified: string
    digest: string
  }>
  source: 'active_config' | 'specified_url'
}
```

**Response Error**:
```typescript
{
  success: false
  error: string
  errorCode: 'NO_CONFIG' | 'NETWORK_ERROR' | 'AUTH_FAILED'
}
```

**Behavior**:
- If `baseUrl` provided: Query that server directly
- If no `baseUrl`: Use active config's baseUrl
- If no active config and no baseUrl: Return error `NO_CONFIG`

**Implementation Location**: `/main/ipc/handlers/llm-config.ts`

**Test Scenario**:
```typescript
// Should get models from active config
const result = await window.electronAPI.invoke('llm:getAvailableModels', {})
assert(result.success === true)
assert(result.source === 'active_config')

// Should get models from specified URL
const result = await window.electronAPI.invoke('llm:getAvailableModels', {
  baseUrl: 'http://localhost:11434'
})
assert(result.success === true)
assert(result.source === 'specified_url')
```

---

## 5. Delete Ollama Configuration

### Handler: `llm:deleteOllamaConfig`

**Purpose**: Soft-delete an Ollama configuration (set `deleted: true`).

**Request**:
```typescript
{
  configHash: string           // Hash of LLM object to delete
}
```

**Response Success**:
```typescript
{
  success: true
  deletedHash: string
}
```

**Response Error**:
```typescript
{
  success: false
  error: string
  errorCode: 'NOT_FOUND' | 'STORAGE_ERROR'
}
```

**Behavior**:
- Sets `deleted: true` on LLM object (soft delete)
- If deleting active config, deactivates it first
- Does not remove Person object (AI contact remains)

**Implementation Location**: `/main/ipc/handlers/llm-config.ts`

**Test Scenario**:
```typescript
// Should soft-delete config
const result = await window.electronAPI.invoke('llm:deleteOllamaConfig', {
  configHash: 'abc123...'
})
assert(result.success === true)

// Verify deletion
const check = await window.electronAPI.invoke('llm:getOllamaConfig', {
  includeInactive: true
})
const deleted = check.config?.deleted
assert(deleted === true)
```

---

## Contract Test Requirements

### Integration Tests (TDD - Write First)
Each handler must have integration tests that:

1. **Test Success Path**
   - Valid inputs produce expected outputs
   - Data persists to ONE.core storage
   - Retrieved data matches stored data

2. **Test Error Paths**
   - Invalid inputs produce correct error codes
   - Network failures handled gracefully
   - Storage errors propagate correctly

3. **Test Security**
   - Auth tokens are encrypted before storage
   - Decrypted tokens never appear in responses
   - HTTPS endpoints validated correctly

4. **Test Edge Cases**
   - Empty model lists
   - Malformed URLs
   - Timeout scenarios
   - Concurrent requests

### Test File Location
`/tests/integration/ipc-llm-config.test.ts`

### Test Pattern (RED-GREEN-Refactor)
```typescript
describe('llm:testOllamaConnection', () => {
  it('should validate and list models from local Ollama', async () => {
    // RED: Write failing test first
    const result = await ipcInvoke('llm:testOllamaConnection', {
      baseUrl: 'http://localhost:11434'
    })

    expect(result.success).toBe(true)
    expect(result.models).toBeArrayOfSize(greaterThan(0))
  })

  it('should return INVALID_URL for malformed URL', async () => {
    const result = await ipcInvoke('llm:testOllamaConnection', {
      baseUrl: 'not-a-url'
    })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('INVALID_URL')
  })
})
```

---

## Type Definitions

**Location**: `/main/types/llm-config.ts`

```typescript
export type ModelType = 'local' | 'remote'
export type AuthType = 'none' | 'bearer'

export interface OllamaConfig {
  modelType: ModelType
  baseUrl?: string
  authType?: AuthType
  authToken?: string
  modelName: string
  setAsActive: boolean
}

export interface OllamaModel {
  name: string
  size: number
  modified: string
  digest: string
}

export interface TestConnectionRequest {
  baseUrl: string
  authToken?: string
}

export interface TestConnectionResponse {
  success: boolean
  models?: OllamaModel[]
  error?: string
  errorCode?: 'INVALID_URL' | 'NETWORK_ERROR' | 'AUTH_FAILED' | 'NO_MODELS'
}

// ... (other types)
```

---

## Summary

**Total Handlers**: 5
- `llm:testOllamaConnection` - Validate server & fetch models
- `llm:setOllamaConfig` - Save configuration
- `llm:getOllamaConfig` - Retrieve configuration
- `llm:getAvailableModels` - List models from server
- `llm:deleteOllamaConfig` - Remove configuration

**Test Coverage Required**:
- ✅ Contract tests for request/response schemas
- ✅ Integration tests with real ONE.core storage
- ✅ Error handling for all error codes
- ✅ Security validation (encryption, no token leakage)

**Constitutional Compliance**:
- ✅ All handlers in Node.js main process
- ✅ Browser calls via IPC only
- ✅ Fail-fast error handling (no retries)
- ✅ Clear error messages for user action
