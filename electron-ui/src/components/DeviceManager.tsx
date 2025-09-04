import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Smartphone, Monitor, Tablet, Trash2, Plus, Wifi, WifiOff, Copy, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Device {
  id: string
  name: string
  browserInstanceName: string
  platform: string
  status: 'connected' | 'disconnected' | 'pending'
  registeredAt: string
  lastSeen: string
}

interface DeviceInvite {
  id: string
  url: string
  expiresAt?: string
}

export const DeviceManager: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([])
  const [newDeviceName, setNewDeviceName] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [currentInvite, setCurrentInvite] = useState<DeviceInvite | null>(null)
  const [copiedInvite, setCopiedInvite] = useState(false)

  // Load devices on mount
  useEffect(() => {
    loadDevices()
    
    // Refresh every 5 seconds to update connection status
    const interval = setInterval(loadDevices, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadDevices = async () => {
    try {
      const result = await window.api.invoke('devices:list')
      if (result.success) {
        setDevices(result.devices)
      }
    } catch (error) {
      console.error('Failed to load devices:', error)
    }
  }

  const registerNewDevice = async () => {
    if (!newDeviceName.trim()) {
      toast.error('Please enter a device name')
      return
    }

    setIsRegistering(true)
    try {
      const result = await window.api.invoke('devices:register', {
        name: newDeviceName.trim(),
        platform: 'unknown' // Will be determined when device connects
      })

      if (result.success) {
        setCurrentInvite({
          id: result.invite.id,
          url: result.invite.url || `ws://localhost:8765/invite/${result.invite.id}`
        })
        setNewDeviceName('')
        await loadDevices()
        toast.success(`Device "${result.device.name}" registered successfully`)
      } else {
        toast.error(result.error || 'Failed to register device')
      }
    } catch (error) {
      console.error('Device registration error:', error)
      toast.error('Failed to register device')
    } finally {
      setIsRegistering(false)
    }
  }

  const removeDevice = async (deviceId: string) => {
    try {
      const result = await window.api.invoke('devices:remove', deviceId)
      if (result.success) {
        await loadDevices()
        toast.success('Device removed')
      } else {
        toast.error('Failed to remove device')
      }
    } catch (error) {
      console.error('Failed to remove device:', error)
      toast.error('Failed to remove device')
    }
  }

  const copyInviteUrl = () => {
    if (currentInvite) {
      navigator.clipboard.writeText(currentInvite.url)
      setCopiedInvite(true)
      toast.success('Invite URL copied to clipboard')
      
      setTimeout(() => {
        setCopiedInvite(false)
        setCurrentInvite(null)
      }, 3000)
    }
  }

  const getDeviceIcon = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case 'mobile':
      case 'ios':
      case 'android':
        return <Smartphone className="h-5 w-5" />
      case 'tablet':
      case 'ipad':
        return <Tablet className="h-5 w-5" />
      default:
        return <Monitor className="h-5 w-5" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <Wifi className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        )
      case 'disconnected':
        return (
          <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
            <WifiOff className="h-3 w-3 mr-1" />
            Disconnected
          </Badge>
        )
      case 'pending':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            Pending
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <Card className="bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle>Device Management</CardTitle>
        <CardDescription>
          Manage devices connected to your LAMA hub
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Register new device */}
        <div className="space-y-4">
          <Label>Register New Device</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Enter device name..."
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && registerNewDevice()}
              disabled={isRegistering}
            />
            <Button
              onClick={registerNewDevice}
              disabled={isRegistering || !newDeviceName.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Register
            </Button>
          </div>
        </div>

        {/* Show invite if just created */}
        {currentInvite && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
            <p className="text-sm font-medium">Device Invite Created</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-background/50 rounded text-xs break-all">
                {currentInvite.url}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={copyInviteUrl}
              >
                {copiedInvite ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use this invite URL on the new device to connect it to your hub
            </p>
          </div>
        )}

        {/* Device list */}
        <div className="space-y-2">
          <Label>Registered Devices</Label>
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No devices registered yet
            </p>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-3 bg-background/50 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {getDeviceIcon(device.platform)}
                    <div>
                      <p className="font-medium">{device.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {device.browserInstanceName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(device.status)}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeDevice(device.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connection info */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Hub Address:</strong> ws://localhost:8765
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Other devices on your network can connect to this hub using the invite system
          </p>
        </div>
      </CardContent>
    </Card>
  )
}