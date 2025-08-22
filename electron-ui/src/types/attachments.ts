/**
 * Attachment type definitions following one.leute patterns
 * These types bridge between ONE platform storage and UI components
 */

/**
 * Core BlobDescriptor type (matches ONE platform structure)
 * This is the fundamental attachment representation in storage
 */
export interface BlobDescriptor {
  /** File content as binary data */
  data: ArrayBuffer
  /** MIME type (e.g., 'image/png', 'application/pdf') */
  type: string
  /** Original filename */
  name: string
  /** File size in bytes */
  size: number
  /** Last modified timestamp (Unix milliseconds) */
  lastModified: number
}

/**
 * Attachment reference stored in messages
 * Messages don't contain the actual data, just references
 */
export interface MessageAttachment {
  /** SHA256 hash of the BlobDescriptor */
  hash: string
  /** Attachment storage type */
  type: 'blob' | 'clob' | 'document'
  /** Optional MIME type hint for quick type detection */
  mimeType?: string
  /** Optional filename for display */
  name?: string
  /** Optional file size for display */
  size?: number
  /** Optional thumbnail hash for images/videos */
  thumbnailHash?: string
}

/**
 * Enhanced attachment with additional metadata
 * Used in UI components for rich display
 */
export interface EnhancedAttachment extends BlobDescriptor {
  /** SHA256 hash identifier */
  hash: string
  /** Base64 thumbnail for preview (images/videos) */
  thumbnail?: string
  /** Subject hashtags extracted from content */
  subjects: string[]
  /** Trust level (1-5) inherited from sender */
  trustLevel: number
  /** Upload/processing progress (0-100) */
  progress?: number
  /** Processing state */
  state?: 'uploading' | 'processing' | 'ready' | 'error'
  /** Error message if failed */
  error?: string
}

/**
 * Attachment view properties for rendering components
 */
export interface AttachmentViewProps {
  /** The attachment to display */
  attachment: MessageAttachment
  /** BlobDescriptor with actual data (may be loading) */
  descriptor?: BlobDescriptor
  /** Callback when attachment is clicked */
  onClick?: (attachment: MessageAttachment) => void
  /** Callback for download action */
  onDownload?: (attachment: MessageAttachment) => void
  /** Callback for delete action */
  onDelete?: (attachment: MessageAttachment) => void
  /** Display mode */
  mode?: 'inline' | 'thumbnail' | 'compact'
  /** Maximum dimensions for display */
  maxWidth?: number
  maxHeight?: number
  /** Show metadata overlay */
  showMetadata?: boolean
  /** Custom CSS classes */
  className?: string
}

/**
 * Attachment cache entry
 */
export interface CacheEntry {
  /** BlobDescriptor data */
  descriptor: BlobDescriptor
  /** Cache timestamp */
  cachedAt: number
  /** Last access timestamp */
  lastAccessed: number
  /** Access count for LRU */
  accessCount: number
}

/**
 * Attachment upload options
 */
export interface UploadOptions {
  /** Generate thumbnail for images/videos */
  generateThumbnail?: boolean
  /** Maximum thumbnail size */
  thumbnailSize?: number
  /** Compress images before upload */
  compressImages?: boolean
  /** JPEG compression quality (0-1) */
  compressionQuality?: number
  /** Extract subject hashtags */
  extractSubjects?: boolean
  /** Trust level for sharing */
  trustLevel?: number
  /** Progress callback */
  onProgress?: (progress: number) => void
}

/**
 * Attachment service interface
 */
export interface IAttachmentService {
  /**
   * Store a file as BlobDescriptor in ONE platform
   * @returns SHA256 hash of stored attachment
   */
  storeAttachment(file: File, options?: UploadOptions): Promise<string>
  
  /**
   * Retrieve BlobDescriptor by hash
   */
  getAttachment(hash: string): Promise<BlobDescriptor>
  
  /**
   * Check if attachment exists
   */
  hasAttachment(hash: string): Promise<boolean>
  
  /**
   * Delete attachment from storage
   */
  deleteAttachment(hash: string): Promise<void>
  
  /**
   * Get cached attachment if available
   */
  getCachedAttachment(hash: string): BlobDescriptor | undefined
  
  /**
   * Generate thumbnail for image/video
   */
  generateThumbnail(file: File, maxSize?: number): Promise<string>
  
  /**
   * Extract subject hashtags from file
   */
  extractSubjects(file: File): Promise<string[]>
}

/**
 * Attachment type detection
 */
export type AttachmentType = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'unknown'

/**
 * Get attachment type from MIME type
 */
export function getAttachmentType(mimeType: string): AttachmentType {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document'
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compress')) return 'archive'
  return 'unknown'
}

/**
 * Check if file type is supported for preview
 */
export function isPreviewSupported(mimeType: string): boolean {
  const supported = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/ogg',
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
    'application/pdf', 'text/plain', 'text/html', 'text/markdown'
  ]
  return supported.some(type => mimeType.startsWith(type))
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}