import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Clock, Server, Globe, Activity } from 'lucide-react';
import type { StateEntry } from '@refinio/refinio-api/dist/state/index.js';
import { useAppModel } from '@/contexts/AppModelContext';

export const AppStateJournal: React.FC = () => {
  const appModel = useAppModel();
  const [entries, setEntries] = useState<StateEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appModel?.appStateModel) {
      setLoading(false);
      return;
    }

    // Load initial entries
    const loadEntries = async () => {
      try {
        const journalEntries = await appModel.appStateModel!.getJournalEntries();
        setEntries(journalEntries);
      } catch (error) {
        console.error('[StateJournal] Failed to load entries:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEntries();

    // Subscribe to state changes
    const unsubscribe = appModel.appStateModel.onStateChange((entry: StateEntry) => {
      setEntries(prev => [...prev, entry].sort((a, b) => b.timestamp - a.timestamp));
    });

    return unsubscribe;
  }, [appModel]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getSourceIcon = (source: string) => {
    return source === 'browser' ? <Globe className="h-4 w-4" /> : <Server className="h-4 w-4" />;
  };

  const getSourceColor = (source: string) => {
    return source === 'browser' ? 'bg-blue-500' : 'bg-green-500';
  };

  const formatPath = (path: string) => {
    return path.split('.').map((part, i) => (
      <span key={i}>
        {i > 0 && <span className="text-muted-foreground mx-1">.</span>}
        <span className="font-mono">{part}</span>
      </span>
    ));
  };

  const formatValue = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object') {
        return JSON.stringify(parsed, null, 2);
      }
      return String(parsed);
    } catch {
      return value;
    }
  };

  if (!appModel?.appStateModel) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            State Journal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">State journaling not available</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            State Journal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading state journal...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          App State Journal
          <Badge variant="outline" className="ml-auto">
            {entries.length} entries
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          <div className="space-y-2 p-4">
            {entries.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No state changes recorded yet
              </p>
            ) : (
              entries.map((entry, index) => (
                <div
                  key={`${entry.timestamp}-${index}`}
                  className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded ${getSourceColor(entry.source)} text-white`}>
                        {getSourceIcon(entry.source)}
                      </div>
                      <span className="text-sm font-medium capitalize">
                        {entry.source}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(entry.timestamp)}
                    </div>
                  </div>

                  {/* Path */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Path:</span>
                    <div className="text-sm">{formatPath(entry.path)}</div>
                  </div>

                  {/* Value */}
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Value:</span>
                    <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
                      {formatValue(entry.value)}
                    </pre>
                  </div>

                  {/* Previous Value (if exists) */}
                  {entry.previousValue && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Previous:</span>
                      <pre className="text-xs bg-muted rounded p-2 overflow-x-auto opacity-60">
                        {formatValue(entry.previousValue)}
                      </pre>
                    </div>
                  )}

                  {/* Metadata */}
                  {entry.metadata && (
                    <div className="flex items-center gap-2 text-xs">
                      {entry.metadata.action && (
                        <Badge variant="secondary" className="text-xs">
                          {entry.metadata.action}
                        </Badge>
                      )}
                      {entry.metadata.description && (
                        <span className="text-muted-foreground italic">
                          {entry.metadata.description}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};