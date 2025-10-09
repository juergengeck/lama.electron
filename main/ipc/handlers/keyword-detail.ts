/**
 * IPC Handlers for Keyword Detail Preview
 * Handles keyword detail operations including access control
 *
 * Implements Phase 2 (IPC Layer) for spec 015-keyword-detail-preview
 */

import type { IpcMainInvokeEvent } from 'electron';
import nodeOneCoreInstance from '../../core/node-one-core.js';
import TopicAnalysisModel from '../../core/one-ai/models/TopicAnalysisModel.js';
import * as keywordAccessStorage from '../../core/one-ai/storage/keyword-access-storage.js';
// @ts-ignore - JS file
import * as keywordEnrichment from '../../services/keyword-enrichment.js';

// Singleton model instance
let topicAnalysisModel: TopicAnalysisModel | null = null;

// Cache for getKeywordDetails (5-second TTL)
const detailsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

/**
 * Initialize TopicAnalysisModel singleton
 */
async function initializeModel(): Promise<TopicAnalysisModel> {
  if (topicAnalysisModel) {
    if (topicAnalysisModel.state.currentState === 'Initialised') {
      return topicAnalysisModel;
    }
    if (topicAnalysisModel.state.currentState === 'Initialising' as any) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return initializeModel();
    }
  }

  if (!nodeOneCoreInstance?.initialized) {
    throw new Error('ONE.core not initialized');
  }

  const channelManager = nodeOneCoreInstance.channelManager;
  if (!channelManager) {
    throw new Error('ChannelManager not available');
  }

  const topicModel = nodeOneCoreInstance.topicModel;
  if (!topicModel) {
    throw new Error('TopicModel not available');
  }

  if (!topicAnalysisModel) {
    topicAnalysisModel = new TopicAnalysisModel(channelManager, topicModel);
  }

  if (topicAnalysisModel.state.currentState === 'Uninitialised') {
    await topicAnalysisModel.init();
  }

  return topicAnalysisModel;
}

/**
 * Get keyword details with subjects, access states, and topic references
 * Handler for: keywordDetail:getKeywordDetails
 * Contract: /specs/015-keyword-detail-preview/contracts/getKeywordDetails.md
 */
export async function getKeywordDetails(
  event: IpcMainInvokeEvent,
  { keyword, topicId }: { keyword: string; topicId?: string }
): Promise<any> {
  const startTime = Date.now();
  console.log('[KeywordDetail] ⏱️ Getting keyword details:', { keyword, topicId });

  try {
    // Validate inputs
    if (!keyword || typeof keyword !== 'string') {
      throw new Error('Invalid keyword: must be non-empty string');
    }

    // Normalize keyword
    const normalizedKeyword = keyword.toLowerCase().trim();

    // Check cache
    const cacheKey = `${normalizedKeyword}:${topicId || 'all'}`;
    const cached = detailsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[KeywordDetail] ⚡ Returning cached data for:', cacheKey, `(${Date.now() - startTime}ms)`);
      return { success: true, data: cached.data };
    }

    // topicId is required - we can't search across all topics without it
    if (!topicId) {
      throw new Error('topicId is required');
    }

    // Initialize model
    let t = Date.now();
    const model = await initializeModel();
    console.log('[KeywordDetail] ⏱️ Model init:', `${Date.now() - t}ms`);
    const channelManager = nodeOneCoreInstance.channelManager;

    // Get the specific keyword using ID hash lookup (O(1))
    t = Date.now();
    const keywordObj = await model.getKeywordByTerm(topicId, normalizedKeyword);
    console.log('[KeywordDetail] ⏱️ getKeywordByTerm:', `${Date.now() - t}ms`);

    if (!keywordObj) {
      throw new Error(`Keyword not found: ${keyword}`);
    }

    // Get subject ID hashes from keyword.subjects array
    // NOTE: keyword.subjects now contains Subject ID hashes (not raw ID strings)
    t = Date.now();
    const subjectIdHashes = keywordObj.subjects || [];
    console.log('[KeywordDetail] ⏱️ Got subject ID hashes from keyword:', `${Date.now() - t}ms`, `(${subjectIdHashes.length} subjects)`);
    console.log('[KeywordDetail] 🔍 DEBUG keyword.subjects:', JSON.stringify(subjectIdHashes, null, 2));

    // Load ONLY the subjects referenced by this keyword using their ID hashes
    t = Date.now();
    const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
    const subjects = [];

    for (const subjectIdHash of subjectIdHashes) {
      try {
        console.log('[KeywordDetail] 🔍 Attempting to load subject with ID hash:', subjectIdHash);
        const result = await getObjectByIdHash(subjectIdHash);
        console.log('[KeywordDetail] 🔍 getObjectByIdHash returned:', result ? `obj: ${result.obj?.$type$}` : 'null');
        if (result?.obj) {
          subjects.push(result.obj);
        } else {
          console.warn('[KeywordDetail] ⚠️  Subject not found for ID hash:', subjectIdHash);
        }
      } catch (error) {
        console.warn('[KeywordDetail] ❌ Could not load subject with ID hash:', subjectIdHash, error);
      }
    }
    console.log('[KeywordDetail] ⏱️ Loaded specific subjects:', `${Date.now() - t}ms`, `(${subjects.length} loaded)`);

    // Enrich keyword with topic references
    t = Date.now();
    const enrichedKeyword = await keywordEnrichment.enrichKeywordWithTopicReferences(
      keywordObj,
      subjects,
      channelManager
    );
    console.log('[KeywordDetail] ⏱️ enrichKeywordWithTopicReferences:', `${Date.now() - t}ms`);

    // Enrich subjects with metadata
    t = Date.now();
    const enrichedSubjects = await keywordEnrichment.enrichSubjectsWithMetadata(
      subjects,
      subjects  // We only have the subjects for this keyword now
    );
    console.log('[KeywordDetail] ⏱️ enrichSubjectsWithMetadata:', `${Date.now() - t}ms`);

    // Sort subjects by relevanceScore descending
    t = Date.now();
    const sortedSubjects = keywordEnrichment.sortByRelevance(enrichedSubjects);
    console.log('[KeywordDetail] ⏱️ sortByRelevance:', `${Date.now() - t}ms`);

    // Get access states for this keyword
    t = Date.now();
    const accessStates = await keywordAccessStorage.getAccessStatesByKeyword(
      channelManager,
      normalizedKeyword
    );
    console.log('[KeywordDetail] ⏱️ getAccessStatesByKeyword:', `${Date.now() - t}ms`);

    const result = {
      keyword: enrichedKeyword,
      subjects: sortedSubjects,
      accessStates
    };

    // Cache result
    detailsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    console.log('[KeywordDetail] ⏱️ TOTAL TIME:', `${Date.now() - startTime}ms`, {
      keyword: normalizedKeyword,
      subjectCount: sortedSubjects.length,
      accessStateCount: accessStates.length
    });

    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('[KeywordDetail] ❌ Error getting keyword details:', error, `(${Date.now() - startTime}ms)`);
    return {
      success: false,
      error: (error as Error).message,
      data: {
        keyword: null,
        subjects: [],
        accessStates: []
      }
    };
  }
}

