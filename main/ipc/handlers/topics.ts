import type { ChannelManager } from '@refinio/one.models/lib/models/index.js';
/**
 * IPC handlers for topic operations (TypeScript)
 */

import { IpcMainInvokeEvent } from 'electron';
import nodeOneCore from '../../core/node-one-core.js';

interface TopicResult {
  success: boolean;
  topicId?: string;
  error?: string;
}

/**
 * Get or create a one-to-one topic for a contact
 */
export async function getOrCreateTopicForContact(
  event: IpcMainInvokeEvent,
  contactId: string
): Promise<TopicResult> {
  console.log('[Topics IPC] Getting or creating topic for contact:', contactId);

  // nodeOneCore is already the instance, not a class
  const nodeInstance = nodeOneCore;
  if (!nodeInstance || !nodeInstance.initialized) {
    console.error('[Topics IPC] No Node.js ONE.core instance available');
    return { success: false, error: 'No Node.js ONE.core instance' };
  }

  try {
    const topicModel = nodeInstance.topicModel;
    const channelManager: ChannelManager = nodeInstance.channelManager;
    const myPersonId = nodeInstance.ownerId;

    if (!topicModel || !channelManager || !myPersonId) {
      console.error('[Topics IPC] Missing required models');
      return { success: false, error: 'Models not initialized' };
    }

    // For profile-based chat management, we use the Someone ID as the topic ID
    // This maintains compatibility with the legacy approach where chats are managed by profile
    const p2pTopicId = contactId;
    console.log('[Topics IPC] Using profile-based topic ID (Someone hash):', p2pTopicId);

    // Also get the Person ID for CHUM sync and permissions
    let targetPersonId = contactId;
    if (nodeInstance.leuteModel) {
      const others = await nodeInstance.leuteModel.others();
      const contact = others.find((c: any) => c.id === contactId);
      if (contact && (contact as any).personId) {
        targetPersonId = (contact as any).personId;
        console.log(`[Topics IPC] Found Person ID ${targetPersonId} for Someone ${contactId}`);
      }
    }

    // Ensure P2P channels exist using TopicGroupManager with profile-based approach
    if (nodeInstance.topicGroupManager) {
      await nodeInstance.topicGroupManager.ensureP2PChannelsForProfile(contactId, targetPersonId);
      console.log('[Topics IPC] Profile-based P2P channels ensured via TopicGroupManager');
    }

    // Return the P2P topic ID directly - no need to create it again
    console.log('[Topics IPC] Topic ready:', p2pTopicId);

    // For P2P conversations, the channel should already be created with null owner
    // by TopicGroupManager.ensureP2PChannelsForPeer
    // Don't create another channel with owner here
    console.log('[Topics IPC] P2P channel should already exist with null owner');

    return {
      success: true,
      topicId: p2pTopicId
    };
  } catch (error) {
    console.error('[Topics IPC] Failed to create topic:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}