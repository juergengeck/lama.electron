/**
 * IOM Configuration
 * Central configuration for Internet of Me replication and monitoring
 */

module.exports = {
  // Event storage configuration
  events: {
    // Maximum number of replication events to keep in memory
    // Older events are discarded to prevent memory growth
    maxEventsInMemory: 100,
    
    // How long to consider activity as "recent" (milliseconds)
    recentActivityWindow: 24 * 60 * 60 * 1000, // 24 hours
  },
  
  // Connection monitoring configuration
  connections: {
    // How long a connection can be in "connecting" state before considered stale (ms)
    staleConnectionTimeout: 5 * 60 * 1000, // 5 minutes
    
    // How long to keep closed connection records before cleanup (ms)
    closedConnectionRetention: 24 * 60 * 60 * 1000, // 24 hours
    
    // WebSocket close code for normal closure
    normalCloseCode: 1000,
  },
  
  // Sync monitoring configuration
  sync: {
    // How often to check CHUM sync status (ms)
    statusCheckInterval: 2000, // 2 seconds
    
    // How often to check for stale connections (ms)
    staleCheckInterval: 60000, // 1 minute
    
    // Minimum interval between progress event reports (ms)
    // Prevents flooding UI with too many updates
    progressReportInterval: 2000, // 2 seconds
  },
  
  // Initialization delays
  startup: {
    // Delay before starting monitoring to ensure services are initialized (ms)
    monitoringStartDelay: 1000, // 1 second
  }
}