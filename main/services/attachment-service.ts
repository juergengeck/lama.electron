/**
 * Attachment Service - Node.js side
 * Manages file attachments using ONE.core BLOB storage
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AttachmentService {
  public attachments: any;
  public tempDir: any;

  constructor() {

    this.attachments = new Map() // hash -> metadata
    this.tempDir = path.join(process.cwd(), 'temp-attachments')
}

  async initialize(): Promise<any> {
    // Create temp directory for processing files
    await fs.mkdir(this.tempDir, { recursive: true })
    console.log('[AttachmentService] Initialized with temp dir:', this.tempDir)
  }

  /**
   * Store an attachment as a BLOB in ONE.core
   * @param {Buffer} data - File data
   * @param {Object} metadata - File metadata (name, type, size)
   * @returns {Object} Attachment info with hash
   */
  async storeAttachment(data: any, metadata: any): Promise<any> {
    try {
      // Load Node.js platform first
      await import('@refinio/one.core/lib/system/load-nodejs.js')
      
      // Import ONE.core functions
      const { storeArrayBufferAsBlob } = await import('@refinio/one.core/lib/storage-blob.js')
      
      // Convert Buffer to ArrayBuffer
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      
      // Store as BLOB in ONE.core
      const result = await storeArrayBufferAsBlob(arrayBuffer)
      const hash = result.hash
      
      // Store metadata
      this.attachments.set(hash, {
        name: metadata.name,
        type: metadata.type,
        size: metadata.size || data.length,
        storedAt: new Date().toISOString()
      })
      
      console.log(`[AttachmentService] Stored attachment ${metadata.name} as ${hash}`)
      
      return {
        hash,
        name: metadata.name,
        type: metadata.type,
        size: metadata.size || data.length
      }
    } catch (error) {
      console.error('[AttachmentService] Failed to store attachment:', error)
      throw error
    }
  }

  /**
   * Retrieve an attachment by hash
   * @param {string} hash - Attachment hash
   * @returns {Object} Attachment data and metadata
   */
  async getAttachment(hash: any): Promise<any> {
    try {
      // Load Node.js platform first
      await import('@refinio/one.core/lib/system/load-nodejs.js')
      
      // Import ONE.core functions
      const { readBlobAsArrayBuffer } = await import('@refinio/one.core/lib/storage-blob.js')
      
      // Get metadata
      const metadata = this.attachments.get(hash)
      if (!metadata) {
        console.warn(`[AttachmentService] No metadata for hash ${hash}, using defaults`)
      }

      // Read BLOB data from ONE.core
      const arrayBuffer = await readBlobAsArrayBuffer(hash)
      const buffer = Buffer.from(arrayBuffer)
      
      return {
        data: buffer,
        metadata: metadata || {
          name: 'attachment',
          type: 'application/octet-stream',
          size: buffer.length
        }
      }
    } catch (error) {
      console.error(`[AttachmentService] Failed to get attachment ${hash}:`, error)
      throw error
    }
  }

  /**
   * Get attachment metadata without loading data
   * @param {string} hash - Attachment hash
   * @returns {Object} Attachment metadata
   */
  getAttachmentMetadata(hash: any): any {
    return this.attachments.get(hash)
  }

  /**
   * Save uploaded file temporarily
   * @param {string} filename - Original filename
   * @param {Buffer} data - File data
   * @returns {string} Temp file path
   */
  async saveTempFile(filename: any, data: any): Promise<any> {
    const tempPath = path.join(this.tempDir, `${Date.now()}-${filename}`)
    await fs.writeFile(tempPath, data)
    return tempPath
  }

  /**
   * Clean up temp files older than 1 hour
   */
  async cleanupTempFiles(): Promise<any> {
    try {
      const files = await fs.readdir(this.tempDir)
      const now = Date.now()

      for (const file of files) {
        const filePath = path.join(this.tempDir, file)
        const stats = await fs.stat(filePath)

        // Delete files older than 1 hour
        if (now - stats.mtimeMs > 3600000) {
          await fs.unlink(filePath)
          console.log(`[AttachmentService] Cleaned up temp file: ${file}`)
        }
      }
    } catch (error) {
      console.error('[AttachmentService] Cleanup error:', error)
    }
  }

  /**
   * Store XML message as attachment (BLOB for >1KB, inline for ≤1KB)
   * @param {string} topicId - Topic ID
   * @param {string} messageId - Message ID
   * @param {string} xmlString - XML content
   * @param {string} format - 'llm-query' | 'llm-response'
   * @returns {Promise<string>} Attachment hash (SHA256IdHash)
   */
  async storeXMLAttachment(
    topicId: string,
    messageId: string,
    xmlString: string,
    format: 'llm-query' | 'llm-response'
  ): Promise<any> {
    try {
      // Load Node.js platform first
      await import('@refinio/one.core/lib/system/load-nodejs.js')

      // Import ONE.core functions
      const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
      const { storeArrayBufferAsBlob } = await import('@refinio/one.core/lib/storage-blob.js')

      const size = Buffer.byteLength(xmlString, 'utf8')

      if (size <= 1024) {
        // Inline storage for small XML
        const attachment = {
          $type$: 'XMLMessageAttachment' as const,
          topicId,
          messageId,
          xmlContent: xmlString,
          format,
          version: 1,
          createdAt: Date.now(),
          size
        }

        const result = await storeVersionedObject(attachment)
        return result.hash
      } else {
        // BLOB storage for large XML
        const buffer = Buffer.from(xmlString, 'utf8')
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        const blobResult = await storeArrayBufferAsBlob(arrayBuffer)

        const attachment = {
          $type$: 'XMLMessageAttachment' as const,
          topicId,
          messageId,
          xmlBlob: blobResult.hash,
          format,
          version: 1,
          createdAt: Date.now(),
          size
        }

        const result = await storeVersionedObject(attachment)
        return result.hash
      }
    } catch (error) {
      console.error('[AttachmentService] Failed to store XML attachment:', error)
      throw error
    }
  }

  /**
   * Retrieve XML attachment content
   * @param {string} attachmentHash - Attachment hash
   * @returns {Promise<string>} XML content
   */
  async retrieveXMLAttachment(attachmentHash: string): Promise<string> {
    try {
      // Load Node.js platform first
      await import('@refinio/one.core/lib/system/load-nodejs.js')

      // Import ONE.core functions
      const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js')
      const { readBlobAsArrayBuffer } = await import('@refinio/one.core/lib/storage-blob.js')

      const attachment = await getObject(attachmentHash as any) as any

      if (attachment.xmlContent) {
        // Inline storage
        return attachment.xmlContent
      } else if (attachment.xmlBlob) {
        // BLOB storage
        const arrayBuffer = await readBlobAsArrayBuffer(attachment.xmlBlob)
        const buffer = Buffer.from(arrayBuffer)
        return buffer.toString('utf8')
      } else {
        throw new Error('XMLMessageAttachment has no content (neither xmlContent nor xmlBlob)')
      }
    } catch (error) {
      console.error(`[AttachmentService] Failed to retrieve XML attachment ${attachmentHash}:`, error)
      throw error
    }
  }
}

export default new AttachmentService()