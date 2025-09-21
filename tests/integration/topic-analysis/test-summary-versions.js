/**
 * Integration Test: Summary versioning
 * Tests that summary versions are properly created and maintained
 */

import { expect } from 'chai';

describe('Integration: Summary versioning', () => {
  const testTopicId = 'version-test-' + Date.now();

  it('should create version 1 on initial summary', async () => {
    const response = await window.electronAPI.invoke('topicAnalysis:updateSummary', {
      topicId: testTopicId,
      content: 'Initial summary of the conversation',
      changeReason: 'First summary'
    });

    expect(response.success).to.be.true;
    expect(response.data.summary.version).to.equal(1);
    expect(response.data.summary.previousVersion).to.be.undefined;
    expect(response.data.summary.id).to.equal(testTopicId);
  });

  it('should increment version on update', async () => {
    const response = await window.electronAPI.invoke('topicAnalysis:updateSummary', {
      topicId: testTopicId,
      content: 'Updated summary with new information',
      changeReason: 'New subjects identified'
    });

    expect(response.success).to.be.true;
    expect(response.data.summary.version).to.equal(2);
    expect(response.data.summary.previousVersion).to.be.a('string');
    expect(response.data.previousVersion).to.equal(response.data.summary.previousVersion);
  });

  it('should maintain version history chain', async () => {
    // Create multiple versions
    for (let i = 3; i <= 5; i++) {
      await window.electronAPI.invoke('topicAnalysis:updateSummary', {
        topicId: testTopicId,
        content: `Version ${i} summary content`,
        changeReason: `Update ${i}`
      });
    }

    // Get history
    const historyResponse = await window.electronAPI.invoke('topicAnalysis:getSummary', {
      topicId: testTopicId,
      includeHistory: true
    });

    expect(historyResponse.success).to.be.true;
    expect(historyResponse.data.current.version).to.equal(5);
    expect(historyResponse.data.history).to.have.length(5);

    // Verify chain integrity
    const versions = historyResponse.data.history;
    for (let i = 0; i < versions.length - 1; i++) {
      const current = versions[i];
      const previous = versions[i + 1];

      // Each version should link to the previous
      if (current.version > 1) {
        expect(current.previousVersion).to.be.a('string');
        // The previousVersion hash should match the previous version's hash
        // (assuming hash is derived from content + metadata)
      }

      // Versions should be in descending order
      expect(current.version).to.be.greaterThan(previous.version);
    }
  });

  it('should retrieve specific version', async () => {
    const response = await window.electronAPI.invoke('topicAnalysis:getSummary', {
      topicId: testTopicId,
      version: 3
    });

    expect(response.success).to.be.true;
    expect(response.data.current.version).to.equal(3);
    expect(response.data.current.content).to.equal('Version 3 summary content');
    expect(response.data.current.changeReason).to.equal('Update 3');
  });

  it('should preserve timestamps across versions', async () => {
    const historyResponse = await window.electronAPI.invoke('topicAnalysis:getSummary', {
      topicId: testTopicId,
      includeHistory: true
    });

    const versions = historyResponse.data.history;

    // Each version should have creation and update timestamps
    versions.forEach(version => {
      expect(version.createdAt).to.be.a('number');
      expect(version.updatedAt).to.be.a('number');
      expect(version.createdAt).to.be.at.most(version.updatedAt);
    });

    // Newer versions should have later timestamps
    for (let i = 0; i < versions.length - 1; i++) {
      expect(versions[i].createdAt).to.be.at.least(versions[i + 1].createdAt);
    }
  });

  it('should prune old versions beyond limit', async () => {
    const pruneTopicId = 'prune-test-' + Date.now();

    // Create 15 versions
    for (let i = 1; i <= 15; i++) {
      await window.electronAPI.invoke('topicAnalysis:updateSummary', {
        topicId: pruneTopicId,
        content: `Version ${i} content for pruning test`,
        changeReason: `Update ${i}`
      });
    }

    // Check that only 10 are retained
    const historyResponse = await window.electronAPI.invoke('topicAnalysis:getSummary', {
      topicId: pruneTopicId,
      includeHistory: true
    });

    expect(historyResponse.success).to.be.true;
    expect(historyResponse.data.current.version).to.equal(15);
    expect(historyResponse.data.history).to.have.length(10);

    // Should keep versions 6-15 (latest 10)
    const versions = historyResponse.data.history.map(s => s.version);
    expect(Math.min(...versions)).to.equal(6);
    expect(Math.max(...versions)).to.equal(15);
  });

  it('should update summary when subjects change', async () => {
    const subjectTopicId = 'subject-update-test-' + Date.now();

    // Initial analysis
    await window.electronAPI.invoke('topicAnalysis:analyzeMessages', {
      topicId: subjectTopicId,
      messages: [
        { id: 'msg1', text: 'Discussion about education', sender: 'user', timestamp: Date.now() - 1000 },
        { id: 'msg2', text: 'Education is important', sender: 'ai', timestamp: Date.now() - 900 }
      ]
    });

    // Get initial summary version
    const initialSummary = await window.electronAPI.invoke('topicAnalysis:getSummary', {
      topicId: subjectTopicId
    });
    const initialVersion = initialSummary.data.current?.version || 0;

    // Add messages with new subject
    await window.electronAPI.invoke('topicAnalysis:analyzeMessages', {
      topicId: subjectTopicId,
      messages: [
        { id: 'msg3', text: 'Now let\'s discuss technology', sender: 'user', timestamp: Date.now() - 500 },
        { id: 'msg4', text: 'Technology transforms education', sender: 'ai', timestamp: Date.now() - 400 }
      ]
    });

    // Summary should be updated
    const updatedSummary = await window.electronAPI.invoke('topicAnalysis:getSummary', {
      topicId: subjectTopicId
    });

    expect(updatedSummary.data.current.version).to.be.greaterThan(initialVersion);
    expect(updatedSummary.data.current.subjects).to.have.length.at.least(2);
  });

  it('should track change reasons in version history', async () => {
    const reasonTopicId = 'reason-test-' + Date.now();

    const reasons = [
      'Initial conversation summary',
      'Added discussion about technology',
      'Expanded on education topics',
      'Merged similar subjects',
      'Refined after user feedback'
    ];

    // Create versions with specific reasons
    for (let i = 0; i < reasons.length; i++) {
      await window.electronAPI.invoke('topicAnalysis:updateSummary', {
        topicId: reasonTopicId,
        content: `Summary version ${i + 1}`,
        changeReason: reasons[i]
      });
    }

    // Get history
    const historyResponse = await window.electronAPI.invoke('topicAnalysis:getSummary', {
      topicId: reasonTopicId,
      includeHistory: true
    });

    // Verify all change reasons are preserved
    const historyReasons = historyResponse.data.history.map(s => s.changeReason);
    reasons.forEach(reason => {
      expect(historyReasons).to.include(reason);
    });
  });

  it('should handle concurrent updates gracefully', async () => {
    const concurrentTopicId = 'concurrent-test-' + Date.now();

    // Create initial version
    await window.electronAPI.invoke('topicAnalysis:updateSummary', {
      topicId: concurrentTopicId,
      content: 'Initial version',
      changeReason: 'Start'
    });

    // Attempt concurrent updates
    const promises = [];
    for (let i = 1; i <= 5; i++) {
      promises.push(
        window.electronAPI.invoke('topicAnalysis:updateSummary', {
          topicId: concurrentTopicId,
          content: `Concurrent update ${i}`,
          changeReason: `Concurrent ${i}`
        })
      );
    }

    const results = await Promise.allSettled(promises);

    // All should complete (success or controlled failure)
    results.forEach(result => {
      expect(result.status).to.be.oneOf(['fulfilled', 'rejected']);
    });

    // Final version should be consistent
    const finalSummary = await window.electronAPI.invoke('topicAnalysis:getSummary', {
      topicId: concurrentTopicId,
      includeHistory: true
    });

    expect(finalSummary.success).to.be.true;
    expect(finalSummary.data.current).to.exist;

    // Version numbers should be sequential (no gaps or duplicates)
    const versions = finalSummary.data.history.map(s => s.version).sort((a, b) => a - b);
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]).to.equal(versions[i - 1] + 1);
    }
  });

  it('should fail until implementation is complete', async () => {
    const response = await window.electronAPI.invoke('topicAnalysis:updateSummary', {
      topicId: 'test-topic',
      content: 'Test content'
    });

    // Should fail with "not yet implemented" until we implement the handler
    expect(response.success).to.be.false;
    expect(response.error).to.include('not yet implemented');
  });
});