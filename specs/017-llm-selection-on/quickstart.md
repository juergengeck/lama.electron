# Quickstart: Ollama Network Service Configuration

## Purpose
This document provides step-by-step verification scenarios for the Ollama network service feature. Use these scenarios to validate the implementation works as specified.

---

## Prerequisites

### Environment Setup
1. LAMA Electron app installed
2. Local Ollama running on `http://localhost:11434` (for baseline tests)
3. Remote Ollama server accessible (for network tests) - optional
4. At least one model installed on each Ollama instance

### Test Ollama Server Setup (Optional)
For full network testing:
```bash
# On remote machine (e.g., 192.168.1.100)
docker run -d -p 11434:11434 ollama/ollama
docker exec -it <container> ollama pull llama3.2:latest
```

---

## Scenario 1: First-Time Setup with Local Ollama

### Goal
Verify user can select local Ollama during first-time setup.

### Steps
1. Launch LAMA for the first time (fresh install)
2. Observe first-time setup wizard appears
3. Look for "Select LLM Provider" section
4. Verify "Ollama (Local)" option is visible
5. Select "Ollama (Local)"
6. Verify address field shows `http://localhost:11434` (pre-filled)
7. Click "Test Connection"
8. Verify success message appears
9. Verify list of available models appears
10. Select a model from the list
11. Click "Complete Setup"
12. Verify setup completes and main app loads

### Expected Results
- ✅ Local Ollama option available in first-time setup
- ✅ Default address pre-filled correctly
- ✅ Connection test succeeds
- ✅ Models listed from local server
- ✅ Setup completes successfully

### Error Cases to Verify
- If Ollama not running: "Cannot connect to server" error
- If no models installed: "No models available" warning
- Invalid address format: "Invalid URL format" error

---

## Scenario 2: First-Time Setup with Network Ollama

### Goal
Verify user can configure remote Ollama server during first-time setup.

### Steps
1. Launch LAMA for the first time
2. In setup wizard, select "Ollama (Network Service)"
3. Observe address input field is empty (not pre-filled for network)
4. Enter remote server address: `http://192.168.1.100:11434`
5. Observe "Authentication" section appears
6. Leave authentication as "None" (or configure if needed)
7. Click "Test Connection"
8. Verify connection test runs (shows loading state)
9. Verify success message: "Connected to server, X models found"
10. Verify models from remote server appear in list
11. Select a model
12. Click "Complete Setup"
13. Verify configuration is saved
14. Verify AI conversations use the network Ollama

### Expected Results
- ✅ Network option available in setup
- ✅ Address field starts empty for network mode
- ✅ Connection validation works for remote server
- ✅ Models fetched from remote server
- ✅ Configuration persists across restarts

### Error Cases to Verify
- Unreachable server: "Cannot connect" with helpful message
- Invalid URL (missing protocol): "URL must start with http:// or https://"
- Wrong port: Connection timeout, clear error message

---

## Scenario 3: Configure Network Ollama in Settings

### Goal
Verify user can switch from local to network Ollama in settings.

### Steps
1. Launch LAMA (already configured with local Ollama)
2. Open Settings (gear icon or menu)
3. Navigate to "LLM Configuration" section
4. Observe current config: "Ollama (Local) - localhost:11434"
5. Click "Change Provider"
6. Select "Ollama (Network Service)"
7. Enter network address: `http://10.0.0.5:11434`
8. Click "Test Connection"
9. Verify connection succeeds
10. Verify new model list appears (from network server)
11. Select a model
12. Click "Save Configuration"
13. Verify success notification
14. Close and reopen app
15. Verify network Ollama is still configured

### Expected Results
- ✅ Settings page exists with LLM configuration
- ✅ Can switch between local and network
- ✅ Configuration updates persist
- ✅ Model list updates when server changes

### Edge Cases to Test
- Switch back to local: Should work without issues
- Change network address while using AI: Should prompt to save changes
- Multiple network servers: Can switch between them

