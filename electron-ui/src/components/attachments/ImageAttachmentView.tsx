/**
 * ImageAttachmentView - Component for rendering image attachments
 */

import React, { useState, useEffect } from 'react'
import { Loader2, Download, Maximize2, X } from 'lucide-react'
import type { AttachmentViewProps } from '@/types/attachments'
import { formatFileSize } from '@/types/attachments'
import { useAttachmentDescriptor } from './AttachmentViewFactory'
import { Button } from '@/components/ui/button'

export const ImageAttachmentView: React.FC<AttachmentViewProps> = ({
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
  const [imageUrl, setImageUrl] = useState<string>()
  const [fullscreen, setFullscreen] = useState(false)
  
  useEffect(() => {
    if (!descriptor) return
    
    // Create object URL from ArrayBuffer
    const blob = new Blob([descriptor.data], { type: descriptor.type })
    const url = URL.createObjectURL(blob)
    setImageUrl(url)
    
    // Cleanup
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [descriptor])
  
  const handleClick = () => {
    if (onClick) {
      onClick(attachment)
    } else {
      setFullscreen(true)
    }
  }
  
  const handleDownload = () => {
    if (onDownload) {
      onDownload(attachment)
    } else if (descriptor) {
      // Create download link
      const blob = new Blob([descriptor.data], { type: descriptor.type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.name || descriptor.name || 'image'
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
        Failed to load image
      </div>
    )
  }
  
  if (!imageUrl) return null
  
  // Render based on mode
  if (mode === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 p-2 rounded border ${className}`}>
        <img
          src={imageUrl}
          alt={attachment.name || 'Image'}
          className="h-8 w-8 object-cover rounded"
        />
        <span className="text-sm">{attachment.name || 'Image'}</span>
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
  
  if (mode === 'thumbnail') {
    return (
      <div
        className={`relative cursor-pointer group ${className}`}
        onClick={handleClick}
        style={{ maxWidth: 120, maxHeight: 120 }}
      >
        <img
          src={imageUrl}
          alt={attachment.name || 'Image'}
          className="w-full h-full object-cover rounded"
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded flex items-center justify-center">
          <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    )
  }
  
  // Default inline mode
  return (
    <>
      <div className={`relative group ${className}`}>
        <div
          className="cursor-pointer"
          onClick={handleClick}
          style={{ maxWidth, maxHeight }}
        >
          <img
            src={imageUrl}
            alt={attachment.name || 'Image'}
            className="rounded shadow-md max-w-full max-h-full object-contain"
          />
          
          {/* Overlay with actions */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation()
                setFullscreen(true)
              }}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation()
                handleDownload()
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Metadata */}
        {showMetadata && (
          <div className="mt-2 text-xs text-muted-foreground">
            {attachment.name || 'Image'} • {formatFileSize(attachment.size || 0)}
          </div>
        )}
      </div>
      
      {/* Fullscreen view */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setFullscreen(false)}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={imageUrl}
              alt={attachment.name || 'Image'}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Close button */}
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={() => setFullscreen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
            
            {/* Download button */}
            <Button
              size="icon"
              variant="ghost"
              className="absolute bottom-4 right-4 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation()
                handleDownload()
              }}
            >
              <Download className="h-6 w-6" />
            </Button>
            
            {/* Info */}
            <div className="absolute bottom-4 left-4 text-white">
              <div className="text-lg font-medium">{attachment.name || 'Image'}</div>
              <div className="text-sm opacity-80">{formatFileSize(attachment.size || 0)}</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}