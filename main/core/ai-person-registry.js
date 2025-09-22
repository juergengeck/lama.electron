/**
 * AI Person Registry
 * Maintains a persistent registry of AI person IDs
 * Stores in local settings to persist across sessions
 */

class AIPersonRegistry {
  constructor(nodeOneCore) {
    this.nodeOneCore = nodeOneCore;
    this.aiPersons = new Map(); // personId -> metadata
    this.initialized = false;
    this.STORAGE_KEY = 'ai-person-registry';
  }

  /**
   * Initialize the registry by loading from persistent storage
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Load from settings store if available
      if (this.nodeOneCore?.settingsStore) {
        const stored = await this.nodeOneCore.settingsStore.get(this.STORAGE_KEY);
        if (stored && typeof stored === 'object') {
          // Restore the registry from storage
          Object.entries(stored).forEach(([personId, metadata]) => {
            this.aiPersons.set(personId, metadata);
            console.log(`[AIPersonRegistry] Restored AI person ${personId.substring(0, 8)}...`);
          });
        }
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
  async registerAIPerson(personId, metadata = {}) {
    if (!personId) return;

    const personIdStr = personId.toString();

    // Add to registry
    this.aiPersons.set(personIdStr, {
      ...metadata,
      registeredAt: Date.now(),
      lastSeen: Date.now()
    });

    console.log(`[AIPersonRegistry] Registered AI person ${personIdStr.substring(0, 8)}...`);

    // Persist to storage
    await this.persist();
  }

  /**
   * Check if a person is registered as AI
   */
  isAIPerson(personId) {
    if (!personId) return false;
    const personIdStr = personId.toString();
    return this.aiPersons.has(personIdStr);
  }

  /**
   * Get all registered AI persons
   */
  getAllAIPersons() {
    return Array.from(this.aiPersons.entries()).map(([id, metadata]) => ({
      personId: id,
      ...metadata
    }));
  }

  /**
   * Update last seen time for an AI person
   */
  updateLastSeen(personId) {
    if (!personId) return;
    const personIdStr = personId.toString();

    if (this.aiPersons.has(personIdStr)) {
      const metadata = this.aiPersons.get(personIdStr);
      metadata.lastSeen = Date.now();
      this.aiPersons.set(personIdStr, metadata);
    }
  }

  /**
   * Persist registry to storage
   */
  async persist() {
    try {
      if (this.nodeOneCore?.settingsStore) {
        // Convert Map to plain object for storage
        const toStore = {};
        this.aiPersons.forEach((metadata, personId) => {
          toStore[personId] = metadata;
        });

        await this.nodeOneCore.settingsStore.set(this.STORAGE_KEY, toStore);
        console.log(`[AIPersonRegistry] Persisted ${this.aiPersons.size} AI persons`);
      }
    } catch (error) {
      console.error('[AIPersonRegistry] Failed to persist:', error);
    }
  }

  /**
   * Clear the registry (for testing/reset)
   */
  async clear() {
    this.aiPersons.clear();
    await this.persist();
    console.log('[AIPersonRegistry] Cleared registry');
  }
}

export default AIPersonRegistry;