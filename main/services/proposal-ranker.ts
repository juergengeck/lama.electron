/**
 * ProposalRanker Service
 * Ranks proposals by relevance score and limits results
 *
 * Reference: /specs/019-above-the-chat/data-model.md lines 146-176
 * Reference: /specs/019-above-the-chat/research.md lines 60-72
 */

import type { Proposal, ProposalConfig } from './proposal-engine.js';

export class ProposalRanker {
  /**
   * Rank proposals by relevance score and limit to maxProposals
   *
   * @param proposals - Array of proposals to rank
   * @param config - Proposal configuration
   * @returns Ranked proposals (descending by relevanceScore)
   */
  rankProposals(proposals: Proposal[], config: ProposalConfig): Proposal[] {
    if (!proposals || proposals.length === 0) {
      return [];
    }

    // Sort by relevanceScore descending (highest relevance first)
    const sorted = [...proposals].sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Limit to maxProposals
    return sorted.slice(0, config.maxProposals);
  }

  /**
   * Calculate relevance score for a single proposal
   * This is a utility method for testing or recalculating scores
   *
   * @param jaccard - Jaccard similarity (0.0-1.0)
   * @param recency - Recency boost (0.0-1.0)
   * @param config - Proposal configuration
   * @returns Relevance score (0.0-1.0)
   */
  calculateRelevanceScore(
    jaccard: number,
    recency: number,
    config: ProposalConfig
  ): number {
    return jaccard * config.matchWeight + recency * config.recencyWeight;
  }

  /**
   * Calculate recency boost for a past subject
   *
   * @param createdAt - When past subject was created (timestamp)
   * @param recencyWindow - Time window for recency boost (milliseconds)
   * @returns Recency boost (0.0-1.0)
   */
  calculateRecencyBoost(createdAt: number, recencyWindow: number): number {
    const age = Date.now() - createdAt;
    return Math.max(0, 1 - age / recencyWindow);
  }
}
