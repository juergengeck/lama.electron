/**
 * Keyword Storage
 * Handles persistence and indexing of Keyword objects using ONE.core versioned storage
 */

import { storeVersionedObject, getObjectByIdHash } from '@refinio/one.core/lib/storage-versioned-objects.js';

import Keyword from '../models/Keyword.js';

class KeywordStorage {
  constructor(nodeOneCore) {
    this.nodeOneCore = nodeOneCore;
  }

  /**
   * Store a keyword using ONE.core versioned storage
   */
  async store(keyword) {
    if (!this.nodeOneCore?.initialized) {
      throw new Error('ONE.core not initialized');
    }

    const objectData = keyword.toObject();

    // Store using ONE.core versioned storage with KeywordRecipe
    const result = await storeVersionedObject(objectData);

    console.log(`[KeywordStorage] Stored keyword "${keyword.text}" with hash ${result.hash}`);
    return { keyword, hash: result.hash, idHash: result.idHash };
  }

  /**
   * Retrieve a keyword by ID hash using ONE.core versioned storage
   */
  async get(keywordIdHash) {
    if (!this.nodeOneCore?.initialized) {
      throw new Error('ONE.core not initialized');
    }

    try {
      const result = await getObjectByIdHash(keywordIdHash);
      if (result && result.obj) {
        return Keyword.fromObject(result.obj);
      }
    } catch (error) {
      console.error(`[KeywordStorage] Error retrieving keyword ${keywordIdHash}:`, error);
    }

    return null;
  }

  /**
   * Find keyword by text
   */
  async findByText(text) {
    const normalized = Keyword.normalize(text);
    const tempKeyword = new Keyword({ text: normalized });
    const keywordId = tempKeyword.id;

    return this.get(keywordId);
  }

  /**
   * Get or create keyword
   */
  async getOrCreate(text) {
    let keyword = await this.findByText(text);

    if (!keyword) {
      keyword = new Keyword({ text });
      await this.store(keyword);
    }

    return keyword;
  }

  /**
   * Update keyword frequency
   */
  async incrementFrequency(text) {
    const keyword = await this.getOrCreate(text);
    keyword.incrementFrequency();
    await this.store(keyword);
    return keyword;
  }

  /**
   * Get keywords for subjects
   */
  async getForSubjects(subjectIds) {
    const keywords = [];
    const allKeys = await this.nodeOneCore.listObjects(this.storagePrefix);

    for (const key of allKeys) {
      const keyword = await this.get(key.replace(this.storagePrefix, ''));
      if (keyword && keyword.subjects.some(sid => subjectIds.includes(sid))) {
        keywords.push(keyword);
      }
    }

    return keywords.sort((a, b) => b.getWeight() - a.getWeight());
  }

  /**
   * Get top keywords by frequency
   */
  async getTopKeywords(limit = 20, minFrequency = 2) {
    const keywords = [];
    const allKeys = await this.nodeOneCore.listObjects(this.storagePrefix);

    for (const key of allKeys) {
      const keyword = await this.get(key.replace(this.storagePrefix, ''));
      if (keyword && keyword.frequency >= minFrequency) {
        keywords.push(keyword);
      }
    }

    return keywords
      .sort((a, b) => b.getWeight() - a.getWeight())
      .slice(0, limit);
  }

  /**
   * Search keywords by partial match
   */
  async search(query, limit = 10) {
    const normalized = query.toLowerCase();
    const results = [];
    const allKeys = await this.nodeOneCore.listObjects(this.storagePrefix);

    for (const key of allKeys) {
      const keyword = await this.get(key.replace(this.storagePrefix, ''));
      if (keyword && keyword.text.toLowerCase().includes(normalized)) {
        results.push(keyword);
      }
    }

    return results
      .sort((a, b) => {
        // Prioritize exact matches
        const aExact = a.text.toLowerCase() === normalized;
        const bExact = b.text.toLowerCase() === normalized;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Then sort by weight
        return b.getWeight() - a.getWeight();
      })
      .slice(0, limit);
  }

