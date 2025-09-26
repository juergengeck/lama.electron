import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Settings, User, Shield, Globe, Cpu, HardDrive,
  Moon, Sun, Save, RefreshCw, LogOut, Brain, Download, CheckCircle, Circle, Zap, MessageSquare, Code, Key, AlertTriangle, Users, Trash2, Database, Hash, Clock, Package, Eye, ChevronDown, ChevronRight, Copy, FileText, Monitor
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { lamaBridge } from '@/bridge/lama-bridge'
import { ipcStorage } from '@/services/ipc-storage'
import { Alert, AlertDescription } from '@/components/ui/alert'
import InstancesView from './InstancesView'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface NetworkSettings {
  relayServer: string
  port: number
  udpPort: number
  enableP2P: boolean
  enableRelay: boolean
  eddaDomain?: string
}

interface SettingsViewProps {
  onLogout?: () => void
  onNavigate?: (tab: string, conversationId?: string, section?: string) => void
}

interface ModelInfo {
  id: string
  name: string
  description: string
  provider: string
  modelType: string
  capabilities: string[]
  contextLength: number
  size: number
  isLoaded: boolean
  isDefault: boolean
}

interface SystemObject {
  id: string
  type: string
  hash: string
  size: number
  created: Date
  lastModified: Date
  metadata?: Record<string, any>
}

