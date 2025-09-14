/**
 * QUIC-VC Transport for CHUM Traffic
 * Implements VC-based authentication with ONE.core contact creation
 * Uses UDP broadcast discovery for local peer discovery
 */

import { EventEmitter } from 'events'
import dgram from 'dgram'
import crypto from 'crypto'
import ContactTrustManager from './contact-trust-manager.js'

class QuicVCTransport extends EventEmitter {
  constructor(nodeOneCore) {
    super()
    this.nodeOneCore = nodeOneCore
    this.quicServer = null
    this.udpSocket = null
    this.peers = new Map() // peerId -> connection info with contact
    this.devices = new Map() // deviceId -> device info
    this.verifiedPeers = new Map() // personId -> verified peer info
    this.port = 49497 // Default QUIC-VC port
    this.discoveryPort = 49497 // Discovery port
    this.broadcastAddress = '255.255.255.255'
    this.discoveryInterval = 5000 // 5 seconds between broadcasts
    this.maxAge = 30000 // Remove devices not seen for 30 seconds
    this.discoveryTimer = null
    this.pruneTimer = null
    
    // VC exchange state
    this.pendingVCRequests = new Map() // peerId -> request info
    this.vcExchangeTimeout = 10000 // 10 seconds for VC exchange
    
    // Contact trust manager
    this.trustManager = new ContactTrustManager(nodeOneCore)
    this.setupTrustManagerHandlers()
  }

  /**
   * Setup trust manager event handlers
   */
  setupTrustManagerHandlers() {
    // When a contact is accepted, initialize CHUM sync
    this.trustManager.on('contact-accepted', async (event) => {
      const { personId, acceptanceVC } = event
      
      // Find the peer for this person
      for (const [peerId, peer] of this.peers) {
        if (peer.personId === personId) {
          console.log('[QuicVCTransport] Contact accepted, initializing CHUM sync:', peerId)
          
          // Update trust level
          peer.trustLevel = this.trustManager.TRUST_LEVELS.ACCEPTED
          peer.acceptanceVC = acceptanceVC
          
          // Initialize CHUM sync now that contact is accepted
          await this.initializeChumSync(peerId, personId)
          
          // Send acceptance notification to peer
          await this.sendAcceptanceNotification(peerId, acceptanceVC)
          break
        }
      }
    })
    
    // When a contact is blocked, close the connection
    this.trustManager.on('contact-blocked', async (event) => {
      const { personId } = event
      
      // Find and disconnect the peer
      for (const [peerId, peer] of this.peers) {
        if (peer.personId === personId) {
          console.log('[QuicVCTransport] Contact blocked, closing connection:', peerId)
          peer.connection?.close()
          this.peers.delete(peerId)
          break
        }
      }
    })
  }

  /**
   * Initialize QUIC-VC transport
   */
  async initialize() {
    console.log('[QuicVCTransport] Initializing QUIC-VC transport...')
    
    try {
      // Check if QUIC transport is available
      const { getQuicTransport } = await import('../../packages/one.core/lib/system/quic-transport.js')
      const quicTransport = getQuicTransport()
      
      if (!quicTransport) {
        console.log('[QuicVCTransport] QUIC transport not available, falling back to CommServer')
        return false
      }
      
      // Start QUIC server for incoming connections
      await this.startQuicServer(quicTransport)
      
      // Start UDP discovery socket (like LAMA)
      await this.startDiscoverySocket()
      
      // Start broadcasting discovery messages
      this.startDiscoveryBroadcast()
      
      // Start pruning old devices
      this.startDevicePruning()
      
      console.log('[QuicVCTransport] ✅ QUIC-VC transport initialized on port', this.port)
      return true
      
    } catch (error) {
      console.error('[QuicVCTransport] Failed to initialize:', error)
      return false
    }
  }

  /**
   * Start QUIC server for incoming CHUM connections
   */
  async startQuicServer(quicTransport) {
    console.log('[QuicVCTransport] Starting QUIC server on port', this.port)
    
    // Create QUIC server configuration
    this.quicServer = await quicTransport.createServer({
      port: this.port,
      host: '0.0.0.0', // Listen on all interfaces
      
      // Connection handler
      onConnection: async (connection) => {
        console.log('[QuicVCTransport] New QUIC connection from:', connection.remoteAddress)
        
        // Handle CHUM protocol over QUIC
        this.handleQuicConnection(connection)
      }
    })
    
    await this.quicServer.listen()
    console.log('[QuicVCTransport] QUIC server listening on port', this.port)
  }

  /**
   * Handle incoming QUIC connection for CHUM
   */
  handleQuicConnection(connection) {
    // Extract peer info
    const peerId = connection.remoteAddress + ':' + connection.remotePort
    
    console.log('[QuicVCTransport] Handling QUIC connection from peer:', peerId)
    
    // Store peer connection
    this.peers.set(peerId, {
      connection,
      connectedAt: new Date().toISOString(),
      protocol: 'quic-vc'
    })
    
    // Setup CHUM protocol handlers
    connection.on('stream', (stream) => {
      this.handleChumStream(stream, peerId)
    })
    
    connection.on('close', () => {
      console.log('[QuicVCTransport] Peer disconnected:', peerId)
      this.peers.delete(peerId)
    })
    
    // Emit connection event for ConnectionsModel integration
    this.emit('connection', {
      peerId,
      transport: 'quic-vc',
      connection
    })
  }

  /**
   * Handle CHUM data stream over QUIC
   */
  handleChumStream(stream, peerId) {
    console.log('[QuicVCTransport] New CHUM stream from peer:', peerId)
    
    // Forward to ConnectionsModel for CHUM protocol handling
    if (this.nodeOneCore.connectionsModel) {
      // Integration point with ConnectionsModel
      // The stream carries CHUM protocol messages
      this.nodeOneCore.connectionsModel.handleQuicStream?.(stream, peerId)
    }
    
    stream.on('data', (data) => {
      // Log CHUM traffic for debugging
      console.log('[QuicVCTransport] CHUM data from', peerId, ':', data.length, 'bytes')
    })
    
    stream.on('end', () => {
      console.log('[QuicVCTransport] CHUM stream ended from peer:', peerId)
    })
  }

