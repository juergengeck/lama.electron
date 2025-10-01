/**
 * IPC Handlers for Keyword Detail Preview
 * Handles keyword detail operations including access control
 *
 * Implements Phase 2 (IPC Layer) for spec 015-keyword-detail-preview
 */

import nodeOneCoreInstance from '../../core/node-one-core.js';
import TopicAnalysisModel from '../../core/one-ai/models/TopicAnalysisModel.js';
import * as keywordAccessStorage from '../../core/one-ai/storage/keyword-access-storage.ts';
import * as keywordEnrichment from '../../services/keyword-enrichment.js';

// Singleton model instance
let topicAnalysisModel = null;

// Cache for getKeywordDetails (5-second TTL)
const detailsCache = new Map();
const CACHE_TTL = 5000; // 5 seconds

/**
 * Initialize TopicAnalysisModel singleton
 */
async function initializeModel() {
    if (topicAnalysisModel) {
        if (topicAnalysisModel.state.currentState === 'Initialised') {
            return topicAnalysisModel;
        }
        if (topicAnalysisModel.state.currentState === 'Initialising') {
            await new Promise(resolve => setTimeout(resolve, 100));
            return initializeModel();
        }
    }

    if (!nodeOneCoreInstance?.initialized) {
        throw new Error('ONE.core not initialized');
    }

    const channelManager = nodeOneCoreInstance.channelManager;
    if (!channelManager) {
        throw new Error('ChannelManager not available');
    }

    const topicModel = nodeOneCoreInstance.topicModel;
    if (!topicModel) {
        throw new Error('TopicModel not available');
    }

    if (!topicAnalysisModel) {
        topicAnalysisModel = new TopicAnalysisModel(channelManager, topicModel);
    }

    if (topicAnalysisModel.state.currentState === 'Uninitialised') {
        await topicAnalysisModel.init();
    }

    return topicAnalysisModel;
}

/**
 * Get keyword details with subjects, access states, and topic references
 * Handler for: keywordDetail:getKeywordDetails
 * Contract: /specs/015-keyword-detail-preview/contracts/getKeywordDetails.md
 *
 * @param {Event} event - IPC event
 * @param {Object} params - { keyword, topicId }
 * @returns {Promise<Object>} { success, data: { keyword, subjects, accessStates } }
 */
export async function getKeywordDetails(event, { keyword, topicId }) {
    console.log('[KeywordDetail] Getting keyword details:', { keyword, topicId });

    try {
        // Validate inputs
        if (!keyword || typeof keyword !== 'string') {
            throw new Error('Invalid keyword: must be non-empty string');
        }

        // Normalize keyword
        const normalizedKeyword = keyword.toLowerCase().trim();

        // Check cache
        const cacheKey = `${normalizedKeyword}:${topicId || 'all'}`;
        const cached = detailsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            console.log('[KeywordDetail] Returning cached data for:', cacheKey);
            return { success: true, data: cached.data };
        }

        // Initialize model
        const model = await initializeModel();
        const channelManager = nodeOneCoreInstance.channelManager;

        // Get all keywords from all topics first
        const allKeywords = await model.getAllKeywords();

        // Find keyword by term
        const keywordObj = allKeywords.find(k => k.term === normalizedKeyword);

        if (!keywordObj) {
            throw new Error(`Keyword not found: ${keyword}`);
        }

        // Get all subjects
        const allSubjects = await model.getAllSubjects();

        // Filter subjects containing this keyword
        let subjects = allSubjects.filter(subject => {
            // Check if subject contains keyword (by term match)
            const subjectKeywordTerms = subject.keywords.map(k => {
                const kw = allKeywords.find(kw => kw.id === k);
                return kw ? kw.term : null;
            }).filter(Boolean);

            return subjectKeywordTerms.includes(normalizedKeyword);
        });

        // Filter by topicId if provided
        if (topicId) {
            subjects = subjects.filter(s => s.topicId === topicId);
        }

        // Enrich keyword with topic references
        const enrichedKeyword = await keywordEnrichment.enrichKeywordWithTopicReferences(
            keywordObj,
            subjects,
            channelManager
        );

        // Enrich subjects with metadata
        const enrichedSubjects = await keywordEnrichment.enrichSubjectsWithMetadata(
            subjects,
            allSubjects
        );

        // Sort subjects by relevanceScore descending
        const sortedSubjects = keywordEnrichment.sortByRelevance(enrichedSubjects);

        // Get access states for this keyword
        const accessStates = await keywordAccessStorage.getAccessStatesByKeyword(
            channelManager,
            normalizedKeyword
        );

        const result = {
            keyword: enrichedKeyword,
            subjects: sortedSubjects,
            accessStates
        };

        // Cache result
        detailsCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });

        console.log('[KeywordDetail] Retrieved keyword details:', {
            keyword: normalizedKeyword,
            subjectCount: sortedSubjects.length,
            accessStateCount: accessStates.length
        });

        return {
            success: true,
            data: result
        };
    } catch (error) {
        console.error('[KeywordDetail] Error getting keyword details:', error);
        return {
            success: false,
            error: error.message,
            data: {
                keyword: null,
                subjects: [],
                accessStates: []
            }
        };
    }
}

