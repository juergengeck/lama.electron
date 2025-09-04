/**
 * Attachment type definitions following one.leute patterns
 * These types bridge between ONE platform storage and UI components
 */
/**
 * Get attachment type from MIME type
 */
export function getAttachmentType(mimeType) {
    if (mimeType.startsWith('image/'))
        return 'image';
    if (mimeType.startsWith('video/'))
        return 'video';
    if (mimeType.startsWith('audio/'))
        return 'audio';
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text'))
        return 'document';
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compress'))
        return 'archive';
    return 'unknown';
}
/**
 * Check if file type is supported for preview
 */
export function isPreviewSupported(mimeType) {
    const supported = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'video/mp4', 'video/webm', 'video/ogg',
        'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
        'application/pdf', 'text/plain', 'text/html', 'text/markdown'
    ];
    return supported.some(type => mimeType.startsWith(type));
}
/**
 * Format file size for display
 */
export function formatFileSize(bytes) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
