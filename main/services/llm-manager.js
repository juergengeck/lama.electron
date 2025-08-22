/**
 * LLM Manager for Main Process
 * Handles AI model operations and MCP integration in Node.js environment
 */

const { spawn } = require('child_process')
const path = require('path')
const EventEmitter = require('events')

// Function to forward logs to renderer
function forwardLog(level, ...args) {
  try {
    const { ipcMain } = require('electron')
    const { BrowserWindow } = require('electron')
    const mainWindow = BrowserWindow.getAllWindows()[0]
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('main-process-log', {
        level,
        message: args.join(' '),
        timestamp: Date.now()
      })
    }
  } catch (e) {
    // No main window available
  }
}

class LLMManager extends EventEmitter {
  constructor() {
    super()
    this.models = new Map()
    this.modelSettings = new Map()
    this.mcpClients = new Map()
    this.mcpTools = new Map()
    this.isInitialized = false
    this.defaultModelId = 'ollama:gpt-oss'
    
    // Bind methods to preserve 'this' context
    this.chat = this.chat.bind(this)
    this.enhanceMessagesWithTools = this.enhanceMessagesWithTools.bind(this)
    this.getToolDescriptions = this.getToolDescriptions.bind(this)
  }

  async init() {
    if (this.isInitialized) {
      console.log('[LLMManager] Already initialized')
      return
    }

    console.log('[LLMManager] Initializing in main process...')

    try {
      // Load saved settings
      await this.loadSettings()
      
      // Register available models
      await this.registerModels()
      
      // Initialize MCP servers
      await this.initializeMCP()
      
      this.isInitialized = true
      console.log('[LLMManager] Initialized successfully with MCP support')
      
      // Immediate verification after initialization
      console.log('[LLMManager] POST-INIT VERIFICATION:')
      console.log(`  - mcpTools.size: ${this.mcpTools.size}`)
      console.log(`  - mcpClients.size: ${this.mcpClients.size}`)
      console.log(`  - Available tools:`, Array.from(this.mcpTools.keys()))
    } catch (error) {
      console.error('[LLMManager] Initialization failed:', error)
      throw error
    }
  }

  async registerModels() {
    // Check for LM Studio availability (optional)
    try {
      const lmstudio = require('./lmstudio')
      const isLMStudioAvailable = await lmstudio.isLMStudioRunning()
      
      if (isLMStudioAvailable) {
        console.log('[LLMManager] LM Studio is available')
        const lmStudioModels = await lmstudio.getAvailableModels()
        
        if (lmStudioModels.length > 0) {
          // Register each available LM Studio model
          for (const model of lmStudioModels) {
            this.models.set(`lmstudio:${model.id}`, {
              id: `lmstudio:${model.id}`,
              name: `${model.id} (LM Studio)`,
              provider: 'lmstudio',
              description: 'Local model via LM Studio',
              capabilities: ['chat', 'completion', 'streaming'],
              contextLength: model.context_length || 4096,
              parameters: {
                modelName: model.id,
                temperature: 0.7,
                maxTokens: 2048
              }
            })
          }
          
          // Also register a default LM Studio option
          this.models.set('lmstudio:default', {
            id: 'lmstudio:default',
            name: 'LM Studio (Active Model)',
            provider: 'lmstudio',
            description: 'Currently loaded model in LM Studio',
            capabilities: ['chat', 'completion', 'streaming'],
            contextLength: 4096,
            parameters: {
              modelName: 'default',
              temperature: 0.7,
              maxTokens: 2048
            }
          })
          
          console.log(`[LLMManager] Registered ${lmStudioModels.length} LM Studio models`)
        }
      }
    } catch (error) {
      console.log('[LLMManager] LM Studio not available:', error.message)
    }
    
    // Register Ollama models
    this.models.set('ollama:gpt-oss', {
      id: 'ollama:gpt-oss',
      name: 'GPT-OSS (Ollama)',
      provider: 'ollama',
      description: 'Local GPT model via Ollama',
      capabilities: ['chat', 'completion'],
      contextLength: 8192,
      parameters: {
        modelName: 'gpt-oss',
        temperature: 0.7,
        maxTokens: 2048
      }
    })

    // Register Claude models
    const claudeModels = [
      {
        id: 'claude:claude-3-5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        description: 'Advanced reasoning and analysis',
        contextLength: 200000,
        maxTokens: 8192
      },
      {
        id: 'claude:claude-3-5-haiku', 
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        description: 'Fast and efficient',
        contextLength: 200000,
        maxTokens: 8192
      }
    ]

    claudeModels.forEach(model => {
      this.models.set(model.id, {
        ...model,
        capabilities: ['chat', 'analysis', 'reasoning'],
        parameters: {
          temperature: 0.7,
          maxTokens: model.maxTokens
        }
      })
    })

    console.log(`[LLMManager] Registered ${this.models.size} models`)
  }

  async initializeMCP() {
    console.log('[LLMManager] Initializing MCP servers...')
    
    try {
      // Import MCP SDK
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
      const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')
      
      // Start filesystem MCP server
      const fsTransport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/gecko/src/lama.electron']
      })
      