/**
 * Get all keywords for a specific topic
 * Handler for: keywordDetail:getKeywordsByTopic
 * Contract: /specs/015-keyword-detail-preview/contracts/getKeywordsByTopic.md
 *
 * @param {Event} event - IPC event
 * @param {Object} params - { topicId, limit, includeArchived }
 * @returns {Promise<Object>} { success, data: { keywords, topicId, totalCount } }
 */
export async function getKeywordsByTopic(event, { topicId, limit = 100, includeArchived = false }) {
    console.log('[KeywordDetail] Getting keywords for topic:', { topicId, limit });

    try {
        // Validate inputs
        if (!topicId || typeof topicId !== 'string') {
            throw new Error('Invalid topicId: must be non-empty string');
        }

        if (limit < 1) {
            throw new Error('Invalid limit: must be positive number');
        }

        // Initialize model
        const model = await initializeModel();

        // Get all subjects for this topic
        const allSubjects = await model.getSubjects(topicId);

        // Filter archived if needed
        const subjects = includeArchived
            ? allSubjects
            : allSubjects.filter(s => !s.archived);

        // Get all keywords for this topic
        const allKeywords = await model.getKeywords(topicId);

        // Build keyword map with subjectCount
        const keywordMap = new Map();

        for (const keyword of allKeywords) {
            if (!keywordMap.has(keyword.term)) {
                keywordMap.set(keyword.term, {
                    ...keyword,
                    subjectCount: 0
                });
            }
        }

        // Count subjects per keyword
        for (const subject of subjects) {
            // Get keyword terms from subject
            const subjectKeywordTerms = subject.keywords.map(k => {
                const kw = allKeywords.find(kw => kw.id === k);
                return kw ? kw.term : null;
            }).filter(Boolean);

            for (const term of subjectKeywordTerms) {
                if (keywordMap.has(term)) {
                    keywordMap.get(term).subjectCount++;
                }
            }
        }

        // Convert to array and sort
        let keywords = Array.from(keywordMap.values());

        // Sort by: frequency (desc), score (desc), term (asc)
        keywords.sort((a, b) => {
            if (b.frequency !== a.frequency) {
                return b.frequency - a.frequency;
            }
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return a.term.localeCompare(b.term);
        });

        const totalCount = keywords.length;

        // Apply limit
        keywords = keywords.slice(0, limit);

        console.log('[KeywordDetail] Retrieved keywords for topic:', {
            topicId,
            totalCount,
            returnedCount: keywords.length
        });

        return {
            success: true,
            data: {
                keywords,
                topicId,
                totalCount
            }
        };
    } catch (error) {
        console.error('[KeywordDetail] Error getting keywords by topic:', error);
        return {
            success: false,
            error: error.message,
            data: {
                keywords: [],
                topicId,
                totalCount: 0
            }
        };
    }
}

/**
 * Get all keywords across all topics with aggregation
 * Handler for: keywordDetail:getAllKeywords
 * Contract: /specs/015-keyword-detail-preview/contracts/getAllKeywords.md
 *
 * @param {Event} event - IPC event
 * @param {Object} params - { includeArchived, sortBy, limit, offset }
 * @returns {Promise<Object>} { success, data: { keywords, totalCount, hasMore } }
 */
