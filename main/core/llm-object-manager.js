/**
 * LLM Object Manager
 * Creates and manages LLM objects in ONE.core storage
 * These objects identify AI contacts by linking Person IDs to LLM models
 */

import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { ensureIdHash } from '@refinio/one.core/lib/util/type-checks.js';

class LLMObjectManager {
  constructor(nodeOneCore) {
    this.nodeOneCore = nodeOneCore;
    this.llmObjects = new Map(); // modelId -> LLM object
  }

  /**
   * Create and store an LLM object for an AI model
   * This identifies the AI contact in ONE.core
   */
  async createLLMObject(modelId, modelName, personId) {
    console.log(`[LLMObjectManager] Creating LLM object for ${modelName}`);
    
    try {
      // Ensure personId is properly formatted
      const personIdHash = ensureIdHash(personId);
      
      // Create LLM object following LAMA's structure
      const llmObject = {
        $type$: 'LLM',
        id: modelId,
        name: modelName,
        displayName: modelName,
        personId: personIdHash,
        provider: this.getProviderFromModelId(modelId),
        capabilities: ['chat', 'completion'],
        maxTokens: 4096,
        temperature: 0.7,
        enabled: true,
        deleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Store the LLM object in ONE.core
      const storedObject = await storeVersionedObject(llmObject);
      console.log(`[LLMObjectManager] Stored LLM object with hash: ${storedObject.hash}`);
      
      // Cache the object
      this.llmObjects.set(modelId, {
        ...llmObject,
        hash: storedObject.hash,
        idHash: storedObject.idHash
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
  async grantAccessToLLMObject(llmIdHash) {
    try {
      const { createAccess } = await import('@refinio/one.core/lib/access.js');
      const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js');
      
      // Get federation group for access
      const federationGroup = this.nodeOneCore.federationGroup;
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
  getProviderFromModelId(modelId) {
    if (modelId.startsWith('ollama:')) return 'ollama';
    if (modelId.startsWith('claude:')) return 'claude';
    if (modelId.startsWith('gpt:')) return 'openai';
    return 'unknown';
  }
  
  /**
   * Get all LLM objects
   */
  getAllLLMObjects() {
    return Array.from(this.llmObjects.values());
  }
  
  /**
   * Get LLM object by model ID
   */
  getLLMObject(modelId) {
    return this.llmObjects.get(modelId);
  }
  
  /**
   * Check if a personId belongs to an LLM
   */
  isLLMPerson(personId) {
    const personIdStr = personId.toString();
    return Array.from(this.llmObjects.values()).some(
      llm => llm.personId.toString() === personIdStr
    );
  }
}

export default LLMObjectManager;