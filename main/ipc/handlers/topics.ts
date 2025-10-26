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

    // Check if this is an AI contact
    let isAI = false;
    let contactName = 'Contact';
    if (nodeInstance.leuteModel) {
      const others = await nodeInstance.leuteModel.others();
      const contact = others.find((c: any) => c.id === contactId);
      if (contact) {
        const personId = await contact.mainIdentity();

        // Check if AI using LLMObjectManager
        if (nodeInstance.aiAssistantModel?.llmObjectManager) {
          isAI = nodeInstance.aiAssistantModel.llmObjectManager.isLLMPerson(personId);
          console.log(`[Topics IPC] Contact ${contactId.substring(0, 8)} isAI: ${isAI}`);
        }

        // Get contact name
        const profile = await contact.mainProfile();
        if (profile?.personDescriptions) {
          const nameDesc = profile.personDescriptions.find((d: any) => d.$type$ === 'PersonName') as any;
          if (nameDesc?.name) {
            contactName = nameDesc.name;
          }
        }
      }
    }

    // For AI contacts, use chat:createConversation to properly set up the group and trigger handleNewTopic
    if (isAI) {
      console.log('[Topics IPC] AI contact detected - creating conversation via chat handler');

      // Import chat handler
      const { chatHandlers } = await import('./chat.js');

      // Create conversation with AI participant
      const result = await chatHandlers.createConversation(event, {
        type: 'group', // AI conversations are always groups (even 1-on-1)
        participants: [contactId], // Pass contact ID
        name: contactName
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create AI conversation');
      }

      console.log('[Topics IPC] AI conversation created:', result.data?.id);
      return {
        success: true,
        topicId: result.data.id
      };
    }

    // For non-AI P2P contacts, use the existing profile-based approach
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

/**
 * Record feedback (like/dislike) for a subject
 */
export async function recordSubjectFeedback(
  event: IpcMainInvokeEvent,
  params: { subjectId: string; feedbackType: 'like' | 'dislike' }
): Promise<{ success: boolean; subject?: any; error?: string }> {
  console.log(`[Topics IPC] Recording ${params.feedbackType} for subject:`, params.subjectId);

  const nodeInstance = nodeOneCore;
  if (!nodeInstance || !nodeInstance.initialized) {
    console.error('[Topics IPC] No Node.js ONE.core instance available');
    return { success: false, error: 'No Node.js ONE.core instance' };
  }

  try {
    const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
    const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
    const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/util/object.js');

    // Get the subject by ID
    const result: any = await getObjectByIdHash(params.subjectId as any);
    if (!result || !result.obj) {
      console.error('[Topics IPC] Subject not found:', params.subjectId);
      return { success: false, error: 'Subject not found' };
    }

    const subject: any = result.obj;
    console.log('[Topics IPC] Found subject:', subject.id, 'Current likes:', subject.likes, 'dislikes:', subject.dislikes);

    // Update feedback counters
    if (params.feedbackType === 'like') {
      subject.likes = (subject.likes || 0) + 1;
    } else {
      subject.dislikes = (subject.dislikes || 0) + 1;
    }

    // Store updated subject
    const storeResult = await storeVersionedObject(subject);
    console.log(`[Topics IPC] Updated subject ${subject.id} - likes: ${subject.likes}, dislikes: ${subject.dislikes}`);

    return {
      success: true,
      subject: {
        id: subject.id,
        likes: subject.likes,
        dislikes: subject.dislikes
      }
    };
  } catch (error) {
    console.error('[Topics IPC] Failed to record feedback:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}