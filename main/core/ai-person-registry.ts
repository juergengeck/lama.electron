/**
 * AI Person Registry
 * Maintains a persistent registry of AI person IDs
 * Stores in local settings to persist across sessions
 */

import { SettingsStore } from '@refinio/one.core/lib/system/settings-store.js';
import type { NodeOneCore } from '../types/one-core.js'

class AIPersonRegistry {

  nodeOneCore: NodeOneCore;
  aiPersons: Map<string, Record<string, unknown>>;
  initialized: boolean;
  STORAGE_KEY: string;

  constructor(nodeOneCore: NodeOneCore) {
    this.nodeOneCore = nodeOneCore;
    this.aiPersons = new Map(); // personId -> metadata
    this.initialized = false;
    this.STORAGE_KEY = 'ai-person-registry';
}

  /**
   * Initialize the registry by loading from persistent storage
   */
  async initialize(): Promise<any> {
    if (this.initialized) return;

    try {
      // Load from settings store if available
      const stored = await SettingsStore.getItem(this.STORAGE_KEY);
      if (stored && typeof stored === 'object') {
        // Restore the registry from storage
        const storedObj = stored as Record<string, Record<string, unknown>>;
        Object.entries(storedObj).forEach(([personId, metadata]) => {
          (this.aiPersons as any)?.set(personId, metadata);
          console.log(`[AIPersonRegistry] Restored AI person ${String(personId).substring(0, 8)}...`);
        });
      }

      this.initialized = true;
      console.log(`[AIPersonRegistry] ✅ Initialized with ${this.aiPersons.size} AI persons`);
    } catch (error) {
      console.error('[AIPersonRegistry] Failed to initialize:', error);
      this.initialized = true; // Continue anyway
    }
  }

  /**
   * Register a person as AI
   */
  async registerAIPerson(personId: any, metadata = {}): Promise<void> {
    if (!personId) return;

    const personIdStr = personId.toString();

    // Add to registry
    (this.aiPersons as any)?.set(personIdStr, {
      ...metadata,
      registeredAt: Date.now(),
      lastSeen: Date.now()
    });

    console.log(`[AIPersonRegistry] Registered AI person ${String(personIdStr).substring(0, 8)}...`);

    // Persist to storage
    await this.persist();
  }

  /**
   * Check if a person is registered as AI
   */
  isAIPerson(personId: any): any {
    if (!personId) return false;
    const personIdStr = personId.toString();
    return this.aiPersons.has(personIdStr);
  }

  /**
   * Get all registered AI persons
   */
  getAllAIPersons(): any {
    return Array.from(this.aiPersons.entries()).map(([id, metadata]) => ({
      personId: id,
      ...metadata
    }));
  }

  /**
   * Update last seen time for an AI person
   */
  updateLastSeen(personId: any): any {
    if (!personId) return;
    const personIdStr = personId.toString();

    if (this.aiPersons.has(personIdStr)) {
      const metadata = (this.aiPersons as any)?.get(personIdStr);
      if (metadata) metadata.lastSeen = Date.now();
      (this.aiPersons as any)?.set(personIdStr, metadata);
    }
  }

  /**
   * Persist registry to storage
   */
  async persist(): Promise<any> {
    try {
      // Convert Map to plain object for storage
      const toStore: Record<string, Record<string, unknown>> = {};
      this.aiPersons.forEach((metadata: any, personId: any) => {
        toStore[personId] = metadata;
      });

      await SettingsStore.setItem(this.STORAGE_KEY, toStore);
      console.log(`[AIPersonRegistry] Persisted ${this.aiPersons.size} AI persons`)
    } catch (error) {
      console.error('[AIPersonRegistry] Failed to persist:', error);
    }
  }

  /**
   * Clear the registry (for testing/reset)
   */
  async clear(): Promise<any> {
    this.aiPersons.clear();
    await this.persist();
    console.log('[AIPersonRegistry] Cleared registry');
  }
}

export default AIPersonRegistry;