export async function getAllKeywords(event, { includeArchived = false, sortBy = 'frequency', limit = 500, offset = 0 }) {
    console.log('[KeywordDetail] Getting all keywords:', { sortBy, limit, offset });

    try {
        // Validate inputs
        if (!['frequency', 'alphabetical', 'lastSeen'].includes(sortBy)) {
            throw new Error(`Invalid sortBy: must be 'frequency', 'alphabetical', or 'lastSeen'`);
        }

        if (limit < 1 || limit > 500) {
            throw new Error('Invalid limit: must be between 1 and 500');
        }

        if (offset < 0) {
            throw new Error('Invalid offset: must be non-negative number');
        }

        // Initialize model
        const model = await initializeModel();
        const channelManager = nodeOneCoreInstance.channelManager;

        // Load all subjects and keywords
        const allSubjects = includeArchived
            ? await model.getAllSubjects()
            : (await model.getAllSubjects()).filter(s => !s.archived);

        const allKeywords = await model.getAllKeywords();

        // Load all access states
        const allAccessStates = await keywordAccessStorage.getAllAccessStates(channelManager);

        // Aggregate keywords by term
        const keywordMap = new Map();

        for (const keyword of allKeywords) {
            if (!keywordMap.has(keyword.term)) {
                keywordMap.set(keyword.term, {
                    $type$: 'Keyword',
                    term: keyword.term,
                    category: keyword.category,
                    frequency: 0,
                    score: 0,
                    extractedAt: keyword.extractedAt,
                    lastSeen: keyword.lastSeen,
                    subjects: [],
                    topicCount: 0,
                    subjectCount: 0,
                    topTopics: [],
                    accessControlCount: 0,
                    hasRestrictions: false,
                    // For aggregation
                    _totalScore: 0,
                    _topicSet: new Set()
                });
            }

            const agg = keywordMap.get(keyword.term);
            agg.frequency += keyword.frequency || 0;
            agg._totalScore += (keyword.frequency || 0) * (keyword.score || 0);

            // Update earliest extractedAt
            if (!agg.extractedAt || keyword.extractedAt < agg.extractedAt) {
                agg.extractedAt = keyword.extractedAt;
            }

            // Update latest lastSeen
            if (!agg.lastSeen || keyword.lastSeen > agg.lastSeen) {
                agg.lastSeen = keyword.lastSeen;
            }
        }

        // Aggregate subject data
        for (const subject of allSubjects) {
            const subjectKeywordTerms = subject.keywords.map(k => {
                const kw = allKeywords.find(kw => kw.id === k);
                return kw ? kw.term : null;
            }).filter(Boolean);

            for (const term of subjectKeywordTerms) {
                if (keywordMap.has(term)) {
                    const agg = keywordMap.get(term);
                    agg.subjectCount++;
                    agg._topicSet.add(subject.topicId);

                    // Track topic frequency for topTopics
                    let topicEntry = agg.topTopics.find(t => t.topicId === subject.topicId);
                    if (!topicEntry) {
                        topicEntry = {
                            topicId: subject.topicId,
                            topicName: subject.topicId, // Will be enriched later
                            frequency: 0
                        };
                        agg.topTopics.push(topicEntry);
                    }
                    topicEntry.frequency += subject.messageCount || 0;
                }
            }
        }

        // Finalize aggregations
        for (const [term, agg] of keywordMap.entries()) {
            // Calculate weighted average score
            agg.score = agg.frequency > 0 ? agg._totalScore / agg.frequency : 0;

            // Set topic count
            agg.topicCount = agg._topicSet.size;

            // Sort and limit topTopics to 3
            agg.topTopics.sort((a, b) => b.frequency - a.frequency);
            agg.topTopics = agg.topTopics.slice(0, 3);

            // Add access control summary
            const accessStates = allAccessStates.filter(s => s.keywordTerm === term);
            agg.accessControlCount = accessStates.length;
            agg.hasRestrictions = accessStates.some(s => s.state === 'deny');

            // Clean up temporary fields
            delete agg._totalScore;
            delete agg._topicSet;
        }

        // Convert to array
        let keywords = Array.from(keywordMap.values());

        // Sort based on sortBy parameter
        switch (sortBy) {
            case 'frequency':
                keywords.sort((a, b) => {
                    if (b.frequency !== a.frequency) {
                        return b.frequency - a.frequency;
                    }
                    return b.score - a.score;
                });
                break;

            case 'alphabetical':
                keywords.sort((a, b) => {
                    const cmp = a.term.localeCompare(b.term);
                    if (cmp !== 0) return cmp;
                    return b.frequency - a.frequency;
                });
                break;

            case 'lastSeen':
                keywords.sort((a, b) => {
                    if (!a.lastSeen) return 1;
                    if (!b.lastSeen) return -1;
                    const cmp = b.lastSeen.localeCompare(a.lastSeen);
                    if (cmp !== 0) return cmp;
                    return b.frequency - a.frequency;
                });
                break;
        }

        const totalCount = keywords.length;

        // Paginate
        keywords = keywords.slice(offset, offset + limit);

        const hasMore = (offset + limit) < totalCount;

        console.log('[KeywordDetail] Retrieved all keywords:', {
            totalCount,
            returnedCount: keywords.length,
            hasMore
        });

        return {
            success: true,
            data: {
                keywords,
                totalCount,
                hasMore
            }
        };
    } catch (error) {
        console.error('[KeywordDetail] Error getting all keywords:', error);
        return {
            success: false,
            error: error.message,
            data: {
                keywords: [],
                totalCount: 0,
                hasMore: false
            }
        };
    }
}

