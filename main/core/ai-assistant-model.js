/**
 * AI Assistant Model for Electron
 * Orchestrates all AI functionality - adapted from LAMA
 * 
 * This is the main coordinator that brings together:
 * - LLMManager (model management)
 * - AIContactManager (AI identity)
 * - AIMessageListener (CHUM events)
 * - Topic management
 */

import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';
import { ensureIdHash } from '@refinio/one.core/lib/util/type-checks.js';
import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { AIToolInterface, MCPToolInterface } from '../interfaces/tool-interface.js';
import * as ONE from '@refinio/one.models/lib/api/One.js';

class AIAssistantModel {
  constructor(nodeOneCore) {
    this.nodeOneCore = nodeOneCore;
    this.personId = nodeOneCore.ownerId;
    
    // Components (reusing what we have)
    this.llmManager = null; // Will be set from main process LLMManager
    this.aiContactManager = nodeOneCore.aiContactManager;
    this.aiMessageListener = nodeOneCore.aiMessageListener;
    
    // State
    this.isInitialized = false;
    this.aiTopics = new Map(); // topicId -> modelId mapping
    this.availableLLMModels = [];
    
    // Tool interface for unified tool access
    this.toolInterface = null;
    
    // Events
    this.onAITopicsChanged = new OEvent();
    this.onGenerationProgress = new OEvent();
    
    console.log('[AIAssistantModel] Created with personId:', this.personId);
  }
  
