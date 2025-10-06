import type { ChannelManager } from '@refinio/one.models/lib/models/index.js';
/**
 * TopicAnalysisRoom - Extension of TopicRoom for topic analysis functionality
 * Provides methods to retrieve Keywords, Subjects, and Summaries from a topic
 */

export default class TopicAnalysisRoom {
  public topicId: any;
  public channelManager: any;

    constructor(topicId: any, channelManager: any) {

        this.topicId = topicId;
        this.channelManager = channelManager;
}

    /**
     * Retrieve all keywords for this topic
     * Keywords are now stored IN Subject objects, so we extract them from subjects
     */
    async retrieveAllKeywords(): Promise<any> {
        try {
            const channelInfos = await this.channelManager.getMatchingChannelInfos({
                channelId: this.topicId
            });

            console.log('[TopicAnalysisRoom] retrieveAllKeywords - topicId:', this.topicId);
            console.log('[TopicAnalysisRoom] Found channels:', channelInfos?.length || 0);

            if (!channelInfos || channelInfos.length === 0) {
                console.log('[TopicAnalysisRoom] No channels found for topic:', this.topicId);
                return [];
            }

            // Extract keywords from Subject objects
            const keywordMap = new Map(); // Deduplicate by term
            let totalObjects = 0;
            let subjectsFound = 0;

            for await (const entry of this.channelManager.multiChannelObjectIterator(channelInfos)) {
                totalObjects++;

                // Keywords are embedded in Subject objects
                if (entry.data && entry.data.$type$ === 'Subject') {
                    subjectsFound++;
                    const subject = entry.data;

                    // Extract keywords from subject
                    if (subject.keywords && Array.isArray(subject.keywords)) {
                        for (const keyword of subject.keywords) {
                            // Create a keyword object with metadata
                            const keywordObj = {
                                term: keyword,
                                score: subject.confidence || 0.8,
                                lastSeen: subject.lastDiscussed || Date.now(),
                                fromSubject: subject.keywordCombination || subject.keywords.join('+')
                            };

                            // Keep the most recent/relevant version
                            if (!keywordMap.has(keyword) || keywordObj.lastSeen > keywordMap.get(keyword).lastSeen) {
                                keywordMap.set(keyword, keywordObj);
                            }
                        }
                    }
                }
            }

            const keywords = Array.from(keywordMap.values());

            // Sort by: 1) score (relevance) descending, 2) lastSeen (recency) descending
            keywords.sort((a, b) => {
                const scoreA = a.score || 0;
                const scoreB = b.score || 0;
                if (scoreA !== scoreB) {
                    return scoreB - scoreA;
                }
                return b.lastSeen - a.lastSeen;
            });

            console.log('[TopicAnalysisRoom] Total objects scanned:', totalObjects);
            console.log('[TopicAnalysisRoom] Subjects found:', subjectsFound);
            console.log('[TopicAnalysisRoom] Keywords extracted:', keywords.length, '(deduplicated and sorted)');
            if (keywords.length > 0) {
                console.log('[TopicAnalysisRoom] Sample keywords:', keywords.slice(0, 5).map(k => k.term));
            }

            return keywords;
        } catch (error) {
            console.error('[TopicAnalysisRoom] Error retrieving keywords:', error);
            return [];
        }
    }

    /**
     * Retrieve all subjects for this topic
     */
    async retrieveAllSubjects(): Promise<any> {
        try {
            const channelInfos = await this.channelManager.getMatchingChannelInfos({
                channelId: this.topicId
            });

            if (!channelInfos || channelInfos.length === 0) {
                console.log('[TopicAnalysisRoom] No channels found for topic:', this.topicId);
                return [];
            }

            const subjects = [];
            for await (const entry of this.channelManager.multiChannelObjectIterator(channelInfos)) {
                if (entry.data && entry.data.$type$ === 'Subject') {
                    subjects.push(entry.data);
                }
            }

            return subjects;
        } catch (error) {
            console.error('[TopicAnalysisRoom] Error retrieving subjects:', error);
            return [];
        }
    }

    /**
     * Retrieve all summaries for this topic
     */
    async retrieveAllSummaries(): Promise<any> {
        try {
            const channelInfos = await this.channelManager.getMatchingChannelInfos({
                channelId: this.topicId
            });

            if (!channelInfos || channelInfos.length === 0) {
                console.log('[TopicAnalysisRoom] No channels found for topic:', this.topicId);
                return [];
            }

            const summaries = [];
            for await (const entry of this.channelManager.multiChannelObjectIterator(channelInfos)) {
                if (entry.data && entry.data.$type$ === 'Summary') {
                    summaries.push(entry.data);
                }
            }

            // Sort by version (highest first)
            summaries.sort((a, b) => (b.version || 0) - (a.version || 0));

            return summaries;
        } catch (error) {
            console.error('[TopicAnalysisRoom] Error retrieving summaries:', error);
            return [];
        }
    }

    /**
     * Retrieve the latest summary for this topic
     */
    async retrieveLatestSummary(): Promise<any> {
        const summaries = await this.retrieveAllSummaries();
        return summaries.length > 0 ? summaries[0] : null;
    }

    /**
     * Retrieve all analysis objects (keywords, subjects, summaries) in one go
     */
    async retrieveAllAnalysisObjects(): Promise<any> {
        try {
            const channelInfos = await this.channelManager.getMatchingChannelInfos({
                channelId: this.topicId
            });

            if (!channelInfos || channelInfos.length === 0) {
                console.log('[TopicAnalysisRoom] No channels found for topic:', this.topicId);
                return {
                    keywords: [],
                    subjects: [],
                    summaries: []
                };
            }

            const keywords = [];
            const subjects = [];
            const summaries = [];

            for await (const entry of this.channelManager.multiChannelObjectIterator(channelInfos)) {
                if (!entry.data || !entry.data.$type$) continue;

                switch (entry.data.$type$) {
                    case 'Keyword':
                        keywords.push(entry.data);
                        break;
                    case 'Subject':
                        subjects.push(entry.data);
                        break;
                    case 'Summary':
                        summaries.push(entry.data);
                        break;
                }
            }

            // Sort summaries by version
            summaries.sort((a, b) => (b.version || 0) - (a.version || 0));

            return {
                keywords,
                subjects,
                summaries
            };
        } catch (error) {
            console.error('[TopicAnalysisRoom] Error retrieving analysis objects:', error);
            return {
                keywords: [],
                subjects: [],
                summaries: []
            };
        }
    }
}