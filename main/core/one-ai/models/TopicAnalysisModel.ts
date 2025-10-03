import type { ChannelManager } from '@refinio/one.models/lib/models/index.js';
/**
 * TopicAnalysisModel - ONE.core Model for topic analysis functionality
 * Following one.leute patterns for proper Model integration
 */

import { Model } from '@refinio/one.models/lib/models/Model.js';
import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';
import TopicAnalysisRoom from './TopicAnalysisRoom.js';

export default class TopicAnalysisModel extends Model {
  public channelManager: any;
  public topicModel: any;
  public disconnect: any;

    // Override base class event
    override onUpdated = new OEvent();

    // Cache for expensive queries (5-second TTL)
    private keywordsCache = new Map<string, { data: any[]; timestamp: number }>();
    private subjectsCache = new Map<string, { data: any[]; timestamp: number }>();
    private readonly CACHE_TTL = 5000; // 5 seconds

    constructor(channelManager: any, topicModel: any) {
        super();
        this.channelManager = channelManager;
        this.topicModel = topicModel;
}

    async init(): Promise<any> {
        this.state.assertCurrentState('Uninitialised');
        // No need to create a separate channel - we'll use existing conversation channels
        this.disconnect = this.channelManager.onUpdated(this.handleOnUpdated.bind(this));
        this.state.triggerEvent('init');
    }

    async shutdown(): Promise<any> {
        this.state.assertCurrentState('Initialised');
        if (this.disconnect) {
            this.disconnect();
        }
        this.state.triggerEvent('shutdown');
    }

    /**
     * Create a Subject object
     */
    async createSubject(topicId: any, keywords: any, keywordCombination: any, description: any, confidence: any): Promise<any> {
        this.state.assertCurrentState('Initialised');

        const subjectObj = {
            $type$: 'Subject',
            id: keywordCombination, // Use keyword combination as ID
            topic: topicId,
            keywords: keywords || [],
            messageCount: 0,
            timestamp: Date.now(),
            archived: false
        };

        // Post to the conversation's channel, not a separate analysis channel
        await this.channelManager.postToChannel(
            topicId,
            subjectObj
        );

        return subjectObj;
    }

    /**
     * Create a Keyword object in the topic's channel
     */
    async createKeyword(topicId: any, term: any, category: any, frequency: any, score: any): Promise<any> {
        this.state.assertCurrentState('Initialised');

        const now = Date.now();
        const keywordObj = {
            $type$: 'Keyword',
            term: term.toLowerCase().trim(),
            frequency: frequency || 1,
            subjects: [],
            score: score || undefined,
            createdAt: now,
            lastSeen: now
        };

        // Post to the conversation's channel
        await this.channelManager.postToChannel(
            topicId,
            keywordObj
        );

        return keywordObj;
    }

    /**
     * Add or update a keyword for a topic
     */
    async addKeyword(topicId: any, term: any): Promise<any> {
        this.state.assertCurrentState('Initialised');

        // Check if keyword already exists
        const room = new TopicAnalysisRoom(topicId, this.channelManager);
        const existingKeywords: any = await (room as any).retrieveAllKeywords();
        const existing = existingKeywords.find((k: any) => k.term === term.toLowerCase().trim());

        if (existing) {
            // Update frequency
            existing.frequency = (existing.frequency || 0) + 1;
            existing.lastSeen = new Date().toISOString();
            await this.channelManager.postToChannel(topicId, existing);
            return existing;
        }

        // Create new keyword
        return await this.createKeyword(topicId, term, 'general', 1, 1.0);
    }

    /**
     * Add or update a keyword linked to a specific subject
     * This enforces the rule: all keywords must belong to a subject
     */
    async addKeywordToSubject(topicId: any, term: any, subjectKeywordCombination: any): Promise<any> {
        this.state.assertCurrentState('Initialised');

        // Check if keyword already exists
        const room = new TopicAnalysisRoom(topicId, this.channelManager);
        const existingKeywords: any = await (room as any).retrieveAllKeywords();
        const normalizedTerm = term.toLowerCase().trim();
        const existing = existingKeywords.find((k: any) => k.term === normalizedTerm);

        if (existing) {
            // Update frequency and link to subject if not already linked
            existing.frequency = (existing.frequency || 0) + 1;
            existing.lastSeen = new Date().toISOString();
            if (!existing.subjects) {
                existing.subjects = [];
            }
            if (!existing.subjects.includes(subjectKeywordCombination)) {
                existing.subjects.push(subjectKeywordCombination);
            }
            await this.channelManager.postToChannel(topicId, existing);
            return existing;
        }

        // Create new keyword linked to subject
        const keywordObj = {
            $type$: 'Keyword',
            topicId,
            term: normalizedTerm,
            category: 'subject-keyword',
            frequency: 1,
            score: 1.0,
            extractedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            subjects: [subjectKeywordCombination] // Link to subject
        };

        await this.channelManager.postToChannel(topicId, keywordObj);
        return keywordObj;
    }

