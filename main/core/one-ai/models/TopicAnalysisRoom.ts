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
     * Reads stored Keyword objects
     */
    async retrieveAllKeywords(): Promise<any> {
        const channelInfos = await this.channelManager.getMatchingChannelInfos({
            channelId: this.topicId
        });

        if (!channelInfos || channelInfos.length === 0) {
            throw new Error(`No channels found for topic: ${this.topicId}`);
        }

        const keywords = [];
        for await (const entry of this.channelManager.multiChannelObjectIterator(channelInfos)) {
            if (entry.data && entry.data.$type$ === 'Keyword') {
                keywords.push(entry.data);
            }
        }

        keywords.sort((a, b) => {
            if (a.score !== b.score) {
                return b.score - a.score;
            }
            return b.lastSeen - a.lastSeen;
        });

        return keywords;
    }

    /**
     * Retrieve all subjects for this topic
     */
    async retrieveAllSubjects(): Promise<any> {
        const channelInfos = await this.channelManager.getMatchingChannelInfos({
            channelId: this.topicId
        });

        if (!channelInfos || channelInfos.length === 0) {
            throw new Error(`No channels found for topic: ${this.topicId}`);
        }

        const subjects = [];
        for await (const entry of this.channelManager.multiChannelObjectIterator(channelInfos)) {
            if (entry.data && entry.data.$type$ === 'Subject') {
                subjects.push(entry.data);
            }
        }

        return subjects;
    }

    /**
     * Retrieve all summaries for this topic
     */
    async retrieveAllSummaries(): Promise<any> {
        const channelInfos = await this.channelManager.getMatchingChannelInfos({
            channelId: this.topicId
        });

        if (!channelInfos || channelInfos.length === 0) {
            throw new Error(`No channels found for topic: ${this.topicId}`);
        }

        const summaries = [];
        for await (const entry of this.channelManager.multiChannelObjectIterator(channelInfos)) {
            if (entry.data && entry.data.$type$ === 'Summary') {
                summaries.push(entry.data);
            }
        }

        summaries.sort((a, b) => (b.version || 0) - (a.version || 0));

        return summaries;
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
        const channelInfos = await this.channelManager.getMatchingChannelInfos({
            channelId: this.topicId
        });

        if (!channelInfos || channelInfos.length === 0) {
            throw new Error(`No channels found for topic: ${this.topicId}`);
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

        summaries.sort((a, b) => (b.version || 0) - (a.version || 0));

        return {
            keywords,
            subjects,
            summaries
        };
    }
}