export function SettingsView({ onLogout, onNavigate }: SettingsViewProps) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(true)
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [claudeApiKey, setClaudeApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<'unconfigured' | 'testing' | 'valid' | 'invalid'>('unconfigured')
  
  // System objects state
  const [systemObjects, setSystemObjects] = useState<{
    keys: SystemObject[]
    metadata: SystemObject[]
    crdt: SystemObject[]
  }>({
    keys: [],
    metadata: [],
    crdt: []
  })
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [loadingSystemObjects, setLoadingSystemObjects] = useState(false)
  const [loadingDataStats, setLoadingDataStats] = useState(false)
  const [dataStats, setDataStats] = useState({
    totalObjects: 0,
    totalSize: 0,
    messages: 0,
    files: 0,
    contacts: 0,
    conversations: 0,
    versions: 0,
    recentActivity: 0,
    messagesSize: 0,
    filesSize: 0,
    systemSize: 0,
    modelsSize: 0
  })
  const [settings, setSettings] = useState({
    profile: {
      name: 'Test User',
      id: 'user-1',
      publicKey: '0x1234...abcd'
    },
    network: {
      relayServer: 'wss://comm10.dev.refinio.one',
      port: 443,  // WSS default port
      udpPort: 8080,  // For P2P UDP connections
      enableP2P: true,
      enableRelay: true,
      eddaDomain: 'edda.dev.refinio.one'
    },
    ai: {
      modelPath: '/models/llama-7b.gguf',
      contextSize: 2048,
      temperature: 0.7
    },
    privacy: {
      autoEncrypt: true,
      saveHistory: true,
      shareAnalytics: false
    },
    appearance: {
      theme: 'dark'
    }
  })

  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    loadModels()
    loadClaudeApiKey()
    loadSystemObjects()
    loadDataStats()

    // Load Edda domain from storage
    ipcStorage.getItem('edda-domain').then(domain => {
      if (domain) {
        setSettings(prev => ({
          ...prev,
          network: { ...prev.network, eddaDomain: domain }
        }))
      }
    })

    // Handle navigation to specific section
    const scrollToSection = sessionStorage.getItem('settings-scroll-to')
    if (scrollToSection === 'system-objects') {
      // Clear the navigation flag
      sessionStorage.removeItem('settings-scroll-to')
      
      // Expand the system objects sections and scroll to it
      setExpandedSections({
        keys: true,
        metadata: true, 
        crdt: true
      })
      
      // Scroll after a short delay to allow DOM to update
      setTimeout(() => {
        const systemObjectsElement = document.getElementById('system-objects-section')
        if (systemObjectsElement) {
          systemObjectsElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          })
        }
      }, 100)
    }
  }, [])

  const loadModels = async () => {
    try {
      setLoadingModels(true)
      const modelList = await lamaBridge.getAvailableModels()
      setModels(modelList)
    } catch (error) {
      console.error('Failed to load models:', error)
    } finally {
      setLoadingModels(false)
    }
  }

  const handleLoadModel = async (modelId: string) => {
    setLoadingStates(prev => ({ ...prev, [modelId]: true }))
    try {
      const success = await lamaBridge.loadModel(modelId)
      if (success) {
        await loadModels()
      }
    } catch (error) {
      console.error('Failed to load model:', error)
    } finally {
      setLoadingStates(prev => ({ ...prev, [modelId]: false }))
    }
  }

  const handleSetDefault = async (modelId: string) => {
    try {
      const success = await lamaBridge.setDefaultModel(modelId)
      if (success) {
        await loadModels()
      }
    } catch (error) {
      console.error('Failed to set default model:', error)
    }
  }

  const loadSystemObjects = async () => {
    setLoadingSystemObjects(true)
    try {
      // Fetch real keys and certificates from IPC handlers
      const [keysResult, certsResult] = await Promise.all([
        window.electronAPI?.invoke('crypto:getKeys'),
        window.electronAPI?.invoke('crypto:getCertificates')
      ])
      
      const keys = []
      const certificates = []
      
      if (keysResult?.success && keysResult.data) {
        // Process keys from crypto handler
        keysResult.data.forEach(key => {
          keys.push({
            id: key.id,
            type: key.type,
            hash: key.fingerprint || 'sha256:' + key.id.slice(0, 32),
            size: key.size || 256,
            created: new Date(key.created),
            lastModified: new Date(key.modified),
            metadata: {
              algorithm: key.algorithm,
              filename: key.filename,
              isPrivate: key.isPrivate,
              pemData: key.pemData
            }
          })
        })
      }
      
      if (certsResult?.success && certsResult.data) {
        // Process certificates from crypto handler
        certsResult.data.forEach(cert => {
          certificates.push({
            id: cert.id,
            type: cert.type,
            hash: cert.fingerprint || 'sha256:' + cert.id.slice(0, 32),
            size: cert.size || 1024,
            created: new Date(cert.validFrom),
            lastModified: new Date(cert.validFrom),
            metadata: {
              subject: cert.subject,
              issuer: cert.issuer,
              validTo: new Date(cert.validTo),
              serialNumber: cert.serialNumber
            }
          })
        })
      }
      
      // Add certificates to keys array (they're both crypto objects)
      const allCryptoObjects = [...keys, ...certificates]
      
      // Get metadata and CRDT objects via IPC (future enhancement)
      
      const mockSystemObjects = {
        keys: allCryptoObjects.length > 0 ? allCryptoObjects : [
          {
            id: 'no-keys',
            type: 'No Keys Found',
            hash: 'sha256:def456...',
            size: 2048,
            created: new Date(Date.now() - 86400000 * 30),
            lastModified: new Date(Date.now() - 86400000 * 10),
            metadata: { algorithm: 'X25519', usage: 'encryption' }
          },
          {
            id: 'signing-cert',
            type: 'Certificate',
            hash: 'sha256:ghi789...',
            size: 1024,
            created: new Date(Date.now() - 86400000 * 30),
            lastModified: new Date(Date.now() - 86400000 * 30),
            metadata: { issuer: 'self-signed', validity: '365 days' }
          }
        ],
        metadata: [
          {
            id: 'contact-index',
            type: 'Contact Index',
            hash: 'sha256:jkl012...',
            size: 4096,
            created: new Date(Date.now() - 86400000 * 20),
            lastModified: new Date(Date.now() - 3600000),
            metadata: { entries: 5, version: 2 }
          },
          {
            id: 'message-index',
            type: 'Message Index',
            hash: 'sha256:mno345...',
            size: 8192,
            created: new Date(Date.now() - 86400000 * 15),
            lastModified: new Date(Date.now() - 7200000),
            metadata: { messages: 1, conversations: 1, version: 3 }
          },
          {
            id: 'schema-registry',
            type: 'Schema Registry',
            hash: 'sha256:pqr678...',
            size: 2048,
            created: new Date(Date.now() - 86400000 * 30),
            lastModified: new Date(Date.now() - 86400000 * 25),
            metadata: { schemas: 12, version: 1 }
          }
        ],
        crdt: [
          {
            id: 'vector-clock',
            type: 'Vector Clock',
            hash: 'sha256:stu901...',
            size: 512,
            created: new Date(Date.now() - 86400000 * 10),
            lastModified: new Date(Date.now() - 300000),
            metadata: { nodes: 1, clock: 47, operations: 15 }
          },
          {
            id: 'operation-log',
            type: 'Operation Log',
            hash: 'sha256:vwx234...',
            size: 16384,
            created: new Date(Date.now() - 86400000 * 10),
            lastModified: new Date(Date.now() - 300000),
            metadata: { operations: 23, size_mb: 0.016, head: 'op-23' }
          },
          {
            id: 'conflict-resolution',
            type: 'Conflict Resolution',
            hash: 'sha256:yza567...',
            size: 1024,
            created: new Date(Date.now() - 86400000 * 5),
            lastModified: new Date(Date.now() - 86400000),
            metadata: { resolved: 0, pending: 0, strategy: 'last-write-wins' }
          }
        ]
      }
      setSystemObjects(mockSystemObjects)
    } catch (error) {
      console.error('Failed to load system objects:', error)
    } finally {
      setLoadingSystemObjects(false)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // Could add toast notification here
  }

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  const loadDataStats = async () => {
    setLoadingDataStats(true)
    try {
      // Get browser storage estimate
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        const totalSize = estimate.usage || 0

        // Try to get actual stats from IPC
        let stats = {
          totalObjects: 0,
          totalSize,
          messages: 0,
          files: 0,
          contacts: 0,
          conversations: 0,
          versions: 0,
          recentActivity: 0,
          messagesSize: totalSize * 0.3,
          filesSize: totalSize * 0.2,
          systemSize: totalSize * 0.1,
          modelsSize: totalSize * 0.4
        }

        if (window.electronAPI?.invoke) {
          try {
            // Get message and conversation stats
            const conversationsResult = await window.electronAPI.invoke('chat:getConversations')
            if (conversationsResult?.success && conversationsResult.data) {
              stats.conversations = conversationsResult.data.length

              // Count messages in conversations
              let totalMessages = 0
              for (const conv of conversationsResult.data) {
                try {
                  const messagesResult = await window.electronAPI.invoke('chat:getMessages', {
                    conversationId: conv.id
                  })
                  if (messagesResult?.success && messagesResult.messages) {
                    totalMessages += messagesResult.messages.length
                  }
                } catch (e) {
                  console.log('Error counting messages for conversation:', conv.id)
                }
              }
              stats.messages = totalMessages
            }

            // Get contacts count
            const contactsResult = await window.electronAPI.invoke('contacts:list')
            if (contactsResult?.success && contactsResult.contacts) {
              stats.contacts = contactsResult.contacts.length
            }

            // Update total objects
            stats.totalObjects = stats.messages + stats.files + stats.contacts + stats.conversations

            // Try to get more detailed stats from main process
            const detailedStats = await window.electronAPI.invoke('lama:getDataStats')
            if (detailedStats?.success && detailedStats.data) {
              stats = { ...stats, ...detailedStats.data }
            }
          } catch (e) {
            console.error('Error getting data stats from IPC:', e)
          }
        }

        setDataStats(stats)
      }
    } catch (error) {
      console.error('Failed to load data stats:', error)
    } finally {
      setLoadingDataStats(false)
    }
  }

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }
  
  const exportCryptoObject = async (obj: SystemObject) => {
    try {
      // Determine if it's a key or certificate based on metadata
      const isKey = obj.metadata?.algorithm && obj.metadata?.isPrivate !== undefined
      const type = isKey ? 'key' : 'certificate'
      
      const result = await window.electronAPI?.invoke('crypto:export', {
        type,
        id: obj.id,
        format: 'pem'
      })
      
      if (result?.success && result.data) {
        // Create a download link
        const blob = new Blob([result.data.data], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.data.filename || `${obj.id}.pem`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        // Show success message
        console.log(`Exported ${type}: ${obj.id}`)
      }
    } catch (error) {
      console.error('Failed to export crypto object:', error)
    }
  }
  
  const loadClaudeApiKey = async () => {
    try {
      // Retrieve API key from ONE.core's secure storage via IPC
      const result = await window.electronAPI?.invoke('onecore:secureRetrieve', {
        key: 'claude_api_key'
      })
      
      if (result?.success && result.value) {
        setClaudeApiKey(result.value)
        setApiKeyStatus('valid')
      }
    } catch (error) {
      console.error('Failed to load Claude API key:', error)
    }
  }
  
  const handleSaveClaudeApiKey = async () => {
    if (!claudeApiKey) {
      setApiKeyStatus('invalid')
      return
    }
    
    setApiKeyStatus('testing')
    try {
      // Store API key securely in ONE.core's encrypted storage via IPC
      const result = await window.electronAPI?.invoke('onecore:secureStore', {
        key: 'claude_api_key',
        value: claudeApiKey,
        encrypted: true
      })
      
      if (result?.success) {
        // Test the API key with Claude
        const testResult = await window.electronAPI?.invoke('llm:testApiKey', {
          provider: 'anthropic',
          apiKey: claudeApiKey
        })
        
        if (testResult?.success) {
          setApiKeyStatus('valid')
          await loadModels()
        } else {
          setApiKeyStatus('invalid')
        }
      } else {
        throw new Error('Failed to store API key securely')
      }
    } catch (error) {
      console.error('Failed to save Claude API key:', error)
      setApiKeyStatus('invalid')
    }
  }

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'qwen': return <Brain className="h-4 w-4" />
      case 'openai': return <Zap className="h-4 w-4" />
      case 'anthropic': return <MessageSquare className="h-4 w-4" />
      default: return <Cpu className="h-4 w-4" />
    }
  }

  const getCapabilityIcon = (capability: string) => {
    switch (capability.toLowerCase()) {
      case 'coding': return <Code className="h-3 w-3" />
      case 'reasoning': return <Brain className="h-3 w-3" />
      case 'chat': return <MessageSquare className="h-3 w-3" />
      default: return <Circle className="h-3 w-3" />
    }
  }

  const formatSize = (size: number) => {
    if (size === 0) return 'API-based'
    if (size >= 1e9) return `${(size / 1e9).toFixed(1)}B params`
    if (size >= 1e6) return `${(size / 1e6).toFixed(1)}M params`
    return `${size} bytes`
  }

  const handleSave = () => {
    console.log('Saving settings:', settings)
    setHasChanges(false)
    // TODO: Persist settings
  }

  const updateSetting = (category: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [key]: value
      }
    }))
    setHasChanges(true)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-primary" />
              <CardTitle>Settings</CardTitle>
            </div>
            {hasChanges && (
              <Button onClick={handleSave} size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Settings Content */}
      <ScrollArea className="flex-1">
        <div className="space-y-4">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <CardTitle className="text-lg">Profile</CardTitle>
              </div>
              <CardDescription>Manage your identity and keys</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Display Name</Label>
                <Input 
                  value={settings.profile.name}
                  onChange={(e) => updateSetting('profile', 'name', e.target.value)}
                />
              </div>
              <div>
                <Label>Identity ID</Label>
                <div className="flex items-center space-x-2">
                  <Input value={settings.profile.id} disabled />
                  <Button variant="outline" size="sm">Copy</Button>
                </div>
              </div>
              <div>
                <Label>Public Key</Label>
                <div className="flex items-center space-x-2">
                  <code className="text-xs bg-muted p-2 rounded flex-1">{settings.profile.publicKey}</code>
                  <Button variant="outline" size="sm">Export</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Network & Connections */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Globe className="h-4 w-4" />
                <CardTitle className="text-lg">Network & Connections</CardTitle>
              </div>
              <CardDescription>P2P connections and device pairing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Edda Domain Configuration */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Globe className="h-4 w-4" />
                  <h3 className="font-medium">Invitation Domain</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edda-domain">Edda Domain for Invitations</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="edda-domain"
                      type="text"
                      value={settings.network.eddaDomain}
                      onChange={(e) => {
                        const newDomain = e.target.value
                        setSettings(prev => ({
                          ...prev,
                          network: { ...prev.network, eddaDomain: newDomain }
                        }))
                        setHasChanges(true)
                      }}
                      placeholder="edda.dev.refinio.one"
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        // Save the domain to localStorage
                        if (settings.network.eddaDomain) {
                          await ipcStorage.setItem('edda-domain', settings.network.eddaDomain)
                        } else {
                          await ipcStorage.removeItem('edda-domain')
                        }
                        setHasChanges(false)
                      }}
                      disabled={!hasChanges}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This domain will be used in invitation URLs. Use 'edda.dev.refinio.one' for development or 'edda.one' for production.
                  </p>
                </div>
              </div>
              
              <Separator />
              
              {/* Instance Management */}
              <InstancesView />
            </CardContent>
          </Card>

          {/* AI Models */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Brain className="h-4 w-4" />
                <CardTitle className="text-lg">AI Contacts</CardTitle>
              </div>
              <CardDescription>Configure AI assistants as contacts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Claude API Key Configuration */}
              <div className="space-y-2">
                <Label>Claude API Key</Label>
                <div className="flex items-center space-x-2">
                  <Input 
                    type={showApiKey ? "text" : "password"}
                    value={claudeApiKey}
                    onChange={(e) => setClaudeApiKey(e.target.value)}
                    placeholder="sk-ant-..."
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleSaveClaudeApiKey}
                    disabled={apiKeyStatus === 'testing'}
                  >
                    {apiKeyStatus === 'testing' ? 'Testing...' : 'Save'}
                  </Button>
                </div>
                {apiKeyStatus === 'valid' && (
                  <p className="text-xs text-green-500">✓ API key is valid</p>
                )}
                {apiKeyStatus === 'invalid' && (
                  <p className="text-xs text-red-500">✗ Invalid API key</p>
                )}
              </div>

              <Separator />

              {/* AI Contact List */}
              <div className="space-y-2">
                <Label>AI Assistant Contacts</Label>
                {loadingModels ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : models.length === 0 ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No AI contacts configured. Add API keys above to enable AI assistants.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {models.map((model) => (
                      <div key={model.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getProviderIcon(model.provider)}
                            <span className="font-medium">{model.name}</span>
                            <span className="text-xs text-muted-foreground">({model.name.toLowerCase()}@ai.local)</span>
                            {model.isLoaded && (
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {!model.isLoaded && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleLoadModel(model.id)}
                                disabled={loadingStates[model.id]}
                              >
                                {loadingStates[model.id] ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
                                ) : (
                                  <>
                                    <Cpu className="h-3 w-3 mr-1" />
                                    Load Model
                                  </>
                                )}
                              </Button>
                            )}
                            {model.isLoaded && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => console.log('Open chat with', model.name)}
                              >
                                <MessageSquare className="h-3 w-3 mr-1" />
                                Chat
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {model.description} • Chat with this AI assistant in your contacts
                        </div>
                        <div className="flex items-center space-x-4 text-xs">
                          <span>{formatSize(model.size)}</span>
                          <span>·</span>
                          <span>{model.contextLength} token context</span>
                          {model.capabilities.length > 0 && (
                            <>
                              <span>·</span>
                              <div className="flex items-center space-x-1">
                                {model.capabilities.map((cap) => (
                                  <Badge key={cap} variant="secondary" className="text-xs py-0">
                                    {getCapabilityIcon(cap)}
                                    <span className="ml-1">{cap}</span>
                                  </Badge>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Privacy Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <CardTitle className="text-lg">Privacy</CardTitle>
              </div>
              <CardDescription>Security and data preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Auto-encrypt Messages</Label>
                <Button 
                  variant={settings.privacy.autoEncrypt ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateSetting('privacy', 'autoEncrypt', !settings.privacy.autoEncrypt)}
                >
                  {settings.privacy.autoEncrypt ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <Label>Save Chat History</Label>
                <Button 
                  variant={settings.privacy.saveHistory ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateSetting('privacy', 'saveHistory', !settings.privacy.saveHistory)}
                >
                  {settings.privacy.saveHistory ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
              <Separator />
              <div className="pt-2 space-y-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Reset All App Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>This action cannot be undone. This will permanently delete:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>All chat history and messages</li>
                          <li>All contacts and connections</li>
                          <li>All settings and preferences</li>
                          <li>All locally stored AI models</li>
                          <li>Your identity and keys</li>
                        </ul>
                        <p className="font-semibold text-red-500">
                          You will need to create a new identity or restore from backup after this operation.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel autoFocus>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={async () => {
                          try {
                            console.log('[SettingsView] Starting app reset...')
                            
                            // Show immediate feedback
                            const alertDiv = document.createElement('div')
                            alertDiv.style.cssText = `
                              position: fixed;
                              top: 50%;
                              left: 50%;
                              transform: translate(-50%, -50%);
                              background: #1f2937;
                              color: white;
                              padding: 20px;
                              border-radius: 8px;
                              z-index: 9999;
                              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                              text-align: center;
                              font-family: system-ui;
                            `
                            alertDiv.innerHTML = `
                              <div style="font-size: 16px; margin-bottom: 10px;">🔄 Clearing App Data</div>
                              <div style="font-size: 14px; opacity: 0.8;">This will take a few seconds...</div>
                              <div style="margin-top: 15px; font-size: 12px; opacity: 0.6;">
                                The app will automatically restart when complete
                              </div>
                            `
                            document.body.appendChild(alertDiv)
                            
                            // Clear browser-side data first
                            console.log('[SettingsView] Clearing browser storage...')
                            
                            // Clear localStorage and sessionStorage
                            await ipcStorage.clear()
                            sessionStorage.clear()
                            
                            // Clear IndexedDB databases
                            if ('indexedDB' in window) {
                              try {
                                const databases = await indexedDB.databases()
                                for (const db of databases) {
                                  if (db.name) {
                                    await indexedDB.deleteDatabase(db.name)
                                    console.log(`[SettingsView] Deleted IndexedDB database: ${db.name}`)
                                  }
                                }
                              } catch (e) {
                                console.error('[SettingsView] Error clearing IndexedDB:', e)
                              }
                            }
                            
                            // Clear service worker caches if any
                            if ('caches' in window) {
                              try {
                                const cacheNames = await caches.keys()
                                await Promise.all(
                                  cacheNames.map(name => caches.delete(name))
                                )
                                console.log('[SettingsView] Service worker caches cleared')
                              } catch (e) {
                                console.error('[SettingsView] Error clearing caches:', e)
                              }
                            }
                            
                            // Clear cache in the bridge
                            try {
                              lamaBridge.clearConversation('default')
                              console.log('[SettingsView] Bridge cache cleared')
                            } catch (e) {
                              console.error('[SettingsView] Error clearing bridge cache:', e)
                            }
                            
                            // Request main process to clear all data and restart
                            if (window.electronAPI?.clearAppData) {
                              console.log('[SettingsView] Requesting main process to clear all app data...')
                              
                              // Update progress message
                              alertDiv.innerHTML = `
                                <div style="font-size: 16px; margin-bottom: 10px;">🗑️ Clearing All Data</div>
                                <div style="font-size: 14px; opacity: 0.8;">Removing storage files and resetting state...</div>
                                <div style="margin-top: 15px; font-size: 12px; opacity: 0.6;">
                                  App will restart automatically
                                </div>
                              `
                              
                              const result = await window.electronAPI.clearAppData()
                              
                              if (result?.success) {
                                console.log('[SettingsView] App data cleared successfully, app will restart...')
                                
                                // Show final message
                                alertDiv.innerHTML = `
                                  <div style="font-size: 16px; margin-bottom: 10px;">✅ Reset Complete</div>
                                  <div style="font-size: 14px; opacity: 0.8;">Application restarting...</div>
                                `
                                
                                // The main process handles restart
                              } else {
                                console.error('[SettingsView] Failed to clear app data:', result?.error)
                                alertDiv.innerHTML = `
                                  <div style="font-size: 16px; margin-bottom: 10px;">⚠️ Partial Reset</div>
                                  <div style="font-size: 14px; opacity: 0.8;">Some data cleared, restarting app...</div>
                                `
                                
                                // Force restart anyway
                                setTimeout(() => window.location.reload(), 2000)
                              }
                            } else {
                              console.log('[SettingsView] No Electron API available, reloading after browser cleanup...')
                              alertDiv.innerHTML = `
                                <div style="font-size: 16px; margin-bottom: 10px;">🔄 Browser Reset</div>
                                <div style="font-size: 14px; opacity: 0.8;">Browser data cleared, reloading...</div>
                              `
                              setTimeout(() => window.location.reload(), 1000)
                            }
                            
                          } catch (error) {
                            console.error('[SettingsView] Failed to reset app data:', error)
                            
                            // Show error message
                            const errorDiv = document.createElement('div')
                            errorDiv.style.cssText = `
                              position: fixed;
                              top: 50%;
                              left: 50%;
                              transform: translate(-50%, -50%);
                              background: #dc2626;
                              color: white;
                              padding: 20px;
                              border-radius: 8px;
                              z-index: 9999;
                              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                              text-align: center;
                              font-family: system-ui;
                            `
                            errorDiv.innerHTML = `
                              <div style="font-size: 16px; margin-bottom: 10px;">❌ Reset Error</div>
                              <div style="font-size: 14px; opacity: 0.9;">
                                Failed to reset completely. Please restart the app manually.
                              </div>
                              <div style="margin-top: 15px; font-size: 12px; opacity: 0.7;">
                                Error: ${error.message}
                              </div>
                            `
                            document.body.appendChild(errorDiv)
                            
                            // Try to reload anyway after a delay
                            setTimeout(() => window.location.reload(), 3000)
                          }
                        }}
                      >
                        Delete Everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {/* System Objects */}
          <Card id="system-objects-section">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4" />
                  <CardTitle className="text-lg">System Objects</CardTitle>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadSystemObjects}
                  disabled={loadingSystemObjects}
                >
                  {loadingSystemObjects ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-2" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>
              <CardDescription>View cryptographic keys, metadata indexes, and CRDT state</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Keys & Certificates */}
              <div className="border rounded-lg">
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/50"
                  onClick={() => toggleSection('keys')}
                >
                  <div className="flex items-center space-x-2">
                    {expandedSections.keys ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Key className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">Keys & Certificates</span>
                    <Badge variant="secondary">{systemObjects.keys.length}</Badge>
                  </div>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </div>
                {expandedSections.keys && (
                  <div className="border-t">
                    {systemObjects.keys.map((obj) => (
                      <div key={obj.id} className="p-3 border-b last:border-b-0 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Hash className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-sm">{obj.type}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {formatBytes(obj.size)}
                            </Badge>
                            {obj.metadata?.isPrivate !== undefined && (
                              <Badge variant={obj.metadata.isPrivate ? "destructive" : "secondary"} className="text-xs">
                                {obj.metadata.isPrivate ? "Private" : "Public"}
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(obj.hash)}
                              title="Copy fingerprint"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => exportCryptoObject(obj)}
                              title="Export"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center space-x-4">
                            <span>Hash: <code className="bg-muted px-1 rounded">{obj.hash}</code></span>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span>Created: {formatTimeAgo(obj.created)}</span>
                            <span>Modified: {formatTimeAgo(obj.lastModified)}</span>
                          </div>
                          {obj.metadata && (
                            <div className="flex items-center space-x-2 text-xs">
                              <FileText className="h-3 w-3" />
                              {Object.entries(obj.metadata).map(([key, value]) => (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {key}: {String(value)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Metadata & Indexes */}
              <div className="border rounded-lg">
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/50"
                  onClick={() => toggleSection('metadata')}
                >
                  <div className="flex items-center space-x-2">
                    {expandedSections.metadata ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Database className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Metadata & Indexes</span>
                    <Badge variant="secondary">{systemObjects.metadata.length}</Badge>
                  </div>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </div>
                {expandedSections.metadata && (
                  <div className="border-t">
                    {systemObjects.metadata.map((obj) => (
                      <div key={obj.id} className="p-3 border-b last:border-b-0 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Database className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-sm">{obj.type}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {formatBytes(obj.size)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(obj.hash)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center space-x-4">
                            <span>Hash: <code className="bg-muted px-1 rounded">{obj.hash}</code></span>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span>Created: {formatTimeAgo(obj.created)}</span>
                            <span>Modified: {formatTimeAgo(obj.lastModified)}</span>
                          </div>
                          {obj.metadata && (
                            <div className="flex items-center space-x-2 text-xs">
                              <FileText className="h-3 w-3" />
                              {Object.entries(obj.metadata).map(([key, value]) => (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {key}: {String(value)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CRDT State */}
              <div className="border rounded-lg">
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/50"
                  onClick={() => toggleSection('crdt')}
                >
                  <div className="flex items-center space-x-2">
                    {expandedSections.crdt ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Clock className="h-4 w-4 text-green-500" />
                    <span className="font-medium">CRDT State</span>
                    <Badge variant="secondary">{systemObjects.crdt.length}</Badge>
                  </div>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </div>
                {expandedSections.crdt && (
                  <div className="border-t">
                    {systemObjects.crdt.map((obj) => (
                      <div key={obj.id} className="p-3 border-b last:border-b-0 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-sm">{obj.type}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {formatBytes(obj.size)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(obj.hash)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center space-x-4">
                            <span>Hash: <code className="bg-muted px-1 rounded">{obj.hash}</code></span>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span>Created: {formatTimeAgo(obj.created)}</span>
                            <span>Modified: {formatTimeAgo(obj.lastModified)}</span>
                          </div>
                          {obj.metadata && (
                            <div className="flex items-center space-x-2 text-xs">
                              <FileText className="h-3 w-3" />
                              {Object.entries(obj.metadata).map(([key, value]) => (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {key}: {String(value)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {loadingSystemObjects && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
                  <span className="text-sm text-muted-foreground">Loading system objects...</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data & Storage Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <HardDrive className="h-4 w-4" />
                  <CardTitle className="text-lg">Data & Storage</CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadDataStats}
                  disabled={loadingDataStats}
                >
                  {loadingDataStats ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-2" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>
              <CardDescription>Storage usage and data statistics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Data Statistics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Total Objects</Label>
                  <div className="text-xl font-semibold">{dataStats.totalObjects.toLocaleString()}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Total Size</Label>
                  <div className="text-xl font-semibold">{formatBytes(dataStats.totalSize)}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Messages</Label>
                  <div className="text-xl font-semibold">{dataStats.messages.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">In {dataStats.conversations} conversations</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Contacts</Label>
                  <div className="text-xl font-semibold">{dataStats.contacts}</div>
                </div>
              </div>

              <Separator />

              {/* Storage Breakdown */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Storage Distribution</Label>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Messages</span>
                    <span>{formatBytes(dataStats.messagesSize || dataStats.totalSize * 0.3)}</span>
                  </div>
                  <Progress value={30} className="h-1" />

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Media & Files</span>
                    <span>{formatBytes(dataStats.filesSize || dataStats.totalSize * 0.2)}</span>
                  </div>
                  <Progress value={20} className="h-1" />

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">System Objects</span>
                    <span>{formatBytes(dataStats.systemSize || dataStats.totalSize * 0.1)}</span>
                  </div>
                  <Progress value={10} className="h-1" />

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">AI Models</span>
                    <span>{formatBytes(dataStats.modelsSize || dataStats.totalSize * 0.4)}</span>
                  </div>
                  <Progress value={40} className="h-1" />
                </div>
              </div>

              <Separator />

              {/* Storage Strategy */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Storage Strategy</Label>
                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Monitor className="h-3 w-3" />
                      <span className="font-medium">Browser (Current)</span>
                    </div>
                    <p className="text-muted-foreground ml-5">
                      Smart cache - Recent 30 days, LRU eviction, limited storage
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <HardDrive className="h-3 w-3" />
                      <span className="font-medium">Node (Background)</span>
                    </div>
                    <p className="text-muted-foreground ml-5">
                      Full archive - All versions, unlimited capacity
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logout Section */}
          {onLogout && (
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <CardTitle className="text-lg">Account</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={onLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}