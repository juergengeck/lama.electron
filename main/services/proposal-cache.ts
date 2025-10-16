/**
 * ProposalCache Class
 * LRU cache for proposal results with TTL
 *
 * Reference: /specs/019-above-the-chat/research.md lines 88-157
 */

import type { Proposal } from './proposal-engine.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

interface CacheEntry {
  proposals: Proposal[];
  timestamp: number;
}

export class ProposalCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttl: number; // Time-to-live in milliseconds

  /**
   * Create a new ProposalCache
   *
   * @param maxSize - Maximum number of entries (default: 50)
   * @param ttl - Time-to-live in milliseconds (default: 60000 = 60 seconds)
   */
  constructor(maxSize: number = 50, ttl: number = 60000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Get cached proposals for a topic and current subjects
   *
   * @param topicId - Topic ID
   * @param currentSubjects - Array of current subject ID hashes
   * @returns Cached proposals or null if not found/expired
   */
  get(topicId: string, currentSubjects: SHA256IdHash<any>[]): Proposal[] | null {
    const key = this.cacheKey(topicId, currentSubjects);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.proposals;
  }

  /**
   * Store proposals in cache
   *
   * @param topicId - Topic ID
   * @param currentSubjects - Array of current subject ID hashes
   * @param proposals - Proposals to cache
   */
  set(topicId: string, currentSubjects: SHA256IdHash<any>[], proposals: Proposal[]): void {
    const key = this.cacheKey(topicId, currentSubjects);

    // LRU eviction: Remove oldest entry if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      proposals,
      timestamp: Date.now(),
    });
  }

  /**
   * Invalidate all cache entries for a specific topic
   *
   * @param topicId - Topic ID to invalidate
   */
  invalidate(topicId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(topicId)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Generate cache key from topic ID and current subjects
   *
   * @param topicId - Topic ID
   * @param currentSubjects - Array of current subject ID hashes
   * @returns Cache key
   */
  private cacheKey(topicId: string, currentSubjects: SHA256IdHash<any>[]): string {
    // Sort subject IDs for consistent keys
    const subjectIds = currentSubjects.map((s) => String(s)).sort();
    return `${topicId}:${subjectIds.join(',')}`;
  }
}
