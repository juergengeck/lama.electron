# Implementation Plan: Structured JSON-Based LLM Communication (Ollama Native)

**Branch**: `018-we-must-create` | **Date**: 2025-10-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/gecko/src/lama.electron/specs/018-we-must-create/spec.md`
**Updated**: 2025-10-06 - Using Ollama's native structured outputs instead of prompt-engineered XML

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✅
2. Fill Technical Context ✅
3. Evaluate Constitution Check section ✅
4. Execute Phase 0 → research.md ✅
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md ✅
6. Re-evaluate Constitution Check section ✅
7. Plan Phase 2 → Describe task generation approach ✅
8. STOP - Ready for /tasks command ✅
```

## Summary
Implement structured JSON-based communication protocol between LAMA and LLMs using Ollama's native `format` parameter. System defines JSON schemas for responses, Ollama enforces structure at LLM level (no prompt engineering needed), parse guaranteed-valid JSON to extract human-readable text and structured analysis data (keywords, subjects, summaries), store directly as ONE.core objects using existing recipes. Real-time extraction during chat with no legacy migration.

**Key Change from Original Plan**: Leverage Ollama's structured outputs feature (https://ollama.com/blog/structured-outputs) to guarantee valid structure instead of relying on system prompt engineering. This eliminates malformed response handling, reduces parsing errors, and simplifies implementation. Store directly as ONE.core objects - no XML conversion needed.

## Technical Context
**Language/Version**: TypeScript 5.x, Node.js 20+, React 18
**Primary Dependencies**:
- `@refinio/one.core` (data storage)
- `@refinio/one.models` (models)
- Electron (IPC, process separation)
- Existing LLMManager, AttachmentService
**Storage**: ONE.core versioned objects + BLOB attachments
**Testing**: Jest for unit, integration tests with real ONE.core instance
**Target Platform**: Electron (macOS, Linux, Windows)
**Project Type**: Electron app (main process + renderer process)
**Performance Goals**: <5ms JSON parsing overhead per message
**Constraints**:
- Real-time processing (no async delays)
- Must fail fast on JSON parsing errors (but Ollama guarantees structure)
- NO browser-side ONE.core access
**Scale/Scope**: Hundreds of conversations, thousands of messages per conversation

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (Electron app with main/renderer separation) ✅
- Using framework directly? YES - Direct ONE.core, no wrappers ✅
- Single data model? YES - JSON parsed, stored as ONE.core objects using existing recipes ✅
- Avoiding patterns? YES - No Repository pattern, direct storage access ✅

**Architecture**:
- EVERY feature as library? N/A - Electron app architecture ✅
- Libraries listed:
  - `main/services/llm-manager.ts` (JSON parsing from Ollama)
  - `main/schemas/llm-response.schema.ts` (Ollama format schema)
  - `main/core/one-ai/` (structured data models)
- CLI per library: N/A - Electron app
- Library docs: N/A

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES - Write failing tests first ✅
- Git commits show tests before implementation? YES ✅
- Order: Contract→Integration→E2E→Unit strictly followed? YES ✅
- Real dependencies used? YES - Real ONE.core, real file system ✅
- Integration tests for: JSON parsing, ONE.core storage, IPC handlers ✅
- FORBIDDEN: Implementation before test, skipping RED phase ✅

**Observability**:
- Structured logging included? YES - Existing console.log with tags ✅
- Frontend logs → backend? YES - via IPC ✅
- Error context sufficient? YES - Stack traces + context ✅

**Versioning**:
- Version number assigned? YES - 1.0.0 (new feature) ✅
- BUILD increments on every change? YES ✅
- Breaking changes handled? NO breaking changes (additive only) ✅

**LAMA-Specific (from constitution.md)**:
- Single ONE.core in Node.js ONLY? YES ✅
- Browser is UI ONLY? YES - NO ONE.core imports ✅
- ALL data operations via IPC? YES ✅
- Fail fast, no fallbacks? YES - JSON parse errors throw (but Ollama guarantees structure) ✅

## Project Structure

### Documentation (this feature)
```
specs/018-we-must-create/
├── spec.md              # Feature specification (input)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   └── json-schema.md   # JSON schema contract for Ollama
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (existing Electron structure)
```
main/                           # Node.js main process
├── schemas/
│   └── llm-response.schema.ts # NEW: JSON schema for Ollama format parameter
├── services/
│   ├── llm-manager.ts         # MODIFY: Add Ollama structured output support
│   └── ollama.ts              # MODIFY: Pass format parameter to Ollama
├── core/
│   ├── one-ai/
│   │   ├── models/            # USE: Existing Subject, Keyword, Summary recipes
│   │   └── services/          # USE: Existing TopicAnalyzer
│   └── ai-assistant-model.ts  # MODIFY: Parse JSON, create ONE.core objects
└── ipc/handlers/
    └── llm.ts                 # MODIFY: Return parsed analysis data

electron-ui/                   # Browser renderer process
└── src/
    └── components/           # NO CHANGES - UI stays the same