  /**
   * Find similar keywords
   */
  async findSimilar(text, threshold = 0.8) {
    const targetKeyword = new Keyword({ text });
    const similar = [];
    const allKeys = await this.nodeOneCore.listObjects(this.storagePrefix);

    for (const key of allKeys) {
      const keyword = await this.get(key.replace(this.storagePrefix, ''));
      if (keyword && keyword.isSimilarTo(targetKeyword, threshold)) {
        similar.push(keyword);
      }
    }

    return similar.sort((a, b) => b.getWeight() - a.getWeight());
  }

  /**
   * Merge similar keywords
   */
  async mergeSimilar(threshold = 0.9) {
    const allKeys = await this.nodeOneCore.listObjects(this.storagePrefix);
    const keywords = [];

    for (const key of allKeys) {
      const keyword = await this.get(key.replace(this.storagePrefix, ''));
      if (keyword) {
        keywords.push(keyword);
      }
    }

    const merged = [];
    const processed = new Set();

    for (let i = 0; i < keywords.length; i++) {
      if (processed.has(keywords[i].id)) continue;

      const similar = [];
      for (let j = i + 1; j < keywords.length; j++) {
        if (keywords[i].isSimilarTo(keywords[j], threshold)) {
          similar.push(keywords[j]);
          processed.add(keywords[j].id);
        }
      }

      if (similar.length > 0) {
        // Merge all similar keywords into the first one
        for (const simKeyword of similar) {
          keywords[i].merge(simKeyword);
          await this.delete(simKeyword.id);
        }
        await this.store(keywords[i]);
        merged.push({
          kept: keywords[i],
          merged: similar.map(k => k.text)
        });
      }

      processed.add(keywords[i].id);
    }

    console.log(`[KeywordStorage] Merged ${merged.length} groups of similar keywords`);
    return merged;
  }

  /**
   * Update keyword index for fast lookup
   */
  async updateIndex(keyword) {
    // Create index entries for different lookup patterns
    const indexEntries = [
      // By first letter
      `${this.indexPrefix}letter:${keyword.text[0].toLowerCase()}`,
      // By word count
      `${this.indexPrefix}words:${keyword.getWords().length}`,
      // By compound status
      `${this.indexPrefix}compound:${keyword.isCompound()}`
    ];

    for (const indexKey of indexEntries) {
      const index = await this.nodeOneCore.retrieveObject(indexKey) || [];
      if (!index.includes(keyword.id)) {
        index.push(keyword.id);
        await this.nodeOneCore.storeObject(indexKey, index);
      }
    }
  }

  /**
   * Get keywords by index
   */
  async getByIndex(indexType, indexValue) {
    const indexKey = `${this.indexPrefix}${indexType}:${indexValue}`;
    const keywordIds = await this.nodeOneCore.retrieveObject(indexKey) || [];
    const keywords = [];

    for (const id of keywordIds) {
      const keyword = await this.get(id);
      if (keyword) {
        keywords.push(keyword);
      }
    }

    return keywords;
  }

  /**
   * Delete a keyword
   */
  async delete(keywordId) {
    if (!this.nodeOneCore?.initialized) {
      throw new Error('ONE.core not initialized');
    }

    const storageKey = this.storagePrefix + keywordId;

    try {
      await this.nodeOneCore.deleteObject(storageKey);
      console.log(`[KeywordStorage] Deleted keyword ${keywordId}`);
      return true;
    } catch (error) {
      console.error(`[KeywordStorage] Error deleting keyword ${keywordId}:`, error);
      return false;
    }
  }

  /**
   * Clean up old keywords
   */
  async cleanup(daysToKeep = 30, minFrequency = 2) {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const allKeys = await this.nodeOneCore.listObjects(this.storagePrefix);
    let deletedCount = 0;

    for (const key of allKeys) {
      const keyword = await this.get(key.replace(this.storagePrefix, ''));
      if (keyword) {
        const shouldDelete = keyword.lastSeen < cutoffTime ||
                           (keyword.frequency < minFrequency && keyword.getAgeDays() > 7);

        if (shouldDelete) {
          await this.delete(keyword.id);
          deletedCount++;
        }
      }
    }

    console.log(`[KeywordStorage] Cleaned up ${deletedCount} old keywords`);
    return deletedCount;
  }