      const fsClient = new Client({
        name: 'lama-electron-filesystem',
        version: '1.0.0'
      }, {
        capabilities: { tools: {} }
      })
      
      await fsClient.connect(fsTransport)
      this.mcpClients.set('filesystem', fsClient)
      
      // Discover tools
      const tools = await fsClient.listTools()
      if (tools.tools) {
        tools.tools.forEach(tool => {
          this.mcpTools.set(tool.name, {
            ...tool,
            server: 'filesystem'
          })
          console.log(`[LLMManager] Registered MCP tool: ${tool.name}`)
        })
      }
      
      // Start custom LAMA MCP server
      await this.startLamaMCPServer()
      
      console.log(`[LLMManager] MCP initialized with ${this.mcpTools.size} tools`)
    } catch (error) {
      console.warn('[LLMManager] MCP initialization failed (non-critical):', error)
      // Continue without MCP - LLM can still work
    }
  }

  async startLamaMCPServer() {
    try {
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
      const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')
      
      const lamaMCPPath = path.join(__dirname, '../../lama/electron/mcp-server.js')
      
      const transport = new StdioClientTransport({
        command: 'node',
        args: [lamaMCPPath]
      })
      
      const client = new Client({
        name: 'lama-electron-app',
        version: '1.0.0'
      }, {
        capabilities: { tools: {} }
      })
      
      await client.connect(transport)
      this.mcpClients.set('lama', client)
      
      // Discover LAMA-specific tools
      const tools = await client.listTools()
      if (tools.tools) {
        tools.tools.forEach(tool => {
          this.mcpTools.set(tool.name, {
            ...tool,
            server: 'lama'
          })
          console.log(`[LLMManager] Registered LAMA tool: ${tool.name}`)
        })
      }
      
      console.log('[LLMManager] LAMA MCP server started')
    } catch (error) {
      console.warn('[LLMManager] Failed to start LAMA MCP server:', error)
    }
  }

  getToolDescriptions() {
    if (this.mcpTools.size === 0) {
      return ''
    }
    
    let description = '\n\nYou have access to the following tools:\n\n'
    
    for (const [name, tool] of this.mcpTools) {
      description += `- **${name}**: ${tool.description}\n`
      if (tool.inputSchema?.properties) {
        description += `  Parameters: ${Object.keys(tool.inputSchema.properties).join(', ')}\n`
      }
    }
    
    description += '\nTo use a tool, respond with a JSON block like this:\n'
    description += '```json\n{\n  "tool": "tool_name",\n  "parameters": { "param1": "value1" }\n}\n```\n'
    
    return description
  }

  async chat(messages, modelId = null) {
    const model = modelId ? this.models.get(modelId) : this.models.get(this.defaultModelId)
    if (!model) {
      throw new Error('No model available')
    }

    console.log(`[LLMManager] Chat with ${model.id} (${messages.length} messages), ${this.mcpTools.size} MCP tools available`)
    console.log(`[LLMManager] ABOUT TO ENHANCE MESSAGES`)
    
    // Add tool descriptions to system message
    const enhancedMessages = this.enhanceMessagesWithTools(messages)
    console.log(`[LLMManager] ENHANCEMENT COMPLETE`)
    
    let response
    
    if (model.provider === 'ollama') {
      response = await this.chatWithOllama(model, enhancedMessages)
    } else if (model.provider === 'lmstudio') {
      response = await this.chatWithLMStudio(model, enhancedMessages)
    } else if (model.provider === 'anthropic') {
      response = await this.chatWithClaude(model, enhancedMessages)
    } else {
      throw new Error(`Unsupported provider: ${model.provider}`)
    }
    
    // Process tool calls if present
    response = await this.processToolCalls(response)
    
    return response
  }

  enhanceMessagesWithTools(messages) {
    const logMsg1 = `[LLMManager] ============= ENHANCING MESSAGES =============`
    const logMsg2 = `[LLMManager] MCP Tools size: ${this.mcpTools.size}`
    const toolDescriptions = this.getToolDescriptions()
    const logMsg3 = `[LLMManager] Tool descriptions length: ${toolDescriptions.length}`
    const logMsg4 = `[LLMManager] ============================================`
    
    console.log(logMsg1)
    console.log(logMsg2)
    console.log(logMsg3)
    console.log(logMsg4)
    
    // Forward to renderer
    forwardLog('log', logMsg1)
    forwardLog('log', logMsg2)
    forwardLog('log', logMsg3)
    forwardLog('log', logMsg4)
    
    if (!toolDescriptions) {
      const logMsg5 = `[LLMManager] NO TOOL DESCRIPTIONS - returning original messages`
      console.log(logMsg5)
      forwardLog('warn', logMsg5)
      return messages
    }
    
    const enhanced = [...messages]
    const systemIndex = enhanced.findIndex(m => m.role === 'system')
    
    if (systemIndex >= 0) {
      enhanced[systemIndex] = {
        ...enhanced[systemIndex],
        content: enhanced[systemIndex].content + toolDescriptions
      }
      console.log(`[LLMManager] Enhanced existing system message with tools`)
    } else {
      enhanced.unshift({
        role: 'system',
        content: 'You are a helpful AI assistant integrated into LAMA with access to filesystem tools.' + toolDescriptions
      })
      console.log(`[LLMManager] Added new system message with tools`)
    }
    
    console.log(`[LLMManager] Enhanced messages count: ${enhanced.length}, first message preview: ${enhanced[0]?.content?.substring(0, 200)}...`)
    return enhanced
  }

  async processToolCalls(response) {
    // Check for tool calls in response
    const toolCallMatch = response.match(/```json\s*({[\s\S]*?})\s*```/)
    if (!toolCallMatch) return response
    
    try {
      const toolCall = JSON.parse(toolCallMatch[1])
      if (toolCall.tool && this.mcpTools.has(toolCall.tool)) {
        console.log(`[LLMManager] Executing tool: ${toolCall.tool}`)
        
        const tool = this.mcpTools.get(toolCall.tool)
        const client = this.mcpClients.get(tool.server)
        
        if (client) {
          const result = await client.callTool({
            name: toolCall.tool,
            arguments: toolCall.parameters || {}
          })
          
          const resultText = `Tool executed: ${toolCall.tool}\nResult: ${JSON.stringify(result, null, 2)}`
          return response.replace(toolCallMatch[0], resultText)
        }
      }
    } catch (error) {
      console.error('[LLMManager] Tool execution failed:', error)
    }
    
    return response
  }

  async chatWithOllama(model, messages) {
    const ollama = require('./ollama')
    
    return await ollama.chatWithOllama(
      model.parameters.modelName,
      messages,
      {
        temperature: model.parameters.temperature,
        max_tokens: model.parameters.maxTokens
      }
    )
  }
  
  async chatWithLMStudio(model, messages) {
    const lmstudio = require('./lmstudio')
    
    // Handle streaming if requested
    if (model.parameters.stream) {
      const stream = lmstudio.streamChatWithLMStudio(
        model.parameters.modelName,
        messages,
        {
          temperature: model.parameters.temperature,
          max_tokens: model.parameters.maxTokens
        }
      )
      
      let fullResponse = ''
      for await (const chunk of stream) {
        fullResponse += chunk
        // Emit streaming event
        this.onChatStream.emit({ chunk, partial: fullResponse })
      }
      return fullResponse
    }
    
    // Non-streaming chat
    return await lmstudio.chatWithLMStudio(
      model.parameters.modelName,
      messages,
      {
        temperature: model.parameters.temperature,
        max_tokens: model.parameters.maxTokens
      }
    )
  }

  async chatWithClaude(model, messages) {
    const { chatWithClaude } = require('../../electron-ui/src/services/claude')
    
    const apiKey = process.env.ANTHROPIC_API_KEY || this.getStoredApiKey('claude')
    if (!apiKey) {
      throw new Error('Claude API key not configured')
    }
    
    return await chatWithClaude(
      model.id.replace('claude:', ''),
      messages,
      {
        apiKey,
        temperature: model.parameters.temperature,
        max_tokens: model.parameters.maxTokens
      }
    )
  }

  async loadSettings() {
    // Load from storage (implement based on your storage system)
    // For now, use defaults
    this.modelSettings.set(this.defaultModelId, {
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: 'You are a helpful AI assistant.'
    })
  }

  getStoredApiKey(provider) {
    // Implement secure key storage
    return null
  }

  async setApiKey(provider, apiKey) {
    // Store API key securely
    console.log(`[LLMManager] API key set for ${provider}`)
  }

  getModels() {
    return Array.from(this.models.values())
  }

  getModel(id) {
    return this.models.get(id)
  }

  getDefaultModel() {
    return this.models.get(this.defaultModelId)
  }

  debugToolsState() {
    console.log(`[LLMManager] DEBUG - Tools state:`)
    console.log(`  - mcpTools.size: ${this.mcpTools.size}`)
    console.log(`  - mcpClients.size: ${this.mcpClients.size}`)
    console.log(`  - Available tools:`, Array.from(this.mcpTools.keys()))
    console.log(`  - isInitialized: ${this.isInitialized}`)
    return {
      toolCount: this.mcpTools.size,
      clientCount: this.mcpClients.size,
      tools: Array.from(this.mcpTools.keys()),
      initialized: this.isInitialized
    }
  }

  async shutdown() {
    console.log('[LLMManager] Shutting down...')
    
    // Close MCP connections
    for (const [name, client] of this.mcpClients) {
      try {
        await client.close()
        console.log(`[LLMManager] Closed MCP client: ${name}`)
      } catch (error) {
        console.error(`[LLMManager] Error closing ${name}:`, error)
      }
    }
    
    this.mcpClients.clear()
    this.mcpTools.clear()
    this.models.clear()
    this.modelSettings.clear()
    this.isInitialized = false
    
    console.log('[LLMManager] Shutdown complete')
  }
}

module.exports = new LLMManager()