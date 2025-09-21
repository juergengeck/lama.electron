/**
 * Contract Test: topicAnalysis:analyzeMessages
 * Tests the message analysis IPC handler
 */

import { expect } from 'chai';
import { ipcRenderer } from 'electron';

describe('IPC: topicAnalysis:analyzeMessages', () => {
  it('should analyze messages and extract subjects', async () => {
    const request = {
      topicId: 'test-topic-123',
      messages: [
        { id: 'msg1', text: 'Let\'s discuss education for children', sender: 'user1', timestamp: Date.now() },
        { id: 'msg2', text: 'Children need quality education', sender: 'ai', timestamp: Date.now() },
        { id: 'msg3', text: 'What about education for foreigners?', sender: 'user1', timestamp: Date.now() },
        { id: 'msg4', text: 'Foreign students face unique challenges', sender: 'ai', timestamp: Date.now() }
      ]
    };

    const response = await window.electronAPI.invoke('topicAnalysis:analyzeMessages', request);

    expect(response.success).to.be.true;
    expect(response.data).to.exist;
    expect(response.data.subjects).to.be.an('array');
    expect(response.data.subjects.length).to.be.at.least(2);

    // Should create distinct subjects for different keyword combinations
    const childrenEducation = response.data.subjects.find(s =>
      s.keywords.includes('children') && s.keywords.includes('education')
    );
    expect(childrenEducation).to.exist;
    expect(childrenEducation.id).to.equal('test-topic-123:children-education');

    const foreignersEducation = response.data.subjects.find(s =>
      s.keywords.includes('foreigners') && s.keywords.includes('education')
    );
    expect(foreignersEducation).to.exist;
    expect(foreignersEducation.id).to.equal('test-topic-123:education-foreigners');

    expect(response.data.keywords).to.be.an('array');
    expect(response.data.summaryId).to.be.a('string');
  });

  it('should handle force reanalysis', async () => {
    const request = {
      topicId: 'test-topic-456',
      forceReanalysis: true
    };

    const response = await window.electronAPI.invoke('topicAnalysis:analyzeMessages', request);

    expect(response.success).to.be.true;
    expect(response.data).to.exist;
    expect(response.data.subjects).to.be.an('array');
  });

  it('should fail when ONE.core is not initialized', async () => {
    // This test assumes we can test without ONE.core initialized
    const request = {
      topicId: 'test-topic-789',
      messages: []
    };

    const response = await window.electronAPI.invoke('topicAnalysis:analyzeMessages', request);

    // Should fail until implementation is complete
    expect(response.success).to.be.false;
    expect(response.error).to.include('not yet implemented');
  });
});