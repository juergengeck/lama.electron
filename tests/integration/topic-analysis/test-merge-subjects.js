/**
 * Contract Test: topicAnalysis:mergeSubjects
 * Tests merging two subjects into one
 */

import { expect } from 'chai';

describe('IPC: topicAnalysis:mergeSubjects', () => {
  it('should merge two subjects into one', async () => {
    // Setup: Assume we have two similar subjects
    const request = {
      topicId: 'test-topic-123',
      subjectId1: 'test-topic-123:children-education',
      subjectId2: 'test-topic-123:education-kids',
      newKeywords: ['children', 'education', 'youth']
    };

    const response = await window.electronAPI.invoke('topicAnalysis:mergeSubjects', request);

    expect(response.success).to.be.true;
    expect(response.data).to.exist;
    expect(response.data.mergedSubject).to.exist;
    expect(response.data.archivedSubjects).to.be.an('array');

    const merged = response.data.mergedSubject;
    expect(merged.$type$).to.equal('Subject');
    expect(merged.topic).to.equal('test-topic-123');
    expect(merged.keywords).to.deep.equal(['children', 'education', 'youth']);
    expect(merged.id).to.equal('test-topic-123:children-education-youth');

    // Message count should be sum of both subjects
    expect(merged.messageCount).to.be.a('number');

    // Should archive the old subjects
    expect(response.data.archivedSubjects).to.include('test-topic-123:children-education');
    expect(response.data.archivedSubjects).to.include('test-topic-123:education-kids');
  });

  it('should use combined keywords if not specified', async () => {
    const request = {
      topicId: 'test-topic-456',
      subjectId1: 'test-topic-456:ai-technology',
      subjectId2: 'test-topic-456:artificial-intelligence'
      // No newKeywords specified
    };

    const response = await window.electronAPI.invoke('topicAnalysis:mergeSubjects', request);

    expect(response.success).to.be.true;
    const merged = response.data.mergedSubject;

    // Should combine keywords from both subjects (deduplicated and sorted)
    expect(merged.keywords).to.be.an('array');
    expect(merged.keywords).to.include.members(['ai', 'artificial', 'intelligence', 'technology']);
  });

  it('should update timestamp to latest', async () => {
    const request = {
      topicId: 'test-topic-789',
      subjectId1: 'test-topic-789:old-subject',
      subjectId2: 'test-topic-789:new-subject',
      newKeywords: ['merged', 'subject']
    };

    const response = await window.electronAPI.invoke('topicAnalysis:mergeSubjects', request);

    expect(response.success).to.be.true;
    const merged = response.data.mergedSubject;

    // Timestamp should be the latest from both subjects
    expect(merged.timestamp).to.be.a('number');
    expect(merged.timestamp).to.be.at.most(Date.now());
  });

  it('should fail if subjects belong to different topics', async () => {
    const request = {
      topicId: 'test-topic-abc',
      subjectId1: 'test-topic-abc:subject1',
      subjectId2: 'different-topic:subject2', // Different topic!
      newKeywords: ['invalid', 'merge']
    };

    const response = await window.electronAPI.invoke('topicAnalysis:mergeSubjects', request);

    expect(response.success).to.be.false;
    expect(response.error).to.include('different topic');
  });

  it('should fail if subject not found', async () => {
    const request = {
      topicId: 'test-topic-xyz',
      subjectId1: 'non-existent-subject-1',
      subjectId2: 'non-existent-subject-2',
      newKeywords: ['test']
    };

    const response = await window.electronAPI.invoke('topicAnalysis:mergeSubjects', request);

    expect(response.success).to.be.false;
    expect(response.error).to.include('not found');
  });

  it('should trigger summary update after merge', async () => {
    const request = {
      topicId: 'test-topic-summary-update',
      subjectId1: 'test-topic-summary-update:subject1',
      subjectId2: 'test-topic-summary-update:subject2',
      newKeywords: ['merged']
    };

    // Get summary version before merge
    const beforeSummary = await window.electronAPI.invoke('topicAnalysis:getSummary', {
      topicId: 'test-topic-summary-update'
    });

    const response = await window.electronAPI.invoke('topicAnalysis:mergeSubjects', request);

    expect(response.success).to.be.true;

    // Get summary after merge
    const afterSummary = await window.electronAPI.invoke('topicAnalysis:getSummary', {
      topicId: 'test-topic-summary-update'
    });

    // Summary should have been updated (version incremented)
    if (beforeSummary.data.current && afterSummary.data.current) {
      expect(afterSummary.data.current.version).to.be.greaterThan(
        beforeSummary.data.current.version
      );
    }
  });

  it('should fail until implementation is complete', async () => {
    const request = {
      topicId: 'test-topic',
      subjectId1: 'subject1',
      subjectId2: 'subject2'
    };

    const response = await window.electronAPI.invoke('topicAnalysis:mergeSubjects', request);

    // Should fail with "not yet implemented" until we implement the handler
    expect(response.success).to.be.false;
    expect(response.error).to.include('not yet implemented');
  });
});