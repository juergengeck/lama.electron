/**
 * AI/LLM IPC Handlers
 * Handles all AI-related IPC calls from renderer
 */
import llmManager from '../../services/llm-manager.js';
import stateManager from '../../state/manager.js';
import nodeOneCore from '../../core/node-one-core.js';
const aiHandlers = {
    async chat(event, { messages, modelId, stream = false }) {
        console.log('[AIHandler] Chat request with', messages.length, 'messages, streaming:', stream);
        try {
            // Ensure LLM manager is initialized
            if (!llmManager.isInitialized) {
                await llmManager.init();
            }
            if (stream) {
                // Streaming mode - send chunks via IPC events
                let fullResponse = '';
                const response = await llmManager.chat(messages, modelId, {
                    onStream: (chunk) => {
                        fullResponse += chunk;
                        // Send streaming chunk to renderer
                        event.sender.send('ai:stream-chunk', {
                            chunk,
                            partial: fullResponse
                        });
                    }
                });
                // Send final complete message
                event.sender.send('ai:stream-complete', {
                    response,
                    modelId: modelId || llmManager.defaultModelId
                });
                return {
                    success: true,
                    data: {
                        response,
                        modelId: modelId || llmManager.defaultModelId,
                        streamed: true
                    }
                };
            }
            else {
                // Non-streaming mode - wait for full response
                const response = await llmManager.chat(messages, modelId);
                console.log('[AIHandler] Got response:', response?.substring(0, 100) + '...');
                const result = {
                    success: true,
                    data: {
                        response,
                        modelId: modelId || llmManager.defaultModelId
                    }
                };
                console.log('[AIHandler] Returning result:', result.success, 'with response length:', response?.length);
                return result;
            }
        }
        catch (error) {
            console.error('[AIHandler] Chat error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    async getModels(event) {
        console.log('[AIHandler] Get models request');
        try {
            if (!llmManager.isInitialized) {
                await llmManager.init();
            }
            const models = llmManager.getModels();
            // Get default model from AI Assistant Model which is the single source of truth
            const defaultModel = nodeOneCore?.aiAssistantModel?.getDefaultModel();
            return {
                success: true,
                data: {
                    models,
                    defaultModelId: defaultModel?.id || null
                }
            };
        }
        catch (error) {
            console.error('[AIHandler] Get models error:', error);
            return {
                success: false,
                error: error.message,
                data: {
                    models: [],
                    defaultModelId: null
                }
            };
        }
    },
    async setDefaultModel(event, { modelId }) {
        console.log('[AIHandler] ==========================================');
        console.log('[AIHandler] SET DEFAULT MODEL CALLED');
        console.log('[AIHandler] Model ID:', modelId);
        console.log('[AIHandler] ==========================================');
        // Chat creation moved to ensureDefaultChats handler
        try {
            if (!llmManager.isInitialized) {
                await llmManager.init();
            }
            const model = llmManager.getModel(modelId);
            if (!model) {
                throw new Error(`Model ${modelId} not found`);
            }
            // AI Assistant is the single source of truth for default model
            console.log('[AIHandler] Creating AI contact for newly selected model:', modelId);
            await nodeOneCore.aiAssistantModel.createAIContact(modelId, model.name);
            // Set default model through AI Assistant
            await nodeOneCore.aiAssistantModel.setDefaultModel(modelId);
            // Don't create chats here - wait for user to navigate to chat view
            console.log('[AIHandler] Model set successfully, chats will be created when accessed');
            // Notify all windows that the model has changed
            const { BrowserWindow } = await import('electron');
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('ai:defaultModelChanged', { modelId, modelName: model.name });
            });
            return {
                success: true,
                modelId,
                modelName: model.name
            };
        }
        catch (error) {
            console.error('[AIHandler] Set default model error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    async setApiKey(event, { provider, apiKey }) {
        console.log('[AIHandler] Set API key for:', provider);
        try {
            if (!llmManager.isInitialized) {
                await llmManager.init();
            }
            await llmManager.setApiKey(provider, apiKey);
            // Store securely (implement proper encryption)
            stateManager.setState(`ai.apiKeys.${provider}`, apiKey);
            return {
                success: true,
                data: { provider }
            };
        }
        catch (error) {
            console.error('[AIHandler] Set API key error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    async getTools(event) {
        console.log('[AIHandler] Get MCP tools request');
        try {
            if (!llmManager.isInitialized) {
                await llmManager.init();
            }
            const tools = Array.from(llmManager.mcpTools.values());
            return {
                success: true,
                data: {
                    tools,
                    count: tools.length
                }
            };
        }
        catch (error) {
            console.error('[AIHandler] Get tools error:', error);
            return {
                success: false,
                error: error.message,
                data: {
                    tools: [],
                    count: 0
                }
            };
        }
    },
    async executeTool(event, { toolName, parameters }) {
        console.log('[AIHandler] Execute tool:', toolName);
        try {
            if (!llmManager.isInitialized) {
                await llmManager.init();
            }
            // Use mcpManager through llmManager
            const { default: mcpManager } = await import('../../services/mcp-manager.js');
            const result = await mcpManager.executeTool(toolName, parameters);
            return {
                success: true,
                data: result
            };
        }
        catch (error) {
            console.error('[AIHandler] Tool execution error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    async initializeLLM(event) {
        console.log('[AIHandler] Initialize LLM request');
        try {
            if (llmManager.isInitialized) {
                return {
                    success: true,
                    data: {
                        initialized: true,
                        modelCount: llmManager.models.size,
                        toolCount: llmManager.mcpTools.size
                    }
                };
            }
            await llmManager.init();
            return {
                success: true,
                data: {
                    initialized: true,
                    modelCount: llmManager.models.size,
                    toolCount: llmManager.mcpTools.size
                }
            };
        }
        catch (error) {
            console.error('[AIHandler] Initialize error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    async debugTools(event) {
        console.log('[AIHandler] Debug tools request');
        try {
            const debugInfo = llmManager.debugToolsState();
            return {
                success: true,
                data: debugInfo
            };
        }
        catch (error) {
            console.error('[AIHandler] Debug tools error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    async getOrCreateContact(event, { modelId }) {
        console.log('[AIHandler] Get or create AI contact for model:', modelId);
        try {
            // Get the node instance
            const { default: nodeProvisioning } = await import('../../services/node-provisioning.js');
            const nodeOneCore = nodeProvisioning.getNodeInstance();
            if (!nodeOneCore || !nodeOneCore.aiAssistantModel) {
                throw new Error('AI system not initialized');
            }
            // Ensure the AI contact exists for this model
            const personId = await nodeOneCore.aiAssistantModel.ensureAIContactForModel(modelId);
            if (!personId) {
                throw new Error(`Failed to create AI contact for model ${modelId}`);
            }
            return {
                success: true,
                data: {
                    personId: personId.toString(),
                    modelId
                }
            };
        }
        catch (error) {
            console.error('[AIHandler] Get/create AI contact error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    /**
     * Test an API key with the provider
     */
    async testApiKey(event, { provider, apiKey }) {
        console.log(`[AIHandler] Testing ${provider} API key`);
        try {
            if (!llmManager.isInitialized) {
                await llmManager.init();
            }
            // Test the API key based on provider
            let isValid = false;
            if (provider === 'anthropic') {
                // Test Claude API key
                isValid = await llmManager.testClaudeApiKey(apiKey);
            }
            else if (provider === 'openai') {
                // Test OpenAI API key
                isValid = await llmManager.testOpenAIApiKey(apiKey);
            }
            else {
                throw new Error(`Unknown provider: ${provider}`);
            }
            return {
                success: isValid,
                data: { valid: isValid }
            };
        }
        catch (error) {
            console.error('[AIHandler] Test API key error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    /**
     * Get the default model ID from AI settings
     */
    'ai:getDefaultModel': async (event) => {
        try {
            // Use the imported nodeOneCore instance
            if (!nodeOneCore?.aiAssistantModel) {
                console.log('[AIHandler] AI assistant model not available');
                return null;
            }
            // Use the new async method that loads from settings if needed
            const modelId = await nodeOneCore.aiAssistantModel.getDefaultModelId();
            console.log('[AIHandler] Default model ID:', modelId);
            return modelId;
        }
        catch (error) {
            console.error('[AIHandler] Error getting default model:', error);
            return null;
        }
    },
    /**
     * Ensure default AI chats exist when user navigates to chat view
     * This is called lazily when the chat view is accessed, not during model selection
     */
    'ai:ensureDefaultChats': async (event) => {
        try {
            // Use the imported nodeOneCore instance
            if (!nodeOneCore?.initialized) {
                console.log('[AIHandler] Node not initialized');
                return { success: false, error: 'Node not initialized' };
            }
            // Get the default model ID (async method that loads from settings if needed)
            const modelId = await nodeOneCore.aiAssistantModel.getDefaultModelId();
            if (!modelId) {
                console.log('[AIHandler] No default model set');
                return { success: false, error: 'No default model set' };
            }

            // Ensure AI contact exists for this model (idempotent)
            // AI Assistant Model is the source of truth for AI contacts
            console.log('[AIHandler] Ensuring AI contact exists for model:', modelId);
            const aiParticipantId = await nodeOneCore.aiAssistantModel.ensureAIContactForModel(modelId);
            if (!aiParticipantId) {
                console.error('[AIHandler] Failed to ensure AI contact for model:', modelId);
                return {
                    success: false,
                    error: 'Failed to create AI contact for model: ' + modelId
                };
            }
            console.log('[AIHandler] AI participant ID:', String(aiParticipantId).substring(0, 8));
            // Helper function to ensure topic exists with proper participants
            const ensureTopicWithParticipants = async (name, topicId, participants) => {
                let isNewTopic = false;
                try {
                    const existing = await nodeOneCore.topicModel.topics.queryById(topicId);
                    if (existing) {
                        console.log(`[AIHandler] ${name} topic already exists`);
                        // Check if topic has messages
                        console.log(`[AIHandler] Entering topic room for ${name} (${topicId}) to check messages...`);
                        const topicRoom = await nodeOneCore.topicModel.enterTopicRoom(topicId);
                        console.log(`[AIHandler] Retrieving all messages for ${name}...`);
                        const messages = await topicRoom.retrieveAllMessages();
                        console.log(`[AIHandler] Found ${messages.length} messages in ${name} topic`);
                        if (messages.length === 0) {
                            console.log(`[AIHandler] ${name} topic exists but is empty, will send welcome`);
                            // For Hi topic, return 'empty' to indicate it needs static welcome
                            // For LAMA topic, return true for AI welcome
                            return topicId === 'hi' ? 'empty' : true;
                        }
                        console.log(`[AIHandler] ${name} topic has ${messages.length} messages, no welcome needed`);
                        return false; // Has messages, no welcome needed
                    }
                }
                catch (e) {
                    // Topic doesn't exist, create it
                    isNewTopic = true;
                }
                console.log(`[AIHandler] Creating ${name} topic with AI participant`);
                await nodeOneCore.topicGroupManager.createGroupTopic(name, topicId, participants);
                console.log(`[AIHandler] ${name} topic created with AI participant`);
                // For Hi topic, we need to track if it was newly created for static message
                if (topicId === 'hi') {
                    return 'new'; // Always return 'new' when we just created it
                }
                return true; // LAMA new topic needs welcome
            };
            // Create/ensure Hi chat
            const hiNeedsWelcome = await ensureTopicWithParticipants('Hi', 'hi', [aiParticipantId]);
            // Create/ensure LAMA chat
            const lamaNeedsWelcome = await ensureTopicWithParticipants('LAMA', 'lama', [aiParticipantId]);
            // Send Hi welcome immediately if needed (static, no LLM required)
            if (hiNeedsWelcome === 'new' || hiNeedsWelcome === 'empty') {
                try {
                    console.log(`[AIHandler] Sending static welcome message to Hi chat (${hiNeedsWelcome})`);
                    const hiTopicRoom = await nodeOneCore.topicModel.enterTopicRoom('hi');
                    // Register Hi as an AI topic so it can respond to messages
                    nodeOneCore.aiAssistantModel.registerAITopic('hi', modelId);
                    console.log('[AIHandler] Registered Hi as an AI topic with model:', modelId);
                    // Send static welcome message immediately (not LLM-generated)
                    const staticWelcome = `Hi! I'm LAMA, your local AI assistant.

You can make me your own, give me a name of your choice, give me a persistent identity.

We treat LLM as first-class citizens - they're communication peers just like people - and I will manage their learnings for you.
You can immediately start using the app right here in this chat, or create new conversations with LLM or your friends and other contacts.

The LAMA chat below is my memory. You can configure its visibility in Settings. All I learn from your conversations gets stored there for context, and is fully transparent for you. Nobody else can see this content.

You can also access, share, or delete what I know in Settings, in the Data section.

What can I help you with today?`;
                    // Send message with AI participant as sender
                    await hiTopicRoom.sendMessage(staticWelcome, aiParticipantId);
                    console.log('[AIHandler] Static Hi welcome sent immediately');
                    // Verify the message was sent
                    const hiMessages = await hiTopicRoom.retrieveAllMessages();
                    console.log(`[AIHandler] After sending welcome, Hi chat has ${hiMessages.length} messages`);
                }
                catch (error) {
                    console.error('[AIHandler] Failed to send Hi welcome:', error);
                }
            }
            else if (hiNeedsWelcome === false) {
                // Hi topic exists with messages, but ensure it's registered as an AI topic
                console.log('[AIHandler] Hi topic exists with messages, ensuring AI registration');
                nodeOneCore.aiAssistantModel.registerAITopic('hi', modelId);
            }
            // Generate LAMA welcome asynchronously (requires LLM)
            let lamaWelcomePromise = null;
            if (lamaNeedsWelcome) {
                // Send thinking indicator immediately for LAMA chat
                const { BrowserWindow } = await import('electron');
                const windows = BrowserWindow.getAllWindows();
                const lamaMessageId = `ai-lama-welcome-${Date.now()}`;
                console.log('[AIHandler] Sending thinking indicator for LAMA welcome');
                for (const window of windows) {
                    window.webContents.send('message:thinking', {
                        conversationId: 'lama',
                        messageId: lamaMessageId,
                        isAI: true
                    });
                }
                // Pre-warm LLM connection for LAMA welcome
                console.log('[AIHandler] Pre-warming LLM connection for LAMA welcome...');
                lamaWelcomePromise = (async () => {
                    try {
                        await llmManager.preWarmConnection();
                        console.log('[AIHandler] Generating AI welcome message for LAMA chat');
                        const lamaTopicRoom = await nodeOneCore.topicModel.enterTopicRoom('lama');
                        nodeOneCore.aiAssistantModel.registerAITopic('lama', modelId);
                        // handleNewTopic will send its own thinking event, but that's OK - it will update the existing one
                        await nodeOneCore.aiAssistantModel.handleNewTopic('lama', lamaTopicRoom);
                        // Verify the message was sent
                        const lamaMessages = await lamaTopicRoom.retrieveAllMessages();
                        console.log(`[AIHandler] After sending welcome, LAMA chat has ${lamaMessages.length} messages`);
                        return true;
                    }
                    catch (error) {
                        console.error('[AIHandler] Failed to send LAMA welcome:', error);
                        // Send error/complete event to remove spinner
                        for (const window of windows) {
                            window.webContents.send('message:updated', {
                                conversationId: 'lama',
                                error: true
                            });
                        }
                        return false;
                    }
                })();
                // Don't await here - let it run in parallel
                console.log('[AIHandler] LAMA welcome generation started in background with spinner');
            }
            // Return immediately with Hi chat ready, LAMA will complete in background
            const result = {
                success: true,
                topics: {
                    hi: 'hi',
                    lama: 'lama'
                },
                created: {
                    hi: hiNeedsWelcome === 'new',
                    lama: lamaNeedsWelcome
                }
            };
            // If we started LAMA welcome generation, optionally wait for it
            // But we can return immediately since Hi is ready
            if (lamaWelcomePromise) {
                // Fire and forget - LAMA welcome will complete in background
                lamaWelcomePromise.then(success => {
                    if (success) {
                        console.log('[AIHandler] LAMA welcome completed successfully in background');
                    }
                }).catch(err => {
                    console.error('[AIHandler] LAMA welcome background error:', err);
                });
            }
            return result;
        }
        catch (error) {
            console.error('[AIHandler] Ensure default chats error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};
export default aiHandlers;
