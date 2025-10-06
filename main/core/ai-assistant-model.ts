import type ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js';
/**
 * AI Assistant Model for managing AI interactions
 * This class handles AI personas, LLM objects, and message processing
 */

import electron from 'electron'
import type { NodeOneCore } from '../types/one-core.js'
import { AISettingsManager } from './ai-settings-manager.js'
import LLMObjectManager from './llm-object-manager.js'
import { ContextEnrichmentService } from './one-ai/services/ContextEnrichmentService.js'
import llmManager from '../services/llm-manager.js'
const { BrowserWindow } = electron

export class AIAssistantModel {
  name: any;
  text: any;
  nodeOneCore: NodeOneCore;
  llmManager: typeof llmManager | null;
  llmObjectManager: LLMObjectManager | null;
  contextEnrichmentService: ContextEnrichmentService | null;
  aiSettingsManager: AISettingsManager | null;
  isInitialized: boolean;
  topicModelMap: Map<string, string>;
  defaultModelId: string | null;
  aiContacts: Map<string, string>;
  lastRestartPoint: Map<string, number>;
  topicRestartSummaries: Map<string, any>;

  constructor(nodeOneCore: NodeOneCore) {
    this.nodeOneCore = nodeOneCore
    this.llmManager = null
    this.llmObjectManager = null
    this.contextEnrichmentService = null
    this.aiSettingsManager = null
    this.isInitialized = false
    this.topicModelMap = new Map()
    this.defaultModelId = null // AI assistant owns this
    this.lastRestartPoint = new Map()
    this.topicRestartSummaries = new Map()

    // Cache for AI contacts - modelId -> personId
    this.aiContacts = new Map()
}

  /**
   * Pre-initialize connections to LLM services
   * This is called early to warm up connections before user needs them
   */
  async init(): Promise<void> {
    console.log('[AIAssistantModel] Pre-warming LLM connections...')

    try {
      // Use the statically imported LLM manager
      if (llmManager) {
        this.llmManager = llmManager

        // Pre-warm Ollama connection by checking if it's available
        import('../services/ollama.js').then(async (ollama) => {
          const isRunning = await ollama.isOllamaRunning()
          if (isRunning) {
            console.log('[AIAssistantModel] ✅ Ollama service detected')
          }
        }).catch(() => {
          // Silently fail - Ollama might not be running
        })

        // Pre-warm LM Studio connection
        import('../services/lmstudio.js').then(async (lmstudio) => {
          const isRunning = await lmstudio.isLMStudioRunning()
          if (isRunning) {
            console.log('[AIAssistantModel] ✅ LM Studio service detected')
          }
        }).catch(() => {
          // Silently fail - LM Studio might not be running
        })
      }
    } catch (error: unknown) {
      console.log('[AIAssistantModel] Could not check LLM services:', error instanceof Error ? (error as Error).message : String(error))
    }

    // Now initialize the rest of the model
    await this.initialize(this.llmManager)
  }

  /**
   * Initialize the AI Assistant Model
   */
  async initialize(llmManagerInstance?: typeof llmManager | null): Promise<void> {
    console.log('[AIAssistantModel] Initializing...')

    // Only set llmManager if we don't already have it from init()
    if (!this.llmManager && llmManagerInstance) {
      this.llmManager = llmManagerInstance
    }

    // Create AISettingsManager using static import
    this.aiSettingsManager = new AISettingsManager(this.nodeOneCore)

    // Get saved default model ID directly
    this.defaultModelId = await this.aiSettingsManager.getDefaultModelId()
    if (this.defaultModelId) {
      console.log('[AIAssistantModel] Restored default model from storage:', this.defaultModelId)
      // Register private variant for LAMA conversations
      if (this.llmManager && this.llmManager?.registerPrivateVariantForModel) {
        this.llmManager?.registerPrivateVariantForModel(this.defaultModelId)
      }
    }

    // Create LLMObjectManager using static import
    this.llmObjectManager = new LLMObjectManager(this.nodeOneCore)
    console.log('[AIAssistantModel] Created LLMObjectManager')

    // Initialize context enrichment service if topic analysis model is available
    try {
      const topicAnalysisModel = (this.nodeOneCore as any).topicAnalysisModel

      if (topicAnalysisModel && this.nodeOneCore.channelManager) {
        this.contextEnrichmentService = new ContextEnrichmentService(
          this.nodeOneCore.channelManager,
          topicAnalysisModel
        )
        console.log('[AIAssistantModel] ✅ Context enrichment service initialized')
      }
    } catch (error) {
      console.warn('[AIAssistantModel] Context enrichment not available:', error)
    }

    this.isInitialized = true
    console.log('[AIAssistantModel] ✅ Initialized')

    // Load existing AI contacts into cache first (needed for scanning)
    await this.loadExistingAIContacts()

    // Now scan existing conversations for AI participants and register them
    await this.scanExistingConversations()

    // Don't create LAMA topic here - it will be created when default model is set
    // This prevents duplicate creation and ensures proper participant setup
  }

  /**
   * Ensure default AI chats (Hi and LAMA) exist with welcome messages
   * This is the SINGLE entry point for creating AI default chats
   */
  async ensureDefaultChats(): Promise<void> {
    console.log('[AIAssistantModel] Ensuring default AI chats...')

    const model = this.getDefaultModel()
    if (!model) {
      console.log('[AIAssistantModel] No default model - cannot create default chats')
      return
    }

    const modelId = typeof model === 'string' ? model : model.id
    const aiPersonId = await this.ensureAIContactForModel(modelId)
    if (!aiPersonId) {
      console.error('[AIAssistantModel] Could not get AI person ID')
      return
    }

    // Create/ensure both Hi and LAMA topics
    await this.ensureHiChat(modelId, aiPersonId)

    // LAMA uses a separate AI contact with the -private model variant
    const privateModelId = modelId + '-private'
    const privateAiPersonId = await this.ensureAIContactForModel(privateModelId)
    if (!privateAiPersonId) {
      console.error('[AIAssistantModel] Could not get private AI person ID for LAMA')
      return
    }

    await this.ensureLamaChat(privateModelId, privateAiPersonId)
  }

