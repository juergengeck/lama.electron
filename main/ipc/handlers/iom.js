/**
 * IOM (Internet of Me) State Handlers
 * Provides real-time replication and sync status
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import nodeProvisioning from '../../hybrid/node-provisioning.js';
import nodeOneCore from '../../core/node-one-core.js';
import chumMonitor from '../../hybrid/chum-monitor.js';
import config from '../../config/iom-config.js';

// Track active CHUM connections and sync state
const iomState = {
  instances: new Map(),
  syncEvents: [],
  replicationErrors: [],
  activeChums: new Map(),
  connectionStates: new Map()
}

/**
 * Get current IOM instances and their states
 */
async function getIOMInstances(event) {
  try {
    const instances = []
    
    // Check if Node instance is provisioned
    if (nodeProvisioning.isProvisioned()) {
      const coreInfo = nodeOneCore.getInfo()
      const nodeState = {}
      
      // Get Node instance info
      const nodeInfo = {
        id: coreInfo?.ownerId || 'node-' + Date.now(),
        name: 'Desktop Node',
        type: 'node',
        role: nodeState['config.storageRole'] || 'archive',
        status: coreInfo?.initialized ? 'online' : 'offline',
        endpoint: nodeState['config.syncEndpoint'] || 'ws://localhost:8765',
        storage: await getStorageInfo('node'),
        lastSync: iomState.instances.get('node')?.lastSync || null,
        replication: {
          inProgress: iomState.activeChums.has('node'),
          lastCompleted: iomState.instances.get('node')?.lastCompleted || null,
          queueSize: 0,
          failedItems: 0,
          errors: []
        }
      }
      
      // Check for active CHUM sync from monitor
      const activeConnections = chumMonitor.getActiveConnections()
      if (activeConnections.length > 0) {
        nodeInfo.status = 'syncing'
        nodeInfo.replication.inProgress = true
        
        const latestConn = activeConnections[activeConnections.length - 1]
        if (latestConn.syncProgress) {
          nodeInfo.replication.queueSize = latestConn.syncProgress.queueSize || 0
        }
        if (latestConn.errors) {
          nodeInfo.replication.failedItems = latestConn.errors.length
          nodeInfo.replication.errors = latestConn.errors
        }
      }
      
      // CHUM sync will be handled by ChannelManager automatically
      
      instances.push(nodeInfo)
    }
    
    // Get Browser instance info (from renderer process)
    const browserStorageInfo = iomState.browserStorage || await getStorageInfo('browser')
    const browserInfo = {
      id: 'browser-' + Date.now(),
      name: 'Browser Instance',
      type: 'browser',
      role: 'cache',
      status: 'online', // Always online if we're running
      endpoint: 'indexeddb://local',
      storage: browserStorageInfo,
      lastSync: iomState.instances.get('browser')?.lastSync || null,
      replication: {
        inProgress: false,
        lastCompleted: null,
        queueSize: 0,
        failedItems: 0,
        errors: []
      }
    }
    
    instances.push(browserInfo)
    
    // Check for mobile instances (would come from discovery)
    // This would be populated from BLE/UDP discovery in real implementation
    
    return instances
  } catch (error) {
    console.error('[IOM] Failed to get instances:', error)
    throw error
  }
}

/**
 * Get storage information for an instance type
 */
async function getStorageInfo(type) {
  try {
    if (type === 'node') {
      const dataPath = path.join(process.cwd(), 'one-data-node')
      
      let totalSize = 0
      let availableSpace = 0
      
      // Get actual filesystem stats
      try {
        // Get disk usage for the volume containing the data directory
        if (process.platform === 'darwin' || process.platform === 'linux') {
          const dfOutput = execSync(`df -k "${process.cwd()}"`).toString()
          const lines = dfOutput.trim().split('\n')
          if (lines.length > 1) {
            const parts = lines[1].split(/\s+/)
            const totalBlocks = parseInt(parts[1]) * 1024 // Convert from KB to bytes
            const availableBlocks = parseInt(parts[3]) * 1024
            availableSpace = availableBlocks
          }
        } else if (process.platform === 'win32') {
          // Windows: use wmic to get disk space
          const drive = path.parse(process.cwd()).root
          const wmicOutput = execSync(`wmic logicaldisk where caption="${drive.replace(/\\/g, '')}" get size,freespace /value`).toString()
          const freeMatch = wmicOutput.match(/FreeSpace=(\d+)/)
          const sizeMatch = wmicOutput.match(/Size=(\d+)/)
          if (freeMatch && sizeMatch) {
            availableSpace = parseInt(freeMatch[1])
          }
        }
      } catch (e) {
        console.error('[IOM] Failed to get disk stats:', e)
        availableSpace = os.freemem() // Fallback to free memory
      }
      
      // Calculate actual used space
      try {
        const files = await fs.readdir(dataPath, { recursive: true })
        for (const file of files) {
          try {
            const filePath = path.join(dataPath, file)
            const stat = await fs.stat(filePath)
            if (stat.isFile()) {
              totalSize += stat.size
            }
          } catch (e) {
            // Ignore individual file errors
          }
        }
      } catch (e) {
        // Directory doesn't exist yet
        totalSize = 0
      }
      
      const totalCapacity = totalSize + availableSpace
      return {
        used: totalSize,
        total: totalCapacity,
        percentage: totalCapacity > 0 ? Math.round((totalSize / totalCapacity) * 100) : 0
      }
    } else if (type === 'browser') {
      // Browser storage quota should be queried from renderer process
      // Return placeholder that will be updated from renderer
      return {
        used: 0,
        total: 0, // Will be updated from renderer
        percentage: 0
      }
    }
    
    return {
      used: 0,
      total: 0,
      percentage: 0
    }
  } catch (error) {
    console.error('[IOM] Failed to get storage info:', error)
    return {
      used: 0,
      total: 0,
      percentage: 0
    }
  }
}

