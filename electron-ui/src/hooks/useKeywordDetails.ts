/**
 * useKeywordDetails Hook
 * Fetches keyword details including subjects and access states via IPC
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  KeywordDetailData,
  KeywordDetailResponse
} from '../types/keyword-detail.js';

interface UseKeywordDetailsResult {
  data: KeywordDetailData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch keyword details from Node.js via IPC
 * @param keyword - The keyword term to fetch (null = no-op)
 * @param topicId - Optional topic ID to filter subjects
 * @returns Object with data, loading, error, and refetch function
 */
export function useKeywordDetails(
  keyword: string | null,
  topicId?: string
): UseKeywordDetailsResult {
  const [data, setData] = useState<KeywordDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeywordDetails = useCallback(async () => {
    // No-op if keyword is null
    if (!keyword) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    console.log('[useKeywordDetails] Fetching details for keyword:', keyword, 'topicId:', topicId);
    setLoading(true);
    setError(null);

    try {
      const response: KeywordDetailResponse = await window.electronAPI?.invoke(
        'keywordDetail:getKeywordDetails',
        {
          keyword,
          topicId
        }
      );

      if (response.success && response.data) {
        console.log('[useKeywordDetails] ✅ Details loaded:', {
          keyword: response.data.keyword.term,
          subjectCount: response.data.subjects.length,
          accessStateCount: response.data.accessStates.length
        });
        setData(response.data);
        setError(null);
      } else {
        console.error('[useKeywordDetails] ❌ Failed to load details:', response.error);
        setError(response.error || 'Failed to load keyword details');
        setData(null);
      }
    } catch (err) {
      console.error('[useKeywordDetails] ❌ Error fetching details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load keyword details');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [keyword, topicId]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchKeywordDetails();
  }, [fetchKeywordDetails]);

  // Refetch function for manual refresh
  const refetch = useCallback(() => {
    console.log('[useKeywordDetails] Manual refetch triggered');
    fetchKeywordDetails();
  }, [fetchKeywordDetails]);

  return {
    data,
    loading,
    error,
    refetch
  };
}
