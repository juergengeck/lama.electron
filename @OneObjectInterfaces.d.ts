/* eslint-disable @typescript-eslint/no-empty-interface */

/**
 * LAMA-specific type declarations for ONE.core objects
 * This extends the @OneObjectInterfaces module with our custom types
 */

declare module '@OneObjectInterfaces' {
    // Add our custom versioned object types
    export interface OneVersionedObjectInterfaces {
        GlobalLLMSettings: GlobalLLMSettings;
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
}