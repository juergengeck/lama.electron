/**
 * ProposalEngine Service
 * Generates knowledge sharing proposals by matching current subjects with past subjects
 *
 * Reference: /specs/019-above-the-chat/data-model.md lines 146-190
 * Reference: /specs/019-above-the-chat/research.md lines 59-72
 */

import { getObjectByIdHash } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

export interface Proposal {
  id: string;
  pastSubject: SHA256IdHash<any>;
  currentSubject: SHA256IdHash<any>;
  matchedKeywords: string[];
  relevanceScore: number;
  sourceTopicId: string;
  pastSubjectName: string;
  createdAt: number;
}

export interface ProposalConfig {
  userEmail: string;
  matchWeight: number;
  recencyWeight: number;
  recencyWindow: number;
  minJaccard: number;
  maxProposals: number;
  updatedAt: number;
}

export interface Subject {
  $type$: 'Subject';
  id: string;
  topic: string;
  keywords: SHA256IdHash<any>[];
  timeRanges?: Array<{ start: number; end: number }>;
  messageCount?: number;
  confidence?: number;
  description?: string;
  archived?: boolean;
}

export class ProposalEngine {
  private topicAnalysisModel: any;
  private channelManager: any;

  constructor(topicAnalysisModel: any, channelManager: any) {
    this.topicAnalysisModel = topicAnalysisModel;
    this.channelManager = channelManager;
  }

