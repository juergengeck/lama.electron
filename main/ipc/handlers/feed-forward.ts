/**
 * Feed-Forward IPC Handlers
 * Handles all IPC communication for feed-forward knowledge sharing
 */

import FeedForwardManager from '../../core/feed-forward/manager.js';
import type { IpcMainInvokeEvent } from 'electron';

// Will be initialized when ONE.core is ready
let manager: FeedForwardManager | null = null;

interface SupplyParams {
  keywords: string[];
  contextLevel: number;
  conversationId: string;
  metadata?: any;
}

interface DemandParams {
  keywords: string[];
  urgency: number;
  context: string;
  criteria?: any;
  expires?: number;
  maxResults?: number;
}

interface MatchParams {
  demandHash: string;
  minTrust?: number;
  limit?: number;
}

interface TrustUpdateParams {
  participantId: string;
  adjustment: number;
  reason: string;
  evidence?: any;
}

interface CorpusParams {
  since?: number;
  minQuality?: number;
  keywords?: string[];
}

interface SharingParams {
  conversationId: string;
  enabled: boolean;
  retroactive?: boolean;
}

interface TrustGetParams {
  participantId: string;
}

/**
 * Initialize feed-forward manager with ONE.core instance
 */
function initializeFeedForward(nodeOneCore: any): void {
  if (!nodeOneCore) {
    throw new Error('ONE.core instance required for feed-forward initialization');
  }
  manager = new FeedForwardManager({ nodeOneCore });
}

/**
 * IPC Handler: Create Supply object
 */
async function createSupply(event: IpcMainInvokeEvent, params: SupplyParams): Promise<any> {
  if (!manager) {
    return { success: false, error: 'Feed-forward manager not initialized' };
  }

  try {
    return await manager.createSupply(params);
  } catch (error) {
    console.error('Error creating supply:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error creating supply' };
  }
}

/**
 * IPC Handler: Create Demand object
 */
async function createDemand(event: IpcMainInvokeEvent, params: DemandParams): Promise<any> {
  if (!manager) {
    return { success: false, error: 'Feed-forward manager not initialized' };
  }

  try {
    return await manager.createDemand(params);
  } catch (error) {
    console.error('Error creating demand:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error creating demand' };
  }
}

/**
 * IPC Handler: Match Supply with Demand
 */
async function matchSupplyDemand(event: IpcMainInvokeEvent, params: MatchParams): Promise<any> {
  if (!manager) {
    return { success: false, error: 'Feed-forward manager not initialized' };
  }

  try {
    return await manager.matchSupplyDemand(params);
  } catch (error) {
    console.error('Error matching supply/demand:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error matching supply/demand' };
  }
}

/**
 * IPC Handler: Update trust score
 */
async function updateTrust(event: IpcMainInvokeEvent, params: TrustUpdateParams): Promise<any> {
  if (!manager) {
    return { success: false, error: 'Feed-forward manager not initialized' };
  }

  try {
    return await manager.updateTrust(params);
  } catch (error) {
    console.error('Error updating trust:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error updating trust' };
  }
}

/**
 * IPC Handler: Get corpus stream
 */
async function getCorpusStream(event: IpcMainInvokeEvent, params: CorpusParams = {}): Promise<any> {
  if (!manager) {
    return { success: false, error: 'Feed-forward manager not initialized' };
  }

  try {
    return await manager.getCorpusStream(params);
  } catch (error) {
    console.error('Error getting corpus stream:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error getting corpus stream' };
  }
}

/**
 * IPC Handler: Enable/disable sharing
 */
async function enableSharing(event: IpcMainInvokeEvent, params: SharingParams): Promise<any> {
  if (!manager) {
    return { success: false, error: 'Feed-forward manager not initialized' };
  }

  try {
    return await manager.enableSharing(params);
  } catch (error) {
    console.error('Error updating sharing:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error updating sharing' };
  }
}

/**
 * IPC Handler: Get trust score
 */
async function getTrustScore(event: IpcMainInvokeEvent, params: TrustGetParams): Promise<any> {
  if (!manager) {
    return { success: false, error: 'Feed-forward manager not initialized' };
  }

  try {
    const result = await manager.getTrustScore(params.participantId);
    return { success: true, ...result };
  } catch (error) {
    console.error('Error getting trust score:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error getting trust score' };
  }
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