/* eslint-disable @typescript-eslint/no-empty-interface */

/**
 * LAMA-specific type declarations for ONE.core objects
 * This extends the @OneObjectInterfaces module with our custom types
 */

declare module '@OneObjectInterfaces' {
    // Add our custom versioned object types
    export interface OneVersionedObjectInterfaces {
        GlobalLLMSettings: GlobalLLMSettings;
        Keyword: Keyword;
    }

    // Add our custom ID object types
    export interface OneIdObjectInterfaces {
        LLM: LLM;
    }

    // Define our custom object interfaces
    export interface GlobalLLMSettings {
        $type$: 'GlobalLLMSettings';
        name: string; // Instance ID - this is the ID field
        defaultModelId?: string;
        temperature?: number;
        maxTokens?: number;
        created: number;
        modified: number;
        defaultProvider: string;
        autoSelectBestModel: boolean;
        preferredModelIds: string[];
        systemPrompt?: string;
        streamResponses?: boolean;
        autoSummarize?: boolean;
        enableMCP?: boolean;
    }

    export interface LLM {
        $type$: 'LLM';
        modelId: string;
        name: string;
        provider: string;
        endpoint?: string;
        apiKey?: string;
        temperature?: number;
        maxTokens?: number;
        contextSize?: number;
        isAI: boolean;
    }

    export interface Keyword {
        $type$: 'Keyword';
        term: string; // ID property - normalized keyword term
        frequency: number;
        subjects: string[]; // Array of subject IDs
        score?: number;
        createdAt: number; // Unix timestamp
        lastSeen: number; // Unix timestamp
    }
}