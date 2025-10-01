/**
 * KeywordSettingsPage Component
 * Full keyword management page with access control
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.js';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
import { Input } from '../ui/input.js';
// Using div-based table layout since Table component may not exist
import {
  Search,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Tag,
  Shield
} from 'lucide-react';
import type {
  AggregatedKeyword,
  AllKeywordsResponse,
  AccessStateValue,
  PrincipalType
} from '../../types/keyword-detail.js';

export const KeywordSettingsPage: React.FC = () => {
  const [keywords, setKeywords] = useState<AggregatedKeyword[]>([]);
  const [filteredKeywords, setFilteredKeywords] = useState<AggregatedKeyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'frequency' | 'alphabetical' | 'lastSeen'>('frequency');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 50;

  useEffect(() => {
    loadKeywords();
  }, [sortBy, page]);

  useEffect(() => {
    // Client-side search filtering
    if (searchQuery.trim() === '') {
      setFilteredKeywords(keywords);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = keywords.filter(k =>
        k.term.toLowerCase().includes(query) ||
        k.category?.toLowerCase().includes(query)
      );
      setFilteredKeywords(filtered);
    }
  }, [searchQuery, keywords]);

  const loadKeywords = async () => {
    console.log('[KeywordSettingsPage] Loading keywords:', { sortBy, page, pageSize });
    setLoading(true);
    setError(null);

    try {
      const response: AllKeywordsResponse = await window.electronAPI.invoke(
        'keywordDetail:getAllKeywords',
        {
          sortBy,
          limit: pageSize,
          offset: page * pageSize
        }
      );

      if (response.success && response.data) {
        console.log('[KeywordSettingsPage] ✅ Loaded keywords:', {
          count: response.data.keywords.length,
          total: response.data.totalCount,
          hasMore: response.data.hasMore
        });
        setKeywords(response.data.keywords);
        setFilteredKeywords(response.data.keywords);
        setTotalCount(response.data.totalCount);
        setHasMore(response.data.hasMore);
        setError(null);
      } else {
        console.error('[KeywordSettingsPage] ❌ Failed to load keywords:', response.error);
        setError(response.error || 'Failed to load keywords');
      }
    } catch (err) {
      console.error('[KeywordSettingsPage] ❌ Error loading keywords:', err);
      setError(err instanceof Error ? err.message : 'Failed to load keywords');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    console.log('[KeywordSettingsPage] Refreshing keywords');
    loadKeywords();
  };

  const handleSortChange = (newSort: 'frequency' | 'alphabetical' | 'lastSeen') => {
    console.log('[KeywordSettingsPage] Changing sort:', newSort);
    setSortBy(newSort);
    setPage(0); // Reset to first page
  };

  const handlePreviousPage = () => {
    if (page > 0) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      setPage(page + 1);
    }
  };

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

  const handleAccessChange = async (
    keyword: string,
    principalId: string,
    principalType: PrincipalType,
    newState: AccessStateValue
  ) => {
    console.log('[KeywordSettingsPage] Updating access state:', {
      keyword,
      principalId,
      newState
    });

    try {
      const response = await window.electronAPI.invoke(
        'keywordDetail:updateKeywordAccessState',
        {
          keyword,
          principalId,
          principalType,
          state: newState
        }
      );

      if (response.success) {
        console.log('[KeywordSettingsPage] ✅ Access state updated');
        // Refresh the list to show updated counts
        loadKeywords();
      } else {
        console.error('[KeywordSettingsPage] ❌ Failed to update access:', response.error);
      }
    } catch (err) {
      console.error('[KeywordSettingsPage] ❌ Error updating access:', err);
    }
  };

  return (
    <div className="keyword-settings-page p-6 max-w-7xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Tag className="w-6 h-6 text-blue-600" />
              <div>
                <CardTitle>Keyword Management</CardTitle>
                <CardDescription>
                  Manage keywords across all conversations ({totalCount} total)
                </CardDescription>
              </div>
            </div>
            <Button onClick={handleRefresh} disabled={loading} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            {/* Search */}
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search keywords..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Sort controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={sortBy === 'frequency' ? 'default' : 'outline'}
                  onClick={() => handleSortChange('frequency')}
                >
                  Frequency
                </Button>
                <Button
                  size="sm"
                  variant={sortBy === 'alphabetical' ? 'default' : 'outline'}
                  onClick={() => handleSortChange('alphabetical')}
                >
                  A-Z
                </Button>
                <Button
                  size="sm"
                  variant={sortBy === 'lastSeen' ? 'default' : 'outline'}
                  onClick={() => handleSortChange('lastSeen')}
                >
                  Recent
                </Button>
              </div>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="text-center p-8">
              <p className="text-red-600 mb-4">Error: {error}</p>
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          )}

          {/* Table */}
          {!loading && !error && (
            <>
              <div className="border rounded-lg overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-5 gap-4 bg-gray-50 border-b px-4 py-3 text-sm font-medium text-gray-700">
                  <div>Keyword</div>
                  <div className="text-center">Frequency</div>
                  <div className="text-center">Topics</div>
                  <div>Last Seen</div>
                  <div className="text-center">Access Control</div>
                </div>

                {/* Table Body */}
                <div className="divide-y">
                  {filteredKeywords.length === 0 ? (
                    <div className="text-center p-8 text-gray-500">
                      No keywords found
                    </div>
                  ) : (
                    filteredKeywords.map((keyword, idx) => (
                      <div
                        key={`${keyword.term}-${idx}`}
                        className="grid grid-cols-5 gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        {/* Keyword */}
                        <div>
                          <p className="font-medium">{keyword.term}</p>
                          {keyword.category && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              {keyword.category}
                            </Badge>
                          )}
                          {keyword.topTopics.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              in {keyword.topTopics[0].topicName}
                              {keyword.topTopics.length > 1 &&
                                ` +${keyword.topTopics.length - 1} more`}
                            </p>
                          )}
                        </div>

                        {/* Frequency */}
                        <div className="text-center flex items-center justify-center">
                          <Badge variant="outline">{keyword.frequency}</Badge>
                        </div>

                        {/* Topics */}
                        <div className="text-center flex items-center justify-center">
                          <Badge variant="secondary">{keyword.topicCount}</Badge>
                        </div>

                        {/* Last Seen */}
                        <div className="flex items-center">
                          <span className="text-sm text-gray-600">
                            {formatDate(keyword.lastSeen)}
                          </span>
                        </div>

                        {/* Access Control */}
                        <div className="flex items-center justify-center gap-2">
                          <Shield
                            className={`w-4 h-4 ${
                              keyword.hasRestrictions ? 'text-red-500' : 'text-gray-400'
                            }`}
                          />
                          <span className="text-sm text-gray-600">
                            {keyword.accessControlCount} rules
                          </span>
                          {keyword.hasRestrictions && (
                            <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">
                              Restricted
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">
                  Showing {page * pageSize + 1}-
                  {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} keywords
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handlePreviousPage}
                    disabled={page === 0}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <Button onClick={handleNextPage} disabled={!hasMore} variant="outline" size="sm">
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
