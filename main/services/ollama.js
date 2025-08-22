/**
 * Ollama Integration Service for Main Process
 * Handles communication with local Ollama instance
 */

const fetch = require('node-fetch')

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
    
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.max_tokens || 512  // Reduce for faster response
        }
      })
    })
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log(`[Ollama] Got response: ${data.response?.substring(0, 100)}...`)
    
    if (options.onStream) {
      // Simulate streaming for compatibility
      const chunks = data.response.split(' ')
      for (const chunk of chunks) {
        options.onStream(chunk + ' ', false)
      }
    }
    
    return data.response || 'I apologize, but I could not generate a response.'
  } catch (error) {
    console.error('[Ollama] Chat error:', error)
    
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

module.exports = {
  isOllamaRunning,
  testOllamaModel,
  chatWithOllama,
  generateWithOllama
}