/**
 * Get replication events log
 */
async function getReplicationEvents(event) {
  return iomState.syncEvents.slice(-config.events.maxEventsInMemory).reverse()
}

/**
 * Add a replication event
 */
function addReplicationEvent(event) {
  const syncEvent = {
    id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date(),
    ...event
  }
  
  iomState.syncEvents.push(syncEvent)
  
  // Trim to max events
  if (iomState.syncEvents.length > config.events.maxEventsInMemory) {
    iomState.syncEvents = iomState.syncEvents.slice(-config.events.maxEventsInMemory)
  }
  
  // Broadcast to renderer (only if controller is initialized)
  // TODO: Need to handle this differently to avoid circular dependency
  // try {
  //   if (ipcController && ipcController.sendUpdate) {
  //     ipcController.sendUpdate('iom:replicationEvent', syncEvent)
  //   }
  // } catch (e) {
  //   // Controller not yet initialized
  // }
  
  return syncEvent
}

/**
 * Get data statistics
 */
async function getDataStats(event) {
  try {
    const stats = {
      totalObjects: 0,
      totalSize: 0,
      messages: 0,
      files: 0,
      contacts: 0,
      conversations: 0,
      versions: 0,
      recentActivity: 0
    }
    
    // Data is in the browser's IndexedDB, not in Node instance
    // Request data counts from renderer process
    if (event && event.sender) {
      // We're being called from renderer, it should provide the stats
      return stats
    }
    
    // For now, return cached stats if available
    if (iomState.cachedStats) {
      return iomState.cachedStats
    }
    
    // Get storage size
    const storageInfo = await getStorageInfo('node')
    stats.totalSize = storageInfo.used
    
    // Count recent activity
    const recentThreshold = Date.now() - config.events.recentActivityWindow
    stats.recentActivity = iomState.syncEvents.filter(
      evt => evt.timestamp && new Date(evt.timestamp).getTime() > recentThreshold
    ).length
    
    return stats
  } catch (error) {
    console.error('[IOM] Failed to get data stats:', error)
    return {
      totalObjects: 0,
      totalSize: 0,
      messages: 0,
      files: 0,
      contacts: 0,
      conversations: 0,
      versions: 0,
      recentActivity: 0
    }
  }
}

/**
 * Monitor CHUM sync status
 */
function monitorChumSync() {
  if (!nodeProvisioning.isProvisioned()) {
    return
  }
  
  // CHUM sync will be implemented later
  // For now just track that instances are initialized
  if (nodeOneCore.getInfo().initialized) {
    addReplicationEvent({
      type: 'sync-ready',
      source: 'node',
      target: 'browser',
      details: 'Instances ready for IoM communication',
      status: 'ready'
    })
  }
}

/**
 * Start IOM monitoring
 */
