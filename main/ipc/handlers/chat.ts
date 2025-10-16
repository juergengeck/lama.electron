import type { ChannelManager } from '@refinio/one.models/lib/models/index.js';
/**
 * Chat IPC Handlers
 */

import stateManager from '../../state/manager.js';
import instanceManager from '../../core/instance.js';
import nodeProvisioning from '../../services/node-provisioning.js';
import nodeOneCore from '../../core/node-one-core.js';
import electron from 'electron';
const { BrowserWindow } = electron;
import { MessageVersionManager } from '../../core/message-versioning.js';
import { MessageAssertionManager } from '../../core/message-assertion-certificates.js';
import type { IpcMainInvokeEvent } from 'electron';

// Simple topic creation following one.leute patterns

// Message version manager instance
let messageVersionManager: MessageVersionManager | null = null

// Message assertion manager instance
let messageAssertionManager: MessageAssertionManager | null = null

interface SendMessageParams {
  conversationId: string;
  text: string;
  attachments?: any[];
}

interface GetMessagesParams {
  conversationId: string;
  limit?: number;
  offset?: number;
}

interface CreateConversationParams {
  type?: string;
  participants?: any[];
  name?: string | null;
}

interface GetConversationsParams {
  limit?: number;
  offset?: number;
}

interface GetConversationParams {
  conversationId: string;
}

interface AddParticipantsParams {
  conversationId: string;
  participantIds: string[];
}

interface ClearConversationParams {
  conversationId: string;
}

interface EditMessageParams {
  messageId: string;
  conversationId: string;
  newText: string;
  editReason?: string;
}

interface DeleteMessageParams {
  messageId: string;
  conversationId: string;
  reason?: string;
}

interface GetMessageHistoryParams {
  messageId: string;
}

interface ExportMessageCredentialParams {
  messageId: string;
}

interface VerifyMessageAssertionParams {
  certificateHash: string;
  messageHash: string;
}

interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  messages?: any[];
  total?: number;
  hasMore?: boolean;
  message?: string;
  [key: string]: any;
}

