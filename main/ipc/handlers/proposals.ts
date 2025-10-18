/**
 * IPC Handlers for Proposal System
 * Provides browser access to proposal services via IPC
 *
 * Reference: /specs/019-above-the-chat/contracts/ipc-proposals.json
 */

import type { IpcMainInvokeEvent } from 'electron';
import { ProposalEngine } from '../../services/proposal-engine.js';
import { ProposalRanker } from '../../services/proposal-ranker.js';
import { ProposalCache } from '../../services/proposal-cache.js';
import {
  storeVersionedObject,
  getObjectByIdHash,
} from '@refinio/one.core/lib/storage-versioned-objects.js';
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Proposal, ProposalConfig } from '../../services/proposal-engine.js';
import nodeOneCoreInstance from '../../core/node-one-core.js';

// Initialize services (lazy initialization - will be set when nodeOneCore is ready)
let proposalEngine: ProposalEngine | null = null;
const proposalRanker = new ProposalRanker();
const proposalCache = new ProposalCache(50, 60000); // 50 entries, 60s TTL

// Initialize ProposalEngine with dependencies from nodeOneCore
function getProposalEngine(): ProposalEngine {
  if (!proposalEngine && nodeOneCoreInstance.topicAnalysisModel && nodeOneCoreInstance.channelManager) {
    proposalEngine = new ProposalEngine(
      nodeOneCoreInstance.topicAnalysisModel,
      nodeOneCoreInstance.channelManager
    );
  }
  if (!proposalEngine) {
    throw new Error('ProposalEngine not initialized - nodeOneCore not ready');
  }
  return proposalEngine;
}

// Session-only dismissed proposals (in-memory)
const dismissedProposals = new Set<string>();

// Default configuration
const DEFAULT_CONFIG: ProposalConfig = {
  userEmail: '',
  matchWeight: 0.7,
  recencyWeight: 0.3,
  recencyWindow: 30 * 24 * 60 * 60 * 1000, // 30 days
  minJaccard: 0.2,
  maxProposals: 10,
  updatedAt: Date.now(),
};

/**
 * Get proposals for a specific topic
 * Handler: proposals:getForTopic
 */
