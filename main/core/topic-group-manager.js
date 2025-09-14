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
        person: participants  // Group recipe expects 'person' not 'members'
      };

      // Store the group
      const storedGroup = await storeVersionedObject(group);
      const groupIdHash = storedGroup.idHash;
      
      console.log(`[TopicGroupManager] Created group ${groupName} with ${participants.length} persons`);
      console.log(`[TopicGroupManager] Persons:`, participants.map(p => p.substring(0, 8)).join(', '));

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
   * This returns the minimal set - actual conversations will add more participants
   */
  async getDefaultParticipants(aiPersonId = null) {
    const participants = [];

    // 1. Node owner (always included - this is the local user)
    if (this.nodeOneCore.ownerId) {
      participants.push(this.nodeOneCore.ownerId);
      console.log('[TopicGroupManager] Added node owner:', this.nodeOneCore.ownerId.substring(0, 8));
    }

    // 2. Specific AI assistant if provided
    if (aiPersonId) {
      participants.push(aiPersonId);
      console.log('[TopicGroupManager] Added specified AI assistant:', aiPersonId.substring(0, 8));
    }

    // Note: This is just the default/minimal set
    // Actual conversations will add specific participants via addParticipantsToGroup

    return participants;
  }

  /**
   * Add participants to a conversation group
   * In one.leute architecture: each participant has their own channel with the same topic ID
   * We create channels for ALL participants to ensure proper message flow
   */
  async addParticipantsToGroup(topicId, participantIds) {
    const groupIdHash = this.conversationGroups.get(topicId);
    if (!groupIdHash) {
      throw new Error(`No group found for topic ${topicId}`);
    }

    console.log(`[TopicGroupManager] Adding ${participantIds.length} participants to topic ${topicId}`);

    // Create channels for ALL participants
    // This ensures messages can flow properly even for AI and remote participants
    for (const participantId of participantIds) {
      if (participantId && this.nodeOneCore.channelManager) {
        try {
          // Check if channel already exists before creating
          const hasChannel = await this.nodeOneCore.channelManager.hasChannel(topicId, participantId);

          if (!hasChannel) {
            // Create a channel owned by this participant
            await this.nodeOneCore.channelManager.createChannel(topicId, participantId);
            console.log(`[TopicGroupManager] Created channel for participant ${participantId.substring(0, 8)}`);
          } else {
            console.log(`[TopicGroupManager] Channel already exists for participant ${participantId.substring(0, 8)}`);
          }

          // Grant the group access to this participant's channel
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
          console.warn(`[TopicGroupManager] Channel creation for ${participantId.substring(0, 8)} failed:`, error.message);
        }
      }
    }

    // Grant participants access to the group
    await createAccess([{
      id: groupIdHash,
      person: participantIds,
      group: [],
      mode: SET_ACCESS_MODE.ADD
    }]);

    console.log(`[TopicGroupManager] Granted group access to ${participantIds.length} participants`);
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
    // Get from AI assistant model
    if (this.nodeOneCore.aiAssistantModel) {
      const contacts = this.nodeOneCore.aiAssistantModel.getAllContacts();
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
   * Add a remote participant to relevant conversation groups
   * This is called when a CHUM connection is established
   * For group chats: adds them to groups where they should be a member
   * For P2P: ensures the P2P conversation structure exists
   * @param {string} remotePersonId - The person ID to add to relevant groups
   */
  async addRemoteParticipantToRelevantGroups(remotePersonId) {
    console.log(`[TopicGroupManager] Adding remote participant ${remotePersonId.substring(0, 8)} to relevant conversation groups`);
    
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
        console.log(`[TopicGroupManager] P2P conversation exists with ${remotePersonId.substring(0, 8)}: ${p2pTopicId}`);
        // The group already exists and both parties should be members
        // Just ensure access is granted
        await this.ensureGroupAccess(groupIdHash, remotePersonId);
      } catch (error) {
        console.warn(`[TopicGroupManager] Failed to ensure P2P group access:`, error.message);
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
  async ensureGroupAccess(groupIdHash, remotePersonId) {
    // Grant the remote person access to the group
    await createAccess([{
      id: groupIdHash,
      person: [remotePersonId],
      group: [],
      mode: SET_ACCESS_MODE.ADD
    }]);
    console.log(`[TopicGroupManager] Ensured ${remotePersonId.substring(0, 8)} has access to group ${groupIdHash.substring(0, 8)}`);
  }

  /**
   * Add a remote participant to a specific conversation group
   * @param {string} topicId - The topic ID
   * @param {string} groupIdHash - The group's ID hash
   * @param {string} remotePersonId - The person ID to add
   */
  async addRemoteParticipantToGroup(topicId, groupIdHash, remotePersonId) {
    console.log(`[TopicGroupManager] Adding ${remotePersonId.substring(0, 8)} to group for topic ${topicId}`);
    
    try {
      // Retrieve the existing group object
      const { getIdObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
      const existingGroup = await getIdObject(groupIdHash);
      
      if (!existingGroup) {
        throw new Error(`Group ${groupIdHash} not found`);
      }
      
      // Check if the person is already in the group
      if (existingGroup.person && existingGroup.person.includes(remotePersonId)) {
        console.log(`[TopicGroupManager] ${remotePersonId.substring(0, 8)} is already in the group`);
        return;
      }
      
      // Create an updated group with the new participant
      const updatedGroup = {
        $type$: 'Group',
        name: existingGroup.name,
        person: [...(existingGroup.person || []), remotePersonId]
      };
      
      // Store the updated group (this creates a new version)
      const storedGroup = await storeVersionedObject(updatedGroup);
      const newGroupIdHash = storedGroup.idHash;
      
      // Update our cache
      this.conversationGroups.set(topicId, newGroupIdHash);
      
      console.log(`[TopicGroupManager] Updated group for topic ${topicId} with new member`);
      console.log(`[TopicGroupManager] New group members:`, updatedGroup.person.map(p => p.substring(0, 8)).join(', '));
      
      // Grant the remote person access to the group
      await createAccess([{
        id: newGroupIdHash,
        person: [remotePersonId],
        group: [],
        mode: SET_ACCESS_MODE.ADD
      }]);
      
      // Create a channel for the remote participant in this topic
      if (this.nodeOneCore.channelManager) {
        await this.nodeOneCore.channelManager.createChannel(topicId, remotePersonId);
        
        // Grant the group access to the remote participant's channel
        const channelHash = await calculateIdHashOfObj({
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
        
        console.log(`[TopicGroupManager] Created channel and granted group access for ${remotePersonId.substring(0, 8)}`);
      }
      
      // Update the topic to use the new group
      if (this.nodeOneCore.topicModel) {
        const topic = await this.nodeOneCore.topicModel.getTopicByName(topicId);
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
   * Create a topic with the conversation group - compatible with one.leute architecture
   * In one.leute: ONE topic ID, MULTIPLE channels (one per participant)
   * @param {string} topicName - Display name for the topic
   * @param {string} topicId - Unique ID for the topic
   * @param {Array<string>} participantIds - Array of person IDs (humans, AIs, etc) to include
   * @param {boolean} autoAddChumConnections - Whether to automatically add all CHUM connections (default: false)
   */
  async createGroupTopic(topicName, topicId, participantIds = [], autoAddChumConnections = false) {
    console.log(`[TopicGroupManager] Creating group topic: ${topicName} (${topicId})`);
    console.log(`[TopicGroupManager] Initial participants: ${participantIds.length} persons`);

    // Check if this is a P2P conversation (topicId contains <->)
    const isP2P = topicId.includes('<->');
    console.log(`[TopicGroupManager] Is P2P conversation: ${isP2P}`);

    // Always include the node owner
    if (!participantIds.includes(this.nodeOneCore.ownerId)) {
      participantIds.unshift(this.nodeOneCore.ownerId);
    }

    // Only add CHUM connections for group chats, not P2P
    if (autoAddChumConnections && !isP2P) {
      const activeChumConnections = this.nodeOneCore.getActiveCHUMConnections();
      for (const chumPersonId of activeChumConnections) {
        if (!participantIds.includes(chumPersonId)) {
          participantIds.push(chumPersonId);
          console.log(`[TopicGroupManager] Added active CHUM connection ${chumPersonId.substring(0, 8)}... to group`);
        }
      }
    }

    console.log(`[TopicGroupManager] Final participants: ${participantIds.length} persons`);
    console.log(`[TopicGroupManager] Participant IDs:`, participantIds.map(p => p.substring(0, 8)).join(', '));

    // Create the conversation group with all participants
    const groupName = `conversation-${topicId}`;
    const group = {
      $type$: 'Group',
      name: groupName,
      person: participantIds  // All participants including node owner, AIs, other contacts
    };

    // Store the group
    const storedGroup = await storeVersionedObject(group);
    const groupIdHash = storedGroup.idHash;

    console.log(`[TopicGroupManager] Created group ${groupName} with ${participantIds.length} persons`);
    console.log(`[TopicGroupManager] Persons:`, participantIds.map(p => p.substring(0, 8)).join(', '));

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

    // Create the topic - for group chats, the topic creator owns the first channel
    const topic = await this.nodeOneCore.topicModel.createGroupTopic(
      topicName,
      topicId,
      this.nodeOneCore.ownerId  // Topic creator owns their channel
    );

    // Share the topic with the group
    await this.nodeOneCore.topicModel.addGroupToTopic(groupIdHash, topic);

    // Create channels for ALL participants
    // In one.leute architecture, each participant needs their own channel
    for (const participantId of participantIds) {
      if (participantId && this.nodeOneCore.channelManager) {
        try {
          // Check if channel already exists before creating
          const hasChannel = await this.nodeOneCore.channelManager.hasChannel(topicId, participantId);

          if (!hasChannel) {
            // Create a channel owned by this participant
            await this.nodeOneCore.channelManager.createChannel(topicId, participantId);
            console.log(`[TopicGroupManager] Created channel for participant ${participantId.substring(0, 8)}`);
          } else {
            console.log(`[TopicGroupManager] Channel already exists for participant ${participantId.substring(0, 8)}`);
          }

          // Grant the group access to this participant's channel
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
          console.warn(`[TopicGroupManager] Channel creation for ${participantId.substring(0, 8)} failed:`, error.message);
        }
      }
    }

    console.log(`[TopicGroupManager] Topic ${topicId} created with group ${groupIdHash.substring(0, 8)}`);
    console.log(`[TopicGroupManager] Created ${participantIds.length} channels for participants`);

    // IMPORTANT: In one.leute architecture:
    // - ONE topic ID for the conversation
    // - MULTIPLE channels (one per participant) with the SAME topic ID
    // - Each participant posts to their OWN channel
    // - All participants can READ from all channels (via group access)
    console.log(`[TopicGroupManager] All participants have their own channels with topic ID: ${topicId}`);

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

  /**
   * Ensure channels exist for profile-based P2P conversations
   * This is called when creating a conversation with a Someone
   * @param {string} someoneId - The Someone ID (profile hash)
   * @param {string} peerPersonId - The peer's person ID (for permissions)
   */
  async ensureP2PChannelsForProfile(someoneId, peerPersonId) {
    console.log(`[TopicGroupManager] Ensuring P2P channels for profile ${someoneId.substring(0, 8)}`);
    
    // For profile-based management, use the Someone ID as the topic ID
    const p2pTopicId = someoneId;
    console.log(`[TopicGroupManager] Profile-based Topic ID: ${p2pTopicId}`);
    
    try {
      // Check if we already have a group for this P2P conversation
      let groupIdHash = this.conversationGroups.get(p2pTopicId);
      
      if (!groupIdHash) {
        console.log(`[TopicGroupManager] No existing group for profile conversation, creating...`);
        
        // Create a group with both participants (using Person IDs for permissions)
        const group = {
          $type$: 'Group',
          name: `conversation-${p2pTopicId}`,
          person: [this.nodeOneCore.ownerId, peerPersonId]
        };
        
        const storedGroup = await storeVersionedObject(group);
        groupIdHash = storedGroup.idHash;
        
        // Cache the group
        this.conversationGroups.set(p2pTopicId, groupIdHash);
        
        console.log(`[TopicGroupManager] Created profile-based P2P group ${groupIdHash.substring(0, 8)}`);
        
        // Grant both participants access to the group
        await createAccess([{
          id: groupIdHash,
          person: [this.nodeOneCore.ownerId, peerPersonId],
          group: [],
          mode: SET_ACCESS_MODE.ADD
        }]);
      }
      
      // Create channel for this profile-based conversation
      await this.nodeOneCore.channelManager.createChannel(p2pTopicId, this.nodeOneCore.ownerId);
      console.log(`[TopicGroupManager] Channel created for profile-based conversation`);
      
      // Grant peer access to our channel
      const nodeChannelHash = await calculateIdHashOfObj({
        $type$: 'ChannelInfo',
        id: p2pTopicId,
        owner: this.nodeOneCore.ownerId
      });
      
      await createAccess([{
        id: nodeChannelHash,
        person: [peerPersonId],
        group: [groupIdHash],
        mode: SET_ACCESS_MODE.ADD
      }]);
      
      console.log(`[TopicGroupManager] Access granted for profile-based P2P conversation`);
      
      // IMPORTANT: Create the actual Topic object with the profile ID
      if (!this.nodeOneCore.topicModel) {
        throw new Error('TopicModel not initialized');
      }
      
      // Check if topic already exists
      const topics = await this.nodeOneCore.topicModel.topics.all();
      const existingTopic = topics.find(t => t.id === p2pTopicId);
      
      if (!existingTopic) {
        console.log(`[TopicGroupManager] Creating Topic object for profile ${someoneId.substring(0, 8)}`);
        
        // Create the topic with the profile ID as the topic name
        const topic = await this.nodeOneCore.topicModel.createGroupTopic(
          p2pTopicId,  // Use Someone ID as both name and ID
          p2pTopicId,  // Topic ID is the Someone ID
          this.nodeOneCore.ownerId
        );
        
        // Add the conversation group to the topic
        await this.nodeOneCore.topicModel.addGroupToTopic(groupIdHash, topic);
        
        console.log(`[TopicGroupManager] Topic ${p2pTopicId.substring(0, 8)} created with group ${groupIdHash.substring(0, 8)}`);
      } else {
        console.log(`[TopicGroupManager] Topic already exists for profile ${someoneId.substring(0, 8)}`);
      }
      
    } catch (error) {
      console.error(`[TopicGroupManager] Failed to ensure profile P2P channels:`, error);
      throw error;
    }
  }
  
  /**
   * Ensure channels exist for P2P conversations with a specific peer
   * This is called when a CHUM connection is established
   * @param {string} peerPersonId - The peer's person ID
   */
  async ensureP2PChannelsForPeer(peerPersonId) {
    console.log(`[TopicGroupManager] Ensuring P2P channels for peer ${peerPersonId.substring(0, 8)}`);
    
    // For backward compatibility, still support Person ID based topics
    // But we should transition to profile-based management
    const sortedIds = [this.nodeOneCore.ownerId, peerPersonId].sort();
    const p2pTopicId = `${sortedIds[0]}<->${sortedIds[1]}`;
    
    console.log(`[TopicGroupManager] Legacy P2P Topic ID: ${p2pTopicId}`);
    
    try {
      // Check if we already have a group for this P2P conversation
      let groupIdHash = this.conversationGroups.get(p2pTopicId);
      
      if (!groupIdHash) {
        console.log(`[TopicGroupManager] No existing group for P2P conversation, creating...`);
        
        // Create a group with both participants
        const group = {
          $type$: 'Group',
          name: `conversation-${p2pTopicId}`,
          person: [this.nodeOneCore.ownerId, peerPersonId]
        };
        
        const storedGroup = await storeVersionedObject(group);
        groupIdHash = storedGroup.idHash;
        
        // Cache the group
        this.conversationGroups.set(p2pTopicId, groupIdHash);
        
        console.log(`[TopicGroupManager] Created P2P group ${groupIdHash.substring(0, 8)}`);
        
        // Grant both participants access to the group
        await createAccess([{
          id: groupIdHash,
          person: [this.nodeOneCore.ownerId, peerPersonId],
          group: [],
          mode: SET_ACCESS_MODE.ADD
        }]);
      }
      
      // Ensure channels exist for both participants
      console.log(`[TopicGroupManager] Ensuring channels for both participants...`);
      
      // Create channel for local node owner
      let nodeChannelHash;
      try {
        await this.nodeOneCore.channelManager.createChannel(p2pTopicId, this.nodeOneCore.ownerId);
        console.log(`[TopicGroupManager] Channel created/verified for node owner`);
        
        // Calculate the channel hash for access control
        nodeChannelHash = await calculateIdHashOfObj({
          $type$: 'ChannelInfo',
          id: p2pTopicId,
          owner: this.nodeOneCore.ownerId
        });
        
        // Grant group access to node owner's channel
        await createAccess([{
          id: nodeChannelHash,
          person: [],
          group: [groupIdHash],
          mode: SET_ACCESS_MODE.ADD
        }]);
        
        // Grant the peer direct access to our channel so they can read it
        await createAccess([{
          id: nodeChannelHash, 
          person: [peerPersonId],
          group: [],
          mode: SET_ACCESS_MODE.ADD
        }]);
        console.log(`[TopicGroupManager] Granted peer direct access to our channel`);
      } catch (error) {
        console.log(`[TopicGroupManager] Node owner channel might already exist:`, error.message);
      }
      
      // Create channel for the peer if it doesn't exist
      // This creates the ChannelInfo object so we can properly receive messages from them
      try {
        const hasPeerChannel = await this.nodeOneCore.channelManager.hasChannel(p2pTopicId, peerPersonId);
        
        if (!hasPeerChannel) {
          await this.nodeOneCore.channelManager.createChannel(p2pTopicId, peerPersonId);
          console.log(`[TopicGroupManager] Created channel for peer ${peerPersonId.substring(0, 8)}`);
        } else {
          console.log(`[TopicGroupManager] Channel already exists for peer ${peerPersonId.substring(0, 8)}`);
        }
        
        // Calculate the channel hash for access control
        const peerChannelHash = await calculateIdHashOfObj({
          $type$: 'ChannelInfo',
          id: p2pTopicId,
          owner: peerPersonId
        });
        
        // Grant group access to peer's channel
        await createAccess([{
          id: peerChannelHash,
          person: [],
          group: [groupIdHash],
          mode: SET_ACCESS_MODE.ADD
        }]);
        
        console.log(`[TopicGroupManager] Granted group access to peer's channel`);
      } catch (error) {
        console.log(`[TopicGroupManager] Could not create channel for peer:`, error.message);
      }
      
      // Ensure the Topic object exists for this P2P conversation
      if (this.nodeOneCore.topicModel) {
        try {
          const topics = await this.nodeOneCore.topicModel.topics.all();
          const existingTopic = topics.find(t => t.id === p2pTopicId);

          if (!existingTopic) {
            console.log(`[TopicGroupManager] Creating Topic object for P2P conversation`);

            // Create the topic with proper group association
            const topic = await this.nodeOneCore.topicModel.createGroupTopic(
              p2pTopicId,  // Use P2P ID as both name and ID
              p2pTopicId,  // Topic ID
              this.nodeOneCore.ownerId
            );

            // Associate the conversation group with the topic
            await this.nodeOneCore.topicModel.addGroupToTopic(groupIdHash, topic);

            console.log(`[TopicGroupManager] Topic ${p2pTopicId} created with group ${groupIdHash.substring(0, 8)}`);
          } else {
            console.log(`[TopicGroupManager] Topic already exists for P2P conversation`);
          }
        } catch (error) {
          console.warn(`[TopicGroupManager] Could not create/check topic:`, error.message);
        }
      }

      console.log(`[TopicGroupManager] ✅ P2P channels and topic ensured for conversation ${p2pTopicId}`);

    } catch (error) {
      console.error(`[TopicGroupManager] Failed to ensure P2P channels:`, error);
    }
  }
}

export default TopicGroupManager;