/**
 * LLMManager for Electron - Adapted from React Native implementation
 *
 * Key adaptations for Electron:
 * - Replace Expo FileSystem with Node.js fs operations via Electron IPC
 * - Replace React Native platform checks with Electron environment checks
 * - Keep full LLM management functionality from React Native version
 */
import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';
import { createMessageBus } from '@refinio/one.core/lib/message-bus';
import { chatWithOllama, testOllamaModel } from '../../services/ollama';
import { chatWithClaude, claudeService, CLAUDE_MODELS } from '../../services/claude';
import { MCPManager } from './MCPManager';
// Default settings
const DEFAULT_LLM_SETTINGS = {
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: 'You are a helpful AI assistant.'
};
// Default AI models - using proper LAMA recipe structure
const DEFAULT_MODELS = [
    {
        $type$: 'LLM',
        name: 'qwen3-coder-30b',
        filename: 'qwen3-coder-30b.gguf',
        modelType: 'local',
        active: true,
        deleted: false,
        creator: 'system',
        created: Date.now(),
        modified: Date.now(),
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        size: 30000000000,
        capabilities: ['chat', 'inference'],
        lastInitialized: 0,
        usageCount: 0,
        temperature: 0.1,
        maxTokens: 4096,
        contextSize: 32768,
        // Runtime-only fields
        provider: 'ollama',
        parameters: {
            modelName: 'qwen3-coder:30b'
        }
    },
    {
        $type$: 'LLM',
        $v$: 1,
        id: 'o1-preview',
        name: 'OpenAI o1 Preview',
        description: 'Advanced reasoning model from OpenAI, excellent for complex problem-solving and multi-step reasoning',
        version: 'preview',
        filePath: '',
        size: 0, // API-based
        checksum: 'o1-preview-checksum',
        parameters: {
            provider: 'openai',
            modelType: 'reasoning',
            capabilities: ['reasoning', 'analysis', 'problem-solving'],
            contextLength: 128000,
            temperature: 1.0,
            maxTokens: 65536
        }
    },
    {
        $type$: 'LLM',
        $v$: 1,
        id: 'o1-mini',
        name: 'OpenAI o1 Mini',
        description: 'Faster, more cost-effective reasoning model from OpenAI for coding and STEM tasks',
        version: 'mini',
        filePath: '',
        size: 0, // API-based
        checksum: 'o1-mini-checksum',
        parameters: {
            provider: 'openai',
            modelType: 'reasoning',
            capabilities: ['coding', 'reasoning', 'math'],
            contextLength: 128000,
            temperature: 1.0,
            maxTokens: 65536
        }
    },
    {
        $type$: 'LLM',
        $v$: 1,
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'OpenAI\'s flagship multimodal model with excellent performance across chat, reasoning, and analysis',
        version: '4o',
        filePath: '',
        size: 0, // API-based
        checksum: 'gpt-4o-checksum',
        parameters: {
            provider: 'openai',
            modelType: 'chat',
            capabilities: ['chat', 'reasoning', 'analysis', 'multimodal'],
            contextLength: 128000,
            temperature: 0.7,
            maxTokens: 4096
        }
    },
    {
        $type$: 'LLM',
        $v$: 1,
        id: 'claude-3-5-sonnet',
        name: 'Claude 3.5 Sonnet',
        description: 'Anthropic\'s most capable model, excellent for analysis, writing, and complex reasoning tasks',
        version: '3.5',
        filePath: '',
        size: 0, // API-based
        checksum: 'claude-3-5-sonnet-checksum',
        parameters: {
            provider: 'anthropic',
            modelType: 'chat',
            capabilities: ['analysis', 'writing', 'reasoning', 'coding'],
            contextLength: 200000,
            temperature: 0.7,
            maxTokens: 8192
        }
    },
    {
        $type$: 'LLM',
        $v$: 1,
        id: 'claude-3-5-haiku',
        name: 'Claude 3.5 Haiku',
        description: 'Fast and efficient model from Anthropic, optimized for quick responses and cost-effectiveness',
        version: '3.5',
        filePath: '',
        size: 0, // API-based
        checksum: 'claude-3-5-haiku-checksum',
        parameters: {
            provider: 'anthropic',
            modelType: 'chat',
            capabilities: ['chat', 'analysis', 'writing'],
            contextLength: 200000,
            temperature: 0.7,
            maxTokens: 8192
        }
    }
];
export class LLMManager {
    constructor(leuteModel, channelManager, transportManager) {
        Object.defineProperty(this, "leuteModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: leuteModel
        });
        Object.defineProperty(this, "channelManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: channelManager
        });
        Object.defineProperty(this, "transportManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: transportManager
        });
        Object.defineProperty(this, "onModelsUpdated", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OEvent()
        });
        Object.defineProperty(this, "onModelLoaded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OEvent()
        });
        Object.defineProperty(this, "onModelUnloaded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OEvent()
        });
        Object.defineProperty(this, "onChatResponse", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OEvent()
        });
        Object.defineProperty(this, "onChatStream", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OEvent()
        });
        Object.defineProperty(this, "onError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OEvent()
        });
        Object.defineProperty(this, "models", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "modelSettings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "mcpManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isInitialized", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "messageBus", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "modelStorageChannel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        console.log('[LLMManager] Creating LLM manager...');
        // Note: transportManager is passed but not used in this simplified version
    }
    async init() {
        if (this.isInitialized) {
            console.log('[LLMManager] Already initialized');
            return;
        }
        console.log('[LLMManager] Initializing...');
        try {
            // Initialize message bus for debugging
            this.messageBus = createMessageBus('LLMManager');
            // Create or get model storage channel
            this.modelStorageChannel = await this.getOrCreateModelStorageChannel();
            // Load existing models and settings
            await this.loadModels();
            // Initialize MCP Manager for tool support
            try {
                this.mcpManager = new MCPManager();
                await this.mcpManager.init();
                console.log('[LLMManager] MCP Manager initialized');
            }
            catch (error) {
                console.warn('[LLMManager] MCP Manager initialization failed (non-critical):', error);
                // Continue without MCP support
            }
            this.isInitialized = true;
            console.log('[LLMManager] Initialized successfully');
        }
        catch (error) {
            console.error('[LLMManager] Initialization failed:', error);
            throw error;
        }
    }
    /**
     * Load models from ONE storage
     */
    async loadModels() {
        // Load from localStorage
        await this.loadFromLocalStorage();
        // Ensure default models are available
        await this.ensureDefaultModels();
        console.log(`[LLMManager] Ready with ${this.models.size} models, ${this.modelSettings.size} settings`);
    }
    /**
     * Get or create model storage channel
     */
    async getOrCreateModelStorageChannel() {
        // Return dummy channel ID - storage not implemented yet
        return 'llm-storage-channel';
    }
    /**
     * Save to localStorage
     */
    async saveToLocalStorage() {
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const data = {
                    models: Array.from(this.models.entries()),
                    settings: Array.from(this.modelSettings.entries()),
                    defaultModel: this.defaultModel?.id || null
                };
                window.localStorage.setItem('lama_llm_data', JSON.stringify(data));
                console.log(`[LLMManager] Persisted ${this.models.size} models to localStorage`);
            }
            catch (error) {
                console.error('[LLMManager] Failed to save to localStorage:', error);
            }
        }
    }
    /**
     * Load from localStorage
     */
    async loadFromLocalStorage() {
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const stored = window.localStorage.getItem('lama_llm_data');
                if (stored) {
                    const data = JSON.parse(stored);
                    // Restore models
                    if (data.models) {
                        this.models = new Map(data.models);
                    }
                    // Restore settings
                    if (data.settings) {
                        this.modelSettings = new Map(data.settings);
                    }
                    // Restore default model
                    if (data.defaultModel && this.models.has(data.defaultModel)) {
                        this.defaultModel = this.models.get(data.defaultModel);
                        console.log(`[LLMManager] Restored default model: ${this.defaultModel.id}`);
                    }
                    console.log(`[LLMManager] Loaded ${this.models.size} models, ${this.modelSettings.size} settings from localStorage`);
                }
            }
            catch (error) {
                console.error('[LLMManager] Failed to load from localStorage:', error);
            }
        }
    }
    /**
     * Ensure default models are available
     */
    async ensureDefaultModels() {
        // Register available models
        if (this.models.size === 0) {
            console.log('[LLMManager] Registering available models...');
            // Register Ollama/local models first
            await this.registerOllamaModels();
            // Register Claude models as available
            this.registerClaudeModels();
        }
    }
    /**
     * Register Ollama models including GPT-OSS
     */
    async registerOllamaModels() {
        try {
            // Register GPT-OSS model
            const gptOssModel = {
                $type$: 'LLM',
                $v$: 1,
                id: 'ollama:gpt-oss',
                name: 'GPT-OSS',
                description: 'Local GPT model running via Ollama',
                provider: 'ollama',
                modelType: 'chat',
                capabilities: ['chat', 'completion'],
                contextLength: 8192,
                parameters: {
                    modelName: 'gpt-oss',
                    temperature: 0.7,
                    maxTokens: 2048
                }
            };
            this.models.set(gptOssModel.id, gptOssModel);
            const settings = {
                $type$: 'LLMSettings',
                $v$: 1,
                llmId: gptOssModel.id,
                isLoaded: false,
                isDefault: true, // Set GPT-OSS as default since it's local
                temperature: 0.7,
                maxTokens: 2048,
                systemPrompt: 'You are a helpful assistant.',
                customSettings: {}
            };
            this.modelSettings.set(gptOssModel.id, settings);
            console.log('[LLMManager] Registered GPT-OSS local model');
        }
        catch (error) {
            console.warn('[LLMManager] Failed to register Ollama models:', error);
        }
    }
    /**
     * Register Claude models
     */
    registerClaudeModels() {
        for (const model of CLAUDE_MODELS) {
            const llm = {
                $type$: 'LLM',
                $v$: 1,
                id: `claude:${model.id}`,
                name: model.name,
                description: model.description,
                provider: 'anthropic',
                modelType: 'chat',
                capabilities: model.capabilities,
                contextLength: model.contextWindow,
                parameters: {
                    modelId: model.id,
                    contextWindow: model.contextWindow,
                    maxOutput: model.maxOutput,
                    temperature: 0.7,
                    maxTokens: model.maxOutput
                }
            };
            this.models.set(llm.id, llm);
            // Create default settings (not loaded)
            const settings = {
                $type$: 'LLMSettings',
                $v$: 1,
                llmId: llm.id,
                isLoaded: false,
                isDefault: false,
                temperature: 0.7,
                maxTokens: model.maxOutput,
                systemPrompt: 'You are a helpful AI assistant.',
                customSettings: {}
            };
            this.modelSettings.set(llm.id, settings);
        }
        console.log(`[LLMManager] Registered ${CLAUDE_MODELS.length} Claude models`);
        // Don't set Claude as default if we already have a local model
        if (!this.getDefaultModel()) {
            console.log(`[LLMManager] No default model set, user can select one`);
        }
    }
    /**
     * Get all available models
     */
    getModels() {
        return Array.from(this.models.values());
    }
    /**
     * Get models by capability
     */
    getModelsByCapability(capability) {
        return this.getModels().filter(model => model.capabilities?.includes(capability));
    }
    /**
     * Get best model for a specific task
     */
    getBestModelForTask(task) {
        const models = this.getModels();
        // Task-specific capability mapping
        const taskCapabilities = {
            'coding': ['code', 'code-completion'],
            'reasoning': ['reasoning', 'analysis'],
            'chat': ['chat', 'completion'],
            'analysis': ['analysis', 'reasoning']
        };
        const requiredCapabilities = taskCapabilities[task] || ['chat'];
        // Find models that have the required capabilities
        const suitableModels = models.filter(model => requiredCapabilities.some(cap => model.capabilities?.includes(cap)));
        if (suitableModels.length === 0) {
            return models[0] || null; // Fallback to first available model
        }
        // Prefer loaded models
        const loadedModels = suitableModels.filter(model => {
            const settings = this.modelSettings.get(model.id);
            return settings?.isLoaded;
        });
        if (loadedModels.length > 0) {
            return loadedModels[0];
        }
        return suitableModels[0];
    }
    /**
     * Get model settings
     */
    getModelSettings(modelId) {
        return this.modelSettings.get(modelId);
    }
    /**
     * Get all model settings
     */
    getAllModelSettings() {
        return Array.from(this.modelSettings.values());
    }
    /**
     * Get a specific model by ID
     */
    getModel(id) {
        return this.models.get(id);
    }
    /**
     * Get the default model
     */
    getDefaultModel() {
        // Find model with default settings
        const defaultSettings = Array.from(this.modelSettings.values())
            .find(settings => settings.isDefault);
        if (defaultSettings) {
            return this.models.get(defaultSettings.llmId);
        }
        return undefined;
    }
    /**
     * Set a model as default
     */
    async setDefaultModel(modelId) {
        const model = this.models.get(modelId);
        if (!model) {
            throw new Error(`Model ${modelId} not found`);
        }
        // Clear previous default
        for (const settings of this.modelSettings.values()) {
            if (settings.isDefault) {
                settings.isDefault = false;
                await this.saveModelSettings(settings);
            }
        }
        // Set new default
        let settings = this.modelSettings.get(modelId);
        if (!settings) {
            settings = {
                ...DEFAULT_LLM_SETTINGS,
                $type$: 'LLMSettings',
                $v$: 1,
                llmId: modelId
            };
        }
        settings.isDefault = true;
        await this.saveModelSettings(settings);
        console.log(`[LLMManager] Set default model to ${modelId}`);
        this.onModelsUpdated.emit();
    }
    /**
     * Load a model
     */
    async loadModel(modelId) {
        const model = this.models.get(modelId);
        if (!model) {
            throw new Error(`Model ${modelId} not found`);
        }
        let settings = this.modelSettings.get(modelId);
        if (settings?.isLoaded) {
            console.log(`[LLMManager] Model ${modelId} already loaded`);
            return;
        }
        // Create settings if they don't exist
        if (!settings) {
            settings = {
                ...DEFAULT_LLM_SETTINGS,
                $type$: 'LLMSettings',
                $v$: 1,
                llmId: modelId
            };
        }
        try {
            console.log(`[LLMManager] Loading model ${modelId} (provider: ${model.provider})...`);
            if (model.provider === 'ollama') {
                // Test Ollama model availability
                const modelName = model.parameters?.modelName || modelId.replace('ollama:', '');
                const isAvailable = await testOllamaModel(modelName);
                if (!isAvailable) {
                    throw new Error(`Ollama model ${modelName} is not available or failed to respond`);
                }
                console.log(`[LLMManager] Ollama model ${modelName} is ready`);
            }
            else {
                // For other providers, implement loading logic:
                // 1. Loading local models via separate LLM service
                // 2. Initializing API connections for cloud models
                // 3. Setting up WebSocket connections to local inference servers
                console.log(`[LLMManager] Loading ${model.provider} model (placeholder implementation)`);
            }
            // Mark as loaded
            settings.isLoaded = true;
            await this.saveModelSettings(settings);
            this.onModelLoaded.emit(modelId);
            console.log(`[LLMManager] Model ${modelId} loaded successfully`);
        }
        catch (error) {
            console.error(`[LLMManager] Failed to load model ${modelId}:`, error);
            this.onError.emit(error);
            throw error;
        }
    }
    /**
     * Unload a model
     */
    async unloadModel(modelId) {
        const settings = this.modelSettings.get(modelId);
        if (!settings) {
            throw new Error(`Model settings for ${modelId} not found`);
        }
        if (!settings.isLoaded) {
            console.log(`[LLMManager] Model ${modelId} already unloaded`);
            return;
        }
        try {
            // Unload the actual model
            settings.isLoaded = false;
            await this.saveModelSettings(settings);
            this.onModelUnloaded.emit(modelId);
            console.log(`[LLMManager] Model ${modelId} unloaded`);
        }
        catch (error) {
            console.error(`[LLMManager] Failed to unload model ${modelId}:`, error);
            this.onError.emit(error);
            throw error;
        }
    }
    /**
     * Chat with a model
     */
    async chat(messages, modelId) {
        const model = modelId ? this.models.get(modelId) : this.getDefaultModel();
        if (!model) {
            // This shouldn't happen now that we set a default, but just in case
            const response = 'Hello! I\'m LAMA\'s chat interface. To use AI features, please configure an API key in settings or set up a local model.';
            console.log('[LLMManager] No model available, returning help message');
            this.onChatResponse.emit(response);
            return response;
        }
        const settings = this.modelSettings.get(model.id);
        if (!settings?.isLoaded) {
            await this.loadModel(model.id);
        }
        console.log(`[LLMManager] Chatting with model ${model.id} (provider: ${model.provider})`);
        try {
            let response;
            if (model.provider === 'ollama') {
                // Use Ollama for inference
                const modelName = model.parameters?.modelName || model.id.replace('ollama:', '');
                // Enhance messages with tool descriptions if MCP is available
                const enhancedMessages = this.enhanceMessagesWithTools(messages);
                // Stream response for better UX
                let streamedResponse = '';
                response = await chatWithOllama(modelName, enhancedMessages, {
                    temperature: settings?.temperature || model.parameters?.temperature || 0.7,
                    max_tokens: settings?.maxTokens || model.parameters?.maxTokens || 2048,
                    onStream: (chunk, isThinking) => {
                        streamedResponse += chunk;
                        // Emit streaming events for real-time display
                        this.onChatStream.emit({ chunk, isThinking, partial: streamedResponse });
                    }
                });
                // Check if response contains tool calls and execute them
                response = await this.processToolCalls(response);
            }
            else if (model.provider === 'claude' || model.provider === 'anthropic') {
                // Use Claude for inference
                const modelId = model.parameters?.modelId || model.id.replace('claude:', '');
                // Get API key from settings or environment
                const apiKey = await this.getClaudeApiKey();
                if (!apiKey) {
                    // Return a conversational response
                    const lastMessage = messages[messages.length - 1]?.content || '';
                    response = `I understand you're trying to chat with me! However, I need an API key to use Claude's advanced capabilities. You can add your Anthropic API key in the settings, or you could set up a local model like Ollama for offline use. Your message was: "${lastMessage}"`;
                    console.log('[LLMManager] Claude API key not configured, returning conversational message');
                    this.onChatResponse.emit(response);
                    return response;
                }
                // Initialize Claude service if needed
                if (!claudeService.isInitialized()) {
                    claudeService.initialize({ apiKey });
                }
                // Enhance messages with tool descriptions if MCP is available
                const enhancedMessages = this.enhanceMessagesWithTools(messages);
                response = await chatWithClaude(modelId, enhancedMessages, {
                    temperature: settings?.temperature || model.parameters?.temperature || 0.7,
                    max_tokens: settings?.maxTokens || model.parameters?.maxTokens || 4096
                });
                // Check if response contains tool calls and execute them
                response = await this.processToolCalls(response);
            }
            else {
                // In a full Electron implementation, other providers would:
                // 1. Send messages to local LLM service via IPC
                // 2. Call external APIs for cloud models
                // 3. Use WebSocket to communicate with inference servers
                // For now, return a mock response for unknown providers
                const lastMessage = messages[messages.length - 1]?.content || '';
                response = `[${model.name}] Provider '${model.provider}' is not yet implemented. Message received: "${lastMessage}"`;
            }
            this.onChatResponse.emit(response);
            return response;
        }
        catch (error) {
            console.error(`[LLMManager] Chat failed with model ${model.id}:`, error);
            this.onError.emit(error);
            throw error;
        }
    }
    /**
     * Generate completion
     */
    async complete(prompt, modelId) {
        return this.chat([{ role: 'user', content: prompt }], modelId);
    }
    /**
     * Set MCP Manager for tool integration
     */
    setMCPManager(mcpManager) {
        this.mcpManager = mcpManager;
        console.log('[LLMManager] MCP Manager connected');
    }
    /**
     * Get available tools from MCP
     */
    async getAvailableTools() {
        if (!this.mcpManager) {
            console.warn('[LLMManager] MCP Manager not available');
            return [];
        }
        try {
            const tools = await this.mcpManager.discoverTools();
            return tools;
        }
        catch (error) {
            console.error('[LLMManager] Failed to get MCP tools:', error);
            return [];
        }
    }
    /**
     * Execute a tool via MCP
     */
    async executeTool(toolName, parameters) {
        if (!this.mcpManager) {
            throw new Error('MCP Manager not available');
        }
        try {
            return await this.mcpManager.executeTool(toolName, parameters);
        }
        catch (error) {
            console.error('[LLMManager] Tool execution failed:', error);
            throw error;
        }
    }
    /**
     * Save model settings to storage
     */
    async saveModelSettings(settings) {
        // Store in memory
        this.modelSettings.set(settings.llmId, settings);
        // Persist to localStorage
        await this.saveToLocalStorage();
        console.log(`[LLMManager] Saved settings for model ${settings.llmId}`);
    }
    /**
     * Add a new model
     */
    async addModel(llm) {
        try {
            // Store model locally
            this.models.set(llm.id, llm);
            // Create default settings
            const settings = {
                ...DEFAULT_LLM_SETTINGS,
                $type$: 'LLMSettings',
                $v$: 1,
                llmId: llm.id
            };
            await this.saveModelSettings(settings);
            // Persist models to localStorage
            await this.saveToLocalStorage();
            console.log(`[LLMManager] Added model ${llm.id} (stored locally)`);
            this.onModelsUpdated.emit();
        }
        catch (error) {
            console.warn('[LLMManager] Could not add model:', error);
            // Don't throw - continue without the model
        }
    }
    /**
     * Update model settings
     */
    async updateModelSettings(modelId, updates) {
        let settings = this.modelSettings.get(modelId);
        if (!settings) {
            settings = {
                ...DEFAULT_LLM_SETTINGS,
                $type$: 'LLMSettings',
                $v$: 1,
                llmId: modelId
            };
        }
        // Apply updates
        Object.assign(settings, updates);
        await this.saveModelSettings(settings);
        console.log(`[LLMManager] Updated settings for model ${modelId}`);
    }
    /**
     * Get Claude API key from storage or environment
     */
    async getClaudeApiKey() {
        // First check localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
            const stored = window.localStorage.getItem('claude_api_key');
            if (stored) {
                return stored;
            }
        }
        // Then check environment variable (in Electron)
        if (typeof process !== 'undefined' && process.env.ANTHROPIC_API_KEY) {
            return process.env.ANTHROPIC_API_KEY;
        }
        return null;
    }
    /**
     * Set Claude API key
     */
    async setClaudeApiKey(apiKey) {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('claude_api_key', apiKey);
        }
        // Initialize service with new key
        claudeService.initialize({ apiKey });
        // Mark all Claude models as loaded
        for (const [id, model] of this.models) {
            if (model.provider === 'claude') {
                const settings = this.modelSettings.get(id);
                if (settings) {
                    settings.isLoaded = true;
                    settings.loadedAt = new Date();
                }
            }
        }
        console.log('[LLMManager] Claude API key configured');
    }
    /**
     * Test Claude API key
     */
    async testClaudeApiKey(apiKey) {
        try {
            claudeService.initialize({ apiKey });
            return await claudeService.testConnection();
        }
        catch (error) {
            console.error('[LLMManager] Claude API key test failed:', error);
            return false;
        }
    }
    /**
     * Enhance messages with tool descriptions
     */
    enhanceMessagesWithTools(messages) {
        if (!this.mcpManager || !this.mcpManager.isInitialized()) {
            return messages;
        }
        const toolDescriptions = this.mcpManager.getToolDescriptions();
        if (!toolDescriptions) {
            return messages;
        }
        // Add tool descriptions to the system message
        const enhancedMessages = [...messages];
        const systemMessageIndex = enhancedMessages.findIndex(m => m.role === 'system');
        if (systemMessageIndex >= 0) {
            enhancedMessages[systemMessageIndex] = {
                ...enhancedMessages[systemMessageIndex],
                content: enhancedMessages[systemMessageIndex].content + toolDescriptions
            };
        }
        else {
            // Add a system message if none exists
            enhancedMessages.unshift({
                role: 'system',
                content: 'You are a helpful AI assistant integrated into LAMA, a secure P2P messaging platform.' + toolDescriptions
            });
        }
        return enhancedMessages;
    }
    /**
     * Process tool calls in the response
     */
    async processToolCalls(response) {
        if (!this.mcpManager || !this.mcpManager.isInitialized()) {
            return response;
        }
        // Check if response contains a JSON tool call
        const toolCallMatch = response.match(/```json\s*({[\s\S]*?})\s*```/);
        if (!toolCallMatch) {
            return response;
        }
        try {
            const toolCall = JSON.parse(toolCallMatch[1]);
            if (toolCall.tool && toolCall.parameters) {
                console.log('[LLMManager] Executing tool call:', toolCall);
                const result = await this.mcpManager.executeTool(toolCall.tool, toolCall.parameters);
                // Replace the tool call in the response with the result
                const resultText = `Tool executed: ${toolCall.tool}\nResult: ${JSON.stringify(result, null, 2)}`;
                return response.replace(toolCallMatch[0], resultText);
            }
        }
        catch (error) {
            console.error('[LLMManager] Failed to process tool call:', error);
        }
        return response;
    }
    /**
     * Shutdown the manager
     */
    async shutdown() {
        console.log('[LLMManager] Shutting down...');
        // Shutdown MCP Manager if available
        if (this.mcpManager) {
            try {
                await this.mcpManager.shutdown();
                console.log('[LLMManager] MCP Manager shut down');
            }
            catch (error) {
                console.error('[LLMManager] Error shutting down MCP Manager:', error);
            }
        }
        // Unload all models
        for (const settings of this.modelSettings.values()) {
            if (settings.isLoaded) {
                try {
                    await this.unloadModel(settings.llmId);
                }
                catch (error) {
                    console.error(`[LLMManager] Error unloading model ${settings.llmId}:`, error);
                }
            }
        }
        // Clear caches
        this.models.clear();
        this.modelSettings.clear();
        this.isInitialized = false;
        console.log('[LLMManager] Shutdown complete');
    }
    /**
     * Get loaded models
     */
    getLoadedModels() {
        const loadedModelIds = Array.from(this.modelSettings.values())
            .filter(settings => settings.isLoaded)
            .map(settings => settings.llmId);
        return loadedModelIds
            .map(id => this.models.get(id))
            .filter((model) => model !== undefined);
    }
    /**
     * Check if a model is loaded
     */
    isModelLoaded(modelId) {
        const settings = this.modelSettings.get(modelId);
        return settings?.isLoaded ?? false;
    }
    /**
     * Get model by file path (for local models)
     */
    getModelByFilePath(filePath) {
        return Array.from(this.models.values())
            .find(model => model.filePath === filePath);
    }
    /**
     * Get model provider info
     */
    getModelProvider(modelId) {
        const model = this.models.get(modelId);
        if (!model?.parameters)
            return undefined;
        return {
            provider: model.parameters.provider || 'unknown',
            type: model.parameters.modelType || 'chat'
        };
    }
}
