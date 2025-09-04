/**
 * CommServer Transport - Wrapper around ConnectionsModel for WebSocket relay
 * Provides P2P connectivity through CommServer relay
 */
import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';
import ConnectionsModel from '@refinio/one.models/lib/models/ConnectionsModel.js';
import GroupModel from '@refinio/one.models/lib/models/Leute/GroupModel';
import BlacklistModel from '../../BlacklistModel';
import { TransportType } from '../TransportManager';
export var TransportStatus;
(function (TransportStatus) {
    TransportStatus["UNINITIALIZED"] = "UNINITIALIZED";
    TransportStatus["INITIALIZING"] = "INITIALIZING";
    TransportStatus["READY"] = "READY";
    TransportStatus["CONNECTED"] = "CONNECTED";
    TransportStatus["DISCONNECTED"] = "DISCONNECTED";
    TransportStatus["ERROR"] = "ERROR";
})(TransportStatus || (TransportStatus = {}));
export class CommServerManager {
    constructor(leuteModel, config) {
        Object.defineProperty(this, "leuteModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: leuteModel
        });
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: TransportType.COMM_SERVER
        });
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: TransportStatus.UNINITIALIZED
        });
        Object.defineProperty(this, "config", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
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
        Object.defineProperty(this, "onMessageReceived", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OEvent()
        });
        Object.defineProperty(this, "onError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OEvent()
        });
        Object.defineProperty(this, "onStatusChanged", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OEvent()
        });
        Object.defineProperty(this, "connectionsModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "blacklistModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.config = config;
        this.blacklistModel = new BlacklistModel();
    }
    async init() {
        if (this.status !== TransportStatus.UNINITIALIZED) {
            console.warn(`[CommServerManager] Already initialized. Status: ${this.status}`);
            return;
        }
        console.log('[CommServerManager] Initializing CommServer transport...');
        this.setStatus(TransportStatus.INITIALIZING);
        try {
            const commServerUrl = this.config.options.commServerUrl;
            if (!commServerUrl) {
                throw new Error('CommServer URL not configured');
            }
            // Create ConnectionsModel for WebSocket relay
            this.connectionsModel = new ConnectionsModel(this.leuteModel, {
                commServerUrl,
                acceptIncomingConnections: true,
                acceptUnknownInstances: true,
                acceptUnknownPersons: false,
                allowPairing: false, // No pairing in browser
                allowDebugRequests: true,
                pairingTokenExpirationDuration: 60000 * 15, // 15 minutes
                establishOutgoingConnections: true
            });
            // Create required groups for blacklist management (following one.leute pattern)
            const binGroup = await this.leuteModel.createGroup('bin');
            const everyoneGroup = await GroupModel.constructFromLatestProfileVersionByGroupName(this.leuteModel.constructor.EVERYONE_GROUP_NAME);
            // Initialize blacklist model
            this.blacklistModel.init(binGroup, everyoneGroup);
            console.log('[CommServerManager] Blacklist groups initialized');
            // Initialize the ConnectionsModel with blacklist (required for proper connection handling)
            await this.connectionsModel.init(this.blacklistModel.blacklistGroupModel);
            console.log('[CommServerManager] ConnectionsModel initialized with blacklist');
            // Wait for the transport to be ready before proceeding
            // This ensures WebSocket connections have their plugins properly set up
            await this.waitForTransportReady();
            // Set up event forwarding
            this.connectionsModel.onConnectionsChange.listen(() => {
                // Forward connection events
            });
            this.connectionsModel.onOnlineStateChange.listen((isOnline) => {
                this.setStatus(isOnline ? TransportStatus.CONNECTED : TransportStatus.DISCONNECTED);
            });
            this.setStatus(TransportStatus.READY);
            console.log('[CommServerManager] CommServer transport initialized');
        }
        catch (error) {
            console.error('[CommServerManager] Initialization failed', error);
            this.setStatus(TransportStatus.ERROR);
            this.onError.emit(error);
            throw error;
        }
    }
    async startNetworking() {
        if (!this.connectionsModel) {
            throw new Error('ConnectionsModel not initialized');
        }
        console.log('[CommServerManager] Starting networking...');
        // ConnectionsModel is already initialized in init(), no need to initialize again
        console.log('[CommServerManager] Networking started');
    }
    isAvailable() {
        return this.status === TransportStatus.READY ||
            this.status === TransportStatus.CONNECTED;
    }
    async connect(target) {
        if (!this.connectionsModel) {
            throw new Error('ConnectionsModel not initialized');
        }
        if (target.pairingToken) {
            // Browser should NOT accept invitations - only Node.js handles pairing
            throw new Error('Browser cannot accept invitations - pairing disabled. Invitations must be handled by the Node.js instance.');
        }
        else if (target.personId && target.instanceId) {
            // Direct connection to known device
            return await this.connectionsModel.establishConnection(target.personId, target.instanceId);
        }
        else {
            throw new Error('Invalid connection target');
        }
    }
    async disconnect(connectionId) {
        if (!this.connectionsModel) {
            throw new Error('ConnectionsModel not initialized');
        }
        // Find and close the connection
        const connections = this.connectionsModel.connectionsInfo();
        const connection = connections.find(c => c.id === connectionId);
        if (connection) {
            await connection.close();
        }
    }
    async shutdown() {
        console.log('[CommServerManager] Shutting down...');
        if (this.connectionsModel) {
            await this.connectionsModel.shutdown();
        }
        if (this.blacklistModel) {
            await this.blacklistModel.shutdown();
        }
        this.setStatus(TransportStatus.UNINITIALIZED);
        console.log('[CommServerManager] Shutdown complete');
    }
    setStatus(status) {
        this.status = status;
        this.onStatusChanged.emit(status);
    }
    // ConnectionsModel access
    getConnectionsModel() {
        return this.connectionsModel;
    }
    getPairingManager() {
        return this.connectionsModel?.pairing;
    }
    async createInvitation() {
        if (!this.connectionsModel?.pairing) {
            throw new Error('Pairing manager not available');
        }
        const invitation = await this.connectionsModel.pairing.createInvitation();
        return invitation.url;
    }
    isOnline() {
        return this.status === TransportStatus.CONNECTED;
    }
    async waitForTransportReady(timeout = 5000) {
        console.log('[CommServerManager] Waiting for transport to be ready...');
        return new Promise((resolve, reject) => {
            const checkReady = () => {
                // Check if the transport layer is properly initialized
                if (this.connectionsModel && this.connectionsModel.pairing) {
                    console.log('[CommServerManager] Transport is ready');
                    resolve();
                    return true;
                }
                return false;
            };
            // Check immediately
            if (checkReady())
                return;
            // Set up timeout
            const timer = setTimeout(() => {
                reject(new Error('Transport initialization timeout'));
            }, timeout);
            // Poll for readiness
            const pollInterval = setInterval(() => {
                if (checkReady()) {
                    clearInterval(pollInterval);
                    clearTimeout(timer);
                }
            }, 100);
        });
    }
    async waitForConnection(timeout = 30000) {
        if (this.isOnline())
            return;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, timeout);
            const listener = this.onStatusChanged.listen((status) => {
                if (status === TransportStatus.CONNECTED) {
                    clearTimeout(timer);
                    listener.disconnect();
                    resolve();
                }
            });
        });
    }
}
