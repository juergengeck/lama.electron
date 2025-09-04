/**
 * Direct Connection Service
 * Manages direct P2P connection between renderer and Node.js instances
 * Uses ONE.models ConnectionsModel without comm server
 */
export class DirectConnectionService {
    constructor() {
        Object.defineProperty(this, "connectionsModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "nodeEndpoint", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ws://localhost:8765'
        });
        Object.defineProperty(this, "isConnected", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        console.log('[DirectConnection] Service initialized');
    }
    /**
     * Initialize direct connection to Node.js instance
     * This bypasses the comm server and connects directly
     */
    async connectToNode() {
        try {
            console.log('[DirectConnection] Connecting directly to Node.js instance at:', this.nodeEndpoint);
            // For now, just log that direct connection is not implemented
            // The actual connection will happen through the normal ONE.core flow
            console.log('[DirectConnection] Direct P2P connection not yet implemented');
            console.log('[DirectConnection] Connections will be established via normal CHUM sync after provisioning');
            // Return false to indicate direct connection is not available
            // The app will continue with normal browser-based ConnectionsModel
            return false;
        }
        catch (error) {
            console.error('[DirectConnection] Failed to connect to Node.js:', error);
            return false;
        }
    }
    /**
     * Set up message handlers for the direct connection
     */
    setupMessageHandlers(connection) {
        // Handle incoming messages from Node.js
        connection.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log('[DirectConnection] Received message from Node.js:', message.type);
                // Handle different message types
                switch (message.type) {
                    case 'sync':
                        this.handleSync(message);
                        break;
                    case 'update':
                        this.handleUpdate(message);
                        break;
                    case 'notification':
                        this.handleNotification(message);
                        break;
                    default:
                        console.log('[DirectConnection] Unknown message type:', message.type);
                }
            }
            catch (error) {
                console.error('[DirectConnection] Failed to handle message:', error);
            }
        });
        connection.on('close', () => {
            console.log('[DirectConnection] Connection to Node.js closed');
            this.isConnected = false;
            // Attempt to reconnect after a delay
            setTimeout(() => {
                this.connectToNode();
            }, 5000);
        });
        connection.on('error', (error) => {
            console.error('[DirectConnection] Connection error:', error);
        });
    }
    /**
     * Send a message directly to Node.js instance
     */
    async sendToNode(type, data) {
        if (!this.isConnected || !this.connectionsModel) {
            console.error('[DirectConnection] Not connected to Node.js');
            throw new Error('Not connected to Node.js instance');
        }
        const message = {
            type,
            data,
            timestamp: new Date().toISOString()
        };
        await this.connectionsModel.send(message);
        console.log('[DirectConnection] Sent message to Node.js:', type);
    }
    /**
     * Handle sync messages from Node.js
     */
    handleSync(message) {
        console.log('[DirectConnection] Handling sync:', message.data);
        // Implement sync logic here
        // This could sync messages, contacts, settings, etc.
    }
    /**
     * Handle update messages from Node.js
     */
    handleUpdate(message) {
        console.log('[DirectConnection] Handling update:', message.data);
        // Implement update logic here
        // This could be new messages, status updates, etc.
    }
    /**
     * Handle notifications from Node.js
     */
    handleNotification(message) {
        console.log('[DirectConnection] Handling notification:', message.data);
        // Implement notification logic here
    }
    /**
     * Disconnect from Node.js instance
     */
    async disconnect() {
        if (this.connectionsModel) {
            await this.connectionsModel.close();
            this.isConnected = false;
            console.log('[DirectConnection] Disconnected from Node.js');
        }
    }
    /**
     * Check if connected to Node.js
     */
    getConnectionStatus() {
        return this.isConnected;
    }
}
// Export singleton instance
export const directConnection = new DirectConnectionService();