  /**
   * Initialize the AI Assistant
   */
  async init() {
    if (this.isInitialized) {
      console.log('[AIAssistantModel] Already initialized');
      return;
    }
    
    console.log('[AIAssistantModel] Initializing...');
    
    try {
      // Get LLMManager from main process
      const { default: llmManager } = await import('../services/llm-manager.js');
      this.llmManager = llmManager;
      
      // Ensure LLMManager is initialized
      if (!this.llmManager.isInitialized) {
        await this.llmManager.init();
      }
      
      // Create LLM objects in ONE.core for each model
      await this.createLLMObjects();
      
      // Set up AI contacts if not already done
      await this.ensureAIContacts();
      
      // Start message listener if not already running
      if (this.aiMessageListener && !this.aiMessageListener.isListening) {
        this.aiMessageListener.start();
      }
      
      // Initialize tool interface for unified tool access
      this.toolInterface = new AIToolInterface(this);
      console.log('[AIAssistantModel] Tool interface initialized');
      
      this.isInitialized = true;
      console.log('[AIAssistantModel] ✅ Initialized successfully');
      
    } catch (error) {
      console.error('[AIAssistantModel] Initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Create LLM objects in ONE.core so they sync via CHUM
   * This is how the browser identifies AI contacts
   */
  async createLLMObjects() {
    console.log('[AIAssistantModel] Creating LLM objects in ONE.core...');
    
    const models = this.llmManager.getAvailableModels();
    
    for (const model of models) {
      try {
        // Get or create personId for this model
        const personId = await this.getOrCreatePersonIdForModel(model);
        
        // Create LLM object following LAMA mobile app's structure
        const now = Date.now();
        const llmObject = {
          $type$: 'LLM',
          name: model.name, // This is the ID field
          filename: model.id || model.name,
          modelType: 'remote', // API-based models are remote
          active: true,
          deleted: false,
          created: now,
          modified: now,
          createdAt: new Date(now).toISOString(),
          lastUsed: new Date(now).toISOString(),
          personId: personId,
          capabilities: model.capabilities || ['chat'],
          maxTokens: model.maxTokens || 4096,
          temperature: model.defaultTemperature || 0.7,
          provider: model.provider,
          usageCount: 0
        };
        
        // Store in ONE.core as versioned object
        const stored = await storeVersionedObject(llmObject);
        console.log(`[AIAssistantModel] Stored LLM object for ${model.name}: ${stored.idHash}`);
        
        // Grant access to federation group for CHUM sync
        await this.grantAccessToLLMObject(stored.idHash);
        
        // Update model with personId
        this.llmManager.setModelPersonId(model.id, personId);
        
        // Add to available models
        this.availableLLMModels.push({
          id: model.id,
          name: model.name,
          displayName: model.displayName || model.name,
          personId: personId
        });
        
      } catch (error) {
        console.error(`[AIAssistantModel] Failed to create LLM object for ${model.name}:`, error);
      }
    }
    
    console.log(`[AIAssistantModel] Created ${this.availableLLMModels.length} LLM objects`);
  }
  
  /**
   * Get or create Person ID for a model
   */
  async getOrCreatePersonIdForModel(model) {
    // Check if AI contact already exists
    let personId = this.aiContactManager.getPersonIdForModel(model.id);
    
    if (!personId) {
      // Create AI contact (Person + Profile + Someone)
      const someoneIdHash = await this.aiContactManager.createAIContact(
        model.id,
        model.displayName || model.name
      );
      
      // Get the personId from the contact manager
      personId = this.aiContactManager.getPersonIdForModel(model.id);
    }
    
    return personId;
  }
  
  /**
   * Grant access to LLM object for federation sync
   */
  async grantAccessToLLMObject(llmIdHash) {
    try {
      const { createAccess } = await import('@refinio/one.core/lib/access.js');
      const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js');
      
      const federationGroup = this.nodeOneCore.federationGroup;
      if (!federationGroup) {
        console.warn('[AIAssistantModel] No federation group available');
        return;
      }
      
      await createAccess([{
        id: llmIdHash,
        person: [],
        group: [federationGroup.groupIdHash],
        mode: SET_ACCESS_MODE.ADD
      }]);
      
      console.log(`[AIAssistantModel] Granted federation access to LLM object`);
    } catch (error) {
      console.error('[AIAssistantModel] Failed to grant access to LLM object:', error);
    }
  }
  
  /**
   * Ensure AI contacts exist for all models
   */
  async ensureAIContacts() {
    const models = this.llmManager.getAvailableModels();
    
    if (this.aiContactManager.getAllContacts().length === 0) {
      console.log('[AIAssistantModel] Creating AI contacts...');
      await this.aiContactManager.setupAIContacts(models);
    }
  }
  
  /**
   * Create or get an AI topic for a specific model
   */
  async getOrCreateAITopic(modelId) {
    console.log(`[AIAssistantModel] Getting/creating AI topic for model: ${modelId}`);
    
    // Check if we already have a topic for this model
    for (const [topicId, mappedModelId] of this.aiTopics.entries()) {
      if (mappedModelId === modelId) {
        return topicId;
      }
    }
    
    // Create new topic
    const model = this.availableLLMModels.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    const topicName = `Chat with ${model.displayName}`;
    const topicId = `ai-${modelId}-${Date.now()}`;
    
    // Create topic through TopicModel
    if (this.nodeOneCore.topicModel) {
      await this.nodeOneCore.topicModel.createGroupTopic(
        topicName,
        topicId,
        this.personId
      );
      
      // Register this as an AI topic
      this.aiTopics.set(topicId, modelId);
      this.aiMessageListener.registerAITopic(topicId, modelId);
      
      console.log(`[AIAssistantModel] Created AI topic: ${topicId} for model: ${modelId}`);
    }
    
    return topicId;
  }
  
  /**
   * Check if a topic is AI-enabled
   */
  isAITopic(topicId) {
    return this.aiTopics.has(topicId) || 
           topicId === 'default' || 
           topicId === 'ai-chat' ||
           topicId.includes('ai-');
  }
  
  /**
   * Get the model ID for a topic
   */
  getModelForTopic(topicId) {
    return this.aiTopics.get(topicId) || 'ollama:gpt-oss'; // Default model
  }
  
  /**
   * Get all available LLM models with their Person IDs
   */
  getAvailableLLMModels() {
    return this.availableLLMModels;
  }
  
  /**
   * Check if a personId belongs to an AI
   */
  isAIPerson(personId) {
    const personIdStr = personId?.toString();
    return this.availableLLMModels.some(
      model => model.personId?.toString() === personIdStr
    );
  }
  
  /**
   * Generate AI response for a message
   */
  async generateResponse({ message, modelId, temperature = 0.7, topicId = null }) {
    if (!this.isInitialized) {
      throw new Error('AIAssistantModel not initialized');
    }
    
    try {
      const model = this.llmManager.getModel(modelId);
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }
      
      console.log(`[AIAssistantModel] Generating response with ${modelId}:`, message.substring(0, 100) + '...');
      
      // Get conversation history if topicId provided
      let messages = [{ role: 'user', content: message }];
      if (topicId && this.nodeOneCore.topicModel) {
        const history = await this.getConversationHistory(topicId);
        messages = [...history, { role: 'user', content: message }];
      }
      
      // Generate response using LLMManager
      const response = await this.llmManager.generateResponse({
        modelId,
        messages,
        temperature
      });
      
      // Emit progress event
      this.onGenerationProgress.emit({
        topicId,
        modelId,
        status: 'completed',
        response
      });
      
      return response;
      
    } catch (error) {
      console.error('[AIAssistantModel] Response generation failed:', error);
      this.onGenerationProgress.emit({
        topicId,
        modelId,
        status: 'error',
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get conversation history from a topic
   */
  async getConversationHistory(topicId, limit = 10) {
    try {
      if (!this.nodeOneCore.topicModel) {
        return [];
      }
      
      const messages = await this.nodeOneCore.topicModel.getMessages(topicId, limit);
      
      // Convert to ChatML format
      return messages.map(msg => ({
        role: this.isAIPerson(msg.sender) ? 'assistant' : 'user',
        content: msg.text || ''
      })).reverse(); // Reverse to get chronological order
      
    } catch (error) {
      console.warn('[AIAssistantModel] Failed to get conversation history:', error);
      return [];
    }
  }
  
  /**
   * Get tools available for LLM to use
   */
  getToolsForLLM() {
    if (!this.toolInterface) {
      return [];
    }
    
    return this.toolInterface.getToolsForLLM();
  }
  
  /**
   * Execute a tool on behalf of the AI
   */
  async executeToolForAI(toolName, input, context = {}) {
    if (!this.toolInterface) {
      throw new Error('Tool interface not initialized');
    }
    
    return await this.toolInterface.handleToolCall(toolName, input, context);
  }
  
  /**
   * List all LLM objects from ONE.core
   */
  async getLLMObjects() {
    try {
      // Query all LLM objects from ONE.core
      const llmObjects = await ONE.queryObjects({
        type: 'LLM',
        deleted: false
      });
      
      return llmObjects;
    } catch (error) {
      console.warn('[AIAssistantModel] Failed to query LLM objects:', error);
      return [];
    }
  }
  
  /**
   * Store an updated LLM object
   */
  async updateLLMObject(llmId, updates) {
    try {
      const existingObject = await ONE.getObject(llmId);
      if (!existingObject) {
        throw new Error(`LLM object ${llmId} not found`);
      }
      
      const updatedObject = {
        ...existingObject,
        ...updates
      };
      
      const stored = await storeVersionedObject(updatedObject);
      console.log(`[AIAssistantModel] Updated LLM object: ${stored.idHash}`);
      
      return stored.idHash;
    } catch (error) {
      console.error(`[AIAssistantModel] Failed to update LLM object:`, error);
      throw error;
    }
  }
}

export default AIAssistantModel;