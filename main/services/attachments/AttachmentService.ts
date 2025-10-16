/**
 * AttachmentService - Core service for handling attachments with ONE platform integration
 * 
 * This service manages the storage, retrieval, and caching of attachments
 * using the ONE platform's BLOB storage system.
 */

import type { SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js'
import { storeArrayBufferAsBlob, readBlobAsArrayBuffer } from '@refinio/one.core/lib/storage-blob.js'
import type {
  BlobDescriptor,
  IAttachmentService,
  UploadOptions,
  CacheEntry,
  MessageAttachment
} from '../../types/attachments.js'
import { getAttachmentType, formatFileSize } from '../../types/attachments.js'
import { metadataExtractor, type FileMetadata } from '../metadata/MetadataExtractor.js'

/**
 * Maximum cache size (100MB)
 */
const MAX_CACHE_SIZE = 100 * 1024 * 1024

/**
 * Cache entry TTL (1 hour)
 */
const CACHE_TTL = 60 * 60 * 1000

/**
 * AttachmentService implementation
 */
export class AttachmentService implements IAttachmentService {
  public cache: Map<string, CacheEntry> = new Map()
  public cacheSize: number = 0
  private static instance: AttachmentService

  /**
   * Get singleton instance
   */
  static getInstance(): AttachmentService {
    if (!AttachmentService.instance) {
      AttachmentService.instance = new AttachmentService()
    }
    return AttachmentService.instance
  }

  /**
   * Store a file as BlobDescriptor in ONE platform with metadata extraction
   */
  async storeAttachment(file: File, options?: UploadOptions): Promise<string> {
    try {
      console.log(`[AttachmentService] Storing attachment: ${file.name} (${formatFileSize(file.size)})`)
      
      // Extract metadata first
      const metadata = await metadataExtractor.extractMetadata(file as any)
      console.log(`[AttachmentService] Extracted metadata with ${metadata.subjects?.length || 0} subjects:`, metadata.subjects)
      
      // Report initial progress
      options?.onProgress?.(10)
      
      // Read file as ArrayBuffer
      const arrayBuffer = await this.fileToArrayBuffer(file)
      options?.onProgress?.(30)
      
      // Create BlobDescriptor
      const descriptor: BlobDescriptor = {
        data: arrayBuffer,
        type: file.type || 'application/octet-stream',
        name: file.name,
        size: file.size
      }
      
      // Generate thumbnail if requested and applicable
      let thumbnailHash: string | undefined
      if (options?.generateThumbnail && file.type.startsWith('image/')) {
        try {
          thumbnailHash = await this.generateThumbnail(file, options.thumbnailSize)
          console.log(`[AttachmentService] Generated thumbnail: ${thumbnailHash}`)
        } catch (error: unknown) {
          console.warn('[AttachmentService] Failed to generate thumbnail:', error)
        }
      }
      options?.onProgress?.(50)
      
      // Store blob directly using ONE.core (this file is in main process, not renderer)
      const result = await storeArrayBufferAsBlob(arrayBuffer)
      const hash = result.hash as unknown as string
      console.log(`[AttachmentService] Stored blob with hash: ${hash}, status: ${result.status}`)
      options?.onProgress?.(80)
      
      // Cache the descriptor
      this.cacheAttachment(hash, descriptor)
      
      // Extract subjects if requested
      if (options?.extractSubjects) {
        try {
          const subjects = await this.extractSubjects(file)
          console.log(`[AttachmentService] Extracted subjects:`, subjects)
        } catch (error: unknown) {
          console.warn('[AttachmentService] Failed to extract subjects:', error)
        }
      }
      
      options?.onProgress?.(100)
      
      return hash
    } catch (error: unknown) {
      console.error('[AttachmentService] Failed to store attachment:', error)
      throw new Error(`Failed to store attachment: ${(error as Error).message}`)
    }
  }
  
  /**
   * Retrieve BlobDescriptor by hash
   * @param hash - The attachment hash
   */
  async getAttachment(hash: SHA256Hash): Promise<BlobDescriptor | null> {
    try {
      // Check cache first
      const cached = this.getCachedAttachment(hash)
      if (cached) {
        console.log(`[AttachmentService] Retrieved from cache: ${hash}`)
        return cached
      }
      
      console.log(`[AttachmentService] Loading from storage: ${hash}`)

      // Load directly from ONE.core (this file is in main process, not renderer)
      const data = await readBlobAsArrayBuffer(hash as any)

      const descriptor: BlobDescriptor = {
        data,
        type: 'application/octet-stream',
        name: 'attachment',
        size: data.byteLength
      }
      
      // Cache for future use
      this.cacheAttachment(hash, descriptor)
      
      return descriptor
    } catch (error: unknown) {
      console.error(`[AttachmentService] Failed to get attachment ${hash}:`, error)
      throw new Error(`Failed to retrieve attachment: ${(error as Error).message}`)
    }
  }
  
  /**
   * Check if attachment exists
   */
  async hasAttachment(hash: string): Promise<boolean> {
    try {
      if (this.cache.has(hash)) {
        return true
      }
      
      // Try to read from storage
      await readBlobAsArrayBuffer(hash as any)
      return true
    } catch {
      return false
    }
  }
  
  /**
   * Delete attachment from storage
   */
  async deleteAttachment(hash: string): Promise<void> {
    // Remove from cache
    const entry = this.cache.get(hash)
    if (entry) {
      this.cacheSize -= entry.descriptor.size
      this.cache.delete(hash)
    }
    
    // Note: ONE platform doesn't provide direct blob deletion
    // Blobs are garbage collected when no longer referenced
    console.log(`[AttachmentService] Removed attachment from cache: ${hash}`)
  }
  
  /**
   * Get cached attachment if available
   */
  getCachedAttachment(hash: string): BlobDescriptor | undefined {
    const entry = this.cache.get(hash)
    if (!entry) return undefined
    
    // Check if expired
    if (Date.now() - entry.cachedAt > CACHE_TTL) {
      this.cacheSize -= entry.descriptor.size
      this.cache.delete(hash)
      return undefined
    }
    
    // Update access time and count
    entry.lastAccessed = Date.now()
    entry.accessCount++
    
    return entry.descriptor
  }
  
  /**
   * Cache an attachment
   */
  private cacheAttachment(hash: string, descriptor: BlobDescriptor): void {
    // Check cache size limit
    if (this.cacheSize + descriptor.size > MAX_CACHE_SIZE) {
      this.evictLRU(descriptor.size)
    }
    
    const entry: CacheEntry = {
      descriptor,
      cachedAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1
    }
    
    this.cache.set(hash, entry)
    this.cacheSize += descriptor.size
    
    console.log(`[AttachmentService] Cached attachment: ${hash} (cache size: ${formatFileSize(this.cacheSize)})`)
  }
  
  /**
   * Evict least recently used entries
   */
  private evictLRU(requiredSpace: number): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
    
    let freedSpace = 0
    for (const [hash, entry] of entries) {
      if (freedSpace >= requiredSpace) break
      
      freedSpace += entry.descriptor.size
      this.cacheSize -= entry.descriptor.size
      this.cache.delete(hash)
      
      console.log(`[AttachmentService] Evicted from cache: ${hash}`)
    }
  }
  
  /**
   * Generate thumbnail for image/video
   */
  async generateThumbnail(file: File, maxSize: number = 200): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Thumbnail generation only supported for images')
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const img = new Image()
        
        img.onload = async () => {
          try {
            // Calculate thumbnail dimensions
            let width = img.width
            let height = img.height
            
            if (width > height) {
              if (width > maxSize) {
                height = (height * maxSize) / width
                width = maxSize
              }
            } else {
              if (height > maxSize) {
                width = (width * maxSize) / height
                height = maxSize
              }
            }
            
            // Create canvas and draw resized image
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Failed to get canvas context')
            
            ctx.drawImage(img, 0, 0, width, height)
            
            // Convert to blob
            canvas.toBlob(async (blob) => {
              if (!blob) {
                reject(new Error('Failed to create thumbnail blob'))
                return
              }
              
              // Store thumbnail as separate blob
              const arrayBuffer = await blob.arrayBuffer()
              const result = await storeArrayBufferAsBlob(arrayBuffer)
              const hash = result.hash as unknown as string
              
              // Cache thumbnail
              const descriptor: BlobDescriptor = {
                data: arrayBuffer,
                type: blob.type,
                name: `thumb_${file.name}`,
                size: blob.size
              }
              this.cacheAttachment(hash, descriptor)
              
              resolve(hash)
            }, 'image/jpeg', 0.8)
          } catch (error: unknown) {
            reject(error)
          }
        }
        
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = e.target?.result as string
      }
      
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }
  
  /**
   * Extract subject hashtags from file using metadata
   */
  async extractSubjects(file: File): Promise<string[]> {
    // Use metadata extractor for rich subject generation
    const metadata = await metadataExtractor.extractMetadata(file as any)
    return metadata.subjects
  }
  
  /**
   * Get file metadata (for display purposes)
   */
  async getFileMetadata(file: File): Promise<FileMetadata> {
    return await metadataExtractor.extractMetadata(file as any)
  }
  
  /**
   * Convert File to ArrayBuffer
   */
  private fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    })
  }
  
  /**
   * Create MessageAttachment reference from stored attachment
   */
  createMessageAttachment(hash: string, descriptor: BlobDescriptor, thumbnailHash?: string): MessageAttachment {
    return {
      hash,
      type: 'blob',
      mimeType: descriptor.type,
      name: descriptor.name,
      size: descriptor.size,
      thumbnailHash
    }
  }
}

// Export singleton instance
export const attachmentService = AttachmentService.getInstance()