/**
 * Update or create access state for a keyword and principal
 * Handler for: keywordDetail:updateKeywordAccessState
 * Contract: /specs/015-keyword-detail-preview/contracts/updateKeywordAccessState.md
 */
export async function updateKeywordAccessState(
  event: IpcMainInvokeEvent,
  {
    keyword,
    topicId,
    principalId,
    principalType,
    state
  }: {
    keyword: string;
    topicId: string;
    principalId: string;
    principalType: 'user' | 'group';
    state: 'allow' | 'deny' | 'none';
  }
): Promise<any> {
  console.log('[KeywordDetail] Updating access state:', {
    keyword,
    topicId,
    principalId,
    principalType,
    state
  });

  try {
    // Validate inputs
    if (!keyword || typeof keyword !== 'string') {
      throw new Error('Invalid keyword: must be non-empty string');
    }
    if (!topicId) {
      throw new Error('Invalid topicId: required');
    }
    if (!principalId) {
      throw new Error('Invalid principalId: required');
    }
    if (!['user', 'group'].includes(principalType)) {
      throw new Error(`Invalid principalType: must be 'user' or 'group'`);
    }
    if (!['allow', 'deny', 'none'].includes(state)) {
      throw new Error(`Invalid state: must be 'allow', 'deny', or 'none'`);
    }

    // Normalize keyword
    const keywordTerm = keyword.toLowerCase().trim();

    // Initialize model
    const model = await initializeModel();
    const channelManager = nodeOneCoreInstance.channelManager;

    // Verify keyword exists in this topic
    const allKeywords: any = await model.getKeywords(topicId);
    const keywordExists = allKeywords.some((k: any) => k.term === keywordTerm);
    if (!keywordExists) {
      throw new Error(`Keyword not found: ${keyword}`);
    }

    // Get current user
    const updatedBy = (nodeOneCoreInstance as any).getCurrentUserId
      ? (nodeOneCoreInstance as any).getCurrentUserId()
      : 'system';

    if (!updatedBy) {
      throw new Error('User not authenticated');
    }

    // Update access state (upsert)
    const result = await keywordAccessStorage.updateAccessState(
      channelManager,
      keywordTerm,
      principalId,
      principalType,
      state,
      updatedBy
    );

    // Invalidate cache for this keyword
    const cacheKeys = Array.from(detailsCache.keys());
    for (const key of cacheKeys) {
      if (key.startsWith(`${keywordTerm}:`)) {
        detailsCache.delete(key);
      }
    }

    // Get the access state object
    const accessState = await keywordAccessStorage.getAccessStateByPrincipal(
      channelManager,
      keywordTerm,
      principalId
    );

    console.log('[KeywordDetail] Access state updated:', {
      keywordTerm,
      principalId,
      created: result.created
    });

    return {
      success: true,
      data: {
        accessState: accessState,
        created: result.created
      }
    };
  } catch (error) {
    console.error('[KeywordDetail] Error updating access state:', error);
    return {
      success: false,
      error: (error as Error).message,
      data: {
        accessState: null,
        created: false
      }
    };
  }
}

// Export all handlers
export default {
  getKeywordDetails,
  updateKeywordAccessState
};