  /**
   * Ensure Hi chat exists with static welcome message
   */
  private async ensureHiChat(modelId: string, aiPersonId: any): Promise<void> {
    console.log('[AIAssistantModel] Ensuring Hi chat...')

    try {
      // Check if Hi topic already has messages
      let topicRoom
      let needsWelcome = false

      try {
        topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom('hi')
        const messages = await topicRoom.retrieveAllMessages()
        needsWelcome = messages.length === 0
      } catch (e) {
        // Topic doesn't exist, create it
        await this.nodeOneCore.topicGroupManager.createGroupTopic('Hi', 'hi', [aiPersonId])
        topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom('hi')
        needsWelcome = true
      }

      // Register as AI topic
      this.registerAITopic('hi', modelId)

      if (needsWelcome) {
        const staticWelcome = `Hi! I'm LAMA, your local AI assistant.

You can make me your own, give me a name of your choice, give me a persistent identity.

We treat LLM as first-class citizens - they're communication peers just like people - and I will manage their learnings for you.

The LAMA chat below is my memory. You can configure its visibility in Settings. All I learn from your conversations gets stored there for context, and is fully transparent for you. Nobody else can see this content.

What can I help you with today?`

        await topicRoom.sendMessage(staticWelcome, aiPersonId)
        console.log('[AIAssistantModel] ✅ Hi chat created with welcome message')
      } else {
        console.log('[AIAssistantModel] ✅ Hi chat already exists')
      }
    } catch (error) {
      console.error('[AIAssistantModel] Failed to ensure Hi chat:', error)
    }
  }

  /**
   * Ensure LAMA chat exists with AI-generated welcome message
   * @param privateModelId - The private model ID (e.g., "gpt-oss:20b-private")
   * @param privateAiPersonId - The Person ID for the private model variant
   */
  private async ensureLamaChat(privateModelId: string, privateAiPersonId: any): Promise<void> {
    console.log(`[AIAssistantModel] Ensuring LAMA chat with private model: ${privateModelId}`)

    try {
      // Check if LAMA topic already has messages
      let topicRoom
      let needsWelcome = false

      try {
        topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom('lama')
        const messages = await topicRoom.retrieveAllMessages()
        needsWelcome = messages.length === 0
      } catch (e) {
        // Topic doesn't exist, create it with the PRIVATE AI contact
        await this.nodeOneCore.topicGroupManager.createGroupTopic('LAMA', 'lama', [privateAiPersonId])
        topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom('lama')
        needsWelcome = true
      }

      // Register as AI topic with the PRIVATE model ID
      this.registerAITopic('lama', privateModelId)

      if (needsWelcome) {
        // Use the private model that was passed in
        const privateModel = this.llmManager?.getModel(privateModelId) || this.getModelById(privateModelId.replace('-private', ''))

        // Generate welcome message asynchronously (non-blocking)
        setImmediate(() => {
          this.handleNewTopic('lama', topicRoom).catch(err => {
            console.error('[AIAssistantModel] Failed to generate LAMA welcome:', err)
          })
        })
        console.log('[AIAssistantModel] ✅ LAMA chat created, welcome message generating in background')
      } else {
        console.log('[AIAssistantModel] ✅ LAMA chat already exists')
      }
    } catch (error) {
      console.error('[AIAssistantModel] Failed to ensure LAMA chat:', error)
    }
  }

  /**
   * Create LAMA topic and send welcome message
   * DEPRECATED: Use ensureDefaultChats() instead
   */
  async createLamaTopicWithWelcome(): Promise<any> {
    try {
      console.log('[AIAssistantModel] 🚀🚀🚀 createLamaTopicWithWelcome() called!')

      if (!this.nodeOneCore.topicModel) {
        console.log('[AIAssistantModel] TopicModel not ready for welcome message')
        return
      }

      if (!this.nodeOneCore.channelManager) {
        console.log('[AIAssistantModel] ChannelManager not ready for welcome message')
        return
      }

      // Check if LAMA topic already exists
      const existingTopic = await this.nodeOneCore.topicModel.topics.queryById('lama')
      let topicRoom

      if (!existingTopic) {
        // Create LAMA topic if it doesn't exist
        console.log('[AIAssistantModel] Creating LAMA topic...')
        if (!this.nodeOneCore.topicGroupManager) {
          throw new Error('TopicGroupManager not initialized - cannot create LAMA topic')
        }

        // TODO: Fix topicGroupManager type
        await (this.nodeOneCore.topicGroupManager as any).createGroupTopic('LAMA', 'lama', [])

        // Create the channel
        console.log('[AIAssistantModel] Creating LAMA channel...')
        await this.nodeOneCore.channelManager.createChannel('lama', this.nodeOneCore.ownerId)
      } else {
        console.log('[AIAssistantModel] LAMA topic already exists, checking for messages...')
      }

      // Enter topic room
      topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom('lama')

      // Check if there are any messages
      const messages = await topicRoom.retrieveAllMessages()
      console.log(`[AIAssistantModel] LAMA has ${(messages as any)?.length} existing messages`)

      // Send welcome message if empty or very first message is not from AI
      const needsWelcome = (messages as any)?.length === 0 ||
                          ((messages as any)?.length > 0 && !(messages[0] as any).sender)

      if (needsWelcome) {
        console.log('[AIAssistantModel] LAMA needs welcome message, sending...')
        await this.handleNewTopic('lama', topicRoom)
      } else {
        console.log(`[AIAssistantModel] LAMA already has ${(messages as any)?.length} messages, skipping welcome`)
      }
    } catch (error) {
      console.error('[AIAssistantModel] Error setting up LAMA with welcome:', error)
    }
  }

