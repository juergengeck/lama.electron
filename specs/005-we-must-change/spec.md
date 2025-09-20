# Feature Specification: Topic-Subject-Summary Data Model

**Feature Branch**: `005-we-must-change`
**Created**: 2025-09-20
**Status**: Draft
**Input**: User description: "we must change the meaning of Summary according to the following: Topics consist of subjects discussed, Subject objects contain a timestamp from latest message they are created from and their id is their Topic and their list of Keywords. Subjects can be on e.g. Keywords children and education or foreigners and education - which would be two subjects. Each Topic has a current, versioned Summary object, referencing Subjects. Summary objects are updated when a new Subject or Keyword is created. the id of a Summary is its Topic"

## Execution Flow (main)
```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
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

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a user engaged in conversations covering multiple subjects, I want the system to organize discussion content into distinct subjects with their associated keywords, maintaining a comprehensive summary that tracks all subjects within a topic, so I can understand the various themes discussed and navigate complex conversations effectively.

### Acceptance Scenarios
1. **Given** a conversation topic with multiple distinct subjects being discussed, **When** the AI identifies different subject areas (e.g., "children and education" vs "foreigners and education"), **Then** separate Subject objects are created for each distinct combination of keywords
2. **Given** a Subject object exists, **When** viewing its properties, **Then** it displays its associated Topic, list of Keywords, and timestamp from the most recent message it was derived from
3. **Given** a Topic with multiple Subjects, **When** a new Subject is identified or new Keywords are added to existing Subjects, **Then** the Topic's Summary object is automatically updated to reflect these changes
4. **Given** a Summary object for a Topic, **When** accessing it, **Then** it provides references to all Subjects within that Topic and maintains version history
5. **Given** multiple versions of a Summary exist, **When** viewing the Topic, **Then** users see the current version while having access to the version history

### Edge Cases
- What happens when Keywords overlap between different Subjects?
- How does the system handle Subject merging when conversations converge on similar themes?
- What occurs when a Subject has no Keywords associated with it?
- How are orphaned Subjects handled when their originating messages are deleted?
- What happens when versioning creates excessive historical data?
- How does the system distinguish between truly distinct Subjects versus variations of the same theme?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: Topics MUST be able to contain multiple Subject objects representing different themes discussed
- **FR-002**: Each Subject MUST be uniquely identified by its combination of Topic and Keywords list
- **FR-003**: Subject objects MUST maintain a timestamp from the latest message they were created from
- **FR-004**: System MUST create distinct Subject objects for different keyword combinations (e.g., "children and education" as one Subject, "foreigners and education" as another)
- **FR-005**: Each Topic MUST have exactly one current Summary object at any given time
- **FR-006**: Summary objects MUST be versioned to maintain historical changes
- **FR-007**: Summary objects MUST reference all Subject objects within their Topic
- **FR-008**: Summary objects MUST be automatically updated when a new Subject is created within the Topic
- **FR-009**: Summary objects MUST be automatically updated when Keywords are added to or removed from existing Subjects
- **FR-010**: The Summary identifier MUST be the Topic it belongs to
- **FR-011**: System MUST preserve [NEEDS CLARIFICATION: how many versions of Summary history?]
- **FR-012**: Subject creation MUST be triggered by [NEEDS CLARIFICATION: AI detection, user action, or both?]
- **FR-013**: Keywords assignment to Subjects MUST follow [NEEDS CLARIFICATION: automatic extraction, manual tagging, or hybrid approach?]
- **FR-014**: Version transitions MUST occur [NEEDS CLARIFICATION: immediately or batch processed?]
- **FR-015**: Users MUST be able to [NEEDS CLARIFICATION: edit/merge/delete Subjects manually?]

### Key Entities *(include if feature involves data)*
- **Topic**: A conversation or discussion thread that encompasses multiple subjects and maintains a comprehensive summary
- **Subject**: A distinct theme or area of discussion within a Topic, identified by its unique combination of Keywords and containing a timestamp from its source message
- **Keyword**: A significant term or concept that helps categorize and identify Subjects within Topics
- **Summary**: A versioned, comprehensive overview of a Topic that references all Subjects within it, with its identifier being the Topic itself
- **Message**: The source content from which Subjects are derived, providing the timestamp for Subject creation

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
- [ ] Requirements are testable and unambiguous
- [ ] Success criteria are measurable
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed (has clarifications needed)

---

## Clarifications Needed

The following aspects require clarification before implementation can begin:

1. **Version History Limits**: How many versions of Summary objects should be retained? Is there a retention policy?
2. **Subject Creation Triggers**: Should Subjects be created automatically by AI detection, manually by users, or through a combination?
3. **Keyword Management**: How are Keywords assigned to Subjects - through automatic extraction, manual tagging, or a hybrid approach?
4. **Version Transition Timing**: Should Summary versions update immediately upon changes or be batch processed periodically?
5. **User Control**: Can users manually edit, merge, or delete Subject objects?
6. **Subject Similarity Threshold**: What criteria determine whether keyword combinations represent distinct Subjects or variations of the same Subject?
7. **Orphaned Data Handling**: What happens to Subjects when their source messages are deleted?
8. **Keyword Overlap Resolution**: How should the system handle Keywords that appear in multiple Subjects within the same Topic?
9. **Empty Subjects**: Are Subjects without Keywords valid, and if so, how are they identified?
10. **Access Control**: Do the same privacy rules apply to Subjects and Summaries as to their parent Topics?