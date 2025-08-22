import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { lamaBridge } from '@/bridge/lama-bridge'
import { Brain, Download, CheckCircle, Circle, Cpu, Zap, MessageSquare, Code, Key, AlertTriangle } from 'lucide-react'

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

export function AISettingsView() {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [claudeApiKey, setClaudeApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<'unconfigured' | 'testing' | 'valid' | 'invalid'>('unconfigured')

  useEffect(() => {
    loadModels()
    loadClaudeApiKey()
  }, [])

  const loadModels = async () => {
    try {
      setLoading(true)
      const modelList = await lamaBridge.getAvailableModels()
      setModels(modelList)
    } catch (error) {
      console.error('Failed to load models:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadModel = async (modelId: string) => {
    setLoadingStates(prev => ({ ...prev, [modelId]: true }))
    try {
      const success = await lamaBridge.loadModel(modelId)
      if (success) {
        await loadModels() // Refresh the list
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
        await loadModels() // Refresh the list
      }
    } catch (error) {
      console.error('Failed to set default model:', error)
    }
  }
  
  const loadClaudeApiKey = async () => {
    const storedKey = localStorage.getItem('claude_api_key')
    if (storedKey) {
      setClaudeApiKey(storedKey)
      setApiKeyStatus('valid')
    }
  }
  
  const handleSaveClaudeApiKey = async () => {
    if (!claudeApiKey) {
      setApiKeyStatus('invalid')
      return
    }
    
    setApiKeyStatus('testing')
    try {
      const appModel = lamaBridge.getAppModel()
      if (appModel?.llmManager) {
        const isValid = await appModel.llmManager.testClaudeApiKey(claudeApiKey)
        if (isValid) {
          await appModel.llmManager.setClaudeApiKey(claudeApiKey)
          setApiKeyStatus('valid')
          await loadModels() // Refresh to show Claude models as available
        } else {
          setApiKeyStatus('invalid')
        }
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

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>AI Models</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Brain className="h-5 w-5" />
          <span>AI Models</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage your local and cloud AI models
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Claude API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center space-x-2">
              <Key className="h-4 w-4" />
              <span>Claude API Configuration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="claude-api-key">API Key</Label>
              <div className="flex space-x-2">
                <Input
                  id="claude-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={claudeApiKey}
                  onChange={(e) => setClaudeApiKey(e.target.value)}
                  placeholder="sk-ant-api..."
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? "Hide" : "Show"}
                </Button>
                <Button
                  onClick={handleSaveClaudeApiKey}
                  disabled={!claudeApiKey || apiKeyStatus === 'testing'}
                >
                  {apiKeyStatus === 'testing' ? "Testing..." : "Save"}
                </Button>
              </div>
              {apiKeyStatus === 'valid' && (
                <Alert className="bg-green-500/10">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-500">
                    API key is valid and Claude models are available
                  </AlertDescription>
                </Alert>
              )}
              {apiKeyStatus === 'invalid' && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Invalid API key. Please check and try again.
                  </AlertDescription>
                </Alert>
              )}
              <p className="text-xs text-muted-foreground">
                Get your API key from <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="underline">console.anthropic.com</a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Models List */}
        {models.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No AI models configured</p>
            <p className="text-sm">Models will be added automatically on first use</p>
          </div>
        ) : (
          <div className="space-y-4">
            {models.map((model) => (
              <div key={model.id} className="border rounded-lg p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      {getProviderIcon(model.provider)}
                      <h3 className="font-semibold">{model.name}</h3>
                      {model.isDefault && (
                        <Badge variant="default" className="text-xs">Default</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {model.description}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {model.isLoaded ? (
                      <Badge variant="secondary" className="flex items-center space-x-1">
                        <CheckCircle className="h-3 w-3" />
                        <span>Loaded</span>
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadModel(model.id)}
                        disabled={loadingStates[model.id]}
                        className="flex items-center space-x-1"
                      >
                        <Download className="h-3 w-3" />
                        <span>{loadingStates[model.id] ? 'Loading...' : 'Load'}</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Provider:</span>
                    <span className="ml-2 capitalize">{model.provider}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <span className="ml-2 capitalize">{model.modelType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Size:</span>
                    <span className="ml-2">{formatSize(model.size)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Context:</span>
                    <span className="ml-2">{model.contextLength.toLocaleString()} tokens</span>
                  </div>
                </div>

                {/* Capabilities */}
                <div>
                  <span className="text-sm text-muted-foreground">Capabilities:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {model.capabilities.map((capability) => (
                      <Badge key={capability} variant="outline" className="text-xs flex items-center space-x-1">
                        {getCapabilityIcon(capability)}
                        <span className="capitalize">{capability}</span>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center space-x-2">
                    {!model.isDefault ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetDefault(model.id)}
                        className="text-xs"
                      >
                        Set as Default
                      </Button>
                    ) : (
                      <Badge variant="default" className="text-xs">
                        Default Model
                      </Badge>
                    )}
                  </div>
                  {model.isLoaded && (
                    <Badge variant="secondary" className="text-xs">
                      Ready for use
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Quick Actions</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => lamaBridge.getBestModelForTask('coding').then(console.log)}
              className="flex items-center space-x-2"
            >
              <Code className="h-4 w-4" />
              <span>Best for Coding</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => lamaBridge.getBestModelForTask('reasoning').then(console.log)}
              className="flex items-center space-x-2"
            >
              <Brain className="h-4 w-4" />
              <span>Best for Reasoning</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}