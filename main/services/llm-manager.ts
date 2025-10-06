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
function forwardLog(level: any, ...args: any): any {
  try {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('main-process-log', {
        level,
        message: args.join(' '),
        timestamp: Date.now()
      })
    }
  } catch (e: any) {
    // No main window available
  }
}

class LLMManager extends EventEmitter {
  name: any;
  description: any;
  onStream: any;
  match: any;
  length: any;
  substring: any;
  onChatStream: any;
  contextLength: any;
  parameters: any;
  capabilities: any;
  close: any;
  models: Map<string, any>;
  modelSettings: Map<string, any>;
  mcpClients: Map<string, any>;
  mcpTools: Map<string, any>;
  isInitialized: boolean;
  ollamaConfig: any; // Cached Ollama configuration

  constructor() {

    super()
    this.models = new Map()
    this.modelSettings = new Map()
    this.mcpClients = new Map()
    this.mcpTools = new Map()
    this.isInitialized = false
    this.ollamaConfig = null

    // Methods are already bound as class methods, no need for explicit binding
}

  /**
   * Load active Ollama configuration from ONE.core
   */
  async loadOllamaConfig(): Promise<any> {
    try {
      const { handleGetOllamaConfig } = await import('../ipc/handlers/llm-config.js')
      const response: any = await handleGetOllamaConfig({} as any, {})

      if (response.success && response.config) {
        this.ollamaConfig = response.config
        console.log('[LLMManager] Loaded Ollama config:', {
          modelType: this.ollamaConfig.modelType,
          baseUrl: this.ollamaConfig.baseUrl,
          hasAuth: this.ollamaConfig.hasAuthToken
        })
        return this.ollamaConfig
      } else {
        // No config found, use localhost default
        this.ollamaConfig = {
          modelType: 'local',
          baseUrl: 'http://localhost:11434',
          authType: 'none',
          hasAuthToken: false
        }
        console.log('[LLMManager] No Ollama config found, using localhost default')
        return this.ollamaConfig
      }
    } catch (error: any) {
      console.error('[LLMManager] Failed to load Ollama config:', error)
      // Fallback to localhost
      this.ollamaConfig = {
        modelType: 'local',
        baseUrl: 'http://localhost:11434',
        authType: 'none',
        hasAuthToken: false
      }
      return this.ollamaConfig
    }
  }

  /**
   * Get Ollama base URL from config
   */
  getOllamaBaseUrl(): string {
    return this.ollamaConfig?.baseUrl || 'http://localhost:11434'
  }

  /**
   * Get auth headers if authentication is configured
   */
  async getOllamaAuthHeaders(): Promise<Record<string, string> | undefined> {
    if (!this.ollamaConfig?.hasAuthToken) {
      return undefined
    }

    try {
      // If auth is configured, we need to decrypt the token
      // For now, return undefined - actual decryption would happen in the IPC handler
      // This is handled by the ollama service when making requests
      return undefined
    } catch (error: any) {
      console.error('[LLMManager] Failed to get auth headers:', error)
      return undefined
    }
  }

