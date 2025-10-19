/**
 * Keyword Detail IPC Handlers (Thin Adapter)
 *
 * Maps Electron IPC calls to KeywordDetailHandler methods.
 * Business logic lives in ../../../lama.core/handlers/KeywordDetailHandler.ts
 *
 * Implements Phase 2 (IPC Layer) for spec 015-keyword-detail-preview
 */

import type { IpcMainInvokeEvent } from 'electron';
import { KeywordDetailHandler } from '@lama/core/handlers/KeywordDetailHandler.js';
import nodeOneCoreInstance from '../../core/node-one-core.js';
import TopicAnalysisModel from '@lama/core/one-ai/models/TopicAnalysisModel.js';
import * as keywordAccessStorage from '@lama/core/one-ai/storage/keyword-access-storage.js';
import * as keywordEnrichment from '@lama/core/one-ai/services/keyword-enrichment.js';

// Singleton model instance
let topicAnalysisModel: TopicAnalysisModel | null = null;
let keywordDetailHandler: KeywordDetailHandler | null = null;

/**
 * Initialize TopicAnalysisModel singleton and handler
 */
async function initializeHandler(): Promise<KeywordDetailHandler> {
  if (keywordDetailHandler && topicAnalysisModel?.state.currentState === 'Initialised') {
    return keywordDetailHandler;
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

  if (!keywordDetailHandler) {
    keywordDetailHandler = new KeywordDetailHandler(
      nodeOneCoreInstance,
      topicAnalysisModel,
      keywordAccessStorage,
      keywordEnrichment
    );
  }

  return keywordDetailHandler;
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
  try {
    const handler = await initializeHandler();
    return await handler.getKeywordDetails({ keyword, topicId });
  } catch (error) {
    console.error('[KeywordDetail] Error in IPC handler:', error);
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
  try {
    const handler = await initializeHandler();
    return await handler.updateKeywordAccessState({
      keyword,
      topicId,
      principalId,
      principalType,
      state
    });
  } catch (error) {
    console.error('[KeywordDetail] Error in IPC handler:', error);
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
