# Quickstart: LAMA Feed-Forward Information Sharing

## Prerequisites
- LAMA Electron running with at least 2 AI instances connected
- Node.js 18+ and npm installed
- Test conversations with diverse topics

## Setup (5 minutes)

### 1. Install Dependencies
```bash
cd /Users/gecko/src/lama.electron
npm install
```

### 2. Run LAMA Electron
```bash
npm run electron
```

### 3. Enable Feed-Forward System
In the UI, navigate to Settings → Feed-Forward and enable knowledge sharing.

## Test Scenario 1: Basic Knowledge Sharing (10 minutes)

### Setup
1. **Instance A**: Start a conversation about "quantum computing"
2. **Instance B**: Start fresh (no quantum computing knowledge)

### Test Steps
1. In Instance A, discuss quantum computing concepts for 5+ messages
2. System automatically extracts keywords and creates Supply objects
3. In Instance B, ask about quantum computing
4. System detects knowledge gap and creates Demand object
5. Feed-forward manager matches Demand with Supply from Instance A
6. Instance B provides informed response using shared knowledge

### Validation
- [ ] Supply object created in Instance A (check logs)
- [ ] Demand object created in Instance B (check logs)
- [ ] Match found with >30% keyword overlap
- [ ] Instance B response includes concepts from Instance A

## Test Scenario 2: Trust-Based Filtering (10 minutes)

### Setup
1. Set Instance A trust score to 0.8 (high trust)
2. Set Instance C trust score to 0.2 (low trust)
3. Both instances have knowledge about "climate change"

### Test Steps
1. Instance B requests knowledge about climate change
2. System finds Supply from both A and C
3. Trust-based filtering prioritizes Instance A's knowledge
4. Instance B receives and uses high-trust information

### Validation
- [ ] Multiple Supply objects found
- [ ] Trust scores correctly influence ranking
- [ ] Higher trust Supply used in response
- [ ] Low trust Supply available but deprioritized

## Test Scenario 3: Pattern Detection (15 minutes)

### Setup
1. Connect 5+ AI instances
2. Have 3+ instances ask about "machine learning basics"

### Test Steps
1. Multiple instances create similar Demand objects
2. Pattern detector identifies trending demand
3. System creates meta-Supply about the trend
4. Instances with ML knowledge prioritize sharing

### Validation
- [ ] Pattern detected after 3+ similar Demands
- [ ] Pattern object created with type "trending"
- [ ] Network adapts to fill knowledge gap
- [ ] Pattern visible in network status UI

## Test Scenario 4: Privacy Controls - All Context Levels (10 minutes)

### Setup
1. Configure 4 instances with different trust levels:
   - Instance A: Trust 0.0 (no trust)
   - Instance B: Trust 0.3 (low trust)
   - Instance C: Trust 0.6 (medium trust)
   - Instance D: Trust 0.8 (high trust)

### Test Level 0 - Hash Only (No Trust Required)
1. Instance A requests knowledge (trust 0.0)
2. Receives only keyword hashes
3. No actual keywords revealed

### Validation Level 0
- [ ] Only SHA-256 hashes shared
- [ ] No keyword text visible
- [ ] Works with zero trust

### Test Level 1 - Basic (Trust ≥ 0.3)
1. Instance B requests knowledge (trust 0.3)
2. Receives keywords and categories
3. No conversation context

### Validation Level 1
- [ ] Actual keywords visible
- [ ] Category information included
- [ ] No conversation snippets

### Test Level 2 - Context (Trust ≥ 0.6)
1. Instance C requests knowledge (trust 0.6)
2. Receives keywords plus conversation snippets
3. Limited context provided

### Validation Level 2
- [ ] Keywords and categories included
- [ ] Conversation snippet provided (max 500 chars)
- [ ] Not full conversation

### Test Level 3 - Full (Trust ≥ 0.8)
1. Instance D requests knowledge (trust 0.8)
2. Receives complete conversation context
3. Full transparency

### Validation Level 3
- [ ] Complete conversation history shared
- [ ] All context available
- [ ] Maximum information transfer

### Edge Cases
- [ ] Trust 0.29 gets Level 0 only
- [ ] Trust 0.59 gets Level 1 only
- [ ] Trust 0.79 gets Level 2 only
- [ ] Trust decay affects access levels

## Test Scenario 5: UI Control Panel (5 minutes)

### Test Steps
1. Open Feed-Forward settings panel
2. View active Supply objects (keywords, count)
3. View active Demand objects (status, matches)
4. Adjust sharing preferences
5. View network statistics

### Validation
- [ ] Supply/Demand lists update in real-time
- [ ] Keyword management UI functional
- [ ] Trust scores visible and editable
- [ ] Network statistics accurate
- [ ] Preferences persist after restart

## Performance Validation

### Metrics to Verify
- [ ] Keyword extraction: <1 second per conversation
- [ ] Supply/Demand creation: <500ms
- [ ] Matching algorithm: <2 seconds for 100 objects
- [ ] Pattern detection: <5 seconds for network scan
- [ ] UI updates: <100ms response time

## Integration Test Commands

```bash
# Run integration tests
npm test -- --testPathPattern=feed-forward

# Run contract tests (should fail before implementation)
npm test -- --testPathPattern=contracts/feed-forward

# Check IPC handler registration
npm run electron -- --debug-ipc | grep feedforward

# Monitor CHUM sync for Supply/Demand objects
tail -f ~/.lama/logs/chum-sync.log | grep -E "(Supply|Demand)"
```

## Troubleshooting

### No Matches Found
- Check keyword overlap (needs >30%)
- Verify trust scores are above threshold
- Ensure CHUM sync is active
- Check network connectivity

### Trust Scores Not Updating
- Verify Score Recipe is registered
- Check exchange completion status
- Look for errors in trust-manager.js
- Ensure bidirectional updates

### Patterns Not Detected
- Need minimum 3 similar events
- Check pattern-detector service is running
- Verify time window settings
- Look for pattern objects in storage

## Success Criteria
- [ ] All 5 test scenarios pass
- [ ] Performance metrics met
- [ ] No errors in console/logs
- [ ] UI responsive and accurate
- [ ] Knowledge successfully shared between instances