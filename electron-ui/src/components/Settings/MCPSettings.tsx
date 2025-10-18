import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Package, Plus, Trash2, RefreshCw, CheckCircle, Circle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface MCPServer {
  name: string
  command: string
  args: string[]
  description: string
  enabled: boolean
  createdAt?: number
  updatedAt?: number
}

export function MCPSettings() {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null)
  const [form, setForm] = useState<Partial<MCPServer>>({
    name: '',
    command: '',
    args: [],
    description: '',
    enabled: true
  })
  const [argsInput, setArgsInput] = useState('')
  const [directoryPath, setDirectoryPath] = useState('')

  useEffect(() => {
    loadServers()
  }, [])

  const loadServers = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI?.invoke('mcp:listServers')
      if (result?.success && result.servers) {
        setServers(result.servers)
      }
    } catch (error) {
      console.error('Failed to load MCP servers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingServer(null)
    // Pre-fill with filesystem server defaults
    setForm({
      name: '',
      command: 'npx',
      args: [],
      description: 'File system operations',
      enabled: true
    })
    setArgsInput('-y @modelcontextprotocol/server-filesystem')
    setDirectoryPath('')
    setShowDialog(true)
  }

  const handleEdit = (server: MCPServer) => {
    setEditingServer(server)
    setForm(server)

    // Extract directory path if this is a filesystem server
    const fullArgs = server.args.join(' ')
    const fsPackage = '@modelcontextprotocol/server-filesystem'
    if (fullArgs.includes(fsPackage)) {
      // Extract everything up to and including the package name
      const packageIndex = fullArgs.indexOf(fsPackage)
      const packageEnd = packageIndex + fsPackage.length
      const beforePath = fullArgs.substring(0, packageEnd).trim()
      const afterPath = fullArgs.substring(packageEnd).trim()

      setArgsInput(beforePath)
      setDirectoryPath(afterPath)
    } else {
      setArgsInput(fullArgs)
      setDirectoryPath('')
    }

    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.command || !directoryPath.trim()) {
      return
    }

    // Combine args and directory path
    const fullArgs = `${argsInput} ${directoryPath}`.trim()

    const serverConfig = {
      ...form,
      args: fullArgs.split(' ').filter(arg => arg.trim())
    }

    try {
      if (editingServer) {
        await window.electronAPI?.invoke('mcp:updateServer', {
          name: editingServer.name,
          config: serverConfig
        })
      } else {
        await window.electronAPI?.invoke('mcp:addServer', { config: serverConfig })
      }

      await loadServers()
      setShowDialog(false)
    } catch (error) {
      console.error('Failed to save MCP server:', error)
    }
  }

  const handleDelete = async (name: string) => {
    try {
      await window.electronAPI?.invoke('mcp:removeServer', { name })
      await loadServers()
    } catch (error) {
      console.error('Failed to delete MCP server:', error)
    }
  }

  const handleToggle = async (server: MCPServer) => {
    try {
      await window.electronAPI?.invoke('mcp:updateServer', {
        name: server.name,
        config: { ...server, enabled: !server.enabled }
      })
      await loadServers()
    } catch (error) {
      console.error('Failed to toggle MCP server:', error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <CardTitle className="text-lg">MCP Servers</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadServers}
              disabled={loading}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-2" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-2" />
              )}
              Refresh
            </Button>
            <Button size="sm" onClick={handleAdd}>
              <Plus className="h-3 w-3 mr-2" />
              Add Server
            </Button>
          </div>
        </div>
        <CardDescription>
          Manage Model Context Protocol servers for AI tool integration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          MCP (Model Context Protocol) servers provide tools and resources that AI models can use during conversations.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No MCP servers configured</p>
            <p className="text-xs mt-1">Click "Add Server" to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {servers.map((server) => (
              <div key={server.name} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {server.enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{server.name}</span>
                    <Badge variant={server.enabled ? 'default' : 'outline'} className="text-xs">
                      {server.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(server)}
                    >
                      {server.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(server)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(server.name)}
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    <span className="font-medium">Command:</span> <code className="bg-muted px-1 rounded">{server.command}</code>
                  </div>
                  {server.args.length > 0 && (
                    <div>
                      <span className="font-medium">Args:</span> <code className="bg-muted px-1 rounded">{server.args.join(' ')}</code>
                    </div>
                  )}
                  {server.description && (
                    <div>
                      <span className="font-medium">Description:</span> {server.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingServer ? 'Edit MCP Server' : 'Add MCP Server'}</DialogTitle>
              <DialogDescription>
                Configure an MCP server to provide tools for AI models
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Server Name</Label>
                <Input
                  id="name"
                  value={form.name || ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="filesystem-docs"
                  disabled={!!editingServer}
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier (e.g., filesystem-home, filesystem-docs)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="path">Directory Path</Label>
                <Input
                  id="path"
                  value={directoryPath}
                  onChange={(e) => setDirectoryPath(e.target.value)}
                  placeholder="/Users/yourname/Documents"
                />
                <p className="text-xs text-muted-foreground">
                  Full path to the directory the AI can access
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="File system operations"
                />
              </div>

              {/* Advanced options - collapsed by default */}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Advanced options
                </summary>
                <div className="space-y-3 mt-3 pl-2 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label htmlFor="command" className="text-xs">Command</Label>
                    <Input
                      id="command"
                      value={form.command || ''}
                      onChange={(e) => setForm({ ...form, command: e.target.value })}
                      placeholder="npx"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="args" className="text-xs">Arguments</Label>
                    <Input
                      id="args"
                      value={argsInput}
                      onChange={(e) => setArgsInput(e.target.value)}
                      placeholder="-y @modelcontextprotocol/server-filesystem"
                      className="text-xs"
                    />
                  </div>
                </div>
              </details>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!form.name || !form.command || !directoryPath.trim()}>
                {editingServer ? 'Update' : 'Add'} Server
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
