/**
 * LLM Proxy Service
 * Proxies LLM calls from renderer to main process via IPC
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

declare global {
  interface Window {
    electronAPI: any;
  }
}

export class LLMProxy {
  private ipcRenderer: any

  constructor() {
    // Get IPC renderer from window object (injected by preload)
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.ipcRenderer = window.electronAPI
    }
  }

  async chat(messages: ChatMessage[], modelId?: string): Promise<string> {
    console.log('[LLMProxy] Sending chat to main process, messages:', messages.length)
    
    const result = await this.ipcRenderer.invoke('ai:chat', {
      messages,
      modelId
    })
    
    console.log('[LLMProxy] Got result from main process:', result)
    
    if (!result.success) {
      throw new Error(result.error || 'Chat failed')
    }
    
    const response = result.data.response
    console.log('[LLMProxy] Returning response:', response?.substring(0, 100) + '...')
    return response
  }

  async getModels() {
    const result = await this.ipcRenderer.invoke('ai:getModels')
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get models')
    }
    
    return result.data
  }

  async setDefaultModel(modelId: string) {
    const result = await this.ipcRenderer.invoke('ai:setDefaultModel', { modelId })
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to set default model')
    }
    
    return result.data
  }

  async setApiKey(provider: string, apiKey: string) {
    const result = await this.ipcRenderer.invoke('ai:setApiKey', { provider, apiKey })
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to set API key')
    }
    
    return result.data
  }

  async getTools() {
    const result = await this.ipcRenderer.invoke('ai:getTools')
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get tools')
    }
    
    return result.data
  }

  async initialize() {
    const result = await this.ipcRenderer.invoke('ai:initialize')
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to initialize LLM')
    }
    
    return result.data
  }
}

export const llmProxy = new LLMProxy()