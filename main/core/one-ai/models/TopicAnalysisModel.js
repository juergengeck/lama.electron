/**
 * TopicAnalysisModel - ONE.core Model for topic analysis functionality
 * Following one.leute patterns for proper Model integration
 */

import { Model } from '@refinio/one.models/lib/models/Model.js';
import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';

export default class TopicAnalysisModel extends Model {
    channelManager;
    disconnect;

    // Override base class event
    onUpdated = new OEvent();

    constructor(channelManager) {
        super();
        this.channelManager = channelManager;
    }

    async init() {
        this.state.assertCurrentState('Uninitialised');
        // No need to create a separate channel - we'll use existing conversation channels
        this.disconnect = this.channelManager.onUpdated(this.handleOnUpdated.bind(this));
        this.state.triggerEvent('init');
    }

    async shutdown() {
        this.state.assertCurrentState('Initialised');
        if (this.disconnect) {
            this.disconnect();
        }
        this.state.triggerEvent('shutdown');
    }

    /**
     * Create a Subject object
     */
    async createSubject(topicId, keywords, keywordCombination, description, confidence) {
        this.state.assertCurrentState('Initialised');

        const subjectObj = {
            $type$: 'Subject',
            topicId,
            keywords,
            keywordCombination,
            description,
            confidence,
            messageCount: 0,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
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
    async createKeyword(topicId, term, category, frequency, score) {
        this.state.assertCurrentState('Initialised');

        const keywordObj = {
            $type$: 'Keyword',
            topicId,
            term: term.toLowerCase().trim(),
            category,
            frequency,
            score,
            extractedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            subjects: []
        };

        // Post to the conversation's channel
        await this.channelManager.postToChannel(
            topicId,
            keywordObj
        );

        return keywordObj;
    }

    /**
     * Create a Summary object
     */
    async createSummary(topicId, version, content, subjects, changeReason, previousVersion) {
        this.state.assertCurrentState('Initialised');

        const summaryObj = {
            $type$: 'Summary',
            topicId,
            version,
            content,
            generatedAt: new Date().toISOString(),
            changeReason,
            previousVersion,
            subjects: subjects || []
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
    async getSubjects(topicId, queryOptions = {}) {
        this.state.assertCurrentState('Initialised');
        // Get subjects from the conversation's channel
        const subjects = await this.channelManager.getObjectsWithType('Subject', {
            ...queryOptions,
            channelId: topicId
        });

        // All subjects in this channel belong to this topic
        return subjects;
    }

    /**
     * Get all keywords for a topic
     */
    async getKeywords(topicId, queryOptions = {}) {
        this.state.assertCurrentState('Initialised');
        // Get keywords from the conversation's channel
        return await this.channelManager.getObjectsWithType('Keyword', {
            ...queryOptions,
            channelId: topicId
        });
    }

    /**
     * Get summaries for a topic
     */
    async getSummaries(topicId, queryOptions = {}) {
        this.state.assertCurrentState('Initialised');
        // Get summaries from the conversation's channel
        const summaries = await this.channelManager.getObjectsWithType('Summary', {
            ...queryOptions,
            channelId: topicId
        });

        // All summaries in this channel belong to this topic
        return summaries;
    }

    /**
     * Get current summary for a topic (highest version)
     */
    async getCurrentSummary(topicId) {
        this.state.assertCurrentState('Initialised');
        const summaries = await this.getSummaries(topicId);

        if (summaries.length === 0) {
            return null;
        }

        return summaries.reduce((latest, current) =>
            current.version > latest.version ? current : latest
        );
    }

    /**
     * Iterator for subjects
     */
    async *subjectsIterator(topicId, queryOptions = {}) {
        this.state.assertCurrentState('Initialised');
        yield* this.channelManager.objectIteratorWithType('Subject', {
            ...queryOptions,
            channelId: topicId
        });
    }

    /**
     * Iterator for keywords
     */
    async *keywordsIterator(topicId, queryOptions = {}) {
        this.state.assertCurrentState('Initialised');
        yield* this.channelManager.objectIteratorWithType('Keyword', {
            ...queryOptions,
            channelId: topicId
        });
    }

    /**
     * Find keyword by term in a topic
     */
    async findKeywordByTerm(topicId, term) {
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
    async getOrCreateKeyword(topicId, term, category = null, frequency = 1, score = 0) {
        const existingKeyword = await this.findKeywordByTerm(topicId, term);

        if (existingKeyword) {
            return existingKeyword;
        }

        return await this.createKeyword(topicId, term, category, frequency, score);
    }

    /**
     * Handle channel updates
     */
    async handleOnUpdated(_channelInfoIdHash, channelId, _channelOwner, timeOfEarliestChange) {
        // Emit update for any channel that might contain our analysis objects
        this.onUpdated.emit(timeOfEarliestChange);
    }
}