function startMonitoring() {
  // Monitor CHUM sync at configured interval
  setInterval(() => {
    monitorChumSync()
    // Clean up old connections
    chumMonitor.cleanupOldConnections()
  }, config.sync.statusCheckInterval)
  
  // Check for stale connections at configured interval
  setInterval(() => {
    chumMonitor.checkStaleConnections()
  }, config.sync.staleCheckInterval)
  
  // Listen to CHUM monitor events
  chumMonitor.on('connection:open', (connId) => {
    addReplicationEvent({
      type: 'sync-started',
      source: 'node',
      target: 'remote',
      details: `WebSocket connection established: ${connId}`,
      status: 'success'
    })
  })
  
  chumMonitor.on('connection:closed', (data) => {
    addReplicationEvent({
      type: 'sync-completed',
      source: 'node',
      target: 'remote',
      details: `Connection closed after ${Math.round(data.duration / 1000)}s`,
      status: data.code === config.connections.normalCloseCode ? 'success' : 'error'
    })
  })
  
  chumMonitor.on('connection:error', (data) => {
    addReplicationEvent({
      type: 'sync-failed',
      source: 'node',
      target: 'remote',
      details: data.error.message || 'Connection error',
      status: 'error'
    })
  })
  
  // Track last progress event time to throttle updates
  let lastProgressEventTime = 0
  
  chumMonitor.on('sync:progress', (data) => {
    const now = Date.now()
    // Throttle progress events to avoid overwhelming the UI
    if (now - lastProgressEventTime >= config.sync.progressReportInterval) {
      lastProgressEventTime = now
      addReplicationEvent({
        type: 'object-received',
        source: 'node',
        target: 'remote',
        details: `Sync progress: ${data.objectsProcessed || 0} objects`,
        status: 'pending'
      })
    }
  })
  
  chumMonitor.on('sync:completed', (data) => {
    addReplicationEvent({
      type: 'sync-completed',
      source: 'node',
      target: 'remote',
      details: `Sync completed: ${data.result.objectsSent} sent, ${data.result.objectsReceived} received`,
      status: data.result.errors.length > 0 ? 'error' : 'success'
    })
  })
  
  // Add initial event
  addReplicationEvent({
    type: 'monitoring-started',
    source: 'system',
    target: 'all',
    details: 'IOM replication monitoring started',
    status: 'success'
  })
}

// Start monitoring after a delay to ensure everything is initialized
setTimeout(() => {
  startMonitoring()
}, config.startup.monitoringStartDelay)

/**
 * Update browser storage info from renderer
 */
async function updateBrowserStorage(event, storageInfo) {
  iomState.browserStorage = storageInfo
  return { success: true }
}

/**
 * Update data statistics from renderer
 */
async function updateDataStats(event, stats) {
  iomState.cachedStats = stats
  return { success: true }
}

/**
 * Accept a pairing invitation in the Node.js ONE.core instance
 * This is called when THIS instance wants to connect to another instance using their invitation
 */
async function acceptPairingInvitation(event, invitationUrl) {
  try {
    // Check if Node instance is provisioned
    if (!nodeProvisioning.isProvisioned()) {
      return {
        success: false,
        error: 'Node instance not provisioned. Please login first.'
      }
    }
    
    
    // Check if Node instance has ConnectionsModel with pairing
    if (!nodeOneCore.connectionsModel || !nodeOneCore.connectionsModel.pairing) {
      return {
        success: false,
        error: 'Pairing not available. Node instance may not be fully initialized.'
      }
    }
    
    console.log('[IOM] Accepting pairing invitation:', invitationUrl)
    
    // Parse the invitation from the URL fragment
    const hashIndex = invitationUrl.indexOf('#')
    if (hashIndex === -1) {
      return {
        success: false,
        error: 'Invalid invitation URL: no fragment found'
      }
    }
    
    const fragment = invitationUrl.substring(hashIndex + 1)
    const invitationJson = decodeURIComponent(fragment)
    
    let invitation
    try {
      invitation = JSON.parse(invitationJson)
    } catch (error) {
      console.error('[IOM] Failed to parse invitation:', error)
      return {
        success: false,
        error: 'Invalid invitation format'
      }
    }
    
    // Extract token and URL from invitation
    const { token, url } = invitation
    
    if (!token || !url) {
      return {
        success: false,
        error: 'Invalid invitation: missing token or URL'
      }
    }
    
    console.log('[IOM] Accepting invitation with token:', token.substring(0, 20) + '...')
    console.log('[IOM] Connection URL:', url)
    
    // Connect using the invitation - this initiates connection TO the remote instance
    await nodeOneCore.connectionsModel.pairing.connectUsingInvitation(invitation)
    
    console.log('[IOM] ✅ Connected using invitation')
    
    // Add replication event
    addReplicationEvent({
      type: 'pairing-accepted',
      source: 'node',
      target: 'remote',
      details: 'Pairing invitation accepted, establishing connection',
      status: 'success'
    })
    
    return {
      success: true,
      message: 'Invitation accepted successfully'
    }
    
  } catch (error) {
    console.error('[IOM] Failed to accept invitation:', error)
    
    addReplicationEvent({
      type: 'pairing-failed',
      source: 'node',
      target: 'remote',
      details: error.message || 'Failed to accept invitation',
      status: 'error'
    })
    
    return {
      success: false,
      error: error.message || 'Failed to accept pairing invitation'
    }
  }
}

/**
 * Create a pairing invitation from the Node.js ONE.core instance
 */
