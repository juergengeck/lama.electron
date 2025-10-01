/**
 * Federation Channel Sync Helper
 * Ensures channels are properly shared between browser and Node instances
 */
import { createAccess } from '@refinio/one.core/lib/access.js';
import { SET_ACCESS_MODE } from '@refinio/one.core/lib/storage-base-common.js';
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';
/**
 * Grant federation access to a channel so both browser and Node can sync
 * @param {string} channelId - The channel ID (topic ID)
 * @param {string} channelOwner - The owner of the channel
 * @param {Array} federationGroupIds - Group IDs that should have access
 */
export async function grantFederationAccessToChannel(channelId, channelOwner, federationGroupIds) {
    try {
        console.log('[FederationChannelSync] Granting federation access to channel:', channelId);
        // Calculate the channel info hash
        const channelInfoHash = await calculateIdHashOfObj({
            $type$: 'ChannelInfo',
            id: channelId,
            owner: channelOwner
        });
        // Grant access to all federation groups
        await createAccess([{
                id: channelInfoHash,
                person: [],
                group: federationGroupIds,
                mode: SET_ACCESS_MODE.ADD
            }]);
        console.log('[FederationChannelSync] Access granted to federation groups:', federationGroupIds.length);
        return true;
    }
    catch (error) {
        console.error('[FederationChannelSync] Failed to grant federation access:', error);
        return false;
    }
}
/**
 * Ensure a channel exists and has proper federation access
 * This should be called by both browser and Node when creating channels
 */
export async function ensureFederatedChannel(channelManager, channelId, ownerId, federationGroup) {
    try {
        // Check if channel exists
        const existingChannels = await channelManager.getMatchingChannelInfos({
            channelId: channelId
        });
        if (existingChannels && existingChannels.length > 0) {
            console.log('[FederationChannelSync] Channel already exists:', channelId);
            // Ensure federation access is granted
            if (federationGroup) {
                for (const channelInfo of existingChannels) {
                    await grantFederationAccessToChannel(channelId, channelInfo.owner, [federationGroup.groupIdHash]);
                }
            }
            return existingChannels[0];
        }
        // Create the channel
        console.log('[FederationChannelSync] Creating federated channel:', channelId);
        await channelManager.createChannel(channelId, ownerId);
        // Grant federation access
        if (federationGroup) {
            await grantFederationAccessToChannel(channelId, ownerId, [federationGroup.groupIdHash]);
        }
        // Return the created channel info
        const channels = await channelManager.getMatchingChannelInfos({
            channelId: channelId
        });
        return channels[0];
    }
    catch (error) {
        console.error('[FederationChannelSync] Failed to ensure federated channel:', error);
        throw error;
    }
}
/**
 * Set up channel sync listeners between browser and Node
 * This ensures both instances react to channel updates
 */
export function setupChannelSyncListeners(channelManager, instanceName, onChannelUpdate) {
    console.log(`[FederationChannelSync] Setting up sync listeners for ${instanceName}`);
    // Listen for channel updates
    channelManager.onUpdated(async (channelInfoIdHash, channelId, channelOwner, timeOfEarliestChange, data) => {
        console.log(`[FederationChannelSync][${instanceName}] Channel updated:`, channelId);
        console.log(`[FederationChannelSync][${instanceName}] Data items:`, data.length);
        // Check for ChatMessage objects
        const chatMessages = data.filter((item) => item.$type$ === 'ChatMessage');
        if (chatMessages.length > 0) {
            console.log(`[FederationChannelSync][${instanceName}] Found ${chatMessages.length} chat messages`);
            // Notify about new messages
            if (onChannelUpdate) {
                onChannelUpdate(channelId, chatMessages);
            }
        }
    });
}
export default {
    grantFederationAccessToChannel,
    ensureFederatedChannel,
    setupChannelSyncListeners
};
