# Data Model: LAMA Feed-Forward Information Sharing

## Core Entities

### 1. Supply (ONE.core Recipe v1.0.0)
**Purpose**: Advertisement of available knowledge that an AI instance can share

**Fields**:
| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| keywords | Array<SHA256Hash> | Hashed keywords representing knowledge | Min 1, Max 20 |
| sourceInstance | PersonId | AI instance offering knowledge | Must be valid PersonId |
| contextAvailable | Boolean | Whether detailed context can be shared | Required |
| contextLevel | Integer | Maximum context level available (0-3) | 0 ≤ level ≤ 3 |
| conversationFragments | Array<EncryptedReference> | References to source conversations | Max 5 references |
| trustScore | Float | Self-reported trust score | 0.0 ≤ score ≤ 1.0 |
| timestamp | ISO8601 | When Supply was created | Required, immutable |
| expiresAt | ISO8601 | When Supply expires | Optional, future date |

**State**: Immutable once created

### 2. Demand (ONE.core Recipe v1.0.0)
**Purpose**: Request for knowledge that an AI instance needs

**Fields**:
| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| keywords | Array<SHA256Hash> | Hashed keywords being sought | Min 1, Max 10 |
| requestingInstance | PersonId | AI instance requesting knowledge | Must be valid PersonId |
| urgency | Enum | Priority level | high\|medium\|low |
| contextProvided | String | Brief context showing knowledge gap | Max 500 chars |
| satisfactionCriteria | String | What constitutes adequate response | Max 200 chars |
| timestamp | ISO8601 | When Demand was created | Required, immutable |
| satisfiedBy | Array<SupplyHash> | Supply objects that satisfied this | Updated when matched |
| status | Enum | Current state | open\|partial\|satisfied |

**State Transitions**:
- `open` → `partial` (when partially matched)
- `partial` → `satisfied` (when fully matched)
- `open` → `satisfied` (when fully matched directly)

### 3. Score (ONE.core Recipe v1.0.0)
**Purpose**: Trust relationship between AI instances

**Fields**:
| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| sourceInstance | PersonId | Instance being scored | Must be valid PersonId |
| targetInstance | PersonId | Instance giving the score | Must be valid PersonId |
| trustValue | Float | Current trust score | 0.0 ≤ score ≤ 1.0 |
| exchangeCount | Integer | Number of successful exchanges | ≥ 0 |
| lastExchange | ISO8601 | Most recent interaction | Required |
| qualityMetrics | Object | Exchange quality indicators | Optional |
| lastUpdated | ISO8601 | When score was last modified | Required |

**Update Rules**:
- Trust increases with successful exchanges (+0.1 max per exchange)
- Trust decreases with failed validations (-0.2 per failure)
- Trust decays over time without interaction (-0.01 per month)

### 4. Pattern (ONE.core Recipe v1.0.0) - Phase 2
**Purpose**: Detected patterns in network knowledge flow (for describing emergent properties)
**Note**: To be implemented in Phase 2 for future use

**Fields**:
| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| type | Enum | Pattern category | trending\|gap\|cluster\|recursive |
| observingInstance | PersonId | Instance that detected pattern | Must be valid PersonId |
| patterns | Object | Pattern-specific data | Required |
| observationPeriod | Object | {start: ISO8601, end: ISO8601} | Required |
| confidence | Float | Pattern confidence | 0.0 ≤ confidence ≤ 1.0 |
| instanceCount | Integer | Instances involved | ≥ 1 |
| timestamp | ISO8601 | When pattern was detected | Required, immutable |

**Pattern Types**:
- **trending**: Keywords appearing frequently
- **gap**: Demands without matching Supply
- **cluster**: Groups of instances with high mutual trust
- **recursive**: Demands about the demand/supply system itself

**Recipe Definition** (for Phase 2):
```javascript
const PatternRecipe = {
  $type$: 'Recipe',
  name: 'Pattern',
  version: '1.0.0',
  ingredients: [
    {name: 'type', type: 'Enum<trending|gap|cluster|recursive>'},
    {name: 'observingInstance', type: 'PersonId'},
    {name: 'patterns', type: 'Object'},
    {name: 'observationPeriod', type: 'Object'},
    {name: 'confidence', type: 'Float'},
    {name: 'instanceCount', type: 'Integer'},
    {name: 'timestamp', type: 'ISO8601'}
  ]
}
```

## Relationships

### Supply ↔ Demand Matching
- Many-to-many relationship via keyword overlap
- Match strength = (shared keywords / total keywords)
- Minimum 30% overlap for consideration
- Trust score weights final matching

### Instance ↔ Instance Trust
- Bidirectional relationships (A→B trust ≠ B→A trust)
- Stored as Score objects
- Updated after each exchange
- Influences Supply/Demand routing

### Pattern ↔ Objects
- Patterns reference Supply/Demand objects by hash
- Patterns can reference other Patterns (meta-patterns)
- No direct modification, only observation

## Privacy Levels

### Context Sharing Tiers
| Level | Name | Content | Trust Required |
|-------|------|---------|----------------|
| 0 | Hash | Keyword hashes only | None |
| 1 | Basic | Keywords + category | ≥ 0.3 |
| 2 | Context | Keywords + snippet | ≥ 0.6 |
| 3 | Full | Complete conversation | ≥ 0.8 |

## Storage Strategy

### ONE.core Integration
- All objects stored as ONE.core objects
- Content-addressed by SHA-256 hash
- Recipes ensure schema versioning
- CHUM sync handles propagation

### Indexing
- Local indexes by keyword hash
- Local indexes by instance ID
- Local indexes by timestamp
- No global indexes (decentralized)

### Retention
- Supply: Indefinite (may have optional expiry field)
- Demand: Indefinite (status updated as satisfied)
- Score: Indefinite (trust value may decay over time)
- Pattern: Indefinite (optional pruning in future releases)

## Validation Rules

### Keyword Hashing
```javascript
function validateKeywordHash(hash) {
  // Must be valid SHA-256
  return /^[a-f0-9]{64}$/.test(hash);
}
```

### Trust Score Calculation
```javascript
function calculateTrust(exchanges, failures, lastInteraction) {
  let base = exchanges * 0.1 - failures * 0.2;
  let decay = monthsSince(lastInteraction) * 0.01;
  return Math.max(0, Math.min(1, base - decay));
}
```

### Match Scoring
```javascript
function scoreMatch(demand, supply, trust) {
  let keywordOverlap = intersection(demand.keywords, supply.keywords).length;
  let overlapRatio = keywordOverlap / demand.keywords.length;
  return overlapRatio * trust;
}
```