  /**
   * Load existing AI contacts from LLM objects into cache
   * IMPORTANT: This must be called before scanExistingConversations()
   * so that isLLMPerson() can identify AI participants in topics
   */
  async loadExistingAIContacts(): Promise<any> {
    console.log('[AIAssistantModel] Loading existing AI contacts from LLM objects...')

    if (!this.llmObjectManager) {
      console.log('[AIAssistantModel] LLMObjectManager not available')
      return
    }

    try {
      // Get all LLM objects from the manager (already loaded from storage in initialize())
      const llmObjects = this.llmObjectManager.getAllLLMObjects()

      if (!llmObjects || llmObjects.length === 0) {
        console.log('[AIAssistantModel] No LLM objects found')
        return
      }

      console.log(`[AIAssistantModel] Found ${llmObjects.length} LLM objects`)

      // Cache each AI contact
      for (const llm of llmObjects) {
        if (llm.personId && llm.modelId) {
          this.aiContacts.set(llm.modelId, llm.personId)

          // ALSO cache under base model ID if this is a -private variant
          // This allows ensureDefaultChats to find the AI contact using the base model ID
          if (llm.modelId.endsWith('-private')) {
            const baseModelId = llm.modelId.replace('-private', '')
            this.aiContacts.set(baseModelId, llm.personId)
            const personIdStr = llm.personId.toString().substring(0, 8)
            console.log(`[AIAssistantModel] Loaded AI contact from LLM: ${llm.modelId} (person: ${personIdStr}...) - ALSO cached as ${baseModelId}`)
          } else {
            const personIdStr = llm.personId.toString().substring(0, 8)
            console.log(`[AIAssistantModel] Loaded AI contact from LLM: ${llm.modelId} (person: ${personIdStr}...)`)
          }
        }
      }

      console.log(`[AIAssistantModel] ✅ Loaded ${this.aiContacts.size} AI contacts from LLM objects`)
    } catch (error) {
      console.error('[AIAssistantModel] Failed to load AI contacts from LLM objects:', error)
    }
  }
  
  /**
   * Scan existing conversations for AI participants and register them as AI topics
   * Uses channel participants as source of truth
   * NOTE: Requires loadExistingAIContacts() to be called first so that
   * llmObjectManager.isLLMPerson() can identify AI participants
   */
  async scanExistingConversations(): Promise<any> {
    console.log('[AIAssistantModel] Skipping conversation scan - AI topics registered on creation')
    // AI topics are registered when chats are created via ensureDefaultChats()
  }

  /**
   * Register an AI topic
   */
  registerAITopic(topicId: any, modelId: any): void {
    console.log(`[AIAssistantModel] Registered AI topic: ${topicId} with model: ${modelId}`)
    this.topicModelMap.set(topicId, modelId)
  }

  /**
   * Check if a topic is an AI topic
   */
  isAITopic(topicId: any): any {
    const isAI = this.topicModelMap.has(topicId)
    console.log(`[AIAssistantModel] 🔍 DEBUG isAITopic("${topicId}") = ${isAI}`)
    if (isAI) {
      console.log(`[AIAssistantModel] 🔍 DEBUG topicModelMap keys: [${Array.from(this.topicModelMap.keys()).join(', ')}]`)
    }
    return isAI
  }

  /**
   * Get the model ID for a topic
   */
  getModelIdForTopic(topicId: any): any {
    return (this.topicModelMap as any)?.get(topicId) || null
  }

