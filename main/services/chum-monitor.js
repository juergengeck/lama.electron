/**
 * CHUM Protocol Monitor
 * Tracks WebSocket connections and sync status
 */
import EventEmitter from 'events';
import config from '../config/iom-config.js';
class ChumMonitor extends EventEmitter {
    connections;
    syncStats;
    closeCode;
    closeReason;
    endTime;
    state;
    constructor() {
        super();
        this.connections = new Map();
        this.syncStats = {
            totalSent: 0,
            totalReceived: 0,
            totalErrors: 0,
            activeSyncs: 0
        };
    }
    /**
     * Track a new WebSocket connection
     */
    trackConnection(connId, connection) {
        const connInfo = {
            id: connId,
            state: 'connecting',
            startTime: Date.now(),
            bytesReceived: 0,
            bytesSent: 0,
            errors: [],
            remoteInstance: null
        };
        this.connections.set(connId, connInfo);
        // Monitor connection events
        if (connection) {
            // Track connection state
            connection.on('open', () => {
                connInfo.state = 'open';
                this.emit('connection:open', connId);
            });
            connection.on('close', (code, reason) => {
                connInfo.state = 'closed';
                connInfo.closeCode = code;
                connInfo.closeReason = reason;
                connInfo.endTime = Date.now();
                this.emit('connection:closed', {
                    id: connId,
                    code,
                    reason,
                    duration: connInfo.endTime - connInfo.startTime
                });
            });
            connection.on('error: any', (error) => {
                connInfo.errors.push({
                    timestamp: Date.now(),
                    message: error.message,
                    code: error.code
                });
                this.syncStats.totalErrors++;
                this.emit('connection:error', {
                    id: connId,
                    error
                });
            });
            // Track data transfer
            connection.on('message', (data) => {
                connInfo.bytesReceived += data.length || 0;
                this.syncStats.totalReceived += data.length || 0;
            });
        }
        return connInfo;
    }
    /**
     * Update sync progress
     */
    updateSyncProgress(connId, progress) {
        const conn = this.connections.get(connId);
        if (!conn)
            return;
        conn.syncProgress = progress;
        this.emit('sync:progress', {
            connectionId: connId,
            ...progress
        });
    }
    /**
     * Record sync completion
     */
    completeSyncSession(connId, chumObj) {
        const conn = this.connections.get(connId);
        if (!conn)
            return;
        conn.syncCompleted = true;
        conn.completionTime = Date.now();
        conn.chumResult = {
            objectsSent: chumObj.AtoBExists + chumObj.AtoBUnknown,
            objectsReceived: chumObj.BtoAExists + chumObj.BtoAUnknown,
            errors: chumObj.errors || [],
            duration: Date.now() - conn.startTime
        };
        this.syncStats.totalSent += conn.chumResult.objectsSent;
        this.syncStats.totalReceived += conn.chumResult.objectsReceived;
        this.emit('sync:completed', {
            connectionId: connId,
            result: conn.chumResult
        });
    }
    /**
     * Get connection status
     */
    getConnectionStatus(connId) {
        return this.connections.get(connId);
    }
    /**
     * Get all active connections
     */
    getActiveConnections() {
        return Array.from(this.connections.values()).filter(conn => conn.state === 'open' || conn.state === 'connecting');
    }
    /**
     * Get sync statistics
     */
    getSyncStats() {
        return {
            ...this.syncStats,
            activeConnections: this.getActiveConnections().length,
            totalConnections: this.connections.size
        };
    }
    /**
     * Check for stale connections
     */
    checkStaleConnections() {
        const now = Date.now();
        for (const [connId, conn] of this.connections) {
            if (conn.state === 'connecting' && now - conn.startTime > config.connections.staleConnectionTimeout) {
                conn.state = 'stale';
                this.emit('connection:stale', connId);
            }
        }
    }
    /**
     * Clear old connections from memory
     */
    cleanupOldConnections() {
        const now = Date.now();
        for (const [connId, conn] of this.connections) {
            if (conn.endTime && now - conn.endTime > config.connections.closedConnectionRetention) {
                this.connections.delete(connId);
            }
        }
    }
}
// Export singleton
export default new ChumMonitor();
