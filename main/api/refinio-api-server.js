/**
 * Refinio API Server Integration
 *
 * This module embeds the refinio.api server into the Electron main process,
 * providing a QUIC-based API that can be accessed by refinio.cli or other clients.
 */
import { getQuicTransport } from '../../packages/one.core/lib/system/quic-transport.js';
import { QuicVCServer } from '../../packages/refinio.api/dist/server/QuicVCServer.js';
import { InstanceAuthManager } from '../../packages/refinio.api/dist/auth/InstanceAuthManager.js';
import { ObjectHandler } from '../../packages/refinio.api/dist/handlers/ObjectHandler.js';
import { RecipeHandler } from '../../packages/refinio.api/dist/handlers/RecipeHandler.js';
import { AIHandler } from './handlers/AIHandler.js';
import electron from 'electron';
const { app } = electron;
import nodeOneCore from '../core/node-one-core.js';
class RefinioApiServer {
    server;
    instance;
    config;
    aiAssistantModel;
    aiHandler;
    constructor(aiAssistantModel = null) {
        this.server = null;
        this.instance = null;
        this.config = null;
        this.aiAssistantModel = aiAssistantModel;
        this.aiHandler = null;
    }
    /**
     * Initialize and start the API server
     * Uses the existing Node instance if available
     */
    async start() {
        console.log('[RefinioAPI] Starting API server...');
        // Check if Node instance is already initialized
        const nodeInfo = nodeOneCore.getInfo();
        if (!nodeInfo.initialized) {
            console.log('[RefinioAPI] Node instance not initialized, waiting for provisioning');
            return false;
        }
        // Get QUIC transport
        const quicTransport = getQuicTransport();
        if (!quicTransport) {
            console.log('[RefinioAPI] QUIC transport not available');
            return false;
        }
        try {
            // Use the existing Node instance
            this.instance = nodeOneCore.getInstance();
            if (!this.instance) {
                console.log('[RefinioAPI] Node instance not available');
                return false;
            }
            // Create auth manager using the existing instance
            const authManager = new InstanceAuthManager();
            // Initialize handlers with the existing instance
            const objectHandler = new ObjectHandler(nodeOneCore);
            const recipeHandler = new RecipeHandler();
            // Initialize AI handler if AI assistant is available
            if (this.aiAssistantModel) {
                this.aiHandler = new AIHandler(nodeOneCore, this.aiAssistantModel);
            }
            // Create QUIC server using the existing instance
            const serverOptions = {
                instance: this.instance,
                quicTransport,
                authManager,
                handlers: {
                    object: objectHandler,
                    recipe: recipeHandler,
                    ...(this.aiHandler ? { ai: this.aiHandler } : {})
                },
                config: {
                    port: 9876, // Different from WebSocket port 8765
                    host: 'localhost'
                }
            };
            this.server = new QuicVCServer(serverOptions);
            await this.server.start();
            console.log('[RefinioAPI] ✅ API server started on port 9876');
            console.log('[RefinioAPI] Using existing Node instance:', nodeInfo.instanceName);
            console.log('[RefinioAPI] Owner:', nodeInfo.ownerId);
            if (this.aiHandler) {
                console.log('[RefinioAPI] AI handler integrated - AI endpoints available');
            }
            // Register API endpoints for LAMA-specific operations
            await this.registerLamaEndpoints();
            return true;
        }
        catch (error) {
            console.error('[RefinioAPI] Failed to start API server:', error);
            return false;
        }
    }
    /**
     * Set AI Assistant Model after initialization
     */
    setAIAssistantModel(aiAssistantModel) {
        this.aiAssistantModel = aiAssistantModel;
        // Reinitialize AI handler if server is running
        if (this.server && aiAssistantModel) {
            this.aiHandler = new AIHandler(nodeOneCore, aiAssistantModel);
            console.log('[RefinioAPI] AI handler updated with new AI assistant model');
        }
    }
    /**
     * Register LAMA-specific API endpoints
     */
    async registerLamaEndpoints() {
        if (!this.server)
            return;
        console.log('[RefinioAPI] Registering LAMA endpoints...');
        // Add custom handlers for LAMA operations
        // These will be accessible via refinio.cli
        // Example: Chat operations
        const chatHandler = {
            list: async () => {
                // Return list of conversations from TopicModel
                if (!nodeOneCore.topicModel) {
                    return [];
                }
                try {
                    // Get all topics like the IPC handler does
                    const topicRooms = await nodeOneCore.topicModel.getActiveTopicRooms();
                    return topicRooms.map((room) => ({
                        id: room.topic?.name,
                        name: room.topic?.name || 'Untitled',
                        participants: room.participants || [],
                        lastActivity: room.lastActivity || Date.now()
                    }));
                }
                catch (error) {
                    console.error('[RefinioAPI] Error listing conversations:', error);
                    return [];
                }
            },
            create: async (params) => {
                // Create new conversation using TopicModel
                const { name, participants } = params;
                if (!nodeOneCore.topicModel) {
                    return { success: false, error: 'TopicModel not initialized' };
                }
                try {
                    // Create topic similar to IPC handler
                    const topicRoom = await nodeOneCore.topicModel.enterTopicRoom(name);
                    return {
                        success: true,
                        data: {
                            id: topicRoom.topic?.name,
                            name: topicRoom.topic?.name,
                            participants
                        }
                    };
                }
                catch (error) {
                    console.error('[RefinioAPI] Error creating conversation:', error);
                    return { success: false, error: error.message };
                }
            },
            send: async (params) => {
                // Send message using TopicModel
                const { channelId, message } = params;
                if (!nodeOneCore.topicModel) {
                    return { success: false, error: 'TopicModel not initialized' };
                }
                try {
                    // Send message similar to IPC handler
                    const topicRoom = await nodeOneCore.topicModel.enterTopicRoom(channelId);
                    if (!topicRoom) {
                        return { success: false, error: 'Topic not found' };
                    }
                    await topicRoom.sendMessage(message, nodeOneCore.ownerId);
                    return { success: true };
                }
                catch (error) {
                    console.error('[RefinioAPI] Error sending message:', error);
                    return { success: false, error: error.message };
                }
            }
        };
        this.server.addHandler('chat', chatHandler);
        // Example: Contact operations
        const contactsHandler = {
            list: async () => {
                // Get contacts using LeuteModel.others() method
                if (!nodeOneCore.leuteModel) {
                    return [];
                }
                try {
                    const someoneObjects = await nodeOneCore.leuteModel.others();
                    const contacts = [];
                    for (const someone of someoneObjects) {
                        const personId = await someone.mainIdentity();
                        if (!personId)
                            continue;
                        const profiles = await someone.profiles();
                        const profile = profiles?.[0];
                        const personDescriptions = profile?.personDescriptions || [];
                        const personName = personDescriptions.find((d) => d.$type$ === 'PersonName');
                        const displayName = personName?.name || profile?.name || `Contact ${String(personId).substring(0, 8)}`;
                        contacts.push({
                            id: personId,
                            personId,
                            name: displayName,
                            isAI: false
                        });
                    }
                    // Add AI contacts if available
                    if (nodeOneCore.aiAssistantModel) {
                        const aiContacts = nodeOneCore.aiAssistantModel.getAllContacts();
                        for (const aiContact of aiContacts) {
                            contacts.push({
                                id: aiContact.personId,
                                personId: aiContact.personId,
                                name: aiContact.name,
                                isAI: true,
                                modelId: aiContact.modelId
                            });
                        }
                    }
                    return contacts;
                }
                catch (error) {
                    console.error('[RefinioAPI] Error listing contacts:', error);
                    return [];
                }
            },
            add: async (params) => {
                const { email, name } = params;
                if (!nodeOneCore.leuteModel) {
                    return { success: false, error: 'LeuteModel not initialized' };
                }
                try {
                    // TODO: Proper contact creation requires implementing the full contact creation flow
                    // For now, return an error since the API signature doesn't match
                    return {
                        success: false,
                        error: 'Contact creation not implemented - requires personId, not email/name'
                    };
                }
                catch (error) {
                    console.error('[RefinioAPI] Error adding contact:', error);
                    return { success: false, error: error.message };
                }
            }
        };
        this.server.addHandler('contacts', contactsHandler);
        // Example: AI operations
        const aiHandlerEndpoints = {
            models: async () => {
                // Return available AI models
                return nodeOneCore.llmManager?.getAvailableModels() || [];
            },
            complete: async (params) => {
                const { model, prompt } = params;
                return await nodeOneCore.llmManager?.complete(model, prompt);
            }
        };
        this.server.addHandler('ai', aiHandlerEndpoints);
        console.log('[RefinioAPI] ✅ LAMA endpoints registered');
    }
    /**
     * Stop the API server
     */
    async stop() {
        if (this.server) {
            console.log('[RefinioAPI] Stopping API server...');
            await this.server.stop();
            this.server = null;
            this.instance = null;
            console.log('[RefinioAPI] ✅ API server stopped');
        }
    }
    /**
     * Get server status
     */
    getStatus() {
        return {
            running: !!this.server,
            port: this.config?.server?.port,
            host: this.config?.server?.host,
            instance: this.instance?.name
        };
    }
}
// Export singleton instance
export default RefinioApiServer;