async function createPairingInvitation(event) {
  try {
    // Check if Node instance is provisioned
    if (!nodeProvisioning.isProvisioned()) {
      return {
        success: false,
        error: 'Node instance not provisioned. Please login first.'
      }
    }
    
    
    // Check if Node instance has ConnectionsModel with pairing
    if (!nodeOneCore.connectionsModel || !nodeOneCore.connectionsModel.pairing) {
      return {
        success: false,
        error: 'Pairing not available. Node instance may not be fully initialized.'
      }
    }
    
    // Create invitation - PairingManager handles the invitation lifecycle internally
    console.log('[IOM] Creating new pairing invitation...')
    let invitation
    try {
      // Get the instance keys that should be registered
      const { getLocalInstanceOfPerson } = await import('@refinio/one.models/lib/misc/instance.js')
      const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
      const { getDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js')
      const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js')
      
      const myPersonId = getInstanceOwnerIdHash()
      const instanceId = await getLocalInstanceOfPerson(myPersonId)
      const defaultInstanceKeys = await getDefaultKeys(instanceId)
      const instanceKeys = await getObject(defaultInstanceKeys)
      
      console.log('[IOM] Person ID:', myPersonId)
      console.log('[IOM] Instance ID:', instanceId)
      console.log('[IOM] Instance keys publicKey:', instanceKeys.publicKey)
      
      // The original createInvitation() already uses getLocalInstanceOfPerson() which returns instance ID
      // No need to override keys - the function names were misleading
      invitation = await nodeOneCore.connectionsModel.pairing.createInvitation()
      console.log('[IOM] Created invitation with publicKey:', invitation.publicKey)
      console.log('[IOM] Invitation publicKey matches instance:', invitation.publicKey === instanceKeys.publicKey)
      
      // Verify the WebSocket server listener has this CryptoApi registered
      if (nodeOneCore.connectionsModel?.leuteConnectionsModule?.connectionRouteManager?.catchAllRoutes) {
        const catchAllRoutes = nodeOneCore.connectionsModel.leuteConnectionsModule.connectionRouteManager.catchAllRoutes
        const registeredKeys = [...catchAllRoutes.keys()]
        const hasMatchingKey = registeredKeys.includes(invitation.publicKey)
        
        console.log('[IOM] WebSocket server has matching CryptoApi:', hasMatchingKey)
        console.log('[IOM] Number of registered keys:', registeredKeys.length)
        
        if (!hasMatchingKey) {
          console.warn('[IOM] WARNING - WebSocket server does not have matching CryptoApi registered!')
          console.warn('[IOM] Looking for:', invitation.publicKey)
          console.warn('[IOM] Available keys:', registeredKeys.join(', '))
          
          // Check if LeuteConnectionsModule has the key in its map
          if (nodeOneCore.connectionsModel?.leuteConnectionsModule?.myPublicKeyToInstanceInfoMap) {
            const instanceMap = nodeOneCore.connectionsModel.leuteConnectionsModule.myPublicKeyToInstanceInfoMap
            console.log('[IOM] LeuteConnectionsModule has key in map:', instanceMap.has(invitation.publicKey))
            console.log('[IOM] LeuteConnectionsModule registered keys:', [...instanceMap.keys()])
          }
        }
      }
      
    } catch (error) {
      console.error('[IOM] Failed to create invitation:', error)
      return {
        success: false,
        error: `Failed to create invitation: ${error.message}`
      }
    }
    
    if (!invitation) {
      return {
        success: false,
        error: 'Failed to create pairing invitation'
      }
    }
    
    // Keep the original URL from createInvitation() - it will be the CommServer URL
    // This allows external peers to connect through CommServer relay
    console.log('[IOM] Using invitation URL:', invitation.url)
    
    // ONE.core invitation contains: token, publicKey, url (websocket endpoint)
    // We need to encode the entire invitation object for the URL fragment
    const invitationToken = encodeURIComponent(JSON.stringify(invitation))
    
    // Construct the edda.dev.refinio.one invitation URL
    const eddaDomain = 'edda.dev.refinio.one'
    const invitationUrl = `https://${eddaDomain}/invites/invitePartner/?invited=true/#${invitationToken}`
    
    console.log('[IOM] Created pairing invitation URL:', invitationUrl)
    console.log('[IOM] Returning to UI:', {
      url: invitationUrl,
      token: invitationToken
    })
    
    return {
      success: true,
      invitation: {
        url: invitationUrl,
        token: invitationToken
      }
    }
  } catch (error) {
    console.error('[IOM] Failed to create pairing invitation:', error)
    return {
      success: false,
      error: error.message || 'Failed to create pairing invitation'
    }
  }
}

export default {
  getIOMInstances,
  getReplicationEvents,
  getDataStats,
  addReplicationEvent,
  updateBrowserStorage,
  updateDataStats,
  createPairingInvitation,
  acceptPairingInvitation
}