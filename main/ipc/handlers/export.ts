/**
 * IPC handlers for file export functionality
 */

import electron from 'electron';
const { dialog, app, Notification } = electron;
import fs from 'fs/promises';
import path from 'path';
import type { IpcMainInvokeEvent } from 'electron';

interface FileFilter {
  name: string;
  extensions: string[];
}

interface ExportFileParams {
  content: string;
  filename: string;
  filters?: FileFilter[];
}

interface ExportFileAutoParams {
  content: string;
  filename: string;
  mimeType?: string;
}

interface ExportMessageParams {
  format: string;
  content: string;
  metadata: {
    messageId?: string;
    [key: string]: any;
  };
}

interface ExportHtmlMicrodataParams {
  topicId: string;
  format: string;
  options?: ExportOptions;
}

interface ExportOptions {
  includeSignatures?: boolean;
  maxMessages?: number;
  timeout?: number;
  styleTheme?: 'light' | 'dark' | 'auto';
  dateRange?: {
    start?: string;
    end?: string;
  };
  [key: string]: any;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

interface ExportResult {
  success: boolean;
  filePath?: string;
  html?: string;
  metadata?: any;
  error?: string;
  canceled?: boolean;
}

interface Services {
  implodeWrapper: typeof import('../../services/html-export/implode-wrapper.js');
  formatter: typeof import('../../services/html-export/formatter.js');
  htmlTemplate: typeof import('../../services/html-export/html-template.js');
  startTime: number;
  timeout: number;
}

interface Message {
  hash: string;
  author: {
    name: string;
    email: string;
    personHash?: string;
  };
  timestamp: string;
  content: string;
  signature?: any;
  isOwn?: boolean;
}

/**
 * Export a file with save dialog
 */
async function exportFile(event: IpcMainInvokeEvent, { content, filename, filters }: ExportFileParams): Promise<ExportResult> {
  try {
    console.log('[Export] exportFile called:', { filename, contentLength: content.length });

    // Get the window from the event
    const win = (event.sender as any).getOwnerBrowserWindow();
    console.log('[Export] Window for dialog:', win ? 'Found' : 'Not found');

    // Show save dialog
    console.log('[Export] Showing save dialog...');
    const dialogOptions = {
      defaultPath: filename,
      filters: filters || [
        { name: 'All Files', extensions: ['*'] }
      ]
    };

    const result = win
      ? await dialog.showSaveDialog(win, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    console.log('[Export] Dialog result:', result);

    if (result.canceled) {
      console.log('[Export] User canceled save dialog');
      return { success: false, canceled: true };
    }

    // Write file
    await fs.writeFile(result.filePath!, content);
    console.log('[Export] File saved successfully:', result.filePath);

    return {
      success: true,
      filePath: result.filePath
    };
  } catch (error) {
    console.error('[Export] Error saving file:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Export file without dialog (auto-download to downloads folder)
 */
async function exportFileAuto(event: IpcMainInvokeEvent, { content, filename, mimeType }: ExportFileAutoParams): Promise<ExportResult> {
  try {
    console.log('[Export] exportFileAuto called:', { filename, mimeType, contentLength: content.length });

    // Get downloads path
    const downloadsPath = app.getPath('downloads');

    // Create unique filename if file exists
    let finalPath = path.join(downloadsPath, filename);
    let counter = 1;
    const ext = path.extname(filename);
    const nameWithoutExt = path.basename(filename, ext);

    while (await fs.access(finalPath).then(() => true).catch(() => false)) {
      finalPath = path.join(downloadsPath, `${nameWithoutExt} (${counter})${ext}`);
      counter++;
    }

    // Write file
    await fs.writeFile(finalPath, content);
    console.log('[Export] File auto-saved to:', finalPath);

    // Show notification
    new Notification({
      title: 'File Downloaded',
      body: `Saved to: ${path.basename(finalPath)}`
    }).show();

    return {
      success: true,
      filePath: finalPath
    };
  } catch (error) {
    console.error('[Export] Error auto-saving file:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Export message as various formats
 */
async function exportMessage(event: IpcMainInvokeEvent, { format, content, metadata }: ExportMessageParams): Promise<ExportResult> {
  try {
    console.log('[Export] exportMessage called:', { format, contentLength: content.length });

    let filename: string, fileContent: string, filters: FileFilter[];

    switch (format) {
      case 'markdown':
        filename = `message-${metadata.messageId || Date.now()}.md`;
        filters = [
          { name: 'Markdown Files', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] }
        ];
        fileContent = content;
        break;

      case 'html':
        filename = `message-${metadata.messageId || Date.now()}.html`;
        filters = [
          { name: 'HTML Files', extensions: ['html', 'htm'] },
          { name: 'All Files', extensions: ['*'] }
        ];
        fileContent = content;
        break;

      case 'json':
        filename = `message-${metadata.messageId || Date.now()}.json`;
        filters = [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ];
        fileContent = content;
        break;

      case 'onecore':
        filename = `message-${metadata.messageId || Date.now()}.onecore`;
        filters = [
          { name: 'ONE.core Files', extensions: ['onecore'] },
          { name: 'All Files', extensions: ['*'] }
        ];
        fileContent = content;
        break;

      default:
        filename = `message-${metadata.messageId || Date.now()}.txt`;
        filters = [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ];
        fileContent = content;
    }

    return exportFile(event, { content: fileContent, filename, filters });
  } catch (error) {
    console.error('[Export] Error exporting message:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Export conversation as HTML with microdata markup
 * Uses ONE.core's implode() function to embed referenced objects
 */
async function exportHtmlWithMicrodata(event: IpcMainInvokeEvent, { topicId, format, options = {} }: ExportHtmlMicrodataParams): Promise<ExportResult> {
  try {
    console.log('[Export] exportHtmlWithMicrodata called:', { topicId, format, options });

    // Validate input parameters
    const validationResult = validateExportRequest({ topicId, format, options });
    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.error
      };
    }

    // Import services
    const implodeWrapper = await import('../../services/html-export/implode-wrapper.js');
    const formatter = await import('../../services/html-export/formatter.js');
    const htmlTemplate = await import('../../services/html-export/html-template.js');

    // Set timeout for large exports
    const timeout = options.timeout || 30000; // 30 seconds
    const startTime = Date.now();

    const exportPromise = performExport(topicId, options, {
      implodeWrapper,
      formatter,
      htmlTemplate,
      startTime,
      timeout
    });

    const result = await Promise.race([
      exportPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Export timeout after 30 seconds')), timeout)
      )
    ]);

    return result;

  } catch (error) {
    console.error('[Export] Error exporting HTML with microdata:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Validate export request parameters
 */
function validateExportRequest({ topicId, format, options = {} }: { topicId: string; format: string; options?: ExportOptions }): ValidationResult {
  // Validate topicId
  if (!topicId || typeof topicId !== 'string' || topicId.trim() === '') {
    return { valid: false, error: 'topicId is required and must be a non-empty string' };
  }

  // Validate format
  if (!format || format !== 'html-microdata') {
    return { valid: false, error: 'format must be "html-microdata"' };
  }

  // Validate options
  if (options.maxMessages && (typeof options.maxMessages !== 'number' || options.maxMessages <= 0)) {
    return { valid: false, error: 'maxMessages must be a positive number' };
  }

  if (options.maxMessages && options.maxMessages > 10000) {
    return { valid: false, error: 'maxMessages cannot exceed 10,000' };
  }

  if (options.styleTheme && !['light', 'dark', 'auto'].includes(options.styleTheme)) {
    return { valid: false, error: 'styleTheme must be "light", "dark", or "auto"' };
  }

  if (options.dateRange) {
    const { start, end } = options.dateRange;
    if (start && end && new Date(start) >= new Date(end)) {
      return { valid: false, error: 'date range start must be before end' };
    }
  }

  return { valid: true };
}

/**
 * Perform the actual export process
 */
async function performExport(topicId: string, options: ExportOptions, services: Services): Promise<ExportResult> {
  const { implodeWrapper, formatter, htmlTemplate, startTime, timeout } = services;

  try {
    // Step 1: Retrieve messages from TopicRoom
    console.log('[Export] Retrieving messages for topic:', topicId);
    const messages = await getMessagesFromTopic(topicId, options);

    if (messages.length === 0) {
      console.log('[Export] No messages found for topic');
      return {
        success: true,
        html: generateEmptyConversationHTML(topicId, options),
        metadata: {
          messageCount: 0,
          exportDate: new Date().toISOString(),
          topicId,
          fileSize: 0
        }
      };
    }

    console.log(`[Export] Found ${messages.length} messages`);

    // Step 2: Process messages with implode()
    console.log('[Export] Processing messages with implode()...');
    const processedMessages = await processMessagesWithImplode(messages, options, implodeWrapper, formatter);

    // Check timeout
    if (Date.now() - startTime > timeout - 5000) {
      throw new Error('Export approaching timeout limit');
    }

    // Step 3: Generate HTML with formatting
    console.log('[Export] Generating HTML document...');
    const metadata = await generateMetadata(topicId, messages, options);
    const htmlDocument = htmlTemplate.default.generateCompleteHTML({
      metadata,
      messages: processedMessages,
      options: {
        theme: options.styleTheme
      }
    });

    const fileSize = Buffer.byteLength(htmlDocument, 'utf8');

    console.log(`[Export] Export completed successfully. File size: ${fileSize} bytes`);

    return {
      success: true,
      html: htmlDocument,
      metadata: {
        ...metadata,
        fileSize,
        exportDate: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('[Export] Error in performExport:', error);
    throw error;
  }
}

/**
 * Get messages from TopicRoom (placeholder - needs actual implementation)
 */
async function getMessagesFromTopic(topicId: string, options: ExportOptions): Promise<Message[]> {
  // This is a placeholder - in real implementation, this would:
  // 1. Use TopicRoom.retrieveAllMessages(topicId)
  // 2. Apply date range filtering
  // 3. Apply maxMessages limit
  // 4. Sort by timestamp

  console.log('[Export] TODO: Implement actual message retrieval from TopicRoom');

  // For now, return mock data structure
  return [
    {
      hash: 'abc123def456789012345678901234567890123456789012345678901234567890',
      author: { name: 'Test User', email: 'test@example.com' },
      timestamp: new Date().toISOString(),
      content: 'Sample message content'
    }
  ];
}

/**
 * Process messages using implode wrapper
 */
async function processMessagesWithImplode(messages: Message[], options: ExportOptions, implodeWrapper: any, formatter: any): Promise<string[]> {
  const processedMessages: string[] = [];

  for (const message of messages) {
    try {
      // Get imploded microdata for the message
      const implodedData = await implodeWrapper.wrapMessageWithMicrodata(message.hash);

      // Add signature if available and requested
      let finalData = implodedData;
      if (options.includeSignatures !== false && message.signature) {
        finalData = implodeWrapper.addSignature(finalData, message.signature);
      }

      // Add timestamp
      if (message.timestamp) {
        finalData = implodeWrapper.addTimestamp(finalData, message.timestamp);
      }

      // Format for display
      const formattedMessage = formatter.default.formatMessage(finalData, {
        isOwn: message.isOwn || false
      });

      processedMessages.push(formattedMessage);

    } catch (error) {
      console.error(`[Export] Error processing message ${message.hash}:`, error);
      // Continue with other messages rather than failing entire export
      processedMessages.push(`<div class="message error">Error processing message: ${(error as Error).message}</div>`);
    }
  }

  return processedMessages;
}

/**
 * Generate metadata for the conversation
 */
async function generateMetadata(topicId: string, messages: Message[], options: ExportOptions): Promise<any> {
  // Extract unique participants
  const participants: any[] = [];
  const seenEmails = new Set<string>();

  messages.forEach(message => {
    if (message.author && message.author.email && !seenEmails.has(message.author.email)) {
      participants.push({
        name: message.author.name,
        email: message.author.email,
        personHash: message.author.personHash
      });
      seenEmails.add(message.author.email);
    }
  });

  // Calculate date range
  const timestamps: any[] = messages.map(m => new Date(m.timestamp)).filter(d => !isNaN(d.getTime()));
  const dateRange = timestamps.length > 0 ? {
    start: new Date(Math.min(...timestamps.map(d => d.getTime()))).toISOString(),
    end: new Date(Math.max(...timestamps.map(d => d.getTime()))).toISOString()
  } : null;

  return {
    title: `Conversation ${topicId}`,
    topicId,
    messageCount: messages.length,
    participants,
    dateRange,
    exportDate: new Date().toISOString()
  };
}

/**
 * Generate HTML for empty conversation
 */
function generateEmptyConversationHTML(topicId: string, options: ExportOptions): string {
  const { styleTheme = 'light' } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Empty Conversation</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 50px; }
    .empty-message { color: #666; font-size: 1.2em; }
  </style>
</head>
<body>
  <div class="empty-message">
    <h1>Empty Conversation</h1>
    <p>No messages found for topic: ${topicId}</p>
  </div>
</body>
</html>`;
}

export default {
  exportFile,
  exportFileAuto,
  exportMessage,
  exportHtmlWithMicrodata
};