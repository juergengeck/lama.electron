/**
 * Connection Configuration
 * Determines how the app connects to other instances
 */

export interface ConnectionConfig {
  // Use direct P2P for local Node.js connection
  useDirectConnection: boolean
  
  // Node.js instance endpoint for direct connection
  nodeEndpoint: string
  
  // Enable comm server for external connections
  enableCommServer: boolean
  
  // Comm server URL for external browser connections
  commServerUrl?: string
  
  // Connection priority
  connectionPriority: 'direct' | 'commserver' | 'both'
}

/**
 * Default configuration for Electron app
 * - Direct connection to local Node.js instance
 * - Comm server for external browser connections
 */
export const defaultConnectionConfig: ConnectionConfig = {
  useDirectConnection: true,
  nodeEndpoint: 'ws://localhost:8765',
  enableCommServer: true,
  commServerUrl: process.env.NODE_ENV === 'development' 
    ? 'wss://comm10.dev.refinio.one'
    : 'wss://comm.refinio.net',
  connectionPriority: 'both'
}

/**
 * Get connection config based on environment
 */
export function getConnectionConfig(): ConnectionConfig {
  // In Electron, we want both:
  // - Direct connection to local Node.js
  // - Comm server for external connections
  
  const isElectron = typeof window !== 'undefined' && window.electronAPI
  
  if (isElectron) {
    return {
      ...defaultConnectionConfig,
      connectionPriority: 'both'
    }
  }
  
  // Regular browser only uses comm server
  return {
    useDirectConnection: false,
    nodeEndpoint: '',
    enableCommServer: true,
    commServerUrl: defaultConnectionConfig.commServerUrl,
    connectionPriority: 'commserver'
  }
}