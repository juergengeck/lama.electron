/**
 * SubjectList Component
 * Displays scrollable list of subjects with sorting
 * Groups subjects with the same name together
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

interface SubjectGroup {
  description: string;
  subjects: EnrichedSubject[];
  // Aggregate metadata for sorting
  maxRelevanceScore: number;
  mostRecentTimestamp: number;
  totalAuthors: number;
}

export const SubjectList: React.FC<SubjectListProps> = ({
  subjects,
  sortMode,
  onTopicClick,
  className = ''
}) => {
  // Group subjects by description and sort groups
  const sortedGroups = useMemo(() => {
    // Group subjects by description
    const groupMap = new Map<string, EnrichedSubject[]>();

    subjects.forEach(subject => {
      const desc = subject.description;
      if (!groupMap.has(desc)) {
        groupMap.set(desc, []);
      }
      groupMap.get(desc)!.push(subject);
    });

    // Convert to groups with aggregate metadata
    const groups: SubjectGroup[] = Array.from(groupMap.entries()).map(([description, subjects]) => {
      const maxRelevanceScore = Math.max(...subjects.map(s => s.relevanceScore));
      const mostRecentTimestamp = Math.max(
        ...subjects.map(s => new Date(s.sortTimestamp || s.lastSeen).getTime())
      );
      const uniqueAuthors = new Set(subjects.flatMap(s => s.authors || []));

      return {
        description,
        subjects,
        maxRelevanceScore,
        mostRecentTimestamp,
        totalAuthors: uniqueAuthors.size
      };
    });

    // Sort groups based on selected mode
    switch (sortMode) {
      case 'relevance':
        groups.sort((a, b) => b.maxRelevanceScore - a.maxRelevanceScore);
        break;

      case 'time':
        groups.sort((a, b) => b.mostRecentTimestamp - a.mostRecentTimestamp);
        break;

      case 'author':
        groups.sort((a, b) => b.totalAuthors - a.totalAuthors);
        break;

      default:
        groups.sort((a, b) => b.maxRelevanceScore - a.maxRelevanceScore);
    }

    return groups;
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

  // Calculate total unique subjects for footer
  const totalSubjects = subjects.length;
  const totalGroups = sortedGroups.length;

  return (
    <div className={`subject-list ${className}`}>
      <ScrollArea className="h-[400px]">
        <div className="space-y-3 pr-4">
          {sortedGroups.map((group, groupIndex) => (
            <SubjectItem
              key={`${group.description}-${groupIndex}`}
              subjects={group.subjects}
              onTopicClick={onTopicClick}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Summary footer */}
      <div className="mt-3 pt-3 border-t text-xs text-gray-500">
        Showing {totalGroups} subject name{totalGroups !== 1 ? 's' : ''}
        {totalSubjects !== totalGroups && ` (${totalSubjects} version${totalSubjects !== 1 ? 's' : ''})`}
        {' • '}
        Sorted by {sortMode}
      </div>
    </div>
  );
};
