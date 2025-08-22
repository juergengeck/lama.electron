/**
 * Attachment Service - Node.js side
 * Manages file attachments using ONE.core BLOB storage
 */

const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')

class AttachmentService {
  constructor() {
    this.attachments = new Map() // hash -> metadata
    this.tempDir = path.join(process.cwd(), 'temp-attachments')
  }

  async initialize() {
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
  async storeAttachment(data, metadata) {
    try {
      const nodeProvisioning = require('../hybrid/node-provisioning')
      
      if (!nodeProvisioning.isProvisioned()) {
        throw new Error('Node not provisioned - cannot store attachments')
      }

      // Import ONE.core functions dynamically
      const { storeArrayBufferAsBlob } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/storage-blob.js')
      
      // Convert Buffer to ArrayBuffer
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      
      // Store as BLOB
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
  async getAttachment(hash) {
    try {
      const nodeProvisioning = require('../hybrid/node-provisioning')
      
      if (!nodeProvisioning.isProvisioned()) {
        throw new Error('Node not provisioned - cannot retrieve attachments')
      }

      // Get metadata
      const metadata = this.attachments.get(hash)
      if (!metadata) {
        console.warn(`[AttachmentService] No metadata for hash ${hash}, using defaults`)
      }

      // Import ONE.core functions dynamically
      const { readBlobAsArrayBuffer } = await import('../../electron-ui/node_modules/@refinio/one.core/lib/storage-blob.js')
      
      // Read BLOB data
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
  getAttachmentMetadata(hash) {
    return this.attachments.get(hash)
  }

  /**
   * Save uploaded file temporarily
   * @param {string} filename - Original filename
   * @param {Buffer} data - File data
   * @returns {string} Temp file path
   */
  async saveTempFile(filename, data) {
    const tempPath = path.join(this.tempDir, `${Date.now()}-${filename}`)
    await fs.writeFile(tempPath, data)
    return tempPath
  }

  /**
   * Clean up temp files older than 1 hour
   */
  async cleanupTempFiles() {
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
}

module.exports = new AttachmentService()