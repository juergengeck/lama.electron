/**
 * AI Handler for Refinio API
 *
 * Provides AI Assistant functionality through the refinio.api QUIC interface.
 * This allows external tools and refinio.cli to interact with LAMA's AI capabilities.
 */

import * as ONE from '@refinio/one.models/lib/api/One.js';

interface RequestParams {
  [key: string]: string;
}

interface RequestQuery {
  [key: string]: string;
}

interface APIRequest {
  params: RequestParams;
  query: RequestQuery;
  body: any;
}

interface APIResponse {
  statusCode: number;
  body: {
    success: boolean;
    data?: any;
    error?: string;
  };
}

interface ModelInfo {
  id: string;
  name: string;
  displayName: string;
  personId: string;
  provider?: string;
  isLoaded: boolean;
}

interface LLMObject {
  $type$: 'LLM';
  id: string;
  name: string;
  displayName?: string;
  personId?: string;
  provider?: string;
  modelId: string;
  capabilities?: string[];
  maxTokens?: number;
  temperature?: number;
  enabled?: boolean;
  deleted?: boolean;
}

interface NodeOneCore {
  topicModel?: {
    getMessages(topicId: string, limit: number): Promise<any[]>;
    enterTopicRoom(topicId: string): Promise<TopicRoom | null>;
  };
  aiAssistantModel?: {
    getAllContacts(): any[];
    createAIContact(modelId: string, displayName: string): Promise<string>;
    getPersonIdForModel(modelId: string): string;
  };
}

interface TopicRoom {
  sendMessage(message: string, sender?: string): Promise<void>;
}

interface AIAssistantModel {
  getAvailableLLMModels(): any[];
  llmManager?: {
    getModel(modelId: string): any;
    isModelLoaded(modelId: string): boolean;
    loadModel(modelId: string): Promise<void>;
  };
  getLLMObjects(): Promise<any[]>;
  updateLLMObject(llmId: string, updates: any): Promise<any>;
  getOrCreateAITopic(modelId: string): Promise<string>;
  generateResponse(options: {
    message: string;
    modelId: string;
    topicId?: string;
    temperature?: number;
  }): Promise<string>;
  getToolsForLLM(): any[];
  executeToolForAI(toolName: string, input: any): Promise<any>;
}

export class AIHandler {
  public nodeOneCore: NodeOneCore;
  public aiAssistantModel: AIAssistantModel;
  public name: string;
  public version: string;

  constructor(nodeOneCore: NodeOneCore, aiAssistantModel: AIAssistantModel) {
    this.nodeOneCore = nodeOneCore;
    this.aiAssistantModel = aiAssistantModel;
    this.name = 'ai';
    this.version = '1.0.0';
  }

  /**
   * Get AI handler configuration for refinio.api
   */
  getConfig() {
    return {
      name: this.name,
      version: this.version,
      endpoints: {
        // Model management
        'GET /models': this.listModels.bind(this),
        'POST /models/:modelId/load': this.loadModel.bind(this),
        'GET /models/:modelId/status': this.getModelStatus.bind(this),

        // LLM objects (stored in ONE.core)
        'GET /llm-objects': this.getLLMObjects.bind(this),
        'POST /llm-objects': this.createLLMObject.bind(this),
        'PUT /llm-objects/:llmId': this.updateLLMObject.bind(this),
        'DELETE /llm-objects/:llmId': this.deleteLLMObject.bind(this),

        // AI conversations
        'POST /topics': this.createAITopic.bind(this),
        'GET /topics/:topicId/messages': this.getMessages.bind(this),
        'POST /topics/:topicId/messages': this.sendMessage.bind(this),
        'POST /generate': this.generateResponse.bind(this),

        // Tool interface
        'GET /tools': this.listTools.bind(this),
        'POST /tools/:toolName/execute': this.executeTool.bind(this),

        // AI contact management
        'GET /ai-contacts': this.getAIContacts.bind(this),
        'POST /ai-contacts': this.createAIContact.bind(this)
      }
    };
  }

