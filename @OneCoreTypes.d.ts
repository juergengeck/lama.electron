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
    // Tracks temporal ranges when the subject was discussed
    export interface Subject {
        $type$: 'Subject';
        id: string; // keyword combination (e.g., "pizza+baker+career")
        topic: string; // reference to parent topic (channel ID)
        keywords: string[];
        timeRanges: Array<{
            start: number;
            end: number;
        }>;
        messageCount: number;
        createdAt: number;
        lastSeenAt: number;
        archived?: boolean;
    }

    // Keyword extracted from message content
    export interface Keyword {
        $type$: 'Keyword';
        term: string; // ID field - deterministic lookup
        frequency: number;
        subjects: string[]; // Subject IDs (keyword combinations)
        score?: number;
        createdAt: number;
        lastSeen: number;
    }

    // Summary of a topic conversation with versioning support
    export interface Summary {
        $type$: 'Summary';
        id: string; // format: ${topicId}-v${version}
        topic: string; // reference to parent topic
        content: string;
        subjects: string[]; // Subject IDs
        keywords: string[]; // All keywords from all subjects
        version: number;
        previousVersion?: string; // Hash of previous summary
        createdAt: number;
        updatedAt: number;
        changeReason?: string;
        hash?: string;
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

        // personId being present = this is an AI contact
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
        defaultModelId?: string;
        temperature?: number;
        maxTokens?: number;
        systemPrompt?: string;
        streamResponses?: boolean;
        autoSummarize?: boolean;
        enableMCP?: boolean;
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