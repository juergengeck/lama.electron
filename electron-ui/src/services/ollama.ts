/**
 * Ollama Integration Service
 * Detects and manages locally available Ollama models
 */

export interface OllamaModel {
  name: string
  size: number
  digest: string
  modified_at: string
  details?: {
    format: string
    family: string
    parameter_size: string
    quantization_level: string
  }
}

export interface OllamaModelInfo {
  id: string
  name: string
  displayName: string
  size: string
  description: string
  capabilities: string[]
  contextLength: number
  parameterSize: string
}

/**
 * Check if Ollama is running locally
 */
export async function isOllamaRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags')
    return response.ok
  } catch (error) {
    console.log('[Ollama] Service not running on localhost:11434')
    return false
  }
}

/**
 * Get list of locally available Ollama models
 */
export async function getLocalOllamaModels(): Promise<OllamaModel[]> {
  try {
    const response = await fetch('http://localhost:11434/api/tags')
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`)
    }

    const data = await response.json() as { models?: OllamaModel[] }
    return data.models || []
  } catch (error) {
    console.error('[Ollama] Failed to fetch local models:', error)
    return []
  }
}

/**
 * Parse Ollama model information into user-friendly format
 * Don't hardcode model patterns - use what Ollama provides
 */
export function parseOllamaModel(model: OllamaModel): OllamaModelInfo {
  const sizeGB = (model.size / 1e9).toFixed(1)
  
  // Use actual model name and details from Ollama
  const displayName = model.name
  const parameterSize = model.details?.parameter_size || extractModelSize(model.name) || 'Unknown'
  
  // Detect capabilities based on model name
  const capabilities = ['chat', 'completion']
  const nameLower = model.name.toLowerCase()
  if (nameLower.includes('code') || nameLower.includes('coder')) {
    capabilities.push('code', 'code-completion')
  }
  
  // Build description from model details
  const family = model.details?.family || ''
  const format = model.details?.format || ''
  const quantization = model.details?.quantization_level || ''
  
  let description = 'Locally available Ollama model'
  if (family) {
    description = `${family.toUpperCase()} model`
    if (quantization) {
      description += ` (${quantization})`
    }
  }
  
  // Default context length
  const contextLength = 8192
  
  // Return the parsed model info
  return {
    id: model.name,
    name: model.name,
    displayName,
    size: `${sizeGB} GB`,
    description,
    capabilities,
    contextLength,
    parameterSize
  }
}

/**
 * Extract model size from name (e.g., "7b", "13b", "70b")
 */
function extractModelSize(name: string): string {
  const match = name.match(/(\d+\.?\d*)[bB]/);
  if (match) {
    const size = parseFloat(match[1])
    if (size < 1) {
      return `${Math.round(size * 1000)}M`
    }
    return `${size}B`
  }
  
  // Check for millions
  const millionMatch = name.match(/(\d+)[mM]/)
  if (millionMatch) {
    return `${millionMatch[1]}M`
  }
  
  return ''
}

/**
 * Test connection to an Ollama model
 */
export async function testOllamaModel(modelName: string): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        prompt: 'Say "Hello"',
        stream: false,
        options: {
          num_predict: 5
        }
      })
    })
    
    if (!response.ok) {
      console.error(`[Ollama] Model test failed: ${response.statusText}`)
      return false
    }
    
    const data = await response.json() as { response?: string }
    console.log(`[Ollama] Model ${modelName} test successful:`, data.response)
    return true
  } catch (error) {
    console.error(`[Ollama] Failed to test model ${modelName}:`, error)
    return false
  }
}

/**
 * Generate response using Ollama
 */
export async function generateWithOllama(
  modelName: string, 
  prompt: string,
  options?: {
    temperature?: number
    max_tokens?: number
    system?: string
  }
): Promise<string> {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        prompt: options?.system ? `${options.system}\n\n${prompt}` : prompt,
        stream: false,
        options: {
          temperature: options?.temperature || 0.7,
          num_predict: options?.max_tokens || 1024
        }
      })
    })
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }
    
    const data = await response.json() as { response?: string }
    return data.response || ''
  } catch (error) {
    console.error('[Ollama] Generation failed:', error)
    throw error
  }
}

/**
 * Chat with Ollama using conversation history
 */
export async function chatWithOllama(
  modelName: string,
  messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>,
  options?: {
    temperature?: number
    max_tokens?: number
    onStream?: (chunk: string, isThinking?: boolean) => void
  }
): Promise<string> {
  const startTime = performance.now()
  
  try {
    console.log(`[PERF] 🚀 Starting Ollama chat request with model: ${modelName}`)
    
    const fetchStart = performance.now()
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: messages,
        stream: true, // Enable streaming for faster perceived response
        options: {
          temperature: options?.temperature || 0.7,
          num_predict: options?.max_tokens || 1024
        }
      })
    })
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }
    
    console.log(`[PERF] ⏱️ Ollama first byte time: ${(performance.now() - fetchStart).toFixed(2)}ms`)
    
    // Process streaming response
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''
    let thinkingContent = ''
    let isInThinking = false
    
    if (!reader) {
      throw new Error('No response body reader available')
    }
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line)
          if (data.message?.content) {
            const content = data.message.content
            
            // Detect thinking/reasoning blocks (DeepSeek R1 style)
            if (content.includes('<think>') || content.includes('<thinking>')) {
              isInThinking = true
            }
            if (content.includes('</think>') || content.includes('</thinking>')) {
              isInThinking = false
            }
            
            if (isInThinking) {
              thinkingContent += content
              options?.onStream?.(content, true)
            } else {
              fullContent += content
              options?.onStream?.(content, false)
            }
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    }
    
    const totalTime = performance.now() - startTime
    console.log(`[PERF] ✅ Total Ollama streaming time: ${totalTime.toFixed(2)}ms`)
    
    // Return the full response (excluding thinking content)
    return fullContent || thinkingContent // Fallback to thinking if no main content
  } catch (error) {
    console.error('[Ollama] Chat failed:', error)
    throw error
  }
}

/**
 * Pull a model from Ollama library
 */
export async function pullOllamaModel(modelName: string): Promise<void> {
  try {
    const response = await fetch('http://localhost:11434/api/pull', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: modelName,
        stream: false
      })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`)
    }
    
    console.log(`[Ollama] Successfully pulled model: ${modelName}`)
  } catch (error) {
    console.error(`[Ollama] Failed to pull model ${modelName}:`, error)
    throw error
  }
}