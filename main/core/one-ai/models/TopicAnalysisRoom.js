/**
 * TopicAnalysisRoom - Extension of TopicRoom for topic analysis functionality
 * Provides methods to retrieve Keywords, Subjects, and Summaries from a topic
 */

export default class TopicAnalysisRoom {
    constructor(topicId, channelManager) {
        this.topicId = topicId;
        this.channelManager = channelManager;
    }

    /**
     * Retrieve all keywords for this topic
     */
    async retrieveAllKeywords() {
        try {
            const channelInfos = await this.channelManager.getMatchingChannelInfos({
                channelId: this.topicId
            });

            if (!channelInfos || channelInfos.length === 0) {
                console.log('[TopicAnalysisRoom] No channels found for topic:', this.topicId);
                return [];
            }

            // Use multiChannelObjectIterator to get all objects from all channels with this topic ID
            const keywords = [];
            for await (const entry of this.channelManager.multiChannelObjectIterator(channelInfos)) {
                if (entry.data && entry.data.$type$ === 'Keyword' && entry.data.topicId === this.topicId) {
                    keywords.push(entry.data);
                }
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
    async retrieveAllSubjects() {
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
                if (entry.data && entry.data.$type$ === 'Subject' && entry.data.topicId === this.topicId) {
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
    async retrieveAllSummaries() {
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
                if (entry.data && entry.data.$type$ === 'Summary' && entry.data.topicId === this.topicId) {
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
    async retrieveLatestSummary() {
        const summaries = await this.retrieveAllSummaries();
        return summaries.length > 0 ? summaries[0] : null;
    }

    /**
     * Retrieve all analysis objects (keywords, subjects, summaries) in one go
     */
    async retrieveAllAnalysisObjects() {
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
                        if (entry.data.topicId === this.topicId) {
                            keywords.push(entry.data);
                        }
                        break;
                    case 'Subject':
                        if (entry.data.topicId === this.topicId) {
                            subjects.push(entry.data);
                        }
                        break;
                    case 'Summary':
                        if (entry.data.topicId === this.topicId) {
                            summaries.push(entry.data);
                        }
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