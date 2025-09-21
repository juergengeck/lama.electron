/**
 * Topic Analysis Service
 * Handles IPC communication for topic analysis features
 */

import type {
  AnalyzeMessagesRequest,
  AnalyzeMessagesResponse,
  GetSubjectsRequest,
  GetSubjectsResponse,
  GetSummaryRequest,
  GetSummaryResponse,
  UpdateSummaryRequest,
  UpdateSummaryResponse,
  ExtractKeywordsRequest,
  ExtractKeywordsResponse,
  MergeSubjectsRequest,
  MergeSubjectsResponse,
  TopicAnalysisChannels
} from '../types/topic-analysis';

class TopicAnalysisService {
  /**
   * Analyze messages to extract subjects and keywords
   */
  async analyzeMessages(request: AnalyzeMessagesRequest): Promise<AnalyzeMessagesResponse> {
    try {
      console.log('[TopicAnalysisService] 🤖 Analyzing messages:', {
        topicId: request.topicId,
        messageCount: request.messages?.length || 0,
        forceReanalysis: request.forceReanalysis || false
      });

      const response = await window.electronAPI.invoke(
        'topicAnalysis:analyzeMessages',
        request
      );

      if (response.success) {
        console.log('[TopicAnalysisService] ✅ Analysis complete:', {
          subjects: response.data?.subjects?.length || 0,
          keywords: response.data?.keywords?.length || 0,
          summaryId: response.data?.summaryId
        });
      } else {
        console.error('[TopicAnalysisService] ❌ Analysis failed:', response.error);
      }

      return response;
    } catch (error) {
      console.error('[TopicAnalysisService] ❌ Error analyzing messages:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze messages'
      };
    }
  }

  /**
   * Get all subjects for a topic
   */
  async getSubjects(request: GetSubjectsRequest): Promise<GetSubjectsResponse> {
    try {
      console.log('[TopicAnalysisService] 🔍 Getting subjects:', {
        topicId: request.topicId,
        includeArchived: request.includeArchived || false
      });

      const response = await window.electronAPI.invoke(
        'topicAnalysis:getSubjects',
        request
      );

      if (response.success) {
        console.log('[TopicAnalysisService] ✅ Subjects retrieved:', {
          count: response.data?.subjects?.length || 0
        });
      } else {
        console.error('[TopicAnalysisService] ❌ Failed to get subjects:', response.error);
      }

      return response;
    } catch (error) {
      console.error('[TopicAnalysisService] ❌ Error getting subjects:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get subjects'
      };
    }
  }

  /**
   * Get summary for a topic
   */
  async getSummary(request: GetSummaryRequest): Promise<GetSummaryResponse> {
    try {
      console.log('[TopicAnalysisService] 📚 Getting summary:', {
        topicId: request.topicId,
        version: request.version,
        includeHistory: request.includeHistory || false
      });

      const response = await window.electronAPI.invoke(
        'topicAnalysis:getSummary',
        request
      );

      if (response.success) {
        console.log('[TopicAnalysisService] ✅ Summary retrieved:', {
          version: response.data?.current?.version,
          historyCount: response.data?.history?.length || 0
        });
      } else {
        console.error('[TopicAnalysisService] ❌ Failed to get summary:', response.error);
      }

      return response;
    } catch (error) {
      console.error('[TopicAnalysisService] ❌ Error getting summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get summary'
      };
    }
  }

  /**
   * Update or create summary
   */
  async updateSummary(request: UpdateSummaryRequest): Promise<UpdateSummaryResponse> {
    try {
      console.log('[TopicAnalysisService] 📝 Updating summary:', {
        topicId: request.topicId,
        reason: request.changeReason
      });

      const response = await window.electronAPI.invoke(
        'topicAnalysis:updateSummary',
        request
      );

      if (response.success) {
        console.log('[TopicAnalysisService] ✅ Summary updated:', {
          newVersion: response.data?.version
        });
      } else {
        console.error('[TopicAnalysisService] ❌ Failed to update summary:', response.error);
      }

      return response;
    } catch (error) {
      console.error('[TopicAnalysisService] ❌ Error updating summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update summary'
      };
    }
  }

  /**
   * Extract keywords from text
   */
  async extractKeywords(request: ExtractKeywordsRequest): Promise<ExtractKeywordsResponse> {
    try {
      console.log('[TopicAnalysisService] 🏷️ Extracting keywords:', {
        textLength: request.text.length,
        maxKeywords: request.maxKeywords
      });

      const response = await window.electronAPI.invoke(
        'topicAnalysis:extractKeywords',
        request
      );

      if (response.success) {
        console.log('[TopicAnalysisService] ✅ Keywords extracted:', {
          count: response.data?.keywords?.length || 0,
          keywords: response.data?.keywords
        });
      } else {
        console.error('[TopicAnalysisService] ❌ Failed to extract keywords:', response.error);
      }

      return response;
    } catch (error) {
      console.error('[TopicAnalysisService] ❌ Error extracting keywords:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract keywords'
      };
    }
  }

