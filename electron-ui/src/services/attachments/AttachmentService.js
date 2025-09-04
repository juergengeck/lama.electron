/**
 * AttachmentService - Core service for handling attachments with ONE platform integration
 *
 * This service manages the storage, retrieval, and caching of attachments
 * using the ONE platform's BLOB storage system.
 */
import { storeArrayBufferAsBlob, readBlobAsArrayBuffer } from '@refinio/one.core/lib/storage-blob.js';
import { formatFileSize } from '@/types/attachments';
import { metadataExtractor } from '@/services/metadata/MetadataExtractor';
/**
 * Maximum cache size (100MB)
 */
const MAX_CACHE_SIZE = 100 * 1024 * 1024;
/**
 * Cache entry TTL (1 hour)
 */
const CACHE_TTL = 60 * 60 * 1000;
/**
 * AttachmentService implementation
 */
export class AttachmentService {
    constructor() {
        Object.defineProperty(this, "cache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "cacheSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!AttachmentService.instance) {
            AttachmentService.instance = new AttachmentService();
        }
        return AttachmentService.instance;
    }
    /**
     * Store a file as BlobDescriptor in ONE platform with metadata extraction
     */
    async storeAttachment(file, options) {
        try {
            console.log(`[AttachmentService] Storing attachment: ${file.name} (${formatFileSize(file.size)})`);
            // Extract metadata first
            const metadata = await metadataExtractor.extractMetadata(file);
            console.log(`[AttachmentService] Extracted metadata with ${metadata.subjects.length} subjects:`, metadata.subjects);
            // Report initial progress
            options?.onProgress?.(10);
            // Read file as ArrayBuffer
            const arrayBuffer = await this.fileToArrayBuffer(file);
            options?.onProgress?.(30);
            // Create BlobDescriptor
            const descriptor = {
                data: arrayBuffer,
                type: file.type || 'application/octet-stream',
                name: file.name,
                size: file.size,
                lastModified: file.lastModified || Date.now()
            };
            // Generate thumbnail if requested and applicable
            let thumbnailHash;
            if (options?.generateThumbnail && file.type.startsWith('image/')) {
                try {
                    thumbnailHash = await this.generateThumbnail(file, options.thumbnailSize);
                    console.log(`[AttachmentService] Generated thumbnail: ${thumbnailHash}`);
                }
                catch (error) {
                    console.warn('[AttachmentService] Failed to generate thumbnail:', error);
                }
            }
            options?.onProgress?.(50);
            // Store blob in Node.js ONE.core instance via IPC, fallback to browser
            let hash;
            if (window.electronAPI) {
                try {
                    // Convert to base64 for IPC transfer
                    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                    const result = await window.electronAPI.invoke('attachment:store', {
                        data: base64Data,
                        metadata: {
                            name: file.name,
                            type: file.type,
                            size: file.size
                        }
                    });
                    if (result.success) {
                        hash = result.data.hash;
                        console.log(`[AttachmentService] Stored blob in Node.js with hash: ${hash}`);
                    }
                    else {
                        console.warn(`[AttachmentService] Node storage failed (${result.error}), using browser fallback`);
                        // Fallback to browser storage
                        const result = await storeArrayBufferAsBlob(arrayBuffer);
                        hash = result.hash;
                        console.log(`[AttachmentService] Stored blob locally with hash: ${hash}, status: ${result.status}`);
                    }
                }
                catch (error) {
                    console.warn(`[AttachmentService] IPC failed (${error.message}), using browser fallback`);
                    // Fallback to browser storage
                    const result = await storeArrayBufferAsBlob(arrayBuffer);
                    hash = result.hash;
                    console.log(`[AttachmentService] Stored blob locally with hash: ${hash}, status: ${result.status}`);
                }
            }
            else {
                // Fallback to browser storage for development
                const result = await storeArrayBufferAsBlob(arrayBuffer);
                hash = result.hash;
                console.log(`[AttachmentService] Stored blob locally with hash: ${hash}, status: ${result.status}`);
            }
            options?.onProgress?.(80);
            // Cache the descriptor
            this.cacheAttachment(hash, descriptor);
            // Extract subjects if requested
            if (options?.extractSubjects) {
                try {
                    const subjects = await this.extractSubjects(file);
                    console.log(`[AttachmentService] Extracted subjects:`, subjects);
                }
                catch (error) {
                    console.warn('[AttachmentService] Failed to extract subjects:', error);
                }
            }
            options?.onProgress?.(100);
            return hash;
        }
        catch (error) {
            console.error('[AttachmentService] Failed to store attachment:', error);
            throw new Error(`Failed to store attachment: ${error.message}`);
        }
    }
    /**
     * Retrieve BlobDescriptor by hash
     * @param hash - The attachment hash
     * @param metadata - Optional metadata to use if not cached
     */
    async getAttachment(hash, metadata) {
        try {
            // Check cache first
            const cached = this.getCachedAttachment(hash);
            if (cached) {
                console.log(`[AttachmentService] Retrieved from cache: ${hash}`);
                return cached;
            }
            console.log(`[AttachmentService] Loading from storage: ${hash}`);
            let descriptor;
            if (window.electronAPI) {
                // Load from Node.js backend
                const result = await window.electronAPI.invoke('attachment:get', { hash });
                if (!result.success) {
                    throw new Error(result.error || 'Failed to get attachment');
                }
                // Convert base64 back to ArrayBuffer
                const base64Data = result.data.data;
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                descriptor = {
                    data: bytes.buffer,
                    type: result.data.metadata?.type || metadata?.type || 'application/octet-stream',
                    name: result.data.metadata?.name || metadata?.name || 'attachment',
                    size: result.data.metadata?.size || bytes.length,
                    lastModified: Date.now()
                };
            }
            else {
                // Fallback to browser storage
                const data = await readBlobAsArrayBuffer(hash);
                descriptor = {
                    data,
                    type: metadata?.type || 'application/octet-stream',
                    name: metadata?.name || 'attachment',
                    size: data.byteLength,
                    lastModified: Date.now()
                };
            }
            // Cache for future use
            this.cacheAttachment(hash, descriptor);
            return descriptor;
        }
        catch (error) {
            console.error(`[AttachmentService] Failed to get attachment ${hash}:`, error);
            throw new Error(`Failed to retrieve attachment: ${error.message}`);
        }
    }
    /**
     * Check if attachment exists
     */
    async hasAttachment(hash) {
        try {
            if (this.cache.has(hash)) {
                return true;
            }
            // Try to read from storage
            await readBlobAsArrayBuffer(hash);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Delete attachment from storage
     */
    async deleteAttachment(hash) {
        // Remove from cache
        const entry = this.cache.get(hash);
        if (entry) {
            this.cacheSize -= entry.descriptor.size;
            this.cache.delete(hash);
        }
        // Note: ONE platform doesn't provide direct blob deletion
        // Blobs are garbage collected when no longer referenced
        console.log(`[AttachmentService] Removed attachment from cache: ${hash}`);
    }
    /**
     * Get cached attachment if available
     */
    getCachedAttachment(hash) {
        const entry = this.cache.get(hash);
        if (!entry)
            return undefined;
        // Check if expired
        if (Date.now() - entry.cachedAt > CACHE_TTL) {
            this.cacheSize -= entry.descriptor.size;
            this.cache.delete(hash);
            return undefined;
        }
        // Update access time and count
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        return entry.descriptor;
    }
    /**
     * Cache an attachment
     */
    cacheAttachment(hash, descriptor) {
        // Check cache size limit
        if (this.cacheSize + descriptor.size > MAX_CACHE_SIZE) {
            this.evictLRU(descriptor.size);
        }
        const entry = {
            descriptor,
            cachedAt: Date.now(),
            lastAccessed: Date.now(),
            accessCount: 1
        };
        this.cache.set(hash, entry);
        this.cacheSize += descriptor.size;
        console.log(`[AttachmentService] Cached attachment: ${hash} (cache size: ${formatFileSize(this.cacheSize)})`);
    }
    /**
     * Evict least recently used entries
     */
    evictLRU(requiredSpace) {
        const entries = Array.from(this.cache.entries())
            .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        let freedSpace = 0;
        for (const [hash, entry] of entries) {
            if (freedSpace >= requiredSpace)
                break;
            freedSpace += entry.descriptor.size;
            this.cacheSize -= entry.descriptor.size;
            this.cache.delete(hash);
            console.log(`[AttachmentService] Evicted from cache: ${hash}`);
        }
    }
    /**
     * Generate thumbnail for image/video
     */
    async generateThumbnail(file, maxSize = 200) {
        if (!file.type.startsWith('image/')) {
            throw new Error('Thumbnail generation only supported for images');
        }
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = async () => {
                    try {
                        // Calculate thumbnail dimensions
                        let width = img.width;
                        let height = img.height;
                        if (width > height) {
                            if (width > maxSize) {
                                height = (height * maxSize) / width;
                                width = maxSize;
                            }
                        }
                        else {
                            if (height > maxSize) {
                                width = (width * maxSize) / height;
                                height = maxSize;
                            }
                        }
                        // Create canvas and draw resized image
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx)
                            throw new Error('Failed to get canvas context');
                        ctx.drawImage(img, 0, 0, width, height);
                        // Convert to blob
                        canvas.toBlob(async (blob) => {
                            if (!blob) {
                                reject(new Error('Failed to create thumbnail blob'));
                                return;
                            }
                            // Store thumbnail as separate blob
                            const arrayBuffer = await blob.arrayBuffer();
                            const result = await storeArrayBufferAsBlob(arrayBuffer);
                            const hash = result.hash;
                            // Cache thumbnail
                            const descriptor = {
                                data: arrayBuffer,
                                type: blob.type,
                                name: `thumb_${file.name}`,
                                size: blob.size,
                                lastModified: Date.now()
                            };
                            this.cacheAttachment(hash, descriptor);
                            resolve(hash);
                        }, 'image/jpeg', 0.8);
                    }
                    catch (error) {
                        reject(error);
                    }
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target?.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }
    /**
     * Extract subject hashtags from file using metadata
     */
    async extractSubjects(file) {
        // Use metadata extractor for rich subject generation
        const metadata = await metadataExtractor.extractMetadata(file);
        return metadata.subjects;
    }
    /**
     * Get file metadata (for display purposes)
     */
    async getFileMetadata(file) {
        return await metadataExtractor.extractMetadata(file);
    }
    /**
     * Convert File to ArrayBuffer
     */
    fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }
    /**
     * Create MessageAttachment reference from stored attachment
     */
    createMessageAttachment(hash, descriptor, thumbnailHash) {
        return {
            hash,
            type: 'blob',
            mimeType: descriptor.type,
            name: descriptor.name,
            size: descriptor.size,
            thumbnailHash
        };
    }
}
// Export singleton instance
export const attachmentService = AttachmentService.getInstance();
