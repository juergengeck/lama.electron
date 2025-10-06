# Implementation Plan: Structured XML-Based LLM Communication

**Branch**: `018-we-must-create` | **Date**: 2025-10-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/gecko/src/lama.electron/specs/018-we-must-create/spec.md`

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
Implement structured XML-based communication protocol between LAMA and LLMs. System must format queries with metadata, teach LLMs the XML response format via system prompts, parse responses to extract both human-readable text and structured analysis data (keywords, subjects, summaries), and store XML messages as attachments while keeping UI presentation natural. Real-time extraction during chat with no legacy migration.

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
**Performance Goals**: <100ms parsing overhead per message, <1MB average XML attachment size
**Constraints**:
- Real-time processing (no async delays)
- Must fail fast on XML parsing errors
- NO browser-side ONE.core access
**Scale/Scope**: Hundreds of conversations, thousands of messages per conversation

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (Electron app with main/renderer separation) ✅
- Using framework directly? YES - Direct ONE.core, no wrappers ✅
- Single data model? YES - XML stored as attachment, parsed data as ONE objects ✅
- Avoiding patterns? YES - No Repository pattern, direct storage access ✅

**Architecture**:
- EVERY feature as library? N/A - Electron app architecture ✅
- Libraries listed:
  - `main/services/llm-manager.ts` (XML formatting & parsing)
  - `main/services/attachment-service.ts` (XML storage)
  - `main/core/one-ai/` (structured data models)
- CLI per library: N/A - Electron app
- Library docs: N/A

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES - Write failing tests first ✅
- Git commits show tests before implementation? YES ✅
- Order: Contract→Integration→E2E→Unit strictly followed? YES ✅
- Real dependencies used? YES - Real ONE.core, real file system ✅
- Integration tests for: XML parsing, attachment storage, IPC handlers ✅
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
- Fail fast, no fallbacks? YES - XML parse errors throw ✅

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
│   └── xml-schema.md    # XML format contract
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (existing Electron structure)
```
main/                           # Node.js main process
├── services/
│   ├── llm-manager.ts         # MODIFY: Add XML formatting/parsing
│   └── attachment-service.ts  # USE: Store XML as attachments
├── core/
│   ├── one-ai/
│   │   └── recipes/           # NEW: XML attachment recipe
│   └── ai-assistant-model.ts  # MODIFY: Use XML protocol
└── ipc/handlers/
    └── llm.ts                 # MODIFY: Handle XML in IPC

electron-ui/                   # Browser renderer process
└── src/
    └── components/           # NO CHANGES - UI stays the same

tests/
├── integration/
│   ├── xml-parsing.test.ts   # NEW
│   └── xml-attachment.test.ts # NEW
└── contract/
    └── xml-schema.test.ts    # NEW
```

**Structure Decision**: Existing Electron app structure (main + renderer separation per LAMA constitution)

## Phase 0: Outline & Research
**Status**: ✅ Complete

### Research Tasks
1. **XML Schema Design**:
   - Research: Best practices for LLM-friendly XML formats
   - Decision needed: Tag naming conventions, nesting depth limits
   - Alternatives: JSON (rejected - harder for LLMs to generate), YAML (rejected - whitespace issues)

2. **Attachment Storage Patterns**:
   - Research: ONE.core BLOB storage best practices
   - Decision needed: Inline vs external BLOB storage
   - Size limits and compression strategies

3. **System Prompt Engineering**:
   - Research: Effective LLM system prompt patterns for structured output
   - Decision needed: One-shot vs few-shot examples in prompt
   - Prompt token budget allocation

4. **XML Parsing Libraries**:
   - Research: fast-xml-parser vs xml2js vs native DOMParser
   - Requirements: Speed, error recovery, TypeScript support
   - Benchmark: Parsing 10KB XML in <10ms

**Output**: research.md with all decisions and rationales

## Phase 1: Design & Contracts
**Status**: ✅ Complete

### Data Model (data-model.md)
From spec entities:
1. **XML Message Attachment**
   - Fields: topicId, messageId, xmlContent, format, version
   - Storage: ONE.core BLOB attachment
   - Validation: Well-formed XML, schema compliance

2. **Parsed Analysis Metadata**
   - Existing: Keyword, Subject, Summary (from one-ai package)
   - Enhancement: Link to source XML attachment
   - New field: sourceXmlHash (reference to attachment)

3. **System Prompt Template**
   - Fields: modelId, promptText, xmlSchema, version
   - Storage: ONE.core versioned object
   - Lifecycle: Per-model configuration

### Contracts (contracts/)
1. **XML Query Format Contract** (xml-schema.md):
   ```xml
   <llm_query>
     <user_message>[natural language]</user_message>
     <context>
       <previous_subjects>[...]</previous_subjects>
       <active_keywords>[...]</active_keywords>
     </context>
   </llm_query>
   ```

2. **XML Response Format Contract**:
   ```xml
   <llm_response>
     <response>[human-readable text]</response>
     <analysis>
       <subjects>
         <subject name="..." keywords="..." isNew="true|false" />
       </subjects>
       <keywords>
         <keyword term="..." confidence="0.0-1.0" />
       </keywords>
       <summary_update>[incremental summary]</summary_update>
     </analysis>
   </llm_response>
   ```

3. **IPC Contract** (existing pattern):
   - Request: `llm:chat` with message + topicId
   - Response: {text, xmlAttachmentId, analysis}
   - Error: XML parse failure returns text-only fallback

### Integration Test Scenarios
From user stories:
1. **Scenario**: User sends message → XML query generated
   - Assert: Query contains user message + context
   - Assert: Well-formed XML

2. **Scenario**: LLM returns XML → Parsed correctly
   - Assert: Human text extracted
   - Assert: Keywords, subjects extracted
   - Assert: XML stored as attachment

3. **Scenario**: XML parse fails → Graceful degradation
   - Assert: User sees response text
   - Assert: Error logged
   - Assert: No analysis data created

### Agent Context Update
- Update `/Users/gecko/src/lama.electron/CLAUDE.md` with:
  - XML communication protocol summary
  - New recipes: XMLAttachment
  - Modified services: llm-manager, ai-assistant-model

**Output**: data-model.md, contracts/xml-schema.md, failing tests, quickstart.md, CLAUDE.md updated

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. Load contracts/xml-schema.md → Generate schema validation tests
2. From data-model.md → Generate recipe creation tasks
3. From user stories → Generate integration test tasks
4. Implementation tasks to make tests pass

**Task Categories**:
- **Contract Tests** [P]: XML schema validation (query, response)
- **Model Tasks** [P]: XMLAttachment recipe, SystemPromptTemplate
- **Service Tasks**: LLMManager.formatQueryAsXML(), LLMManager.parseXMLResponse()
- **Storage Tasks**: AttachmentService integration
- **Integration Tests**: End-to-end XML workflow
- **IPC Tasks**: Update llm:chat handler

**Ordering Strategy**:
1. Contract tests (fail) [P]
2. XML schema definition [P]
3. Recipe definitions [P]
4. LLM Manager modifications (formatQuery, parseResponse)
5. Attachment storage integration
6. AI Assistant Model updates
7. IPC handler updates
8. Integration tests (pass)

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
