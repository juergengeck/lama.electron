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
  console.log('[KeywordDetail] Getting keyword details:', { keyword, topicId });

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
      console.log('[KeywordDetail] Returning cached data for:', cacheKey);
      return { success: true, data: cached.data };
    }

    // Initialize model
    const model = await initializeModel();
    const channelManager = nodeOneCoreInstance.channelManager;

    // Get all keywords from all topics first
    const allKeywords: any = await (model as any).getAllKeywords();

    // Find keyword by term
    const keywordObj = allKeywords.find((k: any) => k.term === normalizedKeyword);
    if (!keywordObj) {
      throw new Error(`Keyword not found: ${keyword}`);
    }

    // Get all subjects
    const allSubjects: any = await (model as any).getAllSubjects();

    // Filter subjects containing this keyword
    let subjects = allSubjects.filter((subject: any) => {
      // Check if subject contains keyword (by term match)
      const subjectKeywordTerms = subject.keywords
        .map((k: any) => {
          const kw = allKeywords.find((kw: any) => kw.id === k);
          return kw ? kw.term : null;
        })
        .filter(Boolean);

      return subjectKeywordTerms.includes(normalizedKeyword);
    });

    // Filter by topicId if provided
    if (topicId) {
      subjects = subjects.filter((s: any) => s.topicId === topicId);
    }

    // Enrich keyword with topic references
    const enrichedKeyword = await keywordEnrichment.enrichKeywordWithTopicReferences(
      keywordObj,
      subjects,
      channelManager
    );

    // Enrich subjects with metadata
    const enrichedSubjects = await keywordEnrichment.enrichSubjectsWithMetadata(
      subjects,
      allSubjects
    );

    // Sort subjects by relevanceScore descending
    const sortedSubjects = keywordEnrichment.sortByRelevance(enrichedSubjects);

    // Get access states for this keyword
    const accessStates = await keywordAccessStorage.getAccessStatesByKeyword(
      channelManager,
      normalizedKeyword
    );

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

    console.log('[KeywordDetail] Retrieved keyword details:', {
      keyword: normalizedKeyword,
      subjectCount: sortedSubjects.length,
      accessStateCount: accessStates.length
    });

    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('[KeywordDetail] Error getting keyword details:', error);
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
    principalId,
    principalType,
    state
  }: {
    keyword: string;
    principalId: string;
    principalType: 'user' | 'group';
    state: 'allow' | 'deny' | 'none';
  }
): Promise<any> {
  console.log('[KeywordDetail] Updating access state:', {
    keyword,
    principalId,
    principalType,
    state
  });

  try {
    // Validate inputs
    if (!keyword || typeof keyword !== 'string') {
      throw new Error('Invalid keyword: must be non-empty string');
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

    // Verify keyword exists
    const allKeywords: any = await (model as any).getAllKeywords();
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
