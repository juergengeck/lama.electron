/**
 * Instance and Device Manager
 * Shows the current Node.js instance alongside connected devices
 * Allows device-specific settings and management
 */

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import {
  Server,
  Smartphone,
  Laptop,
  Tablet,
  Monitor,
  Wifi,
  WifiOff,
  Settings,
  UserPlus,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info,
  Network
} from 'lucide-react'

interface InstanceInfo {
  id: string
  name: string
  type: string
  platform: string
  role: string
  initialized: boolean
  capabilities: {
    network?: any
    storage?: any
    llm?: any
  }
  devices: any[]
}

interface Device {
  id: string
  name: string
  platform: string
  type: string
  status: 'connected' | 'disconnected' | 'pairing'
  lastSeen: Date
  capabilities: string[]
}

interface Connection {
  id: string
  personId: string
  name: string
  status: 'connected' | 'disconnected'
  type: 'direct' | 'relay'
  endpoint?: string
  lastSeen: Date
}

export function InstanceManager() {
  const [instanceInfo, setInstanceInfo] = useState<InstanceInfo | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadInstanceInfo = async () => {
    try {
      console.log('[InstanceManager] Loading instance info...')
      const result = await window.electronAPI.getInstanceInfo()
      
      if (result.success) {
        setInstanceInfo(result.instance)
        console.log('[InstanceManager] Instance info loaded:', result.instance)
      } else {
        setError(result.error || 'Failed to load instance info')
      }
    } catch (error) {
      console.error('[InstanceManager] Failed to load instance info:', error)
      setError('Failed to connect to Node.js instance')
    }
  }

  const loadDevices = async () => {
    try {
      console.log('[InstanceManager] Loading devices...')
      const result = await window.electronAPI.getDevices()
      
      if (result.success) {
        setDevices(result.devices || [])
        console.log('[InstanceManager] Devices loaded:', result.devices)
      } else {
        console.log('[InstanceManager] No devices found or error:', result.error)
      }
    } catch (error) {
      console.error('[InstanceManager] Failed to load devices:', error)
    }
  }

  const loadConnections = async () => {
    try {
      console.log('[InstanceManager] Loading connections...')
      const result = await window.electronAPI.getConnectionsInfo()
      
      if (result.success) {
        const formattedConnections = (result.connections || []).map((conn: any) => ({
          id: conn.id || `conn-${Math.random()}`,
          personId: conn.personId || '',
          name: conn.name || 'Unknown',
          status: conn.isConnected ? 'connected' : 'disconnected',
          type: conn.type === 'direct' ? 'direct' : 'relay',
          endpoint: conn.endpoint,
          lastSeen: new Date(conn.lastSeen || Date.now())
        }))
        
        setConnections(formattedConnections)
        console.log('[InstanceManager] Connections loaded:', formattedConnections)
      } else {
        console.log('[InstanceManager] No connections found or error:', result.error)
      }
    } catch (error) {
      console.error('[InstanceManager] Failed to load connections:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    await Promise.all([
      loadInstanceInfo(),
      loadDevices(), 
      loadConnections()
    ])
    
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    
    // Refresh data periodically
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [])

  const getDeviceIcon = (platform: string, type: string) => {
    switch (platform.toLowerCase()) {
      case 'ios':
        return <Smartphone className="h-4 w-4" />
      case 'android':
        return <Smartphone className="h-4 w-4" />
      case 'windows':
        return <Laptop className="h-4 w-4" />
      case 'macos':
        return <Monitor className="h-4 w-4" />
      case 'linux':
        return <Monitor className="h-4 w-4" />
      case 'nodejs':
        return <Server className="h-4 w-4" />
      default:
        return <Monitor className="h-4 w-4" />
    }
  }

  const getStatusBadge = (status: string, initialized?: boolean) => {
    if (status === 'connected' || initialized) {
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>
    } else if (status === 'pairing') {
      return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1" />Pairing</Badge>
    } else {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Disconnected</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Instance Information...
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (error && !instanceInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Error Loading Instance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Instance */}
      {instanceInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              This Instance (Hub)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getDeviceIcon(instanceInfo.platform, instanceInfo.type)}
                <div>
                  <h3 className="font-medium">{instanceInfo.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {instanceInfo.platform} • {instanceInfo.role} • {instanceInfo.type}
                  </p>
                </div>
              </div>
              {getStatusBadge('connected', instanceInfo.initialized)}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Instance ID:</span>
                <p className="font-mono text-xs break-all">{instanceInfo.id}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Connected Devices:</span>
                <p>{devices.length}</p>
              </div>
            </div>

            {/* Capabilities */}
            <div>
              <h4 className="text-sm font-medium mb-2">Capabilities</h4>
              <div className="flex gap-2 flex-wrap">
                {instanceInfo.capabilities.network?.enabled && (
                  <Badge variant="outline">
                    <Network className="h-3 w-3 mr-1" />
                    Network
                  </Badge>
                )}
                {instanceInfo.capabilities.storage?.enabled && (
                  <Badge variant="outline">
                    <Server className="h-3 w-3 mr-1" />
                    Storage
                  </Badge>
                )}
                {instanceInfo.capabilities.llm?.enabled && (
                  <Badge variant="outline">
                    <Info className="h-3 w-3 mr-1" />
                    AI/LLM
                  </Badge>
                )}
              </div>
            </div>

            <Separator />
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connected Devices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Connected Devices ({devices.length})
            </div>
            <Button variant="outline" size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Device
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No devices connected</p>
              <p className="text-sm">Add a device to start syncing across multiple devices</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getDeviceIcon(device.platform, device.type)}
                    <div>
                      <h4 className="font-medium">{device.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {device.platform} • Last seen: {device.lastSeen.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getStatusBadge(device.status)}
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Active Connections ({connections.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No active connections</p>
              <p className="text-sm">Connect with other LAMA users to start chatting</p>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((connection) => (
                <div key={connection.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {connection.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-medium">{connection.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {connection.type} connection • Last seen: {connection.lastSeen.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getStatusBadge(connection.status)}
                    <Badge variant="secondary" className="text-xs">
                      {connection.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}