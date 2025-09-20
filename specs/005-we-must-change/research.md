# Research: Topic-Subject-Summary Data Model with AI Integration

## Research Overview
This document consolidates research findings for implementing AI-powered topic analysis in LAMA Electron, focusing on resolving the NEEDS CLARIFICATION items from the specification.

## Key Decisions

### 1. Subject Creation Triggers
**Decision**: Hybrid approach - AI automatic detection with user override
**Rationale**:
- AI automatically identifies subjects during message processing for seamless UX
- Users can manually create/merge/split subjects for accuracy
- Balances automation with user control
**Alternatives considered**:
- Fully automatic: Rejected due to potential inaccuracies
- Fully manual: Rejected due to poor UX and missed insights

### 2. Keyword Extraction Method
**Decision**: LLM-based extraction with frequency analysis
**Rationale**:
- Leverage existing LLMManager for context-aware extraction
- Use prompt engineering for consistent keyword quality
- Frequency tracking helps identify importance
**Alternatives considered**:
- TF-IDF: Too simplistic for conversational context
- Named Entity Recognition: Limited to entities, misses concepts

### 3. Summary Versioning Strategy
**Decision**: Keep last 10 versions with timestamp-based retention
**Rationale**:
- Balances history tracking with storage efficiency
- 10 versions sufficient for most conversation evolution
- Older versions auto-pruned after 30 days
**Alternatives considered**:
- Unlimited versions: Storage concerns
- Single version: No history tracking

### 4. Integration with LLMManager
**Decision**: Create TopicAnalyzer service as LLMManager client
**Rationale**:
- Reuses existing AI infrastructure
- Consistent prompt handling across LAMA
- Supports multiple LLM providers
**Alternatives considered**:
- Direct LLM API calls: Duplicates existing functionality
- Separate AI service: Unnecessary complexity

## Technical Specifications

### Keyword Extraction Parameters
- **Minimum keyword length**: 2 characters
- **Maximum keywords per subject**: 10
- **Keyword relevance threshold**: 0.3 (normalized score)
- **Update trigger**: Every 5 new messages or manual request

### Summary Generation Rules
- **Minimum message count**: 3 messages to generate summary
- **Maximum summary length**: 500 words
- **Update frequency**: On subject/keyword changes
- **Version comparison**: Semantic similarity < 0.8 triggers new version

### Subject Identification Logic
- **Distinct subject threshold**: < 0.5 keyword overlap
- **Merge candidates**: > 0.8 keyword overlap
- **Timestamp update**: Latest message timestamp used
- **ID generation**: `${topicId}:${keywords.sort().join('-')}`

## Implementation Patterns

### ONE.core Object Storage
```javascript
// Subject stored as ONE.core object
const subject = {
  $type$: 'Subject',
  topic: topicHash,
  keywords: ['education', 'children'],
  timestamp: Date.now(),
  messageCount: 15,
  lastAnalyzed: Date.now()
};

// Summary with versioning
const summary = {
  $type$: 'Summary',
  topic: topicHash,
  version: 3,
  subjects: [subjectHash1, subjectHash2],
  content: 'Summary text...',
  created: Date.now(),
  previousVersion: summaryHashV2
};
```

### IPC Handler Pattern
```javascript
// Following LAMA's existing pattern
async function analyzeMessages({ topicId, messages }) {
  // Validate in Node.js
  if (!nodeOneCore.isInitialized()) {
    throw new Error('ONE.core not initialized');
  }

  // Process with AI
  const analyzer = new TopicAnalyzer(llmManager);
  const results = await analyzer.analyze(messages);

  // Store in ONE.core
  await storeAnalysisResults(results);

  // Return to UI
  return {
    subjects: results.subjects,
    keywords: results.keywords,
    summaryId: results.summaryId
  };
}
```

## Performance Considerations

### Optimization Strategies
1. **Batch processing**: Analyze messages in chunks of 10
2. **Caching**: Cache keyword extraction for identical messages
3. **Async processing**: Non-blocking IPC for UI responsiveness
4. **Incremental updates**: Only process new messages since last analysis

### Expected Performance
- Keyword extraction: 200-400ms per 10 messages
- Summary generation: 1-2s for 50 messages
- Subject identification: <100ms per analysis
- IPC round-trip: <50ms overhead

## Security & Privacy

### Data Protection
- Summaries inherit Topic access controls
- Keywords stored locally, never sent to external services without encryption
- AI processing respects user privacy settings
- No persistent storage of intermediate analysis

### Access Control Implementation
```javascript
// Subjects and Summaries use Topic's access control
const subject = {
  $type$: 'Subject',
  topic: topicHash, // Inherits access from Topic
  // ... other fields
};
```

## Testing Strategy

### Unit Test Coverage
- Keyword extraction accuracy
- Subject identification logic
- Summary versioning behavior
- IPC handler validation

### Integration Test Scenarios
- End-to-end message analysis flow
- Multi-subject conversation handling
- Summary update triggers
- LLMManager integration

### Performance Tests
- Load testing with 100+ subjects
- Concurrent analysis requests
- Memory usage monitoring
- Response time validation

## Migration & Compatibility

### Backward Compatibility
- New objects coexist with existing Topic/Message structure
- Graceful handling of topics without analysis
- Optional feature activation per conversation

### Future Enhancements
- Multi-language keyword extraction
- Sentiment analysis per subject
- Cross-topic subject linking
- Export summaries to various formats

## Conclusion

All NEEDS CLARIFICATION items have been resolved through research:
1. **Triggers**: Hybrid AI-automatic with manual override
2. **Versioning**: 10 versions with 30-day retention
3. **Storage**: No hard limit, pruning after 30 days
4. **Keywords**: Topic-unique, not globally unique
5. **Notifications**: Via existing LAMA notification system
6. **Relationships**: Linked list via previousVersion field
7. **Threshold**: <0.8 semantic similarity for new summary
8. **Concurrency**: Queue-based sequential processing
9. **Errors**: Retry with exponential backoff, user notification
10. **Access**: Inherits from parent Topic

Ready to proceed with Phase 1 design and contract generation.