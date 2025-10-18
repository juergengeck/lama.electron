/**
 * MCP Server IPC Handlers (TypeScript)
 * Manages Model Context Protocol server configuration and operations
 */

import { IpcMainInvokeEvent } from 'electron';
import mcpManager from '../../services/mcp-manager.js';

interface MCPServer {
  name: string;
  command: string;
  args: string[];
  description: string;
  enabled: boolean;
  createdAt?: number;
  updatedAt?: number;
}

interface MCPListRequest {
  // No parameters needed
}

interface MCPAddRequest {
  config: Omit<MCPServer, 'createdAt' | 'updatedAt'>;
}

interface MCPUpdateRequest {
  name: string;
  config: Partial<MCPServer>;
}

interface MCPRemoveRequest {
  name: string;
}

interface MCPListResult {
  success: boolean;
  servers?: MCPServer[];
  error?: string;
}

interface MCPActionResult {
  success: boolean;
  error?: string;
}

const mcpHandlers = {
  /**
   * List all configured MCP servers
   */
  async listServers(event: IpcMainInvokeEvent, request?: MCPListRequest): Promise<MCPListResult> {
    try {
      console.log('[MCP] Listing all MCP servers');

      const servers = await mcpManager.listServers();

      return {
        success: true,
        servers
      };
    } catch (error: any) {
      console.error('[MCP] Failed to list servers:', error);
      return {
        success: false,
        error: error.message || 'Failed to list MCP servers'
      };
    }
  },

  /**
   * Add a new MCP server configuration
   */
  async addServer(event: IpcMainInvokeEvent, request: MCPAddRequest): Promise<MCPActionResult> {
    try {
      const { config } = request;
      console.log('[MCP] Adding new MCP server:', config.name);

      // Validate required fields
      if (!config.name || !config.command) {
        throw new Error('Server name and command are required');
      }

      // Add timestamps
      const serverConfig: MCPServer = {
        ...config,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await mcpManager.addServer(serverConfig);

      return {
        success: true
      };
    } catch (error: any) {
      console.error('[MCP] Failed to add server:', error);
      return {
        success: false,
        error: error.message || 'Failed to add MCP server'
      };
    }
  },

  /**
   * Update an existing MCP server configuration
   */
  async updateServer(event: IpcMainInvokeEvent, request: MCPUpdateRequest): Promise<MCPActionResult> {
    try {
      const { name, config } = request;
      console.log('[MCP] Updating MCP server:', name);

      if (!name) {
        throw new Error('Server name is required');
      }

      // Add updated timestamp
      const updatedConfig = {
        ...config,
        updatedAt: Date.now()
      };

      await mcpManager.updateServer(name, updatedConfig);

      return {
        success: true
      };
    } catch (error: any) {
      console.error('[MCP] Failed to update server:', error);
      return {
        success: false,
        error: error.message || 'Failed to update MCP server'
      };
    }
  },

  /**
   * Remove an MCP server configuration
   */
  async removeServer(event: IpcMainInvokeEvent, request: MCPRemoveRequest): Promise<MCPActionResult> {
    try {
      const { name } = request;
      console.log('[MCP] Removing MCP server:', name);

      if (!name) {
        throw new Error('Server name is required');
      }

      await mcpManager.removeServer(name);

      return {
        success: true
      };
    } catch (error: any) {
      console.error('[MCP] Failed to remove server:', error);
      return {
        success: false,
        error: error.message || 'Failed to remove MCP server'
      };
    }
  }
};

export default mcpHandlers;
