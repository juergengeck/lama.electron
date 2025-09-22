import React, { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, Sparkles, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Summary } from '../../types/topic-analysis'

interface ChatContextProps {
  topicId: string
  messages: any[]
  messageCount: number
  className?: string
}

export const ChatContext: React.FC<ChatContextProps> = ({
  topicId,
  messages,
  messageCount,
  className = ''
}) => {
  const [expanded, setExpanded] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const hasEnoughMessages = messageCount >= 5

  // Load summary when component mounts or topicId changes
  useEffect(() => {
    if (hasEnoughMessages) {
      loadSummary()
    }
  }, [topicId, hasEnoughMessages])

  const loadSummary = async () => {
    if (!hasEnoughMessages) return

    setLoading(true)
    try {
      const response = await window.electronAPI.invoke('topicAnalysis:getSummary', {
        topicId,
        includeHistory: false
      })

      if (response.success && response.data?.current) {
        setSummary(response.data.current)
      }
    } catch (err) {
      console.error('[ChatContext] Error loading summary:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const response = await window.electronAPI.invoke('topicAnalysis:analyzeMessages', {
        topicId,
        messages: messages.map(m => ({
          id: m.id,
          content: m.content || m.text,
          sender: m.sender || m.author,
          timestamp: m.timestamp || Date.now()
        })),
        forceReanalysis: true
      })

      if (response.success) {
        await loadSummary()
      }
    } catch (err) {
      console.error('[ChatContext] Error analyzing:', err)
    } finally {
      setAnalyzing(false)
    }
  }

  // Don't render anything if not enough messages
  if (!hasEnoughMessages) return null

  return (
    <div className={`border-t bg-muted/30 ${className}`}>
      {/* Toggle Bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-medium">Context & Summary</span>
          {summary && !expanded && (
            <span className="text-muted-foreground truncate max-w-[300px]">
              • {summary.content.substring(0, 50)}...
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : summary ? (
            <>
              {/* Summary Content */}
              <div className="bg-background rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-sm">AI Summary</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={handleAnalyze}
                    disabled={analyzing}
                  >
                    {analyzing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {summary.content}
                </p>

                {/* Version and Update Info */}
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>v{summary.version}</span>
                  {summary.updatedAt && (
                    <>
                      <span>•</span>
                      <span>{new Date(summary.updatedAt).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Key Topics/Subjects */}
              {summary.subjects && summary.subjects.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Key Topics</h4>
                  <div className="flex flex-wrap gap-1">
                    {summary.subjects.slice(0, 8).map((subject, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {subject}
                      </Badge>
                    ))}
                    {summary.subjects.length > 8 && (
                      <Badge variant="ghost" className="text-xs">
                        +{summary.subjects.length - 8} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Suggested Responses (future feature) */}
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground italic">
                  💡 Use this context to inform your next message
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-2">
                No summary available yet
              </p>
              <Button
                size="sm"
                onClick={handleAnalyze}
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
                    Generate Summary
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}