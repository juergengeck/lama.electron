/**
 * Context Enrichment Service
 * Uses keywords to dynamically retrieve relevant context from content-addressed storage
 * Following the principle: "context is easily shared based on context"
 */

// SHA256Hash would be imported from ONE.core, but the path doesn't exist
// For now we'll work with string hashes directly

export class ContextEnrichmentService {
  constructor(channelManager, topicAnalysisModel) {
    this.channelManager = channelManager;
    this.topicAnalysisModel = topicAnalysisModel;

    // Cache for keyword->content mappings
    this.keywordIndex = new Map();
    this.contextCache = new Map();
  }

  /**
   * Extract context hints without explicit prompting
   * Returns relevant patterns based on current keywords
   */
  async getImplicitContext(topicId, currentMessage) {
    try {
      // Extract keywords from current message
      const messageKeywords = this.extractKeywords(currentMessage);

      // Get existing keywords for this topic
      const topicKeywords = await this.topicAnalysisModel.getKeywords(topicId);

      // Find resonant patterns - keywords that connect to other contexts
      const resonantPatterns = await this.findResonantPatterns(
        messageKeywords,
        topicKeywords
      );

      // Get current summary if exists
      const currentSummary = await this.topicAnalysisModel.getCurrentSummary(topicId);

      // Build minimal context object - not for prompting, but for pattern matching
      return {
        keywords: [...messageKeywords, ...topicKeywords.map(k => k.term)].slice(0, 10),
        patterns: resonantPatterns,
        abstraction: currentSummary ? this.abstractSummary(currentSummary) : null,
        depth: this.calculateContextDepth(resonantPatterns)
      };
    } catch (error) {
      console.error('[ContextEnrichment] Error getting implicit context:', error);
      return {
        keywords: [],
        patterns: [],
        abstraction: null,
        depth: 0
      };
    }
  }

  /**
   * Find patterns that resonate across different contexts
   * Uses SHA256 addresses to navigate content space
   */
  async findResonantPatterns(currentKeywords, historicalKeywords) {
    const patterns = [];

    for (const keyword of currentKeywords) {
      // Look for this keyword in other topics
      const relatedObjects = await this.searchByKeyword(keyword);

      for (const obj of relatedObjects) {
        // Get the content hash
        const hash = await this.getContentHash(obj);

        // Check if this pattern resonates (appears in multiple contexts)
        const resonance = this.calculateResonance(obj, historicalKeywords);

        if (resonance > 0.3) {
          patterns.push({
            hash: hash.toString(),
            keyword,
            resonance,
            type: obj.$type$,
            abstract: this.createAbstract(obj)
          });
        }
      }
    }

    // Sort by resonance, keep top patterns
    return patterns
      .sort((a, b) => b.resonance - a.resonance)
      .slice(0, 5);
  }

  /**
   * Search for objects containing a keyword
   * Uses content-addressed storage for efficient retrieval
   */
  async searchByKeyword(keyword) {
    const results = [];

    // Search across all channels for objects with this keyword
    const channels = await this.channelManager.getChannels();

    for (const channel of channels) {
      // Get Keyword objects
      const keywords = await this.channelManager.getObjectsWithType('Keyword', {
        channelId: channel.id
      });

      // Find matching keywords
      const matches = keywords.filter(k =>
        k.term.toLowerCase().includes(keyword.toLowerCase())
      );

      // Get associated subjects
      for (const match of matches) {
        const subjects = await this.channelManager.getObjectsWithType('Subject', {
          channelId: channel.id
        });

        const relatedSubjects = subjects.filter(s =>
          s.keywords.some(k => k.toLowerCase() === match.term.toLowerCase())
        );

        results.push(...relatedSubjects);
      }
    }

    return results;
  }

  /**
   * Calculate how strongly a pattern resonates with historical context
   */
  calculateResonance(obj, historicalKeywords) {
    if (!obj.keywords) return 0;

    const historicalTerms = new Set(historicalKeywords.map(k => k.term.toLowerCase()));
    const objectTerms = obj.keywords.map(k => k.toLowerCase());

    let matches = 0;
    for (const term of objectTerms) {
      if (historicalTerms.has(term)) {
        matches++;
      }
    }

    return matches / Math.max(objectTerms.length, 1);
  }

  /**
   * Create a minimal abstract of an object
   * Reduces to essential pattern, not full content
   */
  createAbstract(obj) {
    if (obj.$type$ === 'Subject') {
      return `${obj.keywordCombination}: ${obj.description?.substring(0, 50)}`;
    }
    if (obj.$type$ === 'Summary') {
      return obj.content?.substring(0, 100);
    }
    if (obj.$type$ === 'Keyword') {
      return obj.term;
    }
    return null;
  }

  /**
   * Abstract a summary to its essential pattern
   */
  abstractSummary(summary) {
    if (!summary) return null;

    return {
      version: summary.version,
      pattern: summary.content?.substring(0, 150),
      keywords: summary.keywords?.slice(0, 5) || []
    };
  }

  /**
   * Calculate context depth (0 to 42)
   * Higher numbers = more abstract/philosophical
   */
  calculateContextDepth(patterns) {
    if (patterns.length === 0) return 0;

    // Average resonance * 42 (the answer to everything)
    const avgResonance = patterns.reduce((sum, p) => sum + p.resonance, 0) / patterns.length;
    return Math.min(42, Math.floor(avgResonance * 42));
  }

  /**
   * Extract keywords from text without LLM
   * Simple but effective for real-time context
   */
  extractKeywords(text) {
    if (!text) return [];

    // Remove common words
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are',
      'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do',
      'does', 'did', 'will', 'would', 'could', 'should', 'may',
      'might', 'must', 'can', 'shall', 'to', 'of', 'in', 'for',
      'with', 'from', 'up', 'about', 'into', 'through', 'during'
    ]);

    const words = text.toLowerCase()
      .split(/\W+/)
      .filter(word =>
        word.length > 3 &&
        !stopWords.has(word) &&
        !word.match(/^\d+$/)
      );

    // Count frequency
    const frequency = new Map();
    for (const word of words) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }

    // Return top keywords by frequency
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Get content hash for an object
   */
  async getContentHash(obj) {
    const content = JSON.stringify(obj);
    return SHA256Hash.create(content);
  }

  /**
   * Build enhanced context for LLM without explicit prompting
   * Returns subtle context hints rather than full history
   */
  async buildEnhancedContext(topicId, messages) {
    const recentMessage = messages[messages.length - 1]?.content || '';

    // Get implicit context patterns
    const context = await this.getImplicitContext(topicId, recentMessage);

    // Build subtle context hints
    const hints = [];

    if (context.keywords.length > 0) {
      hints.push(`[Active concepts: ${context.keywords.slice(0, 5).join(', ')}]`);
    }

    if (context.abstraction) {
      hints.push(`[Context depth: ${context.depth}/42]`);
    }

    if (context.patterns.length > 0) {
      const topPattern = context.patterns[0];
      hints.push(`[Resonant pattern: ${topPattern.keyword} (${Math.round(topPattern.resonance * 100)}%)]`);
    }

    // Return as a subtle system message
    return hints.length > 0 ? hints.join('\n') : null;
  }
}

export default ContextEnrichmentService;