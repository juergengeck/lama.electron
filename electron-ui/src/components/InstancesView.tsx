/**
 * Instances View - Shows connected devices/instances
 * Similar to one.leute's InstancesSettingsView
 */

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Monitor,
  Smartphone,
  Tablet,
  HardDrive,
  AlertCircle,
  MoreVertical,
  CheckCircle,
  XCircle,
  Plus,
  Copy,
  User
} from 'lucide-react'

interface Instance {
  id: string
  personId: string
  name: string
  platform: 'browser' | 'nodejs' | 'mobile' | 'desktop' | 'unknown'
  role: 'hub' | 'client' | 'peer'
  isLocal: boolean
  isConnected: boolean
  trusted: boolean
  lastSeen: Date
  capabilities?: {
    network?: boolean
    storage?: boolean
    llm?: boolean
  }
  connectionInfo?: {
    endpoint?: string
    protocol?: string
    latency?: number
  }
}

export default function InstancesView() {
  const [browserInstance, setBrowserInstance] = useState<Instance | null>(null)
  const [nodeInstance, setNodeInstance] = useState<Instance | null>(null)
  const [myDevices, setMyDevices] = useState<Instance[]>([])
  const [contacts, setContacts] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [inviteType, setInviteType] = useState<'device' | 'contact'>('device')
  const [nodeReady, setNodeReady] = useState(false)

  useEffect(() => {
    loadInstances()
    
    // Listen for instance updates via CHUM sync
    const handleChumSync = (event: any) => {
      if (event.detail?.type === 'ConnectionInfo') {
        loadInstances()
      }
    }
    
    window.addEventListener('chum:sync', handleChumSync)
    return () => window.removeEventListener('chum:sync', handleChumSync)
  }, [])

  const checkNodeReadiness = async () => {
    if (!window.electronAPI) {
      setNodeReady(false)
      return
    }

    try {
      // Check if Node.js instance is ready for invitations
      const result = await window.electronAPI.invoke('devices:getInstanceInfo')
      console.log('[InstancesView] Node readiness check result:', result)
      
      // Check if node is initialized and has pairing capability
      if (result?.success && result.nodeInitialized && result.hasPairing) {
        console.log('[InstancesView] Node is ready for pairing invitations')
        setNodeReady(true)
      } else {
        console.log('[InstancesView] Node not ready:', {
          success: result?.success,
          nodeInitialized: result?.nodeInitialized,
          hasPairing: result?.hasPairing
        })
        setNodeReady(false)
      }
    } catch (error) {
      console.log('[InstancesView] Node readiness check failed:', error)
      setNodeReady(false)
    }
  }

  const loadInstances = async () => {
    try {
      // Get browser instance info (this renderer)
      const browserInfo = {
        id: 'browser-' + (window.lamaBridge?.appModel?.leuteModel?.myMainIdentity?.() || 'instance'),
        personId: window.lamaBridge?.appModel?.leuteModel?.myMainIdentity?.() || 'browser-instance',
        name: 'Browser UI',
        platform: 'browser' as const,
        role: 'client' as const,
        isLocal: true,
        isConnected: true,
        trusted: true,
        lastSeen: new Date(),
        capabilities: {
          network: false,  // Browser can't do direct networking
          storage: true,   // Has IndexedDB for sparse storage
          llm: false       // No direct LLM access
        }
      }
      setBrowserInstance(browserInfo)

      // Get Node.js instance info
      const nodeInfo = await window.lamaBridge.getInstanceInfo()
      if (nodeInfo.success && nodeInfo.instance) {
        setNodeInstance({
          id: nodeInfo.instance.id,
          personId: nodeInfo.instance.id,
          name: nodeInfo.instance.name || 'Node.js Hub',
          platform: 'nodejs' as const,
          role: 'hub' as const,
          isLocal: true,
          isConnected: nodeInfo.instance.initialized || false,
          trusted: true,
          lastSeen: new Date(),
          capabilities: nodeInfo.instance.capabilities || {
            network: true,   // Node.js handles networking
            storage: true,   // Archive storage
            llm: true        // LLM management
          }
        })
      }

      // Get contacts - show Node.js owner even if browser ONE.core isn't initialized
      try {
        const chumContacts: Instance[] = []
        
        // Always try to get Node.js instance info first
        const nodeInfo = await window.electronAPI?.invoke('devices:getInstanceInfo')
        if (nodeInfo?.success && nodeInfo.ownerId) {
          chumContacts.push({
            id: `nodejs-owner-${nodeInfo.ownerId}`,
            personId: nodeInfo.ownerId,
            name: `${nodeInfo.instanceName || 'Node.js Hub'} (Owner)`,
            platform: 'nodejs' as const,
            role: 'hub' as const,
            isLocal: true,
            isConnected: true,
            trusted: true,
            lastSeen: new Date(),
            capabilities: {}
          })
          console.log('[InstancesView] Added Node.js owner:', nodeInfo.instanceName)
        }
        
        // If browser ONE.core is initialized, add synced contacts via CHUM
        if (window.appModel?.leuteModel) {
          const others = await window.appModel.leuteModel.others()
          console.log(`[InstancesView] Found ${others.length} contacts in browser LeuteModel (via CHUM)`)
          
          // Add other contacts synced via CHUM
          for (const someone of others) {
            try {
              const personId = await someone.mainIdentity()
              const profile = await someone.mainProfile()

              // Skip if this is the same as Node.js owner (avoid duplicates)
              if (personId === nodeInfo?.ownerId) {
                continue
              }

              // Get name from PersonName description
              const personName = profile?.personDescriptions?.find((d: any) => d.$type$ === 'PersonName')
              const contactName = personName?.name || `Contact ${personId.substring(0, 8)}`

              chumContacts.push({
                id: `contact-${personId}`,
                personId: personId,
                name: contactName,
                platform: 'external' as const,
                role: 'contact' as const,
                isLocal: false,
                isConnected: true,
                trusted: true,
                lastSeen: new Date(),
                capabilities: {}
              })
            } catch (error) {
              console.warn('[InstancesView] Error processing contact:', error)
            }
          }
          
          console.log(`[InstancesView] Added ${others.length} CHUM-synced contacts`)
        } else {
          console.log('[InstancesView] Browser ONE.core not initialized, showing Node.js owner only')
        }
        
        setContacts(chumContacts)
        console.log(`[InstancesView] Set ${chumContacts.length} total contacts`)
      } catch (error) {
        console.error('[InstancesView] Error getting contacts:', error)
      }

      // TODO: Get actual my devices from connections model
      setMyDevices([])

      // Check if Node.js instance is ready for invitations
      await checkNodeReadiness()
    } catch (error) {
      console.error('[InstancesView] Error loading instances:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateInvitation = async () => {
    try {
      console.log('[InstancesView] Creating invitation...')
      // Create invitation in Node.js ONE.core instance via IPC
      // Use 'invitation:create' from devices handler (has better error handling)
      const result = await window.electronAPI?.invoke('invitation:create')
      console.log('[InstancesView] Full invitation result:', JSON.stringify(result, null, 2))
      
      if (result?.success && result.invitation) {
        // The invitation URL already includes the token
        const inviteText = result.invitation.url
        console.log('[InstancesView] Invitation URL to copy:', inviteText)
        console.log('[InstancesView] Invitation token:', result.invitation.token)
        await navigator.clipboard.writeText(inviteText)
        setCopiedInvite(true)
        setTimeout(() => setCopiedInvite(false), 3000)
        console.log('[InstancesView] ONE.core invitation copied to clipboard')
      } else {
        console.error('[InstancesView] Failed to create ONE.core invitation:', result?.error || result)
        alert('Failed to create invitation: ' + (result?.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('[InstancesView] Error creating ONE.core invitation:', error)
      alert('Error creating invitation: ' + error.message)
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'browser':
        return <Monitor className="h-4 w-4" />
      case 'mobile':
        return <Smartphone className="h-4 w-4" />
      case 'desktop':
        return <Monitor className="h-4 w-4" />
      case 'nodejs':
        return <HardDrive className="h-4 w-4" />
      case 'tablet':
        return <Tablet className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (role) {
      case 'hub':
        return 'default'
      case 'client':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Loading instances...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Local Instances */}
      <div>
        <h3 className="text-sm font-medium mb-2">Local Instances</h3>
        <Card>
          <CardContent className="p-0">
            {/* Browser Instance */}
            {browserInstance && (
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      {getPlatformIcon(browserInstance.platform)}
                    </div>
                    <div>
                      <div className="font-medium">{browserInstance.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Renderer Process
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={getRoleBadgeVariant(browserInstance.role)}>
                          {browserInstance.role}
                        </Badge>
                        <Badge variant="outline">
                          {browserInstance.platform}
                        </Badge>
                        {browserInstance.capabilities?.storage && (
                          <Badge variant="secondary">Sparse Storage</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>
            )}
            
            <Separator />
            
            {/* Node.js Instance */}
            {nodeInstance && (
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {getPlatformIcon(nodeInstance.platform)}
                    </div>
                    <div>
                      <div className="font-medium">{nodeInstance.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Main Process - {nodeInstance.id?.substring(0, 12)}...
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={getRoleBadgeVariant(nodeInstance.role)}>
                          {nodeInstance.role}
                        </Badge>
                        <Badge variant="outline">
                          {nodeInstance.platform}
                        </Badge>
                        {nodeInstance.capabilities?.network && (
                          <Badge variant="secondary">Network</Badge>
                        )}
                        {nodeInstance.capabilities?.storage && (
                          <Badge variant="secondary">Archive Storage</Badge>
                        )}
                        {nodeInstance.capabilities?.llm && (
                          <Badge variant="secondary">LLM</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {nodeInstance.isConnected ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* My Devices (Internet of Me) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">
            My Devices ({myDevices.length})
          </h3>
          <Button
            size="sm"
            onClick={() => {
              setInviteType('device')
              handleCreateInvitation()
            }}
            className="gap-2"
          >
            <Plus className="h-3 w-3" />
            Add Device
          </Button>
        </div>

        {myDevices.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                No additional devices. Add your phone, tablet, or other devices to your Internet of Me.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {myDevices.map((device, index) => (
                <div key={device.id}>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${
                          device.isConnected ? 'bg-green-500/10' : 'bg-gray-500/10'
                        }`}>
                          {getPlatformIcon(device.platform)}
                        </div>
                        <div>
                          <div className="font-medium">{device.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {device.personId ? `${device.personId.substring(0, 12)}...` : 'No ID'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Last seen: {device.lastSeen.toLocaleString()}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">
                              {device.platform}
                            </Badge>
                            <Badge variant="secondary">My Device</Badge>
                            {device.isConnected && (
                              <Badge variant="default">Connected</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {device.isConnected ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-400" />
                        )}
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {index < myDevices.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* NodeJS Contacts (Other People's Instances) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">
            NodeJS Contacts ({contacts.length})
          </h3>
          {nodeReady ? (
            <Button
              size="sm"
              onClick={() => {
                handleCreateInvitation()
              }}
              className="gap-2"
            >
              {copiedInvite ? (
                <>
                  <Copy className="h-3 w-3" />
                  Copied!
                </>
              ) : (
                <>
                  <User className="h-3 w-3" />
                  Add Contact
                </>
              )}
            </Button>
          ) : null}
        </div>

        {contacts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                No contacts yet. Share your invitation link to connect with other users.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {contacts.map((contact, index) => (
                <div key={contact.id}>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${
                          contact.isConnected ? 'bg-blue-500/10' : 'bg-gray-500/10'
                        }`}>
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">{contact.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {contact.personId ? `${contact.personId.substring(0, 12)}...` : 'No ID'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Last seen: {contact.lastSeen.toLocaleString()}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {contact.trusted && (
                              <Badge variant="secondary">Trusted</Badge>
                            )}
                            {contact.isConnected && (
                              <Badge variant="default">Connected</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {contact.isConnected ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-400" />
                        )}
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {index < contacts.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}