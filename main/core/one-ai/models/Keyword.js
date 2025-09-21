/**
 * Keyword Model for ONE.core
 * Represents an extracted keyword with frequency and relationships
 */

import { storeUnversionedObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';

/**
 * Create a Keyword object using ONE.core unversioned storage
 */
export async function createKeyword(
  term,
  category = null,
  frequency = 1,
  score = 0,
  subjects = []
) {
  const keyword = {
    $type$: 'Keyword',
    term: term.toLowerCase().trim(),
    category,
    frequency,
    score,
    lastSeen: Date.now(),
    subjects // Array of SHA256Hash<Subject>
  };

  return await storeUnversionedObject(keyword);
}

/**
 * Normalize keyword term for consistent storage
 */
export function normalizeKeywordTerm(text) {
  if (!text) {
    throw new Error('Text is required for Keyword');
  }
  return text.toLowerCase().trim();
}

  /**
   * Increment frequency when keyword appears again
   */
  incrementFrequency() {
    this.frequency++;
    this.lastSeen = Date.now();
  }

  /**
   * Add association with a subject
   */
  addSubject(subjectId) {
    if (!this.subjects.includes(subjectId)) {
      this.subjects.push(subjectId);
    }
  }

  /**
   * Remove association with a subject
   */
  removeSubject(subjectId) {
    this.subjects = this.subjects.filter(id => id !== subjectId);
  }

  /**
   * Update relevance score
   */
  updateScore(newScore) {
    if (newScore < 0 || newScore > 1) {
      throw new Error('Score must be between 0 and 1');
    }
    this.score = newScore;
  }

  /**
   * Check if keyword is still relevant
   * (Based on frequency and recency)
   */
  isRelevant(thresholdDays = 30) {
    const daysSinceLastSeen = (Date.now() - this.lastSeen) / (1000 * 60 * 60 * 24);
    return daysSinceLastSeen < thresholdDays && this.frequency > 1;
  }

  /**
   * Normalize keyword text for comparison
   */
  static normalize(text) {
    return text.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Check if two keywords are similar
   */
  isSimilarTo(otherKeyword, threshold = 0.8) {
    const normalized1 = Keyword.normalize(this.text);
    const normalized2 = Keyword.normalize(otherKeyword.text);

    // Simple similarity check - could be enhanced with better algorithms
    if (normalized1 === normalized2) return true;

    // Check if one contains the other
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return true;
    }

    // Check Levenshtein distance for typos
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    const similarity = 1 - (distance / maxLength);

    return similarity >= threshold;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Merge another keyword into this one
   */
  merge(otherKeyword) {
    // Combine frequencies
    this.frequency += otherKeyword.frequency;

    // Combine subjects (deduplicate)
    const combinedSubjects = new Set([...this.subjects, ...otherKeyword.subjects]);
    this.subjects = Array.from(combinedSubjects);

    // Average scores
    this.score = (this.score + otherKeyword.score) / 2;

    // Use most recent last seen
    this.lastSeen = Math.max(this.lastSeen, otherKeyword.lastSeen);

    return this;
  }

  /**
   * Convert to plain object for storage
   */
  toObject() {
    return {
      $type$: this.$type$,
      id: this.id,
      text: this.text,
      frequency: this.frequency,
      subjects: this.subjects,
      score: this.score,
      createdAt: this.createdAt,
      lastSeen: this.lastSeen
    };
  }

  /**
   * Create Keyword from plain object
   */
  static fromObject(obj) {
    if (obj.$type$ !== 'Keyword') {
      throw new Error('Invalid object type for Keyword');
    }
    return new Keyword(obj);
  }

  /**
   * Get weight based on frequency and score
   */
  getWeight() {
    return this.frequency * this.score;
  }

  /**
   * Check if keyword is a compound term
   */
  isCompound() {
    return this.text.includes(' ') || this.text.includes('-');
  }

  /**
   * Get individual words from compound keyword
   */
  getWords() {
    return this.text.split(/[\s-]+/).filter(w => w.length > 0);
  }
}

export default Keyword;