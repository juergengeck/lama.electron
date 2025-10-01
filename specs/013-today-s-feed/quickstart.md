# Feed-Forward Training Infrastructure - Quick Start Guide

## Overview
The Feed-Forward system transforms LAMA conversations into a living training corpus for AI systems, replacing static datasets with continuous, verified, attributed conversation data.

## Prerequisites
- LAMA Electron running with active conversations
- Node.js instance initialized
- At least one conversation with 5+ messages

## Quick Test Scenarios

### Scenario 1: Enable Sharing for a Conversation
```javascript
// 1. Get active conversation
const topics = await window.electronAPI.invoke('topics:list')
const testTopic = topics[0]

// 2. Enable sharing
const result = await window.electronAPI.invoke('feedForward:enableSharing', {
  conversationId: testTopic.id,
  enabled: true,
  retroactive: true
})

// Expected: { success: true, previousState: false }
console.log('Sharing enabled:', result)
```

### Scenario 2: Create Supply from Keywords
```javascript
// 1. Extract keywords from recent messages
const messages = await window.electronAPI.invoke('chat:getMessages', {
  topicId: testTopic.id,
  limit: 10
})

// 2. Extract keywords
const keywords = await window.electronAPI.invoke('topicAnalysis:extractKeywords', {
  text: messages.map(m => m.text).join(' ')
})

// 3. Create Supply object
const supply = await window.electronAPI.invoke('feedForward:createSupply', {
  keywords: keywords.slice(0, 5),
  contextLevel: 3,
  conversationId: testTopic.id
})

// Expected: { success: true, supplyHash: "abc123...", keywordHashes: [...] }
console.log('Supply created:', supply)
```

### Scenario 3: Create and Match Demand
```javascript
// 1. Create a Demand for knowledge
const demand = await window.electronAPI.invoke('feedForward:createDemand', {
  keywords: ['machine', 'learning', 'training'],
  urgency: 7,
  context: 'Need information about ML training techniques',
  criteria: {
    minTrust: 0.5
  }
})

// 2. Find matching Supply objects
const matches = await window.electronAPI.invoke('feedForward:matchSupplyDemand', {
  demandHash: demand.demandHash,
  minTrust: 0.3,
  limit: 5
})

// Expected: { success: true, matches: [...] }
console.log('Found matches:', matches)
```

### Scenario 4: Check Trust Score
```javascript
// 1. Get current user's trust score
const me = await window.electronAPI.invoke('onecore:getMe')
const trustInfo = await window.electronAPI.invoke('feedForward:getTrustScore', {
  participantId: me.personId
})

// Expected: { score: 0.65, components: {...}, history: [...] }
console.log('My trust score:', trustInfo)

// 2. Update trust after successful exchange
const update = await window.electronAPI.invoke('feedForward:updateTrust', {
  participantId: me.personId,
  adjustment: 0.05,
  reason: 'Provided accurate information',
  evidence: { matchQuality: 0.9 }
})

// Expected: { success: true, newScore: 0.7, components: {...} }
console.log('Updated score:', update)
```

### Scenario 5: Stream Training Corpus
```javascript
// 1. Get recent corpus entries
const corpus = await window.electronAPI.invoke('feedForward:getCorpusStream', {
  since: Date.now() - 86400000, // Last 24 hours
  minQuality: 0.6
})

// Expected: { success: true, entries: [...], hasMore: true, nextCursor: "..." }
console.log('Corpus entries:', corpus.entries.length)

// 2. Examine entry structure
const entry = corpus.entries[0]
console.log('Entry structure:', {
  conversationId: entry.conversationId,
  messageCount: entry.messages.length,
  keywords: entry.keywords.length,
  qualityScore: entry.qualityScore
})
```

## Verification Steps

### 1. Verify Supply Creation
```bash
# Count Supply objects created
npm run test:integration -- --grep "Supply creation"

# Expected output:
# ✓ creates Supply with keyword hashes
# ✓ validates context levels
# ✓ links to conversation
```

### 2. Verify Demand Matching
```bash
# Test matching algorithm
npm run test:integration -- --grep "Supply-Demand matching"

# Expected output:
# ✓ matches based on keyword overlap
# ✓ applies trust weighting
# ✓ respects match criteria
```

### 3. Verify Trust Calculation
```bash
# Test trust scoring
npm run test:integration -- --grep "Trust score"

# Expected output:
# ✓ calculates initial trust score
# ✓ updates based on interactions
# ✓ weights components correctly
```

### 4. Verify Corpus Generation
```bash
# Test corpus entry creation
npm run test:integration -- --grep "Training corpus"

# Expected output:
# ✓ sanitizes message content
# ✓ preserves attribution
# ✓ calculates quality scores
```

## Performance Validation

### Load Test
```javascript
// Generate 100 Supply objects
async function loadTest() {
  const start = Date.now()
  const promises = []

  for (let i = 0; i < 100; i++) {
    promises.push(
      window.electronAPI.invoke('feedForward:createSupply', {
        keywords: [`keyword${i}`, `test${i}`],
        contextLevel: Math.floor(Math.random() * 5) + 1,
        conversationId: testTopic.id
      })
    )
  }

  await Promise.all(promises)
  const elapsed = Date.now() - start

  console.log(`Created 100 Supply objects in ${elapsed}ms`)
  console.log(`Average: ${elapsed/100}ms per Supply`)

  // Expected: < 50ms average
  return elapsed / 100 < 50
}
```

## External API Test (for LLM Providers)

### Get API Key
```bash
# Request API key for testing
curl -X POST https://api.lama.network/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"organization": "TestOrg", "email": "test@example.com"}'
```

### Stream Training Data
```bash
# Get corpus stream
curl -X GET "https://api.lama.network/v1/corpus/stream?min_quality=0.6&limit=10" \
  -H "X-API-Key: YOUR_API_KEY"

# Expected response:
# {
#   "entries": [...],
#   "has_more": true,
#   "next_cursor": "...",
#   "metadata": {
#     "total_entries": 1234,
#     "quality_distribution": {...}
#   }
# }
```

## Troubleshooting

### Issue: "Feed-forward manager not initialized"
**Solution**: Ensure Node ONE.core is initialized first
```javascript
await window.electronAPI.invoke('onecore:initializeNode', credentials)
```

### Issue: Low trust scores
**Solution**: Verify identity and build history
```javascript
// Verify identity increases trust
await window.electronAPI.invoke('onecore:verifyIdentity')
```

### Issue: No Supply-Demand matches
**Solution**: Check keyword overlap
```javascript
// Get Supply keywords
const supplies = await window.electronAPI.invoke('feedForward:listSupplies')
console.log('Available keywords:', supplies.map(s => s.keywords).flat())
```

### Issue: Corpus entries missing
**Solution**: Check sharing settings
```javascript
// Verify sharing is enabled
const settings = await window.electronAPI.invoke('feedForward:getSharingSettings', {
  conversationId: testTopic.id
})
console.log('Sharing enabled:', settings.enabled)
```

## Success Criteria

✅ **Phase 1**: Supply/Demand objects created and stored
✅ **Phase 2**: Keywords extracted and hashed
✅ **Phase 3**: Trust scores calculated and applied
✅ **Phase 4**: Corpus entries generated with quality scores
✅ **Phase 5**: External API serving training data

## Next Steps

1. Monitor corpus growth: `npm run monitor:corpus`
2. Review trust score distribution: `npm run analyze:trust`
3. Optimize keyword extraction: `npm run benchmark:keywords`
4. Test federation with other LAMA instances
5. Set up continuous corpus quality monitoring