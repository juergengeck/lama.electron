/**
 * AIAssistantModel for Electron - AI Assistant Integration
 *
 * Simplified version of the React Native AIAssistantModel
 * Manages AI assistant functionality within topics/channels
 */
import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';
import { hasDefaultKeys, createDefaultKeys } from '@refinio/one.core/lib/keychain/keychain.js';
import { createKeyPair } from '@refinio/one.core/lib/crypto/encryption.js';
import { createSignKeyPair } from '@refinio/one.core/lib/crypto/sign.js';
export class AIAssistantModel {
    constructor(leuteModel, topicModel, llmManager, ownerId) {
        Object.defineProperty(this, "leuteModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: leuteModel
        });
        Object.defineProperty(this, "topicModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: topicModel
        });
        Object.defineProperty(this, "llmManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: llmManager
        });
        Object.defineProperty(this, "ownerId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ownerId
        });
        Object.defineProperty(this, "onResponse", {
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
        Object.defineProperty(this, "onConfigUpdated", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OEvent()
        });
        Object.defineProperty(this, "config", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                name: 'AI Assistant',
                description: 'Local AI assistant for LAMA',
                systemPrompt: 'You are a helpful AI assistant integrated into LAMA, a secure P2P messaging platform.',
                defaultModel: 'gpt-3.5-turbo',
                autoRespond: false,
                enabledTopics: []
            }
        });
        Object.defineProperty(this, "contexts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "isActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "messageListeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        console.log('[AIAssistantModel] Creating AI assistant...');
    }
    async init() {
        console.log('[AIAssistantModel] Initializing...');
        try {
            // Load configuration
            await this.loadConfig();
            // Set up topic message listeners
            this.setupMessageListeners();
            console.log('[AIAssistantModel] Initialized successfully');
        }
        catch (error) {
            console.error('[AIAssistantModel] Initialization failed:', error);
            throw error;
        }
    }
    /**
     * Load configuration from storage
     */
    async loadConfig() {
        try {
            // In a full implementation, load from ONE storage
            // For now, use defaults
            console.log('[AIAssistantModel] Using default configuration');
        }
        catch (error) {
            console.warn('[AIAssistantModel] Failed to load config, using defaults:', error);
        }
    }
    /**
     * Set up message listeners for AI-enabled topics
     */
    setupMessageListeners() {
        // Listen for new topic events if available
        if (this.topicModel.onNewTopicEvent) {
            this.topicModel.onNewTopicEvent.listen(() => {
                // Handle new topics being created
                console.log('[AIAssistantModel] New topic event received');
            });
        }
        else {
            console.log('[AIAssistantModel] Topic events not available, skipping listener setup');
        }
    }
    /**
     * Start the AI assistant
     */
    async start() {
        if (this.isActive) {
            console.log('[AIAssistantModel] Already active');
            return;
        }
        console.log('[AIAssistantModel] Starting AI assistant...');
        this.isActive = true;
        // Initialize contexts for enabled topics
        for (const topicId of this.config.enabledTopics) {
            await this.initializeTopicContext(topicId);
        }
        console.log('[AIAssistantModel] AI assistant started');
    }
    /**
     * Stop the AI assistant
     */
    async stop() {
        if (!this.isActive) {
            console.log('[AIAssistantModel] Already inactive');
            return;
        }
        console.log('[AIAssistantModel] Stopping AI assistant...');
        this.isActive = false;
        // Clear contexts
        this.contexts.clear();
        console.log('[AIAssistantModel] AI assistant stopped');
    }
    /**
     * Enable AI for a specific topic
     */
    async enableForTopic(topicId) {
        if (!this.config.enabledTopics.includes(topicId)) {
            this.config.enabledTopics.push(topicId);
            await this.saveConfig();
        }
        if (this.isActive) {
            await this.initializeTopicContext(topicId);
        }
        console.log(`[AIAssistantModel] Enabled for topic ${topicId}`);
        this.onConfigUpdated.emit();
    }
    /**
     * Disable AI for a specific topic
     */
    async disableForTopic(topicId) {
        const index = this.config.enabledTopics.indexOf(topicId);
        if (index > -1) {
            this.config.enabledTopics.splice(index, 1);
            await this.saveConfig();
        }
        this.contexts.delete(topicId);
        console.log(`[AIAssistantModel] Disabled for topic ${topicId}`);
        this.onConfigUpdated.emit();
    }
    /**
     * Check if AI is enabled for a topic
     */
    isTopicEnabled(topicId) {
        return this.config.enabledTopics.includes(topicId);
    }
    /**
     * Initialize context for a topic
     */
    async initializeTopicContext(topicId) {
        try {
            // For now, use mock messages since we need to implement proper TopicRoom message querying
            const messages = [];
            const recentMessages = messages.slice(-10); // Keep last 10 messages
            const context = {
                topicId,
                participants: [], // Would get from topic participants
                messageHistory: recentMessages.map(msg => ({
                    role: msg.author === this.ownerId ? 'user' : 'assistant',
                    content: msg.content,
                    timestamp: new Date(msg.timestamp)
                })),
                lastActivity: new Date()
            };
            this.contexts.set(topicId, context);
            console.log(`[AIAssistantModel] Initialized context for topic ${topicId}`);
        }
        catch (error) {
            console.error(`[AIAssistantModel] Failed to initialize context for topic ${topicId}:`, error);
        }
    }
    /**
     * Handle new message in a topic
     */
    async handleNewMessage(topicId) {
        if (!this.config.autoRespond) {
            return;
        }
        try {
            const context = this.contexts.get(topicId);
            if (!context) {
                await this.initializeTopicContext(topicId);
                return;
            }
            // Get messages from TopicRoom (simplified for now)
            const messages = [];
            const latestMessage = messages[messages.length - 1];
            if (!latestMessage || latestMessage.author === this.ownerId) {
                return; // Don't respond to own messages
            }
            // Update context
            context.messageHistory.push({
                role: 'user',
                content: latestMessage.content,
                timestamp: new Date(latestMessage.timestamp)
            });
            context.lastActivity = new Date();
            // Generate response
            await this.generateResponse(topicId);
        }
        catch (error) {
            console.error(`[AIAssistantModel] Error handling message in topic ${topicId}:`, error);
            this.onError.emit(error);
        }
    }
    /**
     * Generate AI response for a topic
     */
    async generateResponse(topicId) {
        const context = this.contexts.get(topicId);
        if (!context) {
            throw new Error(`No context found for topic ${topicId}`);
        }
        try {
            // Prepare messages for LLM
            const systemMessage = {
                role: 'system',
                content: this.config.systemPrompt
            };
            const messages = [systemMessage, ...context.messageHistory.slice(-5)]; // Last 5 messages
            // Generate response
            const response = await this.llmManager.chat(messages, this.config.defaultModel);
            // Send response to topic via TopicRoom with AI persona as author
            const topicRoom = await this.topicModel.enterTopicRoom(topicId);
            // Generate AI persona ID for this assistant
            const aiPersonId = await this.getAIPersonId();
            // Send message with correct signature: (message, author, channelOwner)
            // Use the owner ID as channel owner
            await topicRoom.sendMessage(response, aiPersonId, this.ownerId);
            // Update context
            context.messageHistory.push({
                role: 'assistant',
                content: response,
                timestamp: new Date()
            });
            console.log(`[AIAssistantModel] Generated response for topic ${topicId}`);
            this.onResponse.emit(topicId, response);
        }
        catch (error) {
            console.error(`[AIAssistantModel] Failed to generate response for topic ${topicId}:`, error);
            this.onError.emit(error);
        }
    }
    /**
     * Get available models from LLMManager
     */
    getAvailableModels() {
        return this.llmManager.getModels();
    }
    /**
     * Get LLMManager instance
     */
    getLLMManager() {
        return this.llmManager;
    }
    /**
     * Manually trigger AI response
     */
    async respondToTopic(topicId, userMessage) {
        if (!this.isTopicEnabled(topicId)) {
            throw new Error(`AI not enabled for topic ${topicId}`);
        }
        if (userMessage) {
            // Send user message first via TopicRoom
            const topicRoom = await this.topicModel.enterTopicRoom(topicId);
            await topicRoom.sendMessage(userMessage);
        }
        await this.generateResponse(topicId);
    }
    /**
     * Update configuration
     */
    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        await this.saveConfig();
        this.onConfigUpdated.emit();
        console.log('[AIAssistantModel] Configuration updated');
    }
    /**
     * Save configuration to storage
     */
    async saveConfig() {
        try {
            // In a full implementation, save to ONE storage
            console.log('[AIAssistantModel] Configuration saved');
        }
        catch (error) {
            console.error('[AIAssistantModel] Failed to save configuration:', error);
        }
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get context for a topic
     */
    getTopicContext(topicId) {
        return this.contexts.get(topicId);
    }
    /**
     * Get all enabled topics
     */
    getEnabledTopics() {
        return [...this.config.enabledTopics];
    }
    /**
     * Check if assistant is active
     */
    isRunning() {
        return this.isActive;
    }
    /**
     * Shutdown the assistant
     */
    async shutdown() {
        await this.stop();
        // Clear all listeners
        this.messageListeners.clear();
        console.log('[AIAssistantModel] Shutdown complete');
    }
    /**
     * Get or create AI Person ID for this assistant
     */
    async getAIPersonId() {
        // Use deterministic ID based on assistant name
        const aiName = this.config.name.toLowerCase().replace(/\s+/g, '-');
        // Use browser's crypto API for deterministic hash generation
        const encoder = new TextEncoder();
        const data = encoder.encode(`ai-${aiName}`);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        // Ensure this AI ID has default keys
        const hasKeys = await hasDefaultKeys(hashHex);
        if (!hasKeys) {
            const encryptionKeyPair = createKeyPair();
            const signKeyPair = createSignKeyPair();
            await createDefaultKeys(hashHex, encryptionKeyPair, signKeyPair);
        }
        return hashHex;
    }
}