const chatHandlers = {
  async initializeDefaultChats(event: IpcMainInvokeEvent): Promise<IpcResponse> {
    console.log('[ChatHandler] Initializing default chats')

    try {
      if (!nodeProvisioning.isProvisioned() || !nodeOneCore.topicModel) {
        return { success: false, error: 'Node not ready' }
      }

      // Don't create any chats here - they should only be created when we have an AI model
      console.log('[ChatHandler] Skipping chat creation - will create when model is selected')

      return { success: true }
    } catch (error) {
      console.error('[ChatHandler] Error initializing default chats:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  async uiReady(event: IpcMainInvokeEvent): Promise<IpcResponse> {
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

  async sendMessage(event: IpcMainInvokeEvent, { conversationId, text, attachments = [] }: SendMessageParams): Promise<IpcResponse> {
    console.log('[ChatHandler] Send message:', { conversationId, text })

    try {
      // Check if node is provisioned and has TopicModel
      if (!nodeProvisioning.isProvisioned()) {
        throw new Error('Node not provisioned')
      }

      if (!nodeOneCore.topicModel) {
        throw new Error('TopicModel not initialized')
      }

      const userId = stateManager.getState('user.id' as any)
      if (!userId) {
        throw new Error('User not authenticated')
      }

      // DEFENSIVE: Validate conversationId to prevent cross-contamination
      if (!conversationId || typeof conversationId !== 'string') {
        throw new Error(`Invalid conversationId: ${conversationId}`)
      }

      // Simple topic room access - let TopicModel handle creation
      let topicRoom: any
      try {
        topicRoom = await nodeOneCore.topicModel.enterTopicRoom(conversationId)
      } catch (error) {
        // Topic doesn't exist - this is the root cause issue
        // We should not be creating topics here in sendMessage
        console.error('[ChatHandler] Topic does not exist for conversation:', conversationId)
        throw new Error(`Topic ${conversationId} not found. Topics should be created before sending messages.`)
      }

      // Send message through TopicModel (this syncs via ChannelManager)
      // TopicRoom.sendMessage expects (message, author, channelOwner)
      // undefined author means "use my main identity"
      // For P2P: channelOwner should be null (shared channel)
      // For group: channelOwner should be YOUR person ID (you write to YOUR channel)
      console.log('[ChatHandler] DEBUG: About to send message to topicRoom')
      console.log('[ChatHandler] Attachments:', attachments?.length || 0)

      const isP2P = conversationId.includes('<->')
      // CRITICAL: For group chats, each participant writes to THEIR OWN channel
      // This means channelOwner should be the current user's person ID
      const channelOwner = isP2P ? null : nodeOneCore.ownerId

      // Check if we have attachments
      if (attachments && attachments.length > 0) {
        console.log('[ChatHandler] Sending message with attachments')

        // Extract hashes from attachment objects
        // Attachments should have a hash property from the AttachmentService
        const attachmentHashes: any[] = attachments.map(att => {
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
        const messageHash: any = await messageVersionManager.storeMessage(message)

        // Create assertion certificate for the message
        if (!messageAssertionManager && nodeOneCore.trust && nodeOneCore.leuteModel) {
          messageAssertionManager = new MessageAssertionManager(
            nodeOneCore.trust,
            nodeOneCore.leuteModel
          )
        }

        if (messageAssertionManager) {
          try {
            const assertion: any = await messageAssertionManager.createMessageAssertion(message, messageHash)
            console.log('[ChatHandler] Created assertion certificate:', assertion.certificateHash?.substring(0, 8))

            // Add certificate reference to message for UI
            message.assertionCertificate = assertion.certificateHash
          } catch (error: unknown) {
            console.warn('[ChatHandler] Could not create assertion certificate:', (error as Error).message)
            // Continue without certificate - not critical
          }
        }
      }
      */

      // Don't store in stateManager - TopicModel is the source of truth
      // Message will be received via normal TopicRoom flow, no need to emit here

      return {
        success: true,
        data: message
      }
    } catch (error) {
      console.error('[ChatHandler] Error sending message:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  async getMessages(event: IpcMainInvokeEvent, { conversationId, limit = 50, offset = 0 }: GetMessagesParams): Promise<IpcResponse> {
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

      // Simple topic room access
      let topicRoom: any
      try {
        topicRoom = await nodeOneCore.topicModel.enterTopicRoom(conversationId)
        console.log(`[ChatHandler] 🔍 Entered topic room - requested: "${conversationId}", topicRoom.topic.id: "${topicRoom.topic?.id}"`)
      } catch (error) {
        // Return empty messages if topic doesn't exist yet
        return {
          success: true,
          messages: [],
          total: 0,
          hasMore: false
        }
      }

      // Welcome messages should be handled when topics are created, not when retrieving messages

      // Get messages from the topic room
      // TopicRoom.retrieveAllMessages() aggregates from ALL channels with the same topic ID
      let rawMessages: any[] = []

      // Check if this is a P2P conversation for logging purposes
      if (conversationId.includes('<->')) {
        // Get all channels with this topic ID for debugging
        const allChannels: any = await nodeOneCore.channelManager.getMatchingChannelInfos({
          channelId: conversationId
        })

        console.log(`[ChatHandler] P2P conversation - Found ${allChannels.length} channels:`,
          allChannels.map((c: any) => ({
            id: c.id,
            owner: c.owner?.substring(0, 8) || 'undefined'
          })))
      }

      // Retrieve messages with strict conversation isolation
      rawMessages = await topicRoom.retrieveAllMessages()
      console.log(`[ChatHandler] Retrieved ${rawMessages.length} messages for conversation: ${conversationId}`)

      // Verify message isolation - ensure messages belong to this conversation
      const isolatedMessages = rawMessages.filter(msg => {
        // Additional validation: message must have valid content
        return msg.data?.text && typeof msg.data.text === 'string' && msg.data.text.trim() !== ''
      })

      if (isolatedMessages.length !== rawMessages.length) {
        console.log(`[ChatHandler] Filtered ${rawMessages.length - isolatedMessages.length} invalid messages`)
      }

      rawMessages = isolatedMessages

      // No fallback message retrieval - strict conversation isolation
      // Each conversation must have its own properly created topic
      console.log(`[ChatHandler] Using strict message isolation for ${conversationId}`)

      // Sort messages by timestamp
      rawMessages.sort((a, b) => {
        const timeA = a.creationTime || a.timestamp || 0
        const timeB = b.creationTime || b.timestamp || 0
        return timeA - timeB
      })

      // ONE.core ChatMessage structure: msg.data.text contains the message
      const validMessages = rawMessages.filter(msg => {
        return msg.data?.text && typeof msg.data.text === 'string' && msg.data.text.trim() !== ''
      })

      // Transform messages to UI format
      const formattedMessages: any = await Promise.all(validMessages.map(async (msg) => {
        const senderId = msg.sender || msg.author || nodeOneCore.ownerId

        // Check if sender is an AI contact and get their name
        // ALWAYS delegate to AIAssistantModel - it owns AI participant identification
        let isAI = false
        let senderName = 'Unknown'

        // AIAssistantModel is the ONLY source of truth for AI identification
        if (nodeOneCore.aiAssistantModel) {
          isAI = nodeOneCore.aiAssistantModel.isAIPerson(senderId)

          if (isAI) {
            // Get the LLM object to find the name
            const llmObjects = nodeOneCore.aiAssistantModel?.llmObjectManager?.getAllLLMObjects() || []
            const llmObject = llmObjects.find((obj: any) => {
              try {
                return obj.personId && senderId && obj.personId.toString() === senderId.toString()
              } catch (e) {
                return false
              }
            })

            if (llmObject) {
              // LLM object uses 'name' field, not 'modelName'
              senderName = llmObject.name || llmObject.modelName || llmObject.modelId || 'AI Assistant'
            }
          }
        }

        // For non-AI senders, try to get their name from profiles
        if (!isAI && nodeOneCore.leuteModel && senderId) {
          try {
            // Check if it's the current user
            const me: any = await nodeOneCore.leuteModel.me()
            if (me.personId && senderId && me.personId.toString() === senderId.toString()) {
              const profile: any = await me.mainProfile()
              senderName = profile?.name || 'You'
            } else {
              // Try to get other person's profile
              const others: any = await nodeOneCore.leuteModel.others()
              for (const someone of others) {
                try {
                  const personId: any = await someone.mainIdentity()
                  if (personId && senderId && personId.toString() === senderId.toString()) {
                    const profile: any = await someone.mainProfile()
                    if (profile) {
                      // Check PersonName objects
                      const personName = profile.personDescriptions?.find((d: any) => d.$type$ === 'PersonName')
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
            console.log('[ChatHandler] Could not get sender name:', (error as Error).message)
          }
        }

        return {
          id: msg.id || msg.channelEntryHash || `msg-${Date.now()}`,
          conversationId,
          text: msg.data.text,  // ONE.core messages have text in data.text
          attachments: msg.attachments || [], // Include attachments from the message
          sender: senderId,
          senderName: senderName,
          timestamp: msg.creationTime ? new Date(msg.creationTime).toISOString() : new Date().toISOString(),
          status: 'received',
          isAI: isAI,
          isFromAI: isAI,  // Also set isFromAI for compatibility
          format: 'markdown'  // All messages support markdown
        }
      }))

      // CRITICAL: Deduplicate messages by content + sender + timestamp
      // Messages can appear multiple times when retrieved from multiple channels
      const seen = new Map<string, any>()
      const deduplicatedMessages = formattedMessages.filter((msg: any) => {
        // Create deduplication key from content, sender, and timestamp (to ms precision)
        const dedupeKey = `${msg.sender}-${msg.text}-${msg.timestamp}`

        if (seen.has(dedupeKey)) {
          console.log(`[ChatHandler] 🔁 Skipping duplicate message: "${msg.text.substring(0, 50)}..." from ${msg.senderName}`)
          return false
        }

        seen.set(dedupeKey, true)
        return true
      })

      if (deduplicatedMessages.length !== formattedMessages.length) {
        console.log(`[ChatHandler] ✂️  Deduplicated ${formattedMessages.length - deduplicatedMessages.length} duplicate messages`)
      }

      // Apply pagination
      const paginatedMessages = deduplicatedMessages.slice(offset, offset + limit)

      console.log(`[ChatHandler] 📤 Returning ${paginatedMessages.length} messages for ${conversationId}:`)
      paginatedMessages.forEach((msg: any, i: any) => {
        console.log(`[ChatHandler] 📤 Message ${i}: "${msg.text?.substring(0, 50)}..." (${msg.isAI ? 'AI' : 'User'})`)
      })

      return {
        success: true,
        messages: paginatedMessages,
        total: deduplicatedMessages.length,
        hasMore: offset + limit < deduplicatedMessages.length
      }
    } catch (error) {
      console.error('[ChatHandler] Error getting messages:', error)
      return {
        success: false,
        error: (error as Error).message,
        data: {
          messages: [],
          total: 0,
          hasMore: false
        }
      }
    }
  },

  async createConversation(event: IpcMainInvokeEvent, { type = 'direct', participants = [], name = null }: CreateConversationParams): Promise<IpcResponse> {
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
      if (participants.some((p: any) => p.isAI)) {
        console.log('[ChatHandler] AI participant detected, initializing AI if needed...')
        await (nodeOneCore as any).initializeAIIfNeeded()
      }

      // Create conversation locally for now
      let topicId: string
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
            const testRoom: any = await nodeOneCore.topicModel.enterTopicRoom(finalTopicId)
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

      // Mark conversation metadata if it has AI participants
      let aiModelIdForTopic = null
      if (nodeOneCore.aiAssistantModel) {
        for (const participant of participants) {
          // Use isAIPerson which checks LLMObjectManager (has all models, not just cached)
          const isAI = nodeOneCore.aiAssistantModel.isAIPerson(participant)
          if (isAI) {
            conversation.hasAIParticipant = true
            // Get model ID using reverse lookup
            const modelId = nodeOneCore.aiAssistantModel.getModelIdForPersonId(participant)
            if (modelId) {
              console.log(`[ChatHandler] Found AI participant ${String(participant).substring(0, 8)} with model: ${modelId}`)
              conversation.aiModelId = modelId
              aiModelIdForTopic = modelId  // Store for registration below
            } else {
              console.error(`[ChatHandler] AI participant ${String(participant).substring(0, 8)} has no model ID - this is a bug`)
            }
            break
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
            .filter((p: any) => p && typeof p === 'string')
            .map((p: any) => p.id || p) // Handle both {id: ...} objects and raw ID strings

          await nodeOneCore.topicGroupManager.createGroupTopic(
            conversation.name,
            conversation.id,
            validParticipantIds as any
          )
          console.log('[ChatHandler] Created topic with proper group participants:', validParticipantIds.length)

          // Register the AI topic with the CORRECT model ID BEFORE triggering welcome
          if (aiModelIdForTopic && nodeOneCore.aiAssistantModel) {
            console.log(`[ChatHandler] Registering AI topic ${conversation.id} with model: ${aiModelIdForTopic}`)
            nodeOneCore.aiAssistantModel.registerAITopic(conversation.id, aiModelIdForTopic)
          }

          // Trigger AI welcome message if this is an AI conversation
          if (conversation.hasAIParticipant && nodeOneCore.aiAssistantModel) {
            console.log('[ChatHandler] Triggering AI welcome message for AI conversation')
            const topicRoom: any = await nodeOneCore.topicModel.enterTopicRoom(conversation.id)
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
            } catch (channelError: any) {
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
        error: (error as Error).message
      }
    }
  },

  async getConversations(event: IpcMainInvokeEvent, { limit = 20, offset = 0 }: GetConversationsParams = {}): Promise<IpcResponse> {
    console.log('[ChatHandler] Get conversations')

    try {
      // Get conversations from TopicModel (the source of truth)
      let conversations: any[] = []
      if (nodeOneCore.initialized && nodeOneCore.channelManager) {
        // Get all channels from channelManager
        const channels: any[] = await nodeOneCore.channelManager.channels()

        // Debug: Log raw channels to understand duplicates
        console.log('[ChatHandler] Raw channels from ChannelManager:', channels.length)
        const channelDebug: { [key: string]: string[] } = {}
        channels.forEach((ch: any) => {
          if (!channelDebug[ch.id]) channelDebug[ch.id] = []
          channelDebug[ch.id].push(ch.owner?.substring(0, 8) || 'undefined')
        })
        console.log('[ChatHandler] Channels by ID:', JSON.stringify(channelDebug, null, 2))

        // Strict conversation deduplication - one conversation per unique ID
        const conversationMap = new Map()
        const processedIds = new Set()

        for (const channel of channels) {
          // Skip system channels
          if (channel.id === 'contacts') continue

          // For P2P conversations, ensure consistent ID format
          let conversationId = channel.id
          if (channel.id.includes('<->')) {
            const parts = channel.id.split('<->')

            // Skip invalid P2P channels
            if (parts.length !== 2 || parts[0] === parts[1]) {
              console.log(`[ChatHandler] Skipping invalid P2P channel: ${channel.id}`)
              continue
            }

            // Use sorted IDs for consistency
            conversationId = parts.sort().join('<->')
          }

          // Skip if already processed
          if (processedIds.has(conversationId)) {
            console.log(`[ChatHandler] Skipping duplicate conversation: ${conversationId}`)
            continue
          }

          processedIds.add(conversationId)
          conversationMap.set(conversationId, channel)
        }

        // Convert to array for processing
        const uniqueChannels: any[] = Array.from(conversationMap.values()).map((channel: any) => ({
          ...channel,
          id: conversationMap.get(channel.id) ? conversationMap.get(channel.id).id : channel.id
        }))

        // Process unique conversations
        conversations = await Promise.all(uniqueChannels.map(async (channel: any) => {
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
              const otherPersonId = parts.find((id: string) => id !== nodeOneCore.ownerId) || parts[1]
              const displayName = String(otherPersonId).substring(0, 8) + '...'
              name = `Chat with ${displayName}`
            } else if (channel.id === 'lama') {
              name = 'LAMA'
            } else if (channel.id === 'hi') {
              name = 'Hi'
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
              name = `Chat ${channel.id?.substring(0, 8)}...`
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

          // Get the AI model name for this conversation if it has an AI participant
          let modelName = null
          if (nodeOneCore.aiAssistantModel) {
            const modelId = nodeOneCore.aiAssistantModel.getModelIdForTopic(channel.id)
            if (modelId) {
              const aiContacts = nodeOneCore.aiAssistantModel.getAllContacts()
              const aiContact = aiContacts.find((c: any) => c.modelId === modelId)
              if (aiContact) {
                modelName = aiContact.name
              }
            }
          }

          return {
            id: channel.id,
            name: name,
            type: conversationType,
            isGroup: isGroupChat,
            members: channel.members || [],
            participants: channel.participants || [],
            participantCount: channel.participantCount,
            createdAt: channel.createdAt || new Date().toISOString(),
            modelName: modelName
          }
        }))

        // Note: We do NOT automatically recreate Hi or LAMA chats if deleted
        // They are only created during initial setup in node-one-core.js

        // Add AI participant info to each conversation
        if (nodeOneCore.aiAssistantModel) {
          const aiContacts = nodeOneCore.aiAssistantModel.getAllContacts()

          conversations.forEach((conv: any) => {
            // Check if this is an AI topic
            conv.isAITopic = nodeOneCore.aiAssistantModel.isAITopic(conv.id)

            // Check if any participants are AI
            conv.hasAIParticipant = conv.participants?.some((participantId: string) =>
              aiContacts.some((contact: any) => contact.personId === participantId)
            ) || false

            // Get the AI model ID if it's an AI topic
            if (conv.isAITopic) {
              conv.aiModelId = nodeOneCore.aiAssistantModel.getModelIdForTopic(conv.id)
            }
          })
        }

        // Fetch actual last message content for each conversation
        if (nodeOneCore.topicModel) {
          await Promise.all(conversations.map(async (conv: any) => {
            try {
              const topicRoom: any = await nodeOneCore.topicModel.enterTopicRoom(conv.id)
              const messages: any = await topicRoom.retrieveAllMessages()
              if (messages && messages.length > 0) {
                const lastMessage = messages[messages.length - 1] // Get last message
                conv.lastMessage = {
                  text: lastMessage.data?.text || lastMessage.text,
                  senderId: lastMessage.data?.senderId || lastMessage.senderId,
                  timestamp: lastMessage.data?.timestamp || lastMessage.timestamp
                }
                // Set lastMessageAt for sorting
                conv.lastMessageAt = lastMessage.data?.timestamp || lastMessage.timestamp || new Date().toISOString()
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
      } // End of if (nodeOneCore.initialized && nodeOneCore.channelManager)

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
        error: (error as Error).message,
        data: [],
        total: 0,
        hasMore: false
      }
    }
  },

  async getConversation(event: IpcMainInvokeEvent, { conversationId }: GetConversationParams): Promise<any> {
    console.log('[ChatHandler] Get conversation:', conversationId)

    try {
      // Get conversation from TopicModel
      if (!nodeOneCore.initialized || !nodeOneCore.topicModel) {
        throw new Error('Node not initialized')
      }

      // Try to get the topic
      const topic: any = await nodeOneCore.topicModel.topics.queryById(conversationId)

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
        (conversation as any).isAITopic = (nodeOneCore.aiAssistantModel as any).isAITopic(conversation.id)

        // Check if any participants are AI
        (conversation as any).hasAIParticipant = conversation.participants?.some((participantId: string) =>
          aiContacts.some((contact: any) => contact.personId === participantId)
        ) || false

        // Get the AI model ID if it's an AI topic
        if ((conversation as any).isAITopic) {
          (conversation as any).aiModelId = nodeOneCore.aiAssistantModel.getModelIdForTopic(conversation.id)
        }
      }

      return conversation
    } catch (error) {
      console.error('[ChatHandler] Error getting conversation:', error)
      throw error
    }
  },

  async getCurrentUser(event: IpcMainInvokeEvent): Promise<IpcResponse> {
    console.log('[ChatHandler] Get current user')

    try {
      // Check if node is provisioned
      if (!nodeProvisioning.isProvisioned() || !nodeOneCore.ownerId) {
        // Fallback to state manager
        const userId = stateManager.getState('user.id' as any)
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
          const me: any = await nodeOneCore.leuteModel.me()
          if (me) {
            const profile: any = await me.mainProfile()
            if (profile?.personDescriptions?.length > 0) {
              const nameDesc = profile.personDescriptions.find((d: any) =>
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
        error: (error as Error).message
      }
    }
  },

  async addParticipants(event: IpcMainInvokeEvent, { conversationId, participantIds }: AddParticipantsParams): Promise<IpcResponse> {
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

        let originalParticipants: string[] = []
        let groupName = 'Group Chat'

        if (isP2P) {
          // Extract the two participants from the P2P conversation ID
          const [person1, person2] = conversationId.split('<->')
          originalParticipants = [person1, person2]

          // Try to get the original P2P conversation name
          try {
            const channels = await nodeOneCore.channelManager.channels()
            const p2pChannel = (channels as any).find((ch: any) => ch.id === conversationId)
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
              originalParticipants.push((aiContacts[0] as { personId: string }).personId)
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
            const testRoom: any = await nodeOneCore.topicModel.enterTopicRoom(newGroupId)
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

        console.log('[ChatHandler] Creating group chat with participants:', uniqueParticipants.map(id => String(id).substring(0, 8)).join(', '))

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
          const p2pMessages: any = await (nodeOneCore as any).topicRoom.retrieveAllMessages(conversationId)

          if (p2pMessages && p2pMessages.length > 0) {
            console.log(`[ChatHandler] Found ${p2pMessages.length} messages to copy`)

            // Post each message to the new group (preserving order and timestamps)
            for (const message of p2pMessages) {
              if (message.data && message.data.text) {
                // Determine the sender (could be either participant in P2P)
                const sender = message.author || message.data.sender

                // Post to new group on behalf of the original sender
                await (nodeOneCore as any).topicRoom.sendMessage(
                  message.data.text,
                  sender // Post as the original sender
                )
              }
            }

            console.log(`[ChatHandler] Copied ${p2pMessages.length} messages to new group`)
          } else {
            console.log('[ChatHandler] No messages to copy from P2P conversation')
          }
        } catch (error) {
          console.warn('[ChatHandler] Failed to copy messages from P2P:', (error as Error).message)
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
      console.log('[ChatHandler] Adding participants:', validParticipantIds.map(id => String(id).substring(0, 8)).join(', '))

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
        error: (error as Error).message
      }
    }
  },

  async clearConversation(event: IpcMainInvokeEvent, { conversationId }: ClearConversationParams): Promise<IpcResponse> {
    console.log('[ChatHandler] Clear conversation:', conversationId)

    try {
      if (!nodeOneCore) {
        throw new Error('Node ONE.core not initialized')
      }

      // Get the topic room
      const topicRoom: any = await nodeOneCore.topicModel.enterTopicRoom(conversationId)
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
        error: (error as Error).message
      }
    }
  },

  // Edit message - creates a new version
  async editMessage(event: IpcMainInvokeEvent, { messageId, conversationId, newText, editReason }: EditMessageParams): Promise<IpcResponse> {
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
      const result: any = await messageVersionManager.editMessage(messageId, newText, editReason)

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
        error: (error as Error).message
      }
    }
  },

  // Delete message - creates a retraction marker
  async deleteMessage(event: IpcMainInvokeEvent, { messageId, conversationId, reason }: DeleteMessageParams): Promise<IpcResponse> {
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
      const result: any = await messageVersionManager.retractMessage(messageId, reason)

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
        error: (error as Error).message
      }
    }
  },

  // Get message version history
  async getMessageHistory(event: IpcMainInvokeEvent, { messageId }: GetMessageHistoryParams): Promise<IpcResponse> {
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
      const versions: any = await messageVersionManager.getVersionHistory(messageId)

      return {
        success: true,
        data: versions
      }
    } catch (error) {
      console.error('[ChatHandler] Error getting message history:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  // Export message as verifiable credential
  async exportMessageCredential(event: IpcMainInvokeEvent, { messageId }: ExportMessageCredentialParams): Promise<IpcResponse> {
    console.log('[ChatHandler] Export message as verifiable credential:', messageId)

    try {
      // Initialize assertion manager if needed
      if (!messageAssertionManager && (nodeOneCore as any).trust && nodeOneCore.leuteModel) {
        messageAssertionManager = new MessageAssertionManager(
          (nodeOneCore as any).trust,
          nodeOneCore.leuteModel
        )
      }

      if (!messageAssertionManager) {
        throw new Error('Message assertion manager not available')
      }

      // Export as verifiable credential
      const credential: any = await messageAssertionManager.exportAsVerifiableCredential(messageId)

      return {
        success: true,
        data: credential
      }
    } catch (error) {
      console.error('[ChatHandler] Error exporting credential:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  // Verify message assertion certificate
  async verifyMessageAssertion(event: IpcMainInvokeEvent, { certificateHash, messageHash }: VerifyMessageAssertionParams): Promise<IpcResponse> {
    console.log('[ChatHandler] Verify message assertion:', certificateHash?.substring(0, 8))

    try {
      // Initialize assertion manager if needed
      if (!messageAssertionManager && (nodeOneCore as any).trust && nodeOneCore.leuteModel) {
        messageAssertionManager = new MessageAssertionManager(
          (nodeOneCore as any).trust,
          nodeOneCore.leuteModel
        )
      }

      if (!messageAssertionManager) {
        throw new Error('Message assertion manager not available')
      }

      // Verify the assertion
      const verification: any = await messageAssertionManager.verifyMessageAssertion(
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
        error: (error as Error).message
      }
    }
  }
}

export default chatHandlers;