/**
 * Electron LLM Platform Implementation
 *
 * Implements LLMPlatform interface for Electron using BrowserWindow for UI events.
 * This adapter bridges lama.core's platform-agnostic LLM operations with Electron's
 * IPC system.
 */

import type { BrowserWindow } from 'electron';
import type { LLMPlatform } from '@lama/core/services/llm-platform.js';

export class ElectronLLMPlatform implements LLMPlatform {
  constructor(private mainWindow: BrowserWindow) {}

  /**
   * Emit progress update via Electron IPC
   * Maps to 'message:thinking' event for UI
   */
  emitProgress(topicId: string, progress: number): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    this.mainWindow.webContents.send('message:thinking', {
      conversationId: topicId,
      progress,
    });
  }

  /**
   * Emit error via Electron IPC
   * Maps to 'ai:error' event for UI
   */
  emitError(topicId: string, error: Error): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    this.mainWindow.webContents.send('ai:error', {
      conversationId: topicId,
      error: error.message,
    });
  }

  /**
   * Emit message update via Electron IPC
   * Maps to 'message:stream' (streaming) or 'message:updated' (complete) events
   */
  emitMessageUpdate(
    topicId: string,
    messageId: string,
    text: string,
    status: string
  ): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    if (status === 'streaming') {
      this.mainWindow.webContents.send('message:stream', {
        conversationId: topicId,
        messageId,
        chunk: text,
        partial: text,
      });
    } else if (status === 'complete' || status === 'error') {
      this.mainWindow.webContents.send('message:updated', {
        conversationId: topicId,
        message: {
          id: messageId,
          conversationId: topicId,
          text,
          status: status === 'error' ? 'error' : 'sent',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Start MCP server (Node.js child process)
   * TODO: Implement when MCP manager is refactored to lama.core
   */
  async startMCPServer(_modelId: string, _config: any): Promise<void> {
    throw new Error('MCP server management not yet implemented in refactored architecture');
  }

  /**
   * Stop MCP server
   * TODO: Implement when MCP manager is refactored to lama.core
   */
  async stopMCPServer(_modelId: string): Promise<void> {
    throw new Error('MCP server management not yet implemented in refactored architecture');
  }

  /**
   * Read model file from disk (Node.js file system)
   * TODO: Implement when needed for model loading
   */
  async readModelFile(_path: string): Promise<Buffer> {
    throw new Error('Model file reading not yet implemented in refactored architecture');
  }

  /**
   * Emit analysis update notification
   * Maps to 'keywords:updated' and/or 'subjects:updated' events for UI
   */
  emitAnalysisUpdate(topicId: string, analysisType: 'keywords' | 'subjects' | 'both'): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    console.log(`[ElectronLLMPlatform] Emitting analysis update for ${topicId}: ${analysisType}`);

    if (analysisType === 'keywords' || analysisType === 'both') {
      this.mainWindow.webContents.send('keywords:updated', {
        topicId,
      });
    }

    if (analysisType === 'subjects' || analysisType === 'both') {
      this.mainWindow.webContents.send('subjects:updated', {
        topicId,
      });
    }
  }
}
