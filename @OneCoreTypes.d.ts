/**
 * TypeScript type definitions for LAMA Electron ONE.core objects
 *
 * This file extends the existing @OneObjectInterfaces with our AI topic analysis types
 * following the declaration merging pattern used in this project
 */

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

    // Extend ONE.core's versioned object interfaces with our types
    interface OneVersionedObjectInterfaces {
        Subject: Subject;
        Keyword: Keyword;
        Summary: Summary;
        WordCloudSettings: WordCloudSettings;
    }
}