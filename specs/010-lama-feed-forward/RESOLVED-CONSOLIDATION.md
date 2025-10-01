# Feed-Forward Documentation - Resolved Consolidation

## Clarifications Applied

### 1. ✅ Knowledge Unit = Word (SHA-256 Hash)
- **Knowledge Unit**: A word represented as SHA-256 hash
- **Implementation**: Already covered by keyword hashing in `hasher.js`
- **Knowledge Context**: The varying levels of detail around keywords (0-3)
- **Resolution**: No separate implementation needed - these are conceptual terms

### 2. ✅ Pattern as Versioned Recipe (Future Use)
- **Pattern**: Will be a versioned ONE.core Recipe object
- **Purpose**: Describe emergent properties of the system
- **Implementation**: Add Pattern Recipe definition to `recipes.js`
- **Usage**: For meta-analysis and network intelligence detection

```javascript
// Add to recipes.js
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
    {name: 'instanceCount', type: 'Integer'}
  ]
}
```

### 3. ✅ Trust Score Creation Before Retrieval
- **Score Recipe**: Scaffolding for future trust system
- **Creation First**: Score objects created during exchanges
- **Retrieval**: Will use existing object queries, no special handler needed now
- **Resolution**: Keep as designed, implementation details will emerge

### 4. ✅ Unlimited Retention (No Conflict)
- **Policy**: Unlimited retention on user devices
- **Auto-pruning**: Optional future feature, not a requirement
- **Storage**: Grows with Moore's Law, no artificial limits
- **Resolution**: Remove "90 days auto-pruned" from data-model, keep indefinite

### 5. ✅ Use Existing Chat Channels
- **Channel Strategy**: Use existing chat channels for Supply/Demand
- **No Special Channels**: Not `feedforward:supply`, just regular objects
- **Propagation**: Through existing CHUM sync on chat channels
- **Resolution**: Update research.md to reflect this decision

## Consolidated Architecture

### Core Entities (4 ONE.core Recipes)
1. **Supply Recipe v1.0.0** - Knowledge advertisement
2. **Demand Recipe v1.0.0** - Knowledge request
3. **Score Recipe v1.0.0** - Trust relationships (scaffolding)
4. **Pattern Recipe v1.0.0** - Emergent properties (future use)

### Conceptual Terms (Not separate implementations)
- **Knowledge Unit** = SHA-256 hashed word
- **Knowledge Context** = Context levels 0-3

### IPC Handlers (8 Total)
1. `feedforward:createSupply`
2. `feedforward:createDemand`
3. `feedforward:matchSupplyDemand`
4. `feedforward:updateTrustScore`
5. `feedforward:detectPatterns`
6. `feedforward:getSharingPreferences`
7. `feedforward:setSharingPreferences`
8. `feedforward:getNetworkStatus`

### Performance Targets (Authoritative)
- Keyword extraction: <1s per conversation
- Supply/Demand propagation: <5s
- Matching algorithm: <2s for 100 objects
- Pattern detection: <5s for network scan

### Storage Strategy
- **Retention**: Indefinite (no limits)
- **Pruning**: Optional future feature
- **Channels**: Use existing chat channels
- **Propagation**: Via CHUM sync

## Updated Task Adjustments

### Task T013 Update
```
T013: Define ONE.core recipes (Supply, Demand, Score, Pattern) in main/core/feed-forward/recipes.js
```

### Task T019-T022 Clarification
Keep grouped as designed - these handlers are closely related and share context

### Remove from data-model.md
- "90 days (auto-pruned)" for Patterns
- Special channel references

## Final Document Structure

### Keep Current Structure
The existing 7-document structure is appropriate:
- Each document has clear purpose
- Redundancies are acceptable for different audiences
- Cross-references maintain consistency

### Key Updates Needed
1. **data-model.md**: Add Pattern Recipe, remove auto-pruning
2. **research.md**: Update channel strategy to use existing channels
3. **tasks.md**: Update T013 to include Pattern Recipe
4. **quickstart.md**: Optionally add tests for all context levels

## Implementation Priority

### Phase 1 (Core - Must Have)
- Supply, Demand, Score Recipes
- Keyword hashing
- Basic matching
- IPC handlers

### Phase 2 (Enhanced - Nice to Have)
- Pattern Recipe implementation
- Pattern detection
- Trust score evolution
- Auto-pruning (optional)

## Questions Resolved

1. ✅ Knowledge Unit = hashed word (no separate implementation)
2. ✅ Pattern = versioned Recipe for future use
3. ✅ Score creation first, retrieval via standard queries
4. ✅ Unlimited retention, pruning optional
5. ✅ Use existing chat channels
6. ✅ Keep task grouping as designed
7. ✅ Test coverage can be enhanced later
8. ✅ Use plan.md performance metrics

## Next Steps

1. Update data-model.md with Pattern Recipe definition
2. Update research.md to reflect existing channel usage
3. Update tasks.md T013 to include Pattern
4. Proceed with implementation as specified

The architecture is now consistent and ready for implementation. All conceptual conflicts have been resolved.