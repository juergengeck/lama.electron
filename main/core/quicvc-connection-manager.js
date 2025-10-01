/**
 * QUIC VC Connection Manager
 *
 * Implements QUICVC protocol - QUIC with Verifiable Credentials replacing TLS.
 * Adapted from the uvc project for lama.electron
 *
 * Architecture:
 * - VC-based initial handshake for authentication (replaces TLS 1.3)
 * - Derives session keys from credential exchange
 * - QUIC-style packet protection and encryption after handshake
 * - Secure heartbeat mechanism over encrypted channel
 *
 * Connection flow:
 * 1. Initial packet with VC_INIT frame containing client credentials
 * 2. Server validates and responds with VC_RESPONSE frame
 * 3. Both parties derive shared secrets from credentials
 * 4. All subsequent packets use QUIC packet protection
 * 5. Heartbeats sent over secure channel with packet numbers
 *
 * Security model:
 * - Authentication: Verifiable Credentials with challenge-response
 * - Encryption: AES-GCM with keys derived from VC exchange
 * - Integrity: HMAC with packet numbers for replay protection
 */
import { EventEmitter } from 'events';
import crypto from 'crypto';
import createDebug from 'debug';
const debug = createDebug('one:quic:vc:connection');
// QUICVC packet types
export var QuicVCPacketType;
(function (QuicVCPacketType) {
    QuicVCPacketType[QuicVCPacketType["INITIAL"] = 0] = "INITIAL";
    QuicVCPacketType[QuicVCPacketType["HANDSHAKE"] = 1] = "HANDSHAKE";
    QuicVCPacketType[QuicVCPacketType["PROTECTED"] = 2] = "PROTECTED";
    QuicVCPacketType[QuicVCPacketType["RETRY"] = 3] = "RETRY"; // Retry with different parameters
})(QuicVCPacketType || (QuicVCPacketType = {}));
// QUICVC frame types
export var QuicVCFrameType;
(function (QuicVCFrameType) {
    QuicVCFrameType[QuicVCFrameType["VC_INIT"] = 16] = "VC_INIT";
    QuicVCFrameType[QuicVCFrameType["VC_RESPONSE"] = 17] = "VC_RESPONSE";
    QuicVCFrameType[QuicVCFrameType["VC_ACK"] = 18] = "VC_ACK";
    QuicVCFrameType[QuicVCFrameType["STREAM"] = 8] = "STREAM";
    QuicVCFrameType[QuicVCFrameType["ACK"] = 2] = "ACK";
    QuicVCFrameType[QuicVCFrameType["HEARTBEAT"] = 32] = "HEARTBEAT";
    QuicVCFrameType[QuicVCFrameType["DISCOVERY"] = 48] = "DISCOVERY";
    QuicVCFrameType[QuicVCFrameType["CONNECTION_CLOSE"] = 28] = "CONNECTION_CLOSE"; // Connection close frame
})(QuicVCFrameType || (QuicVCFrameType = {}));
export class QuicVCConnectionManager extends EventEmitter {
    ownPersonId;
    copy;
    static instance = null;
    connections = new Map();
    quicModel = null;
    vcManager = null;
    ownPersonId;
    ownVC = null;
    // Configuration
    QUICVC_PORT = 49497; // All QUICVC communication on this port
    QUICVC_VERSION = 0x00000001; // Version 1
    HANDSHAKE_TIMEOUT = 5000; // 5 seconds
    HEARTBEAT_INTERVAL = 30000; // 30 seconds (as per ESP32 spec)
    IDLE_TIMEOUT = 120000; // 2 minutes (as per ESP32 spec)
    CONNECTION_ID_LENGTH = 16; // bytes
    constructor(ownPersonId) {
        super();
        this.ownPersonId = ownPersonId;
    }
    static getInstance(ownPersonId) {
        if (!QuicVCConnectionManager.instance) {
            QuicVCConnectionManager.instance = new QuicVCConnectionManager(ownPersonId);
        }
        return QuicVCConnectionManager.instance;
    }
    /**
     * Check if the manager is initialized with a credential
     */
    isInitialized() {
        return this.vcManager !== null && this.quicModel !== null && this.ownVC !== null;
    }
    /**
     * Get an existing connection by device ID
     */
    getConnection(deviceId) {
        for (const connection of this.connections.values()) {
            if (connection.deviceId === deviceId) {
                return connection;
            }
        }
        return undefined;
    }
    /**
     * Send a frame in a PROTECTED packet to an established connection
     */
    async sendProtectedFrame(deviceId, frameData) {
        const connection = this.getConnection(deviceId);
        if (!connection) {
            throw new Error(`No connection found for device ${deviceId}`);
        }
        if (connection.state !== 'established') {
            throw new Error(`Connection to ${deviceId} is not established (state: ${connection.state})`);
        }
        // Create PROTECTED packet with the binary frame data
        const packet = this.createProtectedPacket(connection, frameData);
        // Send the packet
        await this.sendPacket(connection, packet);
        console.log(`[QuicVCConnectionManager] Sent PROTECTED frame to ${deviceId}, frame type: 0x${frameData[0].toString(16)}`);
    }
    /**
     * Initialize with transport and VCManager
     */
    async initialize(transport, vcManager, ownVC) {
        this.vcManager = vcManager;
        this.quicModel = transport;
        this.ownVC = ownVC || null;
        // Listen for raw messages
        if (transport && typeof transport.on === 'function') {
            transport.on('message', (data, rinfo) => {
                // Check if this is a QUIC packet (first byte lower 2 bits indicate packet type)
                if (data.length > 0) {
                    const packetType = data[0] & 0x03;
                    // Handle HANDSHAKE (0x01) and PROTECTED (0x02) packets that aren't discovery
                    if (packetType === 0x01 || packetType === 0x02) {
                        console.log(`[QuicVCConnectionManager] Received QUIC packet type ${packetType} from ${rinfo.address}:${rinfo.port}`);
                        this.handleQuicVCPacket(data, rinfo);
                    }
                }
            });
        }
        debug('QuicVCConnectionManager initialized');
    }
    /**
     * Initiate QUIC-VC handshake with a device
     */
    async initiateHandshake(deviceId, address, port, credential) {
        console.log(`[QuicVCConnectionManager] Initiating QUIC-VC handshake with ${deviceId} at ${address}:${port}`);
        // Pass the credential directly to connect
        await this.connect(deviceId, address, port, credential);
    }
    /**
     * Initiate QUICVC connection (client role)
     */
    async connect(deviceId, address, port, credential) {
        console.log(`[QuicVCConnectionManager] Initiating QUICVC connection to ${deviceId} at ${address}:${port}`);
        // Check if we already have a connection to this device
        const existingConnection = this.findConnectionByAddress(address, port);
        if (existingConnection && existingConnection.state === 'established') {
            console.log(`[QuicVCConnectionManager] Already have established connection to ${deviceId} - reusing it`);
            return;
        }
        else if (existingConnection && existingConnection.state !== 'established') {
            console.log(`[QuicVCConnectionManager] Have connection in ${existingConnection.state} state - closing and recreating`);
            this.closeConnection(existingConnection, 'Recreating for new operation');
        }
        // Generate connection IDs
        const dcid = crypto.randomBytes(this.CONNECTION_ID_LENGTH);
        const scid = crypto.randomBytes(this.CONNECTION_ID_LENGTH);
        // Create connection state
        const connection = {
            deviceId,
            dcid,
            scid,
            address,
            port,
            state: 'initial',
            isServer: false,
            nextPacketNumber: 0n,
            highestReceivedPacket: -1n,
            ackQueue: [],
            localVC: credential,
            remoteVC: null,
            challenge: this.generateChallenge(),
            initialKeys: null,
            handshakeKeys: null,
            applicationKeys: null,
            serviceHandlers: new Map(),
            handshakeTimeout: null,
            heartbeatInterval: null,
            idleTimeout: null,
            createdAt: Date.now(),
            lastActivity: Date.now()
        };
        const connId = this.getConnectionId(dcid);
        this.connections.set(connId, connection);
        console.log(`[QuicVCConnectionManager] Created connection ${connId} for ${deviceId} at ${address}:${port}`);
        // Set handshake timeout
        connection.handshakeTimeout = setTimeout(() => {
            this.handleHandshakeTimeout(connId);
        }, this.HANDSHAKE_TIMEOUT);
        // Send initial packet with VC_INIT frame
        await this.sendInitialPacket(connection);
    }
    /**
     * Send initial packet with credential
     */
    async sendInitialPacket(connection) {
        if (!connection.localVC) {
            throw new Error('No local credential available');
        }
        // Create VC_INIT frame
        const vcInitFrame = {
            type: QuicVCFrameType.VC_INIT,
            credential: connection.localVC,
            challenge: connection.challenge,
            timestamp: Date.now()
        };
        console.log('[QuicVCConnectionManager] Sending VC_INIT frame:', {
            frameType: 'VC_INIT (0x10)',
            credentialType: connection.localVC?.$type$ || 'unknown',
            toDevice: connection.deviceId,
            toAddress: `${connection.address}:${connection.port}`
        });
        // Create initial packet with VC_INIT frame
        const packet = this.createPacket(QuicVCPacketType.INITIAL, connection, JSON.stringify(vcInitFrame), QuicVCFrameType.VC_INIT);
        // Send packet
        await this.sendPacket(connection, packet);
        debug(`Sent INITIAL packet to ${connection.deviceId}`);
    }
    /**
     * Handle incoming QUICVC packet
     */
    async handleQuicVCPacket(data, rinfo) {
        console.log('[QuicVCConnectionManager] handleQuicVCPacket called with', data.length, 'bytes from', rinfo.address + ':' + rinfo.port);
        try {
            // Parse packet header
            const header = this.parsePacketHeader(data);
            if (!header) {
                console.error('[QuicVCConnectionManager] Invalid packet header');
                return;
            }
            // Find or create connection
            let connection = this.findConnectionByIds(header.dcid, header.scid);
            // For ESP32 responses, also try to find by address/port if not found by IDs
            if (!connection) {
                connection = this.findConnectionByAddress(rinfo.address, rinfo.port);
            }
            if (!connection) {
                if (header.type === QuicVCPacketType.INITIAL) {
                    // New incoming connection (server role)
                    connection = await this.handleNewConnection(header, rinfo);
                }
                else if (header.type === QuicVCPacketType.PROTECTED) {
                    console.error('[QuicVCConnectionManager] Received PROTECTED packet without connection');
                    return;
                }
                else {
                    console.error('[QuicVCConnectionManager] No connection found for packet type:', header.type);
                    return;
                }
                if (!connection) {
                    console.error('[QuicVCConnectionManager] Failed to create connection');
                    return;
                }
            }
            // Update activity
            connection.lastActivity = Date.now();
            // Process packet based on type
            switch (header.type) {
                case QuicVCPacketType.INITIAL:
                    await this.handleInitialPacket(connection, data, header);
                    break;
                case QuicVCPacketType.HANDSHAKE:
                    await this.handleHandshakePacket(connection, data, header);
                    break;
                case QuicVCPacketType.PROTECTED:
                    await this.handleProtectedPacket(connection, data, header);
                    break;
                default:
                    debug(`Unknown packet type: ${header.type}`);
            }
        }
        catch (error) {
            console.error('[QuicVCConnectionManager] Error handling packet:', error);
        }
    }
    /**
     * Handle new incoming connection
     */
    async handleNewConnection(header, rinfo) {
        const connection = {
            deviceId: '', // Will be set after VC verification
            dcid: header.scid, // Swap IDs for server
            scid: header.dcid,
            address: rinfo.address,
            port: rinfo.port,
            state: 'initial',
            isServer: true,
            nextPacketNumber: 0n,
            highestReceivedPacket: header.packetNumber,
            ackQueue: [header.packetNumber],
            localVC: this.ownVC,
            remoteVC: null,
            challenge: this.generateChallenge(),
            initialKeys: null,
            handshakeKeys: null,
            applicationKeys: null,
            serviceHandlers: new Map(),
            handshakeTimeout: null,
            heartbeatInterval: null,
            idleTimeout: null,
            createdAt: Date.now(),
            lastActivity: Date.now()
        };
        const connId = this.getConnectionId(connection.dcid);
        this.connections.set(connId, connection);
        return connection;
    }
    /**
     * Handle INITIAL packet with VC_INIT frame
     */
    async handleInitialPacket(connection, data, header) {
        console.log('[QuicVCConnectionManager] Handling INITIAL packet');
        // Extract payload (skip header)
        const payload = this.extractPayload(data, header);
        // Parse binary QUIC frames
        const frames = this.parseFrames(payload);
        if (frames.length === 0) {
            console.error('[QuicVCConnectionManager] No frames found in INITIAL packet');
            return;
        }
        // Check for VC_INIT frame (client credential presentation)
        const vcInitFrame = frames.find(frame => frame.type === QuicVCFrameType.VC_INIT);
        // Check for VC_RESPONSE frame (server credential response - ESP32 sends this in INITIAL packets)
        const vcResponseFrame = frames.find(frame => frame.type === QuicVCFrameType.VC_RESPONSE);
        if (vcInitFrame) {
            // Handle VC_INIT frame (we are acting as server)
            console.log('[QuicVCConnectionManager] Found VC_INIT frame - handling as server');
            await this.handleVCInitFrame(connection, vcInitFrame);
        }
        else if (vcResponseFrame) {
            // Handle VC_RESPONSE frame (we are acting as client, ESP32 responded)
            console.log('[QuicVCConnectionManager] Found VC_RESPONSE frame - handling as client');
            await this.handleVCResponseFrame(connection, vcResponseFrame);
        }
        else {
            console.error('[QuicVCConnectionManager] No VC_INIT or VC_RESPONSE frame found in INITIAL packet');
        }
    }
    /**
     * Handle VC_INIT frame received from client
     */
    async handleVCInitFrame(connection, frame) {
        console.log('[QuicVCConnectionManager] Processing VC_INIT frame');
        // Verify credential
        if (this.vcManager) {
            const verifiedInfo = await this.vcManager.verifyCredential(frame.credential, frame.credential.credentialSubject.id);
            if (verifiedInfo && verifiedInfo.issuerPersonId === this.ownPersonId) {
                connection.remoteVC = verifiedInfo;
                connection.deviceId = verifiedInfo.subjectDeviceId;
                // Derive initial keys from credentials
                connection.initialKeys = await this.deriveInitialKeys(connection);
                // Send handshake response
                await this.sendHandshakePacket(connection);
                connection.state = 'handshake';
            }
            else {
                // Invalid credential
                this.closeConnection(connection, 'Invalid credential');
            }
        }
    }
    /**
     * Handle VC_RESPONSE frame received from server (ESP32)
     */
    async handleVCResponseFrame(connection, frame) {
        console.log('[QuicVCConnectionManager] Processing VC_RESPONSE frame from ESP32');
        // Extract device ID from the frame if not already set
        if (!connection.deviceId && frame.device_id) {
            connection.deviceId = frame.device_id;
        }
        // Parse the response to check ownership status
        if (frame.status === 'provisioned' || frame.status === 'already_owned' || frame.status === 'ownership_revoked') {
            console.log('[QuicVCConnectionManager] ESP32 operation successful:', frame.status);
            // Update connection state
            connection.state = 'established';
            if (frame.owner) {
                connection.remoteVC = {
                    issuerPersonId: frame.owner,
                    subjectDeviceId: connection.deviceId,
                    subjectPublicKeyHex: '',
                    vc: frame
                };
            }
            // Complete handshake
            this.completeHandshake(connection);
            // Emit device update event
            if (frame.status === 'provisioned' && frame.owner && connection.deviceId) {
                this.emit('deviceProvisioned', {
                    deviceId: connection.deviceId,
                    ownerId: frame.owner
                });
            }
            console.log('[QuicVCConnectionManager] Keeping connection open for future commands');
        }
        else {
            console.error('[QuicVCConnectionManager] ESP32 operation failed:', frame.status, frame.message);
            this.closeConnection(connection, `Ownership failed: ${frame.message || frame.status}`);
        }
    }
    /**
     * Send HANDSHAKE packet with our credential
     */
    async sendHandshakePacket(connection) {
        if (!connection.localVC) {
            throw new Error('No local credential available');
        }
        // Create VC_RESPONSE frame
        const vcResponseFrame = {
            type: QuicVCFrameType.VC_RESPONSE,
            credential: connection.localVC,
            challenge: connection.challenge,
            ackChallenge: connection.remoteVC?.vc?.proof?.proofValue,
            timestamp: Date.now()
        };
        // Create handshake packet with VC_RESPONSE frame
        const packet = this.createPacket(QuicVCPacketType.HANDSHAKE, connection, JSON.stringify(vcResponseFrame), QuicVCFrameType.VC_RESPONSE);
        // Send packet
        await this.sendPacket(connection, packet);
        debug(`Sent HANDSHAKE packet to ${connection.deviceId}`);
    }
    /**
     * Handle HANDSHAKE packet
     */
    async handleHandshakePacket(connection, data, header) {
        const payload = this.extractPayload(data, header);
        const frame = JSON.parse(new TextDecoder().decode(payload));
        if (frame.type !== QuicVCFrameType.VC_RESPONSE) {
            debug('Expected VC_RESPONSE frame in HANDSHAKE packet');
            return;
        }
        // Verify credential if we're the client
        if (!connection.isServer && this.vcManager) {
            const verifiedInfo = await this.vcManager.verifyCredential(frame.credential, frame.credential.credentialSubject.id);
            if (verifiedInfo && verifiedInfo.issuerPersonId === this.ownPersonId) {
                connection.remoteVC = verifiedInfo;
                // Derive all keys
                connection.handshakeKeys = await this.deriveHandshakeKeys(connection);
                connection.applicationKeys = await this.deriveApplicationKeys(connection);
                // Complete handshake
                connection.state = 'established';
                this.completeHandshake(connection);
            }
            else {
                this.closeConnection(connection, 'Invalid credential in handshake');
            }
        }
        else if (connection.isServer) {
            // Server completes handshake
            connection.handshakeKeys = await this.deriveHandshakeKeys(connection);
            connection.applicationKeys = await this.deriveApplicationKeys(connection);
            connection.state = 'established';
            this.completeHandshake(connection);
        }
    }
    /**
     * Complete handshake and start heartbeat
     */
    completeHandshake(connection) {
        // Clear handshake timeout
        if (connection.handshakeTimeout) {
            clearTimeout(connection.handshakeTimeout);
            connection.handshakeTimeout = null;
        }
        // Start heartbeat
        connection.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat(connection);
        }, this.HEARTBEAT_INTERVAL);
        // Set idle timeout
        this.resetIdleTimeout(connection);
        // Emit events
        this.emit('handshakeComplete', connection.deviceId);
        if (connection.remoteVC) {
            this.emit('connectionEstablished', connection.deviceId, connection.remoteVC);
        }
        console.log(`[QuicVCConnectionManager] QUICVC handshake complete with ${connection.deviceId}`);
    }
    /**
     * Handle encrypted PROTECTED packets
     */
    async handleProtectedPacket(connection, data, header) {
        // For ESP32, it might send VC_RESPONSE in PROTECTED packets
        const payload = this.extractPayload(data, header);
        const frames = this.parseFrames(payload);
        // Check if it contains VC_RESPONSE (ESP32 ownership response)
        const vcResponseFrame = frames.find(frame => frame.type === QuicVCFrameType.VC_RESPONSE);
        if (vcResponseFrame) {
            console.log('[QuicVCConnectionManager] Found VC_RESPONSE in PROTECTED packet from ESP32');
            await this.handleVCResponseFrame(connection, vcResponseFrame);
            return;
        }
        // Otherwise, handle as normal encrypted PROTECTED packet
        if (connection.state !== 'established' || !connection.applicationKeys) {
            debug('Cannot handle protected packet - connection not established');
            return;
        }
        // Decrypt payload
        const decrypted = await this.decryptPacket(data, header, connection.applicationKeys);
        if (!decrypted) {
            debug('Failed to decrypt packet');
            return;
        }
        // Parse frames from decrypted data
        const decryptedFrames = this.parseFrames(decrypted);
        for (const frame of decryptedFrames) {
            switch (frame.type) {
                case QuicVCFrameType.HEARTBEAT:
                    this.handleHeartbeatFrame(connection, frame);
                    break;
                case QuicVCFrameType.STREAM:
                    this.handleStreamFrame(connection, frame);
                    break;
                case QuicVCFrameType.ACK:
                    break;
            }
        }
        this.resetIdleTimeout(connection);
    }
    /**
     * Send heartbeat over secure channel
     */
    async sendHeartbeat(connection) {
        if (connection.state !== 'established')
            return;
        const heartbeatFrame = {
            type: QuicVCFrameType.HEARTBEAT,
            timestamp: Date.now(),
            sequence: Number(connection.nextPacketNumber)
        };
        await this.sendProtectedPacket(connection, [heartbeatFrame]);
        debug(`Sent heartbeat to ${connection.deviceId}`);
    }
    /**
     * Send protected packet with encryption
     */
    async sendProtectedPacket(connection, frames) {
        if (!connection.applicationKeys) {
            throw new Error('No application keys available');
        }
        const payload = JSON.stringify(frames);
        const packet = await this.createEncryptedPacket(QuicVCPacketType.PROTECTED, connection, payload, connection.applicationKeys);
        await this.sendPacket(connection, packet);
    }
    /**
     * Derive initial keys from credentials
     */
    async deriveInitialKeys(connection) {
        const salt = Buffer.from('quicvc-initial-salt-v1');
        const info = Buffer.from((connection.localVC?.id || '') + (connection.remoteVC?.vc?.id || ''));
        const combined = Buffer.concat([salt, info]);
        const hash = crypto.createHash('sha256').update(combined).digest();
        const keyMaterial = Buffer.concat([hash, hash, hash]).slice(0, 96);
        return {
            encryptionKey: keyMaterial.slice(0, 32),
            decryptionKey: keyMaterial.slice(0, 32),
            sendIV: keyMaterial.slice(32, 48),
            receiveIV: keyMaterial.slice(32, 48),
            sendHMAC: keyMaterial.slice(64, 96),
            receiveHMAC: keyMaterial.slice(64, 96)
        };
    }
    /**
     * Derive handshake keys
     */
    async deriveHandshakeKeys(connection) {
        const salt = Buffer.from('quicvc-handshake-salt-v1');
        const info = Buffer.from(connection.challenge +
            (connection.localVC?.proof?.proofValue || '') +
            (connection.remoteVC?.vc?.proof?.proofValue || ''));
        const combined = Buffer.concat([salt, info]);
        const hash1 = crypto.createHash('sha256').update(combined).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        const keyMaterial = Buffer.concat([hash1, hash2]).slice(0, 192);
        return {
            encryptionKey: keyMaterial.slice(0, 32),
            decryptionKey: keyMaterial.slice(32, 64),
            sendIV: keyMaterial.slice(64, 80),
            receiveIV: keyMaterial.slice(80, 96),
            sendHMAC: keyMaterial.slice(96, 128),
            receiveHMAC: keyMaterial.slice(128, 160)
        };
    }
    /**
     * Derive application keys (1-RTT keys)
     */
    async deriveApplicationKeys(connection) {
        const salt = Buffer.from('quicvc-application-salt-v1');
        const info = Buffer.from((connection.localVC?.credentialSubject?.publicKeyHex || '') +
            (connection.remoteVC?.subjectPublicKeyHex || ''));
        const combined = Buffer.concat([salt, info]);
        const hash1 = crypto.createHash('sha256').update(combined).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        const keyMaterial = Buffer.concat([hash1, hash2]).slice(0, 192);
        return {
            encryptionKey: keyMaterial.slice(0, 32),
            decryptionKey: keyMaterial.slice(32, 64),
            sendIV: keyMaterial.slice(64, 80),
            receiveIV: keyMaterial.slice(80, 96),
            sendHMAC: keyMaterial.slice(96, 128),
            receiveHMAC: keyMaterial.slice(128, 160)
        };
    }
    /**
     * Helper methods
     */
    getConnectionId(dcid) {
        return Array.from(dcid).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    findConnectionByIds(dcid, scid) {
        const dcidStr = this.getConnectionId(dcid);
        let connection = this.connections.get(dcidStr);
        if (!connection) {
            const scidStr = this.getConnectionId(scid);
            for (const [_, conn] of this.connections) {
                if (this.getConnectionId(conn.scid) === scidStr || this.getConnectionId(conn.dcid) === scidStr) {
                    connection = conn;
                    break;
                }
            }
        }
        if (connection && !connection.deviceId) {
            const mac = Array.from(scid.slice(0, 6))
                .map(b => b.toString(16).padStart(2, '0'))
                .join(':');
            connection.deviceId = `esp32-${mac.replace(/:/g, '').toLowerCase()}`;
        }
        return connection;
    }
    findConnectionByAddress(address, port) {
        for (const conn of this.connections.values()) {
            if (!conn.isServer && conn.address === address && conn.port === port) {
                return conn;
            }
        }
        return undefined;
    }
    generateChallenge() {
        return crypto.randomBytes(32).toString('hex');
    }
    createPacket(type, connection, payload, frameType) {
        const header = {
            type,
            version: this.QUICVC_VERSION,
            dcid: connection.dcid,
            scid: connection.scid,
            packetNumber: connection.nextPacketNumber++
        };
        const headerBytes = this.serializeHeader(header);
        let frameBytes;
        if (type === QuicVCPacketType.INITIAL && frameType !== undefined) {
            const payloadBytes = Buffer.from(payload, 'utf8');
            frameBytes = Buffer.alloc(1 + 2 + payloadBytes.length);
            frameBytes[0] = frameType;
            frameBytes[1] = (payloadBytes.length >> 8) & 0xFF;
            frameBytes[2] = payloadBytes.length & 0xFF;
            payloadBytes.copy(frameBytes, 3);
        }
        else {
            frameBytes = Buffer.from(payload, 'utf8');
        }
        return Buffer.concat([headerBytes, frameBytes]);
    }
    createProtectedPacket(connection, frameData) {
        const header = {
            type: QuicVCPacketType.PROTECTED,
            version: this.QUICVC_VERSION,
            dcid: connection.dcid,
            scid: connection.scid,
            packetNumber: connection.nextPacketNumber++
        };
        const headerBytes = this.serializeHeader(header);
        return Buffer.concat([headerBytes, frameData]);
    }
    async createEncryptedPacket(type, connection, payload, keys, frameType) {
        const packet = this.createPacket(type, connection, payload, frameType);
        // TODO: Implement proper AEAD encryption
        return packet;
    }
    serializeHeader(header) {
        const buffer = Buffer.alloc(1 + 4 + 1 + header.dcid.length + 1 + header.scid.length + 1);
        let offset = 0;
        const flags = 0x80 | (header.type & 0x03);
        buffer.writeUInt8(flags, offset++);
        buffer.writeUInt32BE(header.version, offset);
        offset += 4;
        buffer.writeUInt8(header.dcid.length, offset++)(header.dcid).copy(buffer, offset);
        offset += header.dcid.length;
        buffer.writeUInt8(header.scid.length, offset++)(header.scid).copy(buffer, offset);
        offset += header.scid.length;
        buffer.writeUInt8(Number(header.packetNumber & 0xffn), offset);
        return buffer;
    }
    parsePacketHeader(data) {
        if (data.length < 8)
            return null;
        let offset = 0;
        const flags = data[offset++];
        const longHeader = (flags & 0x80) !== 0;
        const type = (flags & 0x03);
        if (!longHeader)
            return null;
        const version = new DataView(data.buffer, data.byteOffset + offset).getUint32(offset, false);
        offset += 4;
        const dcidLen = data[offset++];
        if (data.length < offset + dcidLen + 2)
            return null;
        const dcid = data.slice(offset, offset + dcidLen);
        offset += dcidLen;
        const scidLen = data[offset++];
        if (data.length < offset + scidLen + 1)
            return null;
        const scid = data.slice(offset, offset + scidLen);
        offset += scidLen;
        const packetNumber = BigInt(data[offset]);
        return { type, version, dcid, scid, packetNumber };
    }
    extractPayload(data, header) {
        const headerSize = 1 + 4 + 1 + header.dcid.length + 1 + header.scid.length + 1;
        return data.slice(headerSize);
    }
    async decryptPacket(data, header, keys) {
        // TODO: Implement proper AEAD decryption
        return this.extractPayload(data, header);
    }
    parseFrames(data) {
        const frames = [];
        let offset = 0;
        try {
            while (offset < data.length) {
                if (offset + 3 > data.length)
                    break;
                const frameType = data[offset];
                const length = (data[offset + 1] << 8) | data[offset + 2];
                offset += 3;
                if (offset + length > data.length)
                    break;
                const framePayload = data.slice(offset, offset + length);
                offset += length;
                let frame = { type: frameType, payload: framePayload };
                if (frameType === QuicVCFrameType.VC_INIT || frameType === QuicVCFrameType.VC_RESPONSE) {
                    try {
                        const jsonData = JSON.parse(framePayload.toString());
                        frame = { ...frame, ...jsonData, type: frameType };
                    }
                    catch (e) {
                        console.warn('[QuicVCConnectionManager] Frame payload is not JSON:', e.message);
                    }
                }
                else if (frameType === QuicVCFrameType.STREAM) {
                    if (framePayload.length > 0) {
                        const streamId = framePayload[0];
                        const streamData = framePayload.slice(1);
                        try {
                            const jsonData = JSON.parse(streamData.toString());
                            frame = { type: frameType, streamId, data: jsonData };
                        }
                        catch (e) {
                            frame = { type: frameType, streamId, data: streamData };
                        }
                    }
                }
                else if (frameType === QuicVCFrameType.HEARTBEAT) {
                    try {
                        const jsonData = JSON.parse(framePayload.toString());
                        frame = { ...frame, ...jsonData, type: frameType };
                    }
                    catch (e) {
                        console.warn('[QuicVCConnectionManager] Heartbeat payload is not JSON:', e.message);
                    }
                }
                frames.push(frame);
            }
        }
        catch (error) {
            console.error('[QuicVCConnectionManager] Error parsing frames:', error);
        }
        return frames;
    }
    handleHeartbeatFrame(connection, frame) {
        debug(`Received heartbeat from ${connection.deviceId}`);
    }
    handleStreamFrame(connection, frame) {
        const streamId = frame.streamId;
        if (streamId === 0x01 && frame.data && typeof frame.data === 'object') {
            if (frame.data.type === 'led_response' && frame.data.requestId) {
                if (!connection.deviceId && frame.data.device_id) {
                    connection.deviceId = frame.data.device_id;
                }
                else if (!connection.deviceId) {
                    const mac = Array.from(connection.scid.slice(0, 6))
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join(':');
                    connection.deviceId = `esp32-${mac.replace(/:/g, '').toLowerCase()}`;
                }
                if (connection.deviceId) {
                    this.emit('ledResponse', connection.deviceId, frame.data);
                }
                return;
            }
        }
        const handler = connection.serviceHandlers?.get(streamId);
        if (handler) {
            const data = typeof frame.data === 'string'
                ? Buffer.from(frame.data)
                : frame.data;
            handler(data, connection.deviceId);
        }
    }
    async sendPacket(connection, packet) {
        if (!this.quicModel) {
            throw new Error('QUIC transport not initialized');
        }
        await this.quicModel.send(packet, connection.address, connection.port);
    }
    resetIdleTimeout(connection) {
        if (connection.idleTimeout) {
            clearTimeout(connection.idleTimeout);
        }
        connection.idleTimeout = setTimeout(() => {
            this.closeConnection(connection, 'Idle timeout');
        }, this.IDLE_TIMEOUT);
    }
    handleHandshakeTimeout(connId) {
        const connection = this.connections.get(connId);
        if (connection && connection.state !== 'established') {
            this.closeConnection(connection, 'Handshake timeout');
        }
    }
    closeConnection(connection, reason) {
        const connId = this.getConnectionId(connection.dcid);
        console.log(`[QuicVCConnectionManager] ❌ CLOSING CONNECTION ${connId} for device ${connection.deviceId} - Reason: ${reason}`);
        if (connection.handshakeTimeout)
            clearTimeout(connection.handshakeTimeout);
        if (connection.heartbeatInterval)
            clearInterval(connection.heartbeatInterval);
        if (connection.idleTimeout)
            clearTimeout(connection.idleTimeout);
        this.connections.delete(connId);
        if (connection.deviceId) {
            this.emit('connectionClosed', connection.deviceId, reason);
        }
    }
    /**
     * Public API
     */
    isConnected(deviceId) {
        for (const conn of this.connections.values()) {
            if (conn.deviceId === deviceId && conn.state === 'established') {
                return true;
            }
        }
        return false;
    }
    async sendData(deviceId, data) {
        const connection = Array.from(this.connections.values())
            .find(c => c.deviceId === deviceId && c.state === 'established');
        if (!connection) {
            throw new Error(`No established connection to ${deviceId}`);
        }
        const streamFrame = {
            type: QuicVCFrameType.STREAM,
            streamId: 0,
            offset: 0,
            data: Array.from(data)
        };
        await this.sendProtectedPacket(connection, [streamFrame]);
    }
    disconnect(deviceId) {
        const connection = Array.from(this.connections.values())
            .find(c => c.deviceId === deviceId);
        if (connection) {
            this.closeConnection(connection, 'User requested');
        }
    }
}
