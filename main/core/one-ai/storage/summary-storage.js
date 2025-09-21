/**
 * Summary Storage
 * Handles persistence and versioning of Summary objects using ONE.core versioned storage
 */

import { storeVersionedObject, getObjectByIdHash } from '@refinio/one.core/lib/storage-versioned-objects.js';

import Summary from '../models/Summary.js';

class SummaryStorage {
  constructor(nodeOneCore) {
    this.nodeOneCore = nodeOneCore;
    this.maxVersions = 10; // Keep last 10 versions
    this.retentionDays = 30; // Keep versions for 30 days
  }

  /**
   * Store a summary using ONE.core versioned storage
   */
  async store(summary) {
    if (!this.nodeOneCore?.initialized) {
      throw new Error('ONE.core not initialized');
    }

    // Update hash with final data
    summary.hash = summary.calculateHash();

    const objectData = summary.toObject();

    // Store using ONE.core versioned storage with SummaryRecipe
    // ONE.core handles versioning automatically based on the ID property
    const result = await storeVersionedObject(objectData);

    console.log(`[SummaryStorage] Stored summary version ${summary.version} with hash ${result.hash}`);

    console.log(`[SummaryStorage] Stored summary v${summary.version} for topic ${summary.topic}`);
    return summary;
  }

  /**
   * Get current summary for a topic
   */
  async getCurrent(topicId) {
    if (!this.nodeOneCore?.initialized) {
      throw new Error('ONE.core not initialized');
    }

    const currentKey = this.currentPrefix + topicId;

    try {
      const objectData = await this.nodeOneCore.retrieveObject(currentKey);
      if (objectData) {
        return Summary.fromObject(objectData);
      }
    } catch (error) {
      console.error(`[SummaryStorage] Error retrieving current summary for ${topicId}:`, error);
    }

    return null;
  }

  /**
   * Get specific version of a summary
   */
  async getVersion(topicId, version) {
    if (!this.nodeOneCore?.initialized) {
      throw new Error('ONE.core not initialized');
    }

    // Check if it's the current version
    const current = await this.getCurrent(topicId);
    if (current && current.version === version) {
      return current;
    }

    // Look in history
    const historyKey = `${this.historyPrefix}${topicId}:v${version}`;

    try {
      const objectData = await this.nodeOneCore.retrieveObject(historyKey);
      if (objectData) {
        return Summary.fromObject(objectData);
      }
    } catch (error) {
      console.error(`[SummaryStorage] Error retrieving version ${version} for ${topicId}:`, error);
    }

    return null;
  }

  /**
   * Get version history for a topic
   */
  async getHistory(topicId, includeContent = true) {
    if (!this.nodeOneCore?.initialized) {
      throw new Error('ONE.core not initialized');
    }

    const history = [];

    // Get current
    const current = await this.getCurrent(topicId);
    if (current) {
      history.push(includeContent ? current : current.getMetadata());
    }

    // Get historical versions
    const historyPrefix = `${this.historyPrefix}${topicId}:`;
    const historyKeys = await this.nodeOneCore.listObjects(historyPrefix);

    for (const key of historyKeys) {
      try {
        const objectData = await this.nodeOneCore.retrieveObject(key);
        if (objectData) {
          const summary = Summary.fromObject(objectData);
          history.push(includeContent ? summary : summary.getMetadata());
        }
      } catch (error) {
        console.error(`[SummaryStorage] Error retrieving history ${key}:`, error);
      }
    }

    // Sort by version (descending)
    history.sort((a, b) => b.version - a.version);

    return history;
  }

  /**
   * Archive a version to history
   */
  async archiveVersion(summary) {
    const historyKey = `${this.historyPrefix}${summary.topic}:v${summary.version}`;
    const archiveData = summary.toArchive();

    await this.nodeOneCore.storeObject(historyKey, archiveData);
    console.log(`[SummaryStorage] Archived summary v${summary.version} for topic ${summary.topic}`);
  }

  /**
   * Update summary content (creates new version)
   */
  async update(topicId, content, changeReason = '') {
    const current = await this.getCurrent(topicId);

    let newSummary;
    if (current) {
      // Create new version
      newSummary = current.createNewVersion(content, changeReason);
    } else {
      // Create first version
      newSummary = new Summary({
        id: topicId,
        topic: topicId,
        content,
        version: 1,
        changeReason
      });
    }

    return this.store(newSummary);
  }

