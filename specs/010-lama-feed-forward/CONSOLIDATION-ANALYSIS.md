# Feed-Forward Documentation Consolidation Analysis

## Document Overview
1. **spec.md** - User requirements (WHAT)
2. **plan.md** - Implementation approach (HOW overview)
3. **research.md** - Technical decisions (WHY)
4. **data-model.md** - Entity definitions
5. **contracts/ipc-handlers.json** - API contracts
6. **quickstart.md** - Test scenarios
7. **tasks.md** - Execution steps

## 🔴 Critical Inconsistencies Found

### 1. Recipe Versioning Inconsistency
- **research.md**: Shows recipes with `version: '1.0.0'` as strings
- **data-model.md**: Shows `(ONE.core Recipe v1.0.0)` in headers but doesn't define recipe structure
- **plan.md**: Says "1.0.0 (for recipes)" but unclear if this is recipe version or feature version
- **tasks.md**: T013 mentions "Define ONE.core recipes" but no version specified

**QUESTION 1**: Should recipe versions be strings ('1.0.0') or semantic version objects? Should they align with feature version?

### 2. Number of Entities Conflict
- **spec.md**: Lists 5 key entities (Knowledge Unit, Supply Signal, Demand Signal, Trust Relationship, Knowledge Context)
- **data-model.md**: Defines 4 entities (Supply, Demand, Score, Pattern)
- **plan.md**: References "4 entities"
- **research.md**: Only defines 3 recipes (Supply, Demand, Score) - missing Pattern recipe

**QUESTION 2**: Is "Pattern" a Recipe-based object or a different type? Where is "Knowledge Unit" and "Knowledge Context" implementation?

### 3. IPC Handler Count Discrepancy
- **contracts/ipc-handlers.json**: Defines 8 handlers
- **plan.md**: States "8 handlers"
- **tasks.md**: T019-T022 suggests 4 implementation tasks for 8 handlers (conflated)
- **quickstart.md**: Only tests 5 scenarios (missing 3 handler tests)

**QUESTION 3**: Should each IPC handler have its own implementation task, or group them as currently shown in T019-T022?

### 4. Context Levels Inconsistency
- **research.md**: Defines 4 levels (0-3) with specific trust thresholds
- **data-model.md**: References "Context Sharing Tiers" with same 4 levels
- **spec.md**: Mentions "different levels of context granularity" but doesn't specify count
- **quickstart.md**: Tests privacy controls but only validates level 1 and 3

**QUESTION 4**: Should quickstart.md test all 4 context levels?

### 5. Trust Score Calculation Methods
- **data-model.md**: Provides specific formulas for trust calculation
- **research.md**: Mentions trust scores but no formulas
- **contracts/ipc-handlers.json**: Has updateTrustScore but no getTrustScore handler
- **tasks.md**: T017 "Create trust score calculator" but no specification reference

**QUESTION 5**: How do instances retrieve existing trust scores? Need a getTrustScore IPC handler?

### 6. Channel ID Strategy Confusion
- **research.md**: States `feedforward:supply` and `feedforward:demand` channel IDs
- **CLAUDE.md**: Shows complex channel architecture but doesn't mention feed-forward channels
- **plan.md**: No mention of channel strategy

**QUESTION 6**: Are Supply/Demand objects stored in special channels or just as regular ONE.core objects?

### 7. Performance Metrics Inconsistency
- **spec.md**: No specific performance requirements stated
- **plan.md**: "<1s keyword extraction, <5s Supply/Demand propagation"
- **quickstart.md**: Different metrics "<1 second per conversation" for extraction
- **tasks.md**: T034 references performance but different metrics

**QUESTION 7**: Which performance metrics are authoritative?

### 8. Storage and Retention Conflicts
- **spec.md**: "System MUST retain shared knowledge indefinitely"
- **data-model.md**: "Pattern: 90 days (auto-pruned)" - contradicts indefinite retention
- **research.md**: No retention specification

**QUESTION 8**: Should Patterns be exempt from indefinite retention? What about Score decay?

## 🟡 Redundancies to Consolidate

### 1. Recipe Definitions (3 places)
- **research.md**: Full recipe schemas
- **data-model.md**: Field tables (different format)
- **tasks.md**: References recipes but no definition

**Recommendation**: Keep in data-model.md only, reference from others

### 2. File Structure (3 places)
- **plan.md**: Detailed structure
- **tasks.md**: Repeats paths
- **CLAUDE.md**: Has different structure

**Recommendation**: Single source in plan.md, others reference

### 3. Test Scenarios (2 places)
- **quickstart.md**: 5 detailed scenarios
- **tasks.md**: References tests but different organization

**Recommendation**: Align tasks.md tests with quickstart.md scenarios

## 🟢 Well-Aligned Areas

1. **CHUM Integration**: Consistent across all docs
2. **SHA-256 Hashing**: Consistent approach
3. **IPC-First Architecture**: Properly maintained
4. **Node.js/Browser Separation**: Clear throughout

## 📋 Consolidation Recommendations

### 1. Create Master Reference Document
Combine:
- Recipe definitions (from research + data-model)
- Performance requirements (reconcile all sources)
- Channel/storage strategy (clarify approach)

### 2. Align Test Coverage
- Each IPC handler = 1 test task
- Each context level = 1 test scenario
- Each entity = validation tests

### 3. Clarify Versioning Strategy
- Recipe versions vs feature version
- Version migration approach
- Breaking change handling

### 4. Complete Missing Pieces
- Pattern Recipe definition
- getTrustScore IPC handler
- Knowledge Unit implementation
- Full context level testing

## Questions Requiring Answers

1. **Recipe Versioning**: String '1.0.0' or semantic versioning? Aligned with feature?
2. **Entity Count**: Where are Knowledge Unit and Knowledge Context? Is Pattern a Recipe?
3. **Task Granularity**: One task per IPC handler or grouped?
4. **Test Coverage**: Should we test all 4 context levels?
5. **Trust Retrieval**: Need getTrustScore handler?
6. **Channel Strategy**: Special channels or regular objects?
7. **Performance Metrics**: Which are authoritative?
8. **Retention Policy**: Patterns exempt? Score decay allowed?
9. **Implementation Priority**: Should Pattern be implemented in Phase 1?
10. **UI Scope**: Should UI show all entities or just Supply/Demand?

## Proposed Consolidation Structure

```
specs/010-lama-feed-forward/
├── README.md                    # Overview + quick links
├── specification.md             # Combined spec + requirements
├── architecture.md              # Combined plan + research + data-model
├── contracts/                   # Keep as-is
├── implementation.md            # Combined tasks + quickstart
└── archive/                     # Original files for reference
    ├── spec.md
    ├── plan.md
    ├── research.md
    ├── data-model.md
    ├── quickstart.md
    └── tasks.md
```