  /**
   * List available AI models
   */
  async listModels(request: APIRequest): Promise<APIResponse> {
    try {
      const models = this.aiAssistantModel?.getAvailableLLMModels() || [];

      const modelData: ModelInfo[] = models.map((model: any) => ({
        id: model.id,
        name: model.name,
        displayName: model.displayName,
        personId: model.personId,
        provider: this.aiAssistantModel.llmManager?.getModel(model.id)?.provider,
        isLoaded: this.aiAssistantModel.llmManager?.isModelLoaded(model.id) || false
      }));

      return {
        statusCode: 200,
        body: {
          success: true,
          data: modelData
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Load a specific model
   */
  async loadModel(request: APIRequest): Promise<APIResponse> {
    try {
      const { modelId } = request.params;

      if (!this.aiAssistantModel?.llmManager) {
        throw new Error('LLM Manager not available');
      }

      await this.aiAssistantModel.llmManager.loadModel(modelId);

      return {
        statusCode: 200,
        body: {
          success: true,
          data: {
            modelId,
            status: 'loaded'
          }
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Get model status
   */
  async getModelStatus(request: APIRequest): Promise<APIResponse> {
    try {
      const { modelId } = request.params;

      const isLoaded = this.aiAssistantModel?.llmManager?.isModelLoaded(modelId) || false;
      const model = this.aiAssistantModel?.llmManager?.getModel(modelId);

      return {
        statusCode: 200,
        body: {
          success: true,
          data: {
            modelId,
            isLoaded,
            provider: model?.provider,
            capabilities: model?.capabilities || []
          }
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Get LLM objects from ONE.core
   */
  async getLLMObjects(request: APIRequest): Promise<APIResponse> {
    try {
      const llmObjects = await this.aiAssistantModel?.getLLMObjects() || [];

      return {
        statusCode: 200,
        body: {
          success: true,
          data: llmObjects
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Create new LLM object
   */
  async createLLMObject(request: APIRequest): Promise<APIResponse> {
    try {
      const llmData = request.body;

      // Validate required fields
      if (!llmData.id || !llmData.name) {
        throw new Error('Missing required fields: id, name');
      }

      // Create LLM object in ONE.core
      const llmObject: LLMObject = {
        $type$: 'LLM',
        id: llmData.id,
        name: llmData.name,
        displayName: llmData.displayName || llmData.name,
        personId: llmData.personId,
        provider: llmData.provider || 'unknown',
        modelId: llmData.id,
        capabilities: llmData.capabilities || ['chat'],
        maxTokens: llmData.maxTokens || 4096,
        temperature: llmData.temperature || 0.7,
        enabled: llmData.enabled !== false,
        deleted: false
      };

      const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
      const stored = await storeVersionedObject(llmObject as any);

      return {
        statusCode: 201,
        body: {
          success: true,
          data: {
            idHash: stored.idHash,
            ...llmObject
          }
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Update LLM object
   */
  async updateLLMObject(request: APIRequest): Promise<APIResponse> {
    try {
      const { llmId } = request.params;
      const updates = request.body;

      const updated = await this.aiAssistantModel?.updateLLMObject(llmId, updates);

      return {
        statusCode: 200,
        body: {
          success: true,
          data: updated
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Delete LLM object (soft delete)
   */
  async deleteLLMObject(request: APIRequest): Promise<APIResponse> {
    try {
      const { llmId } = request.params;

      const updated = await this.aiAssistantModel?.updateLLMObject(llmId, {
        deleted: true
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          data: { deleted: true }
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Create AI topic
   */
  async createAITopic(request: APIRequest): Promise<APIResponse> {
    try {
      const { modelId, name } = request.body;

      if (!modelId) {
        throw new Error('modelId is required');
      }

      const topicId = await this.aiAssistantModel?.getOrCreateAITopic(modelId);

      return {
        statusCode: 201,
        body: {
          success: true,
          data: {
            topicId,
            modelId,
            name: name || `Chat with ${modelId}`
          }
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Get messages from topic
   */
  async getMessages(request: APIRequest): Promise<APIResponse> {
    try {
      const { topicId } = request.params;
      const { limit = '20' } = request.query;

      const messages = await this.nodeOneCore.topicModel?.getMessages(topicId, parseInt(limit)) || [];

      return {
        statusCode: 200,
        body: {
          success: true,
          data: messages
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Send message to topic
   */
  async sendMessage(request: APIRequest): Promise<APIResponse> {
    try {
      const { topicId } = request.params;
      const { message, sender } = request.body;

      if (!message) {
        throw new Error('message is required');
      }

      const topicRoom = await this.nodeOneCore.topicModel?.enterTopicRoom(topicId);
      if (!topicRoom) {
        throw new Error('Topic not found or accessible');
      }

      await topicRoom.sendMessage(message, sender);

      return {
        statusCode: 201,
        body: {
          success: true,
          data: {
            topicId,
            message,
            sent: true
          }
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Generate AI response
   */
  async generateResponse(request: APIRequest): Promise<APIResponse> {
    try {
      const { message, modelId, topicId, temperature } = request.body;

      if (!message || !modelId) {
        throw new Error('message and modelId are required');
      }

      const response = await this.aiAssistantModel?.generateResponse({
        message,
        modelId,
        topicId,
        temperature
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          data: {
            response,
            modelId,
            topicId
          }
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * List available tools
   */
  async listTools(request: APIRequest): Promise<APIResponse> {
    try {
      const tools = this.aiAssistantModel?.getToolsForLLM() || [];

      return {
        statusCode: 200,
        body: {
          success: true,
          data: tools
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Execute a tool
   */
  async executeTool(request: APIRequest): Promise<APIResponse> {
    try {
      const { toolName } = request.params;
      const input = request.body;

      const result = await this.aiAssistantModel?.executeToolForAI(toolName, input);

      return {
        statusCode: 200,
        body: result
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Get AI contacts
   */
  async getAIContacts(request: APIRequest): Promise<APIResponse> {
    try {
      const contacts = this.nodeOneCore.aiAssistantModel?.getAllContacts() || [];

      return {
        statusCode: 200,
        body: {
          success: true,
          data: contacts
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Create AI contact
   */
  async createAIContact(request: APIRequest): Promise<APIResponse> {
    try {
      const { modelId, displayName } = request.body;

      if (!modelId) {
        throw new Error('modelId is required');
      }

      const someoneIdHash = await this.nodeOneCore.aiAssistantModel?.createAIContact(
        modelId,
        displayName || modelId
      );

      const personId = this.nodeOneCore.aiAssistantModel?.getPersonIdForModel(modelId);

      return {
        statusCode: 201,
        body: {
          success: true,
          data: {
            modelId,
            displayName,
            someoneIdHash,
            personId
          }
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }
}

export default AIHandler;