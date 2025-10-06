/**
 * useChatKeywords Hook
 * Non-blocking real-time single-word keyword extraction
 */

import { useState, useEffect, useRef } from 'react';

interface Message {
  id?: string;
  content?: string;
  text?: string;
  sender?: string;
  timestamp?: number | string;
}

export function useChatKeywords(topicId: string, messages: Message[] = []) {
  console.log('[useChatKeywords] Hook called with topicId:', topicId, 'messages:', messages.length);

  const [keywords, setKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs to track and cancel stale requests
  const extractionInProgress = useRef(false);
  const requestCounter = useRef(0);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Listen for keyword update events from backend
  useEffect(() => {
    if (!topicId || !window.electronAPI) return;

    const handleKeywordsUpdated = (data: any) => {
      if (data.topicId === topicId) {
        console.log('[useChatKeywords] Keywords updated event received for topic:', topicId);
        // Trigger a refresh by incrementing request counter
        requestCounter.current++;
        // Re-fetch keywords immediately
        const fetchKeywords = async () => {
          try {
            const response = await window.electronAPI.invoke('topicAnalysis:getKeywords', {
              topicId,
              limit: 15
            });
            if (response.success && response.data?.keywords) {
              const keywordTerms = response.data.keywords.map((k: any) => k.term || k);
              console.log('[useChatKeywords] Refreshed keywords after update:', keywordTerms.length);
              setKeywords(keywordTerms);
            }
          } catch (err) {
            console.error('[useChatKeywords] Error refreshing keywords:', err);
          }
        };
        fetchKeywords();
      }
    };

    const unsub = window.electronAPI.on('keywords:updated', handleKeywordsUpdated);
    return () => {
      if (unsub) unsub();
    };
  }, [topicId]);

  // Non-blocking keyword extraction
  useEffect(() => {
    if (!topicId) {
      setKeywords([]);
      return;
    }

    // Cancel any pending debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce the extraction to avoid too many calls
    debounceTimer.current = setTimeout(() => {
      // Increment request counter to track current request
      const currentRequest = ++requestCounter.current;

      // Don't wait for extraction, fire and forget
      const performExtraction = async () => {
        // Skip if another extraction is already in progress
        if (extractionInProgress.current) {
          console.log('[useChatKeywords] Skipping - extraction already in progress');
          return;
        }

        extractionInProgress.current = true;

        try {
          // Only show loading for initial load, not updates
          if (keywords.length === 0) {
            setLoading(true);
          }

          if (messages && messages.length > 0) {
            console.log('[useChatKeywords] Loading keywords from storage for', messages.length, 'messages');

            // Get keywords from storage (populated by analyzeMessages)
            const response = await window.electronAPI.invoke('topicAnalysis:getKeywords', {
              topicId,
              limit: 15
            });

            // Only update if this is still the latest request
            if (currentRequest === requestCounter.current) {
              if (response.success && response.data?.keywords) {
                const keywordTerms = response.data.keywords.map((k: any) => k.term || k);
                console.log('[useChatKeywords] ✅ Keywords loaded from storage:', keywordTerms.length, 'keywords:', keywordTerms);
                setKeywords(keywordTerms);
                setError(null);
              } else {
                console.log('[useChatKeywords] ❌ No keywords in response:', response);
              }
            } else {
              console.log('[useChatKeywords] Ignoring stale response');
            }
          } else if (keywords.length === 0) {
            // Only try fallback if we have no keywords yet
            console.log('[useChatKeywords] No messages, trying fallback to subjects');

            const subjectsResponse = await window.electronAPI.invoke('topicAnalysis:getSubjects', {
              topicId,
              includeArchived: false
            });

            // Only update if this is still the latest request
            if (currentRequest === requestCounter.current) {
              if (subjectsResponse.success && subjectsResponse.data?.subjects) {
                const allKeywords = new Set<string>();

                subjectsResponse.data.subjects.forEach((subject: any) => {
                  if (subject.keywords && Array.isArray(subject.keywords)) {
                    subject.keywords.forEach((keyword: string) => {
                      // Only include single words
                      if (!keyword.includes(' ') && !keyword.includes('+')) {
                        allKeywords.add(keyword);
                      }
                    });
                  }
                });

                const keywordArray = Array.from(allKeywords).slice(0, 15);
                setKeywords(keywordArray);
              }
            }
          }
        } catch (err) {
          // Only update error if this is still the latest request
          if (currentRequest === requestCounter.current) {
            console.error('[useChatKeywords] Extraction error:', err);
            setError(err instanceof Error ? err.message : 'Failed to extract keywords');
          }
        } finally {
          extractionInProgress.current = false;
          if (currentRequest === requestCounter.current) {
            setLoading(false);
          }
        }
      };

      // Start extraction without blocking
      performExtraction();
    }, 300); // 300ms debounce

    // Cleanup function
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [topicId, messages.length]); // Only re-run when topic or message count changes

  // Non-blocking update for new message
  const updateKeywordsForNewMessage = (messageText: string) => {
    if (!messageText) return;

    // Increment request counter
    const currentRequest = ++requestCounter.current;

    // Fire and forget - don't block on this
    const performUpdate = async () => {
      try {
        console.log('[useChatKeywords] Updating keywords for new message (non-blocking)');

        const response = await window.electronAPI.invoke('topicAnalysis:extractRealtimeKeywords', {
          text: messageText,
          existingKeywords: keywords,
          maxKeywords: 15
        });

        // Only update if this is still the latest request
        if (currentRequest === requestCounter.current) {
          if (response.success && response.data?.keywords) {
            setKeywords(response.data.keywords);
          }
        }
      } catch (err) {
        console.error('[useChatKeywords] Update error (non-blocking):', err);
        // Don't set error state for non-blocking updates
      }
    };

    // Start update without blocking
    performUpdate();
  };

  return {
    keywords,
    loading,
    error,
    updateKeywordsForNewMessage
  };
}