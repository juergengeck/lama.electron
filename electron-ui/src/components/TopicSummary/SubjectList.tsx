/**
 * SubjectList Component
 * Displays list of subjects identified in a topic
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import { Merge, Archive, MessageSquare, Clock } from 'lucide-react';
import type { Subject, GetSubjectsResponse } from '../../types/topic-analysis.js';

interface SubjectListProps {
  topicId: string;
  onSubjectClick?: (subject: Subject) => void;
  onMergeSubjects?: (subject1: string, subject2: string) => void;
  showArchived?: boolean;
  className?: string;
}

export const SubjectList: React.FC<SubjectListProps> = ({
  topicId,
  onSubjectClick,
  onMergeSubjects,
  showArchived = false,
  className = ''
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [mergeMode, setMergeMode] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, [topicId, showArchived]);

  // Listen for subject update events from backend
  useEffect(() => {
    if (!topicId || !window.electronAPI) return;

    const handleSubjectsUpdated = (data: any) => {
      if (data.topicId === topicId) {
        console.log('[SubjectList] Subjects updated event received for topic:', topicId);
        // Re-fetch subjects
        loadSubjects();
      }
    };

    const unsub = window.electronAPI.on('subjects:updated', handleSubjectsUpdated);
    return () => {
      if (unsub) unsub();
    };
  }, [topicId]);

  const loadSubjects = async () => {
    console.log('[SubjectList] 🔍 Loading subjects for topic:', topicId, showArchived ? '(including archived)' : '');
    setLoading(true);
    setError(null);

    try {
      const response: GetSubjectsResponse = await window.electronAPI.invoke(
        'topicAnalysis:getSubjects',
        {
          topicId,
          includeArchived: showArchived
        }
      );

      if (response.success && response.data) {
        console.log('[SubjectList] ✅ Subjects loaded:', {
          count: response.data.subjects.length,
          active: response.data.subjects.filter(s => !s.archived).length,
          archived: response.data.subjects.filter(s => s.archived).length
        });
        setSubjects(response.data.subjects);
      } else {
        console.error('[SubjectList] ❌ Failed to load subjects:', response.error);
        setError(response.error || 'Failed to load subjects');
      }
    } catch (err) {
      console.error('[SubjectList] ❌ Error loading subjects:', err);
      setError('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectClick = (subject: Subject) => {
    if (mergeMode) {
      console.log('[SubjectList] 🎯 Subject clicked in merge mode:', subject.keywords.join('+'));
      toggleMergeSelection(subject.id);
    } else if (onSubjectClick) {
      console.log('[SubjectList] 🎯 Subject clicked:', subject.keywords.join('+'));
      onSubjectClick(subject);
    }
  };

  const toggleMergeSelection = (subjectId: string) => {
    const newSelection = new Set(selectedForMerge);
    if (newSelection.has(subjectId)) {
      console.log('[SubjectList] ➖ Deselecting subject for merge:', subjectId);
      newSelection.delete(subjectId);
    } else {
      if (newSelection.size < 2) {
        console.log('[SubjectList] ➕ Selecting subject for merge:', subjectId);
        newSelection.add(subjectId);
      }
    }
    setSelectedForMerge(newSelection);
  };

  const handleMerge = async () => {
    const ids = Array.from(selectedForMerge);
    console.log('[SubjectList] 🔀 Merging subjects:', ids);
    if (ids.length === 2 && onMergeSubjects) {
      await onMergeSubjects(ids[0], ids[1]);
      setSelectedForMerge(new Set());
      setMergeMode(false);
      await loadSubjects();
      console.log('[SubjectList] ✅ Merge completed, reloaded subjects');
    }
  };

  const toggleMergeMode = () => {
    console.log('[SubjectList] 🔀 Toggling merge mode:', !mergeMode);
    setMergeMode(!mergeMode);
    setSelectedForMerge(new Set());
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 168) return `${Math.floor(diffHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
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
        </CardContent>
      </Card>
    );
  }

  if (subjects.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-4 text-center text-gray-500">
          <p>No subjects identified yet</p>
          <p className="text-sm mt-2">Subjects will appear as the conversation develops</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Conversation Topics</CardTitle>
          {subjects.length > 1 && (
            <Button
              onClick={toggleMergeMode}
              size="sm"
              variant={mergeMode ? 'default' : 'outline'}
              className="h-8"
            >
              <Merge className="w-4 h-4 mr-1" />
              {mergeMode ? 'Cancel' : 'Merge'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              onClick={() => handleSubjectClick(subject)}
              className={`
                p-3 rounded-lg border transition-all cursor-pointer
                ${mergeMode && selectedForMerge.has(subject.id)
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
                }
                ${subject.archived ? 'opacity-60' : ''}
              `}
            >
              {/* Subject Keywords */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex flex-wrap gap-1">
                  {subject.keywords.map((keyword, idx) => (
                    <Badge key={idx} variant="default" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
                {subject.archived && (
                  <Archive className="w-4 h-4 text-gray-400" />
                )}
              </div>

              {/* Subject Metadata */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  <span>{subject.messageCount} messages</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimestamp(subject.timestamp)}</span>
                </div>
              </div>

              {/* Selection indicator for merge mode */}
              {mergeMode && (
                <div className="mt-2 text-xs">
                  {selectedForMerge.has(subject.id) ? (
                    <span className="text-blue-600 font-medium">Selected for merge</span>
                  ) : (
                    <span className="text-gray-400">Click to select</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Merge Button */}
        {mergeMode && selectedForMerge.size === 2 && (
          <div className="mt-4 pt-3 border-t">
            <Button
              onClick={handleMerge}
              className="w-full"
              size="sm"
            >
              <Merge className="w-4 h-4 mr-2" />
              Merge Selected Topics
            </Button>
          </div>
        )}

        {/* Summary Stats */}
        <div className="mt-4 pt-3 border-t text-xs text-gray-500">
          <div className="flex justify-between">
            <span>{subjects.filter(s => !s.archived).length} active topics</span>
            {subjects.some(s => s.archived) && (
              <span>{subjects.filter(s => s.archived).length} archived</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};