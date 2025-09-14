/**
 * IPC handlers for topic operations
 */

import nodeOneCore from '../../core/node-one-core.js'

/**
 * Get or create a one-to-one topic for a contact
 */
export async function getOrCreateTopicForContact(event, contactId) {
  console.log('[Topics IPC] Getting or creating topic for contact:', contactId)
  
  // nodeOneCore is already the instance, not a class
  const nodeInstance = nodeOneCore
  if (!nodeInstance || !nodeInstance.initialized) {
    console.error('[Topics IPC] No Node.js ONE.core instance available')
    return { success: false, error: 'No Node.js ONE.core instance' }
  }

  try {
    const topicModel = nodeInstance.topicModel
    const channelManager = nodeInstance.channelManager
    const myPersonId = nodeInstance.ownerId

    if (!topicModel || !channelManager || !myPersonId) {
      console.error('[Topics IPC] Missing required models')
      return { success: false, error: 'Models not initialized' }
    }

    // For profile-based chat management, we use the Someone ID as the topic ID
    // This maintains compatibility with the legacy approach where chats are managed by profile
    const p2pTopicId = contactId
    console.log('[Topics IPC] Using profile-based topic ID (Someone hash):', p2pTopicId)
    
    // Also get the Person ID for CHUM sync and permissions
    let targetPersonId = contactId
    if (nodeInstance.leuteModel) {
      const others = await nodeInstance.leuteModel.others()
      const contact = others.find(c => c.id === contactId)
      if (contact && contact.personId) {
        targetPersonId = contact.personId
        console.log(`[Topics IPC] Found Person ID ${targetPersonId} for Someone ${contactId}`)
      }
    }

    // Ensure P2P channels exist using TopicGroupManager with profile-based approach
    if (nodeInstance.topicGroupManager) {
      await nodeInstance.topicGroupManager.ensureP2PChannelsForProfile(contactId, targetPersonId)
      console.log('[Topics IPC] Profile-based P2P channels ensured via TopicGroupManager')
    }

    // Return the P2P topic ID directly - no need to create it again
    console.log('[Topics IPC] Topic ready:', p2pTopicId)

    // Create the channel for this topic (if it doesn't exist)
    try {
      await channelManager.createChannel(p2pTopicId, myPersonId)
      console.log('[Topics IPC] Channel created for topic')
    } catch (channelError) {
      // Channel might already exist, which is fine
      console.log('[Topics IPC] Channel might already exist:', channelError.message)
    }

    return { 
      success: true, 
      topicId: p2pTopicId 
    }
  } catch (error) {
    console.error('[Topics IPC] Failed to create topic:', error)
    return { 
      success: false, 
      error: error.message 
    }
  }
}