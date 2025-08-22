import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ChevronRight,
  ChevronDown,
  FileText,
  User,
  MessageSquare,
  FolderOpen,
  Database,
  Hash,
  Clock,
  HardDrive,
  Package,
  Search,
  ArrowLeft,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react'

interface ObjectInfo {
  type: string
  count: number
  size: number
  percentage: number
  children?: ObjectInfo[]
  details?: {
    hash?: string
    created?: Date
    modified?: Date
    version?: number
  }[]
}

interface ObjectHierarchyViewProps {
  onNavigate?: (tab: string, conversationId?: string, section?: string) => void
  onBack?: () => void
}

export function ObjectHierarchyView({ onNavigate, onBack }: ObjectHierarchyViewProps) {
  const [hierarchy, setHierarchy] = useState<ObjectInfo[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [totalSize, setTotalSize] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string | null>(null)

  useEffect(() => {
    fetchObjectHierarchy()
  }, [])

  const fetchObjectHierarchy = async () => {
    setLoading(true)
    try {
      const lamaBridge = (window as any).lamaBridge
      if (!lamaBridge || !lamaBridge.appModel) {
        console.error('[ObjectHierarchy] No lamaBridge available')
        setHierarchy([])
        return
      }

      // Get total size first
      const storageEstimate = await navigator.storage?.estimate()
      const totalBytes = storageEstimate?.usage || 0
      setTotalSize(totalBytes)

      const hierarchyData: ObjectInfo[] = []
      
      // Messages hierarchy
      const messageData: ObjectInfo = {
        type: 'Messages',
        count: 0,
        size: 0,
        percentage: 0,
        children: []
      }
      
      try {
        // Get all conversations
        const conversations = await lamaBridge.getConversations?.() || []
        const defaultMessages = await lamaBridge.getMessages('default') || []
        
        if (defaultMessages.length > 0) {
          const convSize = estimateObjectSize(defaultMessages)
          messageData.children?.push({
            type: 'Default Conversation',
            count: defaultMessages.length,
            size: convSize,
            percentage: totalBytes > 0 ? (convSize / totalBytes) * 100 : 0
          })
          messageData.count += defaultMessages.length
          messageData.size += convSize
        }
        
        for (const conv of conversations) {
          const messages = await lamaBridge.getMessages(conv.id) || []
          if (messages.length > 0) {
            const convSize = estimateObjectSize(messages)
            messageData.children?.push({
              type: conv.name || conv.id,
              count: messages.length,
              size: convSize,
              percentage: totalBytes > 0 ? (convSize / totalBytes) * 100 : 0
            })
            messageData.count += messages.length
            messageData.size += convSize
          }
        }
      } catch (e) {
        console.error('[ObjectHierarchy] Error fetching messages:', e)
      }
      
      messageData.percentage = totalBytes > 0 ? (messageData.size / totalBytes) * 100 : 0
      if (messageData.count > 0) hierarchyData.push(messageData)
      
      // Contacts hierarchy
      const contactData: ObjectInfo = {
        type: 'Contacts',
        count: 0,
        size: 0,
        percentage: 0,
        children: []
      }
      
      try {
        const contacts = await lamaBridge.appModel?.getContacts?.() || []
        
        // Separate by type
        const me = contacts.filter((c: any) => c.isMe)
        const ai = contacts.filter((c: any) => c.isAI)
        const humans = contacts.filter((c: any) => !c.isMe && !c.isAI)
        
        if (me.length > 0) {
          const meSize = estimateObjectSize(me)
          contactData.children?.push({
            type: 'Me (Identity)',
            count: me.length,
            size: meSize,
            percentage: totalBytes > 0 ? (meSize / totalBytes) * 100 : 0
          })
          contactData.size += meSize
        }
        
        if (ai.length > 0) {
          const aiSize = estimateObjectSize(ai)
          contactData.children?.push({
            type: 'AI Models',
            count: ai.length,
            size: aiSize,
            percentage: totalBytes > 0 ? (aiSize / totalBytes) * 100 : 0
          })
          contactData.size += aiSize
        }
        
        if (humans.length > 0) {
          const humanSize = estimateObjectSize(humans)
          contactData.children?.push({
            type: 'Human Contacts',
            count: humans.length,
            size: humanSize,
            percentage: totalBytes > 0 ? (humanSize / totalBytes) * 100 : 0
          })
          contactData.size += humanSize
        }
        
        contactData.count = contacts.length
      } catch (e) {
        console.error('[ObjectHierarchy] Error fetching contacts:', e)
      }
      
      contactData.percentage = totalBytes > 0 ? (contactData.size / totalBytes) * 100 : 0
      if (contactData.count > 0) hierarchyData.push(contactData)
      
      // ONE.CORE System Objects
      const systemData: ObjectInfo = {
        type: 'System Objects',
        count: 0,
        size: 0,
        percentage: 0,
        children: []
      }
      
      // Estimate system overhead (keys, certificates, metadata)
      const systemOverhead = totalBytes - messageData.size - contactData.size
      if (systemOverhead > 0) {
        systemData.children?.push({
          type: 'Keys & Certificates',
          count: 0, // Unknown count
          size: systemOverhead * 0.3,
          percentage: totalBytes > 0 ? (systemOverhead * 0.3 / totalBytes) * 100 : 0
        })
        
        systemData.children?.push({
          type: 'Metadata & Indexes',
          count: 0,
          size: systemOverhead * 0.4,
          percentage: totalBytes > 0 ? (systemOverhead * 0.4 / totalBytes) * 100 : 0
        })
        
        systemData.children?.push({
          type: 'CRDT State',
          count: 0,
          size: systemOverhead * 0.3,
          percentage: totalBytes > 0 ? (systemOverhead * 0.3 / totalBytes) * 100 : 0
        })
        
        systemData.size = systemOverhead
        systemData.percentage = totalBytes > 0 ? (systemOverhead / totalBytes) * 100 : 0
        hierarchyData.push(systemData)
      }
      
      setHierarchy(hierarchyData)
    } catch (error) {
      console.error('[ObjectHierarchy] Failed to fetch hierarchy:', error)
      setHierarchy([])
    } finally {
      setLoading(false)
    }
  }

  const estimateObjectSize = (obj: any): number => {
    // Rough estimation of object size in bytes
    try {
      const jsonStr = JSON.stringify(obj)
      return new Blob([jsonStr]).size
    } catch {
      return 0
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  const toggleNode = (path: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedNodes(newExpanded)
  }

  const getIcon = (type: string) => {
    if (type.includes('Message')) return <MessageSquare className="h-4 w-4" />
    if (type.includes('Contact') || type.includes('AI') || type.includes('Human') || type.includes('Me')) return <User className="h-4 w-4" />
    if (type.includes('Conversation')) return <FolderOpen className="h-4 w-4" />
    if (type.includes('Key') || type.includes('Certificate')) return <Hash className="h-4 w-4" />
    if (type.includes('Metadata') || type.includes('Index')) return <Database className="h-4 w-4" />
    if (type.includes('CRDT')) return <Clock className="h-4 w-4" />
    if (type.includes('System')) return <Package className="h-4 w-4" />
    return <FileText className="h-4 w-4" />
  }

  const handleNodeClick = (node: ObjectInfo, event: React.MouseEvent) => {
    // Prevent toggling when clicking navigation links
    if ((event.target as HTMLElement).closest('.navigate-link')) {
      return
    }
    
    const path = (event.currentTarget as HTMLElement).dataset.path
    if (path && node.children && node.children.length > 0) {
      toggleNode(path)
    }
  }
  
  const handleNavigate = (node: ObjectInfo) => {
    if (!onNavigate) return
    
    // Navigate based on node type
    if (node.type === 'Messages' || node.type.includes('Message')) {
      onNavigate('chats')
    } else if (node.type.includes('Conversation')) {
      // Extract conversation ID if available
      if (node.type === 'Default Conversation') {
        onNavigate('chats', 'default')
      } else {
        onNavigate('chats')
      }
    } else if (node.type === 'Contacts' || node.type.includes('Contact') || node.type.includes('AI') || node.type.includes('Human')) {
      onNavigate('contacts')
    } else if (node.type === 'Me (Identity)') {
      onNavigate('settings')
    } else if (node.type === 'System Objects' || node.type.includes('Keys') || node.type.includes('Metadata') || node.type.includes('CRDT')) {
      // Navigate to settings and scroll to system objects section
      onNavigate('settings', undefined, 'system-objects')
    }
  }
  
  const isNavigable = (node: ObjectInfo) => {
    return node.type === 'Messages' || 
           node.type === 'Contacts' ||
           node.type.includes('Conversation') ||
           node.type.includes('AI') ||
           node.type.includes('Human') ||
           node.type === 'Me (Identity)' ||
           node.type === 'System Objects' ||
           node.type.includes('Keys') ||
           node.type.includes('Metadata') ||
           node.type.includes('CRDT')
  }

  const filterNodes = (nodes: ObjectInfo[]): ObjectInfo[] => {
    if (!searchQuery && !filterType) return nodes
    
    return nodes.filter(node => {
      const matchesSearch = !searchQuery || 
        node.type.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = !filterType || 
        node.type.includes(filterType)
      
      if (node.children) {
        const filteredChildren = filterNodes(node.children)
        if (filteredChildren.length > 0) return true
      }
      
      return matchesSearch && matchesFilter
    })
  }
  
  const renderNode = (node: ObjectInfo, path: string = '', level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedNodes.has(path)
    const navigable = isNavigable(node)
    
    return (
      <div key={path} className="select-none">
        <div
          className={`flex items-center space-x-2 py-2 px-3 hover:bg-accent rounded-md cursor-pointer ${level > 0 ? 'ml-' + (level * 4) : ''}`}
          onClick={(e) => handleNodeClick(node, e)}
          data-path={path}
          style={{ paddingLeft: `${level * 20 + 12}px` }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <div className="w-4" />
          )}
          
          {getIcon(node.type)}
          
          <span 
            className={`flex-1 font-medium ${navigable ? 'navigate-link text-blue-600 hover:underline' : ''}`}
            onClick={(e) => {
              if (navigable && onNavigate) {
                e.stopPropagation()
                handleNavigate(node)
              }
            }}
          >
            {node.type}
            {navigable && onNavigate && (
              <span className="ml-1 text-xs text-muted-foreground">→</span>
            )}
          </span>
          
          {node.count > 0 && (
            <Badge variant="secondary" className="ml-2">
              {node.count} items
            </Badge>
          )}
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              {formatBytes(node.size)}
            </span>
            <span className="text-xs text-muted-foreground">
              ({node.percentage.toFixed(1)}%)
            </span>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {filterNodes(node.children || []).map((child, index) => 
              renderNode(child, `${path}-${index}`, level + 1)
            )}
          </div>
        )}
      </div>
    )
  }

  const filteredHierarchy = filterNodes(hierarchy)

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold flex items-center space-x-2">
              <HardDrive className="h-6 w-6" />
              <span>Object Storage Hierarchy</span>
            </h2>
            <p className="text-muted-foreground">
              Detailed breakdown of objects stored in your Internet of Me
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchObjectHierarchy}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search objects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Filter buttons */}
            <div className="flex items-center space-x-2">
              <Button
                variant={filterType === 'Messages' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType(filterType === 'Messages' ? null : 'Messages')}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Messages
              </Button>
              <Button
                variant={filterType === 'Contacts' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType(filterType === 'Contacts' ? null : 'Contacts')}
              >
                <User className="h-4 w-4 mr-1" />
                Contacts
              </Button>
              <Button
                variant={filterType === 'System' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType(filterType === 'System' ? null : 'System')}
              >
                <Package className="h-4 w-4 mr-1" />
                System
              </Button>
            </div>
            
            {/* Export button */}
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Storage Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Total Storage Used</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Total</span>
              <span className="text-muted-foreground">{formatBytes(totalSize)}</span>
            </div>
            <Progress value={100} className="h-2" />
            
            {/* Quick stats */}
            <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
              <div>
                <p className="text-muted-foreground">Messages</p>
                <p className="font-medium">
                  {hierarchy.find(h => h.type === 'Messages')?.count || 0}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Contacts</p>
                <p className="font-medium">
                  {hierarchy.find(h => h.type === 'Contacts')?.count || 0}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">System</p>
                <p className="font-medium">
                  {formatBytes(hierarchy.find(h => h.type === 'System Objects')?.size || 0)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Objects</p>
                <p className="font-medium">
                  {hierarchy.reduce((sum, h) => sum + h.count, 0)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Object Hierarchy Tree */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Object Tree</CardTitle>
          <CardDescription>
            Click on categories to navigate to relevant sections • Expand nodes to see details • System objects link to Settings
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 p-0 min-h-0">
          <ScrollArea className="h-full px-4 pb-4">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <span className="text-muted-foreground">Loading object hierarchy...</span>
              </div>
            ) : filteredHierarchy.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <span className="text-muted-foreground">
                  {searchQuery || filterType ? 'No matching objects found' : 'No objects found'}
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredHierarchy.map((node, index) => renderNode(node, `root-${index}`))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-3 w-3" />
              <span>Messages & Conversations</span>
            </div>
            <div className="flex items-center space-x-2">
              <User className="h-3 w-3" />
              <span>Contacts & Identities</span>
            </div>
            <div className="flex items-center space-x-2">
              <Package className="h-3 w-3" />
              <span>System & Metadata (click to view in Settings)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}