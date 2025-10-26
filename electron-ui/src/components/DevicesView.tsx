import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  RefreshCw,
  AlertCircle,
  Wifi,
  Settings2
} from 'lucide-react'

interface QuicVCDevice {
  id: string
  name: string
  type: string
  address: string
  capabilities: string[]
  discoveredAt: string
  lastSeen: string
  credentialStatus?: string
}

export function DevicesView() {
  const [quicvcDevices, setQuicvcDevices] = useState<QuicVCDevice[]>([])
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    loadQuicVCDevices()

    // Poll for QuicVC device updates
    const interval = setInterval(() => {
      loadQuicVCDevices()
    }, 5000)

    // Set up event listeners for real-time QuicVC device updates
    const handlePeerDiscovered = (peer: QuicVCDevice) => {
      setQuicvcDevices(prev => {
        const existing = prev.find(d => d.id === peer.id)
        if (existing) {
          return prev.map(d => d.id === peer.id ? peer : d)
        }
        return [...prev, peer]
      })
    }

    const handlePeerLost = (peer: { id: string }) => {
      setQuicvcDevices(prev => prev.filter(d => d.id !== peer.id))
    }

    if (window.electronAPI) {
      window.electronAPI.on('quicvc:peerDiscovered', handlePeerDiscovered)
      window.electronAPI.on('quicvc:peerLost', handlePeerLost)
    }

    return () => {
      clearInterval(interval)
      if (window.electronAPI) {
        window.electronAPI.off('quicvc:peerDiscovered', handlePeerDiscovered)
        window.electronAPI.off('quicvc:peerLost', handlePeerLost)
      }
    }
  }, [])

  const loadQuicVCDevices = async () => {
    try {
      if (!window.electronAPI) return

      const result = await window.electronAPI.invoke('quicvc:getDiscoveredDevices')
      if (result.success && result.devices) {
        setQuicvcDevices(result.devices)
      }
    } catch (error) {
      console.error('Failed to load QuicVC devices:', error)
    }
  }

  const handleQuicVCScan = async () => {
    setScanning(true)
    try {
      if (!window.electronAPI) return

      const result = await window.electronAPI.invoke('quicvc:scan', 3000)
      if (result.success && result.devices) {
        setQuicvcDevices(result.devices)
      }
    } catch (error) {
      console.error('Failed to scan for QuicVC devices:', error)
    } finally {
      setScanning(false)
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="h-full">
      <ScrollArea className="h-full">
        <div className="space-y-4">
          {/* Header Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>QuicVC Discovery</CardTitle>
                  <CardDescription>Discover QuicVC devices on your local network</CardDescription>
                </div>
                <Button onClick={handleQuicVCScan} disabled={scanning}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
                  {scanning ? 'Scanning...' : 'Scan Network'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {quicvcDevices.length} device(s) discovered
              </div>
            </CardContent>
          </Card>

          {/* Discovered Devices */}
          {quicvcDevices.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No QuicVC devices discovered. Click "Scan Network" to search for devices.
              </AlertDescription>
            </Alert>
          ) : (
            quicvcDevices.map(device => (
              <Card key={device.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Wifi className="h-6 w-6 text-green-500" />
                      <div>
                        <CardTitle className="text-lg">{device.name}</CardTitle>
                        <CardDescription>{device.address}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="default">
                      {device.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Device Info */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Device ID</span>
                        <p className="font-mono text-xs truncate">{device.id}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Address</span>
                        <p className="font-medium">{device.address}</p>
                      </div>
                    </div>

                    {/* Capabilities */}
                    <div>
                      <span className="text-sm text-muted-foreground">Capabilities</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {device.capabilities.map((cap, idx) => (
                          <Badge key={idx} variant="outline">
                            {cap}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Discovered</span>
                        <p className="font-medium">{formatDate(new Date(device.discoveredAt))}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Seen</span>
                        <p className="font-medium">{formatDate(new Date(device.lastSeen))}</p>
                      </div>
                    </div>

                    {/* Credential Status */}
                    {device.credentialStatus && (
                      <div>
                        <span className="text-sm text-muted-foreground">Credential Status</span>
                        <Badge variant="secondary" className="ml-2">
                          {device.credentialStatus}
                        </Badge>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-2 pt-2">
                      <Button size="sm" variant="default">
                        <Wifi className="h-4 w-4 mr-2" />
                        Connect
                      </Button>
                      <Button size="sm" variant="outline">
                        <Settings2 className="h-4 w-4 mr-2" />
                        Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
