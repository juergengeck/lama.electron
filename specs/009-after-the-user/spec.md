# Feature Specification: Default LLM Topic Initialization

**Feature Branch**: `009-after-the-user`
**Created**: 2025-01-25
**Status**: Draft
**Input**: User description: "after the user chose a default llm, the system must create two topics if they do not exist, Hi and LAMA. These topics use hardcoded IDs 'hi' and 'lama'. Hi is an introductory conversation with the llm, with a static welcome message explaining the system and its capabilities. As Hi has a static welcome message, no automatic welcome message generation by the llm should be triggered. LAMA is a normal chat in the system and should trigger welcome message generation by the llm if empty"

## Execution Flow (main)
```
1. Parse user description from Input
   → Extracted: Default LLM selection triggers topic creation
2. Extract key concepts from description
   → Actors: User, System, Default LLM
   → Actions: Select default LLM, create topics, generate messages
   → Data: Hi topic, LAMA topic, static welcome message
   → Constraints: Topics created only if don't exist, different behaviors for each topic
3. For each unclear aspect:
   → Mark with clarification needs (see requirements)
4. Fill User Scenarios & Testing section
   → Primary flow: User selects default LLM → topics created
5. Generate Functional Requirements
   → Each requirement is testable
   → Ambiguous aspects marked
6. Identify Key Entities (topics, messages, LLM configuration)
7. Run Review Checklist
   → Some clarifications needed (marked below)
8. Return: SUCCESS (spec ready for planning after clarifications)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
A user opens the application for the first time or changes their default LLM preference. Upon selecting a default LLM, the system automatically creates two special conversation topics to help the user get started: "Hi" for an introductory conversation about the system's capabilities, and "LAMA" for private, general-purpose conversations with the selected LLM.

### Acceptance Scenarios
1. **Given** the user has not previously selected a default LLM, **When** they select a default LLM for the first time, **Then** the system creates both "Hi" and "LAMA" topics with the appropriate configurations

2. **Given** the user changes their default LLM selection, **When** the new LLM is confirmed, **Then** the system updates the participants in existing "hi" and "lama" topics to use the new LLM's AI contact

3. **Given** the "hi" topic is created, **When** the user opens this conversation, **Then** they see a static welcome message explaining the system's capabilities (not LLM-generated)

4. **Given** the "lama" topic is created empty, **When** the user opens this conversation, **Then** the LLM generates an automatic welcome message

5. **Given** topics "Hi" and "LAMA" already exist for the selected LLM, **When** the user selects the same LLM again, **Then** no duplicate topics are created and existing conversations are preserved

### Edge Cases
- What happens when the user rapidly changes between different default LLMs?
  - System should handle each change sequentially, creating topics only as needed
- How does system handle if topic creation fails?
  - [NEEDS CLARIFICATION: Should there be user notification? Retry mechanism?]
- What happens if user manually creates topics with these names before selecting a default LLM?
  - [NEEDS CLARIFICATION: Should system skip creation or rename existing topics?]

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST create two topics with hardcoded IDs "hi" and "lama" when a default LLM is selected
- **FR-002**: System MUST check if topics already exist before creating new ones
- **FR-003**: The "hi" topic MUST have the display name "Hi"
- **FR-004**: The "hi" topic MUST contain a static welcome message explaining system capabilities
- **FR-005**: The "hi" topic MUST add its static message immediately upon creation (not LLM-generated)
- **FR-006**: The "lama" topic MUST have the display name "LAMA"
- **FR-007**: The "lama" topic MUST behave as a normal chat conversation
- **FR-008**: The "lama" topic MUST receive an LLM-generated welcome message when created empty
- **FR-009**: System MUST preserve existing conversations when topics already exist
- **FR-010**: Topic creation MUST be triggered automatically upon default LLM selection
- **FR-011**: The static welcome message content MUST explain LAMA as a local, private AI assistant
- **FR-012**: System MUST handle multiple LLM selections without creating duplicate topics
- **FR-013**: The topics MUST be immediately accessible after creation
- **FR-014**: Both topics MUST update their AI participant to the newly selected LLM model when model changes
- **FR-015**: System MUST remove previous AI model from topic participants when switching models
- **FR-016**: Existing conversation history MUST be preserved when participants change

### Key Entities
- **Default LLM Configuration**: Represents the user's selected default language model, including its name and settings
- **Hi Topic**: A special introductory conversation topic with static content, hardcoded ID 'hi', linked to the default LLM
- **LAMA Topic**: A private conversation topic for general use, hardcoded ID 'lama', linked to the default LLM with standard chat behavior
- **Static Welcome Message**: Pre-defined content explaining system capabilities, displayed in the Hi topic
- **Topic Identifier**: Hardcoded identifiers ('hi' and 'lama') for the special default topics

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous (except marked items)
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

### Clarifications Resolved
1. **Error Handling**: Fail fast with clear error messages via IPC
2. **Topic IDs**: Use hardcoded 'hi' and 'lama' IDs
3. **Welcome Messages**: Only generated for empty topics (default behavior)

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed (with clarifications noted)

---