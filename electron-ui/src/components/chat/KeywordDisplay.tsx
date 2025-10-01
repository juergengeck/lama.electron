import React, { useState, useEffect } from 'react';
import { Badge } from '../ui/badge.js';

interface KeywordDisplayProps {
  topicId: string;
  messages: any[];
}

export function KeywordDisplay({ topicId, messages }: KeywordDisplayProps) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load keywords from storage (populated by analyzeMessages)
  useEffect(() => {
    if (!topicId || messages.length === 0) {
      setKeywords([]);
      return;
    }

    const loadKeywords = async () => {
      setLoading(true);
      try {
        // Get already-extracted keywords from storage
        const result = await window.electronAPI.invoke(
          'topicAnalysis:getKeywords',
          {
            topicId,
            limit: 12
          }
        );

        if (result.success && result.data.keywords) {
          // Extract just the keyword terms
          const keywordTerms = result.data.keywords.map((k: any) => k.term || k);
          setKeywords(keywordTerms);
        }
      } catch (error) {
        console.error('Error loading keywords:', error);
      } finally {
        setLoading(false);
      }
    };

    loadKeywords();
  }, [topicId, messages.length]);

  // Keywords will be updated by auto-analysis after 5 messages
  // No need for real-time extraction on every message

  if (keywords.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="px-4 py-2 border-b border-border/50">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Keywords:</span>
        {loading ? (
          <span className="text-xs text-muted-foreground">Analyzing...</span>
        ) : (
          keywords.map((keyword, index) => (
            <Badge
              key={`${keyword}-${index}`}
              variant="secondary"
              className="text-xs py-0 px-2 h-5"
            >
              {keyword}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}