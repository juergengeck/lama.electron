/**
 * TypeScript type definitions for LAMA Electron ONE.core objects
 *
 * This file extends the existing @OneObjectInterfaces with our custom ONE object types
 * following the declaration merging pattern described in ONE.core's README
 */

import type { SHA256IdHash, SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';

declare module '@OneObjectInterfaces' {
    // Subject represents a distinct discussion topic within a conversation
    export interface Subject {
        $type$: 'Subject';
        topicId: string;
        keywords: string[];
        keywordCombination: string;
        description: string;
        confidence: number;
        messageCount: number;
        firstSeen: string;
        lastSeen: string;
        archived: boolean;
    }

    // Keyword extracted from message content
    export interface Keyword {
        $type$: 'Keyword';
        term: string;
        category?: string;
        frequency: number;
        score: number;
        extractedAt: string;
        lastSeen: string;
        subjects: SHA256Hash<Subject>[];
    }

    // Summary of a topic conversation with versioning support
    export interface Summary {
        $type$: 'Summary';
        topicId: string;
        version: number;
        content: string;
        generatedAt: string;
        changeReason?: string;
        previousVersion?: string;
        subjects: SHA256Hash<Subject>[];
    }

    // WordCloudSettings for visualization preferences
    export interface WordCloudSettings {
        $type$: 'WordCloudSettings';
        creator: string;
        created: number;
        modified: number;
        maxWordsPerSubject: number;
        relatedWordThreshold: number;
        minWordFrequency: number;
        showSummaryKeywords: boolean;
        fontScaleMin: number;
        fontScaleMax: number;
        colorScheme: string;
        layoutDensity: string;
    }

    // LLM object type - represents a Language Learning Model configuration
    export interface LLM {
        $type$: 'LLM';
        name: string;
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

        // Required LLM identification fields
        modelId: string;
        isAI: boolean;

        personId?: SHA256IdHash<Person>;
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

    // GlobalLLMSettings - global settings for LLM management
    export interface GlobalLLMSettings {
        $type$: 'GlobalLLMSettings';
        name: string; // Instance ID - this is the ID field
        defaultProvider: string;
        autoSelectBestModel: boolean;
        preferredModelIds: string[];
        defaultModelId: string | null;
        temperature: number;
        maxTokens: number;
        systemPrompt: string;
        streamResponses: boolean;
        autoSummarize: boolean;
        enableMCP: boolean;
        created: number;
        modified: number;
    }

    // Extend ONE.core's ID object interfaces (for objects that can be retrieved by ID)
    interface OneIdObjectInterfaces {
        LLM: Pick<LLM, '$type$' | 'name'>;
        GlobalLLMSettings: GlobalLLMSettings;
    }

    // MessageAssertion for verifiable message credentials
    export interface MessageAssertion {
        $type$: 'MessageAssertion';
        messageId: string;
        messageHash: string;
        text: string;
        timestamp: string;
        sender: string;
        subjects?: string[];
        keywords?: string[];
        version?: number;
        assertedAt: string;
        assertionType: string;
        assertionVersion: string;
    }

    // Import AffirmationCertificate from ONE.models - it's already defined there

    // Extend ONE.core's versioned object interfaces with our types
    interface OneVersionedObjectInterfaces {
        Subject: Subject;
        Keyword: Keyword;
        Summary: Summary;
        WordCloudSettings: WordCloudSettings;
        LLM: LLM;
        GlobalLLMSettings: GlobalLLMSettings;
        MessageAssertion: MessageAssertion;
    }
}