  /**
   * Batch store multiple keywords
   */
  async storeMany(keywords) {
    const results = [];

    for (const keyword of keywords) {
      try {
        const stored = await this.store(keyword);
        results.push(stored);
      } catch (error) {
        console.error(`[KeywordStorage] Error storing keyword ${keyword.text}:`, error);
      }
    }

    return results;
  }

  /**
   * Associate keyword with subject
   */
  async addToSubject(keywordText, subjectId) {
    const keyword = await this.getOrCreate(keywordText);
    keyword.addSubject(subjectId);
    await this.store(keyword);
    return keyword;
  }

  /**
   * Remove keyword from subject
   */
  async removeFromSubject(keywordText, subjectId) {
    const keyword = await this.findByText(keywordText);
    if (keyword) {
      keyword.removeSubject(subjectId);

      // Delete keyword if no longer associated with any subjects
      if (keyword.subjects.length === 0) {
        await this.delete(keyword.id);
      } else {
        await this.store(keyword);
      }
    }
  }

  /**
   * Get keyword cloud data
   */
  async getCloudData(limit = 50) {
    const keywords = await this.getTopKeywords(limit);

    // Calculate relative sizes for cloud visualization
    const maxWeight = Math.max(...keywords.map(k => k.getWeight()));

    return keywords.map(keyword => ({
      text: keyword.text,
      size: Math.ceil((keyword.getWeight() / maxWeight) * 10), // Size 1-10
      frequency: keyword.frequency,
      score: keyword.score,
      subjects: keyword.subjects.length
    }));
  }

  /**
   * Get trending keywords (recently increasing in frequency)
   */
  async getTrending(windowDays = 7, minIncrease = 2) {
    const windowStart = Date.now() - (windowDays * 24 * 60 * 60 * 1000);
    const trending = [];
    const allKeys = await this.nodeOneCore.listObjects(this.storagePrefix);

    for (const key of allKeys) {
      const keyword = await this.get(key.replace(this.storagePrefix, ''));
      if (keyword && keyword.lastSeen > windowStart) {
        // Simple trending: keywords with recent activity and decent frequency
        if (keyword.frequency >= minIncrease) {
          trending.push(keyword);
        }
      }
    }

    return trending
      .sort((a, b) => {
        // Sort by recency and frequency
        const aRecency = (Date.now() - a.lastSeen) / (1000 * 60 * 60);
        const bRecency = (Date.now() - b.lastSeen) / (1000 * 60 * 60);
        const aScore = a.frequency / (aRecency + 1);
        const bScore = b.frequency / (bRecency + 1);
        return bScore - aScore;
      })
      .slice(0, 10);
  }

  /**
   * Get statistics
   */
  async getStats() {
    const allKeys = await this.nodeOneCore.listObjects(this.storagePrefix);
    const keywords = [];
    let totalFrequency = 0;
    let compoundCount = 0;

    for (const key of allKeys) {
      const keyword = await this.get(key.replace(this.storagePrefix, ''));
      if (keyword) {
        keywords.push(keyword);
        totalFrequency += keyword.frequency;
        if (keyword.isCompound()) compoundCount++;
      }
    }

    const uniqueSubjects = new Set(keywords.flatMap(k => k.subjects));

    return {
      totalKeywords: keywords.length,
      totalFrequency,
      averageFrequency: keywords.length > 0 ? totalFrequency / keywords.length : 0,
      compoundKeywords: compoundCount,
      simpleKeywords: keywords.length - compoundCount,
      uniqueSubjects: uniqueSubjects.size,
      topKeyword: keywords.sort((a, b) => b.frequency - a.frequency)[0]?.text || null
    };
  }
}

export default KeywordStorage;