  /**
   * Merge two subjects
   */
  async mergeSubjects(request: MergeSubjectsRequest): Promise<MergeSubjectsResponse> {
    try {
      console.log('[TopicAnalysisService] 🔀 Merging subjects:', {
        topicId: request.topicId,
        subject1: request.subjectId1,
        subject2: request.subjectId2,
        newKeywords: request.newKeywords
      });

      const response = await window.electronAPI.invoke(
        'topicAnalysis:mergeSubjects',
        request
      );

      if (response.success) {
        console.log('[TopicAnalysisService] ✅ Subjects merged:', {
          mergedId: response.data?.mergedSubject?.id,
          archivedCount: response.data?.archivedSubjects?.length || 0
        });
      } else {
        console.error('[TopicAnalysisService] ❌ Failed to merge subjects:', response.error);
      }

      return response;
    } catch (error) {
      console.error('[TopicAnalysisService] ❌ Error merging subjects:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to merge subjects'
      };
    }
  }

  /**
   * Trigger analysis after new messages
   * Returns true if analysis should be triggered based on message count
   */
  shouldAnalyze(messageCount: number, lastAnalysisMessageCount?: number): boolean {
    // Analyze after every 5 messages or if it's the first analysis
    const shouldAnalyze = !lastAnalysisMessageCount || (messageCount - lastAnalysisMessageCount) >= 5;

    console.log('[TopicAnalysisService] 🤔 Should analyze?', {
      messageCount,
      lastAnalysisMessageCount,
      difference: lastAnalysisMessageCount ? messageCount - lastAnalysisMessageCount : 'N/A',
      decision: shouldAnalyze
    });

    return shouldAnalyze;
  }

  /**
   * Subscribe to analysis updates (future enhancement)
   */
  subscribeToUpdates(topicId: string, callback: (data: any) => void): () => void {
    // Placeholder for future real-time updates
    // Could use IPC events or WebSocket for real-time updates
    console.log('[TopicAnalysisService] 📡 Subscribing to updates for topic:', topicId);

    // Return unsubscribe function
    return () => {
      console.log('[TopicAnalysisService] 🔌 Unsubscribing from topic:', topicId);
    };
  }

  /**
   * Get keyword suggestions based on existing keywords
   */
  async getKeywordSuggestions(
    existingKeywords: string[],
    limit: number = 5
  ): Promise<string[]> {
    // This could call an AI service to suggest related keywords
    // For now, return empty array
    return [];
  }

  /**
   * Check if summary needs update
   */
  async checkSummaryStatus(topicId: string): Promise<{
    needsUpdate: boolean;
    lastVersion?: number;
    lastUpdate?: number;
  }> {
    const response = await this.getSummary({ topicId });

    if (response.success && response.data?.current) {
      const hoursSinceUpdate = (Date.now() - response.data.current.updatedAt) / (1000 * 60 * 60);

      return {
        needsUpdate: hoursSinceUpdate > 24, // Update if older than 24 hours
        lastVersion: response.data.current.version,
        lastUpdate: response.data.current.updatedAt
      };
    }

    return {
      needsUpdate: true
    };
  }

  /**
   * Batch analyze multiple topics
   */
  async batchAnalyze(topicIds: string[]): Promise<Map<string, AnalyzeMessagesResponse>> {
    const results = new Map<string, AnalyzeMessagesResponse>();

    // Process in parallel with limit
    const batchSize = 3;
    for (let i = 0; i < topicIds.length; i += batchSize) {
      const batch = topicIds.slice(i, i + batchSize);
      const promises = batch.map(topicId =>
        this.analyzeMessages({ topicId }).then(response => ({
          topicId,
          response
        }))
      );

      const batchResults = await Promise.all(promises);
      batchResults.forEach(({ topicId, response }) => {
        results.set(topicId, response);
      });
    }

    return results;
  }

  /**
   * Export analysis data for a topic
   */
  async exportAnalysis(topicId: string): Promise<{
    summary: any;
    subjects: any[];
    keywords: any[];
  } | null> {
    try {
      const [summaryResponse, subjectsResponse] = await Promise.all([
        this.getSummary({ topicId, includeHistory: true }),
        this.getSubjects({ topicId, includeArchived: true })
      ]);

      if (summaryResponse.success && subjectsResponse.success) {
        // Extract keywords from subjects
        const keywords = new Set<string>();
        subjectsResponse.data?.subjects.forEach(subject => {
          subject.keywords.forEach(kw => keywords.add(kw));
        });

        return {
          summary: summaryResponse.data,
          subjects: subjectsResponse.data?.subjects || [],
          keywords: Array.from(keywords)
        };
      }
    } catch (error) {
      console.error('Error exporting analysis:', error);
    }

    return null;
  }
}

// Export singleton instance
export const topicAnalysisService = new TopicAnalysisService();

// Also export class for testing
export { TopicAnalysisService };