  /**
   * Process a message for AI response with context enrichment
   */
  async processMessage(topicId: any, message: any, senderId: any): Promise<any> {
    console.log(`[AIAssistantModel] Processing message for topic ${topicId}: "${message}"`)

    try {
      // Get the model ID for this topic
      const modelId = (this.topicModelMap as any)?.get(topicId)
      if (!modelId) {
        console.log('[AIAssistantModel] No AI model registered for this topic')
        return null
      }

      // Get the AI person ID for this model
      const aiPersonId = await this.ensureAIContactForModel(modelId)
      if (!aiPersonId) {
        console.error('[AIAssistantModel] Could not get AI person ID')
        return null
      }

      // Check if the message is from the AI itself
      if (senderId === aiPersonId || (senderId && aiPersonId && senderId.toString() === aiPersonId.toString())) {
        console.log('[AIAssistantModel] Message is from AI, skipping response')
        return null
      }

      // Get the topic room
      const topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(topicId)

      // Get conversation history
      const messages = await topicRoom.retrieveAllMessages()

      // Check if we need to restart the conversation due to context window limits
      const { needsRestart, restartContext } = await this.checkContextWindowAndPrepareRestart(topicId, messages)

      // Build message history with proper role detection
      const history: Array<{ role: "system" | "user" | "assistant", content: string }> = []

      if (needsRestart && restartContext) {
        // Use summary-based restart context
        (history as any)?.push({
          role: 'system',
          content: restartContext
        })
        console.log('[AIAssistantModel] Using summary-based restart context')

        // Only include very recent messages (last 3-5) after restart
        const veryRecentMessages = messages.slice(-3)
        for (const msg of veryRecentMessages) {
          const text = (msg as any).data?.text || (msg as any).text
          const msgSender = msg.data?.sender || msg.author
          const isAIRestart: boolean = this.isAIPerson(msgSender)

          if (text && text.trim()) {
            (history as any)?.push({
              role: isAIRestart ? 'assistant' : 'user',
              content: text
            })
          }
        }
      } else {
        // Normal context enrichment flow
        if (this.contextEnrichmentService) {
          try {
            const contextHints = await this.contextEnrichmentService.buildEnhancedContext(topicId, messages)
            if (contextHints) {
              (history as any)?.push({
                role: 'system',
                content: contextHints
              })
              console.log(`[AIAssistantModel] Added context hints: ${String(contextHints).substring(0, 100)}...`)
            }
          } catch (error) {
            console.warn('[AIAssistantModel] Context enrichment failed:', error)
          }
        }

        // Get last 10 messages for context
        const recentMessages = messages.slice(-10)
        for (const msg of recentMessages) {
          const text = (msg as any).data?.text || (msg as any).text
          const msgSender = msg.data?.sender || msg.author
          // Check if sender is AI using our isAIPerson method
          const isAIMessage: boolean = this.isAIPerson(msgSender)

          if (text && text.trim()) {
            (history as any)?.push({
              role: isAIMessage ? 'assistant' : 'user',
              content: text
            })
          }
        }
      }
      
      // Add the new message if not already in history
      const lastHistoryMsg = history[(history as any)?.length - 1]
      if (!lastHistoryMsg || lastHistoryMsg.content !== message) {
        (history as any)?.push({
          role: 'user',
          content: message
        })
      }
      
      console.log(`[AIAssistantModel] Sending ${(history as any)?.length} messages to LLM`)
      
      // Generate message ID for streaming
      const messageId = `ai-${Date.now()}`
      const conversationId = topicId
      let fullResponse = ''
      
      // Send thinking indicator to UI
      const windows = BrowserWindow.getAllWindows()
      for (const window of windows) {
        window.webContents.send('message:thinking', {
          conversationId,
          messageId,
          senderId: aiPersonId,
          isAI: true
        })
      }
      
      // Get AI response with analysis in a single call
      const result: any = await this.llmManager?.chatWithAnalysis(history, modelId, {
        onStream: (chunk: string) => {
          fullResponse += chunk

          // Send streaming updates to UI
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('message:stream', {
              conversationId,
              messageId,
              chunk,
              partial: fullResponse,
              senderId: aiPersonId,
              isAI: true
            })
          }
        }
      }, topicId) // Pass topicId for analysis

      const response = (result as any)?.response
      
      if (response) {
        // Send the response to the topic
        await topicRoom.sendMessage(response as string, aiPersonId)
        console.log(`[AIAssistantModel] Sent AI response to topic ${topicId}`)

        // Notify UI about the complete message
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('message:updated', {
            conversationId,
            message: {
              id: messageId,
              conversationId,
              text: response,
              senderId: aiPersonId,
              isAI: true,
              timestamp: new Date().toISOString(),
              status: 'sent'
            }
          })
        }

        // Debug: Log what we got from chatWithAnalysis
        console.log('[AIAssistantModel] chatWithAnalysis result:', {
          hasResponse: !!(result as any)?.response,
          hasAnalysis: !!(result as any)?.analysis,
          analysisKeys: (result as any)?.analysis ? Object.keys((result as any).analysis) : []
        })

        // Process analysis in background (non-blocking)
        if ((result as any)?.analysis) {
          setImmediate(async () => {
            try {
              console.log('[AIAssistantModel] Processing analysis in background...')

              // Create or update subject FIRST (subjects must exist before keywords can reference them)
              let subjectId: string | null = null;
              if ((result as any)?.analysis.subject && (this.nodeOneCore as any).topicAnalysisModel) {
                const { name, description, isNew } = (result as any)?.analysis.subject
                if (isNew) {
                  // Create subject with keyword combination as the name
                  const keywords = name.split(/[\s-]+/).filter((k: any) => k)
                  const subject = await (this.nodeOneCore as any).topicAnalysisModel.createSubject(
                    topicId,
                    keywords,
                    name,
                    description,
                    0.8 // confidence score
                  )
                  subjectId = subject?.id || null;
                  console.log(`[AIAssistantModel] Created new subject: ${name} with ID: ${subjectId}`)
                } else {
                  // Update existing subject or mark as active
                  const subjects = await (this.nodeOneCore as any).topicAnalysisModel.getSubjects(topicId)
                  const existing = subjects.find((s: any) => s.keywordCombination === name)
                  if (existing) {
                    subjectId = existing.id;
                    if (existing.archived) {
                      await (this.nodeOneCore as any).topicAnalysisModel.unarchiveSubject(topicId, existing.id)
                      console.log(`[AIAssistantModel] Reactivated subject: ${name}`)
                    }
                  }
                }
              }

              // Now create/update keywords WITH subject reference
              if ((result as any)?.analysis.subject?.keywords?.length > 0 && subjectId && (this.nodeOneCore as any).topicAnalysisModel) {
                for (const keyword of (result as any)?.analysis.subject.keywords) {
                  await (this.nodeOneCore as any).topicAnalysisModel.addKeywordToSubject(topicId, keyword, subjectId)
                }
                console.log(`[AIAssistantModel] Added ${(result as any)?.analysis.subject.keywords?.length} keywords linked to subject ${subjectId}`)
              }

              // Process summary update if provided
              if ((result as any)?.analysis.summaryUpdate && (this.nodeOneCore as any).topicAnalysisModel) {
                await (this.nodeOneCore as any).topicAnalysisModel.updateSummary(
                  topicId,
                  (result as any)?.analysis.summaryUpdate,
                  0.8 // confidence score
                )
                console.log(`[AIAssistantModel] Updated summary: ${(String((result as any)?.analysis.summaryUpdate)).substring(0, 50)}...`)
              }
            } catch (error) {
              console.error('[AIAssistantModel] Error processing analysis:', error)
              // Don't throw - this is background processing
            }
          })
        }

        return response
      }
      
