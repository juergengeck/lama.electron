/**
 * useChatKeywords Hook
 * Fetches and manages keywords for the current chat
 * As specified in 006-current-keywords-for spec
 */

import { useState, useEffect } from 'react';

export function useChatKeywords(topicId: string) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!topicId) {
      setKeywords([]);
      return;
    }

    const loadKeywords = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get subjects for this topic which contain the keywords
        const subjectsResponse = await window.electronAPI.invoke('topicAnalysis:getSubjects', {
          topicId,
          includeArchived: false
        });

        if (subjectsResponse.success && subjectsResponse.data?.subjects) {
          // Extract all keywords from all subjects and deduplicate
          const allKeywords = new Set<string>();

          subjectsResponse.data.subjects.forEach((subject: any) => {
            if (subject.keywords && Array.isArray(subject.keywords)) {
              subject.keywords.forEach((keyword: string) => {
                allKeywords.add(keyword);
              });
            }
          });

          // Convert to array and sort alphabetically for consistent display
          const keywordArray = Array.from(allKeywords).sort();
          console.log(`[useChatKeywords] Loaded ${keywordArray.length} keywords for topic ${topicId}:`, keywordArray);
          setKeywords(keywordArray);
        } else {
          console.log('[useChatKeywords] No subjects found for topic:', topicId);
          setKeywords([]);
        }
      } catch (err) {
        console.error('[useChatKeywords] Error loading keywords:', err);
        setError(err instanceof Error ? err.message : 'Failed to load keywords');
        setKeywords([]);
      } finally {
        setLoading(false);
      }
    };

    loadKeywords();
  }, [topicId]);

  return {
    keywords,
    loading,
    error
  };
}