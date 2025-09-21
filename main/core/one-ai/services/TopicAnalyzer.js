/**
 * TopicAnalyzer Service
 * Handles AI-powered analysis of topics including:
 * - Subject identification
 * - Keyword extraction
 * - Summary generation
 */

import Subject from '../models/Subject.js';
import Keyword from '../models/Keyword.js';
import Summary from '../models/Summary.js';

class TopicAnalyzer {
  constructor(llmManager) {
    this.llmManager = llmManager;
    this.keywordCache = new Map(); // Cache for keyword extraction
    this.analysisQueue = [];
    this.isProcessing = false;
    this.maxCacheSize = 100; // Limit cache size
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Analyze messages to extract subjects and keywords
   */
  async analyzeMessages(topicId, messages = [], forceReanalysis = false) {
    console.log(`[TopicAnalyzer] Analyzing ${messages.length} messages for topic ${topicId}`);

    // Clear cache if forcing reanalysis
    if (forceReanalysis) {
      this.clearCacheForTopic(topicId);
    }

    // Extract keywords from all messages
    const allKeywords = await this.extractKeywordsFromMessages(messages);

    // Identify subjects based on keyword combinations
    const subjects = this.identifySubjects(topicId, messages, allKeywords);

    // Generate or update summary
    const summary = await this.generateSummary(topicId, subjects, messages);

    return {
      subjects,
      keywords: allKeywords,
      summaryId: summary.id
    };
  }

  /**
   * Extract keywords from multiple messages
   */
  async extractKeywordsFromMessages(messages) {
    const allKeywords = new Map(); // keyword text -> Keyword object

    for (const message of messages) {
      const keywords = await this.extractKeywords(message.text);

      for (const keywordText of keywords) {
        const normalized = Keyword.normalize(keywordText);

        if (allKeywords.has(normalized)) {
          allKeywords.get(normalized).incrementFrequency();
        } else {
          allKeywords.set(normalized, new Keyword({
            text: keywordText,
            frequency: 1
          }));
        }
      }
    }

    // Calculate scores based on frequency
    const totalMessages = messages.length;
    for (const keyword of allKeywords.values()) {
      keyword.updateScore(Math.min(keyword.frequency / totalMessages, 1));
    }

    // Sort by weight and return top keywords
    return Array.from(allKeywords.values())
      .sort((a, b) => b.getWeight() - a.getWeight())
      .slice(0, 20); // Keep top 20 keywords
  }

  /**
   * Extract keywords from text using LLM
   */
  async extractKeywords(text, maxKeywords = 10, existingKeywords = []) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Check cache
    const cacheKey = `${text.substring(0, 100)}_${maxKeywords}`;
    if (this.keywordCache.has(cacheKey)) {
      this.cacheHits++;
      const cached = this.keywordCache.get(cacheKey);
      // Move to end (LRU)
      this.keywordCache.delete(cacheKey);
      this.keywordCache.set(cacheKey, cached);
      return cached;
    }
    this.cacheMisses++;

    try {
      const prompt = `Extract the most important keywords from the following text.
        Return up to ${maxKeywords} keywords or phrases that capture the main topics.
        Focus on nouns, concepts, and meaningful phrases.
        ${existingKeywords.length > 0 ? `Avoid these existing keywords: ${existingKeywords.join(', ')}` : ''}

        Text: "${text}"

        Return keywords as a JSON array of strings, e.g. ["keyword1", "keyword2", "compound keyword"]`;

      const response = await this.llmManager.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 200
      });

