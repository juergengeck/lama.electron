// Bridge to integrate LAMA React Native models with Electron

import { AppModel } from '../models/AppModel'
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks'
import type { Person } from '@refinio/one.core/lib/recipes'
import { llmProxy } from '../services/llm-proxy'

export interface LamaAPI {
  // Identity & Authentication
  createIdentity: (name: string, password: string) => Promise<string>
  login: (id: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  getCurrentUser: () => Promise<{ id: string; name: string } | null>

  // Messaging
  sendMessage: (recipientId: string, content: string) => Promise<string>
  getMessages: (conversationId: string) => Promise<Message[]>
  createChannel: (name: string, members: string[]) => Promise<string>
  
  // P2P Networking
  connectToPeer: (peerId: string) => Promise<boolean>
  getPeerList: () => Promise<Peer[]>
  
  // Contacts
  getContacts: () => Promise<any[]>
  getOrCreateTopicForContact: (contactId: string) => Promise<string | null>
  
  // Local AI
  queryLocalAI: (prompt: string) => Promise<string>
  loadModel: (modelId: string) => Promise<boolean>
  getAvailableModels: () => Promise<any[]>
  setDefaultModel: (modelId: string) => Promise<boolean>
  enableAIForTopic: (topicId: string) => Promise<boolean>
  disableAIForTopic: (topicId: string) => Promise<boolean>
  getBestModelForTask: (task: 'coding' | 'reasoning' | 'chat' | 'analysis') => Promise<any>
  getModelsByCapability: (capability: string) => Promise<any[]>
  
  // UDP Sockets
  createUdpSocket: (options: SocketOptions) => Promise<string>
  sendUdpMessage: (socketId: string, message: Buffer, port: number, address: string) => Promise<void>
  
  // Events
  on: (event: string, callback: (...args: any[]) => void) => void
  off: (event: string, callback: (...args: any[]) => void) => void
}

import type { MessageAttachment } from '@/types/attachments'

export interface Message {
  id: string
  senderId: string
  content: string
  timestamp: Date
  encrypted: boolean
  isAI?: boolean // Flag to indicate if the sender is an AI
  attachments?: MessageAttachment[] // Attachment references
  topicId?: string // The topic/channel ID this message belongs to
  topicName?: string // Human-readable name of the topic/channel
}

export interface Peer {
  id: string
  name: string
  address: string
  status: 'connected' | 'disconnected' | 'connecting'
  lastSeen: Date
}

export interface SocketOptions {
  type: 'udp4' | 'udp6'
  port?: number
  address?: string
}

// Real implementation connected to AppModel
class LamaBridge implements LamaAPI {
  private eventListeners = new Map<string, Set<Function>>()
  private appModel: AppModel | null = null
  private topicRooms: Map<string, any> = new Map()
  private welcomeMessageSent: Set<string> = new Set()
  private conversationAIPersons: Map<string, string> = new Map()
  private allAIPersonIds: Set<string> = new Set() // Track all AI person IDs
  
  setAppModel(model: AppModel) {
    console.log('[LamaBridge] setAppModel called with:', model)
    console.log('[LamaBridge] model.topicModel exists:', !!model?.topicModel)
    console.log('[LamaBridge] model.leuteModel exists:', !!model?.leuteModel)
    console.log('[LamaBridge] model.channelManager exists:', !!model?.channelManager)
    this.appModel = model
    console.log('[LamaBridge] AppModel connected with TopicModel:', !!model.topicModel)
    console.log('[LamaBridge] this.appModel after setting:', !!this.appModel)
    console.log('[LamaBridge] this.appModel.topicModel after setting:', !!this.appModel?.topicModel)
    
    // Set up event listeners from the models
    if (model.topicModel) {
      // Listen for new topic events
      model.topicModel.onNewTopicEvent.listen(() => {
        this.emit('topic:updated', {})
      })
    }
    
    // Listen for CHUM message events via window events
    if (typeof window !== 'undefined') {
      window.addEventListener('lama:messageReceived', ((event: CustomEvent) => {
        console.log('[LamaBridge] Message received via CHUM:', event.detail)
        this.emit('message:updated', { 
          conversationId: event.detail.conversationId 
        })
      }) as EventListener)
    }
    
    if (model.transportManager) {
      // Listen for connection events
      model.transportManager.onConnectionEstablished.listen((connection, transport) => {
        this.emit('peer:connected', { connection, transport })
      })
      
      model.transportManager.onConnectionClosed.listen((connectionId, transport, reason) => {
        this.emit('peer:disconnected', { connectionId, transport, reason })
      })
    }
    
    if (model.llmManager) {
      // Listen for LLM events
      model.llmManager.onModelLoaded.listen((modelId) => {
        this.emit('ai:model-loaded', { modelId })
      })
      
      model.llmManager.onModelUnloaded.listen((modelId) => {
        this.emit('ai:model-unloaded', { modelId })
      })
      
      model.llmManager.onChatResponse.listen((response) => {
        this.emit('ai:response', { response })
      })
      
      model.llmManager.onError.listen((error) => {
        this.emit('ai:error', { error })
      })
    }
    
    if (model.aiAssistantModel) {
      // Listen for AI assistant events
      model.aiAssistantModel.onResponse.listen((topicId, response) => {
        this.emit('ai:topic-response', { topicId, response })
      })
      
      model.aiAssistantModel.onError.listen((error) => {
        this.emit('ai:assistant-error', { error })
      })
      
      model.aiAssistantModel.onConfigUpdated.listen(() => {
        this.emit('ai:config-updated', {})
      })
    }
  }
  
  async createIdentity(name: string, _password: string): Promise<string> {
    console.log('Creating identity:', name)
    // Mock implementation
    return `id-${Date.now()}`
  }
  
  async login(id: string, _password: string): Promise<boolean> {
    console.log('Logging in:', id)
    return true
  }
  
  async logout(): Promise<void> {
    console.log('Logging out')
  }
  
  async getCurrentUser(): Promise<{ id: string; name: string } | null> {
    if (!this.appModel || !this.appModel.ownerId) {
      return null
    }
    
    try {
      const profile = await this.appModel.getCurrentUserProfile()
      return {
        id: profile.id || 'unknown',
        name: profile.name
      }
    } catch (err) {
      console.error('[LamaBridge] Failed to get current user:', err)
      return null
    }
  }
  
  async sendMessage(recipientId: string, content: string, attachments?: MessageAttachment[]): Promise<string> {
    // Direct message sending without TopicModel
    console.log('[LamaBridge] 🔴 sendMessage ENTRY POINT called with:', { recipientId, content, attachments: attachments?.length || 0 })
    const result = await this.sendMessageInternal(recipientId, content, attachments)
    console.log('[LamaBridge] 🟢 sendMessage COMPLETED, returning:', result)
    return result
  }
  
