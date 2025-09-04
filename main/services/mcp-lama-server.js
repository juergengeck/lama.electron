/**
 * LAMA Application MCP Server
 * Provides access to LAMA-specific features like chat, contacts, connections, etc.
 * 
 * This runs in the Node.js main process where it has access to:
 * - ONE.core instance
 * - LLMManager
 * - AIAssistantModel
 * - All LAMA functionality
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MCPToolInterface } from '../interfaces/tool-interface.js';

export class LamaMCPServer {
  constructor(nodeOneCore, aiAssistantModel) {
    this.nodeOneCore = nodeOneCore;
    this.aiAssistantModel = aiAssistantModel;
    
    this.server = new Server({
      name: 'lama-app',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });
    
    // Initialize tool interface
    this.toolInterface = new MCPToolInterface(this, this.nodeOneCore);
    
    this.setupTools();
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
        
        // AI Assistant Tools
        {
          name: 'create_ai_topic',
          description: 'Create a new AI-enabled chat topic',
          inputSchema: {
            type: 'object',
            properties: {
              modelId: {
                type: 'string',
                description: 'The AI model ID for the topic'
              }
            },
            required: ['modelId']
          }
        },
        {
          name: 'generate_ai_response',
          description: 'Generate an AI response for a message',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'The message to respond to'
              },
              modelId: {
                type: 'string',
                description: 'The AI model to use'
              },
              topicId: {
                type: 'string',
                description: 'Optional topic ID for context'
              }
            },
            required: ['message', 'modelId']
          }
        }
      ]
    }));
    
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      
      if (!this.nodeOneCore) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: ONE.core not initialized. LAMA tools are not available yet.'
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
            
          // LLM operations
          case 'list_models':
            return await this.listModels();
          case 'load_model':
            return await this.loadModel(args.modelId);
            
          // AI Assistant operations
          case 'create_ai_topic':
            return await this.createAITopic(args.modelId);
          case 'generate_ai_response':
            return await this.generateAIResponse(args.message, args.modelId, args.topicId);
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
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
  
  // Chat implementations using ONE.core
  async sendMessage(topicId, message) {
    try {
      const topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(topicId);
      await topicRoom.sendMessage(message);
      
      return {
        content: [
          {
            type: 'text',
            text: `Message sent to topic ${topicId}`
          }
        ]
      };
    } catch (error) {
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
      const messages = await this.nodeOneCore.topicModel.getMessages(topicId, limit);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(messages, null, 2)
          }
        ]
      };
    } catch (error) {
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
      const topics = await this.nodeOneCore.topicModel.getTopics();
      
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
    } catch (error) {
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
      const contacts = await this.nodeOneCore.getContacts();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(contacts, null, 2)
          }
        ]
      };
    } catch (error) {
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
      const contacts = await this.nodeOneCore.getContacts();
      const filtered = contacts.filter(c => 
        c.name?.toLowerCase().includes(query.toLowerCase()) ||
        c.id?.includes(query)
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(filtered, null, 2)
          }
        ]
      };
    } catch (error) {
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
      const connections = this.nodeOneCore.connections?.connectionsInfo() || [];
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(connections, null, 2)
          }
        ]
      };
    } catch (error) {
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
      if (!this.nodeOneCore.connections?.pairing) {
        throw new Error('Pairing manager not available');
      }
      
      const invitation = await this.nodeOneCore.connections.pairing.createInvitation();
      
      return {
        content: [
          {
            type: 'text',
            text: `Invitation created:\n${invitation.url}`
          }
        ]
      };
    } catch (error) {
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
  
  // LLM implementations
  async listModels() {
    try {
      const models = this.aiAssistantModel?.getAvailableLLMModels() || [];
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(models.map(m => ({
              id: m.id,
              name: m.name,
              displayName: m.displayName,
              personId: m.personId
            })), null, 2)
          }
        ]
      };
    } catch (error) {
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
      if (!this.aiAssistantModel?.llmManager) {
        throw new Error('LLM Manager not available');
      }
      
      await this.aiAssistantModel.llmManager.loadModel(modelId);
      
      return {
        content: [
          {
            type: 'text',
            text: `Model ${modelId} loaded successfully`
          }
        ]
      };
    } catch (error) {
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
  
  // AI Assistant implementations
  async createAITopic(modelId) {
    try {
      if (!this.aiAssistantModel) {
        throw new Error('AI Assistant not initialized');
      }
      
      const topicId = await this.aiAssistantModel.getOrCreateAITopic(modelId);
      
      return {
        content: [
          {
            type: 'text',
            text: `AI topic created: ${topicId} for model: ${modelId}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to create AI topic: ${error.message}`
          }
        ]
      };
    }
  }
  
  async generateAIResponse(message, modelId, topicId) {
    try {
      if (!this.aiAssistantModel) {
        throw new Error('AI Assistant not initialized');
      }
      
      const response = await this.aiAssistantModel.generateResponse({
        message,
        modelId,
        topicId
      });
      
      return {
        content: [
          {
            type: 'text',
            text: response
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to generate AI response: ${error.message}`
          }
        ]
      };
    }
  }
  
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('[LamaMCPServer] ✅ LAMA MCP Server started');
  }
}

export default LamaMCPServer;