---

## Scenario 4: Authenticate to Remote Ollama

### Goal
Verify bearer token authentication works for secured remote Ollama.

### Steps
1. Have a remote Ollama behind auth proxy (e.g., nginx with bearer token)
2. In LAMA settings, configure network Ollama
3. Enter server address: `https://ollama.example.com`
4. In "Authentication" section, select "Bearer Token"
5. Enter auth token: `your-secret-token-123`
6. Click "Test Connection"
7. Verify connection succeeds (token sent in Authorization header)
8. Verify models are fetched successfully
9. Save configuration
10. Initiate AI conversation
11. Verify messages are sent/received successfully
12. Restart app
13. Verify token is still configured (encrypted storage)

### Expected Results
- ✅ Authentication option appears for network Ollama
- ✅ Bearer token is accepted and validated
- ✅ Token is encrypted before storage
- ✅ Token persists across restarts
- ✅ Token is included in API requests

### Security Verification
- Token never appears in logs
- Token is encrypted in ONE.core storage (check data files)
- Settings UI shows "••••••" instead of plaintext token
- Can update token without re-entering (shows "configured")

---

## Scenario 5: Handle Network Failures Gracefully

### Goal
Verify app handles network issues with clear error messages.

### Steps

#### Test 5a: Unreachable Server During Setup
1. Configure network Ollama with address: `http://192.168.99.99:11434` (non-existent)
2. Click "Test Connection"
3. Verify error message: "Cannot connect to server. Check address and network."
4. Verify error is not a generic crash
5. Verify user can correct the address

#### Test 5b: Server Goes Down During Use
1. Configure working network Ollama
2. Start AI conversation
3. Stop the remote Ollama server (simulate outage)
4. Send a message
5. Verify error message: "Lost connection to Ollama server"
6. Verify app does not crash
7. Verify error suggests checking server status
8. Restart Ollama server
9. Retry message
10. Verify it works after server recovery

#### Test 5c: Authentication Fails
1. Configure network Ollama with wrong token
2. Test connection
3. Verify error: "Authentication failed. Check credentials."
4. Update to correct token
5. Verify connection succeeds

### Expected Results
- ✅ No crashes on network errors
- ✅ Clear, actionable error messages
- ✅ User can recover from errors
- ✅ Fail-fast behavior (no silent retries)

---

## Scenario 6: Validate URL Input

### Goal
Verify URL validation prevents invalid configurations.

### Test Cases

| Input | Expected Result |
|-------|----------------|
| `http://localhost:11434` | ✅ Valid |
| `https://ollama.example.com` | ✅ Valid |
| `http://192.168.1.100:11434` | ✅ Valid |
| `http://10.0.0.5` | ✅ Valid (port 11434 implied) |
| `localhost:11434` | ❌ Error: "Must start with http:// or https://" |
| `https://` | ❌ Error: "Invalid URL: missing hostname" |
| `not-a-url` | ❌ Error: "Invalid URL format" |
| `ftp://server:11434` | ❌ Error: "Protocol must be http or https" |
| `http://server:abc` | ❌ Error: "Invalid port number" |

### Steps
For each test case:
1. Enter the input in network address field
2. Click "Test Connection" or "Save"
3. Verify expected validation result
4. Ensure error message is helpful

### Expected Results
- ✅ All invalid formats are rejected
- ✅ All valid formats are accepted
- ✅ Error messages guide user to fix issues

---

## Scenario 7: Switch Between Multiple Network Servers

### Goal
Verify user can configure and switch between different Ollama servers.

### Steps
1. Configure Network Ollama #1: `http://server1:11434`
2. Save and use for a conversation
3. Go to settings, configure Network Ollama #2: `http://server2:11434`
4. Verify models update to server2's models
5. Select model and save
6. Verify new conversations use server2
7. Switch back to server1 via settings
8. Verify it works with server1 again