/**
 * Update or create access state for a keyword and principal
 * Handler for: keywordDetail:updateKeywordAccessState
 * Contract: /specs/015-keyword-detail-preview/contracts/updateKeywordAccessState.md
 *
 * @param {Event} event - IPC event
 * @param {Object} params - { keyword, principalId, principalType, state }
 * @returns {Promise<Object>} { success, data: { accessState, created } }
 */
export async function updateKeywordAccessState(event, { keyword, principalId, principalType, state }) {
    console.log('[KeywordDetail] Updating access state:', { keyword, principalId, principalType, state });

    try {
        // Validate inputs
        if (!keyword || typeof keyword !== 'string') {
            throw new Error('Invalid keyword: must be non-empty string');
        }

        if (!principalId) {
            throw new Error('Invalid principalId: required');
        }

        if (!['user', 'group'].includes(principalType)) {
            throw new Error(`Invalid principalType: must be 'user' or 'group'`);
        }

        if (!['allow', 'deny', 'none'].includes(state)) {
            throw new Error(`Invalid state: must be 'allow', 'deny', or 'none'`);
        }

        // Normalize keyword
        const keywordTerm = keyword.toLowerCase().trim();

        // Initialize model
        const model = await initializeModel();
        const channelManager = nodeOneCoreInstance.channelManager;

        // Verify keyword exists
        const allKeywords = await model.getAllKeywords();
        const keywordExists = allKeywords.some(k => k.term === keywordTerm);

        if (!keywordExists) {
            throw new Error(`Keyword not found: ${keyword}`);
        }

        // Get current user
        const updatedBy = nodeOneCoreInstance.getCurrentUserId
            ? nodeOneCoreInstance.getCurrentUserId()
            : 'system';

        if (!updatedBy) {
            throw new Error('User not authenticated');
        }

        // Update access state (upsert)
        const result = await keywordAccessStorage.updateAccessState(
            channelManager,
            keywordTerm,
            principalId,
            principalType,
            state,
            updatedBy
        );

        // Invalidate cache for this keyword
        const cacheKeys = Array.from(detailsCache.keys());
        for (const key of cacheKeys) {
            if (key.startsWith(`${keywordTerm}:`)) {
                detailsCache.delete(key);
            }
        }

        // Get the access state object
        const accessState = await keywordAccessStorage.getAccessStateByPrincipal(
            channelManager,
            keywordTerm,
            principalId
        );

        console.log('[KeywordDetail] Access state updated:', {
            keywordTerm,
            principalId,
            created: result.created
        });

        return {
            success: true,
            data: {
                accessState: accessState,
                created: result.created
            }
        };
    } catch (error) {
        console.error('[KeywordDetail] Error updating access state:', error);
        return {
            success: false,
            error: error.message,
            data: {
                accessState: null,
                created: false
            }
        };
    }
}