  /**
   * Prune old versions beyond retention limits
   * Optimized to batch deletions and run asynchronously
   */
  async pruneVersions(topicId) {
    const history = await this.getHistory(topicId, false); // Get metadata only

    // Keep only maxVersions
    if (history.length > this.maxVersions) {
      const versionsToPrune = history.slice(this.maxVersions);
      const deletePromises = [];

      for (const versionMeta of versionsToPrune) {
        // Check if it's old enough to prune
        const ageDays = (Date.now() - versionMeta.createdAt) / (1000 * 60 * 60 * 24);

        if (ageDays > this.retentionDays || history.length > this.maxVersions * 2) {
          const historyKey = `${this.historyPrefix}${topicId}:v${versionMeta.version}`;
          deletePromises.push(
            this.nodeOneCore.deleteObject(historyKey)
              .then(() => console.log(`[SummaryStorage] Pruned summary v${versionMeta.version} for topic ${topicId}`))
              .catch(err => console.error(`[SummaryStorage] Failed to prune v${versionMeta.version}:`, err))
          );
        }
      }

      // Execute deletions in parallel for better performance
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }
    }
  }

  /**
   * Delete all summaries for a topic
   */
  async deleteAll(topicId) {
    if (!this.nodeOneCore?.initialized) {
      throw new Error('ONE.core not initialized');
    }

    // Delete current
    const currentKey = this.currentPrefix + topicId;
    await this.nodeOneCore.deleteObject(currentKey);

    // Delete all history
    const historyPrefix = `${this.historyPrefix}${topicId}:`;
    const historyKeys = await this.nodeOneCore.listObjects(historyPrefix);

    for (const key of historyKeys) {
      await this.nodeOneCore.deleteObject(key);
    }

    console.log(`[SummaryStorage] Deleted all summaries for topic ${topicId}`);
  }

  /**
   * Check if summary needs update
   */
  async needsUpdate(topicId, newSubjects, threshold = 0.2) {
    const current = await this.getCurrent(topicId);
    if (!current) return true;

    // Check if subjects changed significantly
    const oldSubjectSet = new Set(current.subjects);
    const newSubjectSet = new Set(newSubjects.map(s => s.id));

    const added = Array.from(newSubjectSet).filter(s => !oldSubjectSet.has(s));
    const removed = Array.from(oldSubjectSet).filter(s => !newSubjectSet.has(s));

    return added.length > 0 || removed.length > 1;
  }

  /**
   * Get version chain (follow previousVersion links)
   */
  async getVersionChain(topicId, startVersion = null) {
    const chain = [];
    let currentVersion = startVersion || (await this.getCurrent(topicId))?.version;

    while (currentVersion) {
      const summary = await this.getVersion(topicId, currentVersion);
      if (!summary) break;

      chain.push(summary);

      // Find previous version
      if (summary.previousVersion) {
        // Extract version number from previousVersion hash
        // This is simplified - in production you'd have a better mapping
        currentVersion = summary.version - 1;
      } else {
        break;
      }
    }

    return chain;
  }

  /**
   * Rebuild version links (for repair/migration)
   */
  async rebuildVersionLinks(topicId) {
    const history = await this.getHistory(topicId);
    history.sort((a, b) => a.version - b.version);

    for (let i = 1; i < history.length; i++) {
      const current = history[i];
      const previous = history[i - 1];

      current.previousVersion = previous.hash;
      await this.nodeOneCore.storeObject(
        current.version === history[history.length - 1].version
          ? this.currentPrefix + topicId
          : `${this.historyPrefix}${topicId}:v${current.version}`,
        current.toObject()
      );
    }

    console.log(`[SummaryStorage] Rebuilt version links for topic ${topicId}`);
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    const currentKeys = await this.nodeOneCore.listObjects(this.currentPrefix);
    const historyKeys = await this.nodeOneCore.listObjects(this.historyPrefix);

    const topicCount = currentKeys.length;
    const totalVersions = historyKeys.length;
    const averageVersionsPerTopic = topicCount > 0 ? totalVersions / topicCount : 0;

    // Calculate storage size (simplified)
    let totalSize = 0;
    for (const key of [...currentKeys, ...historyKeys]) {
      try {
        const obj = await this.nodeOneCore.retrieveObject(key);
        if (obj) {
          totalSize += JSON.stringify(obj).length;
        }
      } catch (error) {
        // Skip errors
      }
    }

    return {
      topics: topicCount,
      totalVersions,
      averageVersionsPerTopic,
      totalSizeBytes: totalSize,
      maxVersionsPerTopic: this.maxVersions,
      retentionDays: this.retentionDays
    };
  }

  /**
   * Export summaries for backup
   */
  async export(topicId = null) {
    const exported = {};

    if (topicId) {
      // Export single topic
      const current = await this.getCurrent(topicId);
      const history = await this.getHistory(topicId);

      exported[topicId] = {
        current: current?.toObject(),
        history: history.map(s => s.toObject())
      };
    } else {
      // Export all topics
      const currentKeys = await this.nodeOneCore.listObjects(this.currentPrefix);

      for (const key of currentKeys) {
        const topicId = key.replace(this.currentPrefix, '');
        const current = await this.getCurrent(topicId);
        const history = await this.getHistory(topicId);

        exported[topicId] = {
          current: current?.toObject(),
          history: history.map(s => s.toObject())
        };
      }
    }

    return exported;
  }

  /**
   * Import summaries from backup
   */
  async import(data) {
    for (const [topicId, topicData] of Object.entries(data)) {
      // Import history first
      if (topicData.history) {
        for (const summaryData of topicData.history) {
          const summary = Summary.fromObject(summaryData);
          if (summary.version !== topicData.current?.version) {
            await this.archiveVersion(summary);
          }
        }
      }

      // Import current
      if (topicData.current) {
        const current = Summary.fromObject(topicData.current);
        const currentKey = this.currentPrefix + topicId;
        await this.nodeOneCore.storeObject(currentKey, current.toObject());
      }
    }

    console.log(`[SummaryStorage] Imported summaries for ${Object.keys(data).length} topics`);
  }
}

export default SummaryStorage;