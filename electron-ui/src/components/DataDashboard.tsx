import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ObjectHierarchyView } from '@/components/ObjectHierarchyView'
import { 
  HardDrive, 
  Cloud, 
  Smartphone, 
  Monitor,
  Activity,
  Database,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Wifi,
  WifiOff,
  ExternalLink
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
  type: 'sync-started' | 'sync-completed' | 'sync-failed' | 'object-received' | 'object-sent'
  source: string
  target: string
  details: string
  status: 'success' | 'error' | 'pending'
}

interface DataStats {
  totalObjects: number
  totalSize: number
  messages: number
  files: number
  contacts: number
  conversations: number
  versions: number
  recentActivity: number
}

interface DataDashboardProps {
  onNavigate?: (tab: string, conversationId?: string, section?: string) => void
  showHierarchyView?: boolean
}

export function DataDashboard({ onNavigate, showHierarchyView = false }: DataDashboardProps) {
  const [instances, setInstances] = useState<LAMAInstance[]>([])
  const [replicationEvents, setReplicationEvents] = useState<ReplicationEvent[]>([])
  const [dataStats, setDataStats] = useState<DataStats>({
    totalObjects: 0,
    totalSize: 0,
    messages: 0,
    files: 0,
    contacts: 0,
    conversations: 0,
    versions: 0,
    recentActivity: 0
  })
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get browser storage quota and report to main process
  const updateBrowserStorageInfo = async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate()
        const storageInfo = {
          used: estimate.usage || 0,
          total: estimate.quota || 0,
          percentage: (estimate.quota && estimate.usage) 
            ? Math.round((estimate.usage / estimate.quota) * 100) 
            : 0
        }
        
        // Send to main process if in Electron
        if (window.electronAPI?.invoke) {
          await window.electronAPI.invoke('lama:updateBrowserStorage', storageInfo)
        }
        
        return storageInfo
      } catch (e) {
        console.error('Failed to get browser storage estimate:', e)
      }
    }
    return null
  }
  
  // Get actual object counts from browser's ONE.CORE
  const getActualDataStats = async () => {
    try {
      // Access the browser's ONE.CORE instance via lama bridge
      const lamaBridge = (window as any).lamaBridge
      if (!lamaBridge || !lamaBridge.appModel) {
        console.log('[DataDashboard] No lamaBridge or appModel available')
        return null
      }
      
      const appModel = lamaBridge.appModel
      const stats: DataStats = {
        totalObjects: 0,
        totalSize: 0,
        messages: 0,
        files: 0,
        contacts: 0,
        conversations: 0,
        versions: 0,
        recentActivity: 0
      }
      
      // Count messages from current conversations
      try {
        // Get conversations from lamaBridge
        const conversations = await lamaBridge.getConversations?.()
        if (conversations && Array.isArray(conversations)) {
          stats.conversations = conversations.length
          
          // Count messages in each conversation
          for (const conv of conversations) {
            try {
              const messages = await lamaBridge.getMessages(conv.id)
              if (messages && Array.isArray(messages)) {
                stats.messages += messages.length
              }
            } catch (e) {
              console.log('[DataDashboard] Error getting messages for conversation:', conv.id, e)
            }
          }
        }
        
        // Also check the default conversation
        try {
          const defaultMessages = await lamaBridge.getMessages('default')
          if (defaultMessages && Array.isArray(defaultMessages)) {
            stats.messages += defaultMessages.length
            if (!stats.conversations) {
              stats.conversations = 1 // At least the default conversation
            }
          }
        } catch (e) {
          console.log('[DataDashboard] Error getting default messages:', e)
        }
      } catch (e) {
        console.log('[DataDashboard] Error counting messages:', e)
      }
      
      // Count contacts
      if (appModel.leuteModel) {
        const contacts = await appModel.getContacts?.()
        if (contacts) {
          stats.contacts = contacts.length
        }
      }
      
      // Get storage estimate for size
      const storageEstimate = await navigator.storage?.estimate()
      if (storageEstimate) {
        stats.totalSize = storageEstimate.usage || 0
      }
      
      stats.totalObjects = stats.messages + stats.files + stats.contacts + stats.conversations
      
      // Send stats to main process
      if (window.electronAPI?.invoke) {
        await window.electronAPI.invoke('lama:updateDataStats', stats)
      }
      
      return stats
    } catch (e) {
      console.error('[DataDashboard] Failed to get actual data stats:', e)
      return null
    }
  }
  
  // Fetch real LAMA data from main process
  const fetchLAMAData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Update browser storage info first
      await updateBrowserStorageInfo()
      
      // Get actual data stats from browser's ONE.CORE
      const actualStats = await getActualDataStats()
      if (actualStats) {
        setDataStats(actualStats)
      }
      
      // Check if we're in Electron environment
      if (window.electronAPI?.invoke) {
        // Fetch real LAMA instances
        const instancesResult = await window.electronAPI.invoke('lama:getInstances')
        if (instancesResult.success && instancesResult.data) {
          setInstances(instancesResult.data)
        } else if (!instancesResult.success) {
          throw new Error(instancesResult.error || 'Failed to fetch instances')
        }
        
        // Fetch replication events
        const eventsResult = await window.electronAPI.invoke('lama:getReplicationEvents')
        if (eventsResult.success && eventsResult.data) {
          setReplicationEvents(eventsResult.data)
        }
        
        // If we didn't get stats from browser, try from main process
        if (!actualStats) {
          const statsResult = await window.electronAPI.invoke('connection:getDataStats')
          if (statsResult.success && statsResult.data) {
            setDataStats(statsResult.data)
          }
        }
      } else {
        // No Electron API - show empty state
        setInstances([])
        setReplicationEvents([])
        setDataStats({
          totalObjects: 0,
          totalSize: 0,
          messages: 0,
          files: 0,
          contacts: 0,
          conversations: 0,
          versions: 0,
          recentActivity: 0
        })
      }
    } catch (err) {
      console.error('Failed to fetch LAMA data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch LAMA data')
      // Show empty state on error
      setInstances([])
      setReplicationEvents([])
      setDataStats({
        totalObjects: 0,
        totalSize: 0,
        messages: 0,
        files: 0,
        contacts: 0,
        conversations: 0,
        versions: 0,
        recentActivity: 0
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  
  useEffect(() => {
    // Initial fetch
    fetchLAMAData()

    // Set up auto-refresh
    let interval: NodeJS.Timeout | undefined
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchLAMAData()
      }, 5000)
    }
    
    // Listen for real-time replication events from main process
    const handleReplicationEvent = (event: any) => {
      if (event.detail) {
        setReplicationEvents(prev => [event.detail, ...prev].slice(0, 100))
      }
    }
    
    if (window.electronAPI) {
      window.addEventListener('lama:replicationEvent', handleReplicationEvent)
    }
    
    return () => {
      if (interval) clearInterval(interval)
      if (window.electronAPI) {
        window.removeEventListener('lama:replicationEvent', handleReplicationEvent)
      }
    }
  }, [autoRefresh])

  const getInstanceIcon = (type: LAMAInstance['type']) => {
    switch (type) {
      case 'node': return <HardDrive className="h-4 w-4" />
      case 'browser': return <Monitor className="h-4 w-4" />
      case 'mobile': return <Smartphone className="h-4 w-4" />
    }
  }

  const getStatusIcon = (status: LAMAInstance['status']) => {
    switch (status) {
      case 'online': return <Wifi className="h-4 w-4 text-green-500" />
      case 'offline': return <WifiOff className="h-4 w-4 text-gray-500" />
      case 'syncing': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
    }
  }

  const getEventIcon = (type: ReplicationEvent['type']) => {
    switch (type) {
      case 'sync-started': return <RefreshCw className="h-4 w-4 text-blue-500" />
      case 'sync-completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'sync-failed': return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'object-received': return <Download className="h-4 w-4 text-blue-500" />
      case 'object-sent': return <Upload className="h-4 w-4 text-purple-500" />
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return 'Never'
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  // Show hierarchy view if requested
  if (showHierarchyView) {
    return (
      <ObjectHierarchyView 
        onNavigate={onNavigate}
        onBack={() => onNavigate?.('data')}
      />
    )
  }

  if (isLoading && instances.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading LAMA replication state...</p>
        </div>
      </div>
    )
  }
  
  // Show empty state if no instances
  if (!isLoading && instances.length === 0 && !error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No LAMA Instances</h3>
          <p className="text-muted-foreground">No LAMA instances are currently provisioned.</p>
          <p className="text-sm text-muted-foreground mt-2">Deploy a Node instance to start replication monitoring.</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Data Dashboard</h2>
          <p className="text-muted-foreground">Monitor your LAMA replication and storage</p>
          {error && (
            <div className="mt-2 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              Error: {error}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => onNavigate?.('hierarchy')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Total Objects
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dataStats.totalObjects.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <Activity className="h-3 w-3 inline mr-1" />
              {dataStats.recentActivity} recent
            </p>
            <p className="text-xs text-blue-600 mt-1">Click for details →</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(dataStats.totalSize)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <Database className="h-3 w-3 inline mr-1" />
              Across all instances
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dataStats.messages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              In {dataStats.conversations} conversations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Files & Media</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dataStats.files}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dataStats.versions.toLocaleString()} versions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="instances" className="space-y-4">
        <TabsList>
          <TabsTrigger value="instances">LAMA Instances</TabsTrigger>
          <TabsTrigger value="replication">Replication Activity</TabsTrigger>
          <TabsTrigger value="storage">Storage Details</TabsTrigger>
        </TabsList>

        <TabsContent value="instances" className="space-y-4">
          <div className="grid gap-4">
            {instances.map(instance => (
              <Card key={instance.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getInstanceIcon(instance.type)}
                      <CardTitle className="text-lg">{instance.name}</CardTitle>
                      <Badge variant={instance.role === 'archive' ? 'default' : instance.role === 'cache' ? 'secondary' : 'outline'}>
                        {instance.role}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(instance.status)}
                      <span className="text-sm text-muted-foreground">
                        {instance.status === 'online' ? 'Connected' : instance.status === 'syncing' ? 'Syncing' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  <CardDescription>{instance.endpoint}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Storage Usage</span>
                      <span className="text-sm text-muted-foreground">
                        {formatBytes(instance.storage.used)} / {formatBytes(instance.storage.total)}
                      </span>
                    </div>
                    <Progress value={instance.storage.percentage} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Last Sync:</span>
                      <span className="ml-2 font-medium">{formatTimeAgo(instance.lastSync)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Queue:</span>
                      <span className="ml-2 font-medium">
                        {instance.replication.queueSize} items
                        {instance.replication.failedItems > 0 && (
                          <span className="text-red-500 ml-1">({instance.replication.failedItems} failed)</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {instance.replication.inProgress && (
                    <div className="flex items-center space-x-2 text-sm text-blue-500">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Synchronization in progress...</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="replication" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Replication Events</CardTitle>
              <CardDescription>Real-time synchronization activity across your LAMA network</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {replicationEvents.map(event => (
                    <div key={event.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                      {getEventIcon(event.type)}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{event.details}</p>
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(event.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {event.source} → {event.target}
                        </p>
                      </div>
                      {event.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {event.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                      {event.status === 'pending' && <Clock className="h-4 w-4 text-yellow-500" />}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Storage Distribution</CardTitle>
                <CardDescription>Data types across all instances</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Messages</span>
                    <span className="text-sm font-medium">{dataStats.messages.toLocaleString()}</span>
                  </div>
                  <Progress value={60} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Files</span>
                    <span className="text-sm font-medium">{dataStats.files}</span>
                  </div>
                  <Progress value={25} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Contacts</span>
                    <span className="text-sm font-medium">{dataStats.contacts}</span>
                  </div>
                  <Progress value={10} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Version History</span>
                    <span className="text-sm font-medium">{dataStats.versions.toLocaleString()}</span>
                  </div>
                  <Progress value={5} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Storage Strategy</CardTitle>
                <CardDescription>Optimized for each device type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="h-4 w-4" />
                    <span className="text-sm font-medium">Node (Archive)</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    Full storage - All versions, all objects, unlimited capacity
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Monitor className="h-4 w-4" />
                    <span className="text-sm font-medium">Browser (Cache)</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    Smart cache - Recent 30 days, LRU eviction, 500MB limit
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="h-4 w-4" />
                    <span className="text-sm font-medium">Mobile (Minimal)</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    Essentials only - Active conversations, 50MB limit
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
    </div>
  )
}