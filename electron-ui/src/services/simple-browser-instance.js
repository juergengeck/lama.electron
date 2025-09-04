/**
 * Simplified Browser Instance for ONE.CORE
 * Handles authentication without complex imports
 */
export class SimpleBrowserInstance {
    constructor() {
        Object.defineProperty(this, "users", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "currentUser", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "initialized", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    async initialize() {
        if (this.initialized) {
            console.log('[SimpleBrowser] Already initialized');
            return;
        }
        console.log('[SimpleBrowser] Initializing simple browser instance...');
        // Load any persisted users from localStorage
        const storedUsers = localStorage.getItem('lama-users');
        if (storedUsers) {
            try {
                const parsed = JSON.parse(storedUsers);
                Object.entries(parsed).forEach(([id, user]) => {
                    this.users.set(id, user);
                });
            }
            catch (e) {
                console.error('[SimpleBrowser] Failed to load stored users:', e);
            }
        }
        this.initialized = true;
        console.log('[SimpleBrowser] Initialized successfully');
    }
    async createUser(username, password) {
        console.log('[SimpleBrowser] Creating user:', username);
        // Check if user already exists
        const existing = Array.from(this.users.values()).find(u => u.name === username);
        if (existing) {
            throw new Error('User already exists');
        }
        // Create new user
        const user = {
            id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: username,
            email: `${username}@lama.local`,
            passwordHash: this.hashPassword(password),
            createdAt: new Date().toISOString()
        };
        this.users.set(user.id, user);
        this.persistUsers();
        console.log('[SimpleBrowser] User created successfully');
        return user;
    }
    async login(username, password) {
        console.log('[SimpleBrowser] Attempting login for:', username);
        const user = Array.from(this.users.values()).find(u => u.name === username);
        if (!user) {
            throw new Error('User not found');
        }
        if (user.passwordHash !== this.hashPassword(password)) {
            throw new Error('Invalid password');
        }
        this.currentUser = user;
        localStorage.setItem('lama-current-user', user.id);
        console.log('[SimpleBrowser] Login successful');
        return user;
    }
    async logout() {
        this.currentUser = null;
        localStorage.removeItem('lama-current-user');
        console.log('[SimpleBrowser] Logged out');
    }
    async checkAuth() {
        // Check if we have a current user
        if (this.currentUser) {
            return { authenticated: true, user: this.currentUser };
        }
        // Try to restore from localStorage
        const userId = localStorage.getItem('lama-current-user');
        if (userId) {
            const user = this.users.get(userId);
            if (user) {
                this.currentUser = user;
                return { authenticated: true, user };
            }
        }
        return { authenticated: false };
    }
    // State management
    async setState(path, value) {
        this.state.set(path, value);
        // Persist important state
        if (path.startsWith('identity.') || path.startsWith('provisioning.')) {
            localStorage.setItem(`lama-state-${path}`, JSON.stringify(value));
        }
    }
    async getState(path) {
        // Check memory first
        if (this.state.has(path)) {
            return this.state.get(path);
        }
        // Check localStorage
        const stored = localStorage.getItem(`lama-state-${path}`);
        if (stored) {
            try {
                const value = JSON.parse(stored);
                this.state.set(path, value);
                return value;
            }
            catch (e) {
                console.error('[SimpleBrowser] Failed to parse stored state:', e);
            }
        }
        return undefined;
    }
    // Message operations (simplified)
    async createMessage(conversationId, text) {
        const message = {
            id: `msg-${Date.now()}`,
            conversationId,
            text,
            sender: this.currentUser?.id || 'anonymous',
            timestamp: new Date().toISOString(),
            status: 'sent'
        };
        // Store in localStorage for now
        const messages = this.getStoredMessages();
        messages.push(message);
        localStorage.setItem('lama-messages', JSON.stringify(messages));
        return message;
    }
    async getMessages(conversationId, limit = 50) {
        const messages = this.getStoredMessages();
        return messages
            .filter(m => m.conversationId === conversationId)
            .slice(-limit);
    }
    // Conversation operations (simplified)
    async createConversation(name, participants) {
        const conversation = {
            id: `conv-${Date.now()}`,
            name,
            participants,
            createdAt: new Date().toISOString(),
            createdBy: this.currentUser?.id || 'system'
        };
        const conversations = this.getStoredConversations();
        conversations.push(conversation);
        localStorage.setItem('lama-conversations', JSON.stringify(conversations));
        return conversation;
    }
    async getConversations() {
        return this.getStoredConversations();
    }
    // Helper methods
    hashPassword(password) {
        // Simple hash for demo - in production use proper crypto
        return btoa(password);
    }
    persistUsers() {
        const userData = {};
        this.users.forEach((user, id) => {
            userData[id] = user;
        });
        localStorage.setItem('lama-users', JSON.stringify(userData));
    }
    getStoredMessages() {
        const stored = localStorage.getItem('lama-messages');
        if (stored) {
            try {
                return JSON.parse(stored);
            }
            catch (e) {
                console.error('[SimpleBrowser] Failed to parse messages:', e);
            }
        }
        return [];
    }
    getStoredConversations() {
        const stored = localStorage.getItem('lama-conversations');
        if (stored) {
            try {
                return JSON.parse(stored);
            }
            catch (e) {
                console.error('[SimpleBrowser] Failed to parse conversations:', e);
            }
        }
        return [];
    }
    async shutdown() {
        console.log('[SimpleBrowser] Shutting down...');
        this.currentUser = null;
        this.initialized = false;
    }
}
// Export singleton
export const simpleBrowserInstance = new SimpleBrowserInstance();
