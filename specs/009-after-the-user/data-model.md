# Data Model: Default LLM Topic Initialization

## Entities

### 1. AI Topic Configuration
Represents the configuration for default AI conversation topics.

**Fields**:
- `topicId`: string
  - Values: "hi" or "lama" (hardcoded)
  - Validation: Must be one of the two special topic IDs

- `topicName`: string
  - Values: "Hi" or "LAMA" (display names)
  - Validation: Required, non-empty

- `staticMessage`: string (for "hi" topic only)
  - Purpose: Pre-defined welcome message for "hi" topic
  - Value: "Hi! I'm LAMA, your local AI assistant..."
  - Note: Added immediately upon topic creation

### 2. Default Model Selection
Represents the user's default LLM choice.

**Fields**:
- `modelId`: string
  - Format: Model identifier (e.g., "llama3.2", "claude-3-opus")
  - Validation: Must exist in available models list

- `timestamp`: number
  - Purpose: Track when selection was made
  - Format: Unix timestamp in milliseconds

### 3. Topic Creation Result
Response from topic creation operation.

**Fields**:
- `success`: boolean
  - Values: true if topics created/found, false on error

- `topics`: object
  - `hi`: string - Topic ID for Hi conversation (always "hi")
  - `lama`: string - Topic ID for LAMA conversation (always "lama")

- `created`: object
  - `hi`: boolean - Whether Hi topic was newly created
  - `lama`: boolean - Whether LAMA topic was newly created

## Relationships

```
User
  └─> selects Default Model
        └─> triggers Topic Creation
              ├─> Hi Topic (with static message)
              └─> LAMA Topic (with LLM welcome)
```

## State Transitions

### Topic Lifecycle
```
[Not Exists] ---(select model)---> [Created with Welcome]
     ↑                                      |
     |                                      v
     +----------(model change)-------[Preserved if Exists]
```

### Welcome Message Flow
```
Hi Topic:    [Created] ---> [Static Message Added Immediately] ---> [Ready]
LAMA Topic:  [Created Empty] ---> [LLM Generates Welcome] ---> [Ready]
LAMA Topic:  [Already Has Messages] ---> [No Welcome Generated] ---> [Ready]
```

## Validation Rules

1. **Topic ID Constraints**:
   - Hi topic ID must be "hi" (hardcoded)
   - LAMA topic ID must be "lama" (hardcoded)

2. **Welcome Message Logic**:
   - Hi topic: Static message added immediately on creation
   - LAMA topic: LLM generates welcome only if topic is empty

3. **Duplicate Prevention**:
   - Check existence before creation
   - Preserve existing conversations

## Storage

All entities stored in ONE.core:
- Topics: As Topic objects with channels
- Settings: As unversioned GlobalLLMSettings objects
- Messages: As Message objects in channels

## Access Patterns

1. **Read**: Check if topics exist for model
2. **Create**: Initialize new topics with proper IDs
3. **Update**: Not applicable - topics are immutable once created
4. **Delete**: Not in scope - topics persist