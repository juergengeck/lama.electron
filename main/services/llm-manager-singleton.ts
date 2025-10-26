/**
 * LLM Manager Singleton
 *
 * Creates a single instance of lama.core's LLMManager with Electron-specific dependencies.
 * This is the ONLY llm-manager instance used throughout the application.
 */

import { LLMManager } from '@lama/core/services/llm-manager.js'
import mcpManager from './mcp-manager.js'
import electron from 'electron'

const { BrowserWindow } = electron

/**
 * Forward logs to renderer process for debugging
 */
function forwardLog(level: string, message: string): void {
  try {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('main-process-log', {
        level,
        message,
        timestamp: Date.now()
      })
    }
  } catch (e) {
    // No main window available
  }
}

/**
 * Create singleton instance of lama.core's LLMManager with Electron dependencies
 */
const llmManager = new LLMManager(
  undefined,    // platform (optional - not currently used)
  mcpManager,   // MCP manager for tool integration
  forwardLog    // Log forwarding to renderer
)

export default llmManager
