/**
 * MCP Manager for Main Process
 * Manages Model Context Protocol servers in Node.js environment
 * Provides IPC bridge for renderer process to access MCP tools
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MCPTool {
  name: string;
  fullName: string;
  description?: string;
  inputSchema?: any;
  server?: string;
}

class MCPManager {
  public clients: Map<string, any>;
  public servers: any[];
  public tools: Map<string, MCPTool>;
  public isInitialized: boolean;

  constructor() {
    this.clients = new Map();
    this.tools = new Map();
    this.servers = [];
    this.isInitialized = false;
  }

  getServerConfigurations(): any {
    const projectRoot = path.resolve(__dirname, '../..');
    const homeDir = os.homedir();
    
    return [
      {
        name: 'filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', projectRoot],
        description: 'File system operations for the project directory'
      }
      // Shell server not yet available in npm registry
      // {
      //   name: 'shell',
      //   command: 'npx',
      //   args: ['-y', '@modelcontextprotocol/server-shell'],
      //   description: 'Shell command execution'
      // }
    ];
  }

  async init(): Promise<any> {
    if (this.isInitialized) {
      console.log('[MCPManager] Already initialized');
      return;
    }

    console.log('[MCPManager] Initializing MCP servers...');
    this.servers = this.getServerConfigurations();
    
    for (const server of this.servers) {
      try {
        await this.connectToServer(server);
      } catch (error) {
        console.error(`[MCPManager] Failed to connect to ${server.name}:`, (error as Error).message);
      }
    }
    
    this.isInitialized = true;
    console.log(`[MCPManager] Initialized with ${this.tools.size} tools from ${this.clients.size} servers`);
  }

  async connectToServer(server: any): Promise<any> {
    console.log(`[MCPManager] Connecting to ${server.name}...`);
    
    try {
      const transport = new StdioClientTransport({
        command: server.command,
        args: server.args,
        env: {
          ...process.env,
          // Add any required environment variables
        }
      });
      
      const client = new Client({
        name: `lama-electron-${server.name}`,
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {},
          prompts: {}
        }
      });
      
      await client.connect(transport);
      this.clients.set(server.name, { client, transport });
      
      // Discover tools from this server
      try {
        const tools: any = await client.listTools();
        if (tools.tools) {
          const toolNames = [];
          for (const tool of tools.tools) {
            const toolKey = `${server.name}:${tool.name}`;
            this.tools.set(toolKey, {
              name: tool.name,
              description: tool.description || '',
              inputSchema: tool.inputSchema,
              server: server.name,
              fullName: toolKey
            });
            toolNames.push(toolKey);
          }
          // Log all tools at once instead of individually
          if (toolNames.length > 0) {
            console.log(`[MCPManager] Registered ${toolNames.length} tools from ${server.name}`);
          }
        }
      } catch (error) {
        console.warn(`[MCPManager] Failed to list tools for ${server.name}:`, (error as Error).message);
      }
      
      console.log(`[MCPManager] Connected to ${server.name} successfully`);
    } catch (error) {
      console.error(`[MCPManager] Failed to connect to ${server.name}:`, error);
      throw error;
    }
  }

  async shutdown(): Promise<any> {
    console.log('[MCPManager] Shutting down MCP servers...');
    
    for (const [name, { client, transport }] of this.clients) {
      try {
        await client.close();
        console.log(`[MCPManager] Closed ${name}`);
      } catch (error) {
        console.error(`[MCPManager] Error closing ${name}:`, error);
      }
    }
    
    this.clients.clear();
    this.tools.clear();
    this.isInitialized = false;
  }

  getAvailableTools(): any {
    return Array.from(this.tools.values());
  }

  getToolDescriptions(): any {
    const tools = this.getAvailableTools();
    if (tools.length === 0) {
      return '';
    }

    let description = '\n\n# Available Tools\n\n';
    description += 'You have access to the following tools that you can execute:\n\n';

    for (const tool of tools) {
      description += `**${tool.fullName}**\n`;
      if (tool.description) {
        description += `${tool.description}\n`;
      }
      if (tool.inputSchema && tool.inputSchema.properties) {
        description += 'Parameters:\n';
        for (const [paramName, paramDef] of Object.entries(tool.inputSchema.properties)) {
          const def = paramDef as any;
          const required = tool.inputSchema.required?.includes(paramName) ? ' (required)' : ' (optional)';
          description += `  - ${paramName}${required}: ${def.description || def.type || 'no description'}\n`;
        }
      }
      description += '\n';
    }

    description += '\n# Tool Usage\n\n';
    description += 'When you need to use a tool, respond with ONLY the JSON block (no thinking, no explanation):\n\n';
    description += '```json\n';
    description += '{"tool":"tool-name","parameters":{"param":"value"}}\n';
    description += '```\n\n';
    description += 'The system will execute the tool and provide you with the result. Then you can respond with the result formatted for the user.\n';
    description += 'IMPORTANT: Do NOT simulate tool execution - actually call the tool by responding with the JSON.\n';

    return description;
  }

  async executeTool(toolName: any, parameters: any): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      // Try to find by short name
      const foundTool = Array.from(this.tools.values()).find(t => t.name === toolName);
      if (foundTool) {
        toolName = foundTool.fullName;
      } else {
        throw new Error(`Tool ${toolName} not found`);
      }
    }
    
    const toolData = tool || this.tools.get(toolName);
    const serverData = this.clients.get(toolData.server);
    
    if (!serverData) {
      throw new Error(`Server ${toolData.server} not connected`);
    }
    
    console.log(`[MCPManager] Executing tool ${toolName} with params:`, parameters);
    
    try {
      const result: any = await serverData.client.callTool({
        name: toolData.name,
        arguments: parameters
      });
      
      console.log(`[MCPManager] Tool ${toolName} executed successfully`);
      return result;
    } catch (error) {
      console.error(`[MCPManager] Tool execution failed:`, error);
      throw error;
    }
  }

  // Debug method to check state
  debugState(): any {
    return {
      initialized: this.isInitialized,
      servers: this.servers.map((s: any) => s.name),
      connectedClients: Array.from(this.clients.keys()),
      availableTools: Array.from(this.tools.keys()),
      toolCount: this.tools.size
    };
  }
}

// Export singleton instance
const mcpManager = new MCPManager();
export default mcpManager;