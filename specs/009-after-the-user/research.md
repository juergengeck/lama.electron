# Phase 0 Research: Default LLM Topic Initialization

## Executive Summary
Research completed on existing LAMA Electron codebase to understand current implementation of default LLM selection and topic creation. All NEEDS CLARIFICATION items from the spec have been resolved through code analysis.

## Research Findings

### 1. Default LLM Selection Flow

**Decision**: Modify existing `ai:setDefaultModel` IPC handler
**Rationale**: Already integrated with all necessary components - AIAssistantModel, TopicGroupManager, and persistence layer
**Alternatives Considered**:
- Creating new handler: Rejected - would duplicate existing logic
- Direct model manipulation: Rejected - violates IPC-first architecture

**Implementation Location**: `/main/ipc/handlers/ai.js:174-219`

**Current Flow**:
1. User selects model in UI (`ModelOnboarding.tsx` or `AISettingsView.tsx`)
2. IPC call to `ai:setDefaultModel` with modelId
3. Handler creates AI contact and topics
4. Settings persisted via AISettingsManager

### 2. Topic ID Generation Issue

**Decision**: Fix hardcoded topic IDs to use LLM name
**Rationale**: Current implementation uses literal 'hi' and 'lama' strings instead of model-based IDs
**Alternatives Considered**:
- UUID-based IDs: Rejected - not deterministic
- Timestamp-based IDs: Rejected - not predictable

**Current Bug Location**: `/main/ipc/handlers/ai.js:194-195`
```javascript
// Current (incorrect):
const hiTopicId = 'hi';
const lamaTopicId = 'lama';

// Should be:
const hiTopicId = modelId;
const lamaTopicId = `${modelId}-private`;
```

### 3. Welcome Message Handling

**Decision**: Modify `handleNewTopic()` to check topic type
**Rationale**: Need to suppress LLM generation for "Hi" topic while allowing it for "LAMA"
**Alternatives Considered**:
- Separate methods: Rejected - code duplication
- Configuration flag: Selected - cleanest approach

**Implementation**: Add `suppressWelcome` flag to topic metadata

### 4. Static Welcome Message Content

**Decision**: Keep existing static message
**Content**:
```
Hi! I'm LAMA, your local AI assistant.

I run entirely on your device - no cloud, just private, fast AI help.

What can I do for you today?
```
**Rationale**: Clear, concise, explains system capabilities
**Alternatives Considered**:
- Longer explanation: Rejected - too verbose for welcome
- Technical details: Rejected - not user-friendly

### 5. Error Handling Strategy

**Decision**: Fail fast with clear error messages
**Rationale**: Aligns with LAMA constitution - no fallbacks
**Implementation**: Throw errors immediately, propagate through IPC

### 6. Topic Existence Check

**Decision**: Use TopicModel.getTopicByHash() before creation
**Rationale**: Prevents duplicates, preserves existing conversations
**Alternatives Considered**:
- Delete and recreate: Rejected - loses user data
- Version topics: Rejected - unnecessary complexity

### 7. Participant Switching on Model Change

**Decision**: Update topic participants when default model changes
**Rationale**: Allows switching between different AI models in the same conversation
**Implementation**:
- Remove previous AI participant from topic
- Add new AI participant (new model's contact)
- Preserve all existing messages
**Alternatives Considered**:
- Create new topics for each model: Rejected - fragments conversation history
- Keep all AI participants: Rejected - confusing which model responds

## Architecture Validation

### Constitution Compliance
✅ Single ONE.core instance (Node.js only)
✅ IPC-first communication
✅ Fail-fast philosophy
✅ No browser-side ONE.core

### Existing Components to Reuse
- `AIAssistantModel`: AI contact and message handling
- `TopicGroupManager`: Group topic creation
- `AISettingsManager`: Persistent settings storage
- `LLMManager`: Model operations

### Files Requiring Changes
1. `/main/ipc/handlers/ai.js` - Fix topic ID generation
2. `/main/core/ai-assistant-model.js` - Add welcome suppression logic
3. `/electron-ui/src/components/ChatLayout.tsx` - Display correct topic names
4. `/tests/integration/ai-topics.test.js` - New test file

## Resolved Clarifications

### From Spec FR-011: Static Welcome Message Content
**Resolution**: Use existing LAMA introduction message that explains local AI capabilities

### Error Handling (Edge Case 1)
**Resolution**: Throw error immediately, display in UI via IPC error propagation

### Conflict Resolution (Edge Case 2)
**Resolution**: Check existence before creation, preserve existing topics

## Performance Considerations

- Topic creation: <100ms (already achieved)
- UI updates: Immediate via React state
- No blocking operations in IPC handlers

## Security Considerations

- No secrets or API keys in topics
- All data stays local (ONE.core file system)
- No cloud communication for default topics

## Testing Strategy

1. Integration tests for IPC handlers
2. Unit tests for ID generation logic
3. E2E test for full flow (select model → see topics)
4. Regression tests for existing functionality

## Next Steps

Phase 1 will generate:
- Data model documentation
- IPC contracts
- Test specifications
- Quickstart guide

All research complete, ready for design phase.