/**
 * Attachment type definitions following one.leute patterns
 */

import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { BLOB, CLOB, OneObjectTypes, Person } from '@refinio/one.core/lib/recipes.js';

/**
 * Base attachment info structure
 */
export interface AttachmentInfo {
  hash: SHA256Hash;
  type: AttachmentType;
  data?: any; // URL for images/videos, text for CLOBs, etc.
  cachedObject?: OneObjectTypes;
  metadata?: Record<string, any>;
}

/**
 * Attachment types supported by the application
 */
export type AttachmentType =
  | 'blob'        // Images, videos, documents
  | 'clob'        // Text content
  | 'thinking'    // AI thinking content
  | 'image'       // Image with thumbnail support
  | 'video'       // Video with thumbnail support
  | 'audio'       // Audio files
  | 'document'    // PDF, Word, etc.
  | 'unknown';    // Fallback type

/**
 * Media attachment with thumbnail support
 */
export interface MediaAttachment extends AttachmentInfo {
  type: 'image' | 'video';
  thumbnailHash?: SHA256Hash<BLOB>;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number; // For videos
}

/**
 * Document attachment
 */
export interface DocumentAttachment extends AttachmentInfo {
  type: 'document';
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
}

/**
 * Thinking attachment (CLOB)
 */
export interface ThinkingAttachment extends AttachmentInfo {
  type: 'thinking';
  hash: SHA256Hash;  // Remove generic type
  metadata: {
    partIndex: number;
    timestamp: number;
    visible: boolean;
    modelId?: string;
    responseHash?: string;
    aiId?: SHA256IdHash<Person>;
  };
}

/**
 * Audio attachment
 */
export interface AudioAttachment extends AttachmentInfo {
  type: 'audio';
  mimeType?: string;
  duration?: number;
}

/**
 * Union type for all attachment types
 */
export type ChatAttachment =
  | MediaAttachment
  | DocumentAttachment
  | ThinkingAttachment
  | AudioAttachment
  | AttachmentInfo;

/**
 * Attachment cache entry
 */
export interface AttachmentCacheEntry {
  attachment: ChatAttachment;
  loadedAt: number;
  size?: number;
  localUri?: string; // For cached media files
}

/**
 * Cache entry for attachments in AttachmentService
 */
export interface CacheEntry {
  descriptor: BlobDescriptor;
  cachedAt: number;
  lastAccessed: number;
  accessCount: number;
}

/**
 * Upload options for attachments
 */
export interface UploadOptions {
  compress?: boolean;
  maxSize?: number;
  generateThumbnail?: boolean;
  thumbnailSize?: number;
  metadata?: Record<string, any>;
  onProgress?: (progress: number) => void;
  extractSubjects?: boolean;
}

/**
 * Attachment service interface
 */
export interface IAttachmentService {
  storeAttachment(file: File, options?: UploadOptions): Promise<string>;
  getAttachment(hash: SHA256Hash): Promise<BlobDescriptor | null>;
  hasAttachment(hash: string): Promise<boolean>;
  deleteAttachment(hash: string): Promise<void>;
  getCachedAttachment(hash: string): BlobDescriptor | undefined;
}

/**
 * BLOB descriptor for media files (following one.leute pattern)
 */
export interface BlobDescriptor {
  $type$?: 'BlobDescriptor';
  data: ArrayBuffer; // Actual data
  type: string; // MIME type
  name: string; // File name
  size: number; // File size
  width?: number;
  height?: number;
  duration?: number;
  thumbnailHash?: string;
}

/**
 * Message attachment reference (for Message objects)
 */
export interface MessageAttachment {
  hash: string;
  type: 'blob' | 'image' | 'video' | 'audio' | 'document';
  mimeType: string;
  name: string;
  size: number;
  thumbnailHash?: string;
  width?: number;
  height?: number;
  duration?: number;
}

// Utility functions
export function getAttachmentType(mimeType: string): AttachmentType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('text/')) return 'clob';
  if (mimeType === 'application/pdf') return 'document';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'document';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'document';
  return 'unknown';
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}