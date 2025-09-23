/**
 * AttachmentService - Browser proxy that uses IPC to handle attachments in Node.js
 */

import type { MessageAttachment } from '@/types/attachments'

class AttachmentService {
  /**
   * Store an attachment
   */
  async storeAttachment(
    data: ArrayBuffer | Uint8Array | string,
    metadata: {
      name: string
      mimeType: string
      size?: number
    }
  ): Promise<MessageAttachment> {
    // Convert data to base64 for IPC transfer
    let base64Data: string
    if (typeof data === 'string') {
      base64Data = data
    } else {
      // Convert ArrayBuffer or Uint8Array to base64
      // Use a more efficient method for large buffers
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data
      let binary = ''
      const chunkSize = 32768 // Process in chunks to avoid stack overflow
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
        binary += String.fromCharCode.apply(null, Array.from(chunk))
      }
      base64Data = btoa(binary)
    }
    
    const result = await window.electronAPI.invoke('attachment:store', {
      data: base64Data,
      metadata
    })
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to store attachment')
    }
    
    return result.data
  }
  
  /**
   * Get an attachment by hash
   */
  async getAttachment(hash: string): Promise<{
    data: ArrayBuffer
    metadata: {
      name: string
      mimeType: string
      size: number
    }
  }> {
    const result = await window.electronAPI.invoke('attachment:get', { hash })
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get attachment')
    }
    
    // Convert base64 back to ArrayBuffer
    const base64 = result.data.data
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    return {
      data: bytes.buffer,
      metadata: result.data.metadata
    }
  }
  
  /**
   * Get attachment metadata only
   */
  async getAttachmentMetadata(hash: string): Promise<{
    name: string
    mimeType: string
    size: number
  }> {
    const result = await window.electronAPI.invoke('attachment:getMetadata', { hash })
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get metadata')
    }
    
    return result.data
  }
  
  /**
   * Store multiple attachments
   */
  async storeMultiple(
    attachments: Array<{
      data: ArrayBuffer | Uint8Array | string
      metadata: {
        name: string
        mimeType: string
        size?: number
      }
    }>
  ): Promise<MessageAttachment[]> {
    // Convert all data to base64
    const prepared = attachments.map(att => {
      let base64Data: string
      if (typeof att.data === 'string') {
        base64Data = att.data
      } else {
        // Convert ArrayBuffer or Uint8Array to base64
        const bytes = att.data instanceof ArrayBuffer ? new Uint8Array(att.data) : att.data
        let binary = ''
        const chunkSize = 32768 // Process in chunks to avoid stack overflow
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
          binary += String.fromCharCode.apply(null, Array.from(chunk))
        }
        base64Data = btoa(binary)
      }
      
      return {
        data: base64Data,
        metadata: att.metadata
      }
    })
    
    const result = await window.electronAPI.invoke('attachment:storeMultiple', {
      attachments: prepared
    })
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to store attachments')
    }
    
    return result.data
  }
  
  /**
   * Process file for attachment
   */
  async processFile(file: File): Promise<MessageAttachment> {
    const buffer = await file.arrayBuffer()
    
    return this.storeAttachment(buffer, {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size
    })
  }
  
  /**
   * Process multiple files
   */
  async processFiles(files: File[]): Promise<MessageAttachment[]> {
    const attachments = await Promise.all(
      files.map(async file => ({
        data: await file.arrayBuffer(),
        metadata: {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size
        }
      }))
    )
    
    return this.storeMultiple(attachments)
  }
  
  /**
   * Create data URL for attachment
   */
  async getDataUrl(hash: string): Promise<string> {
    const { data, metadata } = await this.getAttachment(hash)
    const bytes = new Uint8Array(data)

    // Convert to base64 in chunks to avoid stack overflow
    let binary = ''
    const chunkSize = 32768
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    const base64 = btoa(binary)

    return `data:${metadata.mimeType};base64,${base64}`
  }
}

// Export singleton instance
export const attachmentService = new AttachmentService()