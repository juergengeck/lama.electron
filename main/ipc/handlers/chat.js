/**
 * Chat IPC Handlers
 */

import stateManager from '../../state/manager.js';
import instanceManager from '../../core/instance.js';
import nodeProvisioning from '../../hybrid/node-provisioning.js';
import nodeOneCore from '../../core/node-one-core.js';
import { BrowserWindow } from 'electron';

// Topic creation mutex to prevent race conditions
const topicCreationInProgress = new Map()

const chatHandlers = {
  async sendMessage(event, { conversationId, text, attachments = [] }) {
    console.log('[ChatHandler] Send message:', { conversationId, text })
    
    try {
      // Check if node is provisioned and has TopicModel
      if (!nodeProvisioning.isProvisioned()) {
        throw new Error('Node not provisioned')
      }
      
      if (!nodeOneCore.topicModel) {
        throw new Error('TopicModel not initialized')
      }
      
      const userId = stateManager.getState('user.id')
      if (!userId) {
        throw new Error('User not authenticated')
      }
      
      // Get or create topic room for the conversation
      let topicRoom
      try {
        topicRoom = await nodeOneCore.topicModel.enterTopicRoom(conversationId)
        
        // For default topic, we can add groups if needed
        // But TopicModel handles this internally when creating group topics
      } catch (error) {
        // Topic doesn't exist, create it
        console.log('[ChatHandler] Topic does not exist, creating:', conversationId)
        
        // Use TopicGroupManager to create group topic with proper channels for all participants
        if (nodeOneCore.topicGroupManager) {
          let participantIds = []

          // Check if this is a P2P conversation
          if (conversationId.includes('<->')) {
            // For P2P conversations, extract both participant IDs
            const [id1, id2] = conversationId.split('<->')
            participantIds = [id1, id2]
            console.log('[ChatHandler] P2P conversation - participants:', participantIds.map(p => p.substring(0, 8)).join(', '))
          } else {
            // For default topic, include default AI if available
            if (nodeOneCore.aiAssistantModel) {
              const aiContacts = nodeOneCore.aiAssistantModel.getAllContacts()
              if (aiContacts.length > 0) {
                participantIds.push(aiContacts[0].personId) // Add first AI as default participant
              }
            }
          }

          await nodeOneCore.topicGroupManager.createGroupTopic(conversationId, conversationId, participantIds)
          console.log('[ChatHandler] Created group topic with channels for all participants')
        } else {
          // Fallback to old method if TopicGroupManager not available
          await nodeOneCore.topicModel.createGroupTopic(conversationId, conversationId, nodeOneCore.ownerId)
          console.log('[ChatHandler] Created group topic with channel')
          
          // Grant access to browser Person ID for CHUM sync
          const browserPersonId = stateManager.getState('browserPersonId')
          if (browserPersonId) {
            const { createAccess } = await import('@refinio/one.core/lib/access.js')
            const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')
            const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/util/object.js')
            
            const channelInfoHash = await calculateIdHashOfObj({
              $type$: 'ChannelInfo',
              id: conversationId,
              owner: nodeOneCore.ownerId
            })
            
            // Grant direct person-to-person access to browser
            await createAccess([{
              id: channelInfoHash,
              person: [browserPersonId], // Direct access to browser person
              group: [],
              mode: SET_ACCESS_MODE.ADD
            }])
            
            console.log(`[ChatHandler] Granted channel access to browser person: ${browserPersonId.substring(0, 8)}`)
          }
        }
        
        topicRoom = await nodeOneCore.topicModel.enterTopicRoom(conversationId)
      }
      
      // Send message through TopicModel (this syncs via ChannelManager)
      // TopicRoom.sendMessage expects (message, author, channelOwner)
      // undefined author means "use my main identity"
      console.log('[ChatHandler] DEBUG: About to send message to topicRoom')
      console.log('[ChatHandler] DEBUG: conversationId:', conversationId)
      console.log('[ChatHandler] DEBUG: nodeOneCore.ownerId:', nodeOneCore.ownerId)
      console.log('[ChatHandler] DEBUG: text:', text)
      
      // For group topics, we need to write to the correct channel
      // Check which channels exist for this topic
      const channels = await nodeOneCore.channelManager.getMatchingChannelInfos({ channelId: conversationId })
      console.log('[ChatHandler] DEBUG: Found channels for topic:', channels.map(c => ({
        id: c.id,
        owner: c.owner?.substring(0, 8)
      })))
      
      // Find our channel (owned by node)
      const ourChannel = channels.find(c => c.owner === nodeOneCore.ownerId)
      if (ourChannel) {
        console.log('[ChatHandler] DEBUG: Using our channel, owner:', ourChannel.owner?.substring(0, 8))
        await topicRoom.sendMessage(text, undefined, ourChannel.owner)
      } else {
        console.log('[ChatHandler] DEBUG: No channel owned by us, using nodeOneCore.ownerId')
        await topicRoom.sendMessage(text, undefined, nodeOneCore.ownerId)
      }
      
      console.log('[ChatHandler] DEBUG: Message sent to TopicRoom')
      
      // Create message object for UI
      const message = {
        id: `msg-${Date.now()}`,
        conversationId,
        text,
        attachments,
        sender: userId,
        timestamp: new Date().toISOString(),
        status: 'sent'
      }
      
      // Don't store in stateManager - TopicModel is the source of truth
      
      // Notify renderer about the new message
      event.sender.send('chat:messageSent', message)
      
      // Also emit a message update event so UI refreshes from source
      event.sender.send('message:updated', { conversationId })
      
      return {
        success: true,
        data: message
      }
    } catch (error) {
      console.error('[ChatHandler] Error sending message:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  async getMessages(event, { conversationId, limit = 50, offset = 0 }) {
    console.log('[ChatHandler] Get messages:', { conversationId, limit, offset })
    
    try {
      // Check if node is provisioned
      if (!nodeProvisioning.isProvisioned() || !nodeOneCore.topicModel) {
        // Return empty if not ready
        return {
          success: true,
          data: {
            messages: [],
            total: 0,
            hasMore: false
          }
        }
      }
      
      // Get messages from TopicModel
      let topicRoom
      let topicWasJustCreated = false
      
      try {
        topicRoom = await nodeOneCore.topicModel.enterTopicRoom(conversationId)
      } catch (error) {
        console.log('[ChatHandler] Topic does not exist yet:', conversationId)
        
        // Check if another request is already creating this topic
        if (topicCreationInProgress.has(conversationId)) {
          console.log('[ChatHandler] Topic creation already in progress, waiting...')
          // Wait for the other request to finish
          await topicCreationInProgress.get(conversationId)
          // Try to enter the room again
          try {
            topicRoom = await nodeOneCore.topicModel.enterTopicRoom(conversationId)
          } catch (retryError) {
            console.error('[ChatHandler] Topic still not available after waiting:', retryError)
            return {
              success: true,
              data: {
                messages: [],
                total: 0,
                hasMore: false
              }
            }
          }
        } else {
          // Topic doesn't exist yet - create it
          const creationPromise = (async () => {
            try {
              // Use TopicGroupManager to create group topic with proper channels for all participants
              if (nodeOneCore.topicGroupManager) {
                let participantIds = []

                // Check if this is a P2P conversation
                if (conversationId.includes('<->')) {
                  // For P2P conversations, extract both participant IDs
                  const [id1, id2] = conversationId.split('<->')
                  participantIds = [id1, id2]
                  console.log('[ChatHandler] P2P conversation - participants:', participantIds.map(p => p.substring(0, 8)).join(', '))
                } else {
                  // For default topic, include default AI if available
                  if (nodeOneCore.aiAssistantModel) {
                    const aiContacts = nodeOneCore.aiAssistantModel.getAllContacts()
                    if (aiContacts.length > 0) {
                      participantIds.push(aiContacts[0].personId)
                    }
                  }
                }

                await nodeOneCore.topicGroupManager.createGroupTopic(conversationId, conversationId, participantIds)
                console.log('[ChatHandler] Topic created successfully with channels for all participants')
              } else {
                // Fallback to old method
                await nodeOneCore.topicModel.createGroupTopic(conversationId, conversationId, nodeOneCore.ownerId)
                console.log('[ChatHandler] Topic created successfully')
              }
              return true
            } catch (createError) {
              console.error('[ChatHandler] Could not create topic:', createError)
              return false
            }
          })()
          
          // Store the promise so other requests can wait
          topicCreationInProgress.set(conversationId, creationPromise)
          
          const created = await creationPromise
          
          // Clean up the mutex
          topicCreationInProgress.delete(conversationId)
          
          if (!created) {
            return {
              success: true,
              data: {
                messages: [],
                total: 0,
                hasMore: false
              }
            }
          }
          
          topicRoom = await nodeOneCore.topicModel.enterTopicRoom(conversationId)
          topicWasJustCreated = true
        }
      }
      
      // Check if default chat needs welcome message - check every time for empty default chat
      if (conversationId === 'default' && nodeOneCore.aiAssistantModel) {
        let hasRealMessages = false
        
        // If we JUST created the topic, skip the message check - it's guaranteed to be empty
        // The storage layer creates phantom entries during async initialization
        if (topicWasJustCreated) {
          console.log('[ChatHandler] Topic was just created, skipping message check - triggering welcome message')
          hasRealMessages = false
        } else {
          const existingMessages = await topicRoom.retrieveAllMessages()
          console.log(`[ChatHandler] Found ${existingMessages.length} existing messages in default chat`)
          
          // Log the actual message to understand what it is
          if (existingMessages.length > 0) {
            console.log('[ChatHandler] First message details:', JSON.stringify({
              id: existingMessages[0].id,
              data: existingMessages[0].data,
              author: existingMessages[0].author,
              type: existingMessages[0].type,
              timestamp: existingMessages[0].timestamp
            }, null, 2))
          }
          
          hasRealMessages = existingMessages.some(msg => 
            msg.data?.text && typeof msg.data.text === 'string' && msg.data.text.trim() !== ''
          )
          console.log(`[ChatHandler] Has real messages: ${hasRealMessages}`)
        }
        
        if (topicWasJustCreated || !hasRealMessages) {
          // Check if AI has already been registered for this topic
          const alreadyRegistered = nodeOneCore.aiAssistantModel.isAITopic(conversationId)
          if (!alreadyRegistered) {
            const welcomeStartTime = Date.now()
            console.log(`[ChatHandler] ⏱️ Default chat is empty, triggering AI welcome message at ${new Date().toISOString()}`)
            
            try {
              // Block and wait for welcome message (handleNewTopic will send thinking indicator)
              await nodeOneCore.aiAssistantModel.handleNewTopic(conversationId, topicRoom)
              console.log(`[ChatHandler] ⏱️ Welcome message completed in ${Date.now() - welcomeStartTime}ms`)
            } catch (error) {
              console.error(`[ChatHandler] Failed to generate welcome message after ${Date.now() - welcomeStartTime}ms:`, error)
              // Continue without welcome message rather than failing the whole operation
            }
          }
        } else {
          console.log('[ChatHandler] Default chat already has messages, skipping welcome')
        }
      }
      
      // Get messages from the topic room
      // For P2P conversations, manually aggregate from all channels since TopicRoom might not do it properly
      let rawMessages = []
      
      // Check if this is a P2P conversation
      if (conversationId.includes('<->')) {
        // Get all channels with this topic ID
        const allChannels = await nodeOneCore.channelManager.getMatchingChannelInfos({ 
          channelId: conversationId 
        })
        
        console.log(`[ChatHandler] P2P conversation - Found ${allChannels.length} channels:`, 
          allChannels.map(c => ({ 
            id: c.id,
            owner: c.owner?.substring(0, 8) || 'undefined'
          })))
        
        // For P2P conversations, get messages from the current channel ID
        let channelMessages = await nodeOneCore.channelManager.getObjectsWithType('ChatMessage', {
          channelId: conversationId
        })
        console.log(`[ChatHandler] Retrieved ${channelMessages.length} messages from primary channel ID`)
        
        // FALLBACK: Also check for messages using Someone IDs if we got no messages
        // This handles the case where messages were sent before the fix
        if (channelMessages.length === 0) {
          console.log('[ChatHandler] No messages found with Person ID channel, checking Someone ID patterns...')
          
          // Extract the person IDs from the conversation ID
          const [id1, id2] = conversationId.split('<->')
          
          // Try to find Someone IDs for these Person IDs
          if (nodeOneCore.leuteModel) {
            const others = await nodeOneCore.leuteModel.others()
            
            // Find Someone IDs that match our Person IDs
            const someoneIds = []
            for (const contact of others) {
              if (contact.personId === id1 || contact.personId === id2) {
                someoneIds.push(contact.id)
                console.log(`[ChatHandler] Found Someone ID ${contact.id} for Person ID ${contact.personId}`)
              }
            }
            
            // Try different channel ID combinations with Someone IDs
            if (someoneIds.length > 0) {
              for (const someoneId of someoneIds) {
                // Try patterns like someoneId<->personId
                const altChannelIds = [
                  `${someoneId}<->${id1}`,
                  `${someoneId}<->${id2}`,
                  `${id1}<->${someoneId}`,
                  `${id2}<->${someoneId}`
                ]
                
                for (const altId of altChannelIds) {
                  const altMessages = await nodeOneCore.channelManager.getObjectsWithType('ChatMessage', {
                    channelId: altId
                  })
                  
                  if (altMessages.length > 0) {
                    console.log(`[ChatHandler] Found ${altMessages.length} messages in alternate channel: ${altId}`)
                    channelMessages = [...channelMessages, ...altMessages]
                  }
                }
              }
              
              // Also try Someone<->Someone patterns
              if (someoneIds.length >= 2) {
                const sortedSomeoneIds = someoneIds.sort()
                const someoneChannelId = `${sortedSomeoneIds[0]}<->${sortedSomeoneIds[1]}`
                const someoneMessages = await nodeOneCore.channelManager.getObjectsWithType('ChatMessage', {
                  channelId: someoneChannelId
                })
                
                if (someoneMessages.length > 0) {
                  console.log(`[ChatHandler] Found ${someoneMessages.length} messages in Someone<->Someone channel: ${someoneChannelId}`)
                  channelMessages = [...channelMessages, ...someoneMessages]
                }
              }
            }
          }
        }
        
        console.log(`[ChatHandler] Total messages after fallback check: ${channelMessages.length}`)
        
        // Log details about each message
        channelMessages.forEach((msg, idx) => {
          console.log(`[ChatHandler] Message ${idx + 1}:`, {
            sender: msg.data?.sender?.substring(0, 8) || 'unknown',
            author: msg.author?.substring(0, 8) || 'unknown',
            text: msg.data?.text?.substring(0, 50) || 'no text',
            timestamp: msg.creationTime || msg.timestamp || 'no timestamp'
          })
        })
        
        rawMessages = channelMessages
        
        // Sort by timestamp
        rawMessages.sort((a, b) => {
          const timeA = a.creationTime || a.timestamp || 0
          const timeB = b.creationTime || b.timestamp || 0
          return timeA - timeB
        })
        
        console.log(`[ChatHandler] Total P2P messages: ${rawMessages.length}`)
      } else {
        // For non-P2P conversations, use standard method
        rawMessages = await topicRoom.retrieveAllMessages()
        console.log('[ChatHandler] Retrieved', rawMessages.length, 'messages from TopicRoom')
      }
      
      // Filter for actual ChatMessage objects - they have data.text
      const validMessages = rawMessages.filter(msg => 
        msg.data?.text && typeof msg.data.text === 'string' && msg.data.text.trim() !== ''
      )
      
      // Transform messages to UI format
      const formattedMessages = validMessages.map(msg => {
        const senderId = msg.data?.sender || msg.data?.author || msg.author || nodeOneCore.ownerId
        
        // Check if sender is an AI contact
        let isAI = false
        if (nodeOneCore.aiAssistantModel?.llmObjectManager) {
          isAI = nodeOneCore.aiAssistantModel.llmObjectManager.isLLMPerson(senderId)
          console.log(`[ChatHandler] Message from ${senderId?.toString().substring(0, 8)}... - isAI: ${isAI}`)
        }
        
        return {
          id: msg.id || msg.channelEntryHash || `msg-${Date.now()}`,
          conversationId,
          text: msg.data?.text || '',
          sender: senderId,
          timestamp: msg.creationTime ? new Date(msg.creationTime).toISOString() : new Date().toISOString(),
          status: 'received',
          isAI: isAI
        }
      })
      
      // Apply pagination
      const paginatedMessages = formattedMessages.slice(offset, offset + limit)
      
      return {
        success: true,
        messages: paginatedMessages,
        total: formattedMessages.length,
        hasMore: offset + limit < formattedMessages.length
      }
    } catch (error) {
      console.error('[ChatHandler] Error getting messages:', error)
      return {
        success: false,
        error: error.message,
        data: {
          messages: [],
          total: 0,
          hasMore: false
        }
      }
    }
  },

  async createConversation(event, { type = 'direct', participants = [], name = null }) {
    console.log('[ChatHandler] Create conversation:', { type, participants, name })
    
    try {
      // Get user from state manager (set during browser authentication)
      let userId = stateManager.getState('user.id')
      
      // If not in state manager but node is provisioned, get from node
      if (!userId && nodeProvisioning.isProvisioned()) {
        const user = nodeProvisioning.getUser()
        userId = user?.id || nodeOneCore.ownerId
        
        // Update state manager for consistency
        if (user) {
          stateManager.setUser(user)
        }
      }
      
      if (!userId) {
        throw new Error('User not authenticated')
      }
      
      // Initialize AI if this conversation includes AI participants
      if (participants.some(p => p.isAI)) {
        console.log('[ChatHandler] AI participant detected, initializing AI if needed...')
        await nodeOneCore.initializeAIIfNeeded()
      }
      
      // Create conversation locally for now
      let topicId
      if (type === 'direct' && participants.length === 1) {
        const sortedIds = [userId, participants[0]].sort()
        topicId = `${sortedIds[0]}<->${sortedIds[1]}`
      } else {
        topicId = `topic-${Date.now()}`
      }
      
      const conversation = {
        id: topicId,
        type,
        participants: [userId, ...participants],
        name: name || `Conversation ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
        lastMessage: null,
        lastMessageAt: null,
        unreadCount: 0,
        isAITopic: false,
        hasAIParticipant: false,
        aiModelId: null
      }
      
      // Check if any participants are AI persons and register the topic
      if (nodeOneCore.aiAssistantModel) {
        const aiContacts = nodeOneCore.aiAssistantModel.getAllContacts()
        for (const participant of participants) {
          const isAI = aiContacts.some(contact => contact.personId === participant)
          if (isAI) {
            conversation.hasAIParticipant = true
            conversation.isAITopic = true
            
            // Find which model this AI person belongs to
            const aiContact = aiContacts.find(contact => contact.personId === participant)
            if (aiContact) {
              console.log(`[ChatHandler] Registering AI topic ${topicId} for model ${aiContact.modelId}`)
              nodeOneCore.aiAssistantModel.registerAITopic(topicId, aiContact.modelId)
              conversation.aiModelId = aiContact.modelId
            }
            break // Only need to register once
          }
        }
      }
      
      // Create topic with proper group participants using TopicGroupManager
      if (nodeOneCore.topicGroupManager) {
        try {
          console.log('[ChatHandler] Creating topic with conversation group for:', conversation.id)
          
          // Pass the actual participant IDs to create proper group membership
          // Filter out any invalid participants and convert to person IDs
          const validParticipantIds = participants
            .filter(p => p && typeof p === 'string')
            .map(p => p.id || p) // Handle both {id: ...} objects and raw ID strings
          
          await nodeOneCore.topicGroupManager.createGroupTopic(
            conversation.name,
            conversation.id,
            validParticipantIds
          )
          console.log('[ChatHandler] Created topic with proper group participants:', validParticipantIds.length)
          
          // Trigger AI welcome message if this is an AI conversation
          if (conversation.hasAIParticipant && nodeOneCore.aiAssistantModel) {
            console.log('[ChatHandler] Triggering AI welcome message for AI conversation')
            const topicRoom = await nodeOneCore.topicModel.enterTopicRoom(conversation.id)
            await nodeOneCore.aiAssistantModel.handleNewTopic(conversation.id, topicRoom)
          }
          
        } catch (error) {
          console.error('[ChatHandler] Error creating topic with group:', error)
          // Fallback to creating channel only
          if (nodeOneCore.channelManager) {
            try {
              await nodeOneCore.channelManager.createChannel(conversation.id, nodeOneCore.ownerId)
            } catch (channelError) {
              console.log('[ChatHandler] Channel might already exist:', channelError.message)
            }
          }
        }
      } else if (nodeOneCore.channelManager) {
        // Fallback if TopicGroupManager not available
        try {
          console.log('[ChatHandler] Creating Node.js channel for conversation:', conversation.id)
          await nodeOneCore.channelManager.createChannel(conversation.id, nodeOneCore.ownerId)
          console.log('[ChatHandler] Created Node.js channel with owner:', nodeOneCore.ownerId)
        } catch (error) {
          console.error('[ChatHandler] Error creating channel in Node.js:', error)
        }
      }
      
      // Don't store in stateManager - TopicModel is the source of truth
      
      // Notify renderer
      event.sender.send('chat:conversationCreated', conversation)
      
      return {
        success: true,
        data: conversation
      }
    } catch (error) {
      console.error('[ChatHandler] Error creating conversation:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  async getConversations(event, { limit = 20, offset = 0 } = {}) {
    console.log('[ChatHandler] Get conversations')
    
    try {
      // Get conversations from TopicModel (the source of truth)
      let conversations = []
      if (nodeOneCore.initialized && nodeOneCore.channelManager) {
        // Get all channels from channelManager
        const channels = await nodeOneCore.channelManager.channels()
        
        // Debug: Log raw channels to understand duplicates
        console.log('[ChatHandler] Raw channels from ChannelManager:', channels.length)
        const channelDebug = {}
        channels.forEach(ch => {
          if (!channelDebug[ch.id]) channelDebug[ch.id] = []
          channelDebug[ch.id].push(ch.owner?.substring(0, 8) || 'undefined')
        })
        console.log('[ChatHandler] Channels by ID:', channelDebug)
        
        // Group channels by topic ID to handle group chats and P2P correctly
        // In both cases, each participant has their own channel with the same topic ID
        const topicMap = new Map()
        const processedIds = new Set() // Track which IDs we've already processed
        
        channels.forEach(channel => {
          // Skip system channels
          if (channel.id === 'contacts') return
          
          // Skip if we've already processed this topic ID
          if (processedIds.has(channel.id)) return
          
          // For ALL topics (group and P2P), consolidate by topic ID
          // We only need to show each conversation once, not once per channel
          processedIds.add(channel.id)
          
          // Find the best channel for this topic (prefer our own for writing)
          const allChannelsForTopic = channels.filter(ch => ch.id === channel.id)
          const ourChannel = allChannelsForTopic.find(ch => ch.owner === nodeOneCore.ownerId)
          const channelToUse = ourChannel || allChannelsForTopic[0]
          
          topicMap.set(channel.id, {
            ...channelToUse,
            isOurs: channelToUse.owner === nodeOneCore.ownerId,
            participantCount: allChannelsForTopic.length // Track how many participants
          })
        })
        
        // Convert map back to array for processing
        const filteredChannels = Array.from(topicMap.values())
        
        // Process channels with async operations
        conversations = await Promise.all(filteredChannels.map(async channel => {
            // Try to get the actual topic to access its name property
            let name = channel.name
            let topic = null
            
            try {
              if (nodeOneCore.topicModel) {
                topic = await nodeOneCore.topicModel.topics.queryById(channel.id)
                if (topic?.name) {
                  name = topic.name
                }
              }
            } catch (e) {
              // Topic might not exist yet
            }
            
            if (!name) {
              // For person-to-person conversations (ID format: personA<->personB)
              if (channel.id.includes('<->')) {
                const parts = channel.id.split('<->')
                // Try to look up actual contact names
                let displayName = null
                
                if (nodeOneCore.leuteModel) {
                  try {
                    // Find which person is not us
                    const otherPersonId = parts.find(id => id !== nodeOneCore.ownerId)
                    if (otherPersonId) {
                      // Try to get contact info using proper LeuteModel API
                      const someone = await nodeOneCore.leuteModel.getSomeone(otherPersonId)
                      if (someone) {
                        const profile = await someone.mainProfile()
                        // Look for PersonName in profile descriptions
                        const nameDesc = profile.personDescriptions?.find(d => 
                          d.$type$ === 'PersonName'
                        )
                        if (nameDesc?.name) {
                          displayName = nameDesc.name
                        }
                      }
                    }
                  } catch (e) {
                    console.warn('[ChatHandler] Could not look up contact name:', e)
                  }
                }
                
                if (!displayName) {
                  // Fallback to shortened ID
                  const otherPersonId = parts.find(id => id !== nodeOneCore.ownerId) || parts[1]
                  displayName = otherPersonId.substring(0, 8) + '...'
                }
                
                name = `Chat with ${displayName}`
              } else if (channel.id === 'default') {
                name = 'General Chat'
              } else if (channel.id === 'EveryoneTopic') {
                name = 'Everyone'
              } else if (channel.id === 'GlueOneTopic') {
                name = 'Glue One'
              } else if (channel.id.startsWith('topic-')) {
                // For generated topic IDs
                const timestamp = channel.id.replace('topic-', '')
                const date = new Date(parseInt(timestamp))
                if (!isNaN(date.getTime())) {
                  name = `Chat from ${date.toLocaleDateString()}`
                } else {
                  name = 'Group Chat'
                }
              } else {
                // For other IDs, use a truncated version
                name = `Chat ${channel.id.substring(0, 8)}...`
              }
            }
            
            return {
              id: channel.id,
              name: name,
              isGroup: channel.members && channel.members.length > 2,
              members: channel.members || [],
              createdAt: channel.createdAt || new Date().toISOString()
            }
          }))
      }
      
      // Ensure default conversation exists
      if (!conversations.find(c => c.id === 'default')) {
        conversations.unshift({
          id: 'default',
          name: 'General Chat',
          createdAt: new Date().toISOString(),
          lastMessage: null,
          lastMessageAt: null,
          unreadCount: 0
        })
      }
      
      // Add AI participant info to each conversation
      if (nodeOneCore.aiAssistantModel) {
        const aiContacts = nodeOneCore.aiAssistantModel.getAllContacts()
        
        conversations.forEach(conv => {
          // Check if this is an AI topic
          conv.isAITopic = nodeOneCore.aiAssistantModel.isAITopic(conv.id)
          
          // Check if any participants are AI
          conv.hasAIParticipant = conv.participants?.some(participantId => 
            aiContacts.some(contact => contact.personId === participantId)
          ) || false
          
          // Get the AI model ID if it's an AI topic
          if (conv.isAITopic) {
            conv.aiModelId = nodeOneCore.aiAssistantModel.getModelIdForTopic(conv.id)
          }
        })
      }
      
      // Fetch actual last message content for each conversation
      if (nodeOneCore.topicModel) {
        await Promise.all(conversations.map(async (conv) => {
          try {
            const topicRoom = await nodeOneCore.topicModel.enterTopicRoom(conv.id)
            const messages = await topicRoom.retrieveAllMessages()
            if (messages && messages.length > 0) {
              const lastMessage = messages[messages.length - 1] // Get last message
              conv.lastMessage = {
                text: lastMessage.data?.text || lastMessage.text,
                senderId: lastMessage.data?.senderId || lastMessage.senderId,
                timestamp: lastMessage.data?.timestamp || lastMessage.timestamp
              }
            }
          } catch (error) {
            console.warn(`Failed to get last message for conversation ${conv.id}:`, error)
          }
        }))
      }
      
      // Sort by last message time (most recent first)
      conversations.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
        return bTime - aTime
      })
      
      // Apply pagination
      const paginated = conversations.slice(offset, offset + limit)
      
      return {
        success: true,
        data: paginated,
        total: conversations.length,
        hasMore: offset + limit < conversations.length
      }
    } catch (error) {
      console.error('[ChatHandler] Error getting conversations:', error)
      return {
        success: false,
        error: error.message,
        data: [],
        total: 0,
        hasMore: false
      }
    }
  },

  async getConversation(event, { conversationId }) {
    console.log('[ChatHandler] Get conversation:', conversationId)
    
    try {
      // Get conversation from TopicModel
      if (!nodeOneCore.initialized || !nodeOneCore.topicModel) {
        throw new Error('Node not initialized')
      }
      
      // Try to get the topic
      const topic = await nodeOneCore.topicModel.topics.queryById(conversationId)
      
      if (!topic) {
        throw new Error(`Conversation not found: ${conversationId}`)
      }
      
      // Convert to conversation format
      const conversation = {
        id: topic.id,
        name: topic.name || topic.id,
        createdAt: topic.creationTime ? new Date(topic.creationTime).toISOString() : new Date().toISOString(),
        participants: topic.members || []
      }
      
      // Add AI participant info
      if (nodeOneCore.aiAssistantModel) {
        const aiContacts = nodeOneCore.aiAssistantModel.getAllContacts()
        
        // Check if this is an AI topic
        conversation.isAITopic = nodeOneCore.aiAssistantModel.isAITopic(conversation.id)
        
        // Check if any participants are AI
        conversation.hasAIParticipant = conversation.participants?.some(participantId => 
          aiContacts.some(contact => contact.personId === participantId)
        ) || false
        
        // Get the AI model ID if it's an AI topic
        if (conversation.isAITopic) {
          conversation.aiModelId = nodeOneCore.aiAssistantModel.getModelIdForTopic(conversation.id)
        }
      }
      
      return conversation
    } catch (error) {
      console.error('[ChatHandler] Error getting conversation:', error)
      throw error
    }
  },
  
  async getCurrentUser(event) {
    console.log('[ChatHandler] Get current user')
    
    try {
      // Check if node is provisioned
      if (!nodeProvisioning.isProvisioned() || !nodeOneCore.ownerId) {
        // Fallback to state manager
        const userId = stateManager.getState('user.id')
        const userName = stateManager.getState('user.name')
        
        if (userId) {
          return {
            success: true,
            user: {
              id: userId,
              name: userName || 'User'
            }
          }
        }
        
        return {
          success: false,
          error: 'User not authenticated'
        }
      }
      
      // Get from Node ONE.core instance
      const ownerId = nodeOneCore.ownerId
      let userName = 'User'
      
      // Try to get name from LeuteModel
      if (nodeOneCore.leuteModel) {
        try {
          const me = await nodeOneCore.leuteModel.me()
          if (me) {
            const profile = await me.mainProfile()
            if (profile?.personDescriptions?.length > 0) {
              const nameDesc = profile.personDescriptions.find(d => 
                d.$type$ === 'PersonName' && d.name
              )
              if (nameDesc?.name) {
                userName = nameDesc.name
              }
            }
          }
        } catch (e) {
          console.warn('[ChatHandler] Could not get user profile:', e)
        }
      }
      
      return {
        success: true,
        user: {
          id: ownerId,
          name: userName
        }
      }
    } catch (error) {
      console.error('[ChatHandler] Error getting current user:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  async clearConversation(event, { conversationId }) {
    console.log('[ChatHandler] Clear conversation:', conversationId)
    
    try {
      if (!nodeOneCore) {
        throw new Error('Node ONE.core not initialized')
      }

      // Get the topic room
      const topicRoom = nodeOneCore.topicModel.getTopicRoom(conversationId)
      if (!topicRoom) {
        console.log('[ChatHandler] Topic room not found for:', conversationId)
        return {
          success: false,
          error: 'Conversation not found'
        }
      }

      // Clear messages from the channel
      // Since we can't actually delete messages from the immutable channel,
      // we'll need to create a new channel or mark this as cleared
      console.log('[ChatHandler] Clearing messages for conversation:', conversationId)
      
      // If this is the default chat and we have AI, trigger welcome message
      if (conversationId === 'default' && nodeOneCore.aiAssistantModel) {
        console.log('[ChatHandler] Triggering welcome message for cleared default chat')
        
        try {
          // handleNewTopic will send the thinking indicator
          await nodeOneCore.aiAssistantModel.handleNewTopic(conversationId, topicRoom)
          console.log('[ChatHandler] Welcome message generated for cleared chat')
        } catch (error) {
          console.error('[ChatHandler] Failed to generate welcome message:', error)
        }
      }

      return {
        success: true,
        message: 'Conversation cleared'
      }
    } catch (error) {
      console.error('[ChatHandler] Error clearing conversation:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default chatHandlers