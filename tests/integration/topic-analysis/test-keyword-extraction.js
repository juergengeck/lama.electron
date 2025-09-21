/**
 * Integration Test: Keyword extraction accuracy
 * Tests that keywords are accurately extracted and processed
 */

import { expect } from 'chai';

describe('Integration: Keyword extraction accuracy', () => {
  it('should extract meaningful keywords from technical text', async () => {
    const technicalText = `
      Artificial intelligence and machine learning are transforming education.
      Natural language processing enables personalized learning experiences.
      Deep learning algorithms can assess student progress automatically.
    `;

    const response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', {
      text: technicalText,
      maxKeywords: 10
    });

    expect(response.success).to.be.true;
    const keywords = response.data.keywords;

    // Should extract key technical terms
    const expectedTerms = ['artificial intelligence', 'machine learning', 'education',
                          'natural language processing', 'deep learning'];

    const foundTerms = expectedTerms.filter(term =>
      keywords.some(kw => kw.toLowerCase().includes(term) || term.includes(kw.toLowerCase()))
    );

    expect(foundTerms).to.have.length.at.least(3);

    // Should not include stop words
    const stopWords = ['the', 'are', 'can', 'and', 'a', 'an'];
    keywords.forEach(keyword => {
      expect(stopWords).to.not.include(keyword.toLowerCase());
    });
  });

  it('should handle multi-language keywords', async () => {
    const multilingualText = `
      Education for niños and enfants requires special attention.
      Bildung and éducation are fundamental rights.
      学習 (learning) and 教育 (education) transform lives.
    `;

    const response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', {
      text: multilingualText,
      maxKeywords: 8
    });

    expect(response.success).to.be.true;
    const keywords = response.data.keywords;

    // Should include English terms
    const hasEducation = keywords.some(kw => kw.toLowerCase().includes('education'));
    expect(hasEducation).to.be.true;

    // Might include non-English terms (depending on LLM capabilities)
    // At minimum, shouldn't break on non-ASCII characters
    expect(keywords).to.be.an('array');
    expect(keywords.length).to.be.at.most(8);
  });

  it('should extract compound keywords', async () => {
    const text = `
      Machine learning algorithms require big data processing.
      Cloud computing platforms enable distributed computing.
      Software engineering best practices improve code quality.
    `;

    const response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', {
      text: text,
      maxKeywords: 10
    });

    expect(response.success).to.be.true;
    const keywords = response.data.keywords;

    // Should recognize compound terms
    const compoundTerms = ['machine learning', 'big data', 'cloud computing',
                          'distributed computing', 'software engineering'];

    const foundCompounds = compoundTerms.filter(term =>
      keywords.some(kw => kw.toLowerCase() === term)
    );

    expect(foundCompounds).to.have.length.at.least(2);
  });

  it('should provide relevance scores', async () => {
    const text = `
      Education education education. This text is primarily about education.
      Technology is mentioned once. Education appears frequently.
    `;

    const response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', {
      text: text,
      maxKeywords: 5
    });

    expect(response.success).to.be.true;

    if (response.data.scores) {
      const scores = response.data.scores;

      // Education should have high score due to frequency
      if (scores['education']) {
        expect(scores['education']).to.be.at.least(0.7);
      }

      // Technology should have lower score
      if (scores['technology']) {
        expect(scores['technology']).to.be.lessThan(scores['education']);
      }

      // All scores should be between 0 and 1
      Object.values(scores).forEach(score => {
        expect(score).to.be.at.least(0);
        expect(score).to.be.at.most(1);
      });
    }
  });

  it('should avoid redundant keywords', async () => {
    const text = `
      Educational technology and education tech are similar.
      Teaching and teachers work with students and student groups.
      Learning and learners benefit from personalized learning experiences.
    `;

    const response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', {
      text: text,
      maxKeywords: 10
    });

    expect(response.success).to.be.true;
    const keywords = response.data.keywords;

    // Should avoid very similar terms
    const hasEducation = keywords.some(kw => kw.toLowerCase().includes('education'));
    const hasEducational = keywords.some(kw => kw.toLowerCase() === 'educational');

    // Shouldn't have both 'education' and 'educational' as separate keywords
    if (hasEducation && hasEducational) {
      // If both exist, they should be part of compound terms
      const educationKw = keywords.find(kw => kw.toLowerCase().includes('education'));
      expect(educationKw).to.include.oneOf(['technology', 'tech']);
    }

    // Shouldn't have both singular and plural of same word
    const hasStudent = keywords.some(kw => kw.toLowerCase() === 'student');
    const hasStudents = keywords.some(kw => kw.toLowerCase() === 'students');
    expect(hasStudent && hasStudents).to.be.false;
  });

  it('should respect existing keywords to avoid duplication', async () => {
    const text = 'Advanced machine learning and artificial intelligence in education';
    const existingKeywords = ['machine learning', 'education', 'technology'];

    const response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', {
      text: text,
      existingKeywords: existingKeywords,
      maxKeywords: 5
    });

    expect(response.success).to.be.true;
    const keywords = response.data.keywords;

    // Should extract new keywords like 'artificial intelligence'
    const hasAI = keywords.some(kw =>
      kw.toLowerCase().includes('artificial') || kw.toLowerCase().includes('intelligence')
    );
    expect(hasAI).to.be.true;

    // Shouldn't duplicate exact matches of existing keywords
    const duplicates = keywords.filter(kw =>
      existingKeywords.includes(kw.toLowerCase())
    );
    expect(duplicates).to.have.length(0);
  });

  it('should handle edge cases gracefully', async () => {
    // Very short text
    let response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', {
      text: 'AI',
      maxKeywords: 5
    });
    expect(response.success).to.be.true;
    expect(response.data.keywords).to.have.length.at.most(1);

    // Text with only stop words
    response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', {
      text: 'the and or but if then else',
      maxKeywords: 5
    });
    expect(response.success).to.be.true;
    expect(response.data.keywords).to.have.length(0);

    // Text with special characters
    response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', {
      text: 'C++ programming, .NET framework, Node.js development',
      maxKeywords: 5
    });
    expect(response.success).to.be.true;
    expect(response.data.keywords).to.include.oneOf(['C++', 'programming', '.NET', 'Node.js']);

    // Very long text (performance test)
    const longText = 'education technology '.repeat(500); // 1000 words
    const startTime = Date.now();

    response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', {
      text: longText,
      maxKeywords: 10
    });

    const duration = Date.now() - startTime;
    expect(response.success).to.be.true;
    expect(duration).to.be.lessThan(500); // Should complete within 500ms
  });

  it('should extract keywords suitable for subject identification', async () => {
    // Simulate extracting keywords from actual conversation messages
    const conversationSnippets = [
      'Children need quality education',
      'Foreign students require language support',
      'Educational technology benefits everyone'
    ];

    const allKeywords = [];

    for (const snippet of conversationSnippets) {
      const response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', {
        text: snippet,
        maxKeywords: 3
      });

      expect(response.success).to.be.true;
      allKeywords.push(...response.data.keywords);
    }

    // Keywords should be suitable for creating subject IDs
    allKeywords.forEach(keyword => {
      // Should be non-empty
      expect(keyword).to.have.length.at.least(2);

      // Should be reasonable length for ID component
      expect(keyword).to.have.length.at.most(30);

      // Should be lowercase-able for ID generation
      expect(() => keyword.toLowerCase()).to.not.throw();
    });

    // Should create distinct combinations
    const keywordSet = new Set(allKeywords.map(k => k.toLowerCase()));
    expect(keywordSet.size).to.be.at.least(5);
  });

  it('should fail until implementation is complete', async () => {
    const response = await window.electronAPI.invoke('topicAnalysis:extractKeywords', {
      text: 'Test text for keyword extraction'
    });

    // Should fail with "not yet implemented" until we implement the handler
    expect(response.success).to.be.false;
    expect(response.error).to.include('not yet implemented');
  });
});