# Feature Specification: Structured XML-Based LLM Communication

**Feature Branch**: `018-we-must-create`
**Created**: 2025-10-06
**Status**: Approved
**Input**: User description: "we must create structured, xml based translations of our llm queries, and use the same format for llm response formatting. we must use the llm system prompt to teach the llm about our format, and we must store structured data in addition to human readable parts"

## Execution Flow (main)
```
1. Parse user description from Input
   → Extracted: Need for structured XML format for LLM communication
2. Extract key concepts from description
   → Actors: Users, LLM, System
   → Actions: Query formatting, response parsing, data storage
   → Data: Structured XML, human-readable text, stored analysis
   → Constraints: Must preserve both structured and human-readable content
3. For each unclear aspect:
   → [NEEDS CLARIFICATION: Which types of LLM interactions should use XML format?]
   → [NEEDS CLARIFICATION: What data retention policy for structured vs human-readable content?]
   → [NEEDS CLARIFICATION: Should existing chat history be migrated to new format?]
4. Fill User Scenarios & Testing section
   → Primary flow: User sends message, receives structured response
5. Generate Functional Requirements
   → XML schema for queries and responses
   → System prompt configuration
   → Dual storage strategy
6. Identify Key Entities
   → LLM Query, LLM Response, Analysis Data
7. Run Review Checklist
   → All requirements clarified and validated
8. Return: SUCCESS (spec approved and ready for implementation planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
When a user interacts with LAMA's AI assistant, the system needs to communicate with LLMs using a structured format that allows both natural conversation and automated extraction of semantic information. Users should continue to see natural, human-readable responses while the system automatically captures structured metadata (keywords, subjects, confidence scores) for analysis and context enrichment.

### Acceptance Scenarios
1. **Given** a user sends a message to an AI assistant, **When** the system formulates the LLM query, **Then** it MUST include both the user's natural language message and structured metadata in XML format
2. **Given** the LLM generates a response, **When** the system receives it, **Then** it MUST parse both the human-readable message and structured analysis data (subjects, keywords, summary updates)
3. **Given** structured data is extracted from an LLM response, **When** the system stores the conversation, **Then** it MUST persist the XML-formatted message as an attachment
4. **Given** an XML message is stored as an attachment, **When** the system processes it, **Then** it MUST extract and store both the display text for users and the structured metadata for analysis
5. **Given** the system configures an LLM connection, **When** it establishes the session, **Then** it MUST provide a system prompt that teaches the LLM the expected XML format
6. **Given** a user views conversation history, **When** they read past messages, **Then** they MUST see natural, readable text without XML formatting exposed

### Edge Cases
- What happens when the LLM returns malformed XML or omits required structured elements?
- How does the system handle LLMs that don't support the structured format?
- What happens when XML attachment storage fails or becomes corrupted?
- What happens when stored structured data becomes corrupted or incomplete?
- How does the system gracefully degrade if XML parsing fails while preserving user experience?
- What happens when the system prompt exceeds LLM context window limits?
- How does the system handle attachment size limits for large XML-formatted messages?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST format all LLM queries using a structured XML schema that preserves user intent while adding metadata
- **FR-002**: System MUST configure LLM sessions with a system prompt that defines the expected XML response format
- **FR-003**: System MUST parse LLM responses to extract both human-readable content and structured analysis data
- **FR-004**: System MUST store XML-formatted messages as attachments to preserve complete structured data
- **FR-005**: System MUST store extracted structured data (subjects, keywords, confidence scores) separately from human-readable message text
- **FR-006**: System MUST preserve the association between structured metadata, XML attachments, and corresponding message content
- **FR-007**: System MUST present only human-readable text to users, hiding XML formatting from the UI
- **FR-008**: System MUST validate XML structure in LLM responses and handle parsing errors gracefully
- **FR-009**: System MUST NOT maintain backward compatibility - legacy non-XML conversations remain as-is without migration
- **FR-010**: System MUST extract and store structured data including keywords, subjects, and response content, with optional extraction of additional relevant metadata
- **FR-011**: System MUST process structured data extraction in real-time during chat conversations

### Key Entities *(include if feature involves data)*
- **LLM Query**: Structured request containing user message, context metadata, and formatting instructions in XML
- **LLM Response**: Structured reply containing human-readable text and analysis metadata (subjects, keywords, summaries) in XML
- **XML Message Attachment**: Complete XML-formatted message stored as attachment, preserving full structured data
- **Analysis Metadata**: Extracted structured data including subjects (topic themes), keywords (key concepts), confidence scores, and summary updates
- **System Prompt Template**: Configuration that teaches the LLM the expected XML format for responses
- **Conversation Context**: Historical messages and accumulated structured metadata used for context enrichment

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

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

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---

## Stakeholder Decisions (Resolved)

1. **Migration Strategy**: ✅ **No legacy support** - Existing conversations remain as-is without migration. Only new conversations use XML format.

2. **Structured Data Scope**: ✅ **Core extraction** - Keywords, subjects, and response content are mandatory. Additional metadata (sentiment, entities, intent) extracted opportunistically when relevant.

3. **Processing Model**: ✅ **Real-time processing** - Structured data extraction happens during chat conversations with immediate analysis.

4. **Fallback Behavior**: ✅ **Require XML-capable models** - Structured analysis features require LLMs that support XML formatting.