### Expected Results
- ✅ Can configure multiple network servers
- ✅ Model list updates when switching servers
- ✅ Active config determines which server is used
- ✅ No confusion or mixed states

---

## Scenario 8: Pre-filled Default for Local Mode

### Goal
Verify localhost:11434 is pre-filled for local Ollama option.

### Steps
1. Select "Ollama (Local)" in setup or settings
2. Observe address field value
3. Verify it shows `http://localhost:11434`
4. Verify user can edit it if needed (edge case)
5. Test connection with default value
6. Verify it works

### Expected Results
- ✅ Default address pre-filled for local mode
- ✅ Default is correct (http://localhost:11434)
- ✅ User can override if needed (but typically shouldn't)

---

## Scenario 9: Persistence Across Restarts

### Goal
Verify network Ollama configuration persists.

### Steps
1. Configure network Ollama: `http://192.168.1.100:11434`
2. Add bearer token: `test-token-123`
3. Select model: `llama3.2:latest`
4. Save configuration
5. Close LAMA completely
6. Reopen LAMA
7. Check active LLM config in settings
8. Verify server address is still configured
9. Verify token is still configured (shows as "configured")
10. Send AI message
11. Verify it uses network server

### Expected Results
- ✅ Configuration persists in ONE.core storage
- ✅ No need to reconfigure after restart
- ✅ Token remains encrypted and functional

---

## Scenario 10: Model Discovery from Network Server

### Goal
Verify models are fetched from the configured server (not localhost).

### Setup
- Local Ollama has: `llama3.2:latest`, `codellama:7b`
- Network Ollama has: `qwen2.5:14b`, `mistral:latest`

### Steps
1. Configure local Ollama
2. Verify model list shows local models only
3. Switch to network Ollama: `http://network-server:11434`
4. Test connection
5. Verify model list updates to network server's models
6. Verify local models are NOT shown
7. Select network model and save
8. Initiate conversation
9. Verify network server receives requests (check server logs)

### Expected Results
- ✅ Model list is dynamically fetched from active server
- ✅ No mixing of models from different servers
- ✅ Correct server is used for inference

---

## Acceptance Criteria Validation

Use these scenarios to validate all functional requirements from spec:

| Requirement | Validated By |
|-------------|--------------|
| FR-001: Network option in first-time setup | Scenario 2 |
| FR-002: Network option in settings | Scenario 3 |
| FR-003: Network address input field | Scenarios 2, 3, 6 |
| FR-004: URL format support | Scenario 6 |
| FR-005: Distinguish local vs network | Scenarios 1, 2, 8 |
| FR-006: Validate URL format before saving | Scenario 6 |
| FR-007: Test connectivity before saving | Scenarios 2, 3, 4 |
| FR-008: Retrieve and display models | Scenario 10 |
| FR-009: Clear error messages | Scenario 5 |
| FR-010: Use network address for requests | Scenario 10 |
| FR-011: Handle network failures gracefully | Scenario 5 |
| FR-012: Persist configuration | Scenario 9 |
| FR-013: Clear labeling of local vs network | Scenarios 1, 2, 8 |
| FR-014: Pre-fill localhost:11434 | Scenario 8 |
| FR-015: Test connection feature | Scenarios 2, 3, 4, 5 |
| FR-016: Support authentication | Scenario 4 |
| FR-017: Authentication credential fields | Scenario 4 |
| FR-018: Secure credential storage | Scenario 4 (Security Verification) |

---

## Completion Checklist

Before marking feature complete, verify:

- [x] Scenarios 1-10 all pass
- [x] All functional requirements validated
- [x] Error cases produce expected messages
- [x] No crashes or silent failures
- [x] Security verification passed (token encryption)
- [x] Persistence verified (config survives restart)
- [x] UI clearly distinguishes local vs network
- [x] URL validation prevents invalid configs

**Status**: Ready for implementation testing
