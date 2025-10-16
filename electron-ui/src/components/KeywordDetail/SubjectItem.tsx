/**
 * SubjectItem Component
 * Displays one or more subjects with the same name
 * Shows description once and groups multiple subject versions
 */

import React from 'react';
import { Badge } from '../ui/badge.js';
import { MessageSquare, Users, Calendar, ChevronDown } from 'lucide-react';
import type { EnrichedSubject } from '../../types/keyword-detail.js';

interface SubjectItemProps {
  subjects: EnrichedSubject[];
  onTopicClick?: (topicId: string) => void;
  className?: string;
}

export const SubjectItem: React.FC<SubjectItemProps> = ({
  subjects,
  onTopicClick,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Get the first subject for main display
  const mainSubject = subjects[0];
  const hasMultipleVersions = subjects.length > 1;

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return timestamp;
    }
  };

  // Aggregate metadata across all subjects
  const totalMessages = subjects.reduce((sum, s) => sum + s.messageCount, 0);
  const uniqueTopics = new Set(subjects.map(s => s.topicId)).size;
  const allKeywords = new Set(subjects.flatMap(s => s.keywordCombination.split('+')));
  const mostRecent = subjects.reduce((latest, s) => {
    const sTime = new Date(s.lastSeen).getTime();
    const latestTime = new Date(latest.lastSeen).getTime();
    return sTime > latestTime ? s : latest;
  }, mainSubject);
  const maxRelevanceScore = Math.max(...subjects.map(s => s.relevanceScore));

  return (
    <div
      className={`subject-item p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors ${className}`}
    >
      {/* Description (shown once for all versions) */}
      <div className="mb-3 flex items-start justify-between">
        <p className="text-sm text-gray-800 leading-relaxed flex-1">{mainSubject.description}</p>
        {hasMultipleVersions && (
          <Badge variant="outline" className="text-xs ml-2">
            {subjects.length} versions
          </Badge>
        )}
      </div>

      {/* All unique keywords across versions */}
      <div className="flex flex-wrap gap-1 mb-3">
        {Array.from(allKeywords).map((keyword, idx) => (
          <Badge key={idx} variant="secondary" className="text-xs">
            {keyword}
          </Badge>
        ))}
      </div>

      {/* Aggregated metadata */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        {/* Total message count */}
        <div className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          <span>{totalMessages} messages</span>
        </div>

        {/* Unique topics */}
        {uniqueTopics > 0 && (
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{uniqueTopics} topic{uniqueTopics !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Most recent activity */}
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>Last seen {formatDate(mostRecent.lastSeen)}</span>
        </div>

        {/* Max relevance score (if significant) */}
        {maxRelevanceScore > 10 && (
          <div className="ml-auto">
            <Badge variant="outline" className="text-xs">
              Score: {maxRelevanceScore.toFixed(1)}
            </Badge>
          </div>
        )}
      </div>

      {/* Expandable section for multiple versions */}
      {hasMultipleVersions && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
            <span>{isExpanded ? 'Hide' : 'Show'} {subjects.length} versions</span>
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-2">
              {subjects.map((subject, idx) => (
                <div
                  key={`${subject.topicId}-${subject.keywordCombination}-${idx}`}
                  className="p-3 bg-gray-50 rounded border border-gray-200"
                >
                  {/* Individual subject keywords */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {subject.keywordCombination.split('+').map((kw, kwIdx) => (
                      <Badge key={kwIdx} variant="secondary" className="text-xs">
                        {kw}
                      </Badge>
                    ))}
                  </div>

                  {/* Individual subject metadata */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      <span>{subject.messageCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(subject.lastSeen)}</span>
                    </div>
                    {subject.relevanceScore > 10 && (
                      <Badge variant="outline" className="text-xs">
                        {subject.relevanceScore.toFixed(1)}
                      </Badge>
                    )}
                    {subject.archived && (
                      <Badge variant="outline" className="text-xs text-gray-500">
                        Archived
                      </Badge>
                    )}
                  </div>

                  {/* Topic link for this version */}
                  {onTopicClick && (
                    <div className="mt-2">
                      <button
                        onClick={() => onTopicClick(subject.topicId)}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        View in topic →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Single version topic reference */}
      {!hasMultipleVersions && onTopicClick && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => onTopicClick(mainSubject.topicId)}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            View in topic →
          </button>
        </div>
      )}

      {/* Archived indicator (for single version only) */}
      {!hasMultipleVersions && mainSubject.archived && (
        <div className="mt-2">
          <Badge variant="outline" className="text-xs text-gray-500">
            Archived
          </Badge>
        </div>
      )}
    </div>
  );
};
