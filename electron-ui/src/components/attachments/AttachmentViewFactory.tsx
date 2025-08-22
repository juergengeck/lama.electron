/**
 * AttachmentViewFactory - Factory for creating attachment view components
 * Following one.leute's factory pattern for attachment rendering
 */

import React, { ReactElement } from 'react'
import type { MessageAttachment, BlobDescriptor, AttachmentViewProps } from '@/types/attachments'
import { getAttachmentType } from '@/types/attachments'
import { ImageAttachmentView } from './ImageAttachmentView'
import { VideoAttachmentView } from './VideoAttachmentView'
import { AudioAttachmentView } from './AudioAttachmentView'
import { DocumentAttachmentView } from './DocumentAttachmentView'
import { UnknownAttachmentView } from './UnknownAttachmentView'

/**
 * Factory function to create appropriate attachment view component
 * Based on one.leute's BlobDescriptorAttachmentView pattern
 */
export function createAttachmentView(
  attachment: MessageAttachment,
  descriptor?: BlobDescriptor,
  props?: Partial<AttachmentViewProps>
): ReactElement {
  const viewProps: AttachmentViewProps = {
    attachment,
    descriptor,
    ...props
  }
  
  // Determine attachment type from MIME type
  const mimeType = attachment.mimeType || descriptor?.type || 'application/octet-stream'
  const attachmentType = getAttachmentType(mimeType)
  
  // Select appropriate view component based on type
  switch (attachmentType) {
    case 'image':
      return <ImageAttachmentView {...viewProps} />
    
    case 'video':
      return <VideoAttachmentView {...viewProps} />
    
    case 'audio':
      return <AudioAttachmentView {...viewProps} />
    
    case 'document':
      return <DocumentAttachmentView {...viewProps} />
    
    case 'archive':
      // Archives shown as documents for now
      return <DocumentAttachmentView {...viewProps} />
    
    case 'unknown':
    default:
      return <UnknownAttachmentView {...viewProps} />
  }
}

/**
 * Attachment view registry for extensibility
 * Allows registering custom renderers for specific MIME types
 */
export class AttachmentViewRegistry {
  private static renderers = new Map<string, React.FC<AttachmentViewProps>>()
  
  /**
   * Register a custom renderer for a specific MIME type or pattern
   */
  static register(mimePattern: string, renderer: React.FC<AttachmentViewProps>): void {
    this.renderers.set(mimePattern, renderer)
    console.log(`[AttachmentViewRegistry] Registered renderer for: ${mimePattern}`)
  }
  
  /**
   * Get renderer for a specific MIME type
   */
  static getRenderer(mimeType: string): React.FC<AttachmentViewProps> | undefined {
    // Check exact match first
    if (this.renderers.has(mimeType)) {
      return this.renderers.get(mimeType)
    }
    
    // Check patterns (e.g., "image/*")
    for (const [pattern, renderer] of this.renderers) {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$')
        if (regex.test(mimeType)) {
          return renderer
        }
      }
    }
    
    return undefined
  }
  
  /**
   * Create view using registered renderer or default factory
   */
  static createView(
    attachment: MessageAttachment,
    descriptor?: BlobDescriptor,
    props?: Partial<AttachmentViewProps>
  ): ReactElement {
    const mimeType = attachment.mimeType || descriptor?.type || 'application/octet-stream'
    const customRenderer = this.getRenderer(mimeType)
    
    if (customRenderer) {
      const viewProps: AttachmentViewProps = {
        attachment,
        descriptor,
        ...props
      }
      return React.createElement(customRenderer, viewProps)
    }
    
    // Fall back to default factory
    return createAttachmentView(attachment, descriptor, props)
  }
}

/**
 * Hook to load attachment descriptor if not provided
 */
export function useAttachmentDescriptor(
  attachment: MessageAttachment,
  providedDescriptor?: BlobDescriptor
): {
  descriptor: BlobDescriptor | undefined
  loading: boolean
  error: Error | undefined
} {
  const [descriptor, setDescriptor] = React.useState<BlobDescriptor | undefined>(providedDescriptor)
  const [loading, setLoading] = React.useState(!providedDescriptor)
  const [error, setError] = React.useState<Error | undefined>()
  
  React.useEffect(() => {
    if (providedDescriptor) {
      setDescriptor(providedDescriptor)
      setLoading(false)
      return
    }
    
    // Load descriptor from service
    let cancelled = false
    
    async function loadDescriptor() {
      try {
        setLoading(true)
        setError(undefined)
        
        // Dynamic import to avoid circular dependencies
        const { attachmentService } = await import('@/services/attachments/AttachmentService')
        const desc = await attachmentService.getAttachment(attachment.hash, {
          type: attachment.mimeType,
          name: attachment.name
        })
        
        if (!cancelled) {
          setDescriptor(desc)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error)
          setLoading(false)
          console.error('[useAttachmentDescriptor] Failed to load:', err)
        }
      }
    }
    
    loadDescriptor()
    
    return () => {
      cancelled = true
    }
  }, [attachment.hash, providedDescriptor])
  
  return { descriptor, loading, error }
}

/**
 * Create multiple attachment views for a message
 */
export function createAttachmentViews(
  attachments: MessageAttachment[],
  descriptors?: Map<string, BlobDescriptor>,
  props?: Partial<AttachmentViewProps>
): ReactElement[] {
  return attachments.map((attachment, index) => {
    const descriptor = descriptors?.get(attachment.hash)
    const view = React.cloneElement(
      createAttachmentView(attachment, descriptor, props),
      { key: `attachment-${attachment.hash}-${index}` }
    )
    return view
  })
}