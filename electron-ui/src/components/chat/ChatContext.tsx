import React, { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, Sparkles, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Summary } from '../../types/topic-analysis.js'

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

  // Format summary content with better structure
  const formatSummaryContent = (content: string) => {
    if (!content) return null

    // Split content into sections based on common patterns
    const lines = content.split('\n').filter(line => line.trim())

    return lines.map((line, idx) => {
      // Handle bullet points
      if (line.trim().startsWith('-') || line.trim().startsWith('•') || line.trim().startsWith('*')) {
        return (
          <li key={idx} className="ml-4 list-disc list-inside">
            {line.replace(/^[-•*]\s*/, '')}
          </li>
        )
      }

      // Handle numbered lists
      const numberedMatch = line.match(/^(\d+\.)\s+(.*)/)
      if (numberedMatch) {
        return (
          <li key={idx} className="ml-4 list-decimal list-inside">
            {numberedMatch[2]}
          </li>
        )
      }

      // Handle section headers (text followed by colon)
      if (line.includes(':') && line.indexOf(':') < 50) {
        const [header, ...rest] = line.split(':')
        if (rest.length > 0) {
          return (
            <div key={idx} className="mt-1">
              <span className="font-semibold">{header}:</span>
              <span className="ml-1">{rest.join(':')}</span>
            </div>
          )
        }
      }

      // Handle bold text
      const formattedLine = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')

      // Regular paragraph
      return (
        <p
          key={idx}
          className="text-sm"
          dangerouslySetInnerHTML={{ __html: formattedLine }}
        />
      )
    })
  }

  // Check if this is an AI conversation (has AI participant)
  const hasAIParticipant = messages.some(m => m.isAI) ||
                           topicId === 'default' ||
                           topicId === 'ai-chat'

  // Load summary when component mounts or topicId changes
  useEffect(() => {
    if (hasAIParticipant) {
      loadSummary()
    }
  }, [topicId, hasAIParticipant])

  const loadSummary = async () => {
    if (!hasAIParticipant) return

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
    console.log('[ChatContext] Generate Summary button clicked!')
    setAnalyzing(true)
    try {
      console.log('[ChatContext] Calling analyzeMessages with:', { topicId, messageCount: messages.length })
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

      console.log('[ChatContext] analyzeMessages response:', response)

      if (response.success) {
        console.log('[ChatContext] Analysis successful, loading summary...')
        await loadSummary()
      } else {
        console.error('[ChatContext] Analysis failed:', response.error)
      }
    } catch (err) {
      console.error('[ChatContext] Error analyzing:', err)
    } finally {
      setAnalyzing(false)
    }
  }

  // Don't render anything if no AI participant
  if (!hasAIParticipant) return null

  return (
    <div className={`${className}`}>
      {/* Content Panel */}
      <div className="px-4 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : summary ? (
            <>
              {/* Summary Content */}
              <div className="bg-background rounded-lg p-3">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-medium text-sm flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    AI Summary
                  </h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    title="Regenerate summary"
                  >
                    {analyzing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                  </Button>
                </div>

                {/* Formatted summary content */}
                <div className="text-sm text-foreground/90 leading-relaxed space-y-2">
                  {formatSummaryContent(summary.content)}
                </div>

                {/* Version and Update Info */}
                <div className="flex items-center gap-2 mt-3 pt-2 border-t text-xs text-muted-foreground/70">
                  <span className="font-mono">v{summary.version}</span>
                  {summary.generatedAt ? (
                    <>
                      <span>•</span>
                      <span>{new Date(summary.generatedAt).toLocaleDateString()}</span>
                    </>
                  ) : summary.updatedAt && (
                    <>
                      <span>•</span>
                      <span>{new Date(summary.updatedAt).toLocaleDateString()}</span>
                    </>
                  )}
                  {summary.changeReason && (
                    <>
                      <span>•</span>
                      <span className="italic">{summary.changeReason}</span>
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
    </div>
  )
}