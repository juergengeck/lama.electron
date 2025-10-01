import type { ChannelManager } from '@refinio/one.models/lib/models/index.js';
/**
 * LLM Object Manager
 * Creates and manages LLM objects in ONE.core storage
 * These objects identify AI contacts by linking Person IDs to LLM models
 */

import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { ensureIdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { NodeOneCore } from '../types/one-core.js';

class LLMObjectManager {

  federationGroup: any;
  nodeOneCore: NodeOneCore;
  llmObjects: Map<string, unknown>;
  initialized: boolean;

  constructor(nodeOneCore: NodeOneCore) {
    this.nodeOneCore = nodeOneCore;
    this.llmObjects = new Map(); // modelId -> LLM object
    this.initialized = false;
}
  
  /**
   * Initialize by loading existing LLM objects from storage
   */
  async initialize(): Promise<any> {
    if (this.initialized) return;

    try {
      console.log('[LLMObjectManager] Loading existing LLM objects from storage...');

      // Use the channelManager to iterate over LLM objects if available
      if (!this.nodeOneCore?.channelManager) {
        console.log('[LLMObjectManager] ChannelManager not available yet, skipping initialization');
        this.initialized = true;
        return;
      }

      // Collect all LLM objects from storage using the channel manager
      const llmObjects = [];
      try {
        // Use the lama channel to store/retrieve LLM objects
        const iterator = this.nodeOneCore.channelManager.objectIteratorWithType('LLM', {
          channelId: 'lama'
        });

        for await (const llmObj of iterator) {
          if (llmObj && llmObj.data) {
            llmObjects.push(llmObj.data);
          }
        }
      } catch (iterError: any) {
        console.log('[LLMObjectManager] No LLM objects found in storage:', iterError.message);
      }

      if (llmObjects && llmObjects.length > 0) {
        console.log(`[LLMObjectManager] Found ${llmObjects.length} existing LLM objects`);

        // Cache all existing LLM objects
        for (const llm of llmObjects) {
          if (llm.personId && llm.name) {
            // Map the name to a proper model ID
            const modelId = llm.modelType === 'local' ? `ollama:${llm.name}` : llm.name;
            this.llmObjects.set(modelId, {
              modelId: modelId,
              modelName: llm.name,
              personId: llm.personId,
              isAI: true // Always true for LLM objects as source of truth
            });
            const personIdStr = llm.personId ? llm.personId.toString().substring(0, 8) : 'unknown';
            console.log(`[LLMObjectManager] Cached LLM: ${modelId} with person ${personIdStr}...`);
          }
        }
      } else {
        console.log('[LLMObjectManager] No existing LLM objects found');
      }

      this.initialized = true;
      console.log(`[LLMObjectManager] ✅ Initialized with ${this.llmObjects.size} LLM objects`);
    } catch (error) {
      console.error('[LLMObjectManager] Failed to initialize:', error);
      // Continue anyway - cache will be populated on demand
      this.initialized = true;
    }
  }

  /**
   * Create and store an LLM object for an AI model
   * This identifies the AI contact in ONE.core
   */
  async createLLMObject(modelId: any, modelName: any, personId: any): Promise<any> {
    console.log(`[LLMObjectManager] Creating LLM object for ${modelName}`);
    
    try {
      // Ensure personId is properly formatted
      const personIdHash = ensureIdHash(personId);
      
      // Check if we already have this LLM object cached
      if (this.llmObjects.has(modelId)) {
        console.log(`[LLMObjectManager] LLM object already exists for ${modelName}, using cached version`);
        return this.llmObjects.get(modelId);
      }
      
      // Create LLM object following LAMA's structure exactly as defined in the recipe
      const now = Date.now();
      const nowISOString = new Date().toISOString();
      
      const llmObject = {
        $type$: 'LLM' as const,
        modelId: modelId, // Required field - the unique identifier
        name: modelName, // This is the ID field according to recipe (isId: true)
        filename: `${modelName.replace(/[\s:]/g, '-').toLowerCase()}.gguf`, // Required field
        modelType: (modelId.startsWith('ollama:') ? 'local' : 'remote') as 'local' | 'remote', // Required field
        active: true, // Required field
        deleted: false, // Required field
        created: now, // Required field (timestamp)
        modified: now, // Required field (timestamp)
        createdAt: nowISOString, // Required field (ISO string)
        lastUsed: nowISOString, // Required field (ISO string)
        // Optional fields
        personId: personIdHash,
        provider: this.getProviderFromModelId(modelId),
        capabilities: ['chat', 'inference'] as Array<'chat' | 'inference'>, // Must match regexp: chat or inference
        maxTokens: 4096,
        temperature: 0.7,
        contextSize: 4096,
        batchSize: 512,
        threads: 4,
        isAI: true // Mark as AI for source of truth
      };
      
      // Store the LLM object in ONE.core
      const storedObject: any = await storeVersionedObject(llmObject);
      console.log(`[LLMObjectManager] Stored LLM object with hash: ${storedObject.hash}`);
      
      // Cache the object
      this.llmObjects.set(modelId, {
        ...llmObject,
        modelId: modelId, // Store the original modelId for reference
        hash: storedObject.hash,
        idHash: storedObject.idHash,
        isAI: true // Ensure isAI flag is present in cache
      });
      
      // Grant access to federation group for CHUM sync
      await this.grantAccessToLLMObject(storedObject.idHash);
      
      return storedObject;
    } catch (error) {
      console.error(`[LLMObjectManager] Failed to create LLM object for ${modelName}:`, error);
      throw error;
    }
  }
  
  /**
   * Grant access to LLM object for federation sync
   */
  async grantAccessToLLMObject(llmIdHash: any): Promise<any> {
    try {
      const { createAccess } = await import('@refinio/one.core/lib/access.js');
      const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js');
      
      // Get federation group for access
      const federationGroup = (this.nodeOneCore as any).federationGroup;
      if (!federationGroup) {
        console.warn('[LLMObjectManager] No federation group available');
        return;
      }
      
      // Grant federation group access to the LLM object
      await createAccess([{
        id: llmIdHash,
        person: [],
        group: [federationGroup.groupIdHash],
        mode: SET_ACCESS_MODE.ADD
      }]);
      
      console.log(`[LLMObjectManager] Granted federation access to LLM object: ${llmIdHash.toString().substring(0, 8)}...`);
    } catch (error) {
      console.error('[LLMObjectManager] Failed to grant access to LLM object:', error);
    }
  }
  
  /**
   * Get provider from model ID
   */
  getProviderFromModelId(modelId: any): any {
    if (modelId.startsWith('ollama:')) return 'ollama';
    if (modelId.startsWith('claude:')) return 'claude';
    if (modelId.startsWith('gpt:')) return 'openai';
    return 'unknown';
  }
  
  /**
   * Get all LLM objects
   */
  getAllLLMObjects(): any {
    return Array.from(this.llmObjects.values());
  }
  
  /**
   * Get LLM object by model ID
   */
  getLLMObject(modelId: any): any {
    return this.llmObjects.get(modelId);
  }
  
  /**
   * Check if a personId belongs to an LLM
   */
  isLLMPerson(personId: any): any {
    if (!personId) return false;
    const personIdStr = personId.toString();

    console.log(`[LLMObjectManager] Checking if ${String(personIdStr).substring(0, 8)}... is LLM, cache has ${this.llmObjects.size} entries`)

    const isLLM = Array.from(this.llmObjects.values()).some(
      (llm: any) => llm.personId && llm.personId.toString() === personIdStr
    );

    if (isLLM) {
      console.log(`[LLMObjectManager] Result: ${String(personIdStr).substring(0, 8)}... is AI: true (cached)`)
      return true;
    }

    console.log(`[LLMObjectManager] Result: ${String(personIdStr).substring(0, 8)}... is AI: false`)
    return false;
  }
  
  /**
   * Add a person ID to cache without creating LLM object
   * Used when AI contacts already exist
   */
  cacheAIPersonId(modelId: any, personId: any): any {
    if (!this.llmObjects.has(modelId)) {
      // Create a minimal cache entry with isAI flag
      this.llmObjects.set(modelId, {
        modelId: modelId,
        personId: personId,
        isAI: true, // Mark as AI for source of truth
        cached: true // Mark as cached only
      });
      console.log(`[LLMObjectManager] Cached AI person ${personId.toString().substring(0, 8)}... for model ${modelId}`);
    }
  }
}

export default LLMObjectManager;