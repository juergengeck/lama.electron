/**
 * Metadata Extractor for attachments
 * Based on one.leute patterns
 */

interface FileMetadata {
  width?: number;
  height?: number;
  duration?: number;
  mimeType?: string;
  size?: number;
  subjects?: string[];
}

class MetadataExtractorService {
  async extractMetadata(data: ArrayBuffer, filename?: string): Promise<FileMetadata> {
    const metadata: FileMetadata = {
      size: data.byteLength
    };

    // Basic MIME type detection from filename
    if (filename) {
      const ext = filename.toLowerCase().split('.').pop();
      switch (ext) {
        case 'jpg':
        case 'jpeg':
          metadata.mimeType = 'image/jpeg';
          break;
        case 'png':
          metadata.mimeType = 'image/png';
          break;
        case 'gif':
          metadata.mimeType = 'image/gif';
          break;
        case 'mp4':
          metadata.mimeType = 'video/mp4';
          break;
        case 'webm':
          metadata.mimeType = 'video/webm';
          break;
        case 'mp3':
          metadata.mimeType = 'audio/mpeg';
          break;
        case 'wav':
          metadata.mimeType = 'audio/wav';
          break;
        case 'pdf':
          metadata.mimeType = 'application/pdf';
          break;
        default:
          metadata.mimeType = 'application/octet-stream';
      }
    }

    // TODO: Add proper image/video metadata extraction
    // For now, return basic metadata
    return metadata;
  }
}

export const metadataExtractor = new MetadataExtractorService();
export type { FileMetadata };