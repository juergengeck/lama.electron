/**
 * Chat IPC Handlers
 */

import stateManager from '../../state/manager.js';
import instanceManager from '../../core/instance.js';
import nodeProvisioning from '../../hybrid/node-provisioning.js';
import nodeOneCore from '../../core/node-one-core.js';
import { BrowserWindow } from 'electron';
import { MessageVersionManager } from '../../core/message-versioning.js';
import { MessageAssertionManager } from '../../core/message-assertion-certificates.js';

// Topic creation mutex to prevent race conditions
const topicCreationInProgress = new Map()

// Welcome message mutex to prevent duplicate welcome messages
const welcomeMessageInProgress = new Map()

// Message version manager instance
let messageVersionManager = null

// Message assertion manager instance
let messageAssertionManager = null

const chatHandlers = {
  async uiReady(event) {
    console.log('[ChatHandler] UI signaled ready for messages')
    // Notify the PeerMessageListener that UI is ready
    const { default: nodeOneCore } = await import('../../core/node-one-core.js')
    if (nodeOneCore.peerMessageListener) {
      const { BrowserWindow } = await import('electron')
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) {
        nodeOneCore.peerMessageListener.setMainWindow(mainWindow)
        console.log('[ChatHandler] Updated PeerMessageListener with current window')
      }
    }
    return { success: true }
  },

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
            // For P2P conversations, let TopicModel handle it with createOneToOneTopic
            const [id1, id2] = conversationId.split('<->')
            console.log('[ChatHandler] P2P conversation - using TopicModel.createOneToOneTopic')

            await nodeOneCore.topicModel.createOneToOneTopic(id1, id2)
            console.log('[ChatHandler] Created P2P topic via TopicModel')
          } else {
            // For group topics, include default AI if available
            if (nodeOneCore.aiAssistantModel) {
              const aiContacts = nodeOneCore.aiAssistantModel.getAllContacts()
              if (aiContacts.length > 0) {
                participantIds.push(aiContacts[0].personId) // Add first AI as default participant
              }
            }

            await nodeOneCore.topicGroupManager.createGroupTopic(conversationId, conversationId, participantIds)
            console.log('[ChatHandler] Created group topic with channels for all participants')
          }
        } else {
          // Fallback - let TopicModel handle it
          const isP2P = conversationId.includes('<->')

          if (isP2P) {
            const [id1, id2] = conversationId.split('<->')
            await nodeOneCore.topicModel.createOneToOneTopic(id1, id2)
          } else {
            // For group topics, use createGroupTopic with our owner
            await nodeOneCore.topicModel.createGroupTopic(conversationId, conversationId, nodeOneCore.ownerId)
          }
          console.log('[ChatHandler] Created topic via TopicModel - access handled by library')
        }
        
        topicRoom = await nodeOneCore.topicModel.enterTopicRoom(conversationId)
      }
      
      // Send message through TopicModel (this syncs via ChannelManager)
      // TopicRoom.sendMessage expects (message, author, channelOwner)
      // undefined author means "use my main identity"
      // For P2P: channelOwner should be null (shared channel)
      // For group: channelOwner should be undefined (use my main identity)
      console.log('[ChatHandler] DEBUG: About to send message to topicRoom')
      console.log('[ChatHandler] Attachments:', attachments?.length || 0)

      const isP2P = conversationId.includes('<->')
      const channelOwner = isP2P ? null : undefined

      // Check if we have attachments
      if (attachments && attachments.length > 0) {
        console.log('[ChatHandler] Sending message with attachments')

        // Extract hashes from attachment objects
        // Attachments should have a hash property from the AttachmentService
        const attachmentHashes = attachments.map(att => {
          if (typeof att === 'string') return att
          return att.hash || att.id
        }).filter(Boolean)

        console.log('[ChatHandler] Attachment hashes:', attachmentHashes)

        // Use sendMessageWithAttachmentAsHash method
        await topicRoom.sendMessageWithAttachmentAsHash(
          text || '', // Ensure text is not undefined
          attachmentHashes,
          undefined, // author - undefined means use my main identity
          channelOwner
        )
      } else {
        // Use regular sendMessage method (as per one.leute reference implementation)
        await topicRoom.sendMessage(text, undefined, channelOwner)
      }

      // Create versioned message object - just for UI display
      const message = {
        id: `msg-${Date.now()}`,
        versionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        version: 1,
        previousVersion: null,
        conversationId,
        text,
        attachments,
        sender: userId,
        timestamp: new Date().toISOString(),
        status: 'sent',
        isRetracted: false,
        editedAt: null
      }

      // Message versioning disabled for now - needs proper versioned object implementation
      // The actual message is already stored through TopicRoom.sendMessage()
      /*
      if (!messageVersionManager && nodeOneCore.channelManager) {
        messageVersionManager = new MessageVersionManager(nodeOneCore.channelManager)
      }
      if (messageVersionManager) {
        const messageHash = await messageVersionManager.storeMessage(message)

        // Create assertion certificate for the message
        if (!messageAssertionManager && nodeOneCore.trustedKeysManager && nodeOneCore.leuteModel) {
          messageAssertionManager = new MessageAssertionManager(
            nodeOneCore.trustedKeysManager,
            nodeOneCore.leuteModel
          )
        }

        if (messageAssertionManager) {
          try {
            const assertion = await messageAssertionManager.createMessageAssertion(message, messageHash)
            console.log('[ChatHandler] Created assertion certificate:', assertion.certificateHash?.substring(0, 8))

            // Add certificate reference to message for UI
            message.assertionCertificate = assertion.certificateHash
          } catch (error) {
            console.warn('[ChatHandler] Could not create assertion certificate:', error.message)
            // Continue without certificate - not critical
          }
        }
      }
      */

      // Don't store in stateManager - TopicModel is the source of truth

      // Notify renderer about the new message - single event for consistency
      event.sender.send('chat:newMessages', { conversationId, messages: [message] })
      
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
                  // For P2P conversations, use createP2PTopic (single null-owner channel)
                  const [id1, id2] = conversationId.split('<->')
                  participantIds = [id1, id2]
                  console.log('[ChatHandler] P2P conversation - participants:', participantIds.map(p => p.substring(0, 8)).join(', '))

                  await nodeOneCore.topicGroupManager.createP2PTopic(conversationId, conversationId, participantIds)
                  console.log('[ChatHandler] Created P2P topic with null-owner channel')
                } else {
                  // For group topics, include default AI if available
                  if (nodeOneCore.aiAssistantModel) {
                    const aiContacts = nodeOneCore.aiAssistantModel.getAllContacts()
                    if (aiContacts.length > 0) {
                      participantIds.push(aiContacts[0].personId)
                    }
                  }

                  await nodeOneCore.topicGroupManager.createGroupTopic(conversationId, conversationId, participantIds)
                  console.log('[ChatHandler] Topic created successfully with channels for all participants')
                }
              } else {
                // Fallback to old method
                const isP2P = conversationId.includes('<->')
                const channelOwner = isP2P ? null : nodeOneCore.ownerId
                await nodeOneCore.topicModel.createGroupTopic(conversationId, conversationId, channelOwner)
                console.log('[ChatHandler] Topic created with', isP2P ? 'null owner (P2P)' : 'owner')
              }
              return true
            } catch (createError) {
              console.error('[ChatHandler] Could not create topic:', createError)
              return false
            }
          })()
          
          // Store the promise so other requests can wait
          topicCreationInProgress.set(conversationId, creationPromise)

          let created
          try {
            created = await creationPromise
          } finally {
            // Always clean up the mutex, even on error
            topicCreationInProgress.delete(conversationId)
          }
          
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
      
      // Check if this is the Hi introductory chat and was just created
      if (conversationId === 'hi' && topicWasJustCreated) {
        if (nodeOneCore.aiAssistantModel) {
          console.log('[ChatHandler] Sending welcome message for Hi chat')

          // Use the default AI assistant for the welcome message
          const aiContacts = nodeOneCore.aiAssistantModel.getAllContacts()
          const defaultAI = aiContacts[0] // Use the first/default AI

          if (defaultAI) {
            const aiPersonId = defaultAI.personId
            const aiName = defaultAI.name?.replace('-private', '') || 'your AI assistant'

            const introMessage = `Welcome to LAMA! 👋

I'm ${aiName}, your AI assistant running entirely on your device.

🔒 **Privacy First**: All conversations stay on your device. Your AI assistant can access conversation history to provide better context-aware help.

💡 **How to Use**:
• Start chatting with me right here - just type your message below
• Click the + button to create new chats or group conversations
• Add friends as contacts to start P2P conversations
• Configure additional AI models in Settings → AI Models

📝 **Quick Start**:
Type anything to begin - ask questions, have discussions, or request help with tasks. I'm here to assist!`

            // Send the message from the AI assistant
            await topicRoom.sendMessage(introMessage, aiPersonId)
            console.log(`[ChatHandler] Hi chat welcome message sent from ${aiName}`)

            // Note: We don't register 'hi' as an AI topic
            // This is just a one-time welcome message, not an ongoing AI conversation
          } else {
            // No AI setup yet - create a simple welcome message from the system
            console.log('[ChatHandler] No AI contacts available - creating simple welcome message')

            const systemMessage = `Welcome to LAMA! 👋

LAMA is your private AI assistant that runs entirely on your device.

To get started:
1. Add an AI model in Settings → AI Models
2. Once configured, switch to the LAMA chat to begin

This Hi chat is just an introduction. Feel free to delete it once you're familiar with LAMA.`

            // Send message from the current user (owner)
            await topicRoom.sendMessage(systemMessage, nodeOneCore.ownerId)
            console.log('[ChatHandler] Hi chat system welcome message sent')
          }
        }
      }

      // Check if chat needs welcome message - for lama conversation or AI conversations
      const isAITopic = nodeOneCore.aiAssistantModel?.isAITopic(conversationId)
      const isDefaultConversation = conversationId === 'lama'

      if (nodeOneCore.aiAssistantModel && (isAITopic || isDefaultConversation)) {
        let hasRealMessages = false
        
        // If we JUST created the topic, skip the message check - it's guaranteed to be empty
        // The storage layer creates phantom entries during async initialization
        if (topicWasJustCreated) {
          console.log('[ChatHandler] Topic was just created, skipping message check - triggering welcome message')
          hasRealMessages = false
        } else {
          const existingMessages = await topicRoom.retrieveAllMessages()
          console.log(`[ChatHandler] Found ${existingMessages.length} existing messages in AI chat ${conversationId}`)
          
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
          // Send welcome message if this is an empty AI conversation
          const shouldSendWelcome = !hasRealMessages

          if (shouldSendWelcome) {
            // Check if welcome message is already being generated
            if (welcomeMessageInProgress.has(conversationId)) {
              console.log(`[ChatHandler] Welcome message already in progress for ${conversationId}, skipping duplicate`)
            } else {
              // Mark as in progress
              const welcomePromise = (async () => {
                const welcomeStartTime = Date.now()
                console.log(`[ChatHandler] ⏱️ AI chat ${conversationId} is empty, triggering welcome message at ${new Date().toISOString()}`)

                try {
                  // Register this as an AI topic if not already registered
                  if (!nodeOneCore.aiAssistantModel.isAITopic(conversationId)) {
                    const defaultModel = nodeOneCore.aiAssistantModel.getDefaultModel()
                    if (defaultModel) {
                      nodeOneCore.aiAssistantModel.registerAITopic(conversationId, defaultModel.id)
                    }
                  }

                  // Block and wait for welcome message (handleNewTopic will send thinking indicator)
                  await nodeOneCore.aiAssistantModel.handleNewTopic(conversationId, topicRoom)
                  console.log(`[ChatHandler] ⏱️ Welcome message completed in ${Date.now() - welcomeStartTime}ms`)
                } catch (error) {
                  console.error(`[ChatHandler] Failed to generate welcome message after ${Date.now() - welcomeStartTime}ms:`, error)
                  // Continue without welcome message rather than failing the whole operation
                } finally {
                  // Clear the mutex
                  welcomeMessageInProgress.delete(conversationId)
                }
              })()

              welcomeMessageInProgress.set(conversationId, welcomePromise)
              await welcomePromise
            }
          } else {
            console.log(`[ChatHandler] Skipping welcome: hasRealMessages=${hasRealMessages}`)
          }
        } else {
          console.log('[ChatHandler] AI chat already has messages, skipping welcome')
        }
      }
      
      // Get messages from the topic room
      // TopicRoom.retrieveAllMessages() aggregates from ALL channels with the same topic ID
      let rawMessages = []

      // Check if this is a P2P conversation for logging purposes
      if (conversationId.includes('<->')) {
        // Get all channels with this topic ID for debugging
        const allChannels = await nodeOneCore.channelManager.getMatchingChannelInfos({
          channelId: conversationId
        })

        console.log(`[ChatHandler] P2P conversation - Found ${allChannels.length} channels:`,
          allChannels.map(c => ({
            id: c.id,
            owner: c.owner?.substring(0, 8) || 'undefined'
          })))
      }

      // Use standard method for ALL conversations (P2P and group)
      rawMessages = await topicRoom.retrieveAllMessages()
      console.log('[ChatHandler] Retrieved', rawMessages.length, 'messages from TopicRoom')

      // FALLBACK: Check for messages using Someone IDs if we got no messages in P2P
      // This handles the case where messages were sent before fixes
      if (conversationId.includes('<->') && rawMessages.length === 0) {
        console.log('[ChatHandler] No messages found, checking Someone ID patterns...')
          
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

          // Try different channel ID combinations with Someone IDs
          if (someoneIds.length > 0) {
            let fallbackMessages = []
            for (const someoneId of someoneIds) {
              // Try patterns like someoneId<->personId
              const altChannelIds = [
                `${someoneId}<->${id1}`,
                `${someoneId}<->${id2}`,
                `${id1}<->${someoneId}`,
                `${id2}<->${someoneId}`
              ]

              for (const altId of altChannelIds) {
                // TODO: getObjectsWithType is no longer available in the new vendor packages
                // const altMessages = await nodeOneCore.channelManager.getObjectsWithType('ChatMessage', {
                //   channelId: altId
                // })

                // if (altMessages.length > 0) {
                //   console.log(`[ChatHandler] Found ${altMessages.length} messages in alternate channel: ${altId}`)
                //   fallbackMessages = [...fallbackMessages, ...altMessages]
                // }
              }
            }

            // Also try Someone<->Someone patterns
            if (someoneIds.length >= 2) {
              const sortedSomeoneIds = someoneIds.sort()
              const someoneChannelId = `${sortedSomeoneIds[0]}<->${sortedSomeoneIds[1]}`
              // TODO: getObjectsWithType is no longer available in the new vendor packages
              // const someoneMessages = await nodeOneCore.channelManager.getObjectsWithType('ChatMessage', {
              //   channelId: someoneChannelId
              // })

              // if (someoneMessages.length > 0) {
              //   console.log(`[ChatHandler] Found ${someoneMessages.length} messages in Someone<->Someone channel: ${someoneChannelId}`)
              //   fallbackMessages = [...fallbackMessages, ...someoneMessages]
              // }
            }

            rawMessages = [...rawMessages, ...fallbackMessages]
            }
          }
        }
        
        console.log(`[ChatHandler] Total messages after fallback check: ${rawMessages.length}`)
      }
      
      // Sort messages by timestamp
      rawMessages.sort((a, b) => {
        const timeA = a.creationTime || a.timestamp || 0
        const timeB = b.creationTime || b.timestamp || 0
        return timeA - timeB
      })

      // Filter for actual ChatMessage objects - they have data.text
      const validMessages = rawMessages.filter(msg =>
        msg.data?.text && typeof msg.data.text === 'string' && msg.data.text.trim() !== ''
      )
      
      // Transform messages to UI format
      const formattedMessages = await Promise.all(validMessages.map(async (msg) => {
        const senderId = msg.data?.sender || msg.data?.author || msg.author || nodeOneCore.ownerId

        // Check if sender is an AI contact and get their name
        let isAI = false
        let senderName = 'Unknown'

        console.log(`[ChatHandler] AI model check - aiAssistantModel: ${!!nodeOneCore.aiAssistantModel}`)
        if (nodeOneCore.aiAssistantModel) {
          console.log(`[ChatHandler] Checking if ${senderId?.toString().substring(0, 8)}... is AI`)
          // Use AIAssistantModel as source of truth
          isAI = nodeOneCore.aiAssistantModel.isAIPerson(senderId)
          console.log(`[ChatHandler] Result: isAI = ${isAI}`)

          if (isAI) {
            // Get the LLM object to find the name
            const llmObjects = nodeOneCore.aiAssistantModel.llmObjectManager.getAllLLMObjects()
            const llmObject = llmObjects.find(obj => {
              try {
                return obj.personId && senderId && obj.personId.toString() === senderId.toString()
              } catch (e) {
                return false
              }
            })

            if (llmObject) {
              senderName = llmObject.modelName || llmObject.modelId || 'AI Assistant'
              console.log(`[ChatHandler] AI message from ${senderName} (${senderId?.toString().substring(0, 8)}...)`)
            }
          }
        }

        // For non-AI senders, try to get their name from profiles
        if (!isAI && nodeOneCore.leuteModel && senderId) {
          try {
            // Check if it's the current user
            const me = await nodeOneCore.leuteModel.me()
            if (me.personId && senderId && me.personId.toString() === senderId.toString()) {
              const profile = await me.mainProfile()
              senderName = profile?.name || 'You'
            } else {
              // Try to get other person's profile
              const others = await nodeOneCore.leuteModel.others()
              for (const someone of others) {
                try {
                  const personId = await someone.mainIdentity()
                  if (personId && senderId && personId.toString() === senderId.toString()) {
                    const profile = await someone.mainProfile()
                    if (profile) {
                      // Check PersonName objects
                      const personName = profile.personDescriptions?.find(d => d.$type$ === 'PersonName')
                      senderName = personName?.name || profile.name || 'User'
                      break
                    }
                  }
                } catch (e) {
                  // Continue to next person
                }
              }
            }
          } catch (error) {
            console.log('[ChatHandler] Could not get sender name:', error.message)
          }
        }

        return {
          id: msg.id || msg.channelEntryHash || `msg-${Date.now()}`,
          conversationId,
          text: msg.data?.text || '',
          attachments: msg.data?.attachments || [], // Include attachments from the message
          sender: senderId,
          senderName: senderName,
          timestamp: msg.creationTime ? new Date(msg.creationTime).toISOString() : new Date().toISOString(),
          status: 'received',
          isAI: isAI,
          isFromAI: isAI,  // Also set isFromAI for compatibility
          format: 'markdown'  // All messages support markdown
        }
      }))
      
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
        // Use conversation name as deterministic topic ID
        // Clean the name to make a valid ID
        let baseName = name || `group-${Date.now()}`
        const cleanName = baseName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')

        // Check if a topic with this ID already exists
        let finalTopicId = cleanName
        let counter = 1
        while (true) {
          try {
            // Try to enter the topic room to check if it exists
            const testRoom = await nodeOneCore.topicModel.enterTopicRoom(finalTopicId)
            await testRoom.leave()
            // Topic exists, add a counter to make it unique
            finalTopicId = `${cleanName}-${counter}`
            counter++
            console.log(`[ChatHandler] Topic ID '${cleanName}' already exists, trying '${finalTopicId}'`)
          } catch (error) {
            // Topic doesn't exist, we can use this ID
            break
          }
        }
        topicId = finalTopicId
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
              const isP2P = conversation.id.includes('<->')
              const channelOwner = isP2P ? null : nodeOneCore.ownerId
              await nodeOneCore.channelManager.createChannel(conversation.id, channelOwner)
            } catch (channelError) {
              console.log('[ChatHandler] Channel might already exist:', channelError.message)
            }
          }
        }
      } else if (nodeOneCore.channelManager) {
        // Fallback if TopicGroupManager not available
        try {
          console.log('[ChatHandler] Creating Node.js channel for conversation:', conversation.id)
          const isP2P = conversation.id.includes('<->')
          const channelOwner = isP2P ? null : nodeOneCore.ownerId
          await nodeOneCore.channelManager.createChannel(conversation.id, channelOwner)
          console.log('[ChatHandler] Created Node.js channel with owner:', isP2P ? 'null (P2P)' : nodeOneCore.ownerId)
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
        console.log('[ChatHandler] Channels by ID:', JSON.stringify(channelDebug, null, 2))
        
        // Group channels by topic ID to handle group chats and P2P correctly
        // In both cases, each participant has their own channel with the same topic ID
        const topicMap = new Map()
        const processedIds = new Set() // Track which IDs we've already processed

        // Pre-fetch contact names for P2P chats
        const p2pNameCache = new Map()

        for (const channel of channels) {
          // Skip system channels
          if (channel.id === 'contacts') continue

          // For P2P conversations, normalize the ID to prevent duplicates
          // Both "someoneId<->personId" and "personId1<->personId2" should be treated as same conversation
          let normalizedId = channel.id
          if (channel.id.includes('<->')) {
            const parts = channel.id.split('<->')

            // Skip self-P2P channels (conversations with ourselves)
            if (parts[0] === parts[1]) {
              console.log(`[ChatHandler] Skipping self-P2P channel: ${channel.id}`)
              continue
            }

            // Always sort the IDs to get a consistent key
            normalizedId = parts.sort().join('<->')
            console.log(`[ChatHandler] P2P channel ${channel.id} normalized to ${normalizedId}`)

            // Look up contact name for P2P chats
            if (!p2pNameCache.has(normalizedId) && nodeOneCore.leuteModel) {
              try {
                const otherPersonId = parts.find(id => id !== nodeOneCore.ownerId)
                console.log('[ChatHandler] Looking up name for P2P chat, otherPersonId:', otherPersonId?.substring(0, 8))

                if (otherPersonId) {
                  // Get all contacts and find the one with this personId
                  const others = await nodeOneCore.leuteModel.others()
                  console.log('[ChatHandler] Total contacts:', others.length)

                  // Need to check the person ID from the profile, not directly from Someone
                  let contact = null
                  for (const someone of others) {
                    try {
                      const profile = await someone.mainProfile()
                      if (profile?.personId === otherPersonId) {
                        contact = someone
                        break
                      }
                    } catch (e) {
                      // Profile might not be available
                    }
                  }
                  console.log('[ChatHandler] Found matching contact:', contact ? 'YES' : 'NO')

                  let displayName = null
                  if (contact) {
                    try {
                      const profile = await contact.mainProfile()
                      console.log('[ChatHandler] Got profile:', profile ? 'YES' : 'NO')

                      // Look for PersonName in profile descriptions
                      const nameDesc = profile?.personDescriptions?.find(d =>
                        d.$type$ === 'PersonName'
                      )
                      console.log('[ChatHandler] Found PersonName:', nameDesc?.name || 'NONE')

                      if (nameDesc?.name) {
                        displayName = nameDesc.name
                      } else if (profile?.name) {
                        // Fallback to profile name field
                        displayName = profile.name
                      }
                    } catch (e) {
                      console.log('[ChatHandler] Error getting profile:', e.message)
                    }

                    // If still no name, try to get from the Someone's name property
                    if (!displayName && contact.name) {
                      displayName = contact.name
                      console.log('[ChatHandler] Using Someone name:', displayName)
                    }

                    // If still no name, try to get from the Someone object itself
                    if (!displayName) {
                      try {
                        // Some Someone objects might have a getName method or similar
                        const someoneObj = await contact.object()
                        if (someoneObj?.name) {
                          displayName = someoneObj.name
                          console.log('[ChatHandler] Using Someone object name:', displayName)
                        }
                      } catch (e) {
                        // Ignore
                      }
                    }
                  }

                  if (!displayName) {
                    // Fallback to shortened ID
                    displayName = otherPersonId.substring(0, 8) + '...'
                  }

                  p2pNameCache.set(normalizedId, `Chat with ${displayName}`)
                  console.log(`[ChatHandler] Cached P2P name for ${normalizedId}: Chat with ${displayName}`)
                }
              } catch (e) {
                console.warn('[ChatHandler] Could not look up contact name:', e)
              }
            }
          }

          // Skip if we've already processed this topic ID
          if (processedIds.has(normalizedId)) {
            console.log(`[ChatHandler] Skipping duplicate: ${channel.id} (normalized: ${normalizedId})`)
            continue
          }

          // For ALL topics (group and P2P), consolidate by topic ID
          // We only need to show each conversation once, not once per channel
          processedIds.add(normalizedId)

          // Find the best channel for this topic (prefer our own for writing)
          const allChannelsForTopic = channels.filter(ch => ch.id === channel.id)
          const ourChannel = allChannelsForTopic.find(ch => ch.owner === nodeOneCore.ownerId)
          const channelToUse = ourChannel || allChannelsForTopic[0]

          topicMap.set(normalizedId, {
            ...channelToUse,
            id: normalizedId, // Use the normalized ID
            isOurs: channelToUse.owner === nodeOneCore.ownerId,
            participantCount: allChannelsForTopic.length, // Track how many participants
            cachedName: p2pNameCache.get(normalizedId) // Store the cached name if available
          })
        }
        
        // Convert map back to array for processing
        const filteredChannels = Array.from(topicMap.values())
        
        // Process channels with async operations
        conversations = await Promise.all(filteredChannels.map(async channel => {
            // Try to get the actual topic to access its name property
            let name = channel.cachedName || channel.name // Use cached name if available
            let topic = null

            try {
              if (nodeOneCore.topicModel && !name) {
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
                // Name should have been cached already, but fallback just in case
                const parts = channel.id.split('<->')
                const otherPersonId = parts.find(id => id !== nodeOneCore.ownerId) || parts[1]
                const displayName = otherPersonId.substring(0, 8) + '...'
                name = `Chat with ${displayName}`
              } else if (channel.id === 'lama') {
                name = 'LAMA'
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
            
            // Determine conversation type
            let conversationType = 'direct'
            let isGroupChat = false

            if (channel.id.includes('<->')) {
              conversationType = 'direct'
              isGroupChat = false
            } else if (channel.id === 'lama') {
              conversationType = 'direct' // LAMA is treated as direct AI chat
              isGroupChat = false
            } else if (channel.id.startsWith('topic-')) {
              conversationType = 'group'
              isGroupChat = true
            } else if (channel.participantCount > 2) {
              conversationType = 'group'
              isGroupChat = true
            }

            return {
              id: channel.id,
              name: name,
              type: conversationType,
              isGroup: isGroupChat,
              members: channel.members || [],
              participants: channel.participants || [],
              participantCount: channel.participantCount,
              createdAt: channel.createdAt || new Date().toISOString()
            }
          }))
      }
      
      // Note: We do NOT automatically recreate Hi or LAMA chats if deleted
      // They are only created during initial setup in node-one-core.js
      
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

  async addParticipants(event, { conversationId, participantIds }) {
    console.log('[ChatHandler] Add participants to conversation:', { conversationId, participantIds })

    try {
      if (!nodeProvisioning.isProvisioned()) {
        throw new Error('Node not provisioned')
      }

      if (!nodeOneCore.topicGroupManager) {
        throw new Error('TopicGroupManager not initialized')
      }

      // Validate participant IDs
      const validParticipantIds = participantIds.filter(id => id && typeof id === 'string')
      if (validParticipantIds.length === 0) {
        throw new Error('No valid participant IDs provided')
      }

      // Check if this is a P2P conversation or lama chat - if so, create a new group chat
      if (conversationId.includes('<->') || conversationId === 'lama') {
        const isP2P = conversationId.includes('<->')
        const isDefault = conversationId === 'lama'

        console.log(`[ChatHandler] ${isP2P ? 'P2P' : 'Default'} conversation detected - creating new group chat`)

        let originalParticipants = []
        let groupName = 'Group Chat'

        if (isP2P) {
          // Extract the two participants from the P2P conversation ID
          const [person1, person2] = conversationId.split('<->')
          originalParticipants = [person1, person2]

          // Try to get the original P2P conversation name
          try {
            const channels = await nodeOneCore.channelManager.channels()
            const p2pChannel = channels.find(ch => ch.id === conversationId)
            if (p2pChannel && p2pChannel.name) {
              groupName = `${p2pChannel.name} (Group)`
            }
          } catch (e) {
            console.log('[ChatHandler] Could not get P2P conversation name')
          }
        } else if (isDefault) {
          // For default chat, include the current user and AI
          originalParticipants = [nodeOneCore.ownerId]

          // Add the default AI assistant if available
          if (nodeOneCore.aiAssistantModel) {
            const aiContacts = nodeOneCore.aiAssistantModel.getAllContacts()
            if (aiContacts.length > 0) {
              originalParticipants.push(aiContacts[0].personId)
            }
          }

          groupName = 'AI Group Chat'
        }

        // Create a new group conversation with all participants
        // Include both original participants and the new ones
        const allParticipants = [...originalParticipants, ...validParticipantIds]
        // Remove duplicates
        const uniqueParticipants = [...new Set(allParticipants)]

        // Create new group topic ID based on group name
        let baseGroupName = groupName || `group-${Date.now()}`
        const cleanGroupName = baseGroupName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')

        // Check if a topic with this ID already exists
        let newGroupId = cleanGroupName
        let counter = 1
        while (true) {
          try {
            // Try to enter the topic room to check if it exists
            const testRoom = await nodeOneCore.topicModel.enterTopicRoom(newGroupId)
            await testRoom.leave()
            // Topic exists, add a counter to make it unique
            newGroupId = `${cleanGroupName}-${counter}`
            counter++
            console.log(`[ChatHandler] Group topic ID '${cleanGroupName}' already exists, trying '${newGroupId}'`)
          } catch (error) {
            // Topic doesn't exist, we can use this ID
            break
          }
        }

        console.log('[ChatHandler] Creating group chat with participants:', uniqueParticipants.map(id => id.substring(0, 8)).join(', '))

        // Create the group topic
        await nodeOneCore.topicGroupManager.createGroupTopic(
          groupName,
          newGroupId,
          uniqueParticipants
        )

        console.log('[ChatHandler] Created new group chat:', newGroupId)

        // Copy messages from P2P conversation to new group (default behavior)
        try {
          console.log('[ChatHandler] Copying messages from P2P to new group...')

          // Get messages from the P2P conversation
          const p2pMessages = await nodeOneCore.topicRoom.retrieveAllMessages(conversationId)

          if (p2pMessages && p2pMessages.length > 0) {
            console.log(`[ChatHandler] Found ${p2pMessages.length} messages to copy`)

            // Post each message to the new group (preserving order and timestamps)
            for (const message of p2pMessages) {
              if (message.data && message.data.text) {
                // Determine the sender (could be either participant in P2P)
                const sender = message.author || message.data.sender

                // Post to new group on behalf of the original sender
                await nodeOneCore.topicRoom.postMessage(
                  newGroupId,
                  {
                    text: message.data.text,
                    sender: sender,
                    originalTimestamp: message.creationTime || message.data.timestamp
                  },
                  sender // Post as the original sender
                )
              }
            }

            console.log(`[ChatHandler] Copied ${p2pMessages.length} messages to new group`)
          } else {
            console.log('[ChatHandler] No messages to copy from P2P conversation')
          }
        } catch (error) {
          console.warn('[ChatHandler] Failed to copy messages from P2P:', error.message)
          // Continue even if message copy fails
        }

        // Notify renderer about the new group creation
        event.sender.send('chat:p2pConvertedToGroup', {
          oldConversationId: conversationId,
          newConversationId: newGroupId,
          participantIds: uniqueParticipants
        })

        return {
          success: true,
          message: `Created new group chat with ${uniqueParticipants.length} participants`,
          newConversationId: newGroupId
        }
      }

      // Regular group chat - just add participants
      console.log('[ChatHandler] Adding participants:', validParticipantIds.map(id => id.substring(0, 8)).join(', '))

      // Add participants to the topic's group
      await nodeOneCore.topicGroupManager.addParticipantsToTopic(conversationId, validParticipantIds)
      console.log('[ChatHandler] Successfully added participants to topic group')

      // Notify renderer about the change
      event.sender.send('chat:participantsAdded', {
        conversationId,
        participantIds: validParticipantIds
      })

      return {
        success: true,
        message: `Added ${validParticipantIds.length} participants to conversation`
      }
    } catch (error) {
      console.error('[ChatHandler] Error adding participants:', error)
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
      const topicRoom = await nodeOneCore.topicModel.enterTopicRoom(conversationId)
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
      
      // If this is the lama chat and we have AI, trigger welcome message
      if (conversationId === 'lama' && nodeOneCore.aiAssistantModel) {
        console.log('[ChatHandler] Triggering welcome message for cleared lama chat')
        
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
  },

  // Edit message - creates a new version
  async editMessage(event, { messageId, conversationId, newText, editReason }) {
    console.log('[ChatHandler] Edit message:', { messageId, conversationId })

    try {
      // Initialize version manager if needed
      if (!messageVersionManager && nodeOneCore.channelManager) {
        messageVersionManager = new MessageVersionManager(nodeOneCore.channelManager)
      }

      if (!messageVersionManager) {
        throw new Error('Message version manager not available')
      }

      // Create edited version
      const result = await messageVersionManager.editMessage(messageId, newText, editReason)

      // Notify UI about the edited message
      event.sender.send('chat:messageEdited', {
        conversationId,
        messageId,
        newVersion: result.message
      })

      return {
        success: true,
        data: result.message
      }
    } catch (error) {
      console.error('[ChatHandler] Error editing message:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  // Delete message - creates a retraction marker
  async deleteMessage(event, { messageId, conversationId, reason }) {
    console.log('[ChatHandler] Delete message:', { messageId, conversationId })

    try {
      // Initialize version manager if needed
      if (!messageVersionManager && nodeOneCore.channelManager) {
        messageVersionManager = new MessageVersionManager(nodeOneCore.channelManager)
      }

      if (!messageVersionManager) {
        throw new Error('Message version manager not available')
      }

      // Create retraction marker
      const result = await messageVersionManager.retractMessage(messageId, reason)

      if (result) {
        // Notify UI about the retracted message
        event.sender.send('chat:messageRetracted', {
          conversationId,
          messageId,
          retraction: result.message
        })
      }

      return {
        success: true,
        data: result?.message
      }
    } catch (error) {
      console.error('[ChatHandler] Error deleting message:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  // Get message version history
  async getMessageHistory(event, { messageId }) {
    console.log('[ChatHandler] Get message history:', messageId)

    try {
      // Initialize version manager if needed
      if (!messageVersionManager && nodeOneCore.channelManager) {
        messageVersionManager = new MessageVersionManager(nodeOneCore.channelManager)
      }

      if (!messageVersionManager) {
        throw new Error('Message version manager not available')
      }

      // Get all versions
      const versions = await messageVersionManager.getVersionHistory(messageId)

      return {
        success: true,
        data: versions
      }
    } catch (error) {
      console.error('[ChatHandler] Error getting message history:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  // Export message as verifiable credential
  async exportMessageCredential(event, { messageId }) {
    console.log('[ChatHandler] Export message as verifiable credential:', messageId)

    try {
      // Initialize assertion manager if needed
      if (!messageAssertionManager && nodeOneCore.trustedKeysManager && nodeOneCore.leuteModel) {
        messageAssertionManager = new MessageAssertionManager(
          nodeOneCore.trustedKeysManager,
          nodeOneCore.leuteModel
        )
      }

      if (!messageAssertionManager) {
        throw new Error('Message assertion manager not available')
      }

      // Export as verifiable credential
      const credential = await messageAssertionManager.exportAsVerifiableCredential(messageId)

      return {
        success: true,
        data: credential
      }
    } catch (error) {
      console.error('[ChatHandler] Error exporting credential:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  // Verify message assertion certificate
  async verifyMessageAssertion(event, { certificateHash, messageHash }) {
    console.log('[ChatHandler] Verify message assertion:', certificateHash?.substring(0, 8))

    try {
      // Initialize assertion manager if needed
      if (!messageAssertionManager && nodeOneCore.trustedKeysManager && nodeOneCore.leuteModel) {
        messageAssertionManager = new MessageAssertionManager(
          nodeOneCore.trustedKeysManager,
          nodeOneCore.leuteModel
        )
      }

      if (!messageAssertionManager) {
        throw new Error('Message assertion manager not available')
      }

      // Verify the assertion
      const verification = await messageAssertionManager.verifyMessageAssertion(
        certificateHash,
        messageHash
      )

      return {
        success: true,
        data: verification
      }
    } catch (error) {
      console.error('[ChatHandler] Error verifying assertion:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default chatHandlers