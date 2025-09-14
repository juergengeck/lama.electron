/**
 * Ollama Integration Service
 * Detects and manages locally available Ollama models
 */
/**
 * Check if Ollama is running locally
 */
export async function isOllamaRunning() {
    try {
        const response = await fetch('http://localhost:11434/api/tags', {
            method: 'GET',
            // Add timeout to avoid hanging
            signal: AbortSignal.timeout(3000)
        });
        return response.ok;
    }
    catch (error) {
        // Don't log connection errors - they're expected when Ollama isn't running
        // Only log unexpected errors
        if (error.name !== 'TypeError' && !error.message.includes('Failed to fetch')) {
            console.warn('[Ollama] Unexpected error checking service:', error.message);
        }
        return false;
    }
}
/**
 * Get list of locally available Ollama models
 */
export async function getLocalOllamaModels() {
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.statusText}`);
        }
        const data = await response.json();
        return data.models || [];
    }
    catch (error) {
        console.error('[Ollama] Failed to fetch local models:', error);
        return [];
    }
}
/**
 * Parse Ollama model information into user-friendly format
 * Don't hardcode model patterns - use what Ollama provides
 */
export function parseOllamaModel(model) {
    const sizeGB = (model.size / 1e9).toFixed(1);
    // Use actual model name and details from Ollama
    const displayName = model.name;
    const parameterSize = model.details?.parameter_size || extractModelSize(model.name) || 'Unknown';
    // Detect capabilities based on model name
    const capabilities = ['chat', 'completion'];
    const nameLower = model.name.toLowerCase();
    if (nameLower.includes('code') || nameLower.includes('coder')) {
        capabilities.push('code', 'code-completion');
    }
    // Build description from model details
    const family = model.details?.family || model.details?.families?.[0] || '';
    const format = model.details?.format || '';
    const quantization = model.details?.quantization_level || '';
    let description = 'Locally available Ollama model';
    if (family) {
        description = `${family.toUpperCase()} model`;
        if (quantization) {
            description += ` (${quantization})`;
        }
    }
    // Default context length
    const contextLength = 8192;
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
    };
}
/**
 * Extract model size from name (e.g., "7b", "13b", "70b")
 */
function extractModelSize(name) {
    const match = name.match(/(\d+\.?\d*)[bB]/);
    if (match) {
        const size = parseFloat(match[1]);
        if (size < 1) {
            return `${Math.round(size * 1000)}M`;
        }
        return `${size}B`;
    }
    // Check for millions
    const millionMatch = name.match(/(\d+)[mM]/);
    if (millionMatch) {
        return `${millionMatch[1]}M`;
    }
    return '';
}
/**
 * Test connection to an Ollama model
 */
export async function testOllamaModel(modelName) {
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
        });
        if (!response.ok) {
            console.error(`[Ollama] Model test failed: ${response.statusText}`);
            return false;
        }
        const data = await response.json();
        console.log(`[Ollama] Model ${modelName} test successful:`, data.response);
        return true;
    }
    catch (error) {
        console.error(`[Ollama] Failed to test model ${modelName}:`, error);
        return false;
    }
}
/**
 * Generate response using Ollama
 */
export async function generateWithOllama(modelName, prompt, options) {
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
        });
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }
        const data = await response.json();
        return data.response;
    }
    catch (error) {
        console.error('[Ollama] Generation failed:', error);
        throw error;
    }
}
/**
 * Chat with Ollama using conversation history
 */
export async function chatWithOllama(modelName, messages, options) {
    const startTime = performance.now();
    try {
        console.log(`[PERF] 🚀 Starting Ollama chat request with model: ${modelName}`);
        const fetchStart = performance.now();
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
        });
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }
        console.log(`[PERF] ⏱️ Ollama first byte time: ${(performance.now() - fetchStart).toFixed(2)}ms`);
        // Process streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let thinkingContent = '';
        let isInThinking = false;
        if (!reader) {
            throw new Error('No response body reader available');
        }
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim());
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.message?.content) {
                        const content = data.message.content;
                        // Detect thinking/reasoning blocks (DeepSeek R1 style)
                        if (content.includes('<think>') || content.includes('<thinking>')) {
                            isInThinking = true;
                        }
                        if (content.includes('</think>') || content.includes('</thinking>')) {
                            isInThinking = false;
                        }
                        if (isInThinking) {
                            thinkingContent += content;
                            options?.onStream?.(content, true);
                        }
                        else {
                            fullContent += content;
                            options?.onStream?.(content, false);
                        }
                    }
                }
                catch (e) {
                    // Skip invalid JSON lines
                }
            }
        }
        const totalTime = performance.now() - startTime;
        console.log(`[PERF] ✅ Total Ollama streaming time: ${totalTime.toFixed(2)}ms`);
        // Return the full response (excluding thinking content)
        return fullContent || thinkingContent; // Fallback to thinking if no main content
    }
    catch (error) {
        console.error('[Ollama] Chat failed:', error);
        throw error;
    }
}
/**
 * Pull a model from Ollama library
 */
export async function pullOllamaModel(modelName) {
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
        });
        if (!response.ok) {
            throw new Error(`Failed to pull model: ${response.statusText}`);
        }
        console.log(`[Ollama] Successfully pulled model: ${modelName}`);
    }
    catch (error) {
        console.error(`[Ollama] Failed to pull model ${modelName}:`, error);
        throw error;
    }
}