      return null
    } catch (error) {
      console.error('[AIAssistantModel] Error processing message:', error)
      return null
    }
  }

  /**
   * Get or create person ID for a model
   */
  async getOrCreatePersonIdForModel(model: any): Promise<any> {
    return await this.ensureAIContactForModel(model.id)
  }

  /**
   * Create an AI contact using standard LeuteModel flow
   * Only adds AI-specific tracking via LLMObjectManager
   */
  async createAIContact(modelId: any, displayName: any): Promise<any> {
    console.log(`[AIAssistantModel] Setting up AI contact for ${displayName} (${modelId})`)
    
    const leuteModel = this.nodeOneCore.leuteModel
    if (!leuteModel) {
      console.error('[AIAssistantModel] LeuteModel not available')
      return null
    }

    // Check cache first
    const cached = (this.aiContacts as any)?.get(modelId)
    if (cached) {
      console.log(`[AIAssistantModel] Using cached contact for ${modelId}: ${cached.toString().substring(0, 8)}...`)
      return cached
    }

    try {
      // Create Person object (ONE.core handles deduplication)
      const email = `${modelId.replace(/[^a-zA-Z0-9]/g, '_')}@ai.local`
      const personData = {
        $type$: 'Person' as const,
        email: email,
        name: displayName
      }
      
      const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
      const result: any = await storeVersionedObject(personData)
      const personIdHashResult = typeof result === 'object' && (result as any)?.idHash ? (result as any)?.idHash : result
      const { ensureIdHash } = await import('@refinio/one.core/lib/util/type-checks.js')
      const personIdHash = ensureIdHash(personIdHashResult)
      console.log(`[AIAssistantModel] Person ID: ${personIdHash.toString().substring(0, 8)}...`)
      
      // Ensure keys exist for this person
      const { createDefaultKeys, hasDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js')
      if (!(await hasDefaultKeys(personIdHash))) {
        await createDefaultKeys(personIdHash)
        console.log(`[AIAssistantModel] Created cryptographic keys`)
      }
      
      // Check if this person is already in contacts
      const others = await leuteModel.others()
      let alreadyInContacts = false
      
      for (const someone of others) {
        try {
          const existingPersonId = await someone.mainIdentity()
          if (existingPersonId.toString() === personIdHash.toString()) {
            alreadyInContacts = true
            console.log(`[AIAssistantModel] AI contact already exists in contacts`)
            break
          }
        } catch (err: any) {
          // Continue checking
        }
      }
      
      // If not in contacts, create Profile and Someone
      if (!alreadyInContacts) {
        
        // Create new Profile and Someone using proper SomeoneModel API
        const ProfileModel = (await import('@refinio/one.models/lib/models/Leute/ProfileModel.js')).default
        const SomeoneModel = (await import('@refinio/one.models/lib/models/Leute/SomeoneModel.js')).default
        const myId = await leuteModel.myMainIdentity()

        const profile = await ProfileModel.constructWithNewProfile(
          personIdHash,
          myId,
          'default'
        )
        
        profile.personDescriptions?.push({
          $type$: 'PersonName',
          name: displayName
        })
        
        await profile.saveAndLoad()
        console.log(`[AIAssistantModel] Created profile: ${profile.idHash.toString().substring(0, 8)}...`)
        
        // Create Someone using storeVersionedObject (idempotent)
        const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
        
        const newSomeone = {
          $type$: 'Someone' as const,
          someoneId: modelId,
          mainProfile: profile.idHash,
          identities: new Map([[personIdHash, new Set([profile.idHash])]])
        }
        
        const result: any = await storeVersionedObject(newSomeone)
        console.log(`[AIAssistantModel] Created/found Someone: ${(result as any)?.idHash.toString().substring(0, 8)}...`)
        
        await leuteModel.addSomeoneElse((result as any)?.idHash)
        console.log(`[AIAssistantModel] Added to contacts: ${(result as any)?.idHash.toString().substring(0, 8)}...`)
      }
      
      // AI-SPECIFIC: Cache the person ID and create proper LLM object via AI assistant
      (this.aiContacts as any)?.set(modelId, personIdHash)

      if (this.llmObjectManager) {
        // AI assistant should create its own LLM objects for AI persons
        try {
          await this.createLLMObjectForAI(modelId, displayName, personIdHash)
          console.log(`[AIAssistantModel] Created LLM object as source of truth for ${displayName}`)
        } catch (error) {
          console.warn(`[AIAssistantModel] Could not create LLM object, falling back to cache:`, (error as Error).message)
          // Fallback to cache-only approach
          this.llmObjectManager.cacheAIPersonId(modelId, personIdHash)
        }
        console.log(`[AIAssistantModel] Registered AI person with LLMObjectManager`)
      }
      
      console.log(`[AIAssistantModel] ✅ AI contact ready: ${personIdHash.toString().substring(0, 8)}...`)
      return personIdHash
      
    } catch (error) {
      console.error('[AIAssistantModel] Failed to create AI contact:', error)
      return null
    }
  }

  /**
   * Create LLM object for AI person - AI assistant manages its own LLM objects
   */
  async createLLMObjectForAI(modelId: any, displayName: any, personIdHash: any): Promise<any> {
    console.log(`[AIAssistantModel] Creating LLM object for AI: ${displayName}`)

    try {
      // Use storeVersionedObject to create LLM object with AI-specific properties
      const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
      const { ensureIdHash } = await import('@refinio/one.core/lib/util/type-checks.js')

      const personIdHashEnsured = ensureIdHash(personIdHash)
      const now = Date.now()
      const nowISOString = new Date().toISOString()

      const llmObject = {
        $type$: 'LLM' as const,
        name: displayName, // This is the ID field according to recipe (isId: true)
        filename: `${displayName.replace(/[\s:]/g, '-').toLowerCase()}.gguf`, // Required field
        modelType: (modelId.startsWith('ollama:') ? 'local' : 'remote') as 'local' | 'remote', // Required field
        active: true, // Required field
        deleted: false, // Required field
        created: now, // Required field (timestamp)
        modified: now, // Required field (timestamp)
        createdAt: nowISOString, // Required field (ISO string)
        lastUsed: nowISOString, // Required field (ISO string)
        // Required LLM fields
        modelId: modelId, // Required field
        // AI-specific fields - personId being set = this is an AI contact
        personId: personIdHashEnsured,
        provider: this.getProviderFromModelId(modelId),
        capabilities: ['chat', 'inference'] as Array<'chat' | 'inference'>, // Must match regexp: chat or inference
        maxTokens: 4096,
        temperature: 0.7,
        contextSize: 4096,
        batchSize: 512,
        threads: 4,
      }

      // Store the LLM object as an ID object (custom recipe)
      const storedObjectResult = await storeVersionedObject(llmObject);
      const resultIdHash = (storedObjectResult as any)?.idHash;
      // console.log(`[AIAssistantModel] Stored AI LLM object with hash: ${resultIdHash || 'unknown'}`)

      // Cache in LLMObjectManager
      (this.llmObjectManager as any)?.llmObjects?.set(modelId, {
        ...llmObject,
        modelId: modelId,
        hash: resultIdHash,
        idHash: resultIdHash
        // personId field marks this as AI's LLM
      })

      return storedObjectResult.idHash
    } catch (error) {
      console.error(`[AIAssistantModel] Failed to create LLM object for AI ${displayName}:`, error)
      throw error
    }
  }

  /**
   * Get provider from model ID (helper for LLM object creation)
   */
  getProviderFromModelId(modelId: any): any {
    if (modelId.startsWith('ollama:')) return 'ollama'
    if (modelId.startsWith('claude:')) return 'claude'
    if (modelId.startsWith('gpt:')) return 'openai'
    return 'unknown'
  }

  /**
   * Get person ID for a model
   */
  getPersonIdForModel(modelId: any): any {
    return (this.aiContacts as any)?.get(modelId) || null
  }

  /**
   * Check if a person ID is an AI person
   */
  isAIPerson(personId: any): any {
    if (!personId) return false
    
    // Check if this person ID is in our AI contacts cache
    for (const [modelId, aiPersonId] of this.aiContacts) {
      if (aiPersonId === personId || (aiPersonId && aiPersonId.toString() === personId.toString())) {
        return true
      }
    }
    
    // Also check with LLMObjectManager if available
    if (this.llmObjectManager) {
      return this.llmObjectManager.isLLMPerson(personId)
    }
    
    return false
  }

  /**
   * Ensure AI contact exists for a specific model
   */
  async ensureAIContactForModel(modelId: any): Promise<any> {
    // Check cache first (populated during initialization from storage)
    const existingContact = this.getPersonIdForModel(modelId)
    if (existingContact) {
      console.log(`[AIAssistantModel] Found AI contact in cache for ${modelId}:`, existingContact)
      return existingContact
    }

    // Find the model details
    const models = this.llmManager?.getAvailableModels()
    const model = models.find((m: any) => m.id === modelId)

    if (!model) {
      console.error(`[AIAssistantModel] Model ${modelId} not found in available models. Available:`, models?.map((m: any) => m.id))
      return null
    }

    console.log(`[AIAssistantModel] Creating new AI contact for ${modelId}`)
    // Create contact (idempotent due to storeVersionedObject)
    const personId = await this.createAIContact(model.id, model.name)

    if (!personId) {
      throw new Error(`Failed to create AI contact for model ${modelId}`)
    }

    return personId
  }

  /**
   * Handle a new topic creation by sending a welcome message
   * Also can be called for existing topics that need a welcome message
   */
  async handleNewTopic(channelId: any, topicRoom: any): Promise<any> {
    const startTime = Date.now()
    console.log(`[AIAssistantModel] 🎯 Handling new topic: ${channelId} at ${new Date().toISOString()}`)

    try {
      // Get the default AI model
      const modelStartTime = Date.now()
      const model = this.getDefaultModel()
      if (!model || !this.defaultModelId) {
        console.log('[AIAssistantModel] No default AI model set, skipping welcome message')
        return
      }

      // For LAMA topic, use private model variant
      let effectiveModel = model
      if (channelId === 'lama') {
        const privateModelId = model.id + '-private'

        // Get the private model from LLM Manager (should have been registered when user selected model)
        const { default: llmManager } = await import('../services/llm-manager.js')
        const privateModel = this.llmManager?.getModel(privateModelId)

        if (privateModel) {
          effectiveModel = privateModel
          console.log(`[AIAssistantModel] Using private model for LAMA: ${effectiveModel.id}`)
        } else {
          console.warn(`[AIAssistantModel] Private model ${privateModelId} not found, using base model`)
          effectiveModel = model
        }
      }

      console.log(`[AIAssistantModel] ⏱️ Model selection took ${Date.now() - modelStartTime}ms`)

      // Register this as an AI topic
      this.registerAITopic(channelId, effectiveModel?.id || effectiveModel.name)

      // Get or create the AI person ID for this model
      const personStartTime = Date.now()
      const aiPersonId = await this.getOrCreatePersonIdForModel(effectiveModel)
      if (!aiPersonId) {
        console.error('[AIAssistantModel] Could not get AI person ID')
        return
      }
      console.log(`[AIAssistantModel] ⏱️ AI person creation took ${Date.now() - personStartTime}ms`)

      // Send thinking indicator to UI
      const { BrowserWindow } = await import('electron')
      const messageId = `ai-${Date.now()}`
      const windows = BrowserWindow.getAllWindows()
      for (const window of windows) {
        window.webContents.send('message:thinking', {
          conversationId: channelId,
          messageId,
          isAI: true
        })
      }

      // Generate welcome message based on channel type
      let welcomeMessage

      console.log(`[AIAssistantModel] Determining welcome message for channelId: "${channelId}" (type: ${typeof channelId})`)

      if (channelId === 'hi') {
        // Static welcome for Hi chat - concise intro message
        console.log(`[AIAssistantModel] Using static Hi welcome message`)
        welcomeMessage = `Hi! I'm LAMA, your local AI assistant.

I run entirely on your device - no cloud, just private, fast AI help.

What can I do for you today?`
      } else if (channelId === 'lama') {
        console.log(`[AIAssistantModel] Using LLM-generated LAMA welcome message`)
        // LLM-generated welcome for LAMA
        const messages = [
          { role: 'system', content: `You are a helpful AI assistant. Generate a brief, friendly welcome message.` },
          { role: 'user', content: `Generate a welcome message for a new chat conversation. Be warm and approachable. Keep it under 2 sentences.` }
        ]

        const llmStartTime = Date.now()
        console.log(`[AIAssistantModel] 📡 Requesting welcome message from ${effectiveModel.id} at ${new Date().toISOString()}`)
        const response = await this.llmManager?.chat(messages, effectiveModel.id)

        // Debug: Log what we actually got back
        console.log(`[AIAssistantModel] 🐛 Raw LLM response type: ${typeof response}`)
        console.log(`[AIAssistantModel] 🐛 Raw LLM response: "${response}"`)

        welcomeMessage = response
        console.log(`[AIAssistantModel] ⏱️ LLM response took ${Date.now() - llmStartTime}ms`)
      } else {
        console.log(`[AIAssistantModel] Using LLM-generated welcome for other chat: "${channelId}"`)
        // For any other chats, use LLM-generated welcome
        const messages = [
          { role: 'system', content: `You are a helpful AI assistant. Generate a brief, friendly welcome message.` },
          { role: 'user', content: `Generate a welcome message for a new chat conversation. Be warm and approachable. Keep it under 2 sentences.` }
        ]

        const llmStartTime = Date.now()
        console.log(`[AIAssistantModel] 📡 Requesting welcome message from ${effectiveModel.id} at ${new Date().toISOString()}`)
        const response = await this.llmManager?.chat(messages, effectiveModel.id)
        welcomeMessage = response
        console.log(`[AIAssistantModel] ⏱️ LLM response took ${Date.now() - llmStartTime}ms`)
      }

      console.log(`[AIAssistantModel] Generated welcome: "${welcomeMessage}"`)
      
      // Send the welcome message to the topic
      const sendStartTime = Date.now()
      await topicRoom.sendMessage(welcomeMessage, aiPersonId)
      console.log(`[AIAssistantModel] ⏱️ Message send took ${Date.now() - sendStartTime}ms`)
      console.log(`[AIAssistantModel] ✅ Welcome message sent to topic ${channelId}`)
      console.log(`[AIAssistantModel] ⏱️ TOTAL handleNewTopic time: ${Date.now() - startTime}ms`)
      
      // Notify UI about the complete message
      for (const window of windows) {
        window.webContents.send('message:updated', { 
          conversationId: channelId,
          message: {
            id: messageId,
            conversationId: channelId,
            text: welcomeMessage,
            senderId: aiPersonId,
            isAI: true,
            timestamp: new Date().toISOString(),
            status: 'sent'
          }
        })
      }
      
    } catch (error) {
      console.error('[AIAssistantModel] Error handling new topic:', error)
    }
  }

  /**
   * Get the default AI model
   */
  getDefaultModel(): any {
    console.log('[AIAssistantModel] 🔍 getDefaultModel called')

    if (!this.defaultModelId) {
      console.log('[AIAssistantModel] No default model selected')
      return null
    }

    if (!this.llmManager) {
      console.warn('[AIAssistantModel] LLMManager not available')
      return null
    }

    const models = this.llmManager?.getAvailableModels()
    const selectedModel = models.find((m: any) => m.id === this.defaultModelId)

    if (selectedModel) {
      console.log(`[AIAssistantModel] Using default model: ${this.defaultModelId}`)
      return selectedModel
    }

    console.warn(`[AIAssistantModel] Default model ${this.defaultModelId} not found in available models`)
    return null
  }

  /**
   * Get model by ID
   */
  getModelById(modelId: any): any {
    if (!this.llmManager || !modelId) return null

    const models = this.llmManager?.getAvailableModels()
    return models.find((m: any) => m.id === modelId) || null
  }

  /**
   * Set the default model and persist the selection
   */
  async setDefaultModel(modelId: any): Promise<any> {
    console.log('[AIAssistantModel] Setting default model:', modelId)

    // Update local state
    this.defaultModelId = modelId

    // Persist to settings
    if (this.aiSettingsManager) {
      await this.aiSettingsManager.setDefaultModelId(modelId)
    }

    // Register private variant for LAMA conversations
    if (this.llmManager) {
      this.llmManager?.registerPrivateVariantForModel(modelId)
    }

    console.log('[AIAssistantModel] Default model set and persisted')
  }

  /**
   * Set up AI contacts for all available models
   */
  async setupAIContacts(models: any): Promise<any> {
    console.log(`[AIAssistantModel] Setting up ${(models as any)?.length} AI contacts...`)
    
    const createdContacts: Array<{ modelId: string, personId: any, name: string }> = []
    
    for (const model of models) {
      try {
        const personId = await this.createAIContact(model.id, model.name)
        if (personId) {
          (createdContacts as any)?.push({
            modelId: model.id,
            personId: personId,
            name: model.name
          })
        }
      } catch (error) {
        console.error(`[AIAssistantModel] Failed to create contact for ${model.name}:`, error)
      }
    }
    
    console.log(`[AIAssistantModel] ✅ Set up ${(createdContacts as any)?.length} AI contacts`)
    return createdContacts
  }

  /**
   * Get all AI contacts that have been set up
   * This is AI-specific tracking, not general contact management
   */
  getAllContacts(): any {
    return Array.from(this.aiContacts.entries()).map(([modelId, contactInfo]) => {
      // If we stored the full contact info, return it
      if (typeof contactInfo === 'object' && contactInfo !== null && (contactInfo as any).personId) {
        return contactInfo
      }
      // Legacy: if we only stored personId
      const models = this.llmManager?.getAvailableModels() || []
      const model = models.find((m: any) => m.id === modelId)
      return {
        modelId,
        personId: contactInfo,
        name: model?.name || modelId
      }
    })
  }

  /**
   * Check if context window is filling up and prepare restart context
   * @param {string} topicId - The topic/conversation ID
   * @param {Array} messages - All messages in the conversation
   * @returns {Object} - { needsRestart: boolean, restartContext: string|null }
   */
  async checkContextWindowAndPrepareRestart(topicId: any, messages: any): Promise<any> {
    // Get the model's context window size
    const modelId = (this.topicModelMap as any)?.get(topicId)
    const model = this.getModelById(modelId)

    // Get context window from model definition, default to conservative 4k
    const contextWindow = model?.contextLength || 4096

    // Reserve 25% for response and system prompts
    const usableContext = Math.floor(contextWindow * 0.75)

    // Estimate token count (rough: 1 token ≈ 4 chars for English)
    const estimatedTokens = messages.reduce((total: any, msg: any) => {
      const text = msg.data?.text || msg.text || ''
      return total + Math.ceil((text as any)?.length / 4)
    }, 0)

    // Add estimated system prompt tokens
    const systemPromptTokens = 200 // Typical system prompt overhead
    const totalTokens = estimatedTokens + systemPromptTokens

    if (totalTokens < usableContext) {
      return { needsRestart: false, restartContext: null }
    }

    console.log(`[AIAssistantModel] Context window filling (${totalTokens}/${contextWindow} tokens for ${model?.name || modelId}), preparing restart`)

    // Generate or retrieve summary for restart
    const restartContext = await this.generateConversationSummaryForRestart(topicId, messages)

    if (restartContext) {
      // Store restart point for potential recovery
      (this.lastRestartPoint as any)?.set(topicId, (messages as any)?.length)
    }

    return { needsRestart: true, restartContext }
  }

  /**
   * Generate a conversation summary suitable for restarting with continuity
   * @param {string} topicId - The topic ID
   * @param {Array} messages - Conversation messages
   * @returns {string} - Summary context for restart
   */
  async generateConversationSummaryForRestart(topicId: any, messages: any): Promise<any> {
    try {
      // First try to use existing Summary objects from TopicAnalysisModel
      if ((this.nodeOneCore as any).topicAnalysisModel) {
        // Get the current summary (already stored as ONE.core object)
        const currentSummary = await (this.nodeOneCore as any).topicAnalysisModel.getCurrentSummary(topicId)

        if (currentSummary && currentSummary.content) {
          // Get subjects and keywords for additional context
          const subjects = await (this.nodeOneCore as any).topicAnalysisModel.getSubjects(topicId)
          const keywords = await (this.nodeOneCore as any).topicAnalysisModel.getKeywords(topicId)

          // Build comprehensive restart context
          let restartContext = `[Conversation Continuation]\n\n`
          restartContext += `Previous Summary:\n${currentSummary.content}\n\n`

          if (subjects && (subjects as any)?.length > 0) {
            const activeSubjects = subjects.filter((s: any) => !s.archived).slice(0, 5)
            if ((activeSubjects as any)?.length > 0) {
              restartContext += `Active Themes:\n`
              activeSubjects.forEach((s: any) => {
                restartContext += `• ${s.keywordCombination}: ${s.description || 'Ongoing discussion'}\n`
              })
              restartContext += '\n'
            }
          }

          if (keywords && (keywords as any)?.length > 0) {
            const topKeywords = keywords
              .sort((a: any, b: any) => (b?.frequency || 0) - (a?.frequency || 0))
              .slice(0, 12)
              .map((k: any) => k.term)
            restartContext += `Key Concepts: ${topKeywords.join(', ')}\n\n`
          }

          restartContext += `Maintain continuity with the established context. The conversation has ${(messages as any)?.length} prior messages.`

          console.log(`[AIAssistantModel] Using existing Summary object (v${currentSummary.version}) for restart`)
          return restartContext
        }

        // If no summary exists yet, trigger analysis to create one
        console.log('[AIAssistantModel] No summary found, triggering topic analysis...')
        const analysis = await (this.nodeOneCore as any).topicAnalysisModel.analyzeMessages(topicId, messages.slice(-50))

        if (analysis && analysis.summary) {
          return this.generateConversationSummaryForRestart(topicId, messages) // Recursive call with new summary
        }
      }

      // Fallback: Create basic summary from messages
      const messageSample = messages.slice(-20) // Last 20 messages
      const topics = new Set()
      const participants = new Set()

      for (const msg of messageSample) {
        const text = msg.data?.text || msg.text || ''
        const sender = (msg.data as any)?.sender || msg.author

        // Extract potential topics (simple keyword extraction)
        const words = text.toLowerCase().split(/\s+/)
        words.filter((w: any) => (w as any)?.length > 5).forEach((w: any) => topics.add(w))

        if (sender && !this.isAIPerson(sender)) {
          participants.add('User')
        }
      }

      const topicList = Array.from(topics).slice(0, 8).join(', ')
      const messageCount = (messages as any)?.length

      return `Continuing conversation #${String(topicId).substring(0, 8)}. Previous ${messageCount} messages discussed: ${topicList}. Maintain context and continuity.`

    } catch (error) {
      console.error('[AIAssistantModel] Failed to generate restart summary:', error)
      return `Continuing previous conversation. Maintain context and natural flow.`
    }
  }

  /**
   * Manually trigger conversation restart with summary
   * Can be called when user explicitly wants to continue with fresh context
   */
  async restartConversationWithSummary(topicId: any): Promise<any> {
    const topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(topicId)
    const messages = await topicRoom.retrieveAllMessages()

    const summary = await this.generateConversationSummaryForRestart(topicId, messages)

    if (summary) {
      console.log(`[AIAssistantModel] Conversation restarted with summary for topic ${topicId}`)

      // Store the summary as metadata for the topic
      this.topicRestartSummaries = this.topicRestartSummaries || new Map()
      this.topicRestartSummaries.set(topicId, {
        summary,
        timestamp: Date.now(),
        messageCountAtRestart: (messages as any)?.length
      })

      return summary
    }

    return null
  }

}

export default AIAssistantModel;