tests/
├── integration/
│   ├── json-parsing.test.ts  # NEW
│   └── one-core-storage.test.ts # NEW
└── contract/
    └── json-schema.test.ts   # NEW
```

**Structure Decision**: Existing Electron app structure (main + renderer separation per LAMA constitution)

## Phase 0: Outline & Research
**Status**: ✅ Complete

### Research Tasks
1. **Ollama Structured Outputs**:
   - Research: Ollama's native `format` parameter for JSON schema enforcement
   - Decision: Use Ollama structured outputs (guarantees valid JSON)
   - Alternatives: Prompt engineering (rejected - error-prone), XML (rejected - unnecessary conversion)

2. **JSON Schema Design**:
   - Research: JSON Schema v7 best practices for LLM responses
   - Decision: Define schema for response + analysis structure
   - Constraints: Required fields, type validation, string patterns

3. **ONE.core Native Storage**:
   - Research: Using existing Keyword/Subject/Summary recipes
   - Decision: No new recipes needed - use ONE.core references for traceability
   - References: Link extracted objects to source Message

4. **System Prompt Simplification**:
   - Research: Minimal prompts when schema enforces structure
   - Decision: ~100 token prompt (vs 400+ for XML teaching)
   - Focus: Intent description only, not format instructions

**Output**: research.md with all decisions and rationales

## Phase 1: Design & Contracts
**Status**: ✅ Complete

### Data Model (data-model.md)
From spec entities:
1. **Message** (existing)
   - No changes needed - serves as traceability anchor
   - Extracted objects link back to Message via ONE.core references

2. **Keyword/Subject/Summary** (existing)
   - Use existing recipes as-is
   - Link to source Message via ONE.core reference system
   - No new fields or recipe changes needed

3. **JSON Schema**
   - Define schema for Ollama `format` parameter
   - Location: `/main/schemas/llm-response.schema.ts`
   - Enforces: response + analysis structure with types/constraints

### Contracts (contracts/)
1. **JSON Response Format Contract** (json-schema.md):
   ```json
   {
     "response": "Natural language response",
     "analysis": {
       "subjects": [
         {
           "name": "subject-name",
           "description": "Brief explanation",
           "isNew": true,
           "keywords": [{"term": "keyword", "confidence": 0.8}]
         }
       ],
       "summaryUpdate": "Brief summary of exchange"
     }
   }
   ```

2. **IPC Contract** (existing pattern):
   - Request: `llm:chat` with message + topicId
   - Response: {text, analysis} with parsed JSON data
   - Error: JSON parse errors throw (but Ollama guarantees structure)

### Integration Test Scenarios
From user stories:
1. **Scenario**: User sends message → Ollama returns structured JSON
   - Assert: JSON matches schema (Ollama guarantees)
   - Assert: Response text present

2. **Scenario**: JSON parsed → ONE.core objects created
   - Assert: Keywords created from analysis.subjects[].keywords
   - Assert: Subjects created from analysis.subjects[]
   - Assert: Summary updated from analysis.summaryUpdate

3. **Scenario**: Objects linked to source Message
   - Assert: ONE.core references established
   - Assert: Can trace Keyword/Subject back to creating Message

### Agent Context Update
- Update `/Users/gecko/src/lama.electron/CLAUDE.md` with:
  - Ollama structured output integration summary
  - JSON schema location
  - Modified services: llm-manager, ollama, ai-assistant-model

**Output**: data-model.md, contracts/json-schema.md, failing tests, quickstart.md, CLAUDE.md updated

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. Load contracts/json-schema.md → Generate schema validation tests
2. From data-model.md → Generate integration test tasks
3. From user stories → Generate end-to-end tests
4. Implementation tasks to make tests pass

**Task Categories**:
- **Contract Tests** [P]: JSON schema validation (Ollama response)
- **Schema Tasks** [P]: Define llm-response.schema.ts with Ollama format
- **Service Tasks**: ollama.ts (add format parameter), llm-manager.ts (parse JSON)
- **Integration Tasks**: ai-assistant-model.ts (create ONE.core objects from JSON)
- **Integration Tests**: End-to-end Ollama → JSON → ONE.core workflow
- **IPC Tasks**: Update llm:chat handler to return parsed analysis

**Ordering Strategy**:
1. Contract tests (fail) [P]
2. JSON schema definition [P]
3. ollama.ts modifications (format parameter support)
4. llm-manager.ts modifications (JSON parsing)
5. ai-assistant-model.ts updates (create ONE.core objects)
6. IPC handler updates
7. Integration tests (pass)

**Estimated Output**: 20-25 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (TDD cycle, tests first)
**Phase 5**: Validation (run tests, verify quickstart.md, check performance)

## Complexity Tracking
*No constitutional violations - using existing Electron architecture with additive changes only*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None      | -          | -                                   |

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---
*Based on Constitution v1.0.0 - See `/Users/gecko/src/lama.electron/spec/memory/constitution.md`*
*LAMA-specific architecture enforced - Single ONE.core, IPC-first, fail-fast*
