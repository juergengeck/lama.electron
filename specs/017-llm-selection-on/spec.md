# Feature Specification: Ollama Network Service Support

**Feature Branch**: `017-llm-selection-on`
**Created**: 2025-10-03
**Status**: Draft
**Input**: User description: "llm selection on first start and in settings must offer use of ollama as a service with network server address"

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature requires network-based Ollama support
2. Extract key concepts from description
   → Actors: Users configuring LLM providers
   → Actions: Select Ollama, specify network address
   → Data: Network server address/URL
   → Constraints: Must work on first start AND in settings
3. For each unclear aspect:
   → Validation: Before saving configuration
   → Authentication: Yes, support required
   → Default address: Pre-fill local interface (localhost:11434)
4. Fill User Scenarios & Testing section
   → Clear user flow identified
5. Generate Functional Requirements
   → All requirements are testable
6. Identify Key Entities (if data involved)
   → LLM Provider Configuration with network address field
7. Run Review Checklist
   → WARN "Spec has uncertainties" - see clarification markers
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing

### Primary User Story
Users want to use Ollama running on a remote server or custom network location instead of only using local Ollama installations. This enables:
- Using a shared team Ollama server
- Accessing more powerful hardware remotely
- Testing against different Ollama configurations
- Running LAMA on machines without local Ollama

### Acceptance Scenarios

**First-Time Setup**
1. **Given** a new LAMA installation without saved LLM configuration, **When** user completes first-time setup wizard, **Then** user can select "Ollama (Network Service)" and specify server address
2. **Given** user selects Ollama network service option, **When** user enters a valid network address (e.g., "http://192.168.1.100:11434"), **Then** system accepts and saves the configuration
3. **Given** user selects Ollama network service, **When** user provides network address, **Then** system verifies available models from that server

**Settings Configuration**
4. **Given** LAMA is already configured with any LLM provider, **When** user opens LLM settings, **Then** user can switch to Ollama network service and specify server address
5. **Given** user is editing Ollama network configuration in settings, **When** user changes the server address, **Then** system re-validates connection and updates available models list

**Using Network Ollama**
6. **Given** Ollama network service is configured with valid server address, **When** user initiates AI conversation, **Then** system connects to specified Ollama server for model inference
7. **Given** Ollama network service was previously working, **When** remote server becomes unreachable, **Then** user receives clear error message about network connectivity

### Edge Cases

**Network Address Validation**
- What happens when user enters invalid URL format (e.g., missing protocol, invalid port)?
- How does system handle addresses with/without trailing slashes?
- Should system support HTTPS Ollama servers?

**Connectivity Issues**
- What happens when specified server is unreachable during initial configuration?
- How does system behave if network connection drops during active conversation?
- Should system cache last-known-good configuration?

**Model Availability**
- What happens if remote Ollama server has no models installed?
- How does system handle if previously used model is removed from remote server?
- Should system display which models are available on which server?

**Authentication**
- What authentication methods should be supported - API key, basic auth, bearer token?
- How should credentials be stored securely?
- Should system remember credentials across sessions?

## Requirements

### Functional Requirements

**Configuration Interface**
- **FR-001**: System MUST offer "Ollama (Network Service)" as an LLM provider option during first-time setup wizard
- **FR-002**: System MUST offer "Ollama (Network Service)" as an LLM provider option in settings/preferences
- **FR-003**: System MUST provide input field for users to specify network server address when Ollama network service is selected
- **FR-004**: System MUST accept network addresses in URL format (protocol, hostname/IP, port)
- **FR-005**: System MUST distinguish between local Ollama installation and network-based Ollama service

**Validation & Connectivity**
- **FR-006**: System MUST validate network address format before saving configuration
- **FR-007**: System MUST test connectivity to Ollama server before accepting configuration
- **FR-008**: System MUST retrieve and display available models from specified Ollama network server
- **FR-009**: System MUST provide clear error messages when network Ollama server is unreachable

**Runtime Behavior**
- **FR-010**: System MUST use specified network address when making requests to Ollama API
- **FR-011**: System MUST handle network failures gracefully without crashing application
- **FR-012**: System MUST persist network Ollama configuration across application restarts

**User Experience**
- **FR-013**: System MUST clearly label the difference between local and network Ollama options
- **FR-014**: System MUST pre-fill network address field with "http://localhost:11434" as default value
- **FR-015**: System MUST allow users to test connection to network Ollama server before saving configuration

**Authentication & Security**
- **FR-016**: System MUST support authentication for remote Ollama servers
- **FR-017**: System MUST provide fields for authentication credentials when required by remote server
- **FR-018**: System MUST store authentication credentials securely

### Key Entities

- **LLM Provider Configuration**: Represents user's choice of AI service, including:
  - Provider type (OpenAI, Anthropic, Ollama Local, Ollama Network, etc.)
  - Connection details specific to provider type
  - For Ollama Network: server address/URL
  - Selected model from provider's available models

- **Network Address**: URL/endpoint for remote Ollama service, including:
  - Protocol (http/https)
  - Hostname or IP address
  - Port number
  - Optional: authentication credentials (when server requires authentication)

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

**Clarifications Resolved:**
1. ✅ Validate network connectivity and address format before saving configuration
2. ✅ Support authentication for remote Ollama servers
3. ✅ Pre-fill default address with http://localhost:11434
4. ✅ Validation occurs at same step as connectivity test (before saving)

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked and resolved
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---
