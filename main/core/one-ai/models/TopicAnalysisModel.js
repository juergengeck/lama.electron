/**
 * TopicAnalysisModel - ONE.core Model for topic analysis functionality
 * Following one.leute patterns for proper Model integration
 */
import { Model } from '@refinio/one.models/lib/models/Model.js';
import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';
import TopicAnalysisRoom from './TopicAnalysisRoom.js';
export default class TopicAnalysisModel extends Model {
    channelManager;
    topicModel;
    channelManager;
    topicModel;
    disconnect;
    // Override base class event
    onUpdated = new OEvent();
    constructor(channelManager, topicModel) {
        super();
        this.channelManager = channelManager;
        this.topicModel = topicModel;
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
        await this.channelManager.postToChannel(topicId, subjectObj);
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
        await this.channelManager.postToChannel(topicId, keywordObj);
        return keywordObj;
    }
    /**
     * Add or update a keyword for a topic
     */
    async addKeyword(topicId, term) {
        this.state.assertCurrentState('Initialised');
        // Check if keyword already exists
        const room = new TopicAnalysisRoom(topicId, this.channelManager);
        const existingKeywords = await room.retrieveAllKeywords();
        const existing = existingKeywords.find((k) => k.term === term.toLowerCase().trim());
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
     * Unarchive a subject
     */
    async unarchiveSubject(topicId, subjectId) {
        this.state.assertCurrentState('Initialised');
        const room = new TopicAnalysisRoom(topicId, this.channelManager);
        const subjects = await room.retrieveAllSubjects();
        const subject = subjects.find((s) => s.id === subjectId);
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
        await this.channelManager.postToChannel(topicId, summaryObj);
        return summaryObj;
    }
    /**
     * Get all subjects for a topic
     */
    async getSubjects(topicId, queryOptions = {}) {
        this.state.assertCurrentState('Initialised');
        // Use TopicAnalysisRoom to retrieve subjects
        const analysisRoom = new TopicAnalysisRoom(topicId, this.channelManager);
        const subjects = await analysisRoom.retrieveAllSubjects();
        console.log('[TopicAnalysisModel] Retrieved subjects:', {
            topicId,
            subjectCount: subjects.length
        });
        return subjects;
    }
    /**
     * Get all keywords for a topic
     */
    async getKeywords(topicId, queryOptions = {}) {
        this.state.assertCurrentState('Initialised');
        // Use TopicAnalysisRoom to retrieve keywords
        const analysisRoom = new TopicAnalysisRoom(topicId, this.channelManager);
        const keywords = await analysisRoom.retrieveAllKeywords();
        console.log('[TopicAnalysisModel] Retrieved keywords:', {
            topicId,
            keywordCount: keywords.length
        });
        return keywords;
    }
    /**
     * Get summaries for a topic
     */
    async getSummaries(topicId, queryOptions = {}) {
        this.state.assertCurrentState('Initialised');
        // Use TopicAnalysisRoom to retrieve summaries
        const analysisRoom = new TopicAnalysisRoom(topicId, this.channelManager);
        const summaries = await analysisRoom.retrieveAllSummaries();
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
    async getCurrentSummary(topicId) {
        this.state.assertCurrentState('Initialised');
        // Use TopicAnalysisRoom to retrieve the latest summary directly
        const analysisRoom = new TopicAnalysisRoom(topicId, this.channelManager);
        const summary = await analysisRoom.retrieveLatestSummary();
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
    async *subjectsIterator(topicId, queryOptions = {}) {
        this.state.assertCurrentState('Initialised');
        const subjects = await this.getSubjects(topicId, queryOptions);
        for (const subject of subjects) {
            yield subject;
        }
    }
    /**
     * Iterator for keywords
     */
    async *keywordsIterator(topicId, queryOptions = {}) {
        this.state.assertCurrentState('Initialised');
        const keywords = await this.getKeywords(topicId, queryOptions);
        for (const keyword of keywords) {
            yield keyword;
        }
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
    /**
     * Update topic summary with incremental changes
     * @param {string} topicId - The topic ID
     * @param {string} updateContent - The incremental update content
     * @param {number} confidence - Confidence score for the update
     * @returns {Promise<Object>} The updated summary object
     */
    async updateSummary(topicId, updateContent, confidence = 0.8) {
        // Get current summary
        const currentSummary = await this.getCurrentSummary(topicId);
        if (!currentSummary) {
            // Create first summary if none exists
            const subjects = await this.getSubjects(topicId);
            return await this.createSummary(topicId, 1, updateContent, subjects.map((s) => s.id), 'Initial summary from message analysis', null);
        }
        // Create new version with incremental update
        const newVersion = currentSummary.version + 1;
        const subjects = await this.getSubjects(topicId);
        // Combine existing content with update
        const updatedContent = currentSummary.content + '\n\nUpdate: ' + updateContent;
        return await this.createSummary(topicId, newVersion, updatedContent, subjects.map((s) => s.id), 'Incremental update from message analysis', currentSummary.id);
    }
    /**
     * Get keyword with access states
     * Loads keyword data and associated access states for keyword detail view
     * @param {string} keyword - The keyword term to retrieve
     * @param {string} [topicId] - Optional topic ID to filter by
     * @returns {Promise<Object|null>} Keyword object with accessStates array, or null if not found
     */
    async getKeywordWithAccessStates(keyword, topicId = null) {
        this.state.assertCurrentState('Initialised');
        if (!keyword || typeof keyword !== 'string') {
            throw new Error('[KeywordDetail] keyword is required and must be a string');
        }
        const normalizedKeyword = keyword.toLowerCase().trim();
        // Get keywords from the topic
        let keywords;
        if (topicId) {
            keywords = await this.getKeywords(topicId);
        }
        else {
            // Get all keywords across all topics
            keywords = await this.getAllKeywords();
        }
        // Find the specific keyword
        const foundKeyword = keywords.find((k) => k.term === normalizedKeyword);
        if (!foundKeyword) {
            console.log(`[KeywordDetail] Keyword "${normalizedKeyword}" not found${topicId ? ` in topic ${topicId}` : ''}`);
            return null;
        }
        // Load access states for this keyword
        const { getAccessStatesByKeyword } = await import('../storage/keyword-access-storage.js');
        const accessStates = await getAccessStatesByKeyword(this.channelManager, normalizedKeyword);
        console.log(`[KeywordDetail] Retrieved keyword "${normalizedKeyword}" with ${accessStates.length} access states`);
        return {
            ...foundKeyword,
            accessStates
        };
    }
    /**
     * Get all keywords across all topics
     * Used for global keyword search and management
     * @returns {Promise<Array>} Array of all keyword objects
     */
    async getAllKeywords() {
        this.state.assertCurrentState('Initialised');
        // Since keywords are stored per topic, we need to aggregate across all topics
        // This requires iterating through all channels and collecting keywords
        // For now, we'll use TopicAnalysisRoom to get keywords from known topics
        // In a production system, you'd want proper indexing
        const allKeywords = [];
        const seenTerms = new Set();
        // Get all channel infos
        const channels = await this.channelManager.getChannels();
        for (const channel of channels) {
            try {
                const room = new TopicAnalysisRoom(channel.id, this.channelManager);
                const keywords = await room.retrieveAllKeywords();
                for (const keyword of keywords) {
                    // Deduplicate by term
                    if (!seenTerms.has(keyword.term)) {
                        seenTerms.add(keyword.term);
                        allKeywords.push(keyword);
                    }
                }
            }
            catch (error) {
                console.error(`[KeywordDetail] Error retrieving keywords from channel ${channel.id}:`, error);
            }
        }
        console.log(`[KeywordDetail] Retrieved ${allKeywords.length} unique keywords across all topics`);
        return allKeywords;
    }
    /**
     * Get subjects that contain a specific keyword
     * @param {string} keyword - The keyword term to search for
     * @param {string} [topicId] - Optional topic ID to filter by
     * @returns {Promise<Array>} Array of subject objects containing the keyword
     */
    async getSubjectsForKeyword(keyword, topicId = null) {
        this.state.assertCurrentState('Initialised');
        if (!keyword || typeof keyword !== 'string') {
            throw new Error('[KeywordDetail] keyword is required and must be a string');
        }
        const normalizedKeyword = keyword.toLowerCase().trim();
        // Get subjects from the topic or all topics
        let subjects;
        if (topicId) {
            subjects = await this.getSubjects(topicId);
        }
        else {
            // Get all subjects across all topics
            subjects = await this.getAllSubjects();
        }
        // Filter subjects that contain the keyword in their keywordCombination
        const matchingSubjects = subjects.filter((subject) => {
            const combination = subject.keywordCombination.toLowerCase();
            // Check if keyword is in the combination
            // Keywords in combination are joined with '+', so we need to check each part
            const keywords = combination.split('+');
            return keywords.includes(normalizedKeyword);
        });
        console.log(`[KeywordDetail] Found ${matchingSubjects.length} subjects containing keyword "${normalizedKeyword}"${topicId ? ` in topic ${topicId}` : ''}`);
        return matchingSubjects;
    }
    /**
     * Get all subjects across all topics
     * Helper method for global subject queries
     * @returns {Promise<Array>} Array of all subject objects
     */
    async getAllSubjects() {
        this.state.assertCurrentState('Initialised');
        const allSubjects = [];
        // Get all channel infos
        const channels = await this.channelManager.getChannels();
        for (const channel of channels) {
            try {
                const room = new TopicAnalysisRoom(channel.id, this.channelManager);
                const subjects = await room.retrieveAllSubjects();
                allSubjects.push(...subjects);
            }
            catch (error) {
                console.error(`[KeywordDetail] Error retrieving subjects from channel ${channel.id}:`, error);
            }
        }
        console.log(`[KeywordDetail] Retrieved ${allSubjects.length} subjects across all topics`);
        return allSubjects;
    }
}
