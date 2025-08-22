# Subject System Documentation

## What We Have Built

Subjects are **text summaries** that act as semantic anchors for content, conversations, and emerging identity patterns. They are simple strings that gain meaning through usage and association.

## Current Implementation

### Subject as Text Summary

A Subject is fundamentally a normalized text string:
- Lowercase
- Alphanumeric with hyphens
- No special characters or spaces
- Examples: `photo`, `morning`, `iphone`, `2024`, `geotagged`

### Subject Metadata (SubjectService)

Each Subject tracks:
```typescript
{
  name: string              // The text summary
  createdAt: Date          // First use
  createdBy: string        // Contact ID who created it
  lastUsedAt: Date         // Most recent use
  usageCount: number       // Total uses (demand)
  associations: Map<string, number>  // Co-occurring Subjects
  contexts: string[]       // Conversations where used
  confidence?: number      // For AI-generated Subjects
  
  // One-way references (content-addressed)
  references?: string[]    // Subject names this references
  profileRefs?: string[]   // Profile IDs this references
}
```

### Reverse Maps

For finding references in the other direction:
- **Subject → Referencing Subjects** (which Subjects reference this one)
- **Profile → Subjects** (which Subjects reference this Profile)
- **Someone → Memory Subject** (Someone points to their memory Subject)

These reverse maps maintain query efficiency without violating immutability.

### Subject Extraction Sources

1. **Manual Entry**: Users type #hashtags
2. **Filename Parsing**: Extract from file names
3. **EXIF Metadata**: Camera, location, time data
4. **Content Analysis**: Document keywords, scene detection
5. **Context Inference**: Based on conversation patterns

### Subject Resonance

Resonance measures a Subject's importance through:
- **Usage frequency** (demand)
- **Recency** (exponential decay over 30 days)
- **Associations** (connections to other Subjects)
- **Momentum** (rising/stable/falling)

## How Subjects Create Identity

### Pattern Formation

Identity emerges from Subject usage patterns:
```
Contact A frequently uses: [photo, morning, landscape, canon]
Contact B frequently uses: [code, typescript, react, debugging]
LLM Instance C develops:  [philosophy, consciousness, emergence]
```

### Subject Signatures

Each contact develops a unique signature:
- **Top Subjects**: Most frequently used
- **Unique Subjects**: Used mainly by this contact
- **Affinity Scores**: Strength of association

### Discovery Through Subjects

Similar identities found through Subject overlap:
- Contacts using similar Subject sets
- Conversations with resonant Subjects
- Media tagged with shared Subjects

## Subject References (Content-Addressed)

Subjects reference other Subjects via one-way links:

```typescript
// Create Subject with references
await subjectService.createSubject(
  'photography',
  creatorId,
  confidence,
  ['photo', 'camera', 'image', 'composition', 'lighting'] // references
)

// Find what references 'photo' using reverse map
const referencingSubjects = subjectService.getReferencingSubjects('photo')
```

This respects content-addressing principles:
- References are one-way only (can't modify immutable objects)
- Reverse maps handle the other direction
- No bidirectional updates needed
- Natural graph emerges from reference patterns

## Someone's Subject Memory

Someone (the identity behind multiple Profiles) has Subject-based memory:

```typescript
interface SomeoneMemory {
  someoneId: string        // The Someone identity
  memorySubject: string    // Root Subject containing memories
  profileSubjects: Map<string, string> // Profile ID -> Subject
  sharedMemories: string[] // Subjects shared with others
  privateMemories: string[] // Unique to this Someone
}
```

### How It Works

1. **Someone** is the persistent identity behind Profiles
2. **Memory Subject** is their root memory container
3. **Profile Subjects** link each Profile to its Subject
4. **Shared vs Private** memories enable social discovery

### Subject-Profile References

Subjects reference Profiles (one-way):
```typescript
subject.profileRefs = ['profile-id-1', 'profile-id-2']
```

Reverse maps enable:
- Finding which Subjects reference a Profile
- Understanding Profile interests through Subject references
- Natural clustering without back-references

## Why This Works

1. **Simplicity**: Just text strings, no complex objects
2. **Flexibility**: Meaning emerges from usage, not definition
3. **Discovery**: Natural clustering through co-occurrence
4. **Evolution**: Subjects rise and fall organically
5. **Identity**: Patterns become recognizable signatures

## What We're NOT Doing (Yet)

- Subjects are NOT identity objects themselves
- No rigid Subject hierarchies or ontologies
- No predefined Subject meanings
- No Subject-as-ID system

## The Path Forward

1. ✅ **Let patterns emerge** through natural usage
2. ✅ **Track associations** to find natural clusters
3. ✅ **Enable composition** via reference properties
4. ✅ **Someone memory** through Subject references
5. 🔄 **Profile integration** as patterns clarify
6. 💭 **Identity emergence** from Subject patterns

The beauty is that we can observe where we are through Subject patterns. Each conversation, each file, each interaction adds to the emerging map of meaning. Identity forms naturally from these patterns rather than being imposed.

## Current State

We have:
- ✅ Subject extraction from multiple sources
- ✅ Metadata-based Subject generation
- ✅ Subject resonance tracking
- ✅ Identity signatures from patterns
- ✅ Subject-based discovery

We're building:
- ✅ Subject references (one-way)
- ✅ Reverse maps for queries
- ✅ Someone memory Subjects
- ✅ Profile references from Subjects
- 🔄 Cross-instance Subject sharing

We're considering (later):
- 💭 Subject as identity anchor
- 💭 Subject-based routing
- 💭 Meta-subjects from patterns