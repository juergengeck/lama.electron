/**
 * LAMA Application MCP Server
 * Provides access to LAMA-specific features like chat, contacts, connections, etc.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
export class LamaMCPServer {
    constructor() {
        Object.defineProperty(this, "server", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "appModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Will be injected
        this.server = new Server({
            name: 'lama-app',
            version: '1.0.0'
        }, {
            capabilities: {
                tools: {}
            }
        });
        this.setupTools();
    }
    setAppModel(appModel) {
        this.appModel = appModel;
    }
    setupTools() {
        this.server.setRequestHandler('tools/list', async () => ({
            tools: [
                // Chat Tools
                {
                    name: 'send_message',
                    description: 'Send a message in a chat topic',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            topicId: {
                                type: 'string',
                                description: 'The topic/chat ID to send message to'
                            },
                            message: {
                                type: 'string',
                                description: 'The message content to send'
                            }
                        },
                        required: ['topicId', 'message']
                    }
                },
                {
                    name: 'get_messages',
                    description: 'Get messages from a chat topic',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            topicId: {
                                type: 'string',
                                description: 'The topic/chat ID to get messages from'
                            },
                            limit: {
                                type: 'number',
                                description: 'Number of messages to retrieve',
                                default: 10
                            }
                        },
                        required: ['topicId']
                    }
                },
                {
                    name: 'list_topics',
                    description: 'List all available chat topics',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                // Contact Tools
                {
                    name: 'get_contacts',
                    description: 'Get list of contacts',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'search_contacts',
                    description: 'Search for contacts by name or ID',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'Search query'
                            }
                        },
                        required: ['query']
                    }
                },
                // Connection Tools
                {
                    name: 'list_connections',
                    description: 'List all network connections',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'create_invitation',
                    description: 'Create a pairing invitation for a new connection',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'accept_invitation',
                    description: 'Accept a pairing invitation',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            invitationUrl: {
                                type: 'string',
                                description: 'The invitation URL to accept'
                            }
                        },
                        required: ['invitationUrl']
                    }
                },
                // LLM Tools
                {
                    name: 'list_models',
                    description: 'List available AI models',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'load_model',
                    description: 'Load an AI model',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            modelId: {
                                type: 'string',
                                description: 'The model ID to load'
                            }
                        },
                        required: ['modelId']
                    }
                },
                // Settings Tools
                {
                    name: 'get_settings',
                    description: 'Get current application settings',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            category: {
                                type: 'string',
                                description: 'Settings category (network, privacy, etc.)'
                            }
                        }
                    }
                },
                {
                    name: 'update_setting',
                    description: 'Update an application setting',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            category: {
                                type: 'string',
                                description: 'Settings category'
                            },
                            key: {
                                type: 'string',
                                description: 'Setting key'
                            },
                            value: {
                                type: 'any',
                                description: 'New value for the setting'
                            }
                        },
                        required: ['category', 'key', 'value']
                    }
                }
            ]
        }));
        this.server.setRequestHandler('tools/call', async (request) => {
            const { name, arguments: args } = request.params;
            if (!this.appModel) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'Error: AppModel not initialized. LAMA tools are not available yet.'
                        }
                    ]
                };
            }
            try {
                switch (name) {
                    // Chat operations
                    case 'send_message':
                        return await this.sendMessage(args.topicId, args.message);
                    case 'get_messages':
                        return await this.getMessages(args.topicId, args.limit);
                    case 'list_topics':
                        return await this.listTopics();
                    // Contact operations
                    case 'get_contacts':
                        return await this.getContacts();
                    case 'search_contacts':
                        return await this.searchContacts(args.query);
                    // Connection operations
                    case 'list_connections':
                        return await this.listConnections();
                    case 'create_invitation':
                        return await this.createInvitation();
                    case 'accept_invitation':
                        return await this.acceptInvitation(args.invitationUrl);
                    // LLM operations
                    case 'list_models':
                        return await this.listModels();
                    case 'load_model':
                        return await this.loadModel(args.modelId);
                    // Settings operations
                    case 'get_settings':
                        return await this.getSettings(args.category);
                    case 'update_setting':
                        return await this.updateSetting(args.category, args.key, args.value);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error.message}`
                        }
                    ]
                };
            }
        });
    }
    // Chat implementations
    async sendMessage(topicId, message) {
        try {
            const topicRoom = await this.appModel.topicModel.enterTopicRoom(topicId);
            await topicRoom.sendMessage(message);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Message sent to topic ${topicId}`
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to send message: ${error.message}`
                    }
                ]
            };
        }
    }
    async getMessages(topicId, limit = 10) {
        try {
            const messages = await this.appModel.topicModel.getMessages(topicId, limit);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(messages, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to get messages: ${error.message}`
                    }
                ]
            };
        }
    }
    async listTopics() {
        try {
            const topics = await this.appModel.topicModel.getTopics();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(topics.map(t => ({
                            id: t.id,
                            name: t.name,
                            type: t.type,
                            memberCount: t.members?.length
                        })), null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to list topics: ${error.message}`
                    }
                ]
            };
        }
    }
    // Contact implementations
    async getContacts() {
        try {
            const contacts = await this.appModel.getContacts();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(contacts, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to get contacts: ${error.message}`
                    }
                ]
            };
        }
    }
    async searchContacts(query) {
        try {
            const contacts = await this.appModel.getContacts();
            const filtered = contacts.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) ||
                c.id.includes(query));
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(filtered, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to search contacts: ${error.message}`
                    }
                ]
            };
        }
    }
    // Connection implementations
    async listConnections() {
        try {
            const connections = this.appModel.connections?.connectionsInfo() || [];
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(connections, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to list connections: ${error.message}`
                    }
                ]
            };
        }
    }
    async createInvitation() {
        try {
            if (!this.appModel.connections?.pairing) {
                throw new Error('Pairing manager not available');
            }
            const invitation = await this.appModel.connections.pairing.createInvitation();
            return {
                content: [
                    {
                        type: 'text',
                        text: `Invitation created:\n${invitation.url}`
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to create invitation: ${error.message}`
                    }
                ]
            };
        }
    }
    async acceptInvitation(invitationUrl) {
        // Browser should NOT accept invitations - only Node.js handles pairing
        return {
            content: [
                {
                    type: 'text',
                    text: 'Browser cannot accept invitations - pairing disabled. Invitations must be handled by the Node.js instance.'
                }
            ]
        };
    }
    // LLM implementations
    async listModels() {
        try {
            const models = this.appModel.llmManager?.getModels() || [];
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(models.map(m => ({
                            id: m.id,
                            name: m.name,
                            provider: m.provider,
                            isLoaded: this.appModel.llmManager?.isModelLoaded(m.id)
                        })), null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to list models: ${error.message}`
                    }
                ]
            };
        }
    }
    async loadModel(modelId) {
        try {
            await this.appModel.llmManager?.loadModel(modelId);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Model ${modelId} loaded successfully`
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to load model: ${error.message}`
                    }
                ]
            };
        }
    }
    // Settings implementations
    async getSettings(category) {
        // In a real implementation, read from actual settings storage
        const settings = {
            network: {
                relayServer: 'wss://comm10.dev.refinio.one',
                port: 443,
                udpPort: 8080
            },
            privacy: {
                autoEncrypt: true,
                saveHistory: true
            }
        };
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(category ? settings[category] : settings, null, 2)
                }
            ]
        };
    }
    async updateSetting(category, key, value) {
        // In a real implementation, update actual settings storage
        return {
            content: [
                {
                    type: 'text',
                    text: `Setting ${category}.${key} updated to ${value}`
                }
            ]
        };
    }
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.log('LAMA MCP Server started');
    }
}
// Start server if run directly
if (require.main === module) {
    const server = new LamaMCPServer();
    server.start();
}
