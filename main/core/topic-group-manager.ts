import type { ChannelManager } from '@refinio/one.models/lib/models/index.js';
/**
 * Topic Group Manager
 * Manages group creation for topics with proper participants
 */

import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { storeUnversionedObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import { createAccess } from '@refinio/one.core/lib/access.js';
import { SET_ACCESS_MODE } from '@refinio/one.core/lib/storage-base-common.js';
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { NodeOneCore, TopicGroupManager as ITopicGroupManager } from '../types/one-core.js';
import stateManager from '../state/manager.js';

class TopicGroupManager {

  getAllContacts: any;
  federationGroup: any;
  availableLLMModels: any;
  person: any;
  name: any;
  getTopicByName: any;
  getActiveCHUMConnections: any;
  nodeOneCore: NodeOneCore;
  conversationGroups: Map<string, SHA256IdHash<any>>;

  constructor(nodeOneCore: NodeOneCore) {
    this.nodeOneCore = nodeOneCore;
    this.conversationGroups = new Map(); // topicId -> groupIdHash
  }

  /**
   * Check if a conversation is P2P (2 participants)
   */
  isP2PConversation(conversationId: any): any {
    // Check if it's the P2P format: personId1<->personId2
    const p2pRegex = /^([0-9a-f]{64})<->([0-9a-f]{64})$/
    return p2pRegex.test(conversationId)
  }

  /**
   * Create or get a conversation group for a topic
   * This group includes: browser owner, node owner, and AI assistant
   */
  async getOrCreateConversationGroup(topicId: any, aiPersonId = null): Promise<unknown> {
    // Check if we already have a group for this topic
    if (this.conversationGroups.has(topicId)) {
      return this.conversationGroups.get(topicId);
    }

    console.log(`[TopicGroupManager] Creating conversation group for topic: ${topicId}`);

    // CRITICAL: Do not create groups if we don't have an owner ID yet
    if (!this.nodeOneCore.ownerId) {
      console.error('[TopicGroupManager] Cannot create group - nodeOneCore.ownerId is not set!');
      throw new Error('Cannot create group without owner ID');
    }

    try {
      // Get all participants
      const participants: any = await this.getDefaultParticipants(aiPersonId);
      
      // Create a Group object with these members
      const groupName = `conversation-${topicId}`;
      const group = {
        $type$: 'Group' as const,
        name: groupName,
        person: participants  // Group recipe expects 'person' not 'members'
      };

      // Store the group
      const storedGroup: any = await storeVersionedObject(group as any);
      const groupIdHash = storedGroup.idHash;
      
      console.log(`[TopicGroupManager] Created group ${groupName} with ${participants.length} persons`);
      console.log(`[TopicGroupManager] Persons:`, participants.map((p: any) => String(p).substring(0, 8)).join(', '));

      // Cache the group
      this.conversationGroups.set(topicId, groupIdHash);

      // IMPORTANT: Do NOT grant any access to the Group object itself
      // This would cause CHUM to try to sync the Group object, which is rejected
      // Groups stay local - only IdAccess objects referencing them are shared
      // The group will be used in IdAccess objects to grant access to channels
      console.log(`[TopicGroupManager] Created local group ${String(groupIdHash).substring(0, 8)} - will use for channel access control`);

      return groupIdHash;
    } catch (error) {
      console.error('[TopicGroupManager] Failed to create conversation group:', error);
      throw error;
    }
  }

  /**
   * Get default participants for a conversation
   * This returns the minimal set - actual conversations will add more participants
   */
  async getDefaultParticipants(aiPersonId = null): Promise<unknown> {
    const participants = [];

    // 1. Node owner (always included - this is the local user)
    if (this.nodeOneCore.ownerId) {
      participants.push(this.nodeOneCore.ownerId);
      console.log('[TopicGroupManager] Added node owner:', this.nodeOneCore.ownerId?.substring(0, 8));
    }

    // 2. Specific AI assistant if provided
    if (aiPersonId) {
      participants.push(aiPersonId);
      console.log('[TopicGroupManager] Added specified AI assistant:', String(aiPersonId).substring(0, 8));
    }

    // Note: This is just the default/minimal set
    // Actual conversations will add specific participants via addParticipantsToGroup

    return participants;
  }

  /**
   * Add participants to a conversation group
   * @deprecated Use addParticipantsToTopic() instead
   */
  async addParticipantsToGroup(topicId: any, participantIds: any): Promise<any> {
    console.log(`[TopicGroupManager] addParticipantsToGroup() called - delegating to addParticipantsToTopic()`);
    return this.addParticipantsToTopic(topicId, participantIds);
  }

  /**
   * Get browser person ID from state or federation
   */
  getBrowserPersonId(): any {
    // Try from state manager first
    const browserPersonId = stateManager.getState('browserPersonId');
    if (browserPersonId) {
      return browserPersonId;
    }

    // Try from federation group members
    if ((this.nodeOneCore as any).federationGroup?.members) {
      // Federation group should have browser and node persons
      const members = (this.nodeOneCore as any).federationGroup.members;
      // Return the first member that's not the node owner
      return members.find((m: any) => m !== this.nodeOneCore.ownerId);
    }

    return null;
  }

  /**
   * Get default AI person ID
   */
  getDefaultAIPersonId(): any {
    // Get from AI assistant model
    if (this.nodeOneCore.aiAssistantModel) {
      const contacts = this.nodeOneCore.aiAssistantModel.getAllContacts();
      if (contacts.length > 0) {
        // Return the first AI contact's person ID
        return (contacts[0] as { personId: string }).personId;
      }
    }

    // Get from AI assistant model
    if (this.nodeOneCore.aiAssistantModel?.availableLLMModels?.length > 0) {
      return ((this.nodeOneCore.aiAssistantModel as any).availableLLMModels[0] as { personId: string }).personId;
    }

    return null;
  }

  /**
   * Add a remote participant to relevant conversation groups
   * This is called when a CHUM connection is established
   * For group chats: adds them to groups where they should be a member
   * For P2P: ensures the P2P conversation structure exists
   * @param {string} remotePersonId - The person ID to add to relevant groups
   */
  async addRemoteParticipantToRelevantGroups(remotePersonId: any): Promise<any> {
    console.log(`[TopicGroupManager] Adding remote participant ${String(remotePersonId).substring(0, 8)} to relevant conversation groups`);
    
    // For group chats, we need to:
    // 1. Find all group conversations where this remote should be a member
    // 2. Add them to those groups
    // 3. Let them know they need to create their own channels
    
    // For now, we'll handle P2P conversations
    // Group chat membership should be managed explicitly when creating the group
    
    // Generate the P2P topic ID for this remote participant
    const sortedIds = [this.nodeOneCore.ownerId, remotePersonId].sort();
    const p2pTopicId = `${sortedIds[0]}<->${sortedIds[1]}`;
    
    // Check if we have a P2P conversation with this peer
    const groupIdHash = this.conversationGroups.get(p2pTopicId);
    
    if (groupIdHash) {
      try {
        console.log(`[TopicGroupManager] P2P conversation exists with ${String(remotePersonId).substring(0, 8)}: ${p2pTopicId}`);
        // The group already exists and both parties should be members
        // Just ensure access is granted
        await this.ensureGroupAccess(groupIdHash, remotePersonId);
      } catch (error) {
        console.warn(`[TopicGroupManager] Failed to ensure P2P group access:`, (error as Error).message);
      }
    }
    
    // For group chats: Remote peers need to be explicitly added when the group is created
    // They will receive the Group object through CHUM sync if they're members
    // They need to create their own channels when they detect the group
    
    console.log(`[TopicGroupManager] Completed processing groups for remote participant`);
  }
  
  /**
   * Ensure a remote participant has access to a group they're a member of
   */
  async ensureGroupAccess(groupIdHash: any, remotePersonId: any): Promise<any> {
    // IMPORTANT: Do NOT grant person-based access to the Group object itself
    // This would cause CHUM to try to sync the Group object, which is rejected
    // Groups stay local - only IdAccess objects referencing them are shared (for channel access)
    console.log(`[TopicGroupManager] Note: Groups are local objects, not syncing group ${String(groupIdHash).substring(0, 8)} to ${String(remotePersonId).substring(0, 8)}`);
  }

  /**
   * Add a remote participant to a specific conversation group
   * @param {string} topicId - The topic ID
   * @param {string} groupIdHash - The group's ID hash
   * @param {string} remotePersonId - The person ID to add
   */
  async addRemoteParticipantToGroup(topicId: any, groupIdHash: any, remotePersonId: any): Promise<any> {
    console.log(`[TopicGroupManager] Adding ${String(remotePersonId).substring(0, 8)} to group for topic ${topicId}`);

    try {
      // Retrieve the existing group object
      const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
      const result: any = await getObjectByIdHash(groupIdHash);
      const existingGroup: any = result.obj;
      
      if (!existingGroup) {
        throw new Error(`Group ${groupIdHash} not found`);
      }
      
      // Check if the person is already in the group
      if (existingGroup.person && existingGroup.person.includes(remotePersonId)) {
        console.log(`[TopicGroupManager] ${String(remotePersonId).substring(0, 8)} is already in the group`);
        return;
      }
      
      // Create an updated group with the new participant
      const updatedGroup = {
        $type$: 'Group' as const,
        name: existingGroup.name,
        person: [...(existingGroup.person || []), remotePersonId]
      };

      // Store the updated group (this creates a new version)
      const storedGroup: any = await storeVersionedObject(updatedGroup as any);
      const newGroupIdHash = storedGroup.idHash;
      
      // Update our cache
      this.conversationGroups.set(topicId, newGroupIdHash);
      
      console.log(`[TopicGroupManager] Updated group for topic ${topicId} with new member`);
      console.log(`[TopicGroupManager] New group members:`, updatedGroup.person.map(p => String(p).substring(0, 8)).join(', '));

      // IMPORTANT: Do NOT grant person-based access to the Group object itself
      // This would cause CHUM to try to sync the Group object, which is rejected
      // Groups stay local - only IdAccess objects referencing them are shared

      // Create a channel for the remote participant in this topic
      if (this.nodeOneCore.channelManager) {
        await this.nodeOneCore.channelManager.createChannel(topicId, remotePersonId);
        
        // Grant the group access to the remote participant's channel
        const channelHash: any = await calculateIdHashOfObj({
          $type$: 'ChannelInfo',
          id: topicId,
          owner: remotePersonId
        });
        
        await createAccess([{
          id: channelHash,
          person: [],
          group: [newGroupIdHash],
          mode: SET_ACCESS_MODE.ADD
        }]);
        
        console.log(`[TopicGroupManager] Created channel and granted group access for ${String(remotePersonId).substring(0, 8)}`);
      }
      
      // Update the topic to use the new group
      if (this.nodeOneCore.topicModel) {
        const topic: any = await (this.nodeOneCore.topicModel as any).getTopicByName(topicId);
        if (topic) {
          await this.nodeOneCore.topicModel.addGroupToTopic(newGroupIdHash, topic);
          console.log(`[TopicGroupManager] Updated topic ${topicId} with new group`);
        }
      }
      
    } catch (error) {
      console.error(`[TopicGroupManager] Failed to add remote participant to group:`, error);
      throw error;
    }
  }

  /**
   * Create a P2P topic following one.leute reference patterns exactly
   * @param {string} topicName - Display name for the topic
   * @param {string} topicId - Topic ID in format: personId1<->personId2
   * @param {Array<string>} participantIds - Array of exactly 2 person IDs
   */
  async createP2PTopic(topicName: any, topicId: any, participantIds: any): Promise<any> {
    console.log(`[TopicGroupManager] Creating P2P topic: ${topicName} (${topicId})`)
    console.log(`[TopicGroupManager] P2P participants:`, participantIds.map((p: any) => String(p).substring(0, 8)).join(', '))

    if (participantIds.length !== 2) {
      throw new Error(`P2P topic requires exactly 2 participants, got ${participantIds.length}`)
    }

    if (!this.nodeOneCore.topicModel) {
      throw new Error('TopicModel not initialized')
    }

    // Use createOneToOneTopic - this creates deterministic topic with proper access
    const [from, to] = participantIds
    const topic: any = await this.nodeOneCore.topicModel.createOneToOneTopic(from, to)

    console.log(`[TopicGroupManager] ✅ P2P topic created: ${topic.id}`)
    console.log(`[TopicGroupManager] ✅ Channel: ${topic.channel?.substring(0, 16)}...`)

    // Verify the topic ID matches our expected format
    if (topic.id !== topicId) {
      console.warn(`[TopicGroupManager] ⚠️  Topic ID mismatch: expected ${topicId}, got ${topic.id}`)
    }

    return topic
  }

  /**
   * Create a topic with the conversation group - compatible with one.leute architecture
   * In one.leute: ONE topic ID, MULTIPLE channels (one per participant)
   * @param {string} topicName - Display name for the topic
   * @param {string} topicId - Unique ID for the topic
   * @param {Array<string>} participantIds - Array of person IDs (humans, AIs, etc) to include
   * @param {boolean} autoAddChumConnections - Whether to automatically add all CHUM connections (default: false)
   */
  async createGroupTopic(topicName: any, topicId: any, participantIds = [], autoAddChumConnections = false): Promise<unknown> {
    console.log(`[TopicGroupManager] 🔍 DEBUG Creating topic: "${topicName}" with ID: "${topicId}"`);
    console.log(`[TopicGroupManager] 🔍 DEBUG Initial participants: ${participantIds.length} persons`);
    console.log(`[TopicGroupManager] 🔍 DEBUG topicId type: ${typeof topicId}, length: ${topicId?.length}`);

    // P2P conversations MUST use createOneToOneTopic directly - no groups
    const isP2P = topicId.includes('<->');
    console.log(`[TopicGroupManager] Is P2P conversation: ${isP2P}`);

    if (isP2P) {
      // P2P conversations should NEVER reach this method
      // They should go directly through TopicModel.createOneToOneTopic
      throw new Error(`P2P conversation ${topicId} should use TopicModel.createOneToOneTopic, not createGroupTopic`);
    }

    // Always include the node owner
    if (!participantIds.includes(this.nodeOneCore.ownerId)) {
      participantIds.unshift(this.nodeOneCore.ownerId);
    }

    // Add CHUM connections for group chats
    if (autoAddChumConnections) {
      const activeChumConnections = (this.nodeOneCore as any).getActiveCHUMConnections();
      for (const chumPersonId of activeChumConnections) {
        if (!participantIds.includes(chumPersonId)) {
          participantIds.push(chumPersonId);
          console.log(`[TopicGroupManager] Added active CHUM connection ${String(chumPersonId).substring(0, 8)}... to group`);
        }
      }
    }

    console.log(`[TopicGroupManager] Final participants: ${participantIds.length} persons`);
    console.log(`[TopicGroupManager] Participant IDs:`, participantIds.map(p => String(p).substring(0, 8)).join(', '));

    // Create the conversation group with all participants
    const groupName = `conversation-${topicId}`;
    const group = {
      $type$: 'Group' as const,
      name: groupName,
      person: participantIds  // All participants including node owner, AIs, other contacts
    };

    // Store the group
    const storedGroup: any = await storeVersionedObject(group as any);
    const groupIdHash = storedGroup.idHash;

    console.log(`[TopicGroupManager] Created group ${groupName} with ${participantIds.length} persons`);
    console.log(`[TopicGroupManager] Persons:`, participantIds.map(p => String(p).substring(0, 8)).join(', '));

    // Cache the group
    this.conversationGroups.set(topicId, groupIdHash);

    // Grant all members access to the group object itself
    await createAccess([{
      id: groupIdHash,
      person: participantIds,  // All members get direct access to see the group
      group: [],
      mode: SET_ACCESS_MODE.ADD
    }]);

    // Create the topic using TopicModel
    if (!this.nodeOneCore.topicModel) {
      throw new Error('TopicModel not initialized');
    }

    // Create the topic
    // Each participant always owns their own channel
    console.log(`[TopicGroupManager] 🔍 DEBUG Calling topicModel.createGroupTopic("${topicName}", "${topicId}", owner)`);
    const topic: any = await this.nodeOneCore.topicModel.createGroupTopic(
      topicName,
      topicId,
      this.nodeOneCore.ownerId
    );
    console.log(`[TopicGroupManager] 🔍 DEBUG Created topic with ID: "${topic.id}", name: "${topic.name}"`);
    console.log(`[TopicGroupManager] 🔍 DEBUG Topic channel hash: ${topic.channel?.substring(0, 16)}...`);

    console.log(`[TopicGroupManager] Created topic ${topicId}:`, {
      topicId: topic.id,
      channelIdHash: topic.channel,
      owner: this.nodeOneCore.ownerId?.substring(0, 8)
    });

    // Share the topic with the group
    await this.nodeOneCore.topicModel.addGroupToTopic(groupIdHash, topic);
    console.log(`[TopicGroupManager] Added group ${String(groupIdHash).substring(0, 8)} access to topic ${topicId}`);

    // Create additional channels based on conversation type
    // For P2P: The main channel is null-owner (created above), but we can create individual channels too
    // For Group: Create channels for local participants (ourselves and AI)
    for (const participantId of participantIds) {
      const isOurself = participantId === this.nodeOneCore.ownerId;
      const isAI = this.nodeOneCore.aiAssistantModel?.getAllContacts().some((c: any) =>
        c.personId === participantId
      );

      // Only create channels for local participants (ourselves and AI)
      // Remote participants must create their own channels
      const shouldCreateChannel = isOurself || isAI;

      if (shouldCreateChannel && participantId && this.nodeOneCore.channelManager) {
        try {
          // Check if channel already exists before creating
          const hasChannel = await this.nodeOneCore.channelManager.hasChannel(topicId, participantId);

          if (!hasChannel) {
            // Create a channel owned by this participant
            await this.nodeOneCore.channelManager.createChannel(topicId, participantId);
            const participantType = isAI ? 'AI' : (isOurself ? 'local' : 'remote');
            console.log(`[TopicGroupManager] Created channel for ${participantType} participant ${String(participantId).substring(0, 8)}`);
          } else {
            console.log(`[TopicGroupManager] Channel already exists for participant ${String(participantId).substring(0, 8)}`);
          }

          // Grant the group access to this participant's channel
          const channelHash: any = await calculateIdHashOfObj({
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

          console.log(`[TopicGroupManager] Granted group access to channel owned by ${String(participantId).substring(0, 8)}`);
        } catch (error) {
          console.warn(`[TopicGroupManager] Channel creation for ${String(participantId).substring(0, 8)} failed:`, (error as Error).message);
        }
      } else if (!isOurself && !isAI) {
        console.log(`[TopicGroupManager] Skipping channel creation for remote participant ${String(participantId).substring(0, 8)} - they will create it themselves`);
      }
    }

    console.log(`[TopicGroupManager] Topic ${topicId} created with group ${String(groupIdHash).substring(0, 8)}`);
    console.log(`[TopicGroupManager] Created channels for local and AI participants only`);

    // IMPORTANT: Architecture:
    // - ONE topic ID for the conversation
    // - MULTIPLE channels (one per participant) with the SAME topic ID
    // - Each participant writes to their OWN channel ONLY
    // - All participants can READ from all channels (via group access)
    // - leute.one's RawChannelEntriesCache only reads from ONE channel at a time
    console.log(`[TopicGroupManager] All participants have their own channels with topic ID: ${topicId}`);

    return topic;
  }


  /**
   * Add participants to existing topic's group
   */
  async addParticipantsToTopic(topicId: any, participants: any): Promise<any> {
    console.log(`[TopicGroupManager] ========== ADD PARTICIPANTS START ==========`);
    console.log(`[TopicGroupManager] Topic: ${topicId}`);
    console.log(`[TopicGroupManager] Adding participants:`, participants.map((p: any) => String(p).substring(0, 8)));

    let groupIdHash = this.conversationGroups.get(topicId);
    console.log(`[TopicGroupManager] Cache lookup result: ${groupIdHash ? String(groupIdHash).substring(0, 8) : 'NOT FOUND'}`);

    // Handle legacy topics that don't have groups yet
    if (!groupIdHash) {
      console.log(`[TopicGroupManager] No group found for topic ${topicId}, creating one now (legacy topic)`);

      // Get current topic participants if available
      let currentParticipants: any[] = [this.nodeOneCore.ownerId];

      try {
        // Try to get the AI model for this topic
        if (this.nodeOneCore.aiAssistantModel) {
          const modelId = this.nodeOneCore.aiAssistantModel.getModelIdForTopic(topicId);
          if (modelId) {
            const aiContacts = this.nodeOneCore.aiAssistantModel.getAllContacts();
            const aiContact = aiContacts.find((c: any) => c.modelId === modelId);
            if (aiContact) {
              currentParticipants.push((aiContact as any).personId);
            }
          }
        }
      } catch (e) {
        console.warn(`[TopicGroupManager] Could not get current participants for legacy topic:`, (e as Error).message);
      }

      // Create a group for this legacy topic with current participants PLUS new participants
      const allParticipants = [...currentParticipants, ...participants];
      console.log(`[TopicGroupManager] Creating NEW group with ${allParticipants.length} participants`);

      const groupName = `conversation-${topicId}`;
      const group = {
        $type$: 'Group' as const,
        name: groupName,
        person: allParticipants
      };

      const storedGroup: any = await storeVersionedObject(group as any);
      groupIdHash = storedGroup.idHash;

      console.log(`[TopicGroupManager] ✅ Stored NEW group with ID hash: ${String(groupIdHash).substring(0, 8)}`);
      console.log(`[TopicGroupManager] Group participants:`, allParticipants.map((p: any) => String(p).substring(0, 8)));

      // Cache the group
      this.conversationGroups.set(topicId, groupIdHash);
      console.log(`[TopicGroupManager] ✅ Cached group hash ${String(groupIdHash).substring(0, 8)} for topic ${topicId}`);

      console.log(`[TopicGroupManager] Created group for legacy topic ${topicId} with ${allParticipants.length} participants`);
    } else {
      console.log(`[TopicGroupManager] Group EXISTS in cache: ${String(groupIdHash).substring(0, 8)}`);

      // Group exists - retrieve it, add new participants, store new version
      const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
      console.log(`[TopicGroupManager] Retrieving group from storage using ID hash: ${String(groupIdHash).substring(0, 8)}`);

      const result: any = await getObjectByIdHash(groupIdHash);
      const existingGroup: any = result.obj;

      if (!existingGroup) {
        throw new Error(`Group ${String(groupIdHash).substring(0, 8)} not found`);
      }

      console.log(`[TopicGroupManager] Retrieved existing group with ${existingGroup.person?.length || 0} participants`);
      console.log(`[TopicGroupManager] Existing participants:`, (existingGroup.person || []).map((p: any) => String(p).substring(0, 8)));

      // Filter out participants that are already in the group
      const currentMembers = existingGroup.person || [];
      const newMembers = participants.filter((p: any) => !currentMembers.includes(p));

      if (newMembers.length === 0) {
        console.log(`[TopicGroupManager] All participants already in group for topic ${topicId}`);
        console.log(`[TopicGroupManager] ========== ADD PARTICIPANTS END (no changes) ==========`);
        return;
      }

      console.log(`[TopicGroupManager] Adding ${newMembers.length} NEW members to group`);

      // Create new version with added participants
      const updatedGroup = {
        $type$: 'Group' as const,
        name: existingGroup.name,
        person: [...currentMembers, ...newMembers]
      };

      console.log(`[TopicGroupManager] Storing UPDATED group with ${updatedGroup.person.length} participants`);
      const storedGroup: any = await storeVersionedObject(updatedGroup as any);
      const newGroupIdHash = storedGroup.idHash;

      console.log(`[TopicGroupManager] ✅ Stored UPDATED group with NEW ID hash: ${String(newGroupIdHash).substring(0, 8)}`);
      console.log(`[TopicGroupManager] OLD group hash: ${String(groupIdHash).substring(0, 8)}`);
      console.log(`[TopicGroupManager] NEW group hash: ${String(newGroupIdHash).substring(0, 8)}`);
      console.log(`[TopicGroupManager] Updated group participants:`, updatedGroup.person.map((p: any) => String(p).substring(0, 8)));

      // Update cache with new version
      this.conversationGroups.set(topicId, newGroupIdHash);
      console.log(`[TopicGroupManager] ✅ Updated cache: topic ${topicId} -> ${String(newGroupIdHash).substring(0, 8)}`);

      console.log(`[TopicGroupManager] Updated group for topic ${topicId}: added ${newMembers.length} new participants (total: ${updatedGroup.person.length})`);

      groupIdHash = newGroupIdHash;
    }

    // Grant access to the new participants
    await createAccess([{
      id: groupIdHash,
      person: participants,
      group: [],
      mode: SET_ACCESS_MODE.ADD
    }]);

    console.log(`[TopicGroupManager] ✅ Granted access to ${participants.length} participants for group ${String(groupIdHash).substring(0, 8)}`);
    console.log(`[TopicGroupManager] ========== ADD PARTICIPANTS END ==========`);
  }

  /**
   * Query IdAccess objects to find the group for a topic
   * This is the persistent way to find groups - IdAccess stores the topic→group relationship
   * @param {string} topicId - The topic ID
   * @returns {Promise<SHA256IdHash<Group> | null>} The group ID hash or null if not found
   */
  async getGroupForTopic(topicId: any): Promise<SHA256IdHash<any> | null> {
    console.log(`[TopicGroupManager] Querying IdAccess for group in topic: ${topicId}`);

    // First check cache
    if (this.conversationGroups.has(topicId)) {
      const cachedGroupIdHash = this.conversationGroups.get(topicId);
      console.log(`[TopicGroupManager] Found cached group: ${String(cachedGroupIdHash).substring(0, 8)}`);
      return cachedGroupIdHash!;
    }

    try {
      // Calculate the channel ID hash for this topic (owner = our person ID)
      const channelIdHash: any = await calculateIdHashOfObj({
        $type$: 'ChannelInfo',
        id: topicId,
        owner: this.nodeOneCore.ownerId
      });

      console.log(`[TopicGroupManager] Calculated channel ID hash: ${String(channelIdHash).substring(0, 8)}`);

      // Query IdAccess objects by channel ID using reverse map
      const { getAllEntries } = await import('@refinio/one.core/lib/reverse-map-query.js');
      const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');

      const idAccessHashes: any = await getAllEntries(channelIdHash, 'IdAccess');
      console.log(`[TopicGroupManager] Found ${idAccessHashes.length} IdAccess objects for channel`);

      // Find the first IdAccess with a group
      for (const idAccessHash of idAccessHashes) {
        const result: any = await getObject(idAccessHash);
        const idAccess: any = result.obj;

        if (idAccess && idAccess.group && idAccess.group.length > 0) {
          const groupIdHash = idAccess.group[0];
          console.log(`[TopicGroupManager] Found group in IdAccess: ${String(groupIdHash).substring(0, 8)}`);

          // Cache it for future lookups
          this.conversationGroups.set(topicId, groupIdHash);

          return groupIdHash;
        }
      }

      console.log(`[TopicGroupManager] No group found in IdAccess objects for topic ${topicId}`);
      return null;
    } catch (error) {
      console.error(`[TopicGroupManager] Error querying IdAccess:`, error);
      return null;
    }
  }

  /**
   * Get all participants for a topic from its group
   * @param {string} topicId - The topic ID
   * @returns {Promise<string[]>} Array of participant person IDs
   */
  async getTopicParticipants(topicId: any): Promise<string[]> {
    console.log(`[TopicGroupManager] ========== GET PARTICIPANTS START ==========`);
    console.log(`[TopicGroupManager] Topic: ${topicId}`);

    // Query IdAccess to find the group (this works across restarts)
    const groupIdHash = await this.getGroupForTopic(topicId);

    if (!groupIdHash) {
      console.log(`[TopicGroupManager] ⚠️  No group found for topic - needs to be created`);
      console.log(`[TopicGroupManager] ========== GET PARTICIPANTS END (no group) ==========`);
      throw new Error(`No group found for topic ${topicId}`);
    }

    console.log(`[TopicGroupManager] Retrieving group from storage using ID hash: ${String(groupIdHash).substring(0, 8)}`);

    const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
    const result: any = await getObjectByIdHash(groupIdHash);
    const group: any = result.obj;

    if (!group) {
      console.log(`[TopicGroupManager] ⚠️  Group object not found in storage - removing from cache`);
      this.conversationGroups.delete(topicId);
      console.log(`[TopicGroupManager] ========== GET PARTICIPANTS END (not found) ==========`);
      throw new Error(`Group ${String(groupIdHash).substring(0, 8)} not found in storage`);
    }

    console.log(`[TopicGroupManager] Retrieved group with ${group.person?.length || 0} participants`);
    console.log(`[TopicGroupManager] Participants:`, (group.person || []).map((p: any) => String(p).substring(0, 8)));

    if (!group.person || group.person.length === 0) {
      console.log(`[TopicGroupManager] ⚠️  BROKEN GROUP DETECTED: Group ${String(groupIdHash).substring(0, 8)} has no participants`);
      console.log(`[TopicGroupManager] This is a legacy bug - removing from cache so it will be recreated`);
      this.conversationGroups.delete(topicId);
      console.log(`[TopicGroupManager] ========== GET PARTICIPANTS END (broken group) ==========`);
      throw new Error(`No group found for topic ${topicId}`);
    }

    console.log(`[TopicGroupManager] ✅ Returning ${group.person.length} participants`);
    console.log(`[TopicGroupManager] ========== GET PARTICIPANTS END ==========`);
    return group.person;
  }

  /**
   * Ensure participant has their own channel for a group they're part of
   * This should be called when a participant discovers they're in a group
   * @param {string} topicId - The topic ID
   * @param {string} groupIdHash - The group's ID hash
   */
  async ensureParticipantChannel(topicId: any, groupIdHash: any): Promise<any> {
    console.log(`[TopicGroupManager] Ensuring participant has channel for topic ${topicId}`);

    if (!this.nodeOneCore.channelManager) {
      throw new Error('ChannelManager not initialized');
    }

    try {
      // Check if we already have our channel
      const hasChannel = await this.nodeOneCore.channelManager.hasChannel(topicId, this.nodeOneCore.ownerId);

      if (!hasChannel) {
        // Create our channel for this topic
        await this.nodeOneCore.channelManager.createChannel(topicId, this.nodeOneCore.ownerId);
        console.log(`[TopicGroupManager] Created our channel for topic ${topicId}`);

        // Grant the group access to our channel
        const channelHash: any = await calculateIdHashOfObj({
          $type$: 'ChannelInfo',
          id: topicId,
          owner: this.nodeOneCore.ownerId
        });

        await createAccess([{
          id: channelHash,
          person: [],
          group: [groupIdHash],
          mode: SET_ACCESS_MODE.ADD
        }]);

        console.log(`[TopicGroupManager] Granted group ${String(groupIdHash).substring(0, 8)} access to our channel`);
      } else {
        console.log(`[TopicGroupManager] We already have a channel for topic ${topicId}`);
      }

      return true;
    } catch (error) {
      console.error(`[TopicGroupManager] Failed to ensure participant channel:`, error);
      throw error;
    }
  }

  /**
   * @deprecated Do not use - creates duplicate conversations
   * P2P conversations should always use personId1<->personId2 format
   */
  async ensureP2PChannelsForProfile(someoneId: any, peerPersonId: any): Promise<any> {
    console.warn(`[TopicGroupManager] DEPRECATED: ensureP2PChannelsForProfile called - redirecting to ensureP2PChannelsForPeer`);
    // Redirect to the proper method
    return this.ensureP2PChannelsForPeer(peerPersonId);
  }

  /**
   * Ensure channels exist for P2P conversations with a specific peer
   * This is called when a CHUM connection is established
   * @param {string} peerPersonId - The peer's person ID
   */
  async ensureP2PChannelsForPeer(peerPersonId: any): Promise<any> {
    console.log(`[TopicGroupManager] Ensuring P2P conversation for peer ${String(peerPersonId).substring(0, 8)}`);

    // Use sorted Person IDs for consistent topic ID
    const sortedIds = [this.nodeOneCore.ownerId, peerPersonId].sort();
    const p2pTopicId = `${sortedIds[0]}<->${sortedIds[1]}`;

    console.log(`[TopicGroupManager] P2P Topic ID: ${p2pTopicId}`);

    try {
      // Check if topic already exists
      let topic = null;
      try {
        if (this.nodeOneCore.topicModel) {
          topic = await this.nodeOneCore.topicModel.topics.queryById(p2pTopicId);
        }
      } catch (e: any) {
        // Topic doesn't exist yet
      }

      if (!topic) {
        console.log(`[TopicGroupManager] Creating P2P topic...`);

        // Get the contact's actual name if available, otherwise use their hash
        let topicName = String(peerPersonId).substring(0, 8);
        try {
          if (this.nodeOneCore.leuteModel) {
            const contactName = this.nodeOneCore.leuteModel.getPersonName(peerPersonId);
            if (contactName) {
              topicName = contactName;
            }
          }
        } catch (e: any) {
          // Fall back to hash if name lookup fails
        }

        await this.createP2PTopic(topicName, p2pTopicId, [this.nodeOneCore.ownerId, peerPersonId]);

        console.log(`[TopicGroupManager] ✅ Created P2P topic and channel for ${p2pTopicId}`);
      } else {
        console.log(`[TopicGroupManager] P2P topic already exists for ${p2pTopicId}`);

        // Check what channels exist for this topic
        const channels: any = await this.nodeOneCore.channelManager.getMatchingChannelInfos({channelId: p2pTopicId});
        console.log(`[TopicGroupManager] Existing channels for P2P topic:`, channels.map((ch: any) => ({
          id: ch.id,
          owner: ch.owner ? ch.owner?.substring(0, 8) : 'null'
        })));

        // For P2P, we should have ONE channel with null owner
        // If we have channels with owners, we need to fix this
        const hasNullOwnerChannel = channels.some((ch: any) => !ch.owner);
        const hasOwnerChannels = channels.some((ch: any) => ch.owner);

        if (!hasNullOwnerChannel) {
          console.warn(`[TopicGroupManager] ⚠️ P2P topic missing null-owner channel, creating it...`);

          // Create the null-owner channel for P2P
          await this.nodeOneCore.channelManager.createChannel(p2pTopicId, null);
          console.log(`[TopicGroupManager] Created null-owner channel for existing P2P topic`);
        }

        // ALWAYS ensure access is granted for the null-owner channel
        // This is critical - even if the channel exists, the peer might not have access
        const channelHash: any = await calculateIdHashOfObj({
          $type$: 'ChannelInfo',
          id: p2pTopicId,
          owner: undefined
        });

        await createAccess([{
          id: channelHash,
          person: [this.nodeOneCore.ownerId, peerPersonId],
          group: [],
          mode: SET_ACCESS_MODE.ADD
        }]);

        console.log(`[TopicGroupManager] ✅ Ensured P2P channel access for both participants`);

        // Also ensure access to the Topic object itself (like one.leute does)
        const { calculateHashOfObj } = await import('@refinio/one.core/lib/util/object.js');
        if (topic) {
          const topicHash: any = await calculateHashOfObj(topic);
          await createAccess([{
            object: topicHash,
            person: [this.nodeOneCore.ownerId, peerPersonId],
            group: [],
            mode: SET_ACCESS_MODE.ADD
          }]);
          console.log(`[TopicGroupManager] ✅ Ensured Topic object access for both participants`);
        }

        if (hasOwnerChannels) {
          console.warn(`[TopicGroupManager] ⚠️ P2P topic has owned channels - these should be removed`);
          console.warn(`[TopicGroupManager] P2P should only have null-owner channel for shared access`);
        }
      }

    } catch (error) {
      console.error(`[TopicGroupManager] Failed to ensure P2P channels:`, error);
    }
  }
}

export default TopicGroupManager;