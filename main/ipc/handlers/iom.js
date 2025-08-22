/**
 * IOM (Internet of Me) State Handlers
 * Provides real-time replication and sync status
 */

const nodeProvisioning = require('../../hybrid/node-provisioning')
const realNodeInstance = require('../../hybrid/real-node-instance')
const chumMonitor = require('../../hybrid/chum-monitor')
const config = require('../../config/iom-config')

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
      const nodeInstance = realNodeInstance.getInstance()
      const nodeState = await realNodeInstance.getState('') || {}
      
      // Get Node instance info
      const nodeInfo = {
        id: nodeInstance?.id || 'node-' + Date.now(),
        name: 'Desktop Node',
        type: 'node',
        role: nodeState['config.storageRole'] || 'archive',
        status: nodeInstance ? 'online' : 'offline',
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
      
      // Also check Node instance for CHUM sync
      if (nodeInstance?.chumSync) {
        const chumObj = nodeInstance.chumSync.getChumObject?.()
        if (chumObj) {
          nodeInfo.replication.queueSize = chumObj.AtoBUnknown || 0
          nodeInfo.replication.failedItems = chumObj.errors?.length || 0
          nodeInfo.replication.errors = chumObj.errors || []
        }
      }
      
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
      const fs = require('fs').promises
      const path = require('path')
      const os = require('os')
      const { execSync } = require('child_process')
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
  try {
    const ipcController = require('../controller')
    if (ipcController && ipcController.sendUpdate) {
      ipcController.sendUpdate('iom:replicationEvent', syncEvent)
    }
  } catch (e) {
    // Controller not yet initialized
  }
  
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
  if (realNodeInstance.isInitialized()) {
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

module.exports = {
  getIOMInstances,
  getReplicationEvents,
  getDataStats,
  addReplicationEvent,
  updateBrowserStorage,
  updateDataStats
}