# Research Findings: LAMA Feed-Forward Implementation

## 1. ONE.core Versioned Recipes

**Decision**: Use ONE.core's Recipe system for Supply, Demand, and Score objects
**Rationale**:
- Recipes provide schema versioning and evolution
- Content-addressed storage ensures integrity
- Built-in support for object relationships

**Implementation Details**:
```javascript
// Recipe definitions
const SupplyRecipe = {
  $type$: 'Recipe',
  name: 'Supply',
  version: '1.0.0',
  ingredients: [
    {name: 'keywords', type: 'Array<SHA256Hash>'},
    {name: 'sourceInstance', type: 'PersonId'},
    {name: 'contextAvailable', type: 'Boolean'},
    {name: 'conversationFragments', type: 'Array<EncryptedReference>'},
    {name: 'trustScore', type: 'Float'},
    {name: 'timestamp', type: 'ISO8601'}
  ]
}

const DemandRecipe = {
  $type$: 'Recipe',
  name: 'Demand',
  version: '1.0.0',
  ingredients: [
    {name: 'keywords', type: 'Array<SHA256Hash>'},
    {name: 'requestingInstance', type: 'PersonId'},
    {name: 'urgency', type: 'Enum<high|medium|low>'},
    {name: 'contextProvided', type: 'ConversationFragment'},
    {name: 'satisfactionCriteria', type: 'String'},
    {name: 'timestamp', type: 'ISO8601'}
  ]
}

const ScoreRecipe = {
  $type$: 'Recipe',
  name: 'Score',
  version: '1.0.0',
  ingredients: [
    {name: 'sourceInstance', type: 'PersonId'},
    {name: 'targetInstance', type: 'PersonId'},
    {name: 'trustValue', type: 'Float'},
    {name: 'exchangeCount', type: 'Integer'},
    {name: 'lastUpdated', type: 'ISO8601'}
  ]
}
```

**Alternatives Considered**:
- Plain objects: Rejected - no versioning or schema evolution
- Custom object types: Rejected - reinventing ONE.core features

## 2. CHUM Sync Protocol Integration

**Decision**: Leverage existing CHUM sync for Supply/Demand propagation
**Rationale**:
- CHUM already handles federated object synchronization
- Trust networks already influence routing
- No need for separate propagation protocol
- Use existing chat channels for simplicity

**Implementation Strategy**:
- Supply/Demand objects stored as regular ONE.core objects
- Use existing chat channels for propagation (no special channels)
- Objects associated with conversations through references
- CHUM sync automatically propagates to connected instances
- Trust scores influence which instances receive objects first

**Key Insight**: Supply/Demand are just data objects, not channels themselves
- They reference conversations but don't create new channels
- Propagation happens through existing chat channel federation
- No need for special `feedforward:supply` or `feedforward:demand` channels

**Alternatives Considered**:
- Custom P2P protocol: Rejected - duplicates CHUM functionality
- Direct messaging: Rejected - doesn't scale to network-wide sharing

## 3. Keyword Hashing Strategy

**Decision**: Deterministic SHA-256 hashing with normalization pipeline
**Rationale**:
- Ensures identical concepts have identical hashes across instances
- Privacy-preserving (can't reverse hash to get keyword)
- Fast comparison and matching

**Normalization Pipeline**:
```javascript
function hashKeyword(keyword) {
  // 1. Convert to lowercase
  let normalized = keyword.toLowerCase();

  // 2. Remove punctuation and extra spaces
  normalized = normalized.replace(/[^\w\s]/g, '').trim();

  // 3. Stem common word endings (simple stemming)
  normalized = simpleStem(normalized);

  // 4. Generate SHA-256
  return sha256(normalized);
}
```

**Synonym Handling**:
- Maintain local synonym mappings
- Multiple hashes can point to same concept
- Share synonym discoveries as meta-Supply objects

**Alternatives Considered**:
- Raw keywords: Rejected - privacy concerns
- Embedding vectors: Rejected - not deterministic across models

## 4. Privacy-Preserving Knowledge Sharing

**Decision**: Progressive context revelation based on trust levels
**Rationale**:
- Users maintain control over information sharing
- Trust builds gradually through successful exchanges
- No accidental oversharing

**Context Levels**:
1. **Level 0**: Keyword hashes only (always shared)
2. **Level 1**: Keywords + category (requires low trust)
3. **Level 2**: Keywords + conversation snippet (requires medium trust)
4. **Level 3**: Full conversation context (requires high trust)

**User Control UI**:
- Explicit toggles for each sharing level
- Whitelist/blacklist for specific instances
- Review queue for sharing requests

**Alternatives Considered**:
- All-or-nothing sharing: Rejected - too rigid
- Automatic sharing: Rejected - violates user control requirement

## 5. Network-wide Pattern Detection

**Decision**: Local aggregation with periodic network snapshots
**Rationale**:
- Each instance tracks patterns it observes
- Periodic snapshots shared as meta-Supply objects
- Emergent intelligence without central coordination

**Pattern Types**:
- **Trending Demands**: Keywords frequently requested
- **Knowledge Gaps**: Demands with no matching Supply
- **Trust Clusters**: Groups of instances with high mutual trust
- **Recursive Patterns**: Demands about Demands

**Implementation**:
```javascript
class PatternDetector {
  analyzeDemands(demands) {
    // Group by keyword frequency
    const trends = this.identifyTrends(demands);

    // Find unmatched demands
    const gaps = this.findKnowledgeGaps(demands, supplies);

    // Create meta-Supply with patterns
    return new Supply({
      type: 'MetaPattern',
      patterns: {trends, gaps},
      instanceObservations: demands.length
    });
  }
}
```

**Alternatives Considered**:
- Central aggregation server: Rejected - violates decentralization
- Real-time streaming: Rejected - too resource intensive

## Conclusions

The feed-forward system will be built on ONE.core's existing infrastructure:
- Versioned recipes ensure forward compatibility
- CHUM handles all network propagation
- SHA-256 hashing provides privacy and consistency
- Progressive trust enables controlled sharing
- Local pattern detection creates emergent intelligence

All design decisions align with LAMA's constitution:
- Single ONE.core instance (Node.js only)
- IPC for all browser communication
- Fail-fast philosophy (no fallbacks)
- Simple, direct implementation