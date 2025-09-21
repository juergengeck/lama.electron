/**
 * Contract Test: topicAnalysis:updateSummary
 * Tests creating and updating summaries with versioning
 */

import { expect } from 'chai';

describe('IPC: topicAnalysis:updateSummary', () => {
  it('should create a new summary for a topic', async () => {
    const request = {
      topicId: 'test-topic-new',
      content: 'This conversation covers education topics including children and foreigners.',
      changeReason: 'Initial summary creation'
    };

    const response = await window.electronAPI.invoke('topicAnalysis:updateSummary', request);

    expect(response.success).to.be.true;
    expect(response.data).to.exist;
    expect(response.data.summary).to.exist;

    const summary = response.data.summary;
    expect(summary.$type$).to.equal('Summary');
    expect(summary.id).to.equal('test-topic-new');
    expect(summary.content).to.equal(request.content);
    expect(summary.version).to.equal(1);
    expect(summary.changeReason).to.equal('Initial summary creation');
    expect(summary.previousVersion).to.be.undefined;
  });

  it('should update existing summary with new version', async () => {
    const request = {
      topicId: 'test-topic-existing',
      content: 'Updated summary with new insights about technology in education.',
      changeReason: 'New subject added: technology'
    };

    const response = await window.electronAPI.invoke('topicAnalysis:updateSummary', request);

    expect(response.success).to.be.true;
    expect(response.data.summary).to.exist;

    const summary = response.data.summary;
    expect(summary.version).to.be.greaterThan(1);
    expect(summary.content).to.equal(request.content);
    expect(summary.changeReason).to.equal('New subject added: technology');
    expect(summary.previousVersion).to.be.a('string');
    expect(response.data.previousVersion).to.equal(summary.previousVersion);
  });

  it('should link to previous version', async () => {
    // First update
    const request1 = {
      topicId: 'test-topic-versioning',
      content: 'Version 1 content',
      changeReason: 'Initial'
    };
    await window.electronAPI.invoke('topicAnalysis:updateSummary', request1);

    // Second update
    const request2 = {
      topicId: 'test-topic-versioning',
      content: 'Version 2 content',
      changeReason: 'Updated'
    };
    const response2 = await window.electronAPI.invoke('topicAnalysis:updateSummary', request2);

    expect(response2.success).to.be.true;
    expect(response2.data.summary.version).to.equal(2);
    expect(response2.data.summary.previousVersion).to.be.a('string');

    // Third update
    const request3 = {
      topicId: 'test-topic-versioning',
      content: 'Version 3 content',
      changeReason: 'Further updated'
    };
    const response3 = await window.electronAPI.invoke('topicAnalysis:updateSummary', request3);

    expect(response3.success).to.be.true;
    expect(response3.data.summary.version).to.equal(3);
    expect(response3.data.summary.previousVersion).to.equal(response2.data.summary.id);
  });

  it('should maintain maximum 10 versions', async () => {
    const topicId = 'test-topic-max-versions';

    // Create 12 versions
    for (let i = 1; i <= 12; i++) {
      await window.electronAPI.invoke('topicAnalysis:updateSummary', {
        topicId,
        content: `Version ${i} content`,
        changeReason: `Update ${i}`
      });
    }

    // Check that only 10 versions are retained
    const historyResponse = await window.electronAPI.invoke('topicAnalysis:getSummary', {
      topicId,
      includeHistory: true
    });

    expect(historyResponse.data.history.length).to.equal(10);
    expect(historyResponse.data.current.version).to.equal(12);
    // Oldest version should be 3 (1 and 2 pruned)
    const oldestVersion = Math.min(...historyResponse.data.history.map(s => s.version));
    expect(oldestVersion).to.equal(3);
  });

  it('should validate required fields', async () => {
    const request = {
      topicId: 'test-topic-validation',
      // Missing content
    };

    const response = await window.electronAPI.invoke('topicAnalysis:updateSummary', request);

    expect(response.success).to.be.false;
    expect(response.error).to.exist;
  });

  it('should fail until implementation is complete', async () => {
    const request = {
      topicId: 'test-topic',
      content: 'Test content'
    };

    const response = await window.electronAPI.invoke('topicAnalysis:updateSummary', request);

    // Should fail with "not yet implemented" until we implement the handler
    expect(response.success).to.be.false;
    expect(response.error).to.include('not yet implemented');
  });
});