/**
 * KeywordDetailPanel Component
 * Main panel displaying keyword details, subjects, and access control
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.js';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
import { X, RefreshCw, Loader2, Tag } from 'lucide-react';
import { useKeywordDetails } from '../../hooks/useKeywordDetails.js';
import { SortControls } from './SortControls.js';
import { SubjectList } from './SubjectList.js';
import { AccessControlList } from './AccessControlList.js';
import type {
  SubjectSortMode,
  AccessStateValue,
  PrincipalType,
  AllPrincipals
} from '../../types/keyword-detail.js';

interface KeywordDetailPanelProps {
  keyword: string;
  topicId?: string;
  onClose: () => void;
  onTopicClick?: (topicId: string) => void;
  allPrincipals?: AllPrincipals;
  className?: string;
}

export const KeywordDetailPanel: React.FC<KeywordDetailPanelProps> = ({
  keyword,
  topicId,
  onClose,
  onTopicClick,
  allPrincipals,
  className = ''
}) => {
  const { data, loading, error, refetch } = useKeywordDetails(keyword, topicId);
  const [sortMode, setSortMode] = useState<SubjectSortMode>('relevance');

  const handleAccessChange = async (
    principalId: string,
    principalType: PrincipalType,
    newState: AccessStateValue
  ) => {
    console.log('[KeywordDetailPanel] Updating access state:', {
      keyword,
      principalId,
      principalType,
      newState
    });

    try {
      const response = await window.electronAPI?.invoke(
        'keywordDetail:updateKeywordAccessState',
        {
          keyword,
          principalId,
          principalType,
          state: newState
        }
      );

      if (response?.success) {
        console.log('[KeywordDetailPanel] ✅ Access state updated');
        // Refetch to get updated access states
        refetch();
      } else {
        console.error('[KeywordDetailPanel] ❌ Failed to update access state:', response?.error);
        throw new Error(response?.error || 'Failed to update access state');
      }
    } catch (err) {
      console.error('[KeywordDetailPanel] ❌ Error updating access state:', err);
      throw err;
    }
  };

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Keyword Details</CardTitle>
            <Button onClick={onClose} size="sm" variant="ghost">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={`border-red-200 ${className}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Keyword Details</CardTitle>
            <Button onClick={onClose} size="sm" variant="ghost">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="text-center p-8">
            <p className="text-red-600 mb-4">Error: {error}</p>
            <Button onClick={refetch} size="sm" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!data) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Keyword Details</CardTitle>
            <Button onClick={onClose} size="sm" variant="ghost">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="text-center p-8">
            <p className="text-gray-500">No keyword data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { keyword: keywordData, subjects, accessStates } = data;

  return (
    <Card className={className}>
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Tag className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">{keywordData.term}</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={refetch}
              size="sm"
              variant="outline"
              className="h-8"
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button onClick={onClose} size="sm" variant="ghost" className="h-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <Badge variant="secondary">
              {keywordData.frequency} occurrences
            </Badge>
            <Badge variant="outline">
              Score: {keywordData.score.toFixed(2)}
            </Badge>
            {keywordData.category && (
              <Badge variant="outline">
                {keywordData.category}
              </Badge>
            )}
            {keywordData.topicReferences.length > 0 && (
              <span className="text-xs text-gray-500">
                Found in {keywordData.topicReferences.length} topic
                {keywordData.topicReferences.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-6">
        {/* Keywords with Subject Counts */}
        {subjects.length > 0 && (() => {
          // Extract all keywords from subjects and count how many subjects each appears in
          const keywordCounts = new Map<string, number>();
          subjects.forEach(subject => {
            const keywords = subject.keywordCombination?.split('+') || [];
            keywords.forEach(kw => {
              keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1);
            });
          });

          const sortedKeywords = Array.from(keywordCounts.entries())
            .sort((a, b) => b[1] - a[1]); // Sort by count descending

          return (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Keywords ({sortedKeywords.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {sortedKeywords.map(([keyword, count]) => (
                  <Badge
                    key={keyword}
                    variant="secondary"
                    className="text-xs"
                  >
                    {keyword}
                    {count > 1 && (
                      <span className="ml-1 text-[10px] opacity-70">
                        ({count})
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Topic References */}
        {keywordData.topicReferences.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Topics</h3>
            <div className="space-y-2">
              {keywordData.topicReferences.map((topicRef, idx) => (
                <div
                  key={`${topicRef.topicId}-${idx}`}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {topicRef.topicName}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {topicRef.messageCount} messages • {topicRef.authors.length} authors
                      </p>
                    </div>
                    {onTopicClick && (
                      <Button
                        onClick={() => onTopicClick(topicRef.topicId)}
                        size="sm"
                        variant="outline"
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subjects Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">
              Related Subjects ({subjects.length})
            </h3>
          </div>
          <SortControls sortMode={sortMode} onSortChange={setSortMode} className="mb-4" />
          <SubjectList
            subjects={subjects}
            sortMode={sortMode}
            onTopicClick={onTopicClick}
          />
        </div>

        {/* Access Control Section */}
        <div className="pt-4 border-t">
          <AccessControlList
            keyword={keywordData.term}
            accessStates={accessStates}
            allPrincipals={allPrincipals}
            onAccessChange={handleAccessChange}
          />
        </div>

        {/* Metadata footer */}
        <div className="pt-4 border-t text-xs text-gray-500">
          <div className="flex flex-wrap gap-4">
            <div>
              <span className="font-medium">First seen:</span>{' '}
              {new Date(keywordData.extractedAt).toLocaleDateString()}
            </div>
            <div>
              <span className="font-medium">Last seen:</span>{' '}
              {new Date(keywordData.lastSeen).toLocaleDateString()}
            </div>
            {accessStates.length > 0 && (
              <div>
                <span className="font-medium">Access rules:</span> {accessStates.length}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
