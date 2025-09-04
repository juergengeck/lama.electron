/**
 * TransportManager - Container for multiple transport types
 * Manages CommServerManager for WebSocket relay connections
 */
import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';
import { CommServerManager } from './transports/CommServerManager';
export var TransportType;
(function (TransportType) {
    TransportType["COMM_SERVER"] = "COMM_SERVER";
    TransportType["QUIC"] = "QUIC";
    TransportType["UDP_DIRECT"] = "UDP_DIRECT";
    TransportType["BLE"] = "BLE";
})(TransportType || (TransportType = {}));
export class TransportManager {
    constructor(leuteModel, channelManager, commServerUrl) {
        Object.defineProperty(this, "leuteModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: leuteModel
        });
        Object.defineProperty(this, "commServerUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: commServerUrl
        });
        Object.defineProperty(this, "transports", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "commServerManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Events
        Object.defineProperty(this, "onTransportRegistered", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OEvent()
        });
        Object.defineProperty(this, "onTransportUnregistered", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OEvent()
        });
        Object.defineProperty(this, "onConnectionEstablished", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OEvent()
        });
        Object.defineProperty(this, "onConnectionClosed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OEvent()
        });
        Object.defineProperty(this, "onTransportSelected", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OEvent()
        });
        console.log('[TransportManager] Creating transport manager...');
        // Create CommServerManager with proper config
        this.commServerManager = new CommServerManager(this.leuteModel, {
            type: TransportType.COMM_SERVER,
            options: {
                commServerUrl: this.commServerUrl,
                reconnectInterval: 5000,
                maxReconnectAttempts: 10,
                connectionTimeout: 30000
            }
        });
        console.log('[TransportManager] Transport manager created');
    }
    async init() {
        console.log('[TransportManager] Initializing...');
        try {
            // Initialize CommServerManager
            await this.commServerManager.init();
            // Register it as a transport
            this.registerTransport(this.commServerManager);
            console.log('[TransportManager] Initialized successfully');
        }
        catch (error) {
            console.error('[TransportManager] Initialization failed', error);
            throw error;
        }
    }
    async startNetworking() {
        console.log('[TransportManager] Starting networking layer...');
        try {
            if (this.commServerManager) {
                await this.commServerManager.startNetworking();
                console.log('[TransportManager] CommServerManager networking started');
            }
            else {
                console.warn('[TransportManager] CommServerManager not available');
            }
        }
        catch (error) {
            console.error('[TransportManager] Failed to start networking', error);
            throw error;
        }
    }
    registerTransport(transport) {
        if (this.transports.has(transport.type)) {
            console.warn(`[TransportManager] Transport ${transport.type} already registered`);
        }
        console.log(`[TransportManager] Registering transport: ${transport.type}`);
        this.transports.set(transport.type, transport);
        // Set up event forwarding
        if (transport.onConnectionEstablished) {
            transport.onConnectionEstablished.listen((connection) => {
                this.onConnectionEstablished.emit(connection, transport.type);
            });
        }
        if (transport.onConnectionClosed) {
            transport.onConnectionClosed.listen((connectionId, reason) => {
                this.onConnectionClosed.emit(connectionId, transport.type, reason);
            });
        }
        this.onTransportRegistered.emit(transport);
        console.log(`[TransportManager] Transport registered: ${transport.type}`);
    }
    unregisterTransport(type) {
        const transport = this.transports.get(type);
        if (transport) {
            this.transports.delete(type);
            this.onTransportUnregistered.emit(type);
            console.log(`[TransportManager] Transport unregistered: ${type}`);
        }
    }
    getTransports() {
        return new Map(this.transports);
    }
    getTransport(type) {
        return this.transports.get(type);
    }
    async shutdownAllTransports() {
        console.log('[TransportManager] Shutting down all transports...');
        for (const [type, transport] of Array.from(this.transports)) {
            try {
                console.log(`[TransportManager] Shutting down transport: ${type}`);
                await transport.shutdown();
            }
            catch (error) {
                console.error(`[TransportManager] Error shutting down transport ${type}:`, error);
            }
        }
        this.transports.clear();
        console.log('[TransportManager] All transports shut down');
    }
    async connectToDevice(target, preferences) {
        // Use CommServer transport by default
        const transport = this.getTransport(TransportType.COMM_SERVER);
        if (!transport) {
            throw new Error('No CommServer transport available');
        }
        this.onTransportSelected.emit(TransportType.COMM_SERVER, target);
        return transport.connect(target);
    }
    async connectViaTransport(type, target) {
        const transport = this.getTransport(type);
        if (!transport) {
            throw new Error(`Transport ${type} not available`);
        }
        this.onTransportSelected.emit(type, target);
        return transport.connect(target);
    }
    setTransportPreferences(preferences) {
        // Store preferences for future use
    }
    getTransportPreferences() {
        return {
            preferred: [TransportType.COMM_SERVER],
            fallback: [],
            timeout: 30000,
            retryAttempts: 3
        };
    }
    async getConnectionQualities() {
        return new Map();
    }
    // Convenience methods
    getCommServerManager() {
        return this.commServerManager;
    }
    getConnectionsModel() {
        if (!this.commServerManager) {
            throw new Error('CommServerManager not initialized');
        }
        return this.commServerManager.getConnectionsModel();
    }
    async getActiveConnections() {
        try {
            const cm = this.getConnectionsModel();
            if (cm && typeof cm.connectionsInfo === 'function') {
                return cm.connectionsInfo();
            }
        }
        catch (err) {
            console.warn('[TransportManager] Failed to retrieve connections info', err);
        }
        return [];
    }
    static getInstance() {
        return TransportManager.instance;
    }
    static setInstance(instance) {
        TransportManager.instance = instance;
    }
}
Object.defineProperty(TransportManager, "instance", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
