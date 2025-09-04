/**
 * Unified Tool Interface for AI Assistant and MCP
 * 
 * This interface ensures both AI Assistant and MCP servers
 * use the same pattern for tool discovery and execution.
 * 
 * Based on LAMA's architecture where tools are:
 * - Discoverable (list available tools)
 * - Describable (JSON schema for parameters)
 * - Executable (async function with typed inputs/outputs)
 * - Trackable (execution history, permissions)
 */

/**
 * Tool Definition Interface
 * Used by both AI Assistant and MCP servers
 */
export class ToolDefinition {
  constructor({
    name,
    description,
    inputSchema,
    outputSchema,
    handler,
    permissions = {},
    category = 'general'
  }) {
    this.name = name
    this.description = description
    this.inputSchema = inputSchema
    this.outputSchema = outputSchema
    this.handler = handler
    this.permissions = permissions
    this.category = category
  }
  
  /**
   * Validate input against schema
   */
  validateInput(input) {
    // TODO: Implement JSON schema validation
    // For now, just check required fields
    if (this.inputSchema?.required) {
      for (const field of this.inputSchema.required) {
        if (!(field in input)) {
          throw new Error(`Missing required field: ${field}`)
        }
      }
    }
    return true
  }
  
  /**
   * Execute the tool
   */
  async execute(input, context = {}) {
    this.validateInput(input)
    return await this.handler(input, context)
  }
  
  /**
   * Get MCP-compatible tool description
   */
  toMCPFormat() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema
    }
  }
  
  /**
   * Get AI Assistant-compatible format
   */
  toAssistantFormat() {
    return {
      id: this.name,
      name: this.name,
      description: this.description,
      parameters: this.inputSchema,
      returns: this.outputSchema,
      category: this.category
    }
  }
}

/**
 * Tool Registry Interface
 * Manages tool registration and execution
 */
export class ToolRegistry {
  constructor() {
    this.tools = new Map()
    this.categories = new Map()
  }
  
  /**
   * Register a tool
   */
  register(tool) {
    if (!(tool instanceof ToolDefinition)) {
      tool = new ToolDefinition(tool)
    }
    
    this.tools.set(tool.name, tool)
    
    // Group by category
    if (!this.categories.has(tool.category)) {
      this.categories.set(tool.category, [])
    }
    this.categories.get(tool.category).push(tool.name)
    
    console.log(`[ToolRegistry] Registered tool: ${tool.name} (${tool.category})`)
  }
  
  /**
   * Get all tools in MCP format
   */
  getMCPTools() {
    return Array.from(this.tools.values()).map(tool => tool.toMCPFormat())
  }
  
  /**
   * Get all tools in AI Assistant format
   */
  getAssistantTools() {
    return Array.from(this.tools.values()).map(tool => tool.toAssistantFormat())
  }
  
  /**
   * Execute a tool by name
   */
  async execute(toolName, input, context = {}) {
    const tool = this.tools.get(toolName)
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`)
    }
    
    console.log(`[ToolRegistry] Executing tool: ${toolName}`)
    return await tool.execute(input, context)
  }
  
  /**
   * Get tools by category
   */
  getByCategory(category) {
    const toolNames = this.categories.get(category) || []
    return toolNames.map(name => this.tools.get(name))
  }
  
  /**
   * List all available tools
   */
  list() {
    return {
      tools: this.getMCPTools(),
      categories: Array.from(this.categories.keys())
    }
  }
}

/**
 * Base class for tool providers (MCP servers, AI assistants)
 */
export class ToolProvider {
  constructor(name, version = '1.0.0') {
    this.name = name
    this.version = version
    this.registry = new ToolRegistry()
  }
  
  /**
   * Register built-in tools
   */
  registerBuiltinTools() {
    // Override in subclasses
  }
  
  /**
   * Handle tool execution request
   */
  async handleToolCall(toolName, input, context = {}) {
    try {
      const result = await this.registry.execute(toolName, input, context)
      return {
        success: true,
        result
      }
    } catch (error) {
      console.error(`[${this.name}] Tool execution failed:`, error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * List available tools
   */
  listTools() {
    return this.registry.list()
  }
}

/**
 * Unified interface for AI Assistant to use tools
 */
export class AIToolInterface extends ToolProvider {
  constructor(aiAssistant) {
    super('AIAssistant', '1.0.0')
    this.aiAssistant = aiAssistant
    this.registerBuiltinTools()
  }
  
  registerBuiltinTools() {
    // Register AI-specific tools
    this.registry.register({
      name: 'generate_response',
      description: 'Generate an AI response for a message',
      category: 'ai',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          modelId: { type: 'string' },
          temperature: { type: 'number' }
        },
        required: ['message']
      },
      handler: async (input) => {
        return await this.aiAssistant.generateResponse(input)
      }
    })
    
    this.registry.register({
      name: 'create_ai_topic',
      description: 'Create a new AI-enabled chat topic',
      category: 'ai',
      inputSchema: {
        type: 'object',
        properties: {
          modelId: { type: 'string' },
          name: { type: 'string' }
        },
        required: ['modelId']
      },
      handler: async (input) => {
        return await this.aiAssistant.getOrCreateAITopic(input.modelId)
      }
    })
  }
  
  /**
   * Get tools for LLM to use via MCP
   */
  getToolsForLLM() {
    // Filter tools that are safe for LLM to use
    return this.registry.getAssistantTools().filter(tool => 
      tool.category !== 'system' && tool.category !== 'admin'
    )
  }
}

/**
 * Unified interface for MCP servers
 */
export class MCPToolInterface extends ToolProvider {
  constructor(server, appModel) {
    super(server.name, server.version)
    this.server = server
    this.appModel = appModel
    this.registerBuiltinTools()
  }
  
  registerBuiltinTools() {
    // Register MCP server tools
    // These would come from the MCP server's tool definitions
  }
  
  /**
   * Bridge MCP server tools to unified interface
   */
  async bridgeMCPTool(mcpTool) {
    this.registry.register({
      name: mcpTool.name,
      description: mcpTool.description,
      category: 'mcp',
      inputSchema: mcpTool.inputSchema,
      handler: async (input) => {
        // Execute through MCP server
        return await this.server.callTool(mcpTool.name, input)
      }
    })
  }
}

export default {
  ToolDefinition,
  ToolRegistry,
  ToolProvider,
  AIToolInterface,
  MCPToolInterface
}