import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Users, UserPlus, Link, QrCode, Copy, Check, Circle, 
  RefreshCw, Wifi, WifiOff, Shield, X, AlertTriangle,
  Loader2, ExternalLink, Network
} from 'lucide-react'
import { lamaBridge } from '@/bridge/lama-bridge'
import { QRCodeSVG } from 'qrcode.react'

interface Connection {
  id: string
  personId: string
  name: string
  status: 'connected' | 'connecting' | 'disconnected'
  type: 'direct' | 'relay'
  endpoint?: string
  lastSeen: Date
  trustLevel?: 'full' | 'partial' | 'none'
}

interface PairingInvitation {
  url: string
  token: string
  publicKey: string
  expiresAt: Date
}

interface ConnectionsViewProps {
  onNavigateToChat?: (topicId: string, contactName: string) => void
}

export function ConnectionsView({ onNavigateToChat }: ConnectionsViewProps = {}) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [isCreatingInvitation, setIsCreatingInvitation] = useState(false)
  const [currentInvitation, setCurrentInvitation] = useState<PairingInvitation | null>(null)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showAcceptDialog, setShowAcceptDialog] = useState(false)
  const [invitationUrl, setInvitationUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('offline')
  const [commServerUrl, setCommServerUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const appModel = lamaBridge.getAppModel()

  // Get edda domain from settings with fallback
  const getEddaDomain = (): string => {
    // Check if user has configured a custom domain
    const customDomain = localStorage.getItem('edda-domain')
    if (customDomain) {
      return customDomain
    }
    
    // Fallback to environment-based domain detection
    const eddaDomains = {
      development: 'edda.dev.refinio.one',
      production: 'edda.one'
    }
    
    // Detect environment - in Electron, check if we're in development
    const isDevelopment = window.electronAPI?.isDevelopment || 
                         process.env.NODE_ENV === 'development' ||
                         window.location.hostname === 'localhost'
    
    return isDevelopment ? eddaDomains.development : eddaDomains.production
  }

  // Load connections and network status
  useEffect(() => {
    loadConnections()
    checkNetworkStatus()
    
    // Set up event listeners if available
    if (appModel?.transportManager) {
      const handleConnectionEstablished = async (connectionInfo?: any) => {
        console.log('[ConnectionsView] Connection established, auto-closing invite dialog and navigating to chat')
        // Auto-close the invite dialog when a new connection is established
        setShowInviteDialog(false)
        setCurrentInvitation(null)
        setCopied(false)
        
        // Load connections to get the latest
        await loadConnections()
        
        // Try to navigate to chat with the new contact
        if (onNavigateToChat && connectionInfo) {
          try {
            // Get the person ID from the connection info
            const personId = connectionInfo.personId || connectionInfo.id
            
            if (personId) {
              // Get or create topic for this contact
              const topicId = await lamaBridge.getOrCreateTopicForContact(personId)
              
              if (topicId) {
                // Get contact name from connection info or use default
                const contactName = connectionInfo.name || 
                                  connectionInfo.displayName || 
                                  `Contact ${personId.toString().substring(0, 8)}`
                
                console.log('[ConnectionsView] Navigating to chat with new contact:', contactName)
                onNavigateToChat(topicId, contactName)
              }
            }
          } catch (error) {
            console.error('[ConnectionsView] Failed to navigate to chat:', error)
          }
        }
      }
      const handleConnectionClosed = () => {
        loadConnections()
      }
      
      // Subscribe to events
      appModel.transportManager.onConnectionEstablished.listen(handleConnectionEstablished)
      appModel.transportManager.onConnectionClosed.listen(handleConnectionClosed)
      
      // Cleanup
      return () => {
        // Unsubscribe from events
      }
    }
    
    // Poll for updates
    const interval = setInterval(() => {
      loadConnections()
      checkNetworkStatus()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [])

  const loadConnections = async () => {
    try {
      if (!appModel?.connections) {
        console.log('[ConnectionsView] Connections model not available yet')
        return
      }

      // Get connections info from ConnectionsModel
      const connectionsInfo = appModel.connections.connectionsInfo()
      
      if (Array.isArray(connectionsInfo)) {
        const formattedConnections: Connection[] = connectionsInfo.map((conn: any) => ({
          id: conn.id || `conn-${Math.random()}`,
          personId: conn.personId || '',
          name: conn.name || 'Unknown',
          status: conn.isConnected ? 'connected' : 'disconnected',
          type: conn.type === 'direct' ? 'direct' : 'relay',
          endpoint: conn.endpoint,
          lastSeen: new Date(conn.lastSeen || Date.now()),
          trustLevel: conn.trusted ? 'full' : 'partial'
        }))
        
        setConnections(formattedConnections)
      }
    } catch (error) {
      console.error('[ConnectionsView] Failed to load connections:', error)
    }
  }

  const checkNetworkStatus = async () => {
    try {
      if (!appModel?.connections) {
        setNetworkStatus('offline')
        return
      }

      // Check if ConnectionsModel has online connections
      // ConnectionsModel doesn't have isOnline method, check connections instead
      const connectionsInfo = appModel.connections.connectionsInfo?.() || []
      const hasActiveConnections = Array.isArray(connectionsInfo) && connectionsInfo.length > 0
      
      // Check if transport is actually connected
      const transport = appModel.transportManager?.getTransport?.('COMM_SERVER' as any)
      const isTransportConnected = transport?.isAvailable?.() || false
      
      setNetworkStatus(hasActiveConnections || isTransportConnected ? 'online' : 'offline')
      
      // Get CommServer URL from the transport config
      const commServerUrl = appModel.transportManager?.commServerUrl || 'wss://comm10.dev.refinio.one'
      setCommServerUrl(commServerUrl)
    } catch (error) {
      console.error('[ConnectionsView] Failed to check network status:', error)
      setNetworkStatus('offline')
    }
  }

  const createInvitation = async () => {
    setIsCreatingInvitation(true)
    setError(null)
    
    try {
      // Check if ConnectionsModel is available
      if (!appModel?.connections) {
        throw new Error('Network system not initialized yet. Please wait a moment and try again.')
      }
      
      // Check if pairing manager is available
      if (!appModel.connections.pairing) {
        throw new Error('Pairing system not available. Please restart the application.')
      }

      console.log('[ConnectionsView] Creating proper invitation URL...')

      // Create invitation through ConnectionsModel's pairing manager
      const invitationData = await appModel.connections.pairing.createInvitation()
      
      console.log('[ConnectionsView] Raw invitation data:', invitationData)
      
      // Extract the raw invitation data (token, publicKey, url)
      const token = invitationData.token || ''
      const publicKey = invitationData.publicKey || ''
      const wsUrl = invitationData.url || ''
      
      if (!token || !publicKey || !wsUrl) {
        throw new Error('Invalid invitation data: missing required fields')
      }

      // Create the invitation data object for encoding
      const invitePayload = {
        token,
        publicKey,
        url: wsUrl
      }
      
      // Encode the invitation data as URL fragment (following one.leute pattern)
      const encodedData = encodeURIComponent(JSON.stringify(invitePayload))
      
      // Create the proper invitation URL following one.leute format
      // Use edda.one domain for cross-machine compatibility
      const eddaDomain = getEddaDomain()
      const fullInvitationUrl = `https://${eddaDomain}/invites/invitePartner/?invited=true/#${encodedData}`
      
      console.log('[ConnectionsView] Generated invitation URL:', fullInvitationUrl)
      
      const invitation: PairingInvitation = {
        url: fullInvitationUrl,
        token,
        publicKey,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      }
      
      setCurrentInvitation(invitation)
      setShowInviteDialog(true)
    } catch (error) {
      console.error('[ConnectionsView] Failed to create invitation:', error)
      // Provide more helpful error messages
      let errorMessage = 'Failed to create invitation'
      if (error instanceof Error) {
        if (error.message.includes('promisePlugin')) {
          errorMessage = 'Network connection not established. Please wait for connection to initialize.'
        } else {
          errorMessage = error.message
        }
      }
      setError(errorMessage)
    } finally {
      setIsCreatingInvitation(false)
    }
  }

  const acceptInvitation = async () => {
    if (!invitationUrl) return
    
    setIsRefreshing(true)
    setError(null)
    
    try {
      if (!appModel?.connections?.pairing) {
        throw new Error('Pairing manager not available')
      }

      // Parse the invitation URL using the utility
      const { parseInvitationUrl, getPairingInformation } = await import('@/utils/invitation-url-parser')
      const parsed = parseInvitationUrl(invitationUrl)
      
      if (!parsed.invitation) {
        throw new Error(parsed.error || 'Invalid invitation URL')
      }
      
      // Accept the invitation
      const result = await appModel.connections.pairing.acceptInvitation(parsed.invitation)
      
      // Refresh connections
      await loadConnections()
      setShowAcceptDialog(false)
      setInvitationUrl('')
      
      // Try to navigate to chat with the new contact after accepting invitation
      if (onNavigateToChat && result) {
        try {
          // Get the person ID from the result if available
          const personId = result.personId || result.id
          
          if (personId) {
            // Get or create topic for this contact
            const topicId = await lamaBridge.getOrCreateTopicForContact(personId)
            
            if (topicId) {
              // Get contact name from result or use default
              const contactName = result.name || 
                                result.displayName || 
                                `Contact ${personId.toString().substring(0, 8)}`
              
              console.log('[ConnectionsView] Navigating to chat with accepted contact:', contactName)
              onNavigateToChat(topicId, contactName)
            }
          }
        } catch (error) {
          console.error('[ConnectionsView] Failed to navigate to chat after accepting invitation:', error)
        }
      }
    } catch (error) {
      console.error('[ConnectionsView] Failed to accept invitation:', error)
      setError(error instanceof Error ? error.message : 'Failed to accept invitation')
    } finally {
      setIsRefreshing(false)
    }
  }

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      // Use browser clipboard API (works in Electron renderer)
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      // Fallback: try selecting and copying the text
      try {
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError)
      }
    }
  }, [])

  const refreshConnections = async () => {
    setIsRefreshing(true)
    await loadConnections()
    await checkNetworkStatus()
    setIsRefreshing(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-500'
      case 'disconnected': return 'text-gray-500'
      default: return 'text-gray-500'
    }
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Network Status Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center space-x-2">
                {networkStatus === 'online' ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-gray-500" />
                )}
                <span className="font-medium">
                  {networkStatus === 'online' ? 'Connected' : 'Offline'}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Relay: {commServerUrl}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshConnections}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAcceptDialog(true)}
              >
                <Link className="h-4 w-4 mr-2" />
                Accept Invite
              </Button>
              <Button
                size="sm"
                onClick={createInvitation}
                disabled={isCreatingInvitation}
              >
                {isCreatingInvitation ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Create Invite
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Connections Tabs */}
      <Tabs defaultValue="active" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">
            Active ({connections.filter(c => c.status === 'connected').length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({connections.filter(c => c.status === 'disconnected').length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({connections.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="flex-1 mt-4">
          <ConnectionsList 
            connections={connections.filter(c => c.status === 'connected')}
            onRefresh={refreshConnections}
          />
        </TabsContent>

        <TabsContent value="pending" className="flex-1 mt-4">
          <ConnectionsList 
            connections={connections.filter(c => c.status === 'disconnected')}
            onRefresh={refreshConnections}
          />
        </TabsContent>

        <TabsContent value="all" className="flex-1 mt-4">
          <ConnectionsList 
            connections={connections}
            onRefresh={refreshConnections}
          />
        </TabsContent>
      </Tabs>

      {/* Create Invitation Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Invitation</DialogTitle>
            <DialogDescription>
              Share this invitation link or QR code to connect with another device. This invitation creates a secure peer-to-peer connection.
            </DialogDescription>
          </DialogHeader>
          
          {currentInvitation && (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                <QRCodeSVG value={currentInvitation.url} size={200} />
              </div>
              
              {/* URL */}
              <div className="space-y-2">
                <Label>Invitation URL</Label>
                <div className="flex space-x-2">
                  <Input 
                    value={currentInvitation.url} 
                    readOnly 
                    className="text-xs font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(currentInvitation.url)}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              {/* Connection Details */}
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Domain: {getEddaDomain()}</div>
                <div>Token: {currentInvitation.token.substring(0, 16)}...</div>
                <div>Public Key: {currentInvitation.publicKey.substring(0, 16)}...</div>
                <div>Expires: {currentInvitation.expiresAt.toLocaleTimeString()}</div>
              </div>
              
              {/* Instructions */}
              <div className="text-sm bg-blue-50 p-3 rounded-lg">
                <p className="font-medium mb-1">How to connect:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Share this QR code or URL with the other person</li>
                  <li>They scan the QR code or paste the URL in their app</li>
                  <li>Connection will be established automatically</li>
                </ol>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept Invitation Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Invitation</DialogTitle>
            <DialogDescription>
              Paste the invitation URL to connect with another device
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Invitation URL</Label>
              <Input
                placeholder="https://..."
                value={invitationUrl}
                onChange={(e) => setInvitationUrl(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAcceptDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={acceptInvitation} 
              disabled={!invitationUrl || isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Connections List Component
function ConnectionsList({ 
  connections, 
  onRefresh 
}: { 
  connections: Connection[]
  onRefresh: () => void 
}) {
  if (connections.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-8">
          <Network className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No connections</p>
          <p className="text-sm text-muted-foreground mt-2">
            Create an invitation to connect with other devices
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <ScrollArea className="h-full">
        <CardContent className="p-4 space-y-2">
          {connections.map((connection) => (
            <Card key={connection.id} className="hover:bg-accent transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Circle className={`h-2 w-2 fill-current ${
                      connection.status === 'connected' ? 'text-green-500' : 'text-gray-500'
                    }`} />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{connection.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {connection.type === 'direct' ? 'P2P' : 'Relay'}
                        </Badge>
                        {connection.trustLevel === 'full' && (
                          <Shield className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {connection.endpoint || connection.personId.substring(0, 8)}...
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Last seen: {connection.lastSeen.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </ScrollArea>
    </Card>
  )
}