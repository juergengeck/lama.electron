/**
 * Node.js ONE.CORE Instance - REAL IMPLEMENTATION
 * Full storage with Node.js platform capabilities
 */

const path = require('path')
const fs = require('fs').promises

// ONE.CORE imports will be loaded dynamically in initialize()

class NodeOneInstance {
  constructor() {
    this.instance = null
    this.initialized = false
    this.user = null
    this.credential = null
  }

  async initialize(user, credential) {
    if (this.initialized) {
      console.log('[NodeOne] Already initialized')
      return
    }
    
    console.log('[NodeOne] Initializing ONE.CORE with Node.js platform...')
    
    try {
      // Load Node.js platform
      await import('@refinio/one.core/lib/system/load-nodejs.js')
      
      // Load ONE.CORE modules dynamically
      const { default: Instance } = await import('@refinio/one.core/lib/instance.js')
      
      // Store user and credential
      this.user = user
      this.credential = credential
      
      // Create instance with full storage
      const dataDir = path.join(process.cwd(), 'one-data-node', user.id)
      
      // Ensure directory exists
      await fs.mkdir(dataDir, { recursive: true })
      
      this.instance = new Instance({
        name: `lama-node-${user.id}`,
        directory: dataDir
      })
      
      await this.instance.init()
      
      // Create initial user object in ONE.CORE
      await this.createUserObject(user)
      
      this.initialized = true
      console.log('[NodeOne] Initialized successfully for user:', user.name)
      
    } catch (error) {
      console.error('[NodeOne] Initialization failed:', error)
      throw error
    }
  }

  async createUserObject(user) {
    try {
      const userObj = {
        type: 'User',
        id: user.id,
        name: user.name,
        email: user.email || `${user.name}@lama.local`,
        createdAt: new Date().toISOString(),
        role: 'owner'
      }
      
      await this.instance.createObject(userObj)
      console.log('[NodeOne] User object created')
      
      // Create default settings
      const settings = {
        type: 'Settings',
        userId: user.id,
        theme: 'dark',
        language: 'en',
        notifications: true
      }
      
      await this.instance.createObject(settings)
      console.log('[NodeOne] Default settings created')
      
    } catch (error) {
      console.error('[NodeOne] Failed to create user objects:', error)
    }
  }

  // State management through ONE.CORE objects
  async setState(path, value) {
    if (!this.instance) {
      throw new Error('Instance not initialized')
    }
    
    try {
      const stateObj = {
        type: 'State',
        path,
        value,
        timestamp: new Date().toISOString(),
        version: Date.now()
      }
      
      await this.instance.createObject(stateObj)
      console.log('[NodeOne] State set:', path)
      
    } catch (error) {
      console.error('[NodeOne] Failed to set state:', error)
      throw error
    }
  }

  async getState(path) {
    if (!this.instance) {
      throw new Error('Instance not initialized')
    }
    
    try {
      // Query for state objects with this path
      const objects = await this.instance.getObjects({
        type: 'State',
        filter: (obj) => obj.path === path
      })
      
      if (objects.length > 0) {
        // Get most recent
        const sorted = objects.sort((a, b) => b.version - a.version)
        return sorted[0].value
      }
      
      return undefined
      
    } catch (error) {
      console.error('[NodeOne] Failed to get state:', error)
      return undefined
    }
  }

  // Message operations
  async createMessage(conversationId, text, metadata = {}) {
    if (!this.instance) {
      throw new Error('Instance not initialized')
    }
    
    try {
      const message = {
        type: 'Message',
        conversationId,
        text,
        timestamp: new Date().toISOString(),
        sender: this.user?.id || 'system',
        ...metadata
      }
      
      const created = await this.instance.createObject(message)
      console.log('[NodeOne] Message created')
      return created
      
    } catch (error) {
      console.error('[NodeOne] Failed to create message:', error)
      throw error
    }
  }

