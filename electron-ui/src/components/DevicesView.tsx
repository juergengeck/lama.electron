import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Smartphone,
  Monitor,
  HardDrive,
  Activity,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Wifi,
  WifiOff,
  Plus,
  Settings2,
  Trash2
} from 'lucide-react'

interface LAMAInstance {
  id: string
  name: string
  type: 'node' | 'browser' | 'mobile'
  role: 'archive' | 'cache' | 'minimal'
  status: 'online' | 'offline' | 'syncing'
  endpoint: string
  storage: {
    used: number
    total: number
    percentage: number
  }
  lastSync: Date
  replication: {
    inProgress: boolean
    lastCompleted: Date | null
    queueSize: number
    failedItems: number
  }
}

interface ReplicationEvent {
  id: string
  timestamp: Date
  source: string
  target: string
  type: 'send' | 'receive'
  status: 'success' | 'failed' | 'pending'
  objectType: string
  size: number
}

export function DevicesView() {
  const [instances, setInstances] = useState<LAMAInstance[]>([])
  const [replicationEvents, setReplicationEvents] = useState<ReplicationEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadInstances()
    loadReplicationEvents()

    // Poll for updates
    const interval = setInterval(() => {
      loadInstances()
      loadReplicationEvents()
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const loadInstances = async () => {
    try {
      if (!window.electronAPI) return

      const result = await window.electronAPI.invoke('iom:getInstances')
      if (result.success && result.instances) {
        setInstances(result.instances)
      }
    } catch (error) {
      console.error('Failed to load instances:', error)
    }
  }

  const loadReplicationEvents = async () => {
    try {
      if (!window.electronAPI) return

      const result = await window.electronAPI.invoke('iom:getReplicationEvents')
      if (result.success && result.events) {
        setReplicationEvents(result.events)
      }
    } catch (error) {
      console.error('Failed to load replication events:', error)
    }
  }

  const handleSync = async (instanceId: string) => {
    setLoading(true)
    try {
      // Trigger sync for the instance
      console.log('Syncing instance:', instanceId)
      // TODO: Implement actual sync
      await new Promise(resolve => setTimeout(resolve, 2000))
    } finally {
      setLoading(false)
      loadInstances()
    }
  }

  const handleAddDevice = () => {
    // TODO: Open device pairing dialog
    console.log('Add device')
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getInstanceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return Smartphone
      case 'browser': return Monitor
      default: return HardDrive
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500'
      case 'syncing': return 'text-blue-500'
      default: return 'text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return CheckCircle
      case 'syncing': return RefreshCw
      default: return WifiOff
    }
  }

  // Calculate aggregated stats
  const totalStorage = instances.reduce((sum, i) => sum + (i.storage?.total || 0), 0)
  const usedStorage = instances.reduce((sum, i) => sum + (i.storage?.used || 0), 0)
  const onlineCount = instances.filter(i => i.status === 'online').length
  const syncingCount = instances.filter(i => i.status === 'syncing').length
  const totalQueue = instances.reduce((sum, i) => sum + (i.replication?.queueSize || 0), 0)

  return (
    <div className="h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-[400px] grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="replication">Replication</TabsTrigger>
          </TabsList>

          <Button onClick={handleAddDevice}>
            <Plus className="h-4 w-4 mr-2" />
            Add Device
          </Button>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="overview" className="h-full mt-0">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{instances.length}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {onlineCount} online, {syncingCount} syncing
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatBytes(usedStorage)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        of {formatBytes(totalStorage)} total
                      </div>
                      <Progress value={(usedStorage / totalStorage) * 100} className="mt-2" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Sync Queue</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{totalQueue}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        items pending sync
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Current Device */}
                <Card>
                  <CardHeader>
                    <CardTitle>This Device</CardTitle>
                    <CardDescription>Current instance configuration</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {instances.length > 0 && instances[0] && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Instance Type</span>
                          <Badge variant="secondary">{instances[0].type}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Role</span>
                          <Badge variant="outline">{instances[0].role}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Endpoint</span>
                          <span className="text-sm text-muted-foreground">{instances[0].endpoint}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Network Status */}
                <Card>
                  <CardHeader>
                    <CardTitle>Network Status</CardTitle>
                    <CardDescription>Connection health across devices</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {instances.map(instance => {
                        const Icon = getInstanceIcon(instance.type)
                        const StatusIcon = getStatusIcon(instance.status)

                        return (
                          <div key={instance.id} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Icon className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{instance.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Last sync: {formatDate(instance.lastSync)}
                                </p>
                              </div>
                            </div>
                            <StatusIcon className={`h-5 w-5 ${getStatusColor(instance.status)}`} />
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="devices" className="h-full mt-0">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {instances.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No devices found. Click "Add Device" to pair a new device.
                    </AlertDescription>
                  </Alert>
                ) : (
                  instances.map(instance => {
                    const Icon = getInstanceIcon(instance.type)
                    const StatusIcon = getStatusIcon(instance.status)

                    return (
                      <Card key={instance.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Icon className="h-6 w-6 text-muted-foreground" />
                              <div>
                                <CardTitle className="text-lg">{instance.name}</CardTitle>
                                <CardDescription>{instance.endpoint}</CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <StatusIcon className={`h-5 w-5 ${getStatusColor(instance.status)}`} />
                              <Badge variant={instance.status === 'online' ? 'default' : 'secondary'}>
                                {instance.status}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {/* Storage */}
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span>Storage</span>
                                <span className="text-muted-foreground">
                                  {formatBytes(instance.storage.used)} / {formatBytes(instance.storage.total)}
                                </span>
                              </div>
                              <Progress value={instance.storage.percentage} />
                            </div>

                            {/* Replication Status */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Queue Size</span>
                                <p className="font-medium">{instance.replication.queueSize} items</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Failed Items</span>
                                <p className="font-medium">{instance.replication.failedItems}</p>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSync(instance.id)}
                                disabled={loading || instance.status === 'syncing'}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Sync Now
                              </Button>
                              <Button size="sm" variant="outline">
                                <Settings2 className="h-4 w-4 mr-2" />
                                Configure
                              </Button>
                              <Button size="sm" variant="outline" className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="replication" className="h-full mt-0">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Last 100 replication events</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {replicationEvents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No replication activity yet
                        </p>
                      ) : (
                        replicationEvents.slice(0, 100).map(event => (
                          <div key={event.id} className="flex items-center justify-between py-2 border-b">
                            <div className="flex items-center space-x-3">
                              {event.type === 'send' ? (
                                <Upload className="h-4 w-4 text-blue-500" />
                              ) : (
                                <Download className="h-4 w-4 text-green-500" />
                              )}
                              <div>
                                <p className="text-sm">
                                  <span className="font-medium">{event.objectType}</span>
                                  <span className="text-muted-foreground ml-2">
                                    {event.type === 'send' ? 'to' : 'from'} {event.type === 'send' ? event.target : event.source}
                                  </span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(event.timestamp)} • {formatBytes(event.size)}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant={event.status === 'success' ? 'default' : event.status === 'failed' ? 'destructive' : 'secondary'}
                            >
                              {event.status}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}