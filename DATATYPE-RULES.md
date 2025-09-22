# ONE.core Datatype Architecture Rules

## Core Principles

### 1. Datatype Purity
- **NEVER** embed metadata inside content datatypes
- Each datatype has ONE responsibility
- Relationships via SHA256 hashes or IDs only

### 2. Metadata Lives in Separate Datatypes
- Metadata about content goes in dedicated datatypes that REFERENCE the content
- Never modify a datatype to add metadata fields
- Create new datatypes for new metadata concerns

## Architectural Rules

### Rule 1: Person Identity is Universal
```javascript
// CORRECT: AI and humans both use Person datatype
Person {
  $type$: 'Person',
  name: string
}

// WRONG: Special AI person type
AIPerson extends Person {  // NO! Violates purity
  modelType: string
}
```

### Rule 2: Metadata References Content
```javascript
// CORRECT: LLM metadata references Person
LLM {
  $type$: 'LLM',
  personId: SHA256,  // References Person
  modelName: string,
  settings: object
}

// WRONG: Person contains LLM data
Person {
  isAI: boolean,  // NO! Metadata pollution
  modelName: string  // NO! Wrong datatype
}
```

### Rule 3: Messages Are Pure Content
```javascript
// CORRECT: ChatMessage is just content
ChatMessage {
  $type$: 'ChatMessage',
  text: string,
  sender: SHA256  // Person ID only
}

// WRONG: Message with embedded metadata
ChatMessage {
  text: string,
  sender: SHA256,
  isFromAI: boolean,  // NO! Derive from LLM datatype
  format: string,  // NO! Derive from sender type
  trustLevel: number  // NO! Separate TrustAssertion datatype
}
```

### Rule 4: Analysis in Dedicated Datatypes
```javascript
// CORRECT: Analysis references messages
Subject {
  $type$: 'Subject',
  messageHashes: SHA256[],  // References messages
  keywords: string[],
  topicId: string
}

// WRONG: Messages contain analysis
ChatMessage {
  text: string,
  subjects: string[],  // NO! Use Subject datatype
  keywords: string[]  // NO! Use Keyword datatype
}
```

### Rule 5: UI Hints Are NOT Datatypes
```javascript
// CORRECT: UI formatting derived at render time
const formatMessage = (msg) => {
  const isAI = await checkIfSenderIsAI(msg.sender)
  return {
    ...msg,
    // UI hints added ONLY for rendering
    format: isAI ? 'markdown' : 'plain'
  }
}

// WRONG: Storing UI hints in datatype
storeVersionedObject({
  $type$: 'ChatMessage',
  text: string,
  format: 'markdown'  // NO! UI concern
})
```

## Implementation Patterns

### Pattern 1: Lookup Tables for Metadata
```javascript
class LLMObjectManager {
  // Maps Person ID -> LLM metadata
  private llmByPerson: Map<SHA256, LLM>

  isAIPerson(personId) {
    return this.llmByPerson.has(personId)
  }
}
```

### Pattern 2: Join at Query Time
```javascript
async function getMessageWithMetadata(messageHash) {
  const message = await getObject(messageHash)
  const sender = await getObject(message.sender)
  const llm = await findLLMByPerson(message.sender)

  // Compose view model from multiple datatypes
  return {
    text: message.text,
    senderName: sender.name,
    isAI: !!llm,
    modelName: llm?.modelName
  }
}
```

### Pattern 3: Reference Collections
```javascript
// Topic analysis references messages
class TopicAnalyzer {
  async analyzeMessages(messageHashes: SHA256[]) {
    const subject = {
      $type$: 'Subject',
      messageHashes,  // References, not embeds
      keywords: extractedKeywords
    }
    return storeVersionedObject(subject)
  }
}
```

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Type Inheritance for Metadata
```javascript
// NEVER DO THIS
class AIMessage extends ChatMessage {
  modelUsed: string
  temperature: number
}
```

### ❌ Anti-Pattern 2: Embedded Metadata Fields
```javascript
// NEVER DO THIS
ChatMessage {
  text: string,
  metadata: {  // Embedded metadata object
    isAI: boolean,
    trust: number
  }
}
```

### ❌ Anti-Pattern 3: Mixed Concerns
```javascript
// NEVER DO THIS
Person {
  name: string,
  llmSettings: {},  // LLM concern in Person
  trustLevel: number  // Trust concern in Person
}
```

## Verification Checklist

Before adding a field to a datatype, ask:

1. **Is this field core to the datatype's single responsibility?**
   - ✅ ChatMessage.text (core content)
   - ❌ ChatMessage.isFromAI (metadata)

2. **Can this be derived from another datatype?**
   - ✅ isAI derived from LLM datatype
   - ❌ Storing isAI in message

3. **Is this a UI concern?**
   - ✅ Format determined at render time
   - ❌ Format stored in datatype

4. **Should this be a separate datatype?**
   - ✅ TrustAssertion references Person
   - ❌ Person.trustLevel field

5. **Is this creating a dependency?**
   - ✅ LLM references Person (one-way)
   - ❌ Person knows about LLM (circular)

## Benefits of This Architecture

1. **Immutability**: Content never changes when metadata updates
2. **Composability**: Combine datatypes without modification
3. **Extensibility**: Add new metadata types without touching existing ones
4. **Integrity**: SHA256 references ensure data consistency
5. **Flexibility**: Same content can have different metadata views
6. **Reusability**: Datatypes work across different contexts

## Example: AI Assistant Architecture

```javascript
// Pure datatypes
Person { name: "Claude" }  // -> SHA256: abc123...

LLM {
  personId: "abc123...",
  modelName: "Claude-3",
  provider: "Anthropic"
}

ChatMessage {
  text: "Hello world",
  sender: "abc123..."
}

// Runtime composition for UI
const displayMessage = {
  ...message,
  senderName: person.name,
  isAI: !!llm,
  format: llm ? 'markdown' : 'plain'
}
```

This architecture ensures ONE.core datatypes remain pure, metadata is properly separated, and the system maintains its integrity as a content-addressed storage system.