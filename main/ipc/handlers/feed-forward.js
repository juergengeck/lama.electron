/**
 * Feed-Forward IPC Handlers
 * Handles all IPC communication for feed-forward knowledge sharing
 */
import FeedForwardManager from '../../core/feed-forward/manager.js';
// Will be initialized when ONE.core is ready
let manager = null;
/**
 * Initialize feed-forward manager with ONE.core instance
 */
function initializeFeedForward(nodeOneCore) {
    if (!nodeOneCore) {
        throw new Error('ONE.core instance required for feed-forward initialization');
    }
    manager = new FeedForwardManager({ nodeOneCore });
}
/**
 * IPC Handler: Create Supply object
 */
async function createSupply(event, params) {
    if (!manager) {
        return { success: false, error: 'Feed-forward manager not initialized' };
    }
    try {
        return await manager.createSupply(params);
    }
    catch (error) {
        console.error('Error creating supply:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error creating supply' };
    }
}
/**
 * IPC Handler: Create Demand object
 */
async function createDemand(event, params) {
    if (!manager) {
        return { success: false, error: 'Feed-forward manager not initialized' };
    }
    try {
        return await manager.createDemand(params);
    }
    catch (error) {
        console.error('Error creating demand:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error creating demand' };
    }
}
/**
 * IPC Handler: Match Supply with Demand
 */
async function matchSupplyDemand(event, params) {
    if (!manager) {
        return { success: false, error: 'Feed-forward manager not initialized' };
    }
    try {
        return await manager.matchSupplyDemand(params);
    }
    catch (error) {
        console.error('Error matching supply/demand:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error matching supply/demand' };
    }
}
/**
 * IPC Handler: Update trust score
 */
async function updateTrust(event, params) {
    if (!manager) {
        return { success: false, error: 'Feed-forward manager not initialized' };
    }
    try {
        return await manager.updateTrust(params);
    }
    catch (error) {
        console.error('Error updating trust:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error updating trust' };
    }
}
/**
 * IPC Handler: Get corpus stream
 */
async function getCorpusStream(event, params = {}) {
    if (!manager) {
        return { success: false, error: 'Feed-forward manager not initialized' };
    }
    try {
        return await manager.getCorpusStream(params);
    }
    catch (error) {
        console.error('Error getting corpus stream:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error getting corpus stream' };
    }
}
/**
 * IPC Handler: Enable/disable sharing
 */
async function enableSharing(event, params) {
    if (!manager) {
        return { success: false, error: 'Feed-forward manager not initialized' };
    }
    try {
        return await manager.enableSharing(params);
    }
    catch (error) {
        console.error('Error updating sharing:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error updating sharing' };
    }
}
/**
 * IPC Handler: Get trust score
 */
async function getTrustScore(event, params) {
    if (!manager) {
        return { success: false, error: 'Feed-forward manager not initialized' };
    }
    try {
        const result = await manager.getTrustScore(params.participantId);
        return { success: true, ...result };
    }
    catch (error) {
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
