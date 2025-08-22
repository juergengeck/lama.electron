/**
 * UnknownAttachmentView - Fallback component for unknown attachment types
 */

import React from 'react'
import { FileQuestion, Download } from 'lucide-react'
import type { AttachmentViewProps } from '@/types/attachments'
import { formatFileSize } from '@/types/attachments'
import { useAttachmentDescriptor } from './AttachmentViewFactory'
import { Button } from '@/components/ui/button'

export const UnknownAttachmentView: React.FC<AttachmentViewProps> = ({
  attachment,
  descriptor: providedDescriptor,
  onClick,
  onDownload,
  mode = 'inline',
  showMetadata = true,
  className = ''
}) => {
  const { descriptor, loading } = useAttachmentDescriptor(attachment, providedDescriptor)
  
  const handleDownload = () => {
    if (onDownload) {
      onDownload(attachment)
    } else if (descriptor) {
      const blob = new Blob([descriptor.data], { type: descriptor.type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.name || descriptor.name || 'file'
      a.click()
      URL.revokeObjectURL(url)
    }
  }
  
  if (loading) {
    return (
      <div className={`flex items-center gap-2 p-2 rounded border animate-pulse ${className}`}>
        <div className="h-8 w-8 bg-muted rounded" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>
    )
  }
  
  if (mode === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 p-2 rounded border ${className}`}>
        <FileQuestion className="h-4 w-4" />
        <span className="text-sm truncate">{attachment.name || 'Unknown file'}</span>
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
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer ${className}`}
      onClick={() => onClick?.(attachment)}
    >
      <div className="flex-shrink-0">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
          <FileQuestion className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">
          {attachment.name || descriptor?.name || 'Unknown file'}
        </div>
        {showMetadata && (
          <div className="text-xs text-muted-foreground">
            {attachment.mimeType || descriptor?.type || 'Unknown type'} • {formatFileSize(attachment.size || descriptor?.size || 0)}
          </div>
        )}
      </div>
      
      <Button
        size="icon"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation()
          handleDownload()
        }}
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  )
}