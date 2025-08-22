/**
 * DocumentAttachmentView - Component for rendering document attachments
 */

import React from 'react'
import { FileText, Download, File, FileCode, FileSpreadsheet } from 'lucide-react'
import type { AttachmentViewProps } from '@/types/attachments'
import { formatFileSize } from '@/types/attachments'
import { useAttachmentDescriptor } from './AttachmentViewFactory'
import { Button } from '@/components/ui/button'

export const DocumentAttachmentView: React.FC<AttachmentViewProps> = ({
  attachment,
  descriptor: providedDescriptor,
  onClick,
  onDownload,
  mode = 'inline',
  showMetadata = true,
  className = ''
}) => {
  const { descriptor, loading, error } = useAttachmentDescriptor(attachment, providedDescriptor)
  
  const handleDownload = () => {
    if (onDownload) {
      onDownload(attachment)
    } else if (descriptor) {
      const blob = new Blob([descriptor.data], { type: descriptor.type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.name || descriptor.name || 'document'
      a.click()
      URL.revokeObjectURL(url)
    }
  }
  
  // Select icon based on file type
  const getIcon = () => {
    const mimeType = attachment.mimeType || descriptor?.type || ''
    const name = attachment.name || descriptor?.name || ''
    
    if (mimeType.includes('pdf')) return FileText
    if (mimeType.includes('spreadsheet') || name.match(/\.(xls|xlsx|csv)$/i)) return FileSpreadsheet
    if (mimeType.includes('code') || name.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|h|hpp|cs|go|rs|rb|php|swift|kt|scala|r|m|mm|sh|bash|zsh|fish|ps1|bat|cmd)$/i)) return FileCode
    if (mimeType.includes('text')) return FileText
    return File
  }
  
  const Icon = getIcon()
  
  if (loading) {
    return (
      <div className={`flex items-center gap-2 p-2 rounded border animate-pulse ${className}`}>
        <div className="h-8 w-8 bg-muted rounded" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>
    )
  }
  
  if (error) {
    return (
      <div className={`text-sm text-red-500 p-2 ${className}`}>
        Failed to load document
      </div>
    )
  }
  
  if (mode === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 p-2 rounded border ${className}`}>
        <Icon className="h-4 w-4" />
        <span className="text-sm truncate">{attachment.name || 'Document'}</span>
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
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">
          {attachment.name || descriptor?.name || 'Document'}
        </div>
        {showMetadata && (
          <div className="text-xs text-muted-foreground">
            {formatFileSize(attachment.size || descriptor?.size || 0)}
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