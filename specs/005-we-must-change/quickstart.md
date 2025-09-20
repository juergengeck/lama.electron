# Quickstart: Topic Analysis with AI Assistant

## Overview
This guide demonstrates the AI-powered topic analysis feature in LAMA Electron, showing how to analyze conversations, extract keywords, and generate summaries.

## Prerequisites
- LAMA Electron running with authenticated user
- At least one conversation with 5+ messages
- AI assistant (LLM) configured and accessible

## Quick Test Scenario

### 1. Start LAMA Electron
```bash
npm run electron
```
- Log in with your credentials
- Verify ONE.core initialization in console

### 2. Create Test Conversation
Create or select a conversation with mixed topics:
```
User: "Let's discuss education for children"
AI: "Education for children is crucial..."
User: "What about education for foreigners?"
AI: "Foreign students face unique challenges..."
User: "How do children and foreigners compare in educational outcomes?"
```

### 3. Trigger Topic Analysis
The analysis should automatically trigger after 5 messages. To manually trigger:
1. Open Developer Tools (Cmd+Option+I)
2. In console, verify IPC is available:
```javascript
window.electronAPI.invoke('topicAnalysis:analyzeMessages', {
  topicId: 'current-topic-hash',
  messages: [] // Will be filled from current conversation
})
```

### 4. Verify Subject Creation
Check that distinct subjects were created:
```javascript
// Expected output:
{
  subjects: [
    {
      id: 'topic:children-education',
      keywords: ['children', 'education'],
      messageCount: 2
    },
    {
      id: 'topic:education-foreigners',
      keywords: ['education', 'foreigners'],
      messageCount: 2
    }
  ],
  keywords: ['children', 'education', 'foreigners'],
  summaryId: 'topic-hash'
}
```

### 5. View Summary
The summary should appear in the UI sidebar. Verify it contains:
- References to both subjects
- Comprehensive overview of the discussion
- List of all keywords

### 6. Test Summary Update
Add a new message to trigger summary update:
```
User: "What about technology in education?"
```

Verify:
- New subject created for "education-technology"
- Summary version incremented
- Previous version accessible in history

## Validation Checklist

### Functional Requirements
- [ ] FR-001: Multiple subjects created for different keyword combinations
- [ ] FR-002: Each subject has unique ID based on topic + keywords
- [ ] FR-003: Subjects show timestamp from latest message
- [ ] FR-004: Distinct subjects for "children+education" vs "foreigners+education"
- [ ] FR-005: Exactly one current summary per topic
- [ ] FR-006: Summary versions maintained in history
- [ ] FR-007: Summary references all subjects
- [ ] FR-008: Summary updates when new subject created
- [ ] FR-009: Summary updates when keywords change
- [ ] FR-010: Summary ID matches topic ID

### Performance Validation
- [ ] Keyword extraction < 500ms
- [ ] Summary generation < 2s
- [ ] IPC round-trip < 100ms
- [ ] UI remains responsive during analysis

### Integration Points
- [ ] IPC handlers respond correctly
- [ ] LLMManager successfully processes requests
- [ ] ONE.core objects properly stored
- [ ] UI components display summaries

## Troubleshooting

### "ONE.core not initialized"
- Ensure user is logged in
- Check Node.js console for initialization errors
- Verify IPC handlers are registered

### "Analysis failed"
- Check LLM service is running
- Verify network connectivity
- Review console for specific error messages

### "No subjects created"
- Ensure messages have sufficient content
- Check minimum message count (3) is met
- Verify keywords meet minimum length (2 chars)

### "Summary not updating"
- Check if changes meet significance threshold
- Verify new keywords were extracted
- Ensure version history isn't at limit (10)

## Advanced Testing

### Test Subject Merging
```javascript
window.electronAPI.invoke('topicAnalysis:mergeSubjects', {
  topicId: 'topic-hash',
  subjectId1: 'topic:children-education',
  subjectId2: 'topic:education-kids',
  newKeywords: ['children', 'education', 'youth']
})
```

### Test Keyword Extraction
```javascript
window.electronAPI.invoke('topicAnalysis:extractKeywords', {
  text: 'Advanced machine learning techniques in education',
  maxKeywords: 5
})
```

### View Version History
```javascript
window.electronAPI.invoke('topicAnalysis:getSummary', {
  topicId: 'topic-hash',
  includeHistory: true
})
```

## Expected Behaviors

### On New Message
1. Message added to conversation
2. If 5+ messages since last analysis → trigger analysis
3. Extract keywords from new content
4. Identify subject based on keywords
5. Update or create summary
6. Display updated summary in UI

### On Manual Analysis
1. User triggers analysis via UI or console
2. All messages processed
3. Subjects recreated based on full context
4. New summary version created
5. Previous version archived

### On Subject Merge
1. Two subjects selected
2. Keywords combined (duplicates removed)
3. Message counts aggregated
4. New subject created, old ones marked merged
5. Summary updated to reflect merge

## Success Criteria
✅ Test conversation analyzed successfully
✅ Multiple subjects identified
✅ Keywords extracted and stored
✅ Summary generated and displayed
✅ Version history maintained
✅ Performance targets met
✅ UI updates reflect changes
✅ No errors in console

## Next Steps
1. Test with longer conversations (50+ messages)
2. Test with multiple AI participants
3. Test concurrent analysis requests
4. Test error recovery scenarios
5. Test with different languages

---
*Quickstart for LAMA Electron v1.0.0 - Topic Analysis Feature*