  /**
   * Start UDP discovery socket for broadcast discovery (like LAMA)
   */
  async startDiscoverySocket() {
    return new Promise((resolve, reject) => {
      this.udpSocket = dgram.createSocket('udp4')
      
      // Enable broadcast
      this.udpSocket.on('listening', () => {
        this.udpSocket.setBroadcast(true)
        const address = this.udpSocket.address()
        console.log(`[QuicVCTransport] Discovery socket listening on ${address.address}:${address.port}`)
        resolve()
      })
      
      // Handle incoming discovery messages
      this.udpSocket.on('message', (msg, rinfo) => {
        this.handleDiscoveryMessage(msg, rinfo)
      })
      
      // Handle errors
      this.udpSocket.on('error', (err) => {
        console.error('[QuicVCTransport] Discovery socket error:', err)
        this.emit('error', err)
        reject(err)
      })
      
      // Bind to discovery port
      this.udpSocket.bind(this.discoveryPort)
    })
  }

  /**
   * Start broadcasting discovery messages
   */
  startDiscoveryBroadcast() {
    // Create discovery message (like LAMA's format)
    const discoveryMessage = {
      type: 'discovery',
      deviceId: this.nodeOneCore.instanceName || 'lama-node',
      deviceName: 'LAMA Node',
      deviceType: 'node',
      capabilities: ['chum', 'quic-vc'],
      version: '1.0',
      personId: this.nodeOneCore.ownerId,
      address: '0.0.0.0', // Will be filled by receiver
      port: this.port,
      timestamp: Date.now()
    }
    
    const broadcast = () => {
      const message = Buffer.from(JSON.stringify(discoveryMessage))
      this.udpSocket.send(message, this.discoveryPort, this.broadcastAddress, (err) => {
        if (err) {
          console.error('[QuicVCTransport] Broadcast error:', err)
        } else {
          console.log('[QuicVCTransport] Discovery broadcast sent')
        }
      })
    }
    
    // Initial broadcast
    broadcast()
    
    // Schedule periodic broadcasts
    this.discoveryTimer = setInterval(broadcast, this.discoveryInterval)
    
    console.log('[QuicVCTransport] ✅ Started discovery broadcast')
  }

  /**
   * Start pruning old devices
   */
  startDevicePruning() {
    this.pruneTimer = setInterval(() => {
      const now = Date.now()
      const staleDevices = []
      
      for (const [deviceId, device] of this.devices) {
        if (now - device.lastSeen > this.maxAge) {
          staleDevices.push(deviceId)
        }
      }
      
      for (const deviceId of staleDevices) {
        console.log('[QuicVCTransport] Removing stale device:', deviceId)
        this.devices.delete(deviceId)
        this.emit('device-lost', deviceId)
      }
    }, 10000) // Prune every 10 seconds
    
    console.log('[QuicVCTransport] ✅ Started device pruning')
  }

  /**
   * Handle incoming discovery message
   */
  handleDiscoveryMessage(msg, rinfo) {
    try {
      const message = JSON.parse(msg.toString())
      
      // Skip our own messages
      if (message.deviceId === this.nodeOneCore.instanceName) {
        return
      }
      
      // Skip non-discovery messages
      if (message.type !== 'discovery') {
        return
      }
      
      console.log(`[QuicVCTransport] Discovery from ${rinfo.address}:${rinfo.port}:`, message.deviceId)
      
      // Update device info
      const device = {
        ...message,
        address: rinfo.address,
        lastSeen: Date.now()
      }
      
      const isNew = !this.devices.has(message.deviceId)
      this.devices.set(message.deviceId, device)
      
      if (isNew) {
        console.log('[QuicVCTransport] 🔍 New device discovered:', message.deviceId)
        this.emit('device-discovered', device)
        
        // Only connect to devices that support QUIC-VC
        if (message.capabilities?.includes('quic-vc')) {
          this.connectToPeer(device)
        }
      } else {
        this.emit('device-updated', device)
      }
      
    } catch (error) {
      console.error('[QuicVCTransport] Failed to parse discovery message:', error)
    }
  }

  /**
   * Connect to a discovered peer via QUIC
   */
  async connectToPeer(device) {
    const peerId = `${device.address}:${device.port}`
    
    // Check if already connected
    if (this.peers.has(peerId)) {
      console.log('[QuicVCTransport] Already connected to peer:', peerId)
      return
    }
    
    console.log('[QuicVCTransport] Connecting to peer:', peerId)
    
    try {
      const { getQuicTransport } = await import('../../packages/one.core/lib/system/quic-transport.js')
      const quicTransport = getQuicTransport()
      
      const connection = await quicTransport.connect({
        host: device.address,
        port: device.port
      })
      
      // Store peer connection (initially unverified)
      this.peers.set(peerId, {
        connection,
        device,
        connectedAt: new Date().toISOString(),
        protocol: 'quic-vc',
        initiatedByUs: true,
        personId: device.personId,
        verified: false,
        contact: null
      })
      
      console.log('[QuicVCTransport] ✅ Connected to peer:', peerId)
      
      // Initiate VC exchange for authentication
      await this.initiateVCExchange(peerId)
      
      // Setup connection handlers
      connection.on('close', () => {
        console.log('[QuicVCTransport] Peer connection closed:', peerId)
        this.handlePeerDisconnection(peerId)
      })
      
      // Handle incoming VC messages
      connection.on('stream', (stream) => {
        this.handleVCStream(stream, peerId)
      })
      
    } catch (error) {
      console.error('[QuicVCTransport] Failed to connect to peer:', peerId, error)
    }
  }

