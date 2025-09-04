/**
 * Claude AI Service
 * Provides integration with Anthropic's Claude API
 */
import Anthropic from '@anthropic-ai/sdk';
// Available Claude models - Updated with latest versions
export const CLAUDE_MODELS = [
    {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        contextWindow: 200000,
        maxOutput: 4096,
        description: 'Most capable model for complex reasoning and analysis',
        capabilities: ['coding', 'analysis', 'creative-writing', 'math', 'vision']
    },
    {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        contextWindow: 200000,
        maxOutput: 4096,
        description: 'Balanced performance and intelligence',
        capabilities: ['coding', 'analysis', 'chat', 'creative-writing']
    },
    {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        contextWindow: 200000,
        maxOutput: 4096,
        description: 'Fast and cost-effective for simple tasks',
        capabilities: ['chat', 'summarization', 'basic-coding']
    },
    // Add Claude 3.5 Sonnet New when it becomes available via API
    // Currently Claude 3.5 Sonnet New (October 2024) might not be available via API yet
    // Check Anthropic's API documentation for the latest model IDs
];
class ClaudeService {
    constructor() {
        Object.defineProperty(this, "client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "config", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
    }
    /**
     * Initialize the Claude service with API credentials
     */
    initialize(config) {
        this.config = config;
        this.client = new Anthropic({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
            maxRetries: config.maxRetries || 2,
            timeout: config.timeout || 60000,
            // Safe in Electron as it's not a public website
            dangerouslyAllowBrowser: true
        });
        console.log('[ClaudeService] Initialized with API key');
    }
    /**
     * Check if the service is initialized
     */
    isInitialized() {
        return !!this.client;
    }
    /**
     * Get available models
     */
    getAvailableModels() {
        return CLAUDE_MODELS;
    }
    /**
     * Test if the API key is valid
     */
    async testConnection() {
        if (!this.client) {
            throw new Error('Claude service not initialized');
        }
        try {
            // Make a minimal API call to test the connection
            await this.client.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'Hi' }]
            });
            return true;
        }
        catch (error) {
            console.error('[ClaudeService] Connection test failed:', error);
            return false;
        }
    }
    /**
     * Chat with Claude
     */
    async chat(modelId, messages, options) {
        if (!this.client) {
            throw new Error('Claude service not initialized');
        }
        // Convert messages to Anthropic format
        const anthropicMessages = messages
            .filter(m => m.role !== 'system') // System message is handled separately
            .map(m => ({
            role: m.role,
            content: m.content
        }));
        // Extract system message if present
        const systemMessage = messages.find(m => m.role === 'system')?.content || options?.system;
        try {
            const response = await this.client.messages.create({
                model: modelId,
                max_tokens: options?.max_tokens || 4096,
                temperature: options?.temperature || 0.7,
                system: systemMessage,
                messages: anthropicMessages,
                tools: options?.tools
            });
            // Extract text from response
            const textContent = response.content
                .filter(block => block.type === 'text')
                .map(block => block.text)
                .join('\n');
            return textContent;
        }
        catch (error) {
            console.error('[ClaudeService] Chat failed:', error);
            throw error;
        }
    }
    /**
     * Stream chat with Claude
     */
    async *streamChat(modelId, messages, options) {
        if (!this.client) {
            throw new Error('Claude service not initialized');
        }
        const anthropicMessages = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
            role: m.role,
            content: m.content
        }));
        const systemMessage = messages.find(m => m.role === 'system')?.content || options?.system;
        try {
            const stream = await this.client.messages.create({
                model: modelId,
                max_tokens: options?.max_tokens || 4096,
                temperature: options?.temperature || 0.7,
                system: systemMessage,
                messages: anthropicMessages,
                tools: options?.tools,
                stream: true
            });
            for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                    yield event.delta.text;
                }
            }
        }
        catch (error) {
            console.error('[ClaudeService] Stream chat failed:', error);
            throw error;
        }
    }
    /**
     * Get or set the API key
     */
    getApiKey() {
        return this.config?.apiKey;
    }
    setApiKey(apiKey) {
        if (this.config) {
            this.config.apiKey = apiKey;
            this.initialize(this.config);
        }
        else {
            this.initialize({ apiKey });
        }
    }
    /**
     * Clear the service
     */
    clear() {
        this.client = undefined;
        this.config = undefined;
    }
}
// Export singleton instance
export const claudeService = new ClaudeService();
// Helper functions for direct use
export async function chatWithClaude(modelId, messages, options) {
    // Initialize with API key if provided
    if (options?.apiKey && !claudeService.isInitialized()) {
        claudeService.initialize({ apiKey: options.apiKey });
    }
    if (!claudeService.isInitialized()) {
        throw new Error('Claude service not initialized. Please provide an API key.');
    }
    return claudeService.chat(modelId, messages, options);
}
export async function testClaudeConnection(apiKey) {
    claudeService.initialize({ apiKey });
    return claudeService.testConnection();
}
