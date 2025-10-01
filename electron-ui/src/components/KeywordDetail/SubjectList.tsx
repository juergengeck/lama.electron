/**
 * SubjectList Component
 * Displays scrollable list of subjects with sorting
 */

import React, { useMemo } from 'react';
import { SubjectItem } from './SubjectItem.js';
import { ScrollArea } from '../ui/scroll-area.js';
import type { EnrichedSubject, SubjectSortMode } from '../../types/keyword-detail.js';

interface SubjectListProps {
  subjects: EnrichedSubject[];
  sortMode: SubjectSortMode;
  onTopicClick?: (topicId: string) => void;
  className?: string;
}

export const SubjectList: React.FC<SubjectListProps> = ({
  subjects,
  sortMode,
  onTopicClick,
  className = ''
}) => {
  // Sort subjects based on selected mode
  const sortedSubjects = useMemo(() => {
    const sorted = [...subjects];

    switch (sortMode) {
      case 'relevance':
        // Sort by relevance score (descending)
        sorted.sort((a, b) => b.relevanceScore - a.relevanceScore);
        break;

      case 'time':
        // Sort by last seen timestamp (descending - most recent first)
        sorted.sort((a, b) => {
          const timeA = new Date(a.sortTimestamp || a.lastSeen).getTime();
          const timeB = new Date(b.sortTimestamp || b.lastSeen).getTime();
          return timeB - timeA;
        });
        break;

      case 'author':
        // Sort by number of authors (descending)
        sorted.sort((a, b) => {
          const authorsA = a.authors?.length || 0;
          const authorsB = b.authors?.length || 0;
          return authorsB - authorsA;
        });
        break;

      default:
        // Default to relevance
        sorted.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    return sorted;
  }, [subjects, sortMode]);

  // Empty state
  if (subjects.length === 0) {
    return (
      <div className={`subject-list-empty text-center p-8 ${className}`}>
        <p className="text-gray-500">No subjects found</p>
        <p className="text-sm text-gray-400 mt-2">
          This keyword hasn't been associated with any subjects yet
        </p>
      </div>
    );
  }

  return (
    <div className={`subject-list ${className}`}>
      <ScrollArea className="h-[400px]">
        <div className="space-y-3 pr-4">
          {sortedSubjects.map((subject, index) => (
            <SubjectItem
              key={`${subject.topicId}-${subject.keywordCombination}-${index}`}
              subject={subject}
              onTopicClick={onTopicClick}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Summary footer */}
      <div className="mt-3 pt-3 border-t text-xs text-gray-500">
        Showing {sortedSubjects.length} subject{sortedSubjects.length !== 1 ? 's' : ''}
        {' • '}
        Sorted by {sortMode}
      </div>
    </div>
  );
};
