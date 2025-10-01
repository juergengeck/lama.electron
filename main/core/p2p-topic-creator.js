/**
 * P2P Topic Creator
 *
 * Automatically creates P2P topics/channels after successful pairing.
 * This ensures peers can immediately exchange messages without manual topic creation.
 */
import { wait } from '@refinio/one.core/lib/util/promise.js';
/**
 * Create a P2P topic for two participants
 *
 * @param {Object} topicModel - The TopicModel instance
 * @param {string} localPersonId - Local person ID
 * @param {string} remotePersonId - Remote person ID
 * @returns {Promise<Object>} The created topic
 */
export async function createP2PTopic(topicModel, localPersonId, remotePersonId) {
    // Generate P2P topic ID (lexicographically sorted)
    const topicId = localPersonId < remotePersonId
        ? `${localPersonId}<->${remotePersonId}`
        : `${remotePersonId}<->${localPersonId}`;
    console.log('[P2PTopicCreator] Creating P2P topic:', topicId);
    console.log('[P2PTopicCreator]   Local person:', localPersonId?.substring(0, 8));
    console.log('[P2PTopicCreator]   Remote person:', remotePersonId?.substring(0, 8));
    try {
        // Check if topic already exists by trying to enter it
        const existingTopicRoom = await topicModel.enterTopicRoom(topicId);
        if (existingTopicRoom) {
            console.log('[P2PTopicCreator] Topic already exists:', topicId);
            return existingTopicRoom;
        }
    }
    catch (error) {
        // Topic doesn't exist, proceed to create it
        console.log('[P2PTopicCreator] Topic does not exist yet, creating...');
    }
    try {
        // Create the P2P topic using TopicModel's createOneToOneTopic
        // This method properly handles:
        // - Creating a shared channel (null owner)
        // - Setting up proper access for both participants
        // - Creating the Topic object
        const topic = await topicModel.createOneToOneTopic(localPersonId, remotePersonId);
        console.log('[P2PTopicCreator] ✅ P2P topic created successfully:', topicId);
        // Enter the topic room to verify it's working
        const topicRoom = await topicModel.enterTopicRoom(topicId);
        console.log('[P2PTopicCreator] ✅ Successfully entered topic room');
        return topicRoom;
    }
    catch (error) {
        console.error('[P2PTopicCreator] Failed to create P2P topic:', error);
        throw error;
    }
}
/**
 * Automatically create P2P topic after pairing success
 *
 * @param {Object} params - Parameters
 * @param {Object} params.topicModel - TopicModel instance
 * @param {Object} params.channelManager - ChannelManager instance
 * @param {string} params.localPersonId - Local person ID
 * @param {string} params.remotePersonId - Remote person ID
 * @param {boolean} params.initiatedLocally - Whether we initiated the pairing
 */
