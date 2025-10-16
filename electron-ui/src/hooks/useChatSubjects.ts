/**
 * useChatSubjects Hook
 * Fetches and manages subjects for a chat topic
 */

import { useState, useEffect, useRef } from 'react';
import type { Subject } from '../types/topic-analysis';

export function useChatSubjects(topicId: string) {
  console.log('[useChatSubjects] Hook called with topicId:', topicId);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs to track and cancel stale requests
  const requestCounter = useRef(0);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Track previous subject count for change detection
  const prevSubjectCountRef = useRef(0);

  // Listen for subject update events from backend
  useEffect(() => {
    if (!topicId || !window.electronAPI) return;

    const handleSubjectsUpdated = (data: any) => {
      console.log(`[useChatSubjects-${topicId}] 🔔 Received subjects:updated event for: "${data.topicId}"`);
      if (data.topicId === topicId) {
        console.log(`[useChatSubjects-${topicId}] ✅ Fetching updated subjects`);
        // Re-fetch subjects immediately
        fetchSubjects();
      }
    };

    const unsub = window.electronAPI.on('subjects:updated', handleSubjectsUpdated);
    return () => {
      if (unsub) unsub();
    };
  }, [topicId]);

  // Detect when subjects appear (0 -> N) and return flag
  const subjectsJustAppeared = prevSubjectCountRef.current === 0 && subjects.length > 0;
  prevSubjectCountRef.current = subjects.length;

  // Fetch subjects
  const fetchSubjects = async () => {
    const currentRequest = ++requestCounter.current;

    try {
      if (loading) {
        console.log('[useChatSubjects] Skipping - fetch already in progress');
        return;
      }

      setLoading(true);

      const response = await window.electronAPI.invoke('topicAnalysis:getSubjects', {
        topicId,
        includeArchived: false
      });

      // Only update if this is still the latest request
      if (currentRequest === requestCounter.current) {
        if (response.success && response.data?.subjects) {
          console.log('[useChatSubjects] ✅ Subjects loaded:', response.data.subjects.length);
          setSubjects(response.data.subjects);
          setError(null);
        } else {
          console.log('[useChatSubjects] ❌ No subjects in response:', response);
          setSubjects([]);
        }
      } else {
        console.log('[useChatSubjects] Ignoring stale response');
      }
    } catch (err) {
      if (currentRequest === requestCounter.current) {
        console.error('[useChatSubjects] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch subjects');
      }
    } finally {
      if (currentRequest === requestCounter.current) {
        setLoading(false);
      }
    }
  };

  // Load subjects when topicId changes
  useEffect(() => {
    // Clear subjects immediately when topicId changes
    console.log('[useChatSubjects] 🧹 Clearing subjects for topic change to:', topicId);
    setSubjects([]);
    setError(null);

    if (!topicId) {
      return;
    }

    // Cancel any pending debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce the fetch
    debounceTimer.current = setTimeout(() => {
      fetchSubjects();
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [topicId]);

  return {
    subjects,
    loading,
    error,
    refetch: fetchSubjects,
    subjectsJustAppeared
  };
}
