# Data Dashboard Documentation

## Overview

The Data Dashboard provides real-time monitoring of your Internet of Me (IoM) replication state, showing how data synchronizes across your personal network of devices.

## Features

### Real-Time IOM Instance Monitoring
- **Node Instance**: Desktop archive storage with full data retention
- **Browser Instance**: Smart cache with IndexedDB storage
- **Mobile Instances**: Minimal storage for essential data (when discovered via BLE/UDP)

Each instance displays:
- Connection status (online/offline/syncing)
- Storage usage with actual filesystem/browser quotas
- Replication queue size and error counts
- Last synchronization timestamp

### CHUM Protocol Sync Tracking
The dashboard monitors the CHUM (Cryptographic Handshake for Unified Messaging) protocol:
- WebSocket connection states
- Active synchronization progress
- Error tracking with detailed messages
- Sync completion statistics

### Storage Metrics
- **Actual disk space** for Node instances (using `df` on Unix, `wmic` on Windows)
- **Browser Storage API** quota estimates for IndexedDB
- **Object counts** from ONE.CORE storage (messages, files, contacts, conversations)
- **Real-time updates** every 5 seconds (configurable)

## Implementation

### Architecture

```
DataDashboard.tsx (UI Component)
    ↓ IPC invoke
IOM Handlers (main/ipc/handlers/iom.js)
    ↓ queries
Real Node Instance → ONE.CORE Storage
CHUM Monitor → WebSocket Connections
    ↓ returns
Real-time metrics (no mock data)
```

### Key Components

1. **IOM Handlers** (`main/ipc/handlers/iom.js`)
   - `getIOMInstances()`: Returns real instance states
   - `getReplicationEvents()`: Event history (max 100 events)
   - `getDataStats()`: Actual object counts from storage
   - `updateBrowserStorage()`: Receives browser quota updates

2. **CHUM Monitor** (`main/hybrid/chum-monitor.js`)
   - Tracks WebSocket connections
   - Monitors sync progress
   - Collects error information
   - Emits real-time events

3. **Configuration** (`main/config/iom-config.js`)
   - All thresholds and intervals are configurable
   - No hardcoded arbitrary values
   - Centralized configuration management

## Data Sources

### No Mock Data
The dashboard only displays real data or empty states:
- ✅ Real filesystem stats via system calls
- ✅ Actual browser storage quotas
- ✅ Live CHUM protocol events
- ✅ True object counts from ONE.CORE
- ❌ No fallback mock data
- ❌ No fake statistics

### Error Handling
When data is unavailable:
- Shows "No IOM Instances" for unprovisioned nodes
- Displays "Never" for instances that haven't synced
- Shows error messages when IPC calls fail
- Empty state UI instead of fake data

## Configuration

Edit `main/config/iom-config.js` to customize:

```javascript
module.exports = {
  events: {
    maxEventsInMemory: 100,           // Event retention limit
    recentActivityWindow: 86400000,   // 24 hours
  },
  connections: {
    staleConnectionTimeout: 300000,   // 5 minutes
    closedConnectionRetention: 86400000, // 24 hours
    normalCloseCode: 1000,
  },
  sync: {
    statusCheckInterval: 2000,        // 2 seconds
    staleCheckInterval: 60000,        // 1 minute
    progressReportInterval: 2000,     // 2 seconds
  },
  startup: {
    monitoringStartDelay: 1000,       // 1 second
  }
}
```

## Usage

1. Navigate to the **Data** tab in the main navigation
2. View real-time replication status across your IoM
3. Monitor sync progress and errors
4. Check storage usage and capacity
5. Review replication event history

## Troubleshooting

### No Data Showing
- Ensure Node instance is provisioned
- Check that main process IPC handlers are registered
- Verify browser has permission for storage estimate API

### Storage Metrics Incorrect
- Node: Requires filesystem access permissions
- Browser: Needs Storage API support (modern browsers)
- Mobile: Requires BLE/UDP discovery (not yet implemented)

### Sync Errors
The dashboard shows actual CHUM protocol errors:
- `WSP-ONCL`: WebSocket connection closed
- `CS-MISMATCH`: Protocol version mismatch
- `CS-INIT1`: Identity verification failed
- Check error details in the Replication Activity tab

## Future Enhancements

- Mobile device discovery via BLE/UDP
- Historical metrics graphing
- Bandwidth usage monitoring
- Predictive sync optimization
- Multi-device topology visualization