export async function autoCreateP2PTopicAfterPairing(params) {
    const { topicModel, channelManager, localPersonId, remotePersonId, initiatedLocally } = params;
    console.log('[P2PTopicCreator] 🤖 Auto-creating P2P topic after pairing');
    console.log('[P2PTopicCreator]   Initiated locally:', initiatedLocally);
    console.log('[P2PTopicCreator]   Local:', localPersonId?.substring(0, 8));
    console.log('[P2PTopicCreator]   Remote:', remotePersonId?.substring(0, 8));
    // Wait a moment for trust establishment to complete
    await wait(2000);
    try {
        // Create the P2P topic
        const topicRoom = await createP2PTopic(topicModel, localPersonId, remotePersonId);
        // Generate the P2P channel ID
        const channelId = localPersonId < remotePersonId
            ? `${localPersonId}<->${remotePersonId}`
            : `${remotePersonId}<->${localPersonId}`;
        // Ensure the channel exists in ChannelManager
        await channelManager.createChannel(channelId, null); // null owner for P2P
        console.log('[P2PTopicCreator] ✅ P2P topic and channel ready for messaging');
        // Grant person-specific access (not group access)
        const { grantP2PChannelAccess } = await import('./p2p-channel-access.js');
        await grantP2PChannelAccess(channelId, localPersonId, remotePersonId, channelManager);
        console.log('[P2PTopicCreator] ✅ Access rights configured for P2P channel');
        // If we initiated the pairing, send a welcome message
        if (initiatedLocally) {
            try {
                console.log('[P2PTopicCreator] Sending welcome message...');
                // Use sendMessage with null channelOwner for P2P (shared channel)
                await topicRoom.sendMessage('👋 Hello! Connection established.', undefined, null);
                console.log('[P2PTopicCreator] ✅ Welcome message sent');
            }
            catch (msgError) {
                console.log('[P2PTopicCreator] Could not send welcome message:', msgError.message);
            }
        }
        return topicRoom;
    }
    catch (error) {
        console.error('[P2PTopicCreator] Failed to auto-create P2P topic:', error);
        // If we fail, it might be because the other peer is also trying to create it
        // Wait and try to enter the room instead
        await wait(3000);
        try {
            const channelId = localPersonId < remotePersonId
                ? `${localPersonId}<->${remotePersonId}`
                : `${remotePersonId}<->${localPersonId}`;
            const topicRoom = await topicModel.enterTopicRoom(channelId);
            console.log('[P2PTopicCreator] ✅ Entered existing topic room created by peer');
            return topicRoom;
        }
        catch (retryError) {
            console.error('[P2PTopicCreator] Failed to enter existing topic:', retryError);
            throw retryError;
        }
    }
}
/**
 * Handle incoming messages for P2P topics that don't exist yet
 *
 * @param {Object} params - Parameters
 * @param {Object} params.topicModel - TopicModel instance
 * @param {Object} params.channelManager - ChannelManager instance
 * @param {Object} params.leuteModel - LeuteModel instance
 * @param {string} params.channelId - The channel ID where message was received
 * @param {Object} params.message - The received message
 */
export async function ensureP2PTopicForIncomingMessage(params) {
    const { topicModel, channelManager, leuteModel, channelId, message } = params;
    // Check if this is a P2P channel
    if (!channelId.includes('<->')) {
        return; // Not a P2P channel
    }
    console.log('[P2PTopicCreator] 📨 Received message in P2P channel:', channelId);
    // Extract person IDs from channel ID
    const [id1, id2] = channelId.split('<->');
    // Determine which is local and which is remote
    const me = await leuteModel.me();
    const localPersonId = await me.mainIdentity();
    let remotePersonId;
    if (localPersonId === id1) {
        remotePersonId = id2;
    }
    else if (localPersonId === id2) {
        remotePersonId = id1;
    }
    else {
        console.error('[P2PTopicCreator] Channel does not include our person ID');
        return;
    }
    // Try to enter the topic room
    try {
        const topicRoom = await topicModel.enterTopicRoom(channelId);
        console.log('[P2PTopicCreator] Topic already exists');
        return topicRoom;
    }
    catch (error) {
        // Topic doesn't exist, create it
        console.log('[P2PTopicCreator] Topic does not exist, creating for incoming message...');
        try {
            // createP2PTopic now returns a TopicRoom
            const topicRoom = await createP2PTopic(topicModel, localPersonId, remotePersonId);
            // Ensure channel exists and has proper access
            await channelManager.createChannel(channelId, null);
            const { grantP2PChannelAccess } = await import('./p2p-channel-access.js');
            await grantP2PChannelAccess(channelId, localPersonId, remotePersonId, channelManager);
            console.log('[P2PTopicCreator] ✅ Created P2P topic for incoming message');
            return topicRoom;
        }
        catch (createError) {
            console.error('[P2PTopicCreator] Failed to create topic for incoming message:', createError);
            throw createError;
        }
    }
}
