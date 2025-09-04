/**
 * MCPManager - Manages Model Context Protocol servers and tools
 * Provides tool discovery and execution for LLMs
 */
export class MCPManager {
    constructor() {
        Object.defineProperty(this, "clients", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "tools", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "servers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "appModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Will be set after initialization
        // Define available MCP servers
        this.servers = this.getServerConfigurations();
    }
    setAppModel(appModel) {
        this.appModel = appModel;
    }
    getServerConfigurations() {
        const servers = [];
        // Try official MCP servers first
        const officialServers = [
            {
                name: 'filesystem',
                command: '/opt/homebrew/bin/mcp-server-filesystem',
                args: ['/Users/gecko/src/lama.electron'],
                fallback: {
                    command: 'npx',
                    args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/gecko/src/lama.electron']
                }
            }
        ];
        // Add custom LAMA servers (these would be started separately)
        const customServers = [
        // These would be implemented as separate processes
        // For now, we'll just use the filesystem server
        ];
        return [...officialServers, ...customServers];
    }
    async init() {
        console.log('[MCPManager] Initializing MCP servers...');
        // In Electron renderer process, we need to use IPC to spawn processes
        // For now, skip MCP in renderer until we implement IPC bridge
        if (typeof window !== 'undefined') {
            console.log('[MCPManager] Running in renderer process - MCP servers need IPC bridge to main process');
            // TODO: Implement IPC bridge to main process for spawning MCP servers
            return;
        }
        for (const server of this.servers) {
            try {
                await this.connectToServer(server);
            }
            catch (error) {
                console.error(`[MCPManager] Failed to connect to ${server.name}:`, error);
            }
        }
        console.log(`[MCPManager] Initialized with ${this.tools.size} tools from ${this.clients.size} servers`);
    }
    async connectToServer(server) {
        console.log(`[MCPManager] Connecting to ${server.name}...`);
        // Dynamically import MCP modules only in Node.js environment
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
        let transport;
        let connected = false;
        // Try primary command first
        try {
            transport = new StdioClientTransport({
                command: server.command,
                args: server.args,
                env: server.env
            });
            const client = new Client({
                name: `lama-electron-${server.name}`,
                version: '1.0.0'
            }, {
                capabilities: {
                    tools: {}
                }
            });
            await client.connect(transport);
            this.clients.set(server.name, client);
            connected = true;
            // Discover tools from this server
            const tools = await client.listTools();
            if (tools.tools) {
                for (const tool of tools.tools) {
                    const mcpTool = {
                        name: tool.name,
                        description: tool.description || '',
                        inputSchema: tool.inputSchema,
                        server: server.name
                    };
                    this.tools.set(tool.name, mcpTool);
                    console.log(`[MCPManager] Registered tool: ${tool.name}`);
                }
            }
        }
        catch (error) {
            console.warn(`[MCPManager] Failed to connect to ${server.name} with primary command:`, error);
            // Try fallback if available
            if (server.fallback) {
                console.log(`[MCPManager] Trying fallback for ${server.name}...`);
                // Fallback logic would go here
            }
            else {
                throw error;
            }
        }
    }
    async shutdown() {
        console.log('[MCPManager] Shutting down MCP servers...');
        for (const [name, client] of this.clients) {
            try {
                await client.close();
                console.log(`[MCPManager] Closed ${name}`);
            }
            catch (error) {
                console.error(`[MCPManager] Error closing ${name}:`, error);
            }
        }
        this.clients.clear();
        this.tools.clear();
    }
    getAvailableTools() {
        return Array.from(this.tools.values());
    }
    getToolDescriptions() {
        const tools = this.getAvailableTools();
        if (tools.length === 0) {
            return '';
        }
        let description = '\n\nYou have access to the following tools:\n\n';
        for (const tool of tools) {
            description += `- **${tool.name}**: ${tool.description}\n`;
            if (tool.inputSchema?.properties) {
                description += `  Parameters: ${Object.keys(tool.inputSchema.properties).join(', ')}\n`;
            }
        }
        description += '\nTo use a tool, respond with a JSON block like this:\n';
        description += '```json\n';
        description += '{\n';
        description += '  "tool": "tool_name",\n';
        description += '  "parameters": {\n';
        description += '    "param1": "value1"\n';
        description += '  }\n';
        description += '}\n';
        description += '```\n';
        return description;
    }
    async executeTool(toolName, parameters) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            throw new Error(`Tool ${toolName} not found`);
        }
        const client = this.clients.get(tool.server);
        if (!client) {
            throw new Error(`Server ${tool.server} not connected`);
        }
        console.log(`[MCPManager] Executing tool ${toolName} with params:`, parameters);
        try {
            const result = await client.callTool({
                name: toolName,
                arguments: parameters
            });
            console.log(`[MCPManager] Tool ${toolName} executed successfully`);
            return result;
        }
        catch (error) {
            console.error(`[MCPManager] Tool execution failed:`, error);
            throw error;
        }
    }
    isInitialized() {
        return this.clients.size > 0;
    }
}
