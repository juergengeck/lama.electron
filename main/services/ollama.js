/**
 * Ollama Integration Service for Main Process
 * Handles communication with local Ollama instance
 */

import fetch from 'node-fetch'
// AbortController is built into Node.js since v15.0.0, no import needed

// Track active requests with AbortControllers
const activeRequests = new Map()

// Generate unique request ID
let requestCounter = 0
function getRequestId() {
  return `ollama-${Date.now()}-${++requestCounter}`
}

/**
 * Cancel all active Ollama requests
 */
export function cancelAllOllamaRequests() {
  console.log(`[Ollama] Cancelling ${activeRequests.size} active requests`)
  for (const [id, controller] of activeRequests) {
    try {
      controller.abort()
      console.log(`[Ollama] Cancelled request ${id}`)
    } catch (error) {
      console.error(`[Ollama] Error cancelling request ${id}:`, error)
    }
  }
  activeRequests.clear()
}

/**
 * Check if Ollama is running
 */
async function isOllamaRunning() {
  try {
    const response = await fetch('http://localhost:11434/api/tags')
    return response.ok
  } catch (error) {
    console.log('[Ollama] Service not running on localhost:11434')
    return false
  }
}

/**
 * Test if a specific Ollama model is available
 */
async function testOllamaModel(modelName) {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: 'test',
        stream: false,
        options: {
          num_predict: 1
        }
      })
    })
    
    return response.ok
  } catch (error) {
    console.error(`[Ollama] Model ${modelName} test failed:`, error)
    return false
  }
}

/**
 * Chat with Ollama
 */
async function chatWithOllama(modelName, messages, options = {}) {
  const requestId = getRequestId()
  const controller = new AbortController()
  
  // Track this request
  activeRequests.set(requestId, controller)
  console.log(`[Ollama] Starting request ${requestId}`)
  
  try {
    console.log(`[Ollama] Chatting with ${modelName}, ${messages.length} messages`)
    
    // Convert messages to Ollama format - preserve system message + recent messages
    const systemMessages = messages.filter(msg => msg.role === 'system')
    const nonSystemMessages = messages.filter(msg => msg.role !== 'system')
    const recentNonSystemMessages = nonSystemMessages.slice(-8) // Last 8 user/assistant messages
    const recentMessages = [...systemMessages, ...recentNonSystemMessages] // Include all system messages
    
    console.log(`[Ollama] Total messages: ${messages.length}, System messages: ${systemMessages.length}, Recent messages: ${recentMessages.length}`)
    console.log(`[Ollama] System message preview:`, systemMessages[0]?.content?.substring(0, 200) + '...')
    const prompt = recentMessages.map(msg => {
      if (msg.role === 'system') return `System: ${msg.content}`
      if (msg.role === 'assistant') return `Assistant: ${msg.content}`
      return `User: ${msg.content}`
    }).join('\n') + '\nAssistant:'
    
    console.log(`[Ollama] Sending prompt (${prompt.length} chars)`)
    console.log(`[Ollama] Prompt preview:`, prompt.substring(0, 500) + '...')
    
    const startTime = Date.now()
    console.log(`[Ollama] ⏱️ Starting API call at ${new Date().toISOString()} with streaming`)
    
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,  // Add abort signal
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        stream: true,  // Enable streaming for faster response
        options: {
          temperature: options.temperature || 0.1,  // Lower temp for more deterministic tool use
          num_predict: options.max_tokens || 2048,   // Default token limit
          top_k: 10,                                // Reduce search space
          top_p: 0.9                                // Focus on likely tokens
        }
      })
    })
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }
    
    // Process streaming response - node-fetch v2 compatibility
    let fullResponse = ''
    let firstChunkTime = null
    let buffer = ''
    
    // For node-fetch v2, we need to handle the stream differently
    response.body.on('data', (chunk) => {
      if (!firstChunkTime) {
        firstChunkTime = Date.now()
        console.log(`[Ollama] ⏱️ First chunk received in ${firstChunkTime - startTime}ms`)
      }
      
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (!line.trim()) continue
        
        try {
          const json = JSON.parse(line)
          if (json.response) {
            fullResponse += json.response
            
            // Stream to callback if provided
            if (options.onStream) {
              options.onStream(json.response, false)
            }
          }
        } catch (e) {
          console.error('[Ollama] Error parsing JSON line:', e.message, 'Line:', line)
        }
      }
    })
    
    // Wait for the stream to finish
    await new Promise((resolve, reject) => {
      response.body.on('end', resolve)
      response.body.on('error', reject)
    })
    
    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer)
        if (json.response) {
          fullResponse += json.response
          if (options.onStream) {
            options.onStream(json.response, false)
          }
        }
      } catch (e) {
        console.error('[Ollama] Error parsing final JSON:', e.message)
      }
    }
    
    const responseTime = Date.now() - startTime
    console.log(`[Ollama] ⏱️ Full response completed in ${responseTime}ms`)
    
    // Handle empty response
    if (!fullResponse || fullResponse === '') {
      console.log('[Ollama] WARNING: No response generated')
      fullResponse = "I apologize, but I could not generate a response."
    } else {
      console.log(`[Ollama] Got response: ${fullResponse.substring(0, 100)}...`)
    }
    
    // Clean up request tracking
    activeRequests.delete(requestId)
    console.log(`[Ollama] Completed request ${requestId}`)
    
    return fullResponse
  } catch (error) {
    console.error(`[Ollama] Chat error for request ${requestId}:`, error)
    
    // Clean up on error
    activeRequests.delete(requestId)
    
    // Handle abort
    if (error.name === 'AbortError') {
      console.log(`[Ollama] Request ${requestId} was aborted`)
      throw new Error('Request was cancelled')
    }
    
    // Fallback response if Ollama is not available
    if (error.message.includes('ECONNREFUSED')) {
      return "I'm sorry, but I can't connect to the Ollama service. Please make sure Ollama is running on your system (http://localhost:11434). You can start it with 'ollama serve' in your terminal."
    }
    
    throw error
  }
}

/**
 * Generate completion with Ollama
 */
async function generateWithOllama(modelName, prompt, options = {}) {
  return chatWithOllama(modelName, [{ role: 'user', content: prompt }], options)
}

export {
  isOllamaRunning,
  testOllamaModel,
  chatWithOllama,
  generateWithOllama
}