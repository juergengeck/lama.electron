/**
 * Feed-Forward IPC Handlers (Thin Adapter)
 *
 * Maps Electron IPC calls to FeedForwardHandler methods.
 * Business logic lives in ../../../lama.core/handlers/FeedForwardHandler.ts
 */

import { FeedForwardHandler } from '@lama/core/handlers/FeedForwardHandler.js';
import FeedForwardManager from '../../core/feed-forward/manager.js';
import type { IpcMainInvokeEvent } from 'electron';

// Manager and handler instances
let manager: FeedForwardManager | null = null;
let feedForwardHandler: FeedForwardHandler | null = null;

/**
 * Initialize feed-forward manager and handler with ONE.core instance
 */
function initializeFeedForward(nodeOneCore: any): void {
  if (!nodeOneCore) {
    throw new Error('ONE.core instance required for feed-forward initialization');
  }

  manager = new FeedForwardManager({ nodeOneCore });
  feedForwardHandler = new FeedForwardHandler(manager);
}

/**
 * Get handler instance (throws if not initialized)
 */
function getHandler(): FeedForwardHandler {
  if (!feedForwardHandler) {
    throw new Error('Feed-forward handler not initialized');
  }
  return feedForwardHandler;
}

/**
 * IPC Handler: Create Supply object
 */
async function createSupply(event: IpcMainInvokeEvent, params: any) {
  return await getHandler().createSupply(params);
}

/**
 * IPC Handler: Create Demand object
 */
async function createDemand(event: IpcMainInvokeEvent, params: any) {
  return await getHandler().createDemand(params);
}

/**
 * IPC Handler: Match Supply with Demand
 */
async function matchSupplyDemand(event: IpcMainInvokeEvent, params: any) {
  return await getHandler().matchSupplyDemand(params);
}

/**
 * IPC Handler: Update trust score
 */
async function updateTrust(event: IpcMainInvokeEvent, params: any) {
  return await getHandler().updateTrust(params);
}

/**
 * IPC Handler: Get corpus stream
 */
async function getCorpusStream(event: IpcMainInvokeEvent, params: any = {}) {
  return await getHandler().getCorpusStream(params);
}

/**
 * IPC Handler: Enable/disable sharing
 */
async function enableSharing(event: IpcMainInvokeEvent, params: any) {
  return await getHandler().enableSharing(params);
}

/**
 * IPC Handler: Get trust score
 */
async function getTrustScore(event: IpcMainInvokeEvent, params: any) {
  return await getHandler().getTrustScore(params);
}

const feedForwardHandlers = {
  initializeFeedForward,
  'feedForward:createSupply': createSupply,
  'feedForward:createDemand': createDemand,
  'feedForward:matchSupplyDemand': matchSupplyDemand,
  'feedForward:updateTrust': updateTrust,
  'feedForward:getCorpusStream': getCorpusStream,
  'feedForward:enableSharing': enableSharing,
  'feedForward:getTrustScore': getTrustScore
};

export default feedForwardHandlers;