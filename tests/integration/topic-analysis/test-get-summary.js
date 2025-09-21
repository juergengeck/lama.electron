/**
 * Contract Test: topicAnalysis:getSummary
 * Tests retrieving summaries with version history
 */

import { expect } from 'chai';

describe('IPC: topicAnalysis:getSummary', () => {
  it('should retrieve current summary for a topic', async () => {
    const request = {
      topicId: 'test-topic-123'
    };

    const response = await window.electronAPI.invoke('topicAnalysis:getSummary', request);

    expect(response.success).to.be.true;
    expect(response.data).to.exist;
    expect(response.data.current).to.exist;

    const summary = response.data.current;
    expect(summary.$type$).to.equal('Summary');
    expect(summary.id).to.equal('test-topic-123');
    expect(summary.topic).to.equal('test-topic-123');
    expect(summary.content).to.be.a('string');
    expect(summary.subjects).to.be.an('array');
    expect(summary.keywords).to.be.an('array');
    expect(summary.version).to.be.a('number');
    expect(summary.createdAt).to.be.a('number');
    expect(summary.updatedAt).to.be.a('number');
  });

  it('should retrieve specific version when requested', async () => {
    const request = {
      topicId: 'test-topic-456',
      version: 2
    };

    const response = await window.electronAPI.invoke('topicAnalysis:getSummary', request);

    expect(response.success).to.be.true;
    expect(response.data.current).to.exist;
    expect(response.data.current.version).to.equal(2);
  });

  it('should include version history when requested', async () => {
    const request = {
      topicId: 'test-topic-789',
      includeHistory: true
    };

    const response = await window.electronAPI.invoke('topicAnalysis:getSummary', request);

    expect(response.success).to.be.true;
    expect(response.data.current).to.exist;
    expect(response.data.history).to.be.an('array');

    // History should be ordered by version (descending)
    if (response.data.history.length > 1) {
      for (let i = 0; i < response.data.history.length - 1; i++) {
        expect(response.data.history[i].version).to.be.greaterThan(
          response.data.history[i + 1].version
        );
      }
    }

    // Each historical summary should have previousVersion link
    response.data.history.forEach((summary, index) => {
      if (index < response.data.history.length - 1) {
        expect(summary.previousVersion).to.be.a('string');
      }
    });
  });

  it('should return null for non-existent topic', async () => {
    const request = {
      topicId: 'non-existent-topic'
    };

    const response = await window.electronAPI.invoke('topicAnalysis:getSummary', request);

    expect(response.success).to.be.true;
    expect(response.data.current).to.be.null;
  });

  it('should limit history to 10 versions', async () => {
    const request = {
      topicId: 'test-topic-many-versions',
      includeHistory: true
    };

    const response = await window.electronAPI.invoke('topicAnalysis:getSummary', request);

    expect(response.success).to.be.true;
    if (response.data.history) {
      expect(response.data.history.length).to.be.at.most(10);
    }
  });

  it('should fail until implementation is complete', async () => {
    const request = {
      topicId: 'test-topic'
    };

    const response = await window.electronAPI.invoke('topicAnalysis:getSummary', request);

    // Should fail with "not yet implemented" until we implement the handler
    expect(response.success).to.be.false;
    expect(response.error).to.include('not yet implemented');
  });
});