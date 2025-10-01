# Phase 0: Research and Analysis

## Executive Summary
The Feed-Forward Training Infrastructure can be built largely on existing LAMA components. We have keyword extraction, basic trust management, and IPC handlers already in place. The main work is connecting these components with Supply/Demand object management and enhancing the trust scoring system.

## Existing Components Analysis

### 1. Keyword Extraction Infrastructure ✅
**Decision**: Reuse existing RealTimeKeywordExtractor and TopicAnalyzer
**Rationale**: Already implements sophisticated keyword extraction with stopword filtering
**Components Found**:
- `/main/core/one-ai/services/RealTimeKeywordExtractor.ts` - Real-time keyword extraction
- `/main/core/one-ai/services/TopicAnalyzer.ts` - Topic-based keyword analysis
- `/main/core/one-ai/storage/keyword-storage.ts` - Keyword persistence with SHA-256 hashing
- `/main/ipc/handlers/topic-analysis.ts` - IPC handlers for keyword operations

### 2. Feed-Forward Handler Infrastructure ✅ (Partial)
**Decision**: Extend existing feed-forward handler structure
**Rationale**: IPC handler already exists with correct architecture
**Components Found**:
- `/main/ipc/handlers/feed-forward.ts` - IPC handler skeleton exists
- `/main/core/feed-forward/` - Directory exists but manager not implemented
**Gap**: Need to implement FeedForwardManager class

### 3. Trust Management ✅ (Partial)
**Decision**: Extend ContactTrustManager with scoring algorithms
**Rationale**: Trust levels and VC infrastructure already in place
**Components Found**:
- `/main/core/contact-trust-manager.ts` - Trust levels and verification
- `/main/core/attestation-manager.ts` - Message attestation and verification
**Gap**: Need trust score calculation algorithm

### 4. Identity Management ✅
**Decision**: Use existing ONE.core identity system
**Rationale**: Cryptographic identity already implemented
**Components Used**:
- Person objects with SHA-256 ID hashes
- AI persons with isAI flag
- Keys management for signature verification

### 5. Content Addressing ✅
**Decision**: Use ONE.core's existing SHA-256 hashing
**Rationale**: Already used throughout the system
**Implementation**: `calculateHashOfObj()` from ONE.core

## Technical Clarifications Resolved

### Privacy and Consent
**Decision**: Topic-level opt-in with default privacy
**Rationale**: Aligns with existing topic-based architecture
**Implementation**:
- Add `sharingEnabled` flag to Topic objects
- Default to false (private)
- User must explicitly enable per conversation

### Trust Calculation Algorithm
**Decision**: Weighted score based on multiple factors
**Rationale**: Simple, transparent, and extensible
**Algorithm**:
```
trustScore = (
  0.3 * identityVerification +  // Has verified identity?
  0.2 * historicalAccuracy +     // Past information quality
  0.2 * peerEndorsements +        // Other users' trust
  0.2 * activityConsistency +    // Regular, non-spam behavior
  0.1 * accountAge                // Time in network
)
```

### Scale Requirements
**Decision**: Optimize for 10K concurrent users initially
**Rationale**: Realistic for initial deployment
**Targets**:
- Keyword extraction: < 100ms per message
- Supply/Demand matching: < 500ms
- Trust calculation: Cached, updated async

### Data Retention
**Decision**: 90-day rolling window for active data
**Rationale**: Balance between learning and storage
**Implementation**:
- Active corpus: 90 days
- Archived summaries: Indefinite
- User can request deletion anytime

### Access Control
**Decision**: API key-based access for consumers
**Rationale**: Simple, proven authentication method
**Implementation**:
- LLM providers register for API keys
- Rate limiting per key
- Audit trail of all access

### Compliance
**Decision**: GDPR-compliant with right to deletion
**Rationale**: Covers most jurisdictions
**Implementation**:
- Explicit consent required
- Data portability supported
- Deletion within 30 days of request

## Technology Stack Decisions

### Storage
**Decision**: ONE.core object storage
**Rationale**: Already integrated, supports versioning
**Implementation**: Supply/Demand as ONE objects

### Message Queue
**Decision**: In-memory EventEmitter initially
**Rationale**: Simple, no additional dependencies
**Future**: Can add Redis/RabbitMQ if needed

### API Protocol
**Decision**: JSON-RPC over IPC (internal), REST for external
**Rationale**: Consistent with existing architecture
**Implementation**: Express.js for external API

## Architecture Decisions

### Layer 1: Identity (Foundation)
- Use existing Person/AI Person objects
- Leverage existing Keys infrastructure
- No changes needed to core identity system

### Layer 2: Feed-Forward Supply/Demand
- Implement as ONE.core objects with recipes
- Store keyword hashes in Supply objects
- Enable recursive Supply/Demand (demands can be supply)
- Use existing IPC handler pattern

### Layer 3: Trust Networks
- Extend ContactTrustManager with scoring
- Cache trust scores with TTL
- Async trust recalculation on events
- Store trust history for audit

## Risk Mitigation

### Performance Risks
**Risk**: Keyword extraction bottleneck
**Mitigation**:
- Cache extracted keywords per message
- Batch processing for bulk operations
- Use worker threads if needed

### Security Risks
**Risk**: Spam/manipulation of trust scores
**Mitigation**:
- Rate limiting per identity
- Anomaly detection for sudden trust changes
- Require minimum account age for high trust

### Privacy Risks
**Risk**: Accidental data exposure
**Mitigation**:
- Default to private
- Explicit consent UI
- Audit all data access

## Implementation Priority

1. **Phase 1**: FeedForwardManager implementation
2. **Phase 2**: Supply/Demand object recipes and storage
3. **Phase 3**: Trust score calculation
4. **Phase 4**: External API for LLM providers
5. **Phase 5**: Federation support

## Dependencies to Add

```json
{
  "dependencies": {
    // All existing dependencies are sufficient
    // No new dependencies needed initially
  }
}
```

## Next Steps
Proceed to Phase 1: Design & Contracts with confidence that we can build on existing infrastructure.