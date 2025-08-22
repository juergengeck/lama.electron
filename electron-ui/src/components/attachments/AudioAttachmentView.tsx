/**
 * AudioAttachmentView - Component for rendering audio attachments
 */

import React, { useState, useEffect } from 'react'
import { Loader2, Download, Music } from 'lucide-react'
import type { AttachmentViewProps } from '@/types/attachments'
import { formatFileSize } from '@/types/attachments'
import { useAttachmentDescriptor } from './AttachmentViewFactory'
import { Button } from '@/components/ui/button'

export const AudioAttachmentView: React.FC<AttachmentViewProps> = ({
  attachment,
  descriptor: providedDescriptor,
  onClick,
  onDownload,
  mode = 'inline',
  showMetadata = true,
  className = ''
}) => {
  const { descriptor, loading, error } = useAttachmentDescriptor(attachment, providedDescriptor)
  const [audioUrl, setAudioUrl] = useState<string>()
  
  useEffect(() => {
    if (!descriptor) return
    
    const blob = new Blob([descriptor.data], { type: descriptor.type })
    const url = URL.createObjectURL(blob)
    setAudioUrl(url)
    
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [descriptor])
  
  const handleDownload = () => {
    if (onDownload) {
      onDownload(attachment)
    } else if (descriptor) {
      const blob = new Blob([descriptor.data], { type: descriptor.type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.name || descriptor.name || 'audio'
      a.click()
      URL.revokeObjectURL(url)
    }
  }
  
  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  
  if (error) {
    return (
      <div className={`text-sm text-red-500 p-2 ${className}`}>
        Failed to load audio
      </div>
    )
  }
  
  if (!audioUrl) return null
  
  if (mode === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 p-2 rounded border ${className}`}>
        <Music className="h-4 w-4" />
        <span className="text-sm">{attachment.name || 'Audio'}</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    )
  }
  
  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
        <div className="flex-shrink-0">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Music className="h-5 w-5 text-primary" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <audio
            src={audioUrl}
            controls
            className="w-full"
            onClick={() => onClick?.(attachment)}
          />
          
          {showMetadata && (
            <div className="mt-1 text-xs text-muted-foreground">
              {attachment.name || 'Audio'} • {formatFileSize(attachment.size || 0)}
            </div>
          )}
        </div>
        
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}