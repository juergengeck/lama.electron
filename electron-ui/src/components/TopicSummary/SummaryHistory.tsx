/**
 * SummaryHistory Component
 * Displays version history of summaries with comparison view
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
import { GitBranch, Clock, ChevronRight, Eye, EyeOff, FileText } from 'lucide-react';
import type { Summary, GetSummaryResponse } from '../../types/topic-analysis.js';

interface SummaryHistoryProps {
  topicId: string;
  currentVersion?: number;
  onVersionSelect?: (version: number) => void;
  className?: string;
}

export const SummaryHistory: React.FC<SummaryHistoryProps> = ({
  topicId,
  currentVersion,
  onVersionSelect,
  className = ''
}) => {
  const [history, setHistory] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[number | null, number | null]>([null, null]);

  useEffect(() => {
    loadHistory();
  }, [topicId]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const response: GetSummaryResponse = await window.electronAPI.invoke(
        'topicAnalysis:getSummary',
        {
          topicId,
          includeHistory: true
        }
      );

      if (response.success && response.data) {
        setHistory(response.data.history || []);
        if (response.data.current && !currentVersion) {
          // Set current version if not provided
          onVersionSelect?.(response.data.current.version);
        }
      } else {
        setError(response.error || 'Failed to load history');
      }
    } catch (err) {
      console.error('Error loading history:', err);
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (version: number) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(version)) {
      newExpanded.delete(version);
    } else {
      newExpanded.add(version);
    }
    setExpandedVersions(newExpanded);
  };

  const selectForCompare = (version: number) => {
    if (!compareMode) {
      setCompareMode(true);
      setCompareVersions([version, null]);
    } else {
      if (compareVersions[0] === version) {
        // Deselect
        setCompareVersions([null, compareVersions[1]]);
        if (!compareVersions[1]) {
          setCompareMode(false);
        }
      } else if (compareVersions[1] === version) {
        // Deselect
        setCompareVersions([compareVersions[0], null]);
        if (!compareVersions[0]) {
          setCompareMode(false);
        }
      } else if (compareVersions[0] === null) {
        setCompareVersions([version, compareVersions[1]]);
      } else if (compareVersions[1] === null) {
        setCompareVersions([compareVersions[0], version]);
      }
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getVersionChain = (summary: Summary): number[] => {
    const chain: number[] = [summary.version];
    let current = summary;

    // Follow the chain backwards
    while (current.previousVersion) {
      const prev = history.find(s => s.hash === current.previousVersion);
      if (prev) {
        chain.push(prev.version);
        current = prev;
      } else {
        break;
      }
    }

    return chain;
  };

  const renderComparison = () => {
    if (!compareMode || !compareVersions[0] || !compareVersions[1]) return null;

    const v1 = history.find(s => s.version === compareVersions[0]);
    const v2 = history.find(s => s.version === compareVersions[1]);

    if (!v1 || !v2) return null;

    return (
      <Card className="mt-4 border-blue-200">
        <CardHeader className="pb-3 bg-blue-50">
          <CardTitle className="text-sm">
            Comparing Version {v1.version} ↔ Version {v2.version}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Version {v1.version}</p>
              <p className="text-sm">{v1.content}</p>
              <div className="mt-2 text-xs text-gray-500">
                {v1.keywords.length} keywords • {v1.subjects.length} subjects
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Version {v2.version}</p>
              <p className="text-sm">{v2.content}</p>
              <div className="mt-2 text-xs text-gray-500">
                {v2.keywords.length} keywords • {v2.subjects.length} subjects
              </div>
            </div>
          </div>

          {/* Differences */}
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs font-medium text-gray-500 mb-2">Changes</p>
            <div className="space-y-1 text-xs">
              {Math.abs(v2.keywords.length - v1.keywords.length) > 0 && (
                <div>
                  Keywords: {v1.keywords.length} → {v2.keywords.length}
                  {v2.keywords.length > v1.keywords.length ? (
                    <span className="text-green-600 ml-1">
                      (+{v2.keywords.length - v1.keywords.length})
                    </span>
                  ) : (
                    <span className="text-red-600 ml-1">
                      ({v2.keywords.length - v1.keywords.length})
                    </span>
                  )}
                </div>
              )}
              {Math.abs(v2.subjects.length - v1.subjects.length) > 0 && (
                <div>
                  Subjects: {v1.subjects.length} → {v2.subjects.length}
                  {v2.subjects.length > v1.subjects.length ? (
                    <span className="text-green-600 ml-1">
                      (+{v2.subjects.length - v1.subjects.length})
                    </span>
                  ) : (
                    <span className="text-red-600 ml-1">
                      ({v2.subjects.length - v1.subjects.length})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
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

  if (history.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-4 text-center text-gray-500">
          <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>No version history yet</p>
          <p className="text-sm mt-1">History will appear as summaries are updated</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Version History
          </CardTitle>
          {history.length > 1 && (
            <Button
              onClick={() => setCompareMode(!compareMode)}
              size="sm"
              variant={compareMode ? 'default' : 'outline'}
              className="h-8"
            >
              {compareMode ? 'Cancel Compare' : 'Compare'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {history.map((summary, index) => {
            const isExpanded = expandedVersions.has(summary.version);
            const isCurrent = summary.version === currentVersion;
            const isSelected = compareVersions.includes(summary.version);
            const chain = getVersionChain(summary);

            return (
              <div
                key={summary.version}
                className={`
                  border rounded-lg p-3 transition-all
                  ${isCurrent ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}
                  ${isSelected ? 'ring-2 ring-blue-300' : ''}
                  ${compareMode ? 'cursor-pointer' : ''}
                `}
                onClick={() => compareMode && selectForCompare(summary.version)}
              >
                {/* Version Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={isCurrent ? 'default' : 'secondary'}>
                      v{summary.version}
                    </Badge>
                    {isCurrent && (
                      <Badge variant="outline" className="text-xs">
                        Current
                      </Badge>
                    )}
                    {summary.changeReason && (
                      <span className="text-xs text-gray-600">
                        {summary.changeReason}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(summary.createdAt)}
                    </span>
                    {!compareMode && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(summary.version);
                        }}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                      >
                        {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && !compareMode && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-gray-700">{summary.content}</p>

                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>{summary.keywords.length} keywords</span>
                      <span>{summary.subjects.length} subjects</span>
                      <span>{summary.content.split(' ').length} words</span>
                    </div>

                    {/* Version Chain */}
                    {chain.length > 1 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                        <span>Chain:</span>
                        {chain.map((v, i) => (
                          <React.Fragment key={v}>
                            <span className={v === summary.version ? 'font-bold' : ''}>
                              v{v}
                            </span>
                            {i < chain.length - 1 && <ChevronRight className="w-3 h-3" />}
                          </React.Fragment>
                        ))}
                      </div>
                    )}

                    {!isCurrent && onVersionSelect && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onVersionSelect(summary.version);
                        }}
                        size="sm"
                        className="mt-3"
                      >
                        Load This Version
                      </Button>
                    )}
                  </div>
                )}

                {/* Compare Mode Selection */}
                {compareMode && (
                  <div className="mt-2 text-xs">
                    {isSelected ? (
                      <span className="text-blue-600 font-medium">
                        Selected for comparison
                      </span>
                    ) : (
                      <span className="text-gray-400">
                        Click to select for comparison
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Comparison View */}
        {renderComparison()}

        {/* Stats */}
        {!compareMode && (
          <div className="mt-4 pt-3 border-t text-xs text-gray-500">
            <div className="flex justify-between">
              <span>{history.length} total versions</span>
              <span>Retention: 30 days / 10 versions</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};