    /**
     * Unarchive a subject
     */
    async unarchiveSubject(topicId: any, subjectId: any): Promise<any> {
        this.state.assertCurrentState('Initialised');

        const room = new TopicAnalysisRoom(topicId, this.channelManager);
        const subjects: any = await (room as any).retrieveAllSubjects();
        const subject = subjects.find((s: any) => s.id === subjectId);

        if (subject) {
            subject.archived = false;
            subject.lastSeen = new Date().toISOString();
            await this.channelManager.postToChannel(topicId, subject);
            return subject;
        }

        return null;
    }

    /**
     * Create a Summary object
     */
    async createSummary(topicId: any, version: any, content: any, subjects: any, changeReason: any, previousVersion: any): Promise<any> {
        this.state.assertCurrentState('Initialised');

        const now = Date.now();
        const summaryObj = {
            $type$: 'Summary',
            id: `${topicId}-v${version}`, // ID format: topicId-v1, topicId-v2, etc
            topic: topicId,
            content,
            subjects: subjects || [],
            keywords: [], // Will be populated from subjects
            version,
            previousVersion: previousVersion || undefined,
            createdAt: now,
            updatedAt: now,
            changeReason: changeReason || undefined
        };

        // Post to the conversation's channel
        await this.channelManager.postToChannel(
            topicId,
            summaryObj
        );

        return summaryObj;
    }

    /**
     * Get all subjects for a topic
     */
    async getSubjects(topicId: any, queryOptions = {}): Promise<unknown> {
        this.state.assertCurrentState('Initialised');

        // Check cache
        const cached = this.subjectsCache.get(topicId);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            console.log('[TopicAnalysisModel] ⚡ Returning cached subjects:', {
                topicId,
                subjectCount: cached.data.length
            });
            return cached.data;
        }

        // Use TopicAnalysisRoom to retrieve subjects
        const analysisRoom = new TopicAnalysisRoom(topicId, this.channelManager);
        const subjects: any = await (analysisRoom as any).retrieveAllSubjects();

        // Cache the result
        this.subjectsCache.set(topicId, {
            data: subjects,
            timestamp: Date.now()
        });

        console.log('[TopicAnalysisModel] Retrieved subjects:', {
            topicId,
            subjectCount: subjects.length
        });

