import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
  Package
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

interface ObjectHierarchyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totalSize: number
  onNavigate?: (tab: string, conversationId?: string) => void
}

export function ObjectHierarchyDialog({ open, onOpenChange, totalSize, onNavigate }: ObjectHierarchyDialogProps) {
  const [hierarchy, setHierarchy] = useState<ObjectInfo[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open) {
      fetchObjectHierarchy()
    }
  }, [open])

  const fetchObjectHierarchy = async () => {
    setLoading(true)
    try {
      const lamaBridge = (window as any).lamaBridge
      if (!lamaBridge || !lamaBridge.appModel) {
        console.error('[ObjectHierarchy] No lamaBridge available')
        setHierarchy([])
        return
      }

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
            percentage: totalSize > 0 ? (convSize / totalSize) * 100 : 0
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
              percentage: totalSize > 0 ? (convSize / totalSize) * 100 : 0
            })
            messageData.count += messages.length
            messageData.size += convSize
          }
        }
      } catch (e) {
        console.error('[ObjectHierarchy] Error fetching messages:', e)
      }
      
      messageData.percentage = totalSize > 0 ? (messageData.size / totalSize) * 100 : 0
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
            percentage: totalSize > 0 ? (meSize / totalSize) * 100 : 0
          })
          contactData.size += meSize
        }
        
        if (ai.length > 0) {
          const aiSize = estimateObjectSize(ai)
          contactData.children?.push({
            type: 'AI Models',
            count: ai.length,
            size: aiSize,
            percentage: totalSize > 0 ? (aiSize / totalSize) * 100 : 0
          })
          contactData.size += aiSize
        }
        
        if (humans.length > 0) {
          const humanSize = estimateObjectSize(humans)
          contactData.children?.push({
            type: 'Human Contacts',
            count: humans.length,
            size: humanSize,
            percentage: totalSize > 0 ? (humanSize / totalSize) * 100 : 0
          })
          contactData.size += humanSize
        }
        
        contactData.count = contacts.length
      } catch (e) {
        console.error('[ObjectHierarchy] Error fetching contacts:', e)
      }
      
      contactData.percentage = totalSize > 0 ? (contactData.size / totalSize) * 100 : 0
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
      const systemOverhead = totalSize - messageData.size - contactData.size
      if (systemOverhead > 0) {
        systemData.children?.push({
          type: 'Keys & Certificates',
          count: 0, // Unknown count
          size: systemOverhead * 0.3,
          percentage: totalSize > 0 ? (systemOverhead * 0.3 / totalSize) * 100 : 0
        })
        
        systemData.children?.push({
          type: 'Metadata & Indexes',
          count: 0,
          size: systemOverhead * 0.4,
          percentage: totalSize > 0 ? (systemOverhead * 0.4 / totalSize) * 100 : 0
        })
        
        systemData.children?.push({
          type: 'CRDT State',
          count: 0,
          size: systemOverhead * 0.3,
          percentage: totalSize > 0 ? (systemOverhead * 0.3 / totalSize) * 100 : 0
        })
        
        systemData.size = systemOverhead
        systemData.percentage = totalSize > 0 ? (systemOverhead / totalSize) * 100 : 0
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
      onOpenChange(false)
    } else if (node.type.includes('Conversation')) {
      // Extract conversation ID if available
      if (node.type === 'Default Conversation') {
        onNavigate('chats', 'default')
      } else {
        onNavigate('chats')
      }
      onOpenChange(false)
    } else if (node.type === 'Contacts' || node.type.includes('Contact') || node.type.includes('AI') || node.type.includes('Human')) {
      onNavigate('contacts')
      onOpenChange(false)
    } else if (node.type === 'Me (Identity)') {
      onNavigate('settings')
      onOpenChange(false)
    }
  }
  
  const isNavigable = (node: ObjectInfo) => {
    return node.type === 'Messages' || 
           node.type === 'Contacts' ||
           node.type.includes('Conversation') ||
           node.type.includes('AI') ||
           node.type.includes('Human') ||
           node.type === 'Me (Identity)'
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
            {node.children?.map((child, index) => 
              renderNode(child, `${path}-${index}`, level + 1)
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <HardDrive className="h-5 w-5" />
            <span>Object Storage Hierarchy</span>
          </DialogTitle>
          <DialogDescription>
            Detailed breakdown of objects stored in your Internet of Me
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Total Storage Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Total Storage Used</span>
              <span className="text-muted-foreground">{formatBytes(totalSize)}</span>
            </div>
            <Progress value={100} className="h-2" />
          </div>
          
          {/* Object Hierarchy */}
          <ScrollArea className="h-[400px] border rounded-md p-4">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <span className="text-muted-foreground">Loading object hierarchy...</span>
              </div>
            ) : hierarchy.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <span className="text-muted-foreground">No objects found</span>
              </div>
            ) : (
              <div className="space-y-1">
                {hierarchy.map((node, index) => renderNode(node, `root-${index}`))}
              </div>
            )}
          </ScrollArea>
          
          {/* Storage Breakdown Legend */}
          <div className="border-t pt-4">
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
                <span>System & Metadata</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}