  /**
   * Pre-warm the LLM connection to reduce cold start delays
   */
  async preWarmConnection(): Promise<any> {
    console.log('[LLMManager] Pre-warming LLM connection...')
    try {
      // Get Ollama base URL from config
      const baseUrl = this.getOllamaBaseUrl()
      const authHeaders = await this.getOllamaAuthHeaders()

      // Send a minimal ping to Ollama to establish connection
      // Use first available model for pre-warming
      const modelToWarm = Array.from(this.models.keys())[0] || 'llama3.2:latest'

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(authHeaders || {})
      }

      const response: any = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelToWarm,
          prompt: 'Hi',
          stream: false,
          options: {
            num_predict: 1 // Generate minimal response
          }
        })
      })

      if (response.ok) {
        console.log('[LLMManager] ✅ LLM connection pre-warmed successfully to', baseUrl)
      } else {
        console.log('[LLMManager] Pre-warm response not OK:', response.status)
      }
    } catch (err: any) {
      console.log('[LLMManager] Pre-warm connection error:', err.message)
    }
  }

  async init(): Promise<any> {
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

      // Load Ollama network configuration
      await this.loadOllamaConfig()

      // Load saved settings
      await this.loadSettings()

      // Register available models
      await this.registerModels()

      // Initialize MCP servers
      await this.initializeMCP()

      this.isInitialized = true
      console.log('[LLMManager] Initialized successfully with MCP support')

      // Pre-warm LLM connection in background (don't await)
      this.preWarmConnection().catch(err => {
        console.log('[LLMManager] Pre-warm failed (non-critical):', err.message)
      })

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

  async registerModels(): Promise<any> {
    // Check for LM Studio availability (optional)
    try {
      const lmstudio: any = await import('./lmstudio.js');
      const isLMStudioAvailable: any = await lmstudio.isLMStudioRunning()

      if (isLMStudioAvailable) {
        console.log('[LLMManager] LM Studio is available')
        const lmStudioModels: any = await lmstudio.getAvailableModels()

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
      console.log('[LLMManager] LM Studio not available:', (error as Error).message)
    }

    // Discover Ollama models dynamically
    await this.discoverOllamaModels()

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

    // No default model concept in LLM manager
    console.log(`[LLMManager] ${this.models.size} models registered`)
  }

  async discoverOllamaModels(): Promise<any> {
    try {
      const { getLocalOllamaModels, parseOllamaModel } = await import('../../electron-ui/src/services/ollama.js')
      const ollamaModels: any = await getLocalOllamaModels()

      if (ollamaModels.length > 0) {
        console.log(`[LLMManager] Discovered ${ollamaModels.length} Ollama models`)

        for (const rawModel of ollamaModels) {
          const parsedModel = parseOllamaModel(rawModel)

          // Register the base model
          this.models.set(parsedModel.id, {
            id: parsedModel.id,
            name: parsedModel.displayName,
            provider: 'ollama',
            description: `${parsedModel.description} (${parsedModel.size})`,
            capabilities: ['chat', 'completion'],
            contextLength: 8192,
            parameters: {
              modelName: parsedModel.name, // The actual Ollama model name
              temperature: 0.7,
              maxTokens: 2048
            }
          })

          console.log(`[LLMManager] Registered Ollama model: ${parsedModel.id}`)
        }
      } else {
        console.log('[LLMManager] No Ollama models found')
      }
    } catch (error) {
      console.log('[LLMManager] Failed to discover Ollama models:', (error as Error).message)
    }
  }

  async initializeMCP(): Promise<any> {
    console.log('[LLMManager] Initializing MCP servers...')
    
    try {
      // Initialize MCP Manager
      await mcpManager.init()
      
      // Sync tools from MCP Manager
      const tools = mcpManager.getAvailableTools()
      this.mcpTools.clear()
      
      const registeredTools = []
      for (const tool of tools) {
        this.mcpTools.set(tool.fullName || tool.name, tool)
        registeredTools.push(tool.fullName || tool.name)
      }
      // Log all tools at once instead of individually
      if (registeredTools.length > 0) {
        console.log(`[LLMManager] Registered ${registeredTools.length} MCP tools`)
      }
      
      console.log(`[LLMManager] MCP initialized with ${this.mcpTools.size} tools`)
    } catch (error) {
      console.warn('[LLMManager] MCP initialization failed (non-critical):', error)
      // Continue without MCP - LLM can still work
    }
  }

  async startLamaMCPServer(): Promise<any> {
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
      const tools: any = await client.listTools()
      if (tools.tools) {
        tools.tools.forEach((tool: any) => {
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

  async chat(messages: any, modelId: any, options: any = {}): Promise<unknown> {
    // modelId is required - no default
    if (!modelId) {
      throw new Error('Model ID is required for chat')
    }
    const effectiveModelId = modelId
    const model = this.models.get(effectiveModelId)
    if (!model) {
      throw new Error(`Model ${effectiveModelId} not found. Available models: ${Array.from(this.models.keys()).join(', ')}`)
    }

    console.log(`[LLMManager] Chat with ${(model as any).id} (${messages.length} messages), ${this.mcpTools.size} MCP tools available`)
    console.log(`[LLMManager] ABOUT TO ENHANCE MESSAGES`)
    
    // Add tool descriptions to system message
    const enhancedMessages = this.enhanceMessagesWithTools(messages)
    console.log(`[LLMManager] ENHANCEMENT COMPLETE`)
    
    let response
    
    if ((model as any).provider === 'ollama') {
      response = await this.chatWithOllama(model as any, enhancedMessages, options)
    } else if ((model as any).provider === 'lmstudio') {
      response = await this.chatWithLMStudio(model as any, enhancedMessages, options)
    } else if ((model as any).provider === 'anthropic') {
      response = await this.chatWithClaude(model as any, enhancedMessages, options)
    } else {
      throw new Error(`Unsupported provider: ${(model as any).provider}`)
    }
    
    // Process tool calls if present
    response = await this.processToolCalls(response)
    
    return response
  }

  getToolDescriptions(): any {
    return mcpManager.getToolDescriptions()
  }

  enhanceMessagesWithTools(messages: any): any {
    // Check if this is a simple welcome message request
    const isWelcomeMessage = messages.some((m: any) =>
      m.content && (
        m.content.includes('Generate a welcome message') ||
        m.content.includes('Generate a brief, friendly welcome')
      )
    )

    // Skip tool enhancement for welcome messages
    if (isWelcomeMessage) {
      console.log(`[LLMManager] Skipping tool enhancement for welcome message`)
      return messages
    }

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
        content: 'You are a private AI assistant with access to all of the owner\'s conversations and filesystem tools. You can help with any topic across all chats.' + toolDescriptions
      })
      console.log(`[LLMManager] Added new system message with tools`)
    }

    console.log(`[LLMManager] Enhanced messages count: ${enhanced.length}, first message preview: ${enhanced[0]?.content?.substring(0, 200)}...`)
    return enhanced
  }

  async processToolCalls(response: any): Promise<any> {
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
        
        const result: any = await mcpManager.executeTool(
          toolCall.tool,
          toolCall.parameters || {}
        )
        
        console.log('[LLMManager] Tool execution result:', JSON.stringify(result).substring(0, 200))
        
        // Format the result based on tool type with elegant, natural language
        let formattedResult = ''
        
        if (toolCall.tool === 'filesystem:list_directory') {
          // Parse and format directory listing elegantly
          if (result.content && Array.isArray(result.content)) {
            const textContent = result.content.find((c: any) => c.type === 'text')
            if (textContent && textContent.text) {
              // Parse the directory listing and format it nicely
              const lines = textContent.text.split('\n').filter((line: any) => line.trim())
              const dirs: string[] = []
              const files: string[] = []
              
              lines.forEach((line: any) => {
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
            const textContent = result.content.find((c: any) => c.type === 'text')
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
            const textContent = result.content.find((c: any) => c.type === 'text')
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
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
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

  async chatWithOllama(model: any, messages: any, options: any = {}): Promise<unknown> {
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
  
  /**
   * Chat with response and topic analysis in a single LLM call
   * Returns response immediately and processes analysis in background
   */
  async chatWithAnalysis(messages: any, modelId = null, options: any = {}, topicId?: string): Promise<unknown> {
    const startTime = Date.now()

    try {
      if (!modelId) {
        throw new Error('Model ID is required for chatWithAnalysis')
      }
      const model = this.models.get(modelId)
      if (!model) {
        throw new Error('No model available')
      }

      console.log(`[LLMManager] Chat with analysis using ${model.id}, topicId: ${topicId}`)

      // Build enhanced prompt that requests both response and analysis
      const conversationContext: any[] = messages.slice(-10).map((m: any) =>
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
      ).join('\n')

      const lastUserMessage = messages[messages.length - 1]?.content || ''

      const analysisPrompt = `You are LAMA, a private AI assistant with access to all owner's conversations. Respond to the user naturally, then provide analysis.

Recent conversation:
${conversationContext}

Provide your response in this exact format:
[RESPONSE]
Your natural response to the user here
[/RESPONSE]

[ANALYSIS]
subject: subject-name | description of what this subject is about
subject_keywords: keyword1, keyword2, keyword3 (2-5 keywords that DEFINE this subject)
is_new_subject: yes/no (whether this is a new subject not previously discussed)
summary_update: brief update about how this message changes the conversation summary (or "none" if no update needed)
[/ANALYSIS]

IMPORTANT RULES:
- Every message MUST relate to a subject
- The subject_keywords are the ONLY keywords - they define what this subject is about
- Keywords can ONLY exist as part of a subject - no orphan keywords
- If the message is about the same subject as recent replies, use the same subject name and keywords
- Even short messages have a subject (e.g., "ok" continues the current subject)
- Your response should be natural and helpful
- Identify which subject this reply is discussing (same as before or new)`

      // Replace the last message with our enhanced prompt
      const enhancedMessages = [
        ...messages.slice(0, -1),
        { role: 'user', content: analysisPrompt }
      ]

      // Track what we've streamed to avoid duplicates
      let streamedLength = 0
      let fullResponse = ''

      // Get response with streaming if requested
      const response: any = await this.chat(enhancedMessages, modelId, {
        ...options,
        onStream: options.onStream ? (chunk: any) => {
          fullResponse += chunk

          // Extract just the response part for streaming
          const responseMatch = String(fullResponse).match(/\[RESPONSE\]([\s\S]*?)(?:\[\/RESPONSE\]|$)/)
          if (responseMatch) {
            const responseText = responseMatch[1]
            // Only stream new content
            if (responseText.length > streamedLength) {
              const newContent = String(responseText).substring(streamedLength)
              streamedLength = responseText.length
              // Stream the new content unless it contains analysis markers
              if (!newContent.includes('[/RESPONSE]') && !newContent.includes('[ANALYSIS]')) {
                options.onStream(newContent)
              }
            }
          }
        } : undefined
      })

      // Parse response and analysis
      const responseMatch = String(response).match(/\[RESPONSE\]([\s\S]*?)\[\/RESPONSE\]/)
      const analysisMatch = String(response).match(/\[ANALYSIS\]([\s\S]*?)\[\/ANALYSIS\]/)

      let userResponse = response // Fallback to full response if parsing fails
      let analysis = null

      if (responseMatch) {
        userResponse = responseMatch[1].trim()
      }

      if (analysisMatch) {
        const analysisText = analysisMatch[1].trim()
        const subjectLine = String(analysisText).match(/subject:\s*(.+)/)
        const keywordsLine = String(analysisText).match(/subject_keywords:\s*(.+)/)
        const newSubjectLine = String(analysisText).match(/is_new_subject:\s*(.+)/)
        const summaryUpdateLine = String(analysisText).match(/summary_update:\s*(.+)/)

        analysis = {
          subject: null,
          summaryUpdate: null
        }

        if (subjectLine) {
          const [name, ...descParts] = subjectLine[1].split('|')
          const keywords = keywordsLine
            ? keywordsLine[1].split(',').map(k => k.trim()).filter(k => k && !k.includes('(')) // Remove "(2-5 keywords...)" if LLM included it
            : []

          analysis.subject = {
            name: name.trim(),
            description: descParts.join('|').trim(),
            keywords: keywords, // Keywords now part of subject
            isNew: newSubjectLine ? newSubjectLine[1].trim().toLowerCase() === 'yes' : false
          }
        }

        if (summaryUpdateLine) {
          const updateText = summaryUpdateLine[1].trim()
          if (updateText.toLowerCase() !== 'none') {
            analysis.summaryUpdate = updateText
          }
        }
      }

      console.log(`[LLMManager] Chat with analysis completed in ${Date.now() - startTime}ms`)
      console.log(`[LLMManager] Raw LLM response length: ${response.length}`)
      console.log(`[LLMManager] Raw LLM response preview: ${String(response).substring(0, 200)}...`)
      console.log(`[LLMManager] Extracted user response length: ${userResponse.length}`)
      console.log(`[LLMManager] Extracted user response preview: ${String(userResponse).substring(0, 100)}...`)
      console.log(`[LLMManager] Response match found: ${responseMatch ? 'YES' : 'NO'}`)
      console.log(`[LLMManager] Analysis match found: ${analysisMatch ? 'YES' : 'NO'}`)
      if (analysis?.subject) {
        console.log(`[LLMManager] Subject: ${analysis.subject.name}, keywords: [${analysis.subject.keywords?.join(', ')}], isNew: ${analysis.subject.isNew}, summaryUpdate: ${analysis.summaryUpdate ? 'YES' : 'NO'}`)
      }

      return {
        response: userResponse,
        analysis,
        topicId // Pass topicId through to the caller
      }
    } catch (error) {
      console.error('[LLMManager] Chat with analysis error:', error)
      // Fallback to regular chat if analysis fails
      return {
        response: await this.chat(messages, modelId, options),
        analysis: null,
        topicId
      }
    }
  }

  async chatWithLMStudio(model: any, messages: any, options: any = {}): Promise<any> {
    const lmstudio: any = await import('./lmstudio.js')
    
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

  async chatWithClaude(model: any, messages: any, options: any = {}): Promise<any> {
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

  async loadSettings(): Promise<any> {
    // Runtime settings only - no default model concept here
    console.log('[LLMManager] Loaded runtime settings')
  }

  getStoredApiKey(provider: any): any {
    // Implement secure key storage
    return null
  }

  async setApiKey(provider: any, apiKey: any): Promise<any> {
    // Store API key securely
    console.log(`[LLMManager] API key set for ${provider}`)
  }

  getModels(): any {
    return Array.from(this.models.values())
  }

  getModel(id: any): any {
    return this.models.get(id)
  }

  /**
   * Get available models for external consumers
   */
  getAvailableModels(): any {
    return Array.from(this.models.values()).map((model: any) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      description: model.description,
      contextLength: model.contextLength || 4096,
      maxTokens: model.parameters?.maxTokens || 2048,
      capabilities: model.capabilities || []
    }))
  }
  
  /**
   * Set the personId for a model (used by AIAssistantModel)
   */
  setModelPersonId(modelId: any, personId: any): any {
    const model = this.models.get(modelId)
    if (model) {
      model.personId = personId
      console.log(`[LLMManager] Set personId for ${modelId}: ${personId?.toString().substring(0, 8)}...`)
    }
  }
  
  /**
   * Check if a personId belongs to an AI model
   */
  isAIPersonId(personId: any): any {
    const personIdStr = personId?.toString()
    if (!personIdStr) return false
    
    for (const model of this.models.values()) {
      if (model.personId?.toString() === personIdStr) {
        return true
      }
    }
    return false
  }

  debugToolsState(): any {
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
  async testClaudeApiKey(apiKey: any): Promise<any> {
    try {
      // Make a minimal API call to test the key
      const response: any = await fetch('https://api.anthropic.com/v1/messages', {
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
  async testOpenAIApiKey(apiKey: any): Promise<any> {
    try {
      // Make a minimal API call to test the key
      const response: any = await fetch('https://api.openai.com/v1/models', {
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

  /**
   * Register a -private variant of a model for LAMA conversations
   */
  registerPrivateVariant(modelId: any): any {
    const baseModel = this.models.get(modelId)
    if (!baseModel) {
      console.warn(`[LLMManager] Cannot create private variant - base model ${modelId} not found`)
      return null
    }

    const privateModelId = `${modelId}-private`
    const privateModel = {
      ...baseModel,
      id: privateModelId,
      name: `${baseModel.name}-private`,
      description: `${baseModel.description} (Private for LAMA)`
    }

    this.models.set(privateModelId, privateModel)
    console.log(`[LLMManager] Registered private variant: ${privateModelId}`)
    return privateModelId
  }

  /**
   * Register private variant for LAMA conversations
   * Called by AI assistant when needed
   */
  registerPrivateVariantForModel(modelId: any): any {
    const model = this.models.get(modelId)
    if (!model) {
      throw new Error(`Model ${modelId} not found`)
    }

    this.registerPrivateVariant(modelId)
    console.log(`[LLMManager] Registered private variant for: ${modelId}`)
  }

  async shutdown(): Promise<any> {
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