  async getMessages(conversationId, limit = 50, offset = 0) {
    if (!this.instance) {
      throw new Error('Instance not initialized')
    }
    
    try {
      const messages = await this.instance.getObjects({
        type: 'Message',
        filter: (obj) => obj.conversationId === conversationId
      })
      
      // Sort by timestamp
      const sorted = messages.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      
      return sorted.slice(offset, offset + limit)
      
    } catch (error) {
      console.error('[NodeOne] Failed to get messages:', error)
      return []
    }
  }

  // Conversation operations
  async createConversation(type, participants, name) {
    if (!this.instance) {
      throw new Error('Instance not initialized')
    }
    
    try {
      const conversation = {
        type: 'Conversation',
        conversationType: type,
        participants,
        name,
        createdAt: new Date().toISOString(),
        createdBy: this.user?.id || 'system'
      }
      
      const created = await this.instance.createObject(conversation)
      console.log('[NodeOne] Conversation created')
      return created
      
    } catch (error) {
      console.error('[NodeOne] Failed to create conversation:', error)
      throw error
    }
  }

  async getConversations(limit = 20, offset = 0) {
    if (!this.instance) {
      throw new Error('Instance not initialized')
    }
    
    try {
      const conversations = await this.instance.getObjects({
        type: 'Conversation'
      })
      
      // Sort by creation date
      const sorted = conversations.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      
      return sorted.slice(offset, offset + limit)
      
    } catch (error) {
      console.error('[NodeOne] Failed to get conversations:', error)
      return []
    }
  }

  // File operations (Node.js specific)
  async importFile(filePath) {
    if (!this.instance) {
      throw new Error('Instance not initialized')
    }
    
    try {
      const content = await fs.readFile(filePath)
      const stats = await fs.stat(filePath)
      
      const fileObj = {
        type: 'File',
        name: path.basename(filePath),
        content: content.toString('base64'),
        size: stats.size,
        mimeType: this.getMimeType(filePath),
        importedAt: new Date().toISOString(),
        importedBy: this.user?.id || 'system'
      }
      
      const created = await this.instance.createObject(fileObj)
      console.log('[NodeOne] File imported:', path.basename(filePath))
      return created
      
    } catch (error) {
      console.error('[NodeOne] Failed to import file:', error)
      throw error
    }
  }

  async exportFile(fileHash, outputPath) {
    if (!this.instance) {
      throw new Error('Instance not initialized')
    }
    
    try {
      const file = await this.instance.getObject(fileHash)
      
      if (!file || file.type !== 'File') {
        throw new Error('File not found')
      }
      
      const content = Buffer.from(file.content, 'base64')
      await fs.writeFile(outputPath, content)
      
      console.log('[NodeOne] File exported:', outputPath)
      return outputPath
      
    } catch (error) {
      console.error('[NodeOne] Failed to export file:', error)
      throw error
    }
  }

  // LLM operations (placeholder for worker integration)
  async runLLMInference(prompt, options = {}) {
    console.log('[NodeOne] LLM inference requested:', prompt.substring(0, 50) + '...')
    
    // Store request
    await this.setState('llm.lastRequest', {
      prompt,
      options,
      timestamp: new Date().toISOString()
    })
    
    // In real implementation, this would use a worker process
    const mockResponse = {
      text: `Response to: ${prompt.substring(0, 30)}...`,
      model: options.model || 'default',
      timestamp: new Date().toISOString()
    }
    
    // Store response
    await this.setState('llm.lastResponse', mockResponse)
    
    return mockResponse
  }

  // Helper methods
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes = {
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.png': 'image/png',
      '.json': 'application/json',
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.md': 'text/markdown'
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }

  // Get instance for direct access
  getInstance() {
    return this.instance
  }

  // Get user
  getUser() {
    return this.user
  }

  // Check if initialized
  isInitialized() {
    return this.initialized
  }

  // Shutdown
  async shutdown() {
    console.log('[NodeOne] Shutting down...')
    
    if (this.instance) {
      await this.instance.shutdown()
    }
    
    this.initialized = false
    this.user = null
    this.credential = null
    
    console.log('[NodeOne] Shutdown complete')
  }
}

// Export singleton
module.exports = new NodeOneInstance()