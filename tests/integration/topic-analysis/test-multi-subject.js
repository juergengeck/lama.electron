/**
 * Integration Test: Multi-subject conversation analysis
 * Tests that multiple subjects are properly identified and tracked
 */

import { expect } from 'chai';

describe('Integration: Multi-subject conversation analysis', () => {
  const testTopicId = 'multi-subject-test-' + Date.now();

  it('should identify multiple distinct subjects from a conversation', async () => {
    // Simulate a conversation with multiple topics
    const messages = [
      { id: 'msg1', text: 'Let\'s talk about education for children', sender: 'user', timestamp: Date.now() - 5000 },
      { id: 'msg2', text: 'Children education is important for development', sender: 'ai', timestamp: Date.now() - 4500 },
      { id: 'msg3', text: 'What about education for foreigners?', sender: 'user', timestamp: Date.now() - 4000 },
      { id: 'msg4', text: 'Foreign students need language support', sender: 'ai', timestamp: Date.now() - 3500 },
      { id: 'msg5', text: 'Technology can help both groups', sender: 'user', timestamp: Date.now() - 3000 },
      { id: 'msg6', text: 'Educational technology benefits everyone', sender: 'ai', timestamp: Date.now() - 2500 },
      { id: 'msg7', text: 'How do children adapt to technology?', sender: 'user', timestamp: Date.now() - 2000 },
      { id: 'msg8', text: 'Children are digital natives', sender: 'ai', timestamp: Date.now() - 1500 }
    ];

    // Analyze the messages
    const analyzeResponse = await window.electronAPI.invoke('topicAnalysis:analyzeMessages', {
      topicId: testTopicId,
      messages
    });

    expect(analyzeResponse.success).to.be.true;
    expect(analyzeResponse.data.subjects).to.have.length.at.least(3);

    // Should have distinct subjects
    const subjectKeywords = analyzeResponse.data.subjects.map(s => s.keywords.sort().join('-'));
    const uniqueSubjects = new Set(subjectKeywords);
    expect(uniqueSubjects.size).to.equal(analyzeResponse.data.subjects.length);

    // Verify specific subjects exist
    const hasChildrenEducation = analyzeResponse.data.subjects.some(s =>
      s.keywords.includes('children') && s.keywords.includes('education')
    );
    expect(hasChildrenEducation).to.be.true;

    const hasForeignersEducation = analyzeResponse.data.subjects.some(s =>
      s.keywords.includes('foreigners') && s.keywords.includes('education')
    );
    expect(hasForeignersEducation).to.be.true;

    const hasTechnologyEducation = analyzeResponse.data.subjects.some(s =>
      s.keywords.includes('technology') && s.keywords.includes('education')
    );
    expect(hasTechnologyEducation).to.be.true;
  });

  it('should track message counts per subject', async () => {
    const getSubjectsResponse = await window.electronAPI.invoke('topicAnalysis:getSubjects', {
      topicId: testTopicId
    });

    expect(getSubjectsResponse.success).to.be.true;
    const subjects = getSubjectsResponse.data.subjects;

    subjects.forEach(subject => {
      expect(subject.messageCount).to.be.at.least(1);
      expect(subject.messageCount).to.be.at.most(8); // Total messages
    });

    // Sum of message counts might exceed total due to overlap
    const totalMessageCounts = subjects.reduce((sum, s) => sum + s.messageCount, 0);
    expect(totalMessageCounts).to.be.at.least(8);
  });

  it('should generate comprehensive summary referencing all subjects', async () => {
    const getSummaryResponse = await window.electronAPI.invoke('topicAnalysis:getSummary', {
      topicId: testTopicId
    });

    expect(getSummaryResponse.success).to.be.true;
    const summary = getSummaryResponse.data.current;

    expect(summary).to.exist;
    expect(summary.subjects).to.have.length.at.least(3);

    // Summary should reference all identified subjects
    const getSubjectsResponse = await window.electronAPI.invoke('topicAnalysis:getSubjects', {
      topicId: testTopicId
    });

    const subjectIds = getSubjectsResponse.data.subjects.map(s => s.id);
    subjectIds.forEach(id => {
      expect(summary.subjects).to.include(id);
    });

    // Summary content should be comprehensive
    expect(summary.content).to.include.oneOf(['children', 'foreigners', 'technology', 'education']);
  });

  it('should update subjects when new related messages arrive', async () => {
    // Get initial subjects
    const initialSubjects = await window.electronAPI.invoke('topicAnalysis:getSubjects', {
      topicId: testTopicId
    });

    const initialChildrenSubject = initialSubjects.data.subjects.find(s =>
      s.keywords.includes('children')
    );
    const initialMessageCount = initialChildrenSubject?.messageCount || 0;

    // Add a new message about children
    const newMessage = {
      id: 'msg9',
      text: 'Children learn faster with interactive tools',
      sender: 'user',
      timestamp: Date.now()
    };

    // Re-analyze with the new message
    await window.electronAPI.invoke('topicAnalysis:analyzeMessages', {
      topicId: testTopicId,
      messages: [newMessage], // Just the new message
      forceReanalysis: false
    });

    // Get updated subjects
    const updatedSubjects = await window.electronAPI.invoke('topicAnalysis:getSubjects', {
      topicId: testTopicId
    });

    const updatedChildrenSubject = updatedSubjects.data.subjects.find(s =>
      s.keywords.includes('children')
    );

    // Message count should increase
    expect(updatedChildrenSubject.messageCount).to.be.greaterThan(initialMessageCount);
    // Timestamp should be updated
    expect(updatedChildrenSubject.timestamp).to.be.at.least(newMessage.timestamp);
  });

  it('should maintain subject relationships across analysis runs', async () => {
    // Force reanalysis
    const reanalyzeResponse = await window.electronAPI.invoke('topicAnalysis:analyzeMessages', {
      topicId: testTopicId,
      forceReanalysis: true
    });

    expect(reanalyzeResponse.success).to.be.true;

    // Subjects should remain consistent
    const subjectsAfterReanalysis = await window.electronAPI.invoke('topicAnalysis:getSubjects', {
      topicId: testTopicId
    });

    // Should still have the same core subjects
    const hasChildrenEducation = subjectsAfterReanalysis.data.subjects.some(s =>
      s.keywords.includes('children') && s.keywords.includes('education')
    );
    expect(hasChildrenEducation).to.be.true;

    const hasForeignersEducation = subjectsAfterReanalysis.data.subjects.some(s =>
      s.keywords.includes('foreigners') && s.keywords.includes('education')
    );
    expect(hasForeignersEducation).to.be.true;
  });

  it('should fail until implementation is complete', async () => {
    const response = await window.electronAPI.invoke('topicAnalysis:analyzeMessages', {
      topicId: 'test-topic',
      messages: []
    });

    // Should fail with "not yet implemented" until we implement the handler
    expect(response.success).to.be.false;
    expect(response.error).to.include('not yet implemented');
  });
});