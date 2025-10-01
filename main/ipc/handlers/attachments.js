/**
 * Attachment IPC Handlers
 */
import attachmentService from '../../services/attachment-service.js';
const attachmentHandlers = {
    /**
     * Store an attachment
     */
    async storeAttachment(event, { data, metadata }) {
        console.log('[AttachmentHandler] Store attachment:', metadata.name);
        try {
            // TODO: Proper IoM setup instead of auth check
            // For now, allow attachment storage without auth
            // Convert base64 or array to Buffer
            let buffer;
            if (typeof data === 'string') {
                // Base64 encoded
                buffer = Buffer.from(data, 'base64');
            }
            else if (data instanceof Array) {
                // Array of bytes
                buffer = Buffer.from(data);
            }
            else {
                // Already a buffer or arraybuffer
                buffer = Buffer.from(data);
            }
            // Store in ONE.core - pass mimeType as type for consistency
            const result = await attachmentService.storeAttachment(buffer, {
                name: metadata.name,
                type: metadata.mimeType || metadata.type,
                size: metadata.size
            });
            return {
                success: true,
                data: result
            };
        }
        catch (error) {
            console.error('[AttachmentHandler] Error storing attachment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    /**
     * Get an attachment by hash
     */
    async getAttachment(event, { hash }) {
        console.log('[AttachmentHandler] Get attachment:', hash);
        try {
            // TODO: Proper IoM setup instead of auth check
            // For now, allow attachment retrieval without auth
            // Get from ONE.core
            const attachment = await attachmentService.getAttachment(hash);
            // Convert buffer to base64 for IPC transfer
            const base64Data = attachment.data.toString('base64');
            return {
                success: true,
                data: {
                    data: base64Data,
                    metadata: attachment.metadata
                }
            };
        }
        catch (error) {
            console.error('[AttachmentHandler] Error getting attachment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    /**
     * Get attachment metadata only
     */
    async getAttachmentMetadata(event, { hash }) {
        console.log('[AttachmentHandler] Get attachment metadata:', hash);
        try {
            const metadata = attachmentService.getAttachmentMetadata(hash);
            return {
                success: true,
                data: metadata
            };
        }
        catch (error) {
            console.error('[AttachmentHandler] Error getting metadata:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    /**
     * Store multiple attachments
     */
    async storeAttachments(event, { attachments }) {
        console.log('[AttachmentHandler] Store multiple attachments:', attachments.length);
        try {
            // TODO: Proper IoM setup instead of auth check
            // For now, allow bulk attachment storage without auth
            const results = [];
            for (const attachment of attachments) {
                try {
                    // Convert data
                    let buffer;
                    if (typeof attachment.data === 'string') {
                        buffer = Buffer.from(attachment.data, 'base64');
                    }
                    else {
                        buffer = Buffer.from(attachment.data);
                    }
                    // Store
                    const result = await attachmentService.storeAttachment(buffer, attachment.metadata);
                    results.push(result);
                }
                catch (error) {
                    console.error(`[AttachmentHandler] Failed to store ${attachment.metadata.name}:`, error);
                    results.push({
                        error: error.message,
                        name: attachment.metadata.name
                    });
                }
            }
            return {
                success: true,
                data: results
            };
        }
        catch (error) {
            console.error('[AttachmentHandler] Error storing attachments:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};
export default attachmentHandlers;
