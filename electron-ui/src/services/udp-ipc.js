/**
 * UDP IPC Service for Electron
 * Provides UDP socket functionality through Electron's main process
 */
class UDPSocketImpl {
    constructor(id, type) {
        Object.defineProperty(this, "id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: id
        });
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: type
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "_address", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                address: '',
                port: 0,
                family: 'IPv4'
            }
        });
        // Listen for IPC messages from main process
        if (window.electronAPI) {
            window.electronAPI.onUDPMessage((socketId, event, ...args) => {
                if (socketId === this.id) {
                    this.emit(event, ...args);
                }
            });
        }
    }
    address() {
        return this._address;
    }
    async bind(port = 0, address) {
        if (!window.electronAPI) {
            throw new Error('Electron API not available');
        }
        const result = await window.electronAPI.udpBind(this.id, port, address);
        this._address = result;
        this.emit('listening');
    }
    async send(buffer, port, address) {
        if (!window.electronAPI) {
            throw new Error('Electron API not available');
        }
        // Convert Uint8Array to array for IPC transfer
        const data = Array.from(buffer);
        return await window.electronAPI.udpSend(this.id, data, port, address);
    }
    async close() {
        if (!window.electronAPI) {
            throw new Error('Electron API not available');
        }
        await window.electronAPI.udpClose(this.id);
        this.emit('close');
        this.listeners.clear();
    }
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
    emit(event, ...args) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(...args);
                }
                catch (error) {
                    console.error(`[UDP] Error in event handler for ${event}:`, error);
                }
            });
        }
    }
}
/**
 * UDP IPC Service
 */
export class UDPService {
    constructor() {
        Object.defineProperty(this, "sockets", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "socketCounter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
    }
    /**
     * Create a new UDP socket
     */
    async createSocket(options) {
        if (!window.electronAPI) {
            throw new Error('Electron API not available');
        }
        const id = `socket-${++this.socketCounter}`;
        const socket = new UDPSocketImpl(id, options.type);
        // Request socket creation in main process
        await window.electronAPI.udpCreate(id, options.type);
        this.sockets.set(id, socket);
        return socket;
    }
    /**
     * Get socket by ID
     */
    getSocket(id) {
        return this.sockets.get(id);
    }
    /**
     * Close all sockets
     */
    async closeAll() {
        const closePromises = Array.from(this.sockets.values()).map(socket => socket.close());
        await Promise.all(closePromises);
        this.sockets.clear();
    }
}
// Export singleton instance
export const udpService = new UDPService();