  /**
   * Initiate VC exchange with a peer
   */
  async initiateVCExchange(peerId) {
    const peer = this.peers.get(peerId)
    if (!peer) return
    
    console.log('[QuicVCTransport] Initiating VC exchange with:', peerId)
    
    try {
      // Create our VC (Verifiable Credential)
      const myVC = await this.createVerifiableCredential()
      
      // Send VC request
      const vcRequest = {
        type: 'vc_request',
        credential: myVC,
        timestamp: Date.now(),
        nonce: crypto.randomBytes(16).toString('hex')
      }
      
      // Store pending request
      this.pendingVCRequests.set(peerId, {
        request: vcRequest,
        timestamp: Date.now()
      })
      
      // Send via QUIC stream
      const stream = await peer.connection.openStream()
      stream.write(JSON.stringify(vcRequest))
      stream.end()
      
      // Set timeout for VC response
      setTimeout(() => {
        if (this.pendingVCRequests.has(peerId)) {
          console.log('[QuicVCTransport] VC exchange timeout for:', peerId)
          this.pendingVCRequests.delete(peerId)
          this.handleVCExchangeFailure(peerId, 'Timeout')
        }
      }, this.vcExchangeTimeout)
      
    } catch (error) {
      console.error('[QuicVCTransport] Failed to initiate VC exchange:', error)
      this.handleVCExchangeFailure(peerId, error.message)
    }
  }

