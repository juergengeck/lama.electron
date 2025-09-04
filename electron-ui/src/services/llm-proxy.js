/**
 * LLM Proxy Service
 * Proxies LLM calls from renderer to main process via IPC
 */
export class LLMProxy {
    constructor() {
        Object.defineProperty(this, "ipcRenderer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Get IPC renderer from window object (injected by preload)
        this.ipcRenderer = window.electronAPI;
    }
    async chat(messages, modelId) {
        console.log('[LLMProxy] Sending chat to main process, messages:', messages.length);
        const result = await this.ipcRenderer.invoke('ai:chat', {
            messages,
            modelId
        });
        console.log('[LLMProxy] Got result from main process:', result);
        if (!result.success) {
            throw new Error(result.error || 'Chat failed');
        }
        const response = result.data.response;
        console.log('[LLMProxy] Returning response:', response?.substring(0, 100) + '...');
        return response;
    }
    async getModels() {
        const result = await this.ipcRenderer.invoke('ai:getModels');
        if (!result.success) {
            throw new Error(result.error || 'Failed to get models');
        }
        return result.data;
    }
    async setDefaultModel(modelId) {
        const result = await this.ipcRenderer.invoke('ai:setDefaultModel', { modelId });
        if (!result.success) {
            throw new Error(result.error || 'Failed to set default model');
        }
        return result.data;
    }
    async setApiKey(provider, apiKey) {
        const result = await this.ipcRenderer.invoke('ai:setApiKey', { provider, apiKey });
        if (!result.success) {
            throw new Error(result.error || 'Failed to set API key');
        }
        return result.data;
    }
    async getTools() {
        const result = await this.ipcRenderer.invoke('ai:getTools');
        if (!result.success) {
            throw new Error(result.error || 'Failed to get tools');
        }
        return result.data;
    }
    async initialize() {
        const result = await this.ipcRenderer.invoke('ai:initialize');
        if (!result.success) {
            throw new Error(result.error || 'Failed to initialize LLM');
        }
        return result.data;
    }
}
export const llmProxy = new LLMProxy();
