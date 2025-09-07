/**
 * TypeScript declarations for LAMA ONE objects
 * These declarations are required for ONE.core to properly handle our custom object types
 */

declare module '@OneObjectInterfaces' {
    import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
    import type { Person } from '@refinio/one.core/lib/recipes.js';

    // No unversioned objects - StateEntry is now versioned

    // Merge our versioned objects into the ONE.core type system
    export interface OneVersionedObjectInterfaces {
        LLM: LLM;
        LLMSettings: LLMSettings;
        GlobalLLMSettings: GlobalLLMSettings;
        AppStateJournal: AppStateJournal;
        StateEntry: StateEntry;
    }

    // Define ID objects for versioned objects
    export interface OneIdObjectInterfaces {
        LLM: Pick<LLM, '$type$' | 'name'>;  // 'name' is the ID field
        LLMSettings: Pick<LLMSettings, '$type$'>;
        GlobalLLMSettings: Pick<GlobalLLMSettings, '$type$'>;
    }

    // LLM object interface matching the LAMA mobile app structure
    export interface LLM {
        $type$: 'LLM';
        name: string;  // This is the ID field
        filename: string;
        modelType: 'local' | 'remote';
        active: boolean;
        deleted: boolean;
        creator?: string;
        created: number;
        modified: number;
        createdAt: string;
        lastUsed: string;
        lastInitialized?: number;
        usageCount?: number;
        size?: number;
        personId?: SHA256IdHash;
        capabilities?: Array<'chat' | 'inference'>;
        
        // Model parameters
        temperature?: number;
        maxTokens?: number;
        contextSize?: number;
        batchSize?: number;
        threads?: number;
        mirostat?: number;
        topK?: number;
        topP?: number;
        
        // Optional properties
        architecture?: string;
        contextLength?: number;
        quantization?: string;
        checksum?: string;
        provider?: string;
        downloadUrl?: string;
    }

    export interface LLMSettings {
        $type$: 'LLMSettings';
        selectedLLMId?: string;
        enabledLLMs?: string[];
        defaultSystemPrompt?: string;
    }

    export interface GlobalLLMSettings {
        $type$: 'GlobalLLMSettings';
        defaultProvider?: string;
        autoSelectBestModel?: boolean;
        maxConcurrentRequests?: number;
    }

    // State Entry for the journal
    export interface StateEntry {
        $type$: 'StateEntry';
        timestamp: number;
        source: 'browser' | 'nodejs';
        path: string;
        value: string;
        previousValue?: string;
        author: SHA256IdHash<Person>;
        metadata?: {
            action?: string;
            description?: string;
        };
    }

    // App State Journal - CRDT for state synchronization
    export interface AppStateJournal {
        $type$: 'AppStateJournal';
        id: 'AppStateJournal';
        entries: Set<SHA256Hash<StateEntry>>;
        lastSync?: number;
        browserState?: string;
        nodejsState?: string;
    }
}