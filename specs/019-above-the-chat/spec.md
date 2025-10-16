# Feature Specification: Context-Aware Knowledge Sharing Proposals

**Feature Branch**: `019-above-the-chat`
**Created**: 2025-01-11
**Status**: Complete
**Input**: User description: "above the chat entry field, the ui can offer a proposal of what to share based on subjects found by comparing keywords. the selection algorithm must be configurable in settings, we start out with any keyword in our current subject matching keywords in past subjects"

## Execution Flow (main)
```
1. Parse user description from Input
   → Actors: Users in conversations
   → Actions: View proposals, select shared context, configure matching algorithm
   → Data: Subjects, keywords, past conversations
   → Constraints: Configurable algorithm, keyword-based matching
2. Extract key concepts from description
   → UI element above chat entry
   → Automatic proposals based on subject/keyword matching
   → Configuration in settings
   → Initial algorithm: any keyword overlap
3. For each unclear aspect:
   → [Resolved - description is clear on core functionality]
4. Fill User Scenarios & Testing section
   → Define how users discover relevant past context
5. Generate Functional Requirements
   → Each requirement must be testable
6. Identify Key Entities
   → Subject, Keyword, Proposal, Algorithm Configuration
7. Run Review Checklist
   → Ensure no implementation details remain
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a LAMA user having a conversation, I want to see automatic suggestions of relevant past conversations and knowledge that match the current discussion topics, so that I can easily share context and build on previous discussions without manually searching through my history.

### Acceptance Scenarios
1. **Given** I am in a conversation discussing "pizza recipes" (current subject with keywords: pizza, recipes, cooking), **When** I have previously discussed "italian cooking" (past subject with keyword: cooking), **Then** the system displays one proposal above the chat entry field suggesting the most relevant past conversation about italian cooking based on the shared "cooking" keyword

2. **Given** I see a proposal displayed, **When** multiple past subjects match the current conversation and I swipe horizontally, **Then** the display cycles through proposals in order of subject relevance

3. **Given** I am viewing the most relevant proposal, **When** I swipe horizontally, **Then** the next most relevant proposal is displayed

4. **Given** I see a proposal for related past context, **When** I click on the proposal, **Then** the system shares that context into the current conversation

5. **Given** I want to control how aggressive the matching is, **When** I access settings, **Then** I can configure the matching algorithm parameters

6. **Given** the current conversation has no identified subjects yet, **When** I start typing, **Then** no proposals are shown until subjects are extracted

### Edge Cases
- What happens when there are no matching past subjects?
- How does the system handle proposals when the chat entry field area is small?
- What occurs when a user dismisses a proposal - does it reappear?
- What happens if a user swipes when only one proposal exists?
- What happens when past conversations contain sensitive subjects that shouldn't be shared in current context?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST display knowledge sharing proposals above the chat entry field when relevant past subjects are found
- **FR-002**: System MUST compare keywords from current conversation subjects with keywords from past conversation subjects
- **FR-003**: System MUST use a configurable matching algorithm to determine which past subjects are relevant
- **FR-004**: System MUST implement initial algorithm that matches when any keyword in current subject appears in past subject keywords
- **FR-005**: Users MUST be able to configure matching algorithm parameters in settings
- **FR-006**: System MUST indicate which keywords matched between current and past subjects in the proposal display
- **FR-007**: Users MUST be able to select a proposal to share that context into the current conversation
- **FR-008**: Users MUST be able to dismiss proposals without sharing them
- **FR-009**: System MUST only show proposals when current conversation has identified subjects
- **FR-010**: System MUST display exactly one proposal at a time above the chat entry field
- **FR-011**: System MUST rank proposals by subject relevance when multiple matches exist
- **FR-012**: Users MUST be able to navigate through multiple proposals using horizontal swipe gestures
- **FR-013**: System MUST cycle through proposals in order of decreasing subject relevance when user swipes
- **FR-014**: System MUST persist user's algorithm configuration preferences across sessions

### Key Entities
- **Proposal**: A suggestion to share past knowledge, containing reference to past subject, matched keywords, relevance score, and source conversation
- **Subject**: A discussion topic with associated keywords, can be from current or past conversations
- **Keyword**: Terms extracted from conversations that represent concepts, used for matching subjects
- **Algorithm Configuration**: User-defined parameters controlling matching behavior (e.g., minimum keyword overlap, match threshold, subject recency weight)

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
- [x] Dependencies and assumptions identified (assumes existing subject extraction from feature 018)

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities resolved
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---