  /**
   * Get proposals for a topic based on current subjects
   *
   * @param topicId - Current topic ID
   * @param currentSubjects - Array of current subject ID hashes
   * @param config - Proposal configuration
   * @param allSubjects - Optional pre-fetched array of all subjects (for performance)
   * @returns Array of proposals with matched keywords
   */
  async getProposalsForTopic(
    topicId: string,
    currentSubjects: SHA256IdHash<any>[],
    config: ProposalConfig,
    allSubjects?: Subject[]
  ): Promise<Proposal[]> {
    if (!currentSubjects || currentSubjects.length === 0) {
      return [];
    }

    // Fetch current subjects from ONE.core
    const currentSubjectObjects: Subject[] = [];
    for (const subjectIdHash of currentSubjects) {
      try {
        const result = await getObjectByIdHash(subjectIdHash);
        if (result && result.obj) {
          currentSubjectObjects.push(result.obj as Subject);
        }
      } catch (error) {
        console.error(`[ProposalEngine] Error fetching subject ${subjectIdHash}:`, error);
      }
    }

    if (currentSubjectObjects.length === 0) {
      return [];
    }

    // Fetch or use provided past subjects
    const pastSubjects = allSubjects || (await this.fetchAllSubjects());

    // Filter out subjects from same topic
    const eligiblePastSubjects = pastSubjects.filter((s) => s.topic !== topicId);

    // Generate proposals for each current subject
    const proposals: Proposal[] = [];

    console.log(`[ProposalEngine] Starting with ${currentSubjectObjects.length} current subjects, ${eligiblePastSubjects.length} eligible past subjects, minJaccard: ${config.minJaccard}`);

    for (const currentSubject of currentSubjectObjects) {
      console.log(`[ProposalEngine] Current subject "${currentSubject.id}" has ${currentSubject.keywords?.length || 0} keywords`);

      for (const pastSubject of eligiblePastSubjects) {
        console.log(`[ProposalEngine] Comparing with past subject "${pastSubject.id}" from topic "${pastSubject.topic}" (${pastSubject.keywords?.length || 0} keywords)`);

        // Resolve keyword terms from ID hashes for both subjects
        const currentKeywordTerms = await this.resolveKeywordTerms(currentSubject.keywords);
        const pastKeywordTerms = await this.resolveKeywordTerms(pastSubject.keywords);

        console.log(`[ProposalEngine] Keyword terms - Current: [${currentKeywordTerms.join(', ')}], Past: [${pastKeywordTerms.join(', ')}]`);

        // Calculate Jaccard similarity on TERMS (not hashes)
        const jaccard = this.calculateJaccardFromTerms(
          currentKeywordTerms,
          pastKeywordTerms
        );

        console.log(`[ProposalEngine] Jaccard: ${jaccard.toFixed(3)} (threshold: ${config.minJaccard}) - ${jaccard >= config.minJaccard ? 'MATCH' : 'skip'}`);

        // Skip if below threshold
        if (jaccard < config.minJaccard) {
          continue;
        }

        // Calculate recency boost
        const pastCreatedAt = pastSubject.timeRanges?.[0]?.start || 0;
        const age = Date.now() - pastCreatedAt;
        const recencyBoost = Math.max(0, 1 - age / config.recencyWindow);

        // Calculate combined relevance score
        const relevanceScore =
          jaccard * config.matchWeight + recencyBoost * config.recencyWeight;

        // Get matched keywords (intersection of terms)
        const matchedKeywords = this.getMatchedKeywordTerms(
          currentKeywordTerms,
          pastKeywordTerms
        );

        // Calculate current and past subject ID hashes
        const currentSubjectIdHash = await calculateIdHashOfObj(currentSubject as any);
        const pastSubjectIdHash = await calculateIdHashOfObj(pastSubject as any);

        const proposal: Proposal = {
          id: `prop-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          pastSubject: pastSubjectIdHash,
          currentSubject: currentSubjectIdHash,
          matchedKeywords,
          relevanceScore,
          sourceTopicId: pastSubject.topic,
          pastSubjectName: pastSubject.id || pastSubject.description || 'Unknown Subject',
          createdAt: pastCreatedAt,
        };

        proposals.push(proposal);
        console.log(`[ProposalEngine] ✅ Generated proposal: "${pastSubject.id}" -> "${currentSubject.id}" (score: ${proposal.relevanceScore.toFixed(3)}, keywords: ${matchedKeywords.length})`);
      }
    }

    console.log(`[ProposalEngine] Proposal generation complete: ${proposals.length} proposals generated`);

    return proposals;
  }

  /**
   * Resolve keyword ID hashes to actual keyword terms
   */
  private async resolveKeywordTerms(keywordIdHashes: SHA256IdHash<any>[]): Promise<string[]> {
    const terms: string[] = [];
    for (const idHash of keywordIdHashes || []) {
      try {
        const result = await getObjectByIdHash(idHash);
        if (result && result.obj && result.obj.term) {
          terms.push(result.obj.term.toLowerCase().trim());
        }
      } catch (error) {
        console.error(`[ProposalEngine] Error resolving keyword ${idHash}:`, error);
      }
    }
    return terms;
  }

  /**
   * Calculate Jaccard similarity between two sets of keyword TERMS (strings)
   * Formula: |intersection| / |union|
   */
  private calculateJaccardFromTerms(
    termsA: string[],
    termsB: string[]
  ): number {
    if (termsA.length === 0 || termsB.length === 0) {
      return 0;
    }

    const setA = new Set(termsA);
    const setB = new Set(termsB);

    // Calculate intersection
    const intersection = new Set([...setA].filter((k) => setB.has(k)));

    // Calculate union
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }

  /**
   * Get matched keyword terms (intersection of two term sets)
   */
  private getMatchedKeywordTerms(
    termsA: string[],
    termsB: string[]
  ): string[] {
    const setA = new Set(termsA);
    const setB = new Set(termsB);

    // Return intersection
    return [...setA].filter((k) => setB.has(k));
  }

  /**
   * Calculate Jaccard similarity between two keyword ID hash sets (DEPRECATED - use calculateJaccardFromTerms)
   * Formula: |intersection| / |union|
   */
  private calculateJaccard(
    keywordsA: SHA256IdHash<any>[],
    keywordsB: SHA256IdHash<any>[]
  ): number {
    if (keywordsA.length === 0 || keywordsB.length === 0) {
      return 0;
    }

    const setA = new Set(keywordsA);
    const setB = new Set(keywordsB);

    // Calculate intersection
    const intersection = new Set([...setA].filter((k) => setB.has(k)));

    // Calculate union
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }

  /**
   * Get matched keywords (intersection of two keyword sets)
   * Returns keyword terms as strings
   */
  private async getMatchedKeywords(
    keywordsA: SHA256IdHash<any>[],
    keywordsB: SHA256IdHash<any>[]
  ): Promise<string[]> {
    const setA = new Set(keywordsA);
    const setB = new Set(keywordsB);

    // Get intersection of ID hashes
    const intersection = [...setA].filter((k) => setB.has(k));

    // Retrieve keyword terms from ONE.core
    const terms: string[] = [];
    for (const keywordIdHash of intersection) {
      try {
        const result = await getObjectByIdHash(keywordIdHash);
        if (result && result.obj && result.obj.term) {
          terms.push(result.obj.term);
        }
      } catch (error) {
        console.error(`[ProposalEngine] Error fetching keyword ${keywordIdHash}:`, error);
      }
    }

    return terms;
  }

  /**
   * Fetch all subjects from ONE.core by querying all topics
   */
  private async fetchAllSubjects(): Promise<Subject[]> {
    try {
      if (!this.channelManager || !this.topicAnalysisModel) {
        console.warn('[ProposalEngine] Missing dependencies for fetching subjects');
        return [];
      }

      // Get all channels (each channel ID is a topic ID)
      const channels: any[] = await this.channelManager.channels();

      // Get unique topic IDs
      const topicIds = new Set<string>();
      for (const channel of channels) {
        if (channel.id) {
          topicIds.add(channel.id);
        }
      }

      console.log(`[ProposalEngine] Fetching subjects from ${topicIds.size} topics`);

      // Fetch subjects from each topic
      const allSubjects: Subject[] = [];
      for (const topicId of topicIds) {
        try {
          const subjects = (await this.topicAnalysisModel.getSubjects(topicId)) as Subject[];
          if (subjects && subjects.length > 0) {
            allSubjects.push(...subjects);
            console.log(`[ProposalEngine] Found ${subjects.length} subjects in topic ${topicId}`);
          }
        } catch (error) {
          console.error(`[ProposalEngine] Error fetching subjects for topic ${topicId}:`, error);
        }
      }

      console.log(`[ProposalEngine] Total subjects fetched: ${allSubjects.length}`);
      return allSubjects;
    } catch (error) {
      console.error('[ProposalEngine] Error in fetchAllSubjects:', error);
      return [];
    }
  }
}