  /**
   * Create a Verifiable Credential for this node
   */
  async createVerifiableCredential() {
    const { getInstanceIdHash, getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
    const { getDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js')
    
    const instanceId = getInstanceIdHash()
    const personId = getInstanceOwnerIdHash()
    const keys = await getDefaultKeys(personId)
    
    // Create credential following ONE.core patterns
    const credential = {
      $type$: 'VerifiableCredential',
      issuer: personId,
      subject: personId,
      instanceId: instanceId,
      instanceName: this.nodeOneCore.instanceName,
      publicKey: keys.publicSignKey,
      capabilities: ['chum', 'quic-vc'],
      issuedAt: Date.now(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
    }
    
    // Sign the credential
    const { sign } = await import('@refinio/one.core/lib/crypto/sign.js')
    const signature = await sign(JSON.stringify(credential), keys.privateSignKey)
    
    return {
      ...credential,
      signature: signature
    }
  }

  /**
   * Handle incoming VC stream
   */
  async handleVCStream(stream, peerId) {
    let data = ''
    
    stream.on('data', (chunk) => {
      data += chunk.toString()
    })
    
    stream.on('end', async () => {
      try {
        const message = JSON.parse(data)
        
        if (message.type === 'vc_request') {
          await this.handleVCRequest(message, peerId)
        } else if (message.type === 'vc_response') {
          await this.handleVCResponse(message, peerId)
        } else if (message.type === 'dedicated_vc') {
          await this.handleDedicatedVC(message, peerId)
        } else if (message.type === 'contact_accepted') {
          await this.handleContactAcceptance(message, peerId)
        } else if (message.type === 'contact_rejected') {
          await this.handleContactRejection(message, peerId)
        } else if (message.type === 'chum') {
          await this.handleChumMessage(message, peerId)
        } else if (message.type === 'channel-update') {
          await this.handleChannelUpdate(message, peerId)
        }
      } catch (error) {
        console.error('[QuicVCTransport] Failed to handle stream:', error)
      }
    })
  }

  /**
   * Handle dedicated VC from accepted contact
   */
  async handleDedicatedVC(message, peerId) {
    console.log('[QuicVCTransport] Received dedicated VC from:', peerId)
    
    const peer = this.peers.get(peerId)
    if (!peer) {
      console.warn('[QuicVCTransport] Received dedicated VC from unknown peer')
      return
    }
    
    // Pass to contact manager for verification and storage
    await this.contactManager.handleReceivedDedicatedVC(message.vc, peerId)
    
    // Mark peer as fully verified with dedicated VC
    peer.verified = true
    peer.dedicatedVC = message.vc
    peer.mutuallyAccepted = true
    
    // Now we can start CHUM sync
    const personId = message.vc.issuer
    await this.initializeChumSync(peerId, personId)
    
    console.log('[QuicVCTransport] ✅ Mutual contact established with:', personId)
    
    // Emit event
    this.emit('mutual-contact-established', {
      peerId: peerId,
      personId: personId,
      dedicatedVC: message.vc
    })
  }

  /**
   * Handle contact acceptance message
   */
  async handleContactAcceptance(message, peerId) {
    console.log('[QuicVCTransport] Contact accepted by peer:', peerId)
    
    const peer = this.peers.get(peerId)
    if (peer) {
      peer.mutuallyAccepted = true
      peer.acceptanceVC = message.acceptanceVC
      peer.trustLevel = this.trustManager.TRUST_LEVELS.ACCEPTED
      
      // Now we can initialize CHUM sync
      if (peer.personId) {
        await this.initializeChumSync(peerId, peer.personId)
      }
    }
    
    // Emit event for UI
    this.emit('contact-accepted-by-peer', {
      peerId: peerId,
      acceptanceVC: message.acceptanceVC
    })
  }

  /**
   * Handle contact rejection message
   */
  async handleContactRejection(message, peerId) {
    console.log('[QuicVCTransport] Contact rejected by peer:', peerId)
    
    const peer = this.peers.get(peerId)
    if (peer) {
      peer.rejected = true
      peer.rejectionReason = message.reason
    }
    
    // Emit event for UI
    this.emit('contact-rejected-by-peer', {
      peerId: peerId,
      reason: message.reason
    })
    
    // Optionally close the connection
    setTimeout(() => {
      if (this.peers.has(peerId)) {
        const p = this.peers.get(peerId)
        p.connection?.close()
        this.peers.delete(peerId)
      }
    }, 5000) // Give time for any final messages
  }

  /**
   * Handle incoming CHUM message
   */
  async handleChumMessage(message, peerId) {
    const peer = this.peers.get(peerId)
    if (!peer || !peer.verified) {
      console.warn('[QuicVCTransport] Received CHUM message from unverified peer:', peerId)
      return
    }
    
    console.log('[QuicVCTransport] Received CHUM message from:', peerId)
    
    // If we have a CHUM protocol handler, pass it there
    if (peer.chumProtocol) {
      await peer.chumProtocol.handleMessage(message.data)
    } else {
      // Emit for external handling
      this.emit('chum-message', {
        peerId: peerId,
        data: message.data,
        timestamp: message.timestamp
      })
    }
  }

  /**
   * Handle channel update notification
   */
  async handleChannelUpdate(message, peerId) {
    const peer = this.peers.get(peerId)
    if (!peer || !peer.verified) {
      console.warn('[QuicVCTransport] Received channel update from unverified peer:', peerId)
      return
    }
    
    console.log(`[QuicVCTransport] Channel update from ${peerId}:`, message.channelId)
    
    // Emit for external handling (e.g., UI updates)
    this.emit('channel-update', {
      peerId: peerId,
      channelId: message.channelId,
      timestamp: message.timestamp,
      from: message.from
    })
    
    // If we have the channel, we might want to pull updates
    if (this.nodeOneCore.channelManager) {
      // The channel manager will handle syncing based on access rights
      console.log(`[QuicVCTransport] Channel ${message.channelId} marked for sync`)
    }
  }

  /**
   * Handle incoming VC request
   */
  async handleVCRequest(message, peerId) {
    console.log('[QuicVCTransport] Received VC request from:', peerId)
    
    try {
      // Verify the peer's credential
      const verified = await this.verifyCredential(message.credential)
      
      if (verified) {
        // Create discovery VC for this contact
        const discoveryVC = await this.trustManager.createDiscoveryVC(
          message.credential,
          peerId,
          this.trustManager.DISCOVERY_SOURCES.QUIC_VC
        )
        
        // Store the contact immediately with discovery VC
        const contact = await this.trustManager.storeContactWithVC(
          message.credential,
          discoveryVC
        )
        
        console.log('[QuicVCTransport] Contact stored with discovery VC:', {
          personId: message.credential.subject,
          trustLevel: this.trustManager.TRUST_LEVELS.DISCOVERED,
          vcHash: contact.vcHash
        })
        
        // Store peer info for later use
        const peer = this.peers.get(peerId)
        if (peer) {
          peer.personId = message.credential.subject
          peer.discoveryVCHash = contact.vcHash
          peer.trustLevel = this.trustManager.TRUST_LEVELS.DISCOVERED
          peer.contact = contact
          peer.credential = message.credential
        }
        
        // Send our initial credential in response (not the dedicated one yet)
        const myVC = await this.createVerifiableCredential()
        
        const response = {
          type: 'vc_response',
          credential: myVC,
          nonce: message.nonce,
          timestamp: Date.now(),
          status: 'pending_acceptance' // Indicate contact is pending
        }
        
        if (peer) {
          const stream = await peer.connection.openStream()
          stream.write(JSON.stringify(response))
          stream.end()
        }
        
        console.log('[QuicVCTransport] Contact stored, awaiting user acceptance')
        
        // Emit event for UI notification
        this.emit('contact-discovered', {
          personId: message.credential.subject,
          peerId: peerId,
          trustLevel: this.trustManager.TRUST_LEVELS.DISCOVERED,
          vcHash: contact.vcHash,
          displayInfo: {
            name: message.credential.instanceName || 'Unknown',
            personId: message.credential.subject
          }
        })
        
      } else {
        console.log('[QuicVCTransport] VC verification failed for:', peerId)
        this.handleVCExchangeFailure(peerId, 'Verification failed')
      }
    } catch (error) {
      console.error('[QuicVCTransport] Failed to handle VC request:', error)
      this.handleVCExchangeFailure(peerId, error.message)
    }
  }

  /**
   * Handle VC response
   */
  async handleVCResponse(message, peerId) {
    console.log('[QuicVCTransport] Received VC response from:', peerId)
    
    // Check if we have a pending request
    if (!this.pendingVCRequests.has(peerId)) {
      console.log('[QuicVCTransport] Unexpected VC response from:', peerId)
      return
    }
    
    this.pendingVCRequests.delete(peerId)
    
    try {
      // Verify the peer's credential
      const verified = await this.verifyCredential(message.credential)
      
      if (verified) {
        // Check response status
        if (message.status === 'pending_acceptance') {
          console.log('[QuicVCTransport] Peer indicates contact is pending acceptance')
        }
        
        // Add to pending contacts for user review (same as request)
        const peer = this.peers.get(peerId)
        const pendingId = await this.contactManager.addPendingContact(
          message.credential,
          peerId,
          {
            address: peer?.device?.address,
            port: peer?.device?.port,
            connectionTime: peer?.connectedAt
          }
        )
        
        // Store pending ID with peer
        if (peer) {
          peer.pendingContactId = pendingId
          peer.pendingCredential = message.credential
        }
        
        console.log('[QuicVCTransport] Contact stored, awaiting user acceptance')
        
        // Emit event for UI notification
        this.emit('contact-discovered', {
          personId: message.credential.subject,
          peerId: peerId,
          trustLevel: this.trustManager.TRUST_LEVELS.DISCOVERED,
          vcHash: contact.vcHash,
          displayInfo: {
            name: message.credential.instanceName || 'Unknown',
            personId: message.credential.subject
          }
        })
        
      } else {
        console.log('[QuicVCTransport] VC verification failed for:', peerId)
        this.handleVCExchangeFailure(peerId, 'Verification failed')
      }
    } catch (error) {
      console.error('[QuicVCTransport] Failed to handle VC response:', error)
      this.handleVCExchangeFailure(peerId, error.message)
    }
  }

  /**
   * Verify a credential
   */
  async verifyCredential(credential) {
    try {
      const { verify } = await import('@refinio/one.core/lib/crypto/sign.js')
      const { getDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js')
      
      // Get the issuer's public key (in real scenario, would fetch from trusted source)
      // For now, use the key in the credential itself
      const publicKey = credential.publicKey
      
      // Verify signature
      const credentialCopy = { ...credential }
      delete credentialCopy.signature
      
      const isValid = await verify(
        JSON.stringify(credentialCopy),
        credential.signature,
        publicKey
      )
      
      // Check expiration
      if (isValid && credential.expiresAt > Date.now()) {
        return true
      }
      
      return false
    } catch (error) {
      console.error('[QuicVCTransport] Credential verification error:', error)
      return false
    }
  }

  /**
   * Create a contact from a verified credential (DEPRECATED - use ContactAcceptanceManager)
   * @deprecated
   */
  async createContactFromVC_DEPRECATED(credential, peerId) {
    console.log('[QuicVCTransport] Creating contact from VC for:', peerId)
    
    try {
      const { Person } = await import('@refinio/one.core/lib/recipes.js')
      const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
      
      // Create Person object for the peer
      const person = {
        $type$: 'Person',
        name: credential.instanceName || 'Unknown',
        email: `${credential.subject.substring(0, 8)}@quic-vc.local`
      }
      
      const personHash = await storeVersionedObject(person)
      
      // Create Profile with endpoint information
      const peer = this.peers.get(peerId)
      if (!peer) return
      
      const { ProfileModel } = await import('@refinio/one.models/lib/models/Leute/ProfileModel.js')
      const { OneInstanceEndpoint } = await import('@refinio/one.core/lib/recipes.js')
      
      // Create OneInstanceEndpoint for the peer
      const endpoint = {
        $type$: 'OneInstanceEndpoint',
        personId: credential.subject,
        instanceId: credential.instanceId,
        personKeys: { publicSignKey: credential.publicKey },
        instanceKeys: { publicSignKey: credential.publicKey }
      }
      
      // Create profile with endpoint
      const profile = await ProfileModel.constructWithNewProfile(
        credential.subject,
        this.nodeOneCore.ownerId,
        'quic-vc-peer',
        [endpoint],
        [credential.publicKey]
      )
      
      // Add to contacts via LeuteModel
      if (this.nodeOneCore.leuteModel) {
        const { SomeoneModel } = await import('@refinio/one.models/lib/models/Leute/SomeoneModel.js')
        
        // Create Someone object
        const someone = await SomeoneModel.constructWithNewSomeone({
          $type$: 'Person',
          ...person
        })
        
        // Add to contacts
        await this.nodeOneCore.leuteModel.addSomeoneElse(someone.idHash)
        
        // Update peer info
        peer.verified = true
        peer.contact = {
          personHash: personHash,
          someoneHash: someone.idHash,
          profileHash: profile.idHash
        }
        
        // Store verified peer
        this.verifiedPeers.set(credential.subject, {
          peerId: peerId,
          credential: credential,
          contact: peer.contact,
          verifiedAt: Date.now()
        })
        
        console.log('[QuicVCTransport] ✅ Contact created for peer:', peerId)
        
        // Emit event for successful VC exchange
        this.emit('peer-verified', {
          peerId: peerId,
          personId: credential.subject,
          contact: peer.contact
        })
        
        // Now CHUM can sync with this verified contact
        console.log('[QuicVCTransport] Peer ready for CHUM sync:', peerId)
        
        // Initialize CHUM sync for this peer
        await this.initializeChumSync(peerId, credential.subject)
      }
      
    } catch (error) {
      console.error('[QuicVCTransport] Failed to create contact:', error)
      throw error
    }
  }

  /**
   * Initialize CHUM sync for a verified peer
   */
  async initializeChumSync(peerId, remotePersonId) {
    console.log('[QuicVCTransport] Initializing CHUM sync for peer:', peerId)
    
    try {
      const peer = this.peers.get(peerId)
      if (!peer) {
        console.error('[QuicVCTransport] Peer not found')
        return
      }
      
      // Check if we can sync with this contact based on trust
      const canSync = await this.trustManager.canCommunicateWith(remotePersonId, 'sync')
      if (!canSync) {
        console.log('[QuicVCTransport] CHUM sync not allowed - contact not accepted yet')
        return
      }
      
      // Ensure P2P channel exists for this contact
      await this.ensureP2PChannel(remotePersonId)
      
      // Check if ConnectionsModel is available
      if (!this.nodeOneCore.connectionsModel) {
        console.warn('[QuicVCTransport] ConnectionsModel not available, using direct sync')
        // Use direct channel sync as fallback
        await this.setupDirectChannelSync(peerId, remotePersonId)
        return
      }
      
      // Register this QUIC connection as a transport for CHUM
      await this.registerQuicTransportForChum(peerId, remotePersonId)
      
      // Start CHUM protocol
      await this.startChumProtocol(peerId, remotePersonId)
      
      console.log('[QuicVCTransport] ✅ CHUM sync initialized for:', peerId)
      
    } catch (error) {
      console.error('[QuicVCTransport] Failed to initialize CHUM sync:', error)
    }
  }

  /**
   * Ensure a P2P channel exists between us and the peer
   */
  async ensureP2PChannel(remotePersonId) {
    try {
      if (!this.nodeOneCore.channelManager) {
        console.warn('[QuicVCTransport] ChannelManager not available')
        return
      }
      
      // Create P2P channel ID (smaller ID first)
      const myId = this.nodeOneCore.ownerId
      const channelId = myId < remotePersonId 
        ? `${myId}<->${remotePersonId}`
        : `${remotePersonId}<->${myId}`
      
      // Check if channel already exists
      const existingChannels = await this.nodeOneCore.channelManager.channels()
      const channelExists = existingChannels.some(ch => ch.id === channelId)
      
      if (channelExists) {
        console.log(`[QuicVCTransport] P2P channel already exists: ${channelId}`)
        return
      }
      
      // Create the P2P channel
      console.log(`[QuicVCTransport] Creating P2P channel: ${channelId}`)
      
      try {
        // Create channel owned by us (we create our own channel)
        await this.nodeOneCore.channelManager.createChannel(channelId, myId)
        
        console.log(`[QuicVCTransport] ✅ P2P channel created: ${channelId} with owner: ${myId.substring(0, 8)}`)
      } catch (error) {
        // Channel might already exist or creation might fail
        console.log(`[QuicVCTransport] Could not create P2P channel:`, error.message)
      }
      
      // Also ensure the remote peer's channel exists in our channel manager
      // They will share it with us via CHUM, but we need to be ready for it
      try {
        await this.nodeOneCore.channelManager.createChannel(channelId, remotePersonId)
        console.log(`[QuicVCTransport] ✅ Created reference to peer's channel: ${channelId} with owner: ${remotePersonId.substring(0, 8)}`)
      } catch (error) {
        console.log(`[QuicVCTransport] Could not create peer's channel reference:`, error.message)
      }
      
    } catch (error) {
      console.error('[QuicVCTransport] Failed to ensure P2P channel:', error)
    }
  }

  /**
   * Register QUIC transport with ConnectionsModel for CHUM
   */
  async registerQuicTransportForChum(peerId, remotePersonId) {
    console.log('[QuicVCTransport] Registering QUIC transport for CHUM')
    
    const peer = this.peers.get(peerId)
    if (!peer) return
    
    // Create a transport adapter for ConnectionsModel
    const quicTransportAdapter = {
      type: 'quic-vc',
      peerId: peerId,
      remotePersonId: remotePersonId,
      
      // Send method for CHUM messages
      send: async (data) => {
        try {
          const stream = await peer.connection.openStream()
          
          // Add CHUM protocol header
          const chumMessage = {
            type: 'chum',
            data: data,
            timestamp: Date.now()
          }
          
          stream.write(JSON.stringify(chumMessage))
          stream.end()
          
          return true
        } catch (error) {
          console.error('[QuicVCTransport] Failed to send CHUM message:', error)
          return false
        }
      },
      
      // Close method
      close: () => {
        peer.connection?.close()
      },
      
      // Check if connected
      isConnected: () => {
        return peer.connection && !peer.connection.destroyed
      }
    }
    
    // Store transport adapter
    peer.transportAdapter = quicTransportAdapter
    
    // If ConnectionsModel has a way to register custom transports, use it
    // Otherwise, we'll handle CHUM messages directly
    if (this.nodeOneCore.connectionsModel.registerCustomTransport) {
      await this.nodeOneCore.connectionsModel.registerCustomTransport(
        remotePersonId,
        quicTransportAdapter
      )
    }
    
    return quicTransportAdapter
  }

  /**
   * Start CHUM protocol for a peer
   */
  async startChumProtocol(peerId, remotePersonId) {
    console.log('[QuicVCTransport] Starting CHUM protocol for:', peerId)
    
    try {
      // Get the peer connection
      const peer = this.peers.get(peerId)
      if (!peer) return
      
      // Import CHUM protocol handler
      const { ChumProtocol } = await import('@refinio/one.models/lib/protocols/chum/ChumProtocol.js').catch(() => ({}))
      
      if (!ChumProtocol) {
        console.log('[QuicVCTransport] ChumProtocol not available, using direct channel sync')
        
        // Fallback: Direct channel synchronization
        await this.setupDirectChannelSync(peerId, remotePersonId)
        return
      }
      
      // Create CHUM protocol instance for this peer
      peer.chumProtocol = new ChumProtocol({
        localPersonId: this.nodeOneCore.ownerId,
        remotePersonId: remotePersonId,
        transport: peer.transportAdapter,
        channelManager: this.nodeOneCore.channelManager,
        onMessage: (channelId, message) => {
          console.log(`[QuicVCTransport] CHUM message received in channel ${channelId}`)
          this.emit('chum-message', {
            peerId: peerId,
            channelId: channelId,
            message: message
          })
        }
      })
      
      // Start CHUM sync
      await peer.chumProtocol.start()
      
      console.log('[QuicVCTransport] CHUM protocol started for:', peerId)
      
    } catch (error) {
      console.error('[QuicVCTransport] Failed to start CHUM protocol:', error)
      
      // Fallback to direct sync
      await this.setupDirectChannelSync(peerId, remotePersonId)
    }
  }

  /**
   * Setup direct channel synchronization (fallback when CHUM not available)
   */
  async setupDirectChannelSync(peerId, remotePersonId) {
    console.log('[QuicVCTransport] Setting up direct channel sync for:', peerId)
    
    try {
      const peer = this.peers.get(peerId)
      if (!peer) return
      
      // Check if we can sync channels with this contact
      const canShareChannels = await this.trustManager.canCommunicateWith(remotePersonId, 'channel')
      if (!canShareChannels) {
        console.log('[QuicVCTransport] Channel sync not allowed - contact not accepted')
        return
      }
      
      // Get channels from ChannelManager
      if (!this.nodeOneCore.channelManager) {
        console.warn('[QuicVCTransport] ChannelManager not available')
        return
      }
      
      // Get all channels
      const channels = await this.nodeOneCore.channelManager.channels()
      
      // Create channel sync state
      peer.channelSync = {
        remotePersonId: remotePersonId,
        syncedChannels: new Set(),
        sharedChannels: new Set(), // Channels we both participate in
        lastSync: Date.now()
      }
      
      // Check which channels the remote peer participates in
      for (const channel of channels) {
        if (channel.id && channel.channelInfoIdHash) {
          // Check if this is a shared channel
          const isSharedChannel = await this.isSharedChannel(channel, remotePersonId)
          
          if (isSharedChannel) {
            // This channel should sync between us
            peer.channelSync.sharedChannels.add(channel.id)
            peer.channelSync.syncedChannels.add(channel.id)
            
            console.log(`[QuicVCTransport] Shared channel ${channel.id} will sync with ${peerId}`)
            
            // The channel access is already defined by the channel's participant list
            // No need to grant additional access
          }
        }
      }
      
      // Listen for new messages in shared channels
      this.nodeOneCore.channelManager.onUpdated((channelInfoIdHash, channelId, owner, time) => {
        // Only send updates for shared channels
        if (peer.channelSync?.sharedChannels.has(channelId)) {
          // Send channel update notification to peer
          this.sendChannelUpdate(peerId, channelId, time)
        }
      })
      
      // Also check for new channels being created
      this.nodeOneCore.channelManager.onCreated((channelInfoIdHash, channelId, owner) => {
        // Check if the new channel includes the remote peer
        this.checkNewChannelForPeer(channelId, peerId, remotePersonId)
      })
      
      console.log(`[QuicVCTransport] ✅ Channel sync setup: ${peer.channelSync.sharedChannels.size} shared channels with ${peerId}`)
      
    } catch (error) {
      console.error('[QuicVCTransport] Failed to setup direct channel sync:', error)
    }
  }

  /**
   * Check if a channel is shared between us and a remote peer
   */
  async isSharedChannel(channel, remotePersonId) {
    try {
      // Check different channel types
      
      // 1. Direct person-to-person channel
      if (channel.id.includes('<->')) {
        // Format: personId1<->personId2 (smaller ID first)
        const participants = channel.id.split('<->')
        const isP2P = participants.includes(this.nodeOneCore.ownerId) && 
                      participants.includes(remotePersonId)
        if (isP2P) {
          console.log(`[QuicVCTransport] P2P channel detected: ${channel.id}`)
          return true
        }
      }
      
      // 2. Group channel with participants
      if (channel.participants) {
        // Check if both we and the remote peer are participants
        const hasUs = channel.participants.includes(this.nodeOneCore.ownerId)
        const hasThem = channel.participants.includes(remotePersonId)
        if (hasUs && hasThem) {
          console.log(`[QuicVCTransport] Group channel with both participants: ${channel.id}`)
          return true
        }
      }
      
      // 3. Topic-based channel (check TopicModel if available)
      if (this.nodeOneCore.topicModel && channel.topicId) {
        const topic = await this.nodeOneCore.topicModel.getTopic(channel.topicId)
        if (topic && topic.participants) {
          const hasUs = topic.participants.includes(this.nodeOneCore.ownerId)
          const hasThem = topic.participants.includes(remotePersonId)
          if (hasUs && hasThem) {
            console.log(`[QuicVCTransport] Topic channel with both participants: ${channel.id}`)
            return true
          }
        }
      }
      
      // 4. Check channel access rights (if explicitly granted)
      const { hasAccess } = await import('@refinio/one.core/lib/access.js')
      const canAccess = await hasAccess(channel.channelInfoIdHash, remotePersonId)
      if (canAccess) {
        console.log(`[QuicVCTransport] Channel with explicit access: ${channel.id}`)
        return true
      }
      
      return false
      
    } catch (error) {
      console.error('[QuicVCTransport] Error checking shared channel:', error)
      return false
    }
  }

  /**
   * Check if a newly created channel should be shared with a peer
   */
  async checkNewChannelForPeer(channelId, peerId, remotePersonId) {
    const peer = this.peers.get(peerId)
    if (!peer || !peer.channelSync) return
    
    try {
      // Get the channel info
      const channel = await this.nodeOneCore.channelManager.getChannel(channelId)
      if (!channel) return
      
      // Check if it's a shared channel
      const isShared = await this.isSharedChannel(channel, remotePersonId)
      
      if (isShared && !peer.channelSync.sharedChannels.has(channelId)) {
        // Add to shared channels
        peer.channelSync.sharedChannels.add(channelId)
        peer.channelSync.syncedChannels.add(channelId)
        
        console.log(`[QuicVCTransport] New shared channel ${channelId} added for sync with ${peerId}`)
        
        // Notify peer about the new channel
        this.sendChannelUpdate(peerId, channelId, Date.now())
      }
    } catch (error) {
      console.error('[QuicVCTransport] Error checking new channel:', error)
    }
  }


  /**
   * Send channel update notification to peer
   */
  async sendChannelUpdate(peerId, channelId, timestamp) {
    const peer = this.peers.get(peerId)
    if (!peer || !peer.connection) return
    
    try {
      const stream = await peer.connection.openStream()
      
      const updateMessage = {
        type: 'channel-update',
        channelId: channelId,
        timestamp: timestamp,
        from: this.nodeOneCore.ownerId
      }
      
      stream.write(JSON.stringify(updateMessage))
      stream.end()
      
      console.log(`[QuicVCTransport] Channel update sent to ${peerId} for channel ${channelId}`)
      
    } catch (error) {
      console.error('[QuicVCTransport] Failed to send channel update:', error)
    }
  }

  /**
   * Handle VC exchange failure
   */
  /**
   * Send acceptance notification to peer
   */
  async sendAcceptanceNotification(peerId, acceptanceVC) {
    const peer = this.peers.get(peerId)
    if (!peer || !peer.connection) return
    
    try {
      const message = {
        type: 'contact_accepted',
        acceptanceVC: acceptanceVC,
        timestamp: Date.now()
      }
      
      const stream = await peer.connection.openStream()
      stream.write(JSON.stringify(message))
      stream.end()
      
      console.log('[QuicVCTransport] Sent acceptance notification to:', peerId)
    } catch (error) {
      console.error('[QuicVCTransport] Failed to send acceptance notification:', error)
    }
  }

  handleVCExchangeFailure(peerId, reason) {
    console.error('[QuicVCTransport] VC exchange failed for', peerId, ':', reason)
    
    const peer = this.peers.get(peerId)
    if (peer) {
      peer.verified = false
      peer.verificationError = reason
    }
    
    this.emit('peer-verification-failed', {
      peerId: peerId,
      reason: reason
    })
  }

  /**
   * Handle peer disconnection
   */
  handlePeerDisconnection(peerId) {
    const peer = this.peers.get(peerId)
    
    if (peer && peer.verified && peer.contact) {
      // Keep contact in ONE.core even if disconnected
      console.log('[QuicVCTransport] Verified peer disconnected, contact preserved:', peerId)
    }
    
    this.peers.delete(peerId)
    this.pendingVCRequests.delete(peerId)
  }

  /**
   * Get all connected peers
   */
  getConnectedPeers() {
    return Array.from(this.peers.entries()).map(([id, info]) => ({
      id,
      ...info,
      connection: undefined // Don't expose raw connection
    }))
  }

  /**
   * Get verified peers with contacts
   */
  getVerifiedPeers() {
    return Array.from(this.verifiedPeers.values())
  }

  /**
   * Send CHUM data to a specific peer
   */
  async sendToPeer(peerId, data, messageType = 'chum') {
    const peer = this.peers.get(peerId)
    
    if (!peer || !peer.connection) {
      console.warn('[QuicVCTransport] Peer not connected:', peerId)
      return false
    }
    
    // Only allow CHUM messages to verified peers
    if (messageType === 'chum' && !peer.verified) {
      console.warn('[QuicVCTransport] Cannot send CHUM to unverified peer:', peerId)
      return false
    }
    
    try {
      const stream = await peer.connection.openStream()
      
      // Wrap data in message envelope
      const message = {
        type: messageType,
        data: data,
        timestamp: Date.now(),
        from: this.nodeOneCore.ownerId
      }
      
      stream.write(JSON.stringify(message))
      stream.end()
      
      console.log(`[QuicVCTransport] Sent ${messageType} to peer:`, peerId)
      return true
      
    } catch (error) {
      console.error('[QuicVCTransport] Failed to send to peer:', peerId, error)
      return false
    }
  }

  /**
   * Send CHUM message to all verified peers
   */
  async broadcastChum(data) {
    const results = []
    
    for (const [peerId, peer] of this.peers) {
      if (peer.verified && peer.connection) {
        const sent = await this.sendToPeer(peerId, data, 'chum')
        results.push({ peerId, sent })
      }
    }
    
    console.log('[QuicVCTransport] CHUM broadcast to', results.length, 'verified peers')
    return results
  }

  /**
   * Get CHUM sync status for all peers
   */
  getChumSyncStatus() {
    const status = []
    
    for (const [peerId, peer] of this.peers) {
      status.push({
        peerId: peerId,
        verified: peer.verified || false,
        hasContact: !!peer.contact,
        hasChumProtocol: !!peer.chumProtocol,
        hasChannelSync: !!peer.channelSync,
        syncedChannels: peer.channelSync?.syncedChannels?.size || 0,
        connectedAt: peer.connectedAt,
        personId: peer.device?.personId
      })
    }
    
    return status
  }

  /**
   * Manually trigger CHUM sync for a peer
   */
  async triggerChumSync(peerId) {
    const peer = this.peers.get(peerId)
    
    if (!peer || !peer.verified) {
      console.error('[QuicVCTransport] Cannot sync with unverified peer:', peerId)
      return false
    }
    
    try {
      // Re-initialize CHUM sync
      await this.initializeChumSync(peerId, peer.device.personId)
      return true
    } catch (error) {
      console.error('[QuicVCTransport] Failed to trigger CHUM sync:', error)
      return false
    }
  }

  /**
   * Get list of discovered devices
   */
  getDiscoveredDevices() {
    return Array.from(this.devices.values())
  }

  /**
   * Get pending contacts for UI display
   */
  getPendingContacts() {
    return this.contactManager.getPendingContacts()
  }

  /**
   * Accept a pending contact
   */
  async acceptPendingContact(pendingId, options = {}) {
    return await this.contactManager.acceptContact(pendingId, options)
  }

  /**
   * Reject a pending contact
   */
  async rejectPendingContact(pendingId, reason) {
    return await this.contactManager.rejectContact(pendingId, reason)
  }

  /**
   * Get details of a pending contact
   */
  getPendingContactDetails(pendingId) {
    return this.contactManager.getPendingContact(pendingId)
  }

  /**
   * Check if a contact is mutually accepted
   */
  isContactMutuallyAccepted(personId) {
    return this.contactManager.isMutuallyAccepted(personId)
  }

  /**
   * Get contact's dedicated VC
   */
  getContactVC(personId) {
    return this.contactManager.getContactVC(personId)
  }

  /**
   * Revoke a contact's VC
   */
  async revokeContactVC(personId) {
    return await this.contactManager.revokeContactVC(personId)
  }

  /**
   * Shutdown QUIC-VC transport
   */
  async shutdown() {
    console.log('[QuicVCTransport] Shutting down...')
    
    // Stop discovery broadcasts
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer)
      this.discoveryTimer = null
    }
    
    // Stop device pruning
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer)
      this.pruneTimer = null
    }
    
    // Close UDP socket
    if (this.udpSocket) {
      this.udpSocket.close()
      this.udpSocket = null
    }
    
    // Close all peer connections
    for (const [peerId, peer] of this.peers) {
      peer.connection?.close()
    }
    this.peers.clear()
    this.devices.clear()
    
    // Stop QUIC server
    if (this.quicServer) {
      await this.quicServer.close()
    }
    
    console.log('[QuicVCTransport] ✅ Shutdown complete')
  }
}

export default QuicVCTransport