/**
 * Export IPC Handlers (Thin Adapter)
 *
 * Maps Electron IPC calls to ExportHandler methods.
 * Business logic lives in ../../../lama.core/handlers/ExportHandler.ts
 * Platform-specific operations (dialog, fs, notifications) handled here.
 */

import electron from 'electron';
const { dialog, app, Notification } = electron;
import fs from 'fs/promises';
import path from 'path';
import type { IpcMainInvokeEvent } from 'electron';
import { ExportHandler } from '@chat/core/handlers/ExportHandler.js';

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

// Singleton handler instance
let exportHandler: ExportHandler | null = null;

/**
 * Get handler instance (creates on first use with services)
 */
async function getHandler(): Promise<ExportHandler> {
  if (!exportHandler) {
    // Import services
    const implodeWrapper = await import('../../services/html-export/implode-wrapper.js');
    const formatter = await import('../../services/html-export/formatter.js');
    const htmlTemplate = await import('../../services/html-export/html-template.js');

    exportHandler = new ExportHandler(
      implodeWrapper,
      formatter.default,
      htmlTemplate.default
    );
  }
  return exportHandler;
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

    // Get handler and prepare export data
    const handler = await getHandler();
    const result = await handler.exportMessage({ format, content, metadata });

    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    // Use platform-specific file dialog
    return exportFile(event, {
      content: result.fileContent,
      filename: result.filename,
      filters: result.filters
    });
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

    // Delegate to handler for export logic
    const handler = await getHandler();
    const result = await handler.exportHtmlWithMicrodata({ topicId, format, options });

    return result;
  } catch (error) {
    console.error('[Export] Error exporting HTML with microdata:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

export default {
  exportFile,
  exportFileAuto,
  exportMessage,
  exportHtmlWithMicrodata
};