async function getForTopic(
  event: IpcMainInvokeEvent,
  {
    topicId,
    currentSubjects,
    forceRefresh,
  }: {
    topicId: string;
    currentSubjects?: SHA256IdHash<any>[];
    forceRefresh?: boolean;
  }
): Promise<{
  proposals: Proposal[];
  count: number;
  cached: boolean;
  computeTimeMs: number;
}> {
  const startTime = Date.now();

  console.log('[ProposalHandlers] 🎯 getForTopic called:', { topicId, hasCurrentSubjects: !!currentSubjects, forceRefresh });

  try {
    if (!topicId) {
      throw new Error('TOPIC_NOT_FOUND: topicId is required');
    }

    // Get current subjects if not provided
    let subjectIdHashes = currentSubjects;
    if (!subjectIdHashes || subjectIdHashes.length === 0) {
      console.log('[ProposalHandlers] No subjects provided, querying TopicAnalysisModel...');
      // Query subjects for topic from TopicAnalysisModel
      if (!nodeOneCoreInstance.topicAnalysisModel) {
        console.log('[ProposalHandlers] ℹ️  TopicAnalysisModel not initialized');
        // Return empty results - this is not an error condition
        return {
          proposals: [],
          count: 0,
          cached: false,
          computeTimeMs: Date.now() - startTime,
        };
      }
      try {
        const subjects = (await nodeOneCoreInstance.topicAnalysisModel.getSubjects(topicId)) as any[];
        console.log('[ProposalHandlers] Retrieved subjects:', subjects?.length || 0);
        if (!subjects || subjects.length === 0) {
          console.log('[ProposalHandlers] ℹ️  No subjects found for topic:', topicId);
          // Return empty results - this is expected for new conversations
          return {
            proposals: [],
            count: 0,
            cached: false,
            computeTimeMs: Date.now() - startTime,
          };
        }
        // Calculate ID hashes for all subjects
        subjectIdHashes = await Promise.all(
          subjects.map((subject) => calculateIdHashOfObj(subject as any))
        );
        console.log('[ProposalHandlers] Calculated ID hashes for', subjectIdHashes.length, 'subjects');
      } catch (error: any) {
        console.error('[ProposalHandlers] Error querying subjects:', error);
        // Return empty results - don't throw, just log the error
        return {
          proposals: [],
          count: 0,
          cached: false,
          computeTimeMs: Date.now() - startTime,
        };
      }
    } else {
      console.log('[ProposalHandlers] Using provided subjects:', subjectIdHashes.length);
    }

    // Check cache first (unless forceRefresh)
    if (!forceRefresh) {
      const cached = proposalCache.get(topicId, subjectIdHashes);
      if (cached) {
        // Filter against dismissed proposals
        const filtered = cached.filter(
          (p) => !dismissedProposals.has(`${topicId}:${p.pastSubject}`)
        );
        return {
          proposals: filtered,
          count: filtered.length,
          cached: true,
          computeTimeMs: Date.now() - startTime,
        };
      }
    }

    // Get current user config
    const config = await getCurrentConfig();
    console.log('[ProposalHandlers] Using config:', { minJaccard: config.minJaccard, matchWeight: config.matchWeight, maxProposals: config.maxProposals });

    // Generate proposals using lazy-initialized engine
    console.log('[ProposalHandlers] Initializing ProposalEngine...');
    const engine = getProposalEngine();
    console.log('[ProposalHandlers] ✅ ProposalEngine initialized, calling getProposalsForTopic...');
    const proposals = await engine.getProposalsForTopic(topicId, subjectIdHashes, config);
    console.log('[ProposalHandlers] ProposalEngine returned', proposals.length, 'proposals');

    // Rank proposals
    console.log('[ProposalHandlers] Ranking proposals...');
    const rankedProposals = proposalRanker.rankProposals(proposals, config);
    console.log('[ProposalHandlers] Ranked proposals:', rankedProposals.length);

    // Filter against dismissed proposals
    const filtered = rankedProposals.filter(
      (p) => !dismissedProposals.has(`${topicId}:${p.pastSubject}`)
    );
    console.log('[ProposalHandlers] Filtered proposals (after dismissals):', filtered.length);

    // Cache results
    proposalCache.set(topicId, subjectIdHashes, filtered);

    console.log('[ProposalHandlers] ✅ Returning', filtered.length, 'proposals in', Date.now() - startTime, 'ms');
    return {
      proposals: filtered,
      count: filtered.length,
      cached: false,
      computeTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error('[ProposalHandlers] ❌ Error in getForTopic:', error);
    console.error('[ProposalHandlers] Error stack:', error.stack);
    throw new Error(`COMPUTATION_ERROR: ${error.message}`);
  }
}

/**
 * Update user's proposal configuration
 * Handler: proposals:updateConfig
 */
async function updateConfig(
  event: IpcMainInvokeEvent,
  { config }: { config: Partial<ProposalConfig> }
): Promise<{
  success: boolean;
  config: ProposalConfig;
  versionHash?: string;
}> {
  try {
    // Validate config parameters
    if (config.matchWeight !== undefined) {
      if (config.matchWeight < 0 || config.matchWeight > 1) {
        throw new Error('INVALID_CONFIG: matchWeight must be between 0.0 and 1.0');
      }
    }

    if (config.recencyWeight !== undefined) {
      if (config.recencyWeight < 0 || config.recencyWeight > 1) {
        throw new Error('INVALID_CONFIG: recencyWeight must be between 0.0 and 1.0');
      }
    }

    if (config.maxProposals !== undefined) {
      if (config.maxProposals < 1 || config.maxProposals > 50) {
        throw new Error('INVALID_CONFIG: maxProposals must be between 1 and 50');
      }
    }

    if (config.minJaccard !== undefined) {
      if (config.minJaccard < 0 || config.minJaccard > 1) {
        throw new Error('INVALID_CONFIG: minJaccard must be between 0.0 and 1.0');
      }
    }

    // Get current config or use defaults
    const currentConfig = await getCurrentConfig();

    // Merge with new config
    const updatedConfig: ProposalConfig = {
      ...currentConfig,
      ...config,
      updatedAt: Date.now(),
    };

    // Store as versioned object
    const configObject = {
      $type$: 'ProposalConfig' as const,
      ...updatedConfig,
    };

    const result = await storeVersionedObject(configObject);

    // Invalidate proposal cache
    proposalCache.clear();

    return {
      success: true,
      config: updatedConfig,
      versionHash: String(result.hash),
    };
  } catch (error: any) {
    console.error('[ProposalHandlers] Error in updateConfig:', error);
    if (error.message.startsWith('INVALID_CONFIG')) {
      throw error;
    }
    throw new Error(`STORAGE_ERROR: ${error.message}`);
  }
}

/**
 * Get current user's proposal configuration
 * Handler: proposals:getConfig
 */
async function getConfig(
  event: IpcMainInvokeEvent
): Promise<{
  config: ProposalConfig;
  isDefault: boolean;
}> {
  try {
    const config = await getCurrentConfig();
    const isDefault = config.updatedAt === DEFAULT_CONFIG.updatedAt;

    return {
      config,
      isDefault,
    };
  } catch (error: any) {
    console.error('[ProposalHandlers] Error in getConfig:', error);
    throw new Error(`USER_NOT_AUTHENTICATED: ${error.message}`);
  }
}

/**
 * Dismiss a proposal for the current session
 * Handler: proposals:dismiss
 */
async function dismiss(
  event: IpcMainInvokeEvent,
  {
    proposalId,
    topicId,
    pastSubjectIdHash,
  }: {
    proposalId: string;
    topicId: string;
    pastSubjectIdHash: string;
  }
): Promise<{
  success: boolean;
  remainingCount: number;
}> {
  try {
    if (!proposalId || !topicId || !pastSubjectIdHash) {
      throw new Error('PROPOSAL_NOT_FOUND: Missing required parameters');
    }

    // Add to dismissed set (session-only)
    const dismissKey = `${topicId}:${pastSubjectIdHash}`;
    dismissedProposals.add(dismissKey);

    // Query remaining non-dismissed proposals
    // For now, return 0 (will be updated when getForTopic is called again)
    const remainingCount = 0;

    return {
      success: true,
      remainingCount,
    };
  } catch (error: any) {
    console.error('[ProposalHandlers] Error in dismiss:', error);
    throw error;
  }
}

/**
 * Share a proposal into the current conversation
 * Handler: proposals:share
 */
async function share(
  event: IpcMainInvokeEvent,
  {
    proposalId,
    topicId,
    pastSubjectIdHash,
    includeMessages,
  }: {
    proposalId: string;
    topicId: string;
    pastSubjectIdHash: SHA256IdHash<any>;
    includeMessages?: boolean;
  }
): Promise<{
  success: boolean;
  sharedContent: {
    subjectName: string;
    keywords: string[];
    messages?: any[];
  };
}> {
  try {
    // Retrieve past subject by ID hash
    const result = await getObjectByIdHash(pastSubjectIdHash);
    if (!result || !result.obj) {
      throw new Error('SUBJECT_NOT_FOUND: Past subject no longer exists');
    }

    const pastSubject = result.obj;

    // Get subject name and keywords
    const subjectName = pastSubject.id || pastSubject.description || 'Unknown Subject';
    const keywords: string[] = [];

    // Retrieve keyword terms from ONE.core
    for (const keywordIdHash of pastSubject.keywords || []) {
      try {
        const keywordResult = await getObjectByIdHash(keywordIdHash);
        if (keywordResult && keywordResult.obj) {
          const keyword = keywordResult.obj as any;
          if (keyword.term) {
            keywords.push(keyword.term);
          }
        }
      } catch (error) {
        console.error(
          `[ProposalHandlers] Error fetching keyword ${keywordIdHash}:`,
          error
        );
      }
    }

    // Optionally retrieve sample messages
    const messages: any[] = [];
    if (includeMessages) {
      // TODO: Implement message retrieval from past topic
      // For now, return empty array
    }

    // Mark proposal as dismissed
    const dismissKey = `${topicId}:${pastSubjectIdHash}`;
    dismissedProposals.add(dismissKey);

    return {
      success: true,
      sharedContent: {
        subjectName,
        keywords,
        messages: includeMessages ? messages : undefined,
      },
    };
  } catch (error: any) {
    console.error('[ProposalHandlers] Error in share:', error);
    if (error.message.startsWith('SUBJECT_NOT_FOUND')) {
      throw error;
    }
    throw new Error(`SHARE_FAILED: ${error.message}`);
  }
}

/**
 * Helper: Get current user config or return defaults
 */
async function getCurrentConfig(): Promise<ProposalConfig> {
  try {
    // Get current user email from nodeOneCore
    const userEmail = nodeOneCoreInstance.email || 'user@example.com';

    // Calculate ID hash for ProposalConfig
    const configIdObj = {
      $type$: 'ProposalConfig' as const,
      userEmail,
    };
    const configIdHash = await calculateIdHashOfObj(configIdObj as any);

    // Retrieve from ONE.core
    const result = await getObjectByIdHash(configIdHash);
    if (result && result.obj) {
      return result.obj as any as ProposalConfig;
    }

    // Return defaults if not found
    return {
      ...DEFAULT_CONFIG,
      userEmail,
    };
  } catch (error) {
    // Return defaults on error
    return {
      ...DEFAULT_CONFIG,
      userEmail: nodeOneCoreInstance.email || 'user@example.com',
    };
  }
}

/**
 * Export proposal handlers
 */
export const proposalHandlers = {
  'proposals:getForTopic': getForTopic,
  'proposals:updateConfig': updateConfig,
  'proposals:getConfig': getConfig,
  'proposals:dismiss': dismiss,
  'proposals:share': share,
};
