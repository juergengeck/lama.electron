/**
 * TopicSummary Component
 * Displays AI-generated summary for a conversation topic
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import { RefreshCw, History, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import type { Summary, GetSummaryResponse } from '../../types/topic-analysis.js';

interface TopicSummaryProps {
  topicId: string;
  onRefresh?: () => void;
  className?: string;
  messages?: any[]; // Pass messages for analysis
}

export const TopicSummary: React.FC<TopicSummaryProps> = ({
  topicId,
  onRefresh,
  className = '',
  messages = []
}) => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [history, setHistory] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // Auto-analyze on first mount if we have messages
  useEffect(() => {
    if (!hasAnalyzed && messages.length >= 5) {
      console.log('[TopicSummary] Auto-analyzing on mount with', messages.length, 'messages');
      analyzeMessages(false); // Don't force, just run if needed
      setHasAnalyzed(true);
    }
    loadSummary();
  }, [topicId, messages.length]);

  const loadSummary = async (version?: number) => {
    console.log('[TopicSummary] 📚 Loading summary for topic:', topicId, version ? `(version ${version})` : '(current)');
    setLoading(true);
    setError(null);

    try {
      const response: GetSummaryResponse = await window.electronAPI.invoke(
        'topicAnalysis:getSummary',
        {
          topicId,
          version,
          includeHistory: showHistory
        }
      );

      if (response.success && response.data) {
        console.log('[TopicSummary] ✅ Summary loaded:', {
          version: response.data.current?.version,
          keywords: response.data.current?.keywords?.length || 0,
          subjects: response.data.current?.subjects?.length || 0,
          historyCount: response.data.history?.length || 0
        });
        setSummary(response.data.current);
        if (response.data.history) {
          setHistory(response.data.history);
        }
      } else {
        console.error('[TopicSummary] ❌ Failed to load summary:', response.error);
        setError(response.error || 'Failed to load summary');
      }
    } catch (err) {
      console.error('[TopicSummary] ❌ Error loading summary:', err);
      setError('Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  const analyzeMessages = async (forceReanalysis: boolean = false) => {
    console.log('[TopicSummary] 🤖 Analyzing messages for topic:', topicId);
    setAnalyzing(true);
    setError(null);

    try {
      const response = await window.electronAPI.invoke(
        'topicAnalysis:analyzeMessages',
        {
          topicId,
          messages: messages.map(m => ({
            id: m.id,
            content: m.content || m.text,
            sender: m.sender || m.author,
            timestamp: m.timestamp || Date.now()
          })),
          forceReanalysis
        }
      );

      if (response.success) {
        console.log('[TopicSummary] ✅ Analysis complete:', {
          subjects: response.data?.subjects?.length || 0,
          keywords: response.data?.keywords?.length || 0
        });

        // Reload summary after analysis
        await loadSummary();
      } else {
        console.error('[TopicSummary] ❌ Analysis failed:', response.error);
        setError(response.error || 'Analysis failed');
      }
    } catch (err) {
      console.error('[TopicSummary] ❌ Error analyzing messages:', err);
      setError('Failed to analyze messages');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRefresh = async () => {
    console.log('[TopicSummary] 🔄 Refreshing summary for topic:', topicId);
    if (onRefresh) {
      onRefresh();
    }
    await loadSummary();
  };

  const handleUpdate = async () => {
    console.log('[TopicSummary] 🔧 Updating summary with new analysis');
    await analyzeMessages(true); // Force reanalysis
  };

  const handleVersionSelect = (version: number) => {
    console.log('[TopicSummary] 📖 Selecting version:', version, 'for topic:', topicId);
    setSelectedVersion(version);
    loadSummary(version);
  };

  const toggleHistory = () => {
    console.log('[TopicSummary] 📜 Toggling history view:', !showHistory);
    setShowHistory(!showHistory);
    if (!showHistory) {
      loadSummary(); // Reload with history
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`border-red-200 ${className}`}>
        <CardContent className="p-4">
          <p className="text-red-600">Error: {error}</p>
          <Button onClick={handleRefresh} size="sm" className="mt-2">
            <RefreshCw className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Conversation Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-center text-gray-500">
          <Sparkles className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <p>No summary available yet</p>
          {messages.length >= 2 ? (
            <>
              <p className="text-sm mt-2 mb-3">Click Update to analyze the conversation</p>
              <Button
                onClick={handleUpdate}
                size="sm"
                variant="default"
                disabled={analyzing}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1" />
                    Analyze Conversation
                  </>
                )}
              </Button>
            </>
          ) : (
            <p className="text-sm mt-2">Start a conversation to generate a summary</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Conversation Summary</CardTitle>
          <div className="flex gap-2">
            <Button
              onClick={toggleHistory}
              size="sm"
              variant="outline"
              className="h-8"
              disabled={analyzing}
            >
              <History className="w-4 h-4 mr-1" />
              {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button
              onClick={handleUpdate}
              size="sm"
              variant="outline"
              className="h-8"
              disabled={analyzing || messages.length < 2}
              title="Analyze messages and update summary"
            >
              {analyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="ml-1">Update</span>
            </Button>
            <Button
              onClick={handleRefresh}
              size="sm"
              variant="outline"
              className="h-8"
              disabled={analyzing}
              title="Refresh summary"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <CardDescription>
          Version {summary.version}
          {summary.updatedAt && (
            <span className="ml-2">
              • Updated {new Date(summary.updatedAt).toLocaleDateString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Current Summary */}
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-700 leading-relaxed">{summary.content}</p>
        </div>

        {/* Keywords */}
        {summary.keywords && summary.keywords.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs font-medium text-gray-500 mb-2">Keywords</p>
            <div className="flex flex-wrap gap-1">
              {summary.keywords.slice(0, 10).map((keyword, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
              {summary.keywords.length > 10 && (
                <Badge variant="outline" className="text-xs">
                  +{summary.keywords.length - 10} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Change Reason */}
        {summary.changeReason && (
          <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-blue-700">
            <span className="font-medium">Update reason:</span> {summary.changeReason}
          </div>
        )}

        {/* Version History */}
        {showHistory && history.length > 1 && (
          <div className="mt-4 pt-3 border-t">
            <p className="text-sm font-medium mb-2">Version History</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {history.map((historicalSummary) => (
                <button
                  key={historicalSummary.version}
                  onClick={() => handleVersionSelect(historicalSummary.version)}
                  className={`w-full text-left p-2 rounded hover:bg-gray-50 transition-colors ${
                    historicalSummary.version === summary.version ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      Version {historicalSummary.version}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(historicalSummary.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {historicalSummary.changeReason && (
                    <p className="text-xs text-gray-600 mt-1">
                      {historicalSummary.changeReason}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Subject Count */}
        {summary.subjects && summary.subjects.length > 0 && (
          <div className="mt-3 text-xs text-gray-500">
            Covers {summary.subjects.length} distinct topic{summary.subjects.length !== 1 ? 's' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  );
};