import React, { useState, useEffect } from 'react';
import { Badge } from '../ui/badge';

interface KeywordDisplayProps {
  topicId: string;
  messages: any[];
}

export function KeywordDisplay({ topicId, messages }: KeywordDisplayProps) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Extract keywords when messages change
  useEffect(() => {
    if (!topicId || messages.length === 0) {
      setKeywords([]);
      return;
    }

    const extractKeywords = async () => {
      setLoading(true);
      try {
        // Extract keywords from all messages in the conversation
        const result = await window.electronAPI.invoke(
          'topicAnalysis:extractConversationKeywords',
          {
            topicId,
            messages: messages.map(m => ({
              text: m.content || m.text,
              sender: m.sender
            })),
            maxKeywords: 12
          }
        );

        if (result.success && result.data.keywords) {
          setKeywords(result.data.keywords);
        }
      } catch (error) {
        console.error('Error extracting keywords:', error);
      } finally {
        setLoading(false);
      }
    };

    // Debounce keyword extraction
    const timeoutId = setTimeout(extractKeywords, 500);
    return () => clearTimeout(timeoutId);
  }, [topicId, messages.length]);

  // Extract keywords from new message in real-time
  const updateKeywordsForNewMessage = async (messageText: string) => {
    if (!messageText) return;

    try {
      const result = await window.electronAPI.invoke(
        'topicAnalysis:extractRealtimeKeywords',
        {
          text: messageText,
          existingKeywords: keywords,
          maxKeywords: 12
        }
      );

      if (result.success && result.data.keywords) {
        setKeywords(result.data.keywords);
      }
    } catch (error) {
      console.error('Error updating keywords:', error);
    }
  };

  // Listen for new messages to update keywords in real-time
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.content) {
        updateKeywordsForNewMessage(lastMessage.content);
      }
    }
  }, [messages[messages.length - 1]?.content]);

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