      // Parse response
      let keywords = [];
      try {
        // Extract JSON array from response
        const jsonMatch = response.match(/\[.*\]/s);
        if (jsonMatch) {
          keywords = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        // Fallback: split by common delimiters
        keywords = response.split(/[,\n]/)
          .map(k => k.replace(/["\[\]]/g, '').trim())
          .filter(k => k.length > 1);
      }

      // Filter out existing keywords
      if (existingKeywords.length > 0) {
        const existingSet = new Set(existingKeywords.map(k => k.toLowerCase()));
        keywords = keywords.filter(k => !existingSet.has(k.toLowerCase()));
      }

      // Limit to maxKeywords
      keywords = keywords.slice(0, maxKeywords);

      // Cache result with size limit (LRU eviction)
      if (this.keywordCache.size >= this.maxCacheSize) {
        // Remove oldest entry (first in map)
        const firstKey = this.keywordCache.keys().next().value;
        this.keywordCache.delete(firstKey);
      }
      this.keywordCache.set(cacheKey, keywords);

      return keywords;
    } catch (error) {
      console.error('[TopicAnalyzer] Error extracting keywords:', error);
      // Fallback: basic extraction
      return this.fallbackKeywordExtraction(text, maxKeywords);
    }
  }

  /**
   * Fallback keyword extraction without LLM
   */
  fallbackKeywordExtraction(text, maxKeywords = 10) {
    // Simple extraction based on word frequency
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3); // Skip short words

    const stopWords = new Set(['this', 'that', 'these', 'those', 'what', 'when', 'where',
                              'which', 'with', 'about', 'from', 'into', 'through', 'during',
                              'before', 'after', 'above', 'below', 'between', 'under']);

    const wordFreq = {};
    for (const word of words) {
      if (!stopWords.has(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    }

    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map(([word]) => word);
  }

  /**
   * Identify subjects from messages and keywords
   */
  identifySubjects(topicId, messages, keywords) {
    const subjects = new Map(); // subject ID -> Subject object

    for (const message of messages) {
      // Find keywords present in this message
      const messageKeywords = keywords.filter(kw =>
        message.text.toLowerCase().includes(kw.text.toLowerCase())
      );

      if (messageKeywords.length > 0) {
        // Create subject combinations (pairs of keywords)
        const keywordTexts = messageKeywords.map(k => k.text);

        // Single keywords and pairs
        const combinations = [
          ...keywordTexts.map(k => [k]),
          ...this.getKeywordPairs(keywordTexts)
        ];

        for (const combo of combinations) {
          const subject = new Subject({
            topic: topicId,
            keywords: combo,
            messageCount: 0,
            timestamp: message.timestamp
          });

          const subjectId = subject.id;

          if (subjects.has(subjectId)) {
            subjects.get(subjectId).addMessage(message.id, message.timestamp);
          } else {
            subject.addMessage(message.id, message.timestamp);
            subjects.set(subjectId, subject);
          }

          // Update keyword-subject associations
          for (const kw of messageKeywords) {
            if (combo.includes(kw.text)) {
              kw.addSubject(subjectId);
            }
          }
        }
      }
    }

    // Filter out subjects with too few messages
    return Array.from(subjects.values())
      .filter(s => s.isSignificant())
      .sort((a, b) => b.messageCount - a.messageCount);
  }

  /**
   * Get keyword pairs for subject identification
   */
  getKeywordPairs(keywords) {
    const pairs = [];
    for (let i = 0; i < keywords.length; i++) {
      for (let j = i + 1; j < keywords.length; j++) {
        pairs.push([keywords[i], keywords[j]].sort());
      }
    }
    return pairs;
  }

  /**
   * Generate summary for a topic
   */
  async generateSummary(topicId, subjects, messages) {
    const subjectDescriptions = subjects.map(s => s.getDescription()).join('\n');
    const messageTexts = messages.slice(-10).map(m => m.text).join('\n'); // Last 10 messages

    const prompt = `Generate a concise summary of this conversation.

Identified subjects:
${subjectDescriptions}

Recent messages:
${messageTexts}

Create a comprehensive summary that:
1. References all major subjects discussed
2. Highlights key points and conclusions
3. Maintains chronological flow
4. Is 100-200 words long

Summary:`;

    try {
      const response = await this.llmManager.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        maxTokens: 300
      });

      const summary = new Summary({
        id: topicId,
        topic: topicId,
        content: response.trim(),
        subjects: subjects.map(s => s.id),
        keywords: this.collectAllKeywords(subjects),
        version: 1,
        changeReason: 'AI-generated summary from conversation analysis'
      });

      return summary;
    } catch (error) {
      console.error('[TopicAnalyzer] Error generating summary:', error);
      // Fallback summary
      return new Summary({
        id: topicId,
        topic: topicId,
        content: `This conversation covers ${subjects.length} main topics including ${subjects.slice(0, 3).map(s => s.keywords.join(' and ')).join(', ')}.`,
        subjects: subjects.map(s => s.id),
        keywords: this.collectAllKeywords(subjects),
        version: 1,
        changeReason: 'Fallback summary'
      });
    }
  }

  /**
   * Update existing summary
   */
  async updateSummary(existingSummary, newSubjects, changeReason) {
    const subjectDescriptions = newSubjects.map(s => s.getDescription()).join('\n');

    const prompt = `Update this summary based on new subjects identified:

Current summary:
${existingSummary.content}

New/updated subjects:
${subjectDescriptions}

Reason for update: ${changeReason}

Create an updated summary that incorporates the new information while maintaining continuity.
Keep it 100-200 words.

Updated summary:`;

    try {
      const response = await this.llmManager.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        maxTokens: 300
      });

      return existingSummary.createNewVersion(
        response.trim(),
        changeReason
      );
    } catch (error) {
      console.error('[TopicAnalyzer] Error updating summary:', error);
      return existingSummary.createNewVersion(
        existingSummary.content + `\n\nUpdate: ${changeReason}`,
        changeReason
      );
    }
  }

  /**
   * Merge two subjects
   */
  async mergeSubjects(subject1, subject2, newKeywords = []) {
    const mergedSubject = subject1.merge(subject2);

    if (newKeywords.length > 0) {
      mergedSubject.keywords = newKeywords.sort();
      mergedSubject.id = mergedSubject.generateId(mergedSubject.topic, newKeywords);
    }

    // Archive old subjects
    subject1.archive();
    subject2.archive();

    return {
      mergedSubject,
      archivedSubjects: [subject1.id, subject2.id]
    };
  }

  /**
   * Collect all keywords from subjects
   */
  collectAllKeywords(subjects) {
    const allKeywords = new Set();
    for (const subject of subjects) {
      subject.keywords.forEach(k => allKeywords.add(k));
    }
    return Array.from(allKeywords).sort();
  }

  /**
   * Clear cache for a specific topic
   */
  clearCacheForTopic(topicId) {
    // Clear entries related to this topic
    for (const key of this.keywordCache.keys()) {
      if (key.includes(topicId)) {
        this.keywordCache.delete(key);
      }
    }
  }

  /**
   * Process batch of messages for better performance
   */
  async processBatch(messages, batchSize = 10) {
    console.log(`[TopicAnalyzer] Processing ${messages.length} messages in batches of ${batchSize}`);
    const results = [];
    const startTime = Date.now();

    // Process in parallel batches for better performance
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(msg => this.extractKeywords(msg.text))
      );
      results.push(...batchResults);

      // Yield to prevent blocking
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[TopicAnalyzer] Batch processing completed in ${duration}ms`);
    console.log(`[TopicAnalyzer] Cache stats - Hits: ${this.cacheHits}, Misses: ${this.cacheMisses}, Hit rate: ${(this.cacheHits / (this.cacheHits + this.cacheMisses) * 100).toFixed(2)}%`);

    return results;
  }

  /**
   * Check if analysis is needed based on message count
   */
  shouldAnalyze(messageCount, lastAnalysisMessageCount) {
    // Analyze after every 5 messages or if it's the first analysis
    return !lastAnalysisMessageCount ||
           (messageCount - lastAnalysisMessageCount) >= 5;
  }
}

export default TopicAnalyzer;