        return subjects;
    }

    /**
     * Get all keywords for a topic
     */
    async getKeywords(topicId: any, queryOptions = {}): Promise<unknown> {
        this.state.assertCurrentState('Initialised');

        // Check cache
        const cached = this.keywordsCache.get(topicId);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            console.log('[TopicAnalysisModel] ⚡ Returning cached keywords:', {
                topicId,
                keywordCount: cached.data.length
            });
            return cached.data;
        }

        // Use TopicAnalysisRoom to retrieve keywords
        const analysisRoom = new TopicAnalysisRoom(topicId, this.channelManager);
        const keywords: any = await (analysisRoom as any).retrieveAllKeywords();

        // Cache the result
        this.keywordsCache.set(topicId, {
            data: keywords,
            timestamp: Date.now()
        });

        console.log('[TopicAnalysisModel] Retrieved keywords:', {
            topicId,
            keywordCount: keywords.length
        });

        return keywords;
    }

    /**
     * Get a single keyword by term (optimized - uses ID hash lookup)
     */
    async getKeywordByTerm(topicId: any, term: string): Promise<any | null> {
        this.state.assertCurrentState('Initialised');

        const normalizedTerm = term.toLowerCase().trim();

        // Use ONE.core's getObjectByIdHash for O(1) lookup
        // Since term is marked as isId in the recipe, we can look up by term directly
        const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
        const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/util/object.js');

        try {
            // Calculate the ID hash from the term (which is the ID)
            // Since term is the ID field, we can use it directly to calculate the ID hash
            // Note: Only the ID field (term) is used for the hash, but we need valid values for all required fields
            const idHash = await calculateIdHashOfObj({
                $type$: 'Keyword' as const,
                term: normalizedTerm,
                frequency: 0,
                subjects: [],
                createdAt: 0,
                lastSeen: 0
            } as any);
            const result = await getObjectByIdHash(idHash as any);

            console.log('[TopicAnalysisModel] ⚡ Retrieved keyword by ID hash:', {
                topicId,
                term: normalizedTerm,
                found: !!result?.obj
            });

            return result?.obj || null;
        } catch (error) {
            console.log('[TopicAnalysisModel] Keyword not found:', {
                topicId,
                term: normalizedTerm,
                error: (error as Error).message
            });
            return null;
        }
    }

    /**
     * Find subjects that contain a specific keyword
     * This enables subject lookup from keywords
     */
    async findSubjectsByKeyword(topicId: any, keyword: any): Promise<any[]> {
        this.state.assertCurrentState('Initialised');

        const normalizedKeyword = keyword.toLowerCase().trim();
        const subjects: any = await this.getSubjects(topicId);

        // Find all subjects that have this keyword
        const matchingSubjects = subjects.filter((subject: any) =>
            subject.keywords?.some((k: any) => k.toLowerCase() === normalizedKeyword)
        );

        console.log('[TopicAnalysisModel] Found subjects by keyword:', {
            topicId,
            keyword: normalizedKeyword,
            matchCount: matchingSubjects.length
        });

        return matchingSubjects;
    }

    /**
     * Get the keyword object and its associated subjects
     */
    async getKeywordWithSubjects(topicId: any, term: any): Promise<any> {
        this.state.assertCurrentState('Initialised');

        const normalizedTerm = term.toLowerCase().trim();
        const keywords: any = await this.getKeywords(topicId);
        const keyword = keywords.find((k: any) => k.term === normalizedTerm);

        if (!keyword) {
            return null;
        }

        // Get subjects associated with this keyword
        const subjectKeywordCombinations = keyword.subjects || [];
        const allSubjects: any = await this.getSubjects(topicId);
        const associatedSubjects = allSubjects.filter((s: any) =>
            subjectKeywordCombinations.includes(s.keywordCombination)
        );

        return {
            ...keyword,
            associatedSubjects
        };
    }

    /**
     * Get summaries for a topic
     */
    async getSummaries(topicId: any, queryOptions = {}): Promise<unknown> {
        this.state.assertCurrentState('Initialised');

        // Use TopicAnalysisRoom to retrieve summaries
        const analysisRoom = new TopicAnalysisRoom(topicId, this.channelManager);
        const summaries: any = await (analysisRoom as any).retrieveAllSummaries();

        console.log('[TopicAnalysisModel] Retrieved summaries:', {
            topicId,
            summaryCount: summaries.length,
            latestVersion: summaries.length > 0 ? summaries[0].version : null
        });

        return summaries;
    }

    /**
     * Get current summary for a topic (highest version)
     */
    async getCurrentSummary(topicId: any): Promise<any> {
        this.state.assertCurrentState('Initialised');

        // Use TopicAnalysisRoom to retrieve the latest summary directly
        const analysisRoom = new TopicAnalysisRoom(topicId, this.channelManager);
        const summary: any = await (analysisRoom as any).retrieveLatestSummary();

        console.log('[TopicAnalysisModel] Retrieved current summary:', {
            topicId,
            found: !!summary,
            version: summary?.version,
            contentLength: summary?.content?.length
        });

        return summary;
    }

    /**
     * Iterator for subjects
     */
    async *subjectsIterator(topicId: any, queryOptions = {}) {
        this.state.assertCurrentState('Initialised');

        const subjects: any = await this.getSubjects(topicId, queryOptions);
        for (const subject of subjects) {
            yield subject;
        }
    }

    /**
     * Iterator for keywords
     */
    async *keywordsIterator(topicId: any, queryOptions = {}) {
        this.state.assertCurrentState('Initialised');

        const keywords: any = await this.getKeywords(topicId, queryOptions);
        for (const keyword of keywords) {
            yield keyword;
        }
    }

    /**
     * Find keyword by term in a topic
     */
    async findKeywordByTerm(topicId: any, term: any): Promise<any> {
        this.state.assertCurrentState('Initialised');
        const normalizedTerm = term.toLowerCase().trim();

        for await (const keyword of this.keywordsIterator(topicId)) {
            if (keyword.term === normalizedTerm) {
                return keyword;
            }
        }

        return null;
    }

    /**
     * Get or create keyword
     */
    async getOrCreateKeyword(topicId: any, term: any, category = null, frequency = 1, score = 0): Promise<unknown> {
        const existingKeyword: any = await this.findKeywordByTerm(topicId, term);

        if (existingKeyword) {
            return existingKeyword;
        }

        return await this.createKeyword(topicId, term, category, frequency, score);
    }

    /**
     * Handle channel updates
     */
    async handleOnUpdated(_channelInfoIdHash: any, channelId: any, _channelOwner: any, timeOfEarliestChange: any): Promise<any> {
        // Emit update for any channel that might contain our analysis objects
        this.onUpdated.emit(timeOfEarliestChange);
    }

    /**
     * Update topic summary with incremental changes
     * @param {string} topicId - The topic ID
     * @param {string} updateContent - The incremental update content
     * @param {number} confidence - Confidence score for the update
     * @returns {Promise<Object>} The updated summary object
     */
    async updateSummary(topicId: any, updateContent: any, confidence = 0.8): Promise<unknown> {
        // Get current summary
        const currentSummary: any = await this.getCurrentSummary(topicId);

        if (!currentSummary) {
            // Create first summary if none exists
            const subjects: any = await this.getSubjects(topicId);
            return await this.createSummary(
                topicId,
                1,
                updateContent,
                subjects.map((s: any) => s.id),
                'Initial summary from message analysis',
                null
            );
        }

        // Create new version with incremental update
        const newVersion = currentSummary.version + 1;
        const subjects: any = await this.getSubjects(topicId);

        // Combine existing content with update
        const updatedContent = currentSummary.content + '\n\nUpdate: ' + updateContent;

        return await this.createSummary(
            topicId,
            newVersion,
            updatedContent,
            subjects.map((s: any) => s.id),
            'Incremental update from message analysis',
            currentSummary.id
        );
    }
}