  private async sendMessageInternal(recipientId: string, content: string, attachments?: MessageAttachment[]): Promise<string> {
    const startTime = performance.now()
    const timings: Record<string, number> = {}
    
    try {
      const conversationId = recipientId // Use the actual recipient/topic ID
      const messageId = `msg-${Date.now()}`
      
      console.log('\n' + '='.repeat(60))
      console.log('🚀 MESSAGE FLOW TRACE - BROWSER SEND START')
      console.log('='.repeat(60))
      console.log('[TRACE] Message ID:', messageId)
      console.log('[TRACE] Content:', content.substring(0, 50))
      console.log('[TRACE] Conversation:', conversationId)
      console.log('[PERF] 🏁 Starting sendMessageInternal')
      console.log('[LamaBridge] sendMessageInternal called for conversation:', conversationId)
      
      // Debug: Check what's actually happening with appModel
      console.log('[LamaBridge] appModel exists:', !!this.appModel)
      console.log('[LamaBridge] topicModel exists:', !!this.appModel?.topicModel)
      
      // Check if we have TopicModel available
      if (this.appModel?.topicModel) {
        console.log('[LamaBridge] Using TopicModel for message sending')
        
        // Get or create TopicRoom for this conversation
        const topicRoomStart = performance.now()
        const topicRoom = await this.getOrCreateTopicRoom(conversationId)
        timings.topicRoom = performance.now() - topicRoomStart
        console.log(`[PERF] ⏱️ Get/Create TopicRoom: ${timings.topicRoom.toFixed(2)}ms`)
        
        if (topicRoom) {
          // Send message through TopicRoom (proper ONE platform way)
          const sendStart = performance.now()
          
          // TopicRoom.sendMessage signature: (message, author, channelOwner)
          // For person-to-person topics, determine which channel to use (EXACTLY like one.leute does)
          if (this.isPersonToPersonTopic(conversationId)) {
            console.log('[LamaBridge] Sending message in person-to-person topic')
            
            // Follow one.leute's exact pattern from useChatMessages.ts
            let channelOwner: any = undefined
            if (this.appModel.channelManager && this.appModel.leuteModel) {
              const myPersonId = await this.appModel.leuteModel.myMainIdentity()
              const channelInfos = await this.appModel.channelManager.getMatchingChannelInfos({
                channelId: conversationId
              })
              
              // If no channels exist, create one NOW before sending
              if (!channelInfos || channelInfos.length === 0) {
                console.log('[LamaBridge] No channels found, creating channel before sending')
                try {
                  await this.appModel.channelManager.createChannel(conversationId, myPersonId)
                  channelOwner = myPersonId
                  console.log('[LamaBridge] Created channel with owner:', myPersonId)
                  
                  // Grant federation access for CHUM sync with Node.js
                  await this.grantChannelAccessToNode(conversationId, myPersonId)
                } catch (err) {
                  console.error('[LamaBridge] Failed to create channel:', err)
                  throw new Error('Cannot send message - failed to create channel')
                }
              } else {
                // Determine owner priority (from one.leute/src/root/chat/hooks/useChatMessages.ts):
                // 1. myPersonId  
                // 2. any not undefined
                // 3. undefined, meaning that there is no owner
                for (const channelInfo of channelInfos) {
                  if (channelInfo.owner === myPersonId) {
                    channelOwner = myPersonId
                    break
                  } else if (channelOwner === undefined) {
                    channelOwner = channelInfo.owner
                  }
                }
                console.log(`[LamaBridge] Channel owner determined: ${channelOwner || 'undefined'}`)
              }
            }
            
            // Send message based on whether it has attachments
            // Following one.leute/src/root/chat/chatId/Chat.tsx pattern
            if (attachments && attachments.length > 0) {
              console.log(`[LamaBridge] Sending message with ${attachments.length} attachments`)
              
              const attachmentHashes = attachments.map(att => att.hash)
              
              // From Chat.tsx line 271-274: undefined author means 'use my main identity'
              // channelOwner ?? null handles the case where no owner was found
              await topicRoom.sendMessageWithAttachmentAsHash(
                content, 
                attachmentHashes, 
                undefined,  // author: undefined means 'use my main identity'
                channelOwner ?? null  // channelOwner or null if no owner found
              )
            } else {
              // From Chat.tsx line 215: undefined author means 'use my main identity'
              // channelOwner ?? null handles the case where no owner was found
              console.log('[LamaBridge] 📤 BROWSER: Calling topicRoom.sendMessage...')
              console.log('[LamaBridge] 📊 Channel details:', {
                channelId: conversationId,
                channelOwner: channelOwner?.substring(0, 8) || 'null',
                content: content.substring(0, 50)
              })
              
              const messageResult = await topicRoom.sendMessage(
                content,
                undefined,  // author: undefined means 'use my main identity'  
                channelOwner ?? null  // channelOwner or null if no owner found
              )
              
              console.log('[LamaBridge] ✅ BROWSER: topicRoom.sendMessage completed, result:', messageResult)
              
              // Immediately check if message is in channel
              if (this.appModel?.channelManager) {
                console.log('[LamaBridge] 🔍 BROWSER: Checking if message is actually in channel...')
                const channelData = await this.appModel.channelManager.getMatchingChannelInfos({
                  channelId: conversationId
                })
                console.log('[LamaBridge] 📦 BROWSER: Channel has', channelData?.length || 0, 'channel infos')
                
                // Try to get channel entries to see if message is there
                for (const channelInfo of (channelData || [])) {
                  try {
                    const entries = await this.appModel.channelManager.getChannelEntries?.(
                      channelInfo.channelInfoHash,
                      channelInfo.owner
                    )
                    console.log('[LamaBridge] 📋 BROWSER: Channel entries for owner', channelInfo.owner?.substring(0, 8), ':', entries?.length || 0, 'entries')
                    if (entries && entries.length > 0) {
                      const lastEntry = entries[entries.length - 1]
                      console.log('[LamaBridge] 📝 BROWSER: Last entry type:', lastEntry?.data?.$type$, 'content preview:', lastEntry?.data?.content?.substring(0, 30))
                    }
                  } catch (err) {
                    console.log('[LamaBridge] Could not get entries for owner', channelInfo.owner?.substring(0, 8))
                  }
                }
              }
            }
            
            // Set up listener to trace channelManager.onUpdated
            if (this.appModel?.channelManager?.onUpdated) {
              console.log('[LamaBridge] 🔍 BROWSER: Setting up onUpdated listener to trace message flow')
              const unsubscribe = this.appModel.channelManager.onUpdated((channelInfoIdHash, channelId, owner, time, data) => {
                console.log('[LamaBridge] 🔔 BROWSER: channelManager.onUpdated fired!', {
                  channelId,
                  owner: owner?.substring(0, 8),
                  dataLength: data?.length,
                  hasNewMessage: data?.some(d => d.$type$ === 'ChatMessage')
                })
              })
              // Clean up after 5 seconds
              setTimeout(() => unsubscribe(), 5000)
            }
            
            // Grant comprehensive access rights after sending
            // This ensures Node can see the message via CHUM
            console.log('[LamaBridge] 🔑 BROWSER: Granting access rights to Node...')
            await this.grantAccessForPersonToPersonTopic(conversationId)
            await this.grantMessageAccessToNode(topicRoom, conversationId)
            console.log('[LamaBridge] ✅ BROWSER: Access rights granted')
          } else {
            // For group topics, follow the same pattern as one.leute
            // Group topics typically have a single owner (the creator)
            let channelOwner: any = undefined
            if (this.appModel.channelManager) {
              const channelInfos = await this.appModel.channelManager.getMatchingChannelInfos({
                channelId: conversationId
              })
              const myPersonId = await this.appModel.leuteModel?.myMainIdentity?.()
              
              // Same owner determination logic
              for (const channelInfo of channelInfos) {
                if (channelInfo.owner === myPersonId) {
                  channelOwner = myPersonId
                  break
                } else if (channelOwner === undefined) {
                  channelOwner = channelInfo.owner
                }
              }
              
              console.log(`[LamaBridge] Group channel owner: ${channelOwner || 'undefined'}`)
            }
            
            if (attachments && attachments.length > 0) {
              console.log(`[LamaBridge] Sending group message with ${attachments.length} attachments`)
              const attachmentHashes = attachments.map(att => att.hash)
              
              await topicRoom.sendMessageWithAttachmentAsHash(
                content,
                attachmentHashes,
                undefined,  // author: undefined means 'use my main identity'
                channelOwner ?? null  // channelOwner or null if no owner found
              )
            } else {
              console.log('[LamaBridge] 🔴🔴🔴 ABOUT TO SEND MESSAGE:', {
                content,
                channelOwner: channelOwner || 'null',
                topicRoomExists: !!topicRoom
              })
              
              // Set up channelManager listener BEFORE sending
              if (this.appModel?.channelManager?.onUpdated) {
                console.log('[LamaBridge] 🎯 Setting up channelManager.onUpdated listener')
                const unsubscribe = this.appModel.channelManager.onUpdated((channelInfoIdHash, channelId, owner, time, data) => {
                  console.log('[LamaBridge] 🔔🔔🔔 channelManager.onUpdated FIRED!', {
                    channelId,
                    owner: owner?.substring(0, 8),
                    dataLength: data?.length,
                    hasNewMessage: data?.some((d: any) => d.$type$ === 'ChatMessage')
                  })
                  // Don't unsubscribe to see multiple events
                })
              }
              
              const messageId = await topicRoom.sendMessage(
                content,
                undefined,  // author: undefined means 'use my main identity'
                channelOwner ?? null  // channelOwner or null if no owner found
              )
              
              console.log('[LamaBridge] 🔴🔴🔴 MESSAGE SENT, ID:', messageId)
            }
          }
          
          timings.sendMessage = performance.now() - sendStart
          console.log(`[PERF] ⏱️ Send message to TopicRoom: ${timings.sendMessage.toFixed(2)}ms`)
          
          // Message sync to Node.js instance handled by CHUM automatically
          
          // Emit topic update - let the UI fetch from the source of truth
          this.emit('message:updated', { conversationId })
          
          // Check if this conversation should have AI responses
          // Only enable AI for explicitly AI-enabled topics, not for human-to-human chats
          const shouldEnableAI = await this.shouldEnableAIForConversation(conversationId)
          console.log('[LamaBridge] Should enable AI for conversation:', conversationId, shouldEnableAI)
          
          // DISABLED: AI responses now handled by Node.js listening to CHUM channels
          // The browser just sends messages to channels, Node detects and responds automatically
          if (false) { // Was: shouldEnableAI && window.electronAPI
            // Use LLM via IPC proxy for AI response
            console.log('[LamaBridge] Using LLM via IPC proxy for AI response')
            
            // Set up streaming handler for real-time display
            const _streamHandler = (data: { chunk: string, isThinking?: boolean, partial: string }) => {
              // Emit streaming event for UI to display progressively
              this.emit('message:stream', { 
                conversationId, 
                chunk: data.chunk, 
                isThinking: data.isThinking,
                partial: data.partial 
              })
            }
            
            // Note: Streaming is not yet implemented in IPC proxy
            // For now, just show processing indicator
            
            try {
              // Get the full conversation history
              const historyStart = performance.now()
              const messages = await this.getMessages(conversationId)
              
              // Build chat history from messages
              const chatHistory: Array<{role: string, content: string}> = []
              
              // Add all previous messages
              for (const msg of messages) {
                chatHistory.push({
                  role: msg.isAI ? 'assistant' : 'user',
                  content: msg.content
                })
              }
              
              // Add the new user message
              chatHistory.push({ role: 'user', content })
              
              console.log(`[PERF] ⏱️ History prep: ${(performance.now() - historyStart).toFixed(2)}ms`)
              console.log('[LamaBridge] Sending chat history to LLM:', chatHistory.length, 'messages')
              
              // DO NOT use IPC for AI - let the Node listener handle it
              // AI is a first-class citizen that sends messages through CHUM
              console.log('[LamaBridge] AI conversation - Node listener will handle response via CHUM')
              this.emit('ai:processing', { conversationId, started: true })
            } catch (aiError) {
              console.error('[LamaBridge] Direct LLM response failed:', aiError)
            }
          } else {
            console.warn('[LamaBridge] LLMManager not available for AI response')
          }
        } else {
          console.warn('[LamaBridge] Could not create TopicRoom, messages will not persist')
        }
      } else {
        console.warn('[LamaBridge] TopicModel not available, using event-only messaging')
        // Fallback: Only emit the sent event to avoid duplicates
        // The useLamaMessages hook already adds the message via 'message:sent'
        this.emit('message:sent', { 
          id: messageId, 
          recipientId, 
          content,
          timestamp: new Date()
        })
      }
      
      const totalTime = performance.now() - startTime
      console.log(`[PERF] ✅ Total sendMessageInternal time: ${totalTime.toFixed(2)}ms`)
      console.log(`[PERF] 📊 Breakdown:`, timings)
      
      return messageId
    } catch (err) {
      console.error('[LamaBridge] Failed to send message:', err)
      throw err
    }
  }
  
  async getMessages(conversationId: string): Promise<Message[]> {
    try {
      console.log('[LamaBridge] getMessages called for:', conversationId)
      console.log('[LamaBridge] appModel available:', !!this.appModel)
      console.log('[LamaBridge] topicModel available:', !!this.appModel?.topicModel)
      
      // Check if we have TopicModel available
      if (this.appModel?.topicModel) {
        console.log('[LamaBridge] Getting messages from TopicModel for conversation:', conversationId)
        
        // Get or create TopicRoom for this conversation
        const topicRoom = await this.getOrCreateTopicRoom(conversationId)
        
        if (topicRoom) {
          // Retrieve messages from TopicRoom
          const messages = await topicRoom.retrieveAllMessages()
          console.log(`[LamaBridge] Retrieved ${messages.length} messages from TopicRoom`)
          
          // Debug: Check structure of messages
          if (messages.length > 0) {
            console.log('[LamaBridge] First message structure:', JSON.stringify(messages[0], null, 2))
            // Check if this is a channel entry with embedded message
            if (messages[0].data) {
              console.log('[LamaBridge] First message data:', JSON.stringify(messages[0].data, null, 2))
            }
            // Look for different possible message fields
            const sampleMsg = messages[messages.length - 1] // Check last message too
            console.log('[LamaBridge] Last message full structure:', JSON.stringify(sampleMsg, null, 2))
            console.log('[LamaBridge] Last message keys:', Object.keys(sampleMsg))
            
            // Check all possible author/sender fields
            console.log('[LamaBridge] Checking for author fields:')
            console.log('  - data.sender:', sampleMsg.data?.sender)
            console.log('  - data.author:', sampleMsg.data?.author)
            console.log('  - author:', sampleMsg.author)
            console.log('  - sender:', sampleMsg.sender)
            console.log('  - data keys:', sampleMsg.data ? Object.keys(sampleMsg.data) : 'no data')
          }
          
          // Filter for actual ChatMessage objects - they have data.text or data.blobs
          const validMessages = messages.filter((msg: any) => {
            // ChatMessage objects have the text in data.text field
            const text = msg.data?.text
            const hasBlobs = msg.data?.blobs && Array.isArray(msg.data.blobs) && msg.data.blobs.length > 0
            // Include messages that have either text or blobs (images/attachments)
            return (text && typeof text === 'string' && text.trim() !== '') || hasBlobs
          })
          console.log(`[LamaBridge] Valid messages: ${validMessages.length}`)
          
          // If no valid messages in the room and it's the default AI chat, send welcome message ONCE
          if (validMessages.length === 0 && conversationId === 'default' && !this.welcomeMessageSent.has(conversationId)) {
            console.log('[LamaBridge] No messages found, sending welcome message')
            this.welcomeMessageSent.add(conversationId)
            
            // Get the AI model name for the welcome message
            let modelName = 'your local AI assistant'
            if (this.appModel?.llmManager) {
              try {
                const loadedModels = this.appModel.llmManager.getLoadedModels?.()
                if (loadedModels && loadedModels.length > 0) {
                  const activeModel = loadedModels[0]
                  if (activeModel?.name?.toLowerCase().includes('gpt')) {
                    modelName = 'GPT-OSS'
                  } else if (activeModel?.name) {
                    modelName = activeModel.name
                  }
                } else {
                  const availableModels = this.appModel.llmManager.getModels?.()
                  if (availableModels && availableModels.length > 0) {
                    const firstModel = availableModels[0]
                    if (firstModel?.name?.toLowerCase().includes('gpt')) {
                      modelName = 'GPT-OSS'
                    } else if (firstModel?.name) {
                      modelName = firstModel.name
                    }
                  }
                }
              } catch (e) {
                console.warn('[LamaBridge] Could not get model name:', e)
              }
            }
            
            const welcomeContent = `Hello! I'm ${modelName}. How can I help you today?`
            
            // Send the welcome message through the TopicRoom so it persists
            try {
              // Get or create AI Person ID and ensure it has keys
              const aiPersonId = await this.getAIPersonId(modelName.toLowerCase().replace(/\s+/g, '-'))
              
              // Send welcome message as plain text
              // TopicRoom.sendMessage expects (text, author, channelOwner)
              await topicRoom.sendMessage(welcomeContent, aiPersonId, undefined)
              console.log('[LamaBridge] Welcome message sent to TopicRoom')
              
              // No need to emit - just return the message from storage
              // The message is already in TopicRoom, which is the source of truth
              
              // Retrieve the welcome message we just stored
              const updatedMessages = await topicRoom.retrieveAllMessages()
              const validWelcomeMessages = updatedMessages.filter((msg: any) => msg.data?.text && msg.data.text.trim() !== '')
              
              // Transform to our Message format
              return validWelcomeMessages.map((msg: any) => {
                // Try different fields for the sender/author
                const senderId = msg.data?.sender || msg.data?.author || msg.author || msg.sender || 'unknown'
                
                return {
                  id: msg.id || msg.channelEntryHash || `msg-${Date.now()}`,
                  senderId: senderId,
                  content: msg.data?.text || '',
                  timestamp: msg.creationTime ? new Date(msg.creationTime) : new Date(),
                  encrypted: false,
                  isAI: this.isAIPersonId(senderId),
                  topicId: conversationId,
                  topicName: topicName
                }
              })
            } catch (e) {
              console.warn('[LamaBridge] Could not send welcome message to TopicRoom:', e)
              // Get AI Person ID for fallback
              const fallbackAIId = await this.getAIPersonId('ai-assistant')
              // Return without persisting
              return [
                {
                  id: 'msg-welcome',
                  senderId: fallbackAIId,
                  content: welcomeContent,
                  timestamp: new Date(),
                  encrypted: false,
                  isAI: true,
                  topicId: conversationId,
                  topicName: topicName
                }
              ]
            }
          }
          
          // Get topic name for all messages
          const topicName = await this.getTopicName(conversationId)
          
          // Transform ONE ChatMessage objects to our Message format (use validMessages)
          return validMessages.map((msg: any) => {
            // Try different fields for the sender/author
            const senderId = msg.data?.sender || msg.data?.author || msg.author || msg.sender || 'unknown'
            const isAI = this.isAIPersonId(senderId)
            
            // Handle blobs/attachments
            let content = msg.data?.text || ''
            const attachments: MessageAttachment[] = []
            
            if (msg.data?.blobs && Array.isArray(msg.data.blobs)) {
              console.log(`[LamaBridge] Message has ${msg.data.blobs.length} blobs`)
              
              for (const blob of msg.data.blobs) {
                // Each blob should have a hash reference
                if (blob.hash) {
                  attachments.push({
                    hash: blob.hash,
                    type: 'blob',
                    mimeType: blob.mimeType || 'application/octet-stream',
                    name: blob.name || 'attachment',
                    size: blob.size || 0
                  })
                  
                  // If no text content, create a placeholder
                  if (!content) {
                    content = `[Image/Attachment: ${blob.name || blob.hash}]`
                  }
                }
              }
              
              console.log(`[LamaBridge] Processed ${attachments.length} attachments`)
            }
            
            console.log(`[LamaBridge] Parsing message - senderId: ${senderId}, isAI: ${isAI}, text: "${content.substring(0, 50)}...", attachments: ${attachments.length}`)
            
            const message: Message = {
              id: msg.id || msg.channelEntryHash || `msg-${Date.now()}-${Math.random()}`,
              senderId: senderId,
              content: content,
              timestamp: msg.creationTime ? new Date(msg.creationTime) : new Date(),
              encrypted: false,
              isAI: isAI,
              topicId: conversationId, // Add the topic/channel ID
              topicName: topicName // Use the resolved topic name
            }
            
            // Add attachments if present
            if (attachments.length > 0) {
              message.attachments = attachments
            }
            
            return message
          })
        }
      }
      
      console.log('[LamaBridge] TopicModel not available, returning welcome message')
      // Return welcome message as fallback
      const aiId = await this.getAIPersonId('ai-assistant')
      return [
        {
          id: 'msg-welcome',
          senderId: aiId,
          content: 'Hello! I\'m your local AI assistant. How can I help you today?',
          timestamp: new Date(),
          encrypted: false,
          isAI: true,
          topicId: conversationId,
          topicName: 'General Chat'
        }
      ]
    } catch (error) {
      console.error('[LamaBridge] Error getting messages:', error)
      return []
    }
  }
  
  async createChannel(name: string, members: string[]): Promise<string> {
    console.log('Creating channel:', name, members)
    return `channel-${Date.now()}`
  }
  
  async connectToPeer(peerId: string): Promise<boolean> {
    console.log('Connecting to peer:', peerId)
    
    // Simulate connection process
    this.emit('peer:connecting', { peerId })
    
    setTimeout(() => {
      this.emit('peer:connected', { peerId })
    }, 1000)
    
    return true
  }
  
  async getPeerList(): Promise<Peer[]> {
    if (!this.appModel?.leuteModel) {
      return []
    }
    
    try {
      // Get contacts from LeuteModel
      const contacts = await this.appModel.getContacts()
      
      // Transform to Peer interface
      return contacts.map(contact => ({
        id: contact.id,
        name: contact.name,
        address: '', // Address will be filled from connections
        status: contact.status === 'online' ? 'connected' : 'disconnected',
        lastSeen: new Date()
      }))
    } catch (err) {
      console.error('[LamaBridge] Failed to get peer list:', err)
      return []
    }
  }
  
  async queryLocalAI(prompt: string): Promise<string> {
    if (!this.appModel?.llmManager) {
      throw new Error('LLM Manager not available')
    }
    
    try {
      console.log('[LamaBridge] Querying local AI:', prompt)
      
      // Emit processing event
      this.emit('ai:processing', { prompt })
      
      // AI queries should go through topics, not direct IPC
      throw new Error('Direct AI queries deprecated - use topic-based conversation')
      
      this.emit('ai:complete', { prompt, response })
      return response
    } catch (error) {
      console.error('[LamaBridge] AI query failed:', error)
      this.emit('ai:error', { prompt, error })
      throw error
    }
  }
  
  async loadModel(modelId: string): Promise<boolean> {
    if (!this.appModel?.llmManager) {
      throw new Error('LLM Manager not available')
    }
    
    try {
      console.log('[LamaBridge] Loading AI model:', modelId)
      await this.appModel.llmManager.loadModel(modelId)
      return true
    } catch (error) {
      console.error('[LamaBridge] Failed to load model:', error)
      return false
    }
  }
  
  async createUdpSocket(options: SocketOptions): Promise<string> {
    if (!this.appModel) {
      throw new Error('AppModel not available')
    }
    
    try {
      // Create UDP socket through AppModel
      const socket = await this.appModel.createUdpSocket(options)
      return socket.id
    } catch (err) {
      console.error('[LamaBridge] Failed to create UDP socket:', err)
      throw err
    }
  }
  
  async sendUdpMessage(socketId: string, message: Buffer, port: number, address: string): Promise<void> {
    console.log('Sending UDP message:', socketId, port, address)
  }
  
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
  }
  
  off(event: string, callback: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }
  
  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => callback(...args))
    }
  }

  async getAvailableModels(): Promise<any[]> {
    if (!this.appModel?.llmManager) {
      return []
    }
    
    try {
      const models = this.appModel.llmManager.getModels()
      const modelSettings = this.appModel.llmManager.getAllModelSettings()
      
      // Combine model info with settings
      return models.map(model => {
        const settings = modelSettings.find(s => s.llmId === model.id)
        return {
          id: model.id,
          name: model.name,
          description: model.description,
          version: model.version,
          isLoaded: settings?.isLoaded || false,
          isDefault: settings?.isDefault || false,
          provider: model.parameters?.provider || 'unknown',
          modelType: model.parameters?.modelType || 'chat',
          capabilities: model.parameters?.capabilities || [],
          contextLength: model.parameters?.contextLength || 4096,
          size: model.size,
          settings: settings ? {
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            systemPrompt: settings.systemPrompt
          } : null
        }
      })
    } catch (error) {
      console.error('[LamaBridge] Failed to get available models:', error)
      return []
    }
  }
  
  async setDefaultModel(modelId: string): Promise<boolean> {
    if (!this.appModel?.llmManager) {
      return false
    }
    
    try {
      await this.appModel.llmManager.setDefaultModel(modelId)
      return true
    } catch (error) {
      console.error('[LamaBridge] Failed to set default model:', error)
      return false
    }
  }
  
  async enableAIForTopic(topicId: string): Promise<boolean> {
    if (!this.appModel?.aiAssistantModel) {
      return false
    }
    
    try {
      await this.appModel.aiAssistantModel.enableForTopic(topicId)
      return true
    } catch (error) {
      console.error('[LamaBridge] Failed to enable AI for topic:', error)
      return false
    }
  }
  
  async disableAIForTopic(topicId: string): Promise<boolean> {
    if (!this.appModel?.aiAssistantModel) {
      return false
    }
    
    try {
      await this.appModel.aiAssistantModel.disableForTopic(topicId)
      return true
    } catch (error) {
      console.error('[LamaBridge] Failed to disable AI for topic:', error)
      return false
    }
  }
  
  async getBestModelForTask(task: 'coding' | 'reasoning' | 'chat' | 'analysis'): Promise<any> {
    if (!this.appModel?.llmManager) {
      return null
    }
    
    try {
      const model = this.appModel.llmManager.getBestModelForTask(task)
      if (!model) return null
      
      const settings = this.appModel.llmManager.getModelSettings(model.id)
      return {
        id: model.id,
        name: model.name,
        description: model.description,
        provider: model.parameters?.provider || 'unknown',
        modelType: model.parameters?.modelType || 'chat',
        capabilities: model.parameters?.capabilities || [],
        isLoaded: settings?.isLoaded || false,
        isDefault: settings?.isDefault || false
      }
    } catch (error) {
      console.error('[LamaBridge] Failed to get best model for task:', error)
      return null
    }
  }
  
  async getModelsByCapability(capability: string): Promise<any[]> {
    if (!this.appModel?.llmManager) {
      return []
    }
    
    try {
      const models = this.appModel.llmManager.getModelsByCapability(capability)
      return models.map(model => {
        const settings = this.appModel!.llmManager!.getModelSettings(model.id)
        return {
          id: model.id,
          name: model.name,
          description: model.description,
          provider: model.parameters?.provider || 'unknown',
          modelType: model.parameters?.modelType || 'chat',
          capabilities: model.parameters?.capabilities || [],
          isLoaded: settings?.isLoaded || false,
          isDefault: settings?.isDefault || false
        }
      })
    } catch (error) {
      console.error('[LamaBridge] Failed to get models by capability:', error)
      return []
    }
  }
  
  async getContacts(): Promise<any[]> {
    if (!this.appModel) {
      console.warn('[LamaBridge] AppModel not available for getting contacts')
      return []
    }
    
    try {
      return await this.appModel.getContacts()
    } catch (error) {
      console.error('[LamaBridge] Failed to get contacts:', error)
      return []
    }
  }
  
  async getOrCreateTopicForContact(contactId: string): Promise<string | null> {
    console.log('[LamaBridge] Getting or creating topic for contact:', contactId)
    
    if (!this.appModel?.topicModel || !this.appModel?.leuteModel || !this.appModel?.channelManager) {
      console.error('[LamaBridge] Missing required models for topic creation')
      return null
    }
    
    try {
      // Get my person ID
      const myPersonId = await this.appModel.leuteModel.myMainIdentity()
      if (!myPersonId) {
        console.error('[LamaBridge] Cannot get my Person ID')
        return null
      }
      
      console.log('[LamaBridge] My person ID:', myPersonId)
      console.log('[LamaBridge] Contact person ID:', contactId)
      
      // Create topic without specifying owner
      // undefined channelOwner -> becomes null in createChannel -> becomes undefined owner
      const topic = await this.appModel.topicModel.createOneToOneTopic(myPersonId, contactId)
      console.log('[LamaBridge] Topic created/found:', topic.id)
      
      // CRITICAL: Create the channel for this topic immediately!
      // Without a channel, we cannot post messages to the topic
      try {
        console.log('[LamaBridge] Creating channel for topic:', topic.id)
        await this.appModel.channelManager.createChannel(topic.id, myPersonId)
        console.log('[LamaBridge] ✅ Channel created successfully with owner:', myPersonId)
        
        // Grant federation access for CHUM sync
        await this.grantChannelAccessToNode(topic.id, myPersonId)
      } catch (channelError) {
        // Channel might already exist, which is fine
        console.log('[LamaBridge] Channel creation result:', channelError?.message || 'Channel may already exist')
      }
      
      // Enter the topic room to ensure it's properly initialized
      try {
        console.log('[LamaBridge] Entering topic room to initialize...')
        const topicRoom = await this.appModel.topicModel.enterTopicRoom(topic.id)
        
        // Cache the topic room for future use
        this.topicRooms.set(topic.id, topicRoom)
        
        console.log('[LamaBridge] Topic room entered successfully')
      } catch (roomError) {
        console.warn('[LamaBridge] Could not fully initialize topic room:', roomError)
        // Still return the topic ID even if room initialization fails
        // It might work on next attempt
      }
      
      return topic.id
    } catch (error) {
      console.error('[LamaBridge] Error creating topic for contact:', error)
      return null
    }
  }
  
  async clearConversation(conversationId: string = 'default'): Promise<void> {
    console.log('[LamaBridge] Clearing conversation:', conversationId)
    
    // Remove from cache immediately
    this.topicRooms.delete(conversationId)
    
    // Don't try to interact with TopicModel during deletion - it can hang
    // Just clear the cache and let the UI reset
    console.log('[LamaBridge] Cache cleared for conversation:', conversationId)
  }
  
  // Get the AppModel instance
  getAppModel() {
    return this.appModel
  }

  private async shouldEnableAIForConversation(conversationId: string): Promise<boolean> {
    try {
      // 1. Check if this is the default AI chat conversation
      if (conversationId === 'default') {
        return true
      }

      // 2. Check if AI is explicitly enabled for this topic via aiAssistantModel
      if (this.appModel?.aiAssistantModel) {
        const isEnabled = this.appModel.aiAssistantModel.isTopicEnabled(conversationId)
        if (isEnabled) {
          return true
        }
      }

      // 3. Check if this conversation was created from ContactsView as person-to-person
      // Person-to-person topics have IDs that are deterministic based on person IDs
      // If the conversation ID looks like a person-to-person topic ID, don't enable AI
      if (this.isPersonToPersonTopic(conversationId)) {
        console.log('[LamaBridge] Detected person-to-person topic, disabling AI:', conversationId)
        return false
      }

      // 4. Default to false for unknown conversation types
      return false
    } catch (error) {
      console.warn('[LamaBridge] Error checking AI enablement for conversation:', error)
      return false
    }
  }

  private isPersonToPersonTopic(topicId: string): boolean {
    // Person-to-person topics have IDs like "personA<->personB" or are SHA hashes
    // They're typically much longer than simple conversation IDs
    if (topicId.length > 32 && topicId.match(/^[a-f0-9]+$/)) {
      return true // Looks like a SHA hash (person-to-person topic)
    }
    
    if (topicId.includes('<->')) {
      return true // Explicit person-to-person format
    }
    
    return false
  }

  private async grantChannelAccessToNode(channelId: string, channelOwner: string): Promise<void> {
    try {
      if (!this.appModel?.nodePersonId) {
        return
      }
      
      const nodePersonId = this.appModel.nodePersonId
      const federationGroupId = this.appModel.federationGroupId
      
      const { createAccess } = await import('@refinio/one.core/lib/access.js')
      const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')
      const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/util/object.js')
      
      const channelInfoHash = await calculateIdHashOfObj({
        $type$: 'ChannelInfo',
        id: channelId,
        owner: channelOwner
      })
      
      // Grant both Node person AND federation group access for proper CHUM sync
      const groups = federationGroupId ? [federationGroupId] : []
      await createAccess([{
        id: channelInfoHash,
        person: [nodePersonId],
        group: groups,
        mode: SET_ACCESS_MODE.ADD
      }])
      
      console.log(`[LamaBridge] Granted channel ${channelId} access to Node and federation group`)
    } catch (error) {
      console.error('[LamaBridge] Failed to grant access:', error)
    }
  }
  
  private async grantMessageAccessToNode(topicRoom: any, channelId: string): Promise<void> {
    try {
      if (!this.appModel?.nodePersonId || !this.appModel?.channelManager) {
        return
      }
      
      const nodePersonId = this.appModel.nodePersonId
      const federationGroupId = this.appModel.federationGroupId
      const { createAccess } = await import('@refinio/one.core/lib/access.js')
      const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')
      
      // Get ALL messages from the channel to grant comprehensive access
      const channelInfos = await this.appModel.channelManager.getMatchingChannelInfos({
        channelId: channelId
      })
      
      console.log(`[LamaBridge] Granting message access for ${channelInfos.length} channel(s)`)
      
      for (const channelInfo of channelInfos) {
        const entries = channelInfo.obj?.data || []
        console.log(`[LamaBridge] Processing ${entries.length} entries in channel ${channelInfo.idHash.substring(0, 8)}...`)
        
        // Grant access to ALL entries, not just the latest one
        // This ensures Node can see the complete conversation history
        const accessGrants = []
        
        for (const entry of entries) {
          // Grant access to each component of the message
          if (entry.channelEntryHash) {
            accessGrants.push({
              id: entry.channelEntryHash,
              person: [nodePersonId],
              group: federationGroupId ? [federationGroupId] : [],
              mode: SET_ACCESS_MODE.ADD
            })
          }
          
          if (entry.dataHash) {
            accessGrants.push({
              id: entry.dataHash,
              person: [nodePersonId],
              group: federationGroupId ? [federationGroupId] : [],
              mode: SET_ACCESS_MODE.ADD
            })
          }
          
          if (entry.creationTimeHash) {
            accessGrants.push({
              id: entry.creationTimeHash,
              person: [nodePersonId],
              group: federationGroupId ? [federationGroupId] : [],
              mode: SET_ACCESS_MODE.ADD
            })
          }
        }
        
        if (accessGrants.length > 0) {
          await createAccess(accessGrants)
          console.log(`[LamaBridge] Granted Node access to ${accessGrants.length} message objects`)
        }
      }
    } catch (error) {
      console.error('[LamaBridge] Failed to grant message access to Node:', error)
    }
  }
  
  private async grantAccessForPersonToPersonTopic(topicId: string): Promise<void> {
    try {
      if (!this.appModel?.channelManager || !this.appModel?.leuteModel) {
        console.warn('[LamaBridge] Cannot grant access rights - missing models')
        return
      }

      // Extract participants from topic ID (format: personA<->personB)
      const participants = topicId.split('<->')
      if (participants.length !== 2) {
        console.log('[LamaBridge] Not a standard person-to-person topic format:', topicId)
        return
      }

      console.log('[LamaBridge] Granting access rights for participants:', participants)

      // Import createAccess from one.core
      const { createAccess } = await import('@refinio/one.core/lib/access.js')
      const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')

      // Get channel info for this topic
      const channelInfos = await this.appModel.channelManager.getMatchingChannelInfos({
        channelId: topicId
      })

      // Grant access to all channel infos and their entries
      for (const channelInfo of channelInfos) {
        console.log('[LamaBridge] Granting access to channel:', channelInfo.idHash)
        
        // Grant access to the ChannelInfo object itself - for ALL participants at once
        await createAccess([{
          id: channelInfo.idHash,
          person: participants,  // Pass array of participants
          group: [],
          mode: SET_ACCESS_MODE.ADD
        }])

        // Also grant access to channel entries if needed
        // This ensures messages are accessible
        const entries = channelInfo.obj?.data || []
        for (const entry of entries) {
          const accessGrants = []
          
          // Grant access to the channel entry hash itself
          if (entry.channelEntryHash) {
            accessGrants.push({
              id: entry.channelEntryHash,
              person: participants,
              group: [],
              mode: SET_ACCESS_MODE.ADD
            })
          }
          
          // Grant access to the data hash
          if (entry.dataHash) {
            accessGrants.push({
              id: entry.dataHash,
              person: participants,
              group: [],
              mode: SET_ACCESS_MODE.ADD
            })
          }
          
          // Grant access to the creation time hash
          if (entry.creationTimeHash) {
            accessGrants.push({
              id: entry.creationTimeHash,
              person: participants,
              group: [],
              mode: SET_ACCESS_MODE.ADD
            })
          }
          
          if (accessGrants.length > 0) {
            await createAccess(accessGrants)
          }
        }
      }

      console.log('[LamaBridge] Access rights granted successfully')
      
      // Trigger CHUM sync to distribute the access rights
      if (this.appModel.connections) {
        console.log('[LamaBridge] Triggering CHUM sync...')
        // The connections model should handle syncing
        // This might need adjustment based on actual ConnectionsModel API
      }
    } catch (error) {
      console.error('[LamaBridge] Error granting access rights:', error)
    }
  }
  
  private async getOrCreateTopicRoom(conversationId: string): Promise<any> {
    try {
      // Check if we already have this topic room cached
      if (this.topicRooms.has(conversationId)) {
        const cachedRoom = this.topicRooms.get(conversationId)
        
        // Verify the cached room can still post messages
        if (this.isPersonToPersonTopic(conversationId) && this.appModel?.channelManager) {
          const channelInfos = await this.appModel.channelManager.getMatchingChannelInfos({
            channelId: conversationId
          })
          
          const myPersonId = await this.appModel.leuteModel?.myMainIdentity?.()
          const hasMyChannel = channelInfos?.some(info => 
            info.owner === myPersonId
          )
          
          if (!hasMyChannel) {
            console.log('[LamaBridge] Cached room but no channel for current user, recreating...')
            this.topicRooms.delete(conversationId)
            // Fall through to create new room
          } else {
            return cachedRoom
          }
        } else {
          return cachedRoom
        }
      }
      
      if (!this.appModel?.topicModel) {
        console.error('[LamaBridge] TopicModel not available')
        return null
      }
      
      // For default conversation, create a group topic for AI chat
      if (conversationId === 'default') {
        console.log('[LamaBridge] Creating group topic for AI chat')
        
        try {
          // First check if the topic already exists
          const existingTopic = await this.appModel.topicModel.topics?.queryById?.(conversationId)
          
          // Get the current user's person ID - needed for channel operations
          const myPersonId = await this.appModel.leuteModel?.myMainIdentity?.()
          if (!myPersonId) {
            throw new Error('Cannot create topic without user identity')
          }
          
          let topic
          if (existingTopic) {
            console.log('[LamaBridge] Topic already exists:', conversationId)
            topic = existingTopic
            
            // Ensure AI person exists and is cached
            if (!this.conversationAIPersons.has(conversationId)) {
              const aiPersonId = await this.getAIPersonId('gpt-oss')
              this.conversationAIPersons.set(conversationId, aiPersonId)
              console.log(`[LamaBridge] AI person cached for existing topic: ${aiPersonId.substring(0, 8)}...`)
            }
            
            // Even if topic exists, ensure the channel exists for the user
            try {
              console.log('[LamaBridge] Ensuring channel exists for existing topic')
              await this.appModel.channelManager?.createChannel(conversationId, myPersonId)
              console.log('[LamaBridge] Channel created/verified for user')
              
              // Grant federation access for CHUM sync
              await this.grantChannelAccessToNode(conversationId, myPersonId)
            } catch (err) {
              console.log('[LamaBridge] Channel may already exist:', err)
            }
            
            // Enable AI for existing topic if not already enabled
            if (this.appModel.aiAssistantModel && !this.appModel.aiAssistantModel.isTopicEnabled(conversationId)) {
              await this.appModel.aiAssistantModel.enableForTopic(conversationId)
              console.log(`[LamaBridge] AI enabled for existing topic: ${conversationId}`)
            }
          } else {
            console.log('[LamaBridge] Creating new group topic')
            console.log('[LamaBridge] Using user as channel owner:', myPersonId.toString().substring(0, 8) + '...')
            
            // Create AI person first - it should exist before topic creation
            const aiPersonId = await this.getAIPersonId('gpt-oss')
            console.log(`[LamaBridge] AI person created/retrieved: ${aiPersonId.substring(0, 8)}...`)
            
            // Create a group topic with the user as owner
            // LLMs are first-class citizens, so this is a proper conversation
            topic = await this.appModel.topicModel.createGroupTopic(
              'AI Chat',      // Topic name
              conversationId, // Topic ID (optional, but we want a specific ID)
              myPersonId      // User owns the channel since they started the conversation
            )
            
            // Enable AI for this topic
            if (this.appModel.aiAssistantModel) {
              await this.appModel.aiAssistantModel.enableForTopic(conversationId)
              console.log(`[LamaBridge] AI enabled for topic: ${conversationId}`)
            }
            
            // Add AI as participant to the topic
            if (topic && aiPersonId) {
              // Store AI person for this conversation for quick access
              this.conversationAIPersons.set(conversationId, aiPersonId)
            }
            
            if (!topic || !topic.id) {
              throw new Error('Failed to create group topic')
            }
            
            console.log('[LamaBridge] Group topic created:', topic.id)
          }
          
          // Now enter the topic room
          const topicRoom = await this.appModel.topicModel.enterTopicRoom(topic.id)
          
          if (topicRoom) {
            console.log('[LamaBridge] Successfully entered topic room:', topic.id)
            // Cache the topic room
            this.topicRooms.set(conversationId, topicRoom)
            if (topic.id !== conversationId) {
              // Also cache by the actual topic ID if different
              this.topicRooms.set(topic.id, topicRoom)
            }
            
            // Subscribe to new messages
            topicRoom.onNewMessageReceived?.listen?.(() => {
              this.emit('message:updated', { conversationId })
            })
            
            return topicRoom
          }
        } catch (error) {
          console.error('[LamaBridge] Error creating one-to-one topic:', error)
          
          // As a fallback, return a mock topic room that stores messages locally
          console.log('[LamaBridge] Using fallback mock topic room')
          const mockTopicRoom = {
            topic: { id: conversationId, name: 'AI Chat' },
            messages: [],
            async sendMessage(content: string, author?: string) {
              const message = {
                obj: {
                  content,
                  author: author || 'user',
                  timestamp: new Date()
                },
                hash: `msg-${Date.now()}`
              }
              this.messages.push(message)
              return message
            },
            async retrieveAllMessages() {
              return this.messages
            },
            onNewMessageReceived: {
              listen: (callback: () => void) => { return () => {} }
            }
          }
          
          this.topicRooms.set(conversationId, mockTopicRoom)
          return mockTopicRoom
        }
      }
      
      // For other conversations (including person-to-person topics)
      try {
        console.log('[LamaBridge] Attempting to enter topic room for:', conversationId)
        
        // First, ensure we have the user's person ID for channel operations
        const myPersonId = await this.appModel.leuteModel?.myMainIdentity?.()
        if (!myPersonId) {
          throw new Error('Cannot access topic without user identity')
        }
        
        // ALWAYS ensure the channel exists before trying to use it
        // This is the root cause - we must create the channel if it doesn't exist
        if (this.appModel.channelManager) {
          const channelInfos = await this.appModel.channelManager.getMatchingChannelInfos({
            channelId: conversationId
          })
          
          // If no channel exists, create one
          if (!channelInfos || channelInfos.length === 0) {
            console.log('[LamaBridge] No channel exists for:', conversationId)
            console.log('[LamaBridge] Creating channel with myPersonId as owner')
            
            try {
              await this.appModel.channelManager.createChannel(conversationId, myPersonId)
              console.log('[LamaBridge] ✅ Channel created successfully')
              
              // Grant federation access for CHUM sync
              await this.grantChannelAccessToNode(conversationId, myPersonId)
            } catch (err) {
              console.error('[LamaBridge] Failed to create channel:', err)
              // Try to create topic which will create the channel
              if (this.isPersonToPersonTopic(conversationId)) {
                const participants = conversationId.split('<->')
                if (participants.length === 2) {
                  const [personA, personB] = participants
                  console.log('[LamaBridge] Attempting to create topic for person-to-person chat')
                  const topic = await this.appModel.topicModel.createOneToOneTopic(personA, personB)
                  console.log('[LamaBridge] Topic created:', topic?.id)
                }
              } else {
                // Create a group topic
                const topic = await this.appModel.topicModel.createGroupTopic(
                  'Chat',
                  conversationId,
                  myPersonId
                )
                console.log('[LamaBridge] Group topic created:', topic?.id)
              }
            }
          } else {
            console.log('[LamaBridge] Channel already exists, found', channelInfos.length, 'channel(s)')
          }
        }
        
        const topicRoom = await this.appModel.topicModel.enterTopicRoom(conversationId)
        if (topicRoom) {
          this.topicRooms.set(conversationId, topicRoom)
          
          // Subscribe to new messages
          topicRoom.onNewMessageReceived?.listen?.(() => {
            this.emit('message:updated', { conversationId })
          })
          
          return topicRoom
        }
      } catch (error) {
        console.warn('[LamaBridge] Could not enter topic room:', conversationId, error)
        
        // Create a real topic if it doesn't exist
        if (error?.message?.includes('does not exist')) {
          try {
            console.log('[LamaBridge] Creating new topic via TopicModel:', conversationId)
            
            // Get the current user's person ID
            const myPersonId = await this.appModel.leuteModel?.myMainIdentity?.()
            if (!myPersonId) {
              throw new Error('Cannot create topic without user identity')
            }
            
            console.log('[LamaBridge] Creating new group topic')
            console.log('[LamaBridge] Using user as channel owner:', myPersonId.toString().substring(0, 8) + '...')
            
            // Create a group topic with the user as owner
            const topic = await this.appModel.topicModel.createGroupTopic(
              'Chat',         // Topic name
              conversationId, // Topic ID
              myPersonId      // User owns the channel since they started the conversation
            )
            
            // Enable AI for this topic
            if (this.appModel.aiAssistantModel) {
              await this.appModel.aiAssistantModel.enableForTopic(conversationId)
              console.log(`[LamaBridge] AI enabled for topic: ${conversationId}`)
            }
            
            if (!topic || !topic.id) {
              throw new Error('Failed to create group topic')
            }
            
            console.log('[LamaBridge] Group topic created:', topic.id)
            
            // Now enter the topic room
            const topicRoom = await this.appModel.topicModel.enterTopicRoom(topic.id)
            
            if (topicRoom) {
              console.log('[LamaBridge] Successfully entered topic room:', topic.id)
              // Cache the topic room
              this.topicRooms.set(conversationId, topicRoom)
              
              // Subscribe to new messages
              topicRoom.onNewMessageReceived?.listen?.(() => {
                this.emit('message:updated', { conversationId })
              })
              
              return topicRoom
            }
          } catch (createError) {
            console.error('[LamaBridge] Failed to create topic:', createError)
          }
        }
      }
      
      return null
    } catch (error) {
      console.error('[LamaBridge] Error getting/creating topic room:', error)
      return null
    }
  }
  
  private async getTopicName(topicId: string): Promise<string> {
    // Special cases for known topic IDs
    if (topicId === 'default' || topicId === 'default-ai-chat') {
      return 'General Chat'
    }
    
    // Handle LAMA-style AI chat topics: chat-with-[model-name]
    if (topicId.startsWith('chat-with-')) {
      const modelSlug = topicId.substring(10) // Remove 'chat-with-' prefix
      // Convert slug back to readable format
      const modelName = modelSlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      return `Chat with ${modelName}`
    }
    
    // Handle one-to-one topic IDs: [personId1]<->[personId2]
    if (topicId.includes('<->')) {
      const participants = topicId.split('<->')
      if (participants.length === 2) {
        // Try to resolve person names
        try {
          const contacts = await this.getContacts()
          const names = participants.map(personId => {
            const contact = contacts.find(c => c.id === personId)
            return contact?.name || contact?.displayName || personId.substring(0, 8)
          })
          return names.join(' & ')
        } catch (error) {
          // Fallback to abbreviated IDs
          return participants.map(id => id.substring(0, 8)).join(' & ')
        }
      }
    }
    
    // Handle system topics
    if (topicId === 'everyone') {
      return 'Everyone'
    }
    if (topicId === 'glue') {
      return 'System'
    }
    
    // Try to get topic info from TopicModel
    if (this.appModel?.topicModel) {
      try {
        const topics = await this.appModel.topicModel.getTopics?.()
        const topic = topics?.find((t: any) => t.id === topicId)
        if (topic?.name) {
          return topic.name
        }
      } catch (error) {
        console.warn('[LamaBridge] Could not get topic name:', error)
      }
    }
    
    // Try to get from cached conversation info
    const savedConversations = localStorage.getItem('lama-conversations')
    if (savedConversations) {
      try {
        const conversations = JSON.parse(savedConversations)
        const conversation = conversations.find((c: any) => c.id === topicId)
        if (conversation?.name) {
          return conversation.name
        }
      } catch (error) {
        console.warn('[LamaBridge] Could not get conversation name:', error)
      }
    }
    
    // Default formatting - capitalize and clean up
    return topicId
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  private createAITopicId(modelName: string): string {
    // Convert model name to LAMA-style slug format
    const slug = modelName
      .toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, '')     // Remove non-alphanumeric chars except hyphens
      .replace(/-+/g, '-')            // Collapse multiple hyphens
      .replace(/^-|-$/g, '')          // Remove leading/trailing hyphens
    
    return `chat-with-${slug}`
  }

  private createOneToOneTopicId(personId1: string, personId2: string): string {
    // LAMA convention: sort person IDs alphabetically and join with '<->'
    return [personId1, personId2].sort().join('<->')
  }

  private isAIPersonId(personId: string): boolean {
    return this.allAIPersonIds.has(personId)
  }
  
  private async getAIPersonId(aiName: string): Promise<string> {
    console.log(`[LamaBridge] getAIPersonId called for: ${aiName}`)
    try {
      // Use browser's crypto API for deterministic hash generation
      const encoder = new TextEncoder()
      const data = encoder.encode(`ai-${aiName}`)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      console.log(`[LamaBridge] Generated AI ID: ${hashHex.substring(0, 8)}... for ${aiName}`)
      
      // Track this as an AI person ID
      this.allAIPersonIds.add(hashHex)
      
      // Ensure this AI ID has default keys
      const { hasDefaultKeys, createDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js')
      console.log(`[LamaBridge] Checking if AI ${aiName} has keys...`)
      const hasKeys = await hasDefaultKeys(hashHex)
      console.log(`[LamaBridge] hasDefaultKeys(${hashHex.substring(0, 8)}...) returned: ${hasKeys}`)
      if (!hasKeys) {
        console.log(`[LamaBridge] Creating default keys for AI: ${aiName} (${hashHex})`)
        const { createKeyPair } = await import('@refinio/one.core/lib/crypto/encryption.js')
        const { createSignKeyPair } = await import('@refinio/one.core/lib/crypto/sign.js')
        
        const encryptionKeyPair = createKeyPair()
        const signKeyPair = createSignKeyPair()
        
        // createDefaultKeys expects the key pairs as separate arguments, not in an object
        await createDefaultKeys(hashHex, encryptionKeyPair, signKeyPair)
        console.log(`[LamaBridge] Default keys created for AI: ${aiName}`)
      }
      
      return hashHex
    } catch (error) {
      console.error('[LamaBridge] Failed to generate AI Person ID:', error)
      // Fallback to a simple deterministic ID
      return `ai-${aiName}`.padEnd(64, '0')
    }
  }

  /**
   * Get information about the current instance
   */
  async getInstanceInfo(): Promise<any> {
    try {
      if (!window.electronAPI) {
        // Browser-only mode - return browser instance info
        return {
          success: true,
          instance: {
            id: 'browser-instance',
            name: 'Browser UI',
            platform: 'browser',
            role: 'client',
            initialized: true,
            capabilities: {
              network: false,
              storage: false,
              llm: false
            }
          }
        }
      }

      // Get instance info via IPC from Node.js
      const result = await window.electronAPI.invoke('instance:info')
      return result
    } catch (error) {
      console.error('[LamaBridge] Failed to get instance info:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get connected devices/instances
   */
  async getConnectedDevices(): Promise<any> {
    try {
      if (!window.electronAPI) {
        // Browser-only mode - no connected devices
        return { success: true, devices: [] }
      }

      // Get connected devices via IPC
      const result = await window.electronAPI.invoke('devices:connected')
      return result
    } catch (error) {
      console.error('[LamaBridge] Failed to get connected devices:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Create an invitation for pairing
   */
  async createInvitation(): Promise<any> {
    try {
      if (!window.electronAPI) {
        return {
          success: false,
          error: 'Invitations require Electron environment'
        }
      }

      // Create invitation via IPC
      const result = await window.electronAPI.invoke('invitation:create')
      return result
    } catch (error) {
      console.error('[LamaBridge] Failed to create invitation:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get contacts from Node.js ONE.core
   */
  async getNodeContacts(): Promise<any> {
    try {
      if (!window.electronAPI) {
        // Browser-only mode - no Node.js contacts
        return { success: true, contacts: [] }
      }

      // Get contacts from Node.js ONE.core via IPC
      const result = await window.electronAPI.invoke('onecore:getContacts')
      return result
    } catch (error) {
      console.error('[LamaBridge] Failed to get Node.js contacts:', error)
      return { success: false, error: error.message }
    }
  }
}

// Create singleton instance
export const lamaBridge = new LamaBridge()

// Debug: Log when bridge is loaded
console.log('🔥🔥🔥 LAMA BRIDGE LOADED 🔥🔥🔥 sendMessage type:', typeof lamaBridge.sendMessage)
console.log('🔥🔥🔥 lamaBridge object:', lamaBridge)

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).lamaBridge = lamaBridge
}

// Type declarations for window.electronAPI
declare global {
  interface Window {
    electronAPI?: {
      platform: string
      isElectron: boolean
      createUdpSocket: (options: SocketOptions) => Promise<{ id: string }>
      readFile: (path: string) => string
      writeFile: (path: string, data: string) => void
      path: any
    }
  }
}