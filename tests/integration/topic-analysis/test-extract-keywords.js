/**
 * Contract Test: topicAnalysis:extractKeywords
 * Tests keyword extraction from text
 */

import { expect } from 'chai';

describe('IPC: topicAnalysis:extractKeywords', () => {
  it('should extract keywords from text', async () => {
    const request = {
      text: 'Advanced machine learning techniques are revolutionizing education for children and foreigners alike.',
      maxKeywords: 5
    };

    const response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', request);

    expect(response.success).to.be.true;
    expect(response.data).to.exist;
    expect(response.data.keywords).to.be.an('array');
    expect(response.data.keywords.length).to.be.at.most(5);

    // Should include important keywords
    const expectedKeywords = ['machine learning', 'education', 'children', 'foreigners'];
    const hasExpectedKeywords = expectedKeywords.some(kw =>
      response.data.keywords.some(extracted =>
        extracted.toLowerCase().includes(kw.toLowerCase())
      )
    );
    expect(hasExpectedKeywords).to.be.true;

    // Should have scores if provided
    if (response.data.scores) {
      expect(response.data.scores).to.be.an('object');
      response.data.keywords.forEach(keyword => {
        expect(response.data.scores[keyword]).to.be.a('number');
        expect(response.data.scores[keyword]).to.be.at.least(0);
        expect(response.data.scores[keyword]).to.be.at.most(1);
      });
    }
  });

  it('should respect maximum keyword limit', async () => {
    const request = {
      text: 'The quick brown fox jumps over the lazy dog. This sentence contains many words that could be keywords.',
      maxKeywords: 3
    };

    const response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', request);

    expect(response.success).to.be.true;
    expect(response.data.keywords).to.have.length.at.most(3);
  });

  it('should use default maxKeywords if not specified', async () => {
    const request = {
      text: 'Education technology artificial intelligence machine learning data science programming computers software'
    };

    const response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', request);

    expect(response.success).to.be.true;
    expect(response.data.keywords).to.have.length.at.most(10); // Default is 10
  });

  it('should avoid duplicating existing keywords', async () => {
    const request = {
      text: 'Discussion about education and learning',
      existingKeywords: ['education', 'children'],
      maxKeywords: 5
    };

    const response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', request);

    expect(response.success).to.be.true;

    // Should not duplicate 'education' if it's extracted
    const educationCount = response.data.keywords.filter(
      kw => kw.toLowerCase() === 'education'
    ).length;
    expect(educationCount).to.be.at.most(1);
  });

  it('should handle empty text', async () => {
    const request = {
      text: '',
      maxKeywords: 5
    };

    const response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', request);

    expect(response.success).to.be.true;
    expect(response.data.keywords).to.be.an('array');
    expect(response.data.keywords).to.have.length(0);
  });

  it('should handle very short text', async () => {
    const request = {
      text: 'Hello',
      maxKeywords: 5
    };

    const response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', request);

    expect(response.success).to.be.true;
    expect(response.data.keywords).to.be.an('array');
    // May or may not extract keywords from single word
  });

  it('should fail until implementation is complete', async () => {
    const request = {
      text: 'Test text for keyword extraction'
    };

    const response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', request);

    // Should fail with "not yet implemented" until we implement the handler
    expect(response.success).to.be.false;
    expect(response.error).to.include('not yet implemented');
  });
});