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

interface ToolPermissions {
  [key: string]: unknown
}

interface JSONSchema {
  type: string
  properties?: Record<string, unknown>
  required?: string[]
  [key: string]: unknown
}

interface ToolDefinitionOptions {
  name: string
  description: string
  inputSchema: JSONSchema
  outputSchema?: JSONSchema
  handler: (input: any, context?: any) => Promise<any>
  permissions?: ToolPermissions
  category?: string
}

interface ToolExecutionContext {
  [key: string]: unknown
}

interface ToolExecutionResult {
  success: boolean
  result?: any
  error?: string
}

interface MCPToolFormat {
  name: string
  description: string
  inputSchema: JSONSchema
}

interface AssistantToolFormat {
  id: string
  name: string
  description: string
  parameters: JSONSchema
  returns?: JSONSchema
  category: string
}

interface ToolListResult {
  tools: MCPToolFormat[]
  categories: string[]
}

interface MCPServer {
  name: string
  version: string
  callTool(name: string, input: any): Promise<any>
}

interface MCPTool {
  name: string
  description: string
  inputSchema: JSONSchema
}

interface AIAssistant {
  generateResponse(input: any): Promise<any>
  getOrCreateAITopic(modelId: string): Promise<any>
}

/**
 * Tool Definition Interface
 * Used by both AI Assistant and MCP servers
 */
export class ToolDefinition {
  name: string
  description: string
  inputSchema: JSONSchema
  outputSchema?: JSONSchema
  handler: (input: any, context?: any) => Promise<any>
  permissions: ToolPermissions
  category: string

  constructor({
    name,
    description,
    inputSchema,
    outputSchema,
    handler,
    permissions = {},
    category = 'general'
  }: ToolDefinitionOptions) {
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
  validateInput(input: any): boolean {
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
  async execute(input: any, context: ToolExecutionContext = {}): Promise<any> {
    this.validateInput(input)
    return await this.handler(input, context)
  }

  /**
   * Get MCP-compatible tool description
   */
  toMCPFormat(): MCPToolFormat {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema
    }
  }

  /**
   * Get AI Assistant-compatible format
   */
  toAssistantFormat(): AssistantToolFormat {
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
  public tools: Map<string, ToolDefinition>
  public categories: Map<string, string[]>

  constructor() {
    this.tools = new Map()
    this.categories = new Map()
  }

  /**
   * Register a tool
   */
  register(tool: ToolDefinition | ToolDefinitionOptions): void {
    let toolDef: ToolDefinition;
    if (!(tool instanceof ToolDefinition)) {
      toolDef = new ToolDefinition(tool)
    } else {
      toolDef = tool;
    }

    this.tools.set(toolDef.name, toolDef)

    // Group by category
    if (!this.categories.has(toolDef.category)) {
      this.categories.set(toolDef.category, [])
    }
    this.categories.get(toolDef.category)!.push(toolDef.name)

    console.log(`[ToolRegistry] Registered tool: ${toolDef.name} (${toolDef.category})`)
  }

  /**
   * Get all tools in MCP format
   */
  getMCPTools(): MCPToolFormat[] {
    return Array.from(this.tools.values()).map(tool => tool.toMCPFormat())
  }

  /**
   * Get all tools in AI Assistant format
   */
  getAssistantTools(): AssistantToolFormat[] {
    return Array.from(this.tools.values()).map(tool => tool.toAssistantFormat())
  }

  /**
   * Execute a tool by name
   */
  async execute(toolName: string, input: any, context: ToolExecutionContext = {}): Promise<any> {
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
  getByCategory(category: string): ToolDefinition[] {
    const toolNames = this.categories.get(category) || []
    return toolNames.map(name => this.tools.get(name)!).filter(Boolean)
  }

  /**
   * List all available tools
   */
  list(): ToolListResult {
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

  name: string
  version: string
  registry: ToolRegistry

  constructor(name: string, version: string = '1.0.0') {
    this.name = name
    this.version = version
    this.registry = new ToolRegistry()
  }

  /**
   * Register built-in tools
   */
  registerBuiltinTools(): void {
    // Override in subclasses
  }

  /**
   * Handle tool execution request
   */
  async handleToolCall(toolName: string, input: any, context: ToolExecutionContext = {}): Promise<ToolExecutionResult> {
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
        error: (error as Error).message
      }
    }
  }

  /**
   * List available tools
   */
  listTools(): ToolListResult {
    return this.registry.list()
  }
}

/**
 * Unified interface for AI Assistant to use tools
 */
export class AIToolInterface extends ToolProvider {
  public aiAssistant: any;

  constructor(aiAssistant: AIAssistant) {
    super('AIAssistant', '1.0.0')
    this.aiAssistant = aiAssistant
    this.registerBuiltinTools()
  }

  override registerBuiltinTools(): void {
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
      handler: async (input: any) => {
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
      handler: async (input: any) => {
        return await this.aiAssistant.getOrCreateAITopic(input.modelId)
      }
    })
  }

  /**
   * Get tools for LLM to use via MCP
   */
  getToolsForLLM(): AssistantToolFormat[] {
    // Filter tools that are safe for LLM to use
    return this.registry.getAssistantTools().filter((tool: any) =>
      tool.category !== 'system' && tool.category !== 'admin'
    )
  }
}

/**
 * Unified interface for MCP servers
 
  public server: any;
  public appModel: any;
*/
export class MCPToolInterface extends ToolProvider {
  public server: MCPServer

  constructor(server: MCPServer, appModel: any) {
    super(server.name, server.version)
    this.server = server as any
    (this as any).appModel = appModel
    this.registerBuiltinTools()
  }

  override registerBuiltinTools(): void {
    // Register MCP server tools
    // These would come from the MCP server's tool definitions
  }

  /**
   * Bridge MCP server tools to unified interface
   */
  async bridgeMCPTool(mcpTool: MCPTool): Promise<void> {
    this.registry.register({
      name: mcpTool.name,
      description: mcpTool.description,
      category: 'mcp',
      inputSchema: mcpTool.inputSchema,
      handler: async (input: any) => {
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