/**
 * SubjectItem Component
 * Displays a single subject with description and topic references
 */

import React from 'react';
import { Badge } from '../ui/badge.js';
import { MessageSquare, Users, Calendar } from 'lucide-react';
import type { EnrichedSubject } from '../../types/keyword-detail.js';

interface SubjectItemProps {
  subject: EnrichedSubject;
  onTopicClick?: (topicId: string) => void;
  className?: string;
}

export const SubjectItem: React.FC<SubjectItemProps> = ({
  subject,
  onTopicClick,
  className = ''
}) => {
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

  const keywords = subject.keywordCombination.split('+');

  return (
    <div
      className={`subject-item p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors ${className}`}
    >
      {/* Description */}
      <div className="mb-3">
        <p className="text-sm text-gray-800 leading-relaxed">{subject.description}</p>
      </div>

      {/* Keywords */}
      <div className="flex flex-wrap gap-1 mb-3">
        {keywords.map((keyword, idx) => (
          <Badge key={idx} variant="secondary" className="text-xs">
            {keyword}
          </Badge>
        ))}
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        {/* Message count */}
        <div className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          <span>{subject.messageCount} messages</span>
        </div>

        {/* Places mentioned */}
        {subject.placesMentioned > 0 && (
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{subject.placesMentioned} topics</span>
          </div>
        )}

        {/* Last seen */}
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>Last seen {formatDate(subject.lastSeen)}</span>
        </div>

        {/* Relevance score (if significant) */}
        {subject.relevanceScore > 10 && (
          <div className="ml-auto">
            <Badge variant="outline" className="text-xs">
              Score: {subject.relevanceScore.toFixed(1)}
            </Badge>
          </div>
        )}
      </div>

      {/* Topic reference (clickable if handler provided) */}
      {onTopicClick && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => onTopicClick(subject.topicId)}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            View in topic →
          </button>
        </div>
      )}

      {/* Archived indicator */}
      {subject.archived && (
        <div className="mt-2">
          <Badge variant="outline" className="text-xs text-gray-500">
            Archived
          </Badge>
        </div>
      )}
    </div>
  );
};
