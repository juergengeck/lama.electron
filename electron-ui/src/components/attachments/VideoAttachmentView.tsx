/**
 * VideoAttachmentView - Component for rendering video attachments
 */

import React, { useState, useEffect } from 'react'
import { Loader2, Download, Play, Maximize2 } from 'lucide-react'
import type { AttachmentViewProps } from '@/types/attachments'
import { formatFileSize } from '@/types/attachments'
import { useAttachmentDescriptor } from './AttachmentViewFactory'
import { Button } from '@/components/ui/button'

export const VideoAttachmentView: React.FC<AttachmentViewProps> = ({
  attachment,
  descriptor: providedDescriptor,
  onClick,
  onDownload,
  mode = 'inline',
  maxWidth = 400,
  maxHeight = 300,
  showMetadata = true,
  className = ''
}) => {
  const { descriptor, loading, error } = useAttachmentDescriptor(attachment, providedDescriptor)
  const [videoUrl, setVideoUrl] = useState<string>()
  
  useEffect(() => {
    if (!descriptor) return
    
    // Create object URL from ArrayBuffer
    const blob = new Blob([descriptor.data], { type: descriptor.type })
    const url = URL.createObjectURL(blob)
    setVideoUrl(url)
    
    // Cleanup
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
      a.download = attachment.name || descriptor.name || 'video'
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
        Failed to load video
      </div>
    )
  }
  
  if (!videoUrl) return null
  
  if (mode === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 p-2 rounded border ${className}`}>
        <div className="relative h-8 w-8 bg-muted rounded flex items-center justify-center">
          <Play className="h-4 w-4" />
        </div>
        <span className="text-sm">{attachment.name || 'Video'}</span>
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
    <div className={`relative group ${className}`}>
      <video
        src={videoUrl}
        controls
        style={{ maxWidth, maxHeight }}
        className="rounded shadow-md"
        onClick={() => onClick?.(attachment)}
      />
      
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
      
      {showMetadata && (
        <div className="mt-2 text-xs text-muted-foreground">
          {attachment.name || 'Video'} • {formatFileSize(attachment.size || 0)}
        </div>
      )}
    </div>
  )
}