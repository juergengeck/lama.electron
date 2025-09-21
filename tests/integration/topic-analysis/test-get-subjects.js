/**
 * Contract Test: topicAnalysis:getSubjects
 * Tests retrieving subjects for a topic
 */

import { expect } from 'chai';

describe('IPC: topicAnalysis:getSubjects', () => {
  it('should retrieve all subjects for a topic', async () => {
    const request = {
      topicId: 'test-topic-123'
    };

    const response = await window.electronAPI.invoke('topicAnalysis:getSubjects', request);

    expect(response.success).to.be.true;
    expect(response.data).to.exist;
    expect(response.data.subjects).to.be.an('array');

    // Each subject should have required fields
    response.data.subjects.forEach(subject => {
      expect(subject.$type$).to.equal('Subject');
      expect(subject.id).to.be.a('string');
      expect(subject.topic).to.equal('test-topic-123');
      expect(subject.keywords).to.be.an('array');
      expect(subject.messageCount).to.be.a('number');
      expect(subject.timestamp).to.be.a('number');
    });
  });

  it('should filter archived subjects by default', async () => {
    const request = {
      topicId: 'test-topic-456',
      includeArchived: false
    };

    const response = await window.electronAPI.invoke('topicAnalysis:getSubjects', request);

    expect(response.success).to.be.true;
    expect(response.data.subjects).to.be.an('array');

    // Should not include archived subjects
    const hasArchived = response.data.subjects.some(s => s.archived === true);
    expect(hasArchived).to.be.false;
  });

  it('should include archived subjects when requested', async () => {
    const request = {
      topicId: 'test-topic-789',
      includeArchived: true
    };

    const response = await window.electronAPI.invoke('topicAnalysis:getSubjects', request);

    expect(response.success).to.be.true;
    expect(response.data.subjects).to.be.an('array');
    // May or may not have archived subjects, but they should be included if they exist
  });

  it('should return empty array for non-existent topic', async () => {
    const request = {
      topicId: 'non-existent-topic'
    };

    const response = await window.electronAPI.invoke('topicAnalysis:getSubjects', request);

    expect(response.success).to.be.true;
    expect(response.data.subjects).to.be.an('array');
    expect(response.data.subjects).to.have.length(0);
  });

  it('should fail until implementation is complete', async () => {
    const request = {
      topicId: 'test-topic'
    };

    const response = await window.electronAPI.invoke('topicAnalysis:getSubjects', request);

    // Should fail with "not yet implemented" until we implement the handler
    expect(response.success).to.be.false;
    expect(response.error).to.include('not yet implemented');
  });
});