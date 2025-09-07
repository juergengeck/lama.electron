/**
 * Topic Group Manager
 * Manages group creation for topics with proper participants
 */

import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { storeUnversionedObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import { createAccess } from '@refinio/one.core/lib/access.js';
import { SET_ACCESS_MODE } from '@refinio/one.core/lib/storage-base-common.js';
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';
import stateManager from '../state/manager.js';

class TopicGroupManager {
  constructor(nodeOneCore) {
    this.nodeOneCore = nodeOneCore;
    this.conversationGroups = new Map(); // topicId -> groupIdHash
  }

  /**
   * Create or get a conversation group for a topic
   * This group includes: browser owner, node owner, and AI assistant
   */
  async getOrCreateConversationGroup(topicId, aiPersonId = null) {
    // Check if we already have a group for this topic
    if (this.conversationGroups.has(topicId)) {
      return this.conversationGroups.get(topicId);
    }

    console.log(`[TopicGroupManager] Creating conversation group for topic: ${topicId}`);

    try {
      // Get all participants
      const participants = await this.getDefaultParticipants(aiPersonId);
      
      // Create a Group object with these members
      const groupName = `conversation-${topicId}`;
      const group = {
        $type$: 'Group',
        name: groupName,
        members: participants
      };

      // Store the group
      const storedGroup = await storeVersionedObject(group);
      const groupIdHash = storedGroup.idHash;
      
      console.log(`[TopicGroupManager] Created group ${groupName} with ${participants.length} members`);
      console.log(`[TopicGroupManager] Members:`, participants.map(p => p.substring(0, 8)).join(', '));

      // Cache the group
      this.conversationGroups.set(topicId, groupIdHash);

      // Grant the group access to itself (so members can see the group)
      await createAccess([{
        id: groupIdHash,
        person: [],
        group: [groupIdHash],
        mode: SET_ACCESS_MODE.ADD
      }]);

      // Also grant direct access to all group members to ensure they can see the group
      // This is important for browser to see the group object
      await createAccess([{
        id: groupIdHash,
        person: participants,  // All members get direct access
        group: [],
        mode: SET_ACCESS_MODE.ADD
      }]);

      console.log(`[TopicGroupManager] Granted access to group for all ${participants.length} members`);

      return groupIdHash;
    } catch (error) {
      console.error('[TopicGroupManager] Failed to create conversation group:', error);
      throw error;
    }
  }

  /**
   * Get default participants for a conversation
   */
  async getDefaultParticipants(aiPersonId = null) {
    const participants = [];

    // 1. Node owner (always included)
    if (this.nodeOneCore.ownerId) {
      participants.push(this.nodeOneCore.ownerId);
      console.log('[TopicGroupManager] Added node owner:', this.nodeOneCore.ownerId.substring(0, 8));
    }

    // 2. Browser owner (if different from node owner)
    const browserPersonId = this.getBrowserPersonId();
    if (browserPersonId && browserPersonId !== this.nodeOneCore.ownerId) {
      participants.push(browserPersonId);
      console.log('[TopicGroupManager] Added browser owner:', browserPersonId.substring(0, 8));
    }

    // 3. AI assistant (if provided or get default)
    const aiPerson = aiPersonId || this.getDefaultAIPersonId();
    if (aiPerson && !participants.includes(aiPerson)) {
      participants.push(aiPerson);
      console.log('[TopicGroupManager] Added AI assistant:', aiPerson.substring(0, 8));
    }

    return participants;
  }

  /**
   * Get browser person ID from state or federation
   */
  getBrowserPersonId() {
    // Try from state manager first
    const browserPersonId = stateManager.getState('browserPersonId');
    if (browserPersonId) {
      return browserPersonId;
    }

    // Try from federation group members
    if (this.nodeOneCore.federationGroup?.members) {
      // Federation group should have browser and node persons
      const members = this.nodeOneCore.federationGroup.members;
      // Return the first member that's not the node owner
      return members.find(m => m !== this.nodeOneCore.ownerId);
    }

    return null;
  }

  /**
   * Get default AI person ID
   */
  getDefaultAIPersonId() {
    // Get from AI contact manager
    if (this.nodeOneCore.aiContactManager) {
      const contacts = this.nodeOneCore.aiContactManager.getAllContacts();
      if (contacts.length > 0) {
        // Return the first AI contact's person ID
        return contacts[0].personId;
      }
    }

    // Get from AI assistant model
    if (this.nodeOneCore.aiAssistantModel?.availableLLMModels?.length > 0) {
      return this.nodeOneCore.aiAssistantModel.availableLLMModels[0].personId;
    }

    return null;
  }

  /**
   * Create a topic with the conversation group
   */
  async createGroupTopic(topicName, topicId, aiPersonId = null) {
    console.log(`[TopicGroupManager] Creating group topic: ${topicName} (${topicId})`);

    // First create the conversation group
    const groupIdHash = await this.getOrCreateConversationGroup(topicId, aiPersonId);

    // Create the topic using TopicModel
    if (!this.nodeOneCore.topicModel) {
      throw new Error('TopicModel not initialized');
    }

    // Create the topic with the first participant as owner (Node owner)
    // This creates the Node's channel, others will be created below
    const topic = await this.nodeOneCore.topicModel.createGroupTopic(
      topicName,
      topicId,
      this.nodeOneCore.ownerId
    );

    // Add the conversation group to the topic
    await this.nodeOneCore.topicModel.addGroupToTopic(groupIdHash, topic);

    // Also share the topic directly with browser owner to ensure visibility
    const browserPersonId = this.getBrowserPersonId();
    if (browserPersonId) {
      const { calculateHashOfObj } = await import('@refinio/one.core/lib/util/object.js');
      const topicHash = await calculateHashOfObj(topic);
      
      await createAccess([{
        object: topicHash,
        person: [browserPersonId],
        group: [],
        mode: SET_ACCESS_MODE.ADD
      }]);
      
      console.log(`[TopicGroupManager] Granted browser ${browserPersonId.substring(0, 8)} direct access to topic`);
    }

    console.log(`[TopicGroupManager] Topic ${topicId} created with group ${groupIdHash.substring(0, 8)}`);

    // Create channels for OTHER participants (Node owner's channel was already created above)
    const participants = await this.getDefaultParticipants(aiPersonId);
    
    for (const participantId of participants) {
      // Skip Node owner since their channel was already created by createGroupTopic
      if (participantId === this.nodeOneCore.ownerId) {
        console.log(`[TopicGroupManager] Node owner channel already created for ${participantId.substring(0, 8)}`);
        continue;
      }
      
      if (participantId && this.nodeOneCore.channelManager) {
        try {
          // Create a channel with topicId, owned by this participant
          await this.nodeOneCore.channelManager.createChannel(topicId, participantId);
          console.log(`[TopicGroupManager] Created channel for participant ${participantId.substring(0, 8)} on topic ${topicId}`);
          
          // Grant group access to this participant's channel
          const channelHash = await calculateIdHashOfObj({
            $type$: 'ChannelInfo',
            id: topicId,
            owner: participantId
          });
          
          await createAccess([{
            id: channelHash,
            person: [],
            group: [groupIdHash],
            mode: SET_ACCESS_MODE.ADD
          }]);
          
          console.log(`[TopicGroupManager] Granted group access to channel owned by ${participantId.substring(0, 8)}`);
        } catch (error) {
          console.warn(`[TopicGroupManager] Channel for ${participantId.substring(0, 8)} might already exist:`, error.message);
        }
      }
    }

    return topic;
  }

  /**
   * Add participants to existing topic's group
   */
  async addParticipantsToTopic(topicId, participants) {
    const groupIdHash = this.conversationGroups.get(topicId);
    if (!groupIdHash) {
      throw new Error(`No group found for topic ${topicId}`);
    }

    // Grant access to the new participants
    await createAccess([{
      id: groupIdHash,
      person: participants,
      group: [],
      mode: SET_ACCESS_MODE.ADD
    }]);

    console.log(`[TopicGroupManager] Added ${participants.length} participants to topic ${topicId}`);
  }
}

export default TopicGroupManager;