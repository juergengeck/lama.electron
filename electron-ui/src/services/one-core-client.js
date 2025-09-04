/**
 * IPC Client for renderer process
 * Communicates with the main process application
 */
class IPCClient {
    constructor() {
        Object.defineProperty(this, "electronAPI", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        this.electronAPI = window.electronAPI;
        if (!this.electronAPI) {
            console.warn('[IPCClient] electronAPI not available - running in browser mode');
        }
        // Set up event listeners if in Electron
        if (this.electronAPI) {
            this.setupEventListeners();
        }
    }
    setupEventListeners() {
        // Listen for state changes from main process
        window.addEventListener('state:changed', (event) => {
            this.emit('stateChanged', event.detail);
        });
        // Listen for auth events
        window.addEventListener('auth:loginSuccess', (event) => {
            this.emit('loginSuccess', event.detail);
        });
        window.addEventListener('auth:logoutSuccess', () => {
            this.emit('logoutSuccess');
        });
        // Listen for chat events
        window.addEventListener('chat:messageReceived', (event) => {
            this.emit('messageReceived', event.detail);
        });
        window.addEventListener('chat:conversationCreated', (event) => {
            this.emit('conversationCreated', event.detail);
        });
    }
    // Event emitter methods
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }
    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(cb => cb(data));
        }
    }
    // Authentication methods
    async login(username, password) {
        if (!this.electronAPI) {
            // Mock for browser mode
            return {
                success: true,
                user: { id: '1', name: username, email: `${username}@lama.local` }
            };
        }
        const result = await this.electronAPI.invoke('auth:login', { username, password });
        return result.data || result;
    }
    async register(username, password, email) {
        if (!this.electronAPI) {
            return {
                success: true,
                user: { id: '1', name: username, email: email || `${username}@lama.local` }
            };
        }
        const result = await this.electronAPI.invoke('auth:register', { username, password, email });
        return result.data || result;
    }
    async logout() {
        if (!this.electronAPI) {
            return { success: true };
        }
        const result = await this.electronAPI.invoke('auth:logout');
        return result.data || result;
    }
    async checkAuth() {
        if (!this.electronAPI) {
            return { authenticated: false };
        }
        const result = await this.electronAPI.invoke('auth:check');
        return result.data || result;
    }
    // State management
    async getState(path) {
        if (!this.electronAPI) {
            return {};
        }
        const result = await this.electronAPI.invoke('state:get', { path });
        return result.data || result;
    }
    async subscribeToState(paths) {
        if (!this.electronAPI) {
            return;
        }
        await this.electronAPI.invoke('state:subscribe', { paths });
    }
    // Chat methods
    async sendMessage(conversationId, text, attachments) {
        if (!this.electronAPI) {
            // Mock for browser mode
            return {
                id: `msg-${Date.now()}`,
                conversationId,
                text,
                sender: 'user',
                timestamp: new Date().toISOString(),
                status: 'sent'
            };
        }
        const result = await this.electronAPI.invoke('chat:sendMessage', { conversationId, text, attachments });
        return result.data || result;
    }
    async getMessages(conversationId, limit = 50, offset = 0) {
        if (!this.electronAPI) {
            return { messages: [], total: 0, hasMore: false };
        }
        const result = await this.electronAPI.invoke('chat:getMessages', { conversationId, limit, offset });
        return result.data || result;
    }
    async createConversation(type, participants, name) {
        if (!this.electronAPI) {
            return {
                id: `conv-${Date.now()}`,
                type,
                participants,
                name: name || 'New Conversation',
                unreadCount: 0
            };
        }
        const result = await this.electronAPI.invoke('chat:createConversation', { type, participants, name });
        return result.data || result;
    }
    async getConversations(limit = 20, offset = 0) {
        if (!this.electronAPI) {
            return { conversations: [], total: 0, hasMore: false };
        }
        const result = await this.electronAPI.invoke('chat:getConversations', { limit, offset });
        return result.data || result;
    }
    // Action methods (user-initiated actions)
    async action(type, payload) {
        if (!this.electronAPI) {
            console.warn(`[IPCClient] Cannot perform action ${type} - no electronAPI`);
            return null;
        }
        const result = await this.electronAPI.invoke(`action:${type}`, payload);
        return result.data || result;
    }
    // Query methods (request state)
    async query(type, params) {
        if (!this.electronAPI) {
            console.warn(`[IPCClient] Cannot perform query ${type} - no electronAPI`);
            return null;
        }
        const result = await this.electronAPI.invoke(`query:${type}`, params);
        return result.data || result;
    }
}
// Export singleton instance
export const ipcClient = new IPCClient();
