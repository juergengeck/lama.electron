/**
 * Shared IPC type definitions for LAMA Electron
 * These types are used across main process, preload, and renderer
 */
// ============================================================================
// IPC Channel Names (for type safety)
// ============================================================================
export const IPC_CHANNELS = {
    // Auth
    'auth:login': 'auth:login',
    'auth:logout': 'auth:logout',
    'auth:status': 'auth:status',
    // Contacts
    'contacts:list': 'contacts:list',
    'contacts:add': 'contacts:add',
    'contacts:remove': 'contacts:remove',
    'contacts:update': 'contacts:update',
    // Chat
    'chat:listTopics': 'chat:listTopics',
    'chat:createTopic': 'chat:createTopic',
    'chat:sendMessage': 'chat:sendMessage',
    'chat:getMessages': 'chat:getMessages',
    'chat:newMessages': 'chat:newMessages',
    // AI
    'ai:chat': 'ai:chat',
    'ai:analyze': 'ai:analyze',
    'ai:extractKeywords': 'ai:extractKeywords',
    // Devices
    'devices:list': 'devices:list',
    'devices:register': 'devices:register',
    'devices:remove': 'devices:remove',
    // Export
    'export:conversation': 'export:conversation',
    'export:htmlWithMicrodata': 'export:htmlWithMicrodata',
    // System
    'app:clearData': 'app:clearData',
    'instance:info': 'instance:info',
    'connections:info': 'connections:info',
    'connections:status': 'connections:status',
};
// ============================================================================
// Error Types
// ============================================================================
export class IPCError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'IPCError';
    }
}
