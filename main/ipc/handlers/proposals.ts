/**
 * Proposals IPC Handlers (Thin Adapter)
 *
 * Maps Electron IPC calls to ProposalsHandler methods.
 * Business logic lives in ../../../lama.core/handlers/ProposalsHandler.ts
 *
 * Implements Phase 2 (IPC Layer) for spec 019-above-the-chat
 */

import type { IpcMainInvokeEvent } from 'electron';
import { ProposalsHandler } from '@lama/core/handlers/ProposalsHandler.js';
import { ProposalEngine } from '../../services/proposal-engine.js';
import { ProposalRanker } from '../../services/proposal-ranker.js';
import { ProposalCache } from '../../services/proposal-cache.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import nodeOneCoreInstance from '../../core/node-one-core.js';

// Initialize services
let proposalEngine: ProposalEngine | null = null;
const proposalRanker = new ProposalRanker();
const proposalCache = new ProposalCache(50, 60000); // 50 entries, 60s TTL

// Singleton handler instance
let proposalsHandler: ProposalsHandler | null = null;

/**
 * Initialize ProposalEngine and handler
 */
function getProposalsHandler(): ProposalsHandler {
  // Initialize ProposalEngine if needed
  if (!proposalEngine && nodeOneCoreInstance.topicAnalysisModel && nodeOneCoreInstance.channelManager) {
    proposalEngine = new ProposalEngine(
      nodeOneCoreInstance.topicAnalysisModel,
      nodeOneCoreInstance.channelManager
    );
  }
  if (!proposalEngine) {
    throw new Error('ProposalEngine not initialized - nodeOneCore not ready');
  }

  // Initialize handler if needed
  if (!proposalsHandler) {
    proposalsHandler = new ProposalsHandler(
      nodeOneCoreInstance,
      nodeOneCoreInstance.topicAnalysisModel,
      proposalEngine,
      proposalRanker,
      proposalCache
    );
  }

  return proposalsHandler;
}

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
) {
  const handler = getProposalsHandler();
  return await handler.getForTopic({ topicId, currentSubjects, forceRefresh });
}

/**
 * Update user's proposal configuration
 * Handler: proposals:updateConfig
 */
async function updateConfig(
  event: IpcMainInvokeEvent,
  { config }: { config: Partial<any> }
) {
  const handler = getProposalsHandler();
  return await handler.updateConfig({ config });
}

/**
 * Get current user's proposal configuration
 * Handler: proposals:getConfig
 */
async function getConfig(event: IpcMainInvokeEvent) {
  const handler = getProposalsHandler();
  return await handler.getConfig({});
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
) {
  const handler = getProposalsHandler();
  return await handler.dismiss({ proposalId, topicId, pastSubjectIdHash });
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
) {
  const handler = getProposalsHandler();
  return await handler.share({ proposalId, topicId, pastSubjectIdHash, includeMessages });
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