/**
 * Get all access states for a keyword with optional principal enrichment
 * Handler for: keywordDetail:getKeywordAccessStates
 * Contract: /specs/015-keyword-detail-preview/contracts/getKeywordAccessStates.md
 *
 * @param {Event} event - IPC event
 * @param {Object} params - { keyword, includePrincipalDetails }
 * @returns {Promise<Object>} { success, data: { keyword, accessStates, allPrincipals, totalStates } }
 */
export async function getKeywordAccessStates(event, { keyword, includePrincipalDetails = true }) {
    console.log('[KeywordDetail] Getting access states for keyword:', keyword);

    try {
        // Validate input
        if (!keyword || typeof keyword !== 'string') {
            throw new Error('Invalid keyword: must be non-empty string');
        }

        // Normalize keyword
        const keywordTerm = keyword.toLowerCase().trim();

        // Initialize model
        const model = await initializeModel();
        const channelManager = nodeOneCoreInstance.channelManager;

        // Verify keyword exists
        const allKeywords = await model.getAllKeywords();
        const keywordExists = allKeywords.some(k => k.term === keywordTerm);

        if (!keywordExists) {
            throw new Error(`Keyword not found: ${keyword}`);
        }

        // Load access states
        let accessStates = await keywordAccessStorage.getAccessStatesByKeyword(
            channelManager,
            keywordTerm
        );

        let allPrincipals = null;

        if (includePrincipalDetails) {
            // Get all users and groups
            const contacts = nodeOneCoreInstance.leuteModel
                ? await nodeOneCoreInstance.leuteModel.getContacts()
                : [];

            const groups = nodeOneCoreInstance.topicGroupManager
                ? await nodeOneCoreInstance.topicGroupManager.getAllGroups()
                : [];

            // Enrich access states with principal details
            for (const state of accessStates) {
                if (state.principalType === 'user') {
                    const user = contacts.find(c => c.personId === state.principalId);
                    if (user) {
                        state.principalName = user.name || 'Unknown User';
                        state.principalEmail = user.email;
                    } else {
                        state.principalName = 'Unknown User';
                    }
                } else if (state.principalType === 'group') {
                    const group = groups.find(g => g.id === state.principalId);
                    if (group) {
                        state.principalName = group.name || 'Unknown Group';
                        state.principalMemberCount = group.members?.length || 0;
                    } else {
                        state.principalName = 'Unknown Group';
                        state.principalMemberCount = 0;
                    }
                }
            }

            // Build allPrincipals list
            allPrincipals = {
                users: contacts.map(c => ({
                    id: c.personId,
                    name: c.name || 'Unknown',
                    email: c.email,
                    hasState: accessStates.some(s => s.principalId === c.personId)
                })),
                groups: groups.map(g => ({
                    id: g.id,
                    name: g.name || 'Unknown',
                    memberCount: g.members?.length || 0,
                    hasState: accessStates.some(s => s.principalId === g.id)
                }))
            };

            // Sort access states: users first, then groups, then alphabetically by name
            accessStates.sort((a, b) => {
                // Users first
                if (a.principalType !== b.principalType) {
                    return a.principalType === 'user' ? -1 : 1;
                }
                // Alphabetical by name
                const nameA = a.principalName || '';
                const nameB = b.principalName || '';
                if (nameA !== nameB) {
                    return nameA.localeCompare(nameB);
                }
                // Most recent first
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            });
        }

        const result = {
            keyword: keywordTerm,
            accessStates,
            allPrincipals,
            totalStates: accessStates.length
        };

        console.log('[KeywordDetail] Retrieved access states:', {
            keyword: keywordTerm,
            totalStates: accessStates.length,
            includePrincipalDetails
        });

        return {
            success: true,
            data: result
        };
    } catch (error) {
        console.error('[KeywordDetail] Error getting access states:', error);
        return {
            success: false,
            error: error.message,
            data: {
                keyword: keyword?.toLowerCase().trim() || '',
                accessStates: [],
                allPrincipals: null,
                totalStates: 0
            }
        };
    }
}

// Export all handlers
export default {
    getKeywordDetails,
    getKeywordsByTopic,
    getAllKeywords,
    updateKeywordAccessState,
    getKeywordAccessStates
};
