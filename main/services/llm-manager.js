/**
 * LLM Manager for Main Process
 * Handles AI model operations and MCP integration in Node.js environment
 */

import { spawn } from 'child_process';
import path from 'path';
import EventEmitter from 'events';
import { fileURLToPath } from 'url';
import electron from 'electron';
import mcpManager from './mcp-manager.js';
const { ipcMain, BrowserWindow } = electron;

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to forward logs to renderer
function forwardLog(level, ...args) {
  try {
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
      // Cancel any pending Ollama requests from before restart
      const { cancelAllOllamaRequests } = await import('./ollama.js')
      cancelAllOllamaRequests()
      console.log('[LLMManager] Cleared any pending Ollama requests')
      
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
      const lmstudio = await import('./lmstudio.js');
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
      name: 'gpt-oss',
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
      // Initialize MCP Manager
      await mcpManager.init()
      
      // Sync tools from MCP Manager
      const tools = mcpManager.getAvailableTools()
      this.mcpTools.clear()
      
      for (const tool of tools) {
        this.mcpTools.set(tool.fullName || tool.name, tool)
        console.log(`[LLMManager] Registered MCP tool: ${tool.fullName || tool.name}`)
      }
      
      console.log(`[LLMManager] MCP initialized with ${this.mcpTools.size} tools`)
    } catch (error) {
      console.warn('[LLMManager] MCP initialization failed (non-critical):', error)
      // Continue without MCP - LLM can still work
    }
  }

  async startLamaMCPServer() {
    try {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      
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
    return mcpManager.getToolDescriptions()
  }

  getAvailableModels() {
    // Return array of available models
    const modelsArray = []
    for (const [id, model] of this.models) {
      modelsArray.push({
        id: model.id,
        name: model.name,
        provider: model.provider,
        description: model.description
      })
    }
    return modelsArray
  }

  async chat(messages, modelId = null, options = {}) {
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
      response = await this.chatWithOllama(model, enhancedMessages, options)
    } else if (model.provider === 'lmstudio') {
      response = await this.chatWithLMStudio(model, enhancedMessages, options)
    } else if (model.provider === 'anthropic') {
      response = await this.chatWithClaude(model, enhancedMessages, options)
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
    console.log('[LLMManager] Checking for tool calls in response...')
    console.log('[LLMManager] Response preview:', response?.substring(0, 200))
    
    // Check for tool calls in response - try both with and without backticks
    let toolCallMatch = response?.match(/```json\s*({[\s\S]*?})\s*```/)
    if (!toolCallMatch) {
      // Try without backticks for plain JSON response
      toolCallMatch = response?.match(/^(\{.*"tool".*\})/)
      if (toolCallMatch) {
        console.log('[LLMManager] Found plain JSON tool call')
      }
    }
    
    if (!toolCallMatch) {
      console.log('[LLMManager] No tool call found in response')
      return response || ''
    }
    
    console.log('[LLMManager] Found potential tool call:', toolCallMatch[0])
    
    try {
      const toolCall = JSON.parse(toolCallMatch[1])
      if (toolCall.tool) {
        console.log(`[LLMManager] Executing tool: ${toolCall.tool} with params:`, toolCall.parameters)
        
        const result = await mcpManager.executeTool(
          toolCall.tool,
          toolCall.parameters || {}
        )
        
        console.log('[LLMManager] Tool execution result:', JSON.stringify(result).substring(0, 200))
        
        // Format the result based on tool type with elegant, natural language
        let formattedResult = ''
        
        if (toolCall.tool === 'filesystem:list_directory') {
          // Parse and format directory listing elegantly
          if (result.content && Array.isArray(result.content)) {
            const textContent = result.content.find(c => c.type === 'text')
            if (textContent && textContent.text) {
              // Parse the directory listing and format it nicely
              const lines = textContent.text.split('\n').filter(line => line.trim())
              const dirs = []
              const files = []
              
              lines.forEach(line => {
                if (line.includes('[DIR]')) {
                  dirs.push(line.replace('[DIR]', '').trim())
                } else if (line.includes('[FILE]')) {
                  files.push(line.replace('[FILE]', '').trim())
                }
              })
              
              formattedResult = 'Here\'s what I found in the current directory:\n\n'
              
              if (dirs.length > 0) {
                formattedResult += '**📁 Folders:**\n'
                dirs.forEach(dir => {
                  formattedResult += `• ${dir}\n`
                })
                if (files.length > 0) formattedResult += '\n'
              }
              
              if (files.length > 0) {
                formattedResult += '**📄 Files:**\n'
                files.forEach(file => {
                  formattedResult += `• ${file}\n`
                })
              }
              
              formattedResult += `\n_Total: ${dirs.length} folders and ${files.length} files_`
            } else {
              formattedResult = 'I found the following items:\n\n' + JSON.stringify(result, null, 2)
            }
          } else {
            formattedResult = 'Directory contents:\n\n' + JSON.stringify(result, null, 2)
          }
        } else if (toolCall.tool.includes('read_file') || toolCall.tool.includes('read_text')) {
          // Format file reading results
          if (result.content && Array.isArray(result.content)) {
            const textContent = result.content.find(c => c.type === 'text')
            if (textContent && textContent.text) {
              const fileName = toolCall.parameters?.path || 'the file'
              formattedResult = `Here's the content of ${fileName}:\n\n\`\`\`\n${textContent.text}\n\`\`\``
            } else {
              formattedResult = 'File content:\n\n' + JSON.stringify(result, null, 2)
            }
          } else {
            formattedResult = result
          }
        } else if (toolCall.tool.includes('write_file') || toolCall.tool.includes('edit_file')) {
          // Format file writing/editing results
          formattedResult = '✅ File operation completed successfully.'
          if (toolCall.parameters?.path) {
            formattedResult = `✅ Successfully updated ${toolCall.parameters.path}`
          }
        } else if (toolCall.tool.includes('search')) {
          // Format search results
          if (result.content && Array.isArray(result.content)) {
            const textContent = result.content.find(c => c.type === 'text')
            if (textContent && textContent.text) {
              formattedResult = `Search results:\n\n${textContent.text}`
            } else {
              formattedResult = 'Search completed.'
            }
          } else {
            formattedResult = result
          }
        } else if (result.content && Array.isArray(result.content)) {
          // Generic MCP tool response with content array
          const textParts = result.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
          formattedResult = textParts.join('\n\n')
        } else if (typeof result === 'string') {
          formattedResult = result
        } else {
          // Fallback to JSON for complex objects
          formattedResult = JSON.stringify(result, null, 2)
        }
        
        // Return the elegantly formatted result
        return response.replace(toolCallMatch[0], formattedResult)
      }
    } catch (error) {
      console.error('[LLMManager] Tool execution failed:', error)
    }
    
    return response || ''
  }

  async chatWithOllama(model, messages, options = {}) {
    const { chatWithOllama } = await import('./ollama.js')
    
    return await chatWithOllama(
      model.parameters.modelName,
      messages,
      {
        temperature: model.parameters.temperature,
        max_tokens: model.parameters.maxTokens,
        onStream: options.onStream
      }
    )
  }
  
  async chatWithLMStudio(model, messages) {
    const lmstudio = await import('./lmstudio.js')
    
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
    const { chatWithClaude } = await import('../../electron-ui/src/services/claude.js')
    
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
  
  /**
   * Set the personId for a model (used by AIAssistantModel)
   */
  setModelPersonId(modelId, personId) {
    const model = this.models.get(modelId)
    if (model) {
      model.personId = personId
      console.log(`[LLMManager] Set personId for ${modelId}: ${personId?.toString().substring(0, 8)}...`)
    }
  }
  
  /**
   * Check if a personId belongs to an AI model
   */
  isAIPersonId(personId) {
    const personIdStr = personId?.toString()
    if (!personIdStr) return false
    
    for (const model of this.models.values()) {
      if (model.personId?.toString() === personIdStr) {
        return true
      }
    }
    return false
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

  /**
   * Test a Claude API key
   */
  async testClaudeApiKey(apiKey) {
    try {
      // Make a minimal API call to test the key
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      })
      
      return response.ok
    } catch (error) {
      console.error('[LLMManager] Claude API key test failed:', error)
      return false
    }
  }

  /**
   * Test an OpenAI API key
   */
  async testOpenAIApiKey(apiKey) {
    try {
      // Make a minimal API call to test the key
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })
      
      return response.ok
    } catch (error) {
      console.error('[LLMManager] OpenAI API key test failed:', error)
      return false
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

export default new LLMManager()