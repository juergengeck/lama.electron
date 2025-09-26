import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Download, Cpu, Zap, Check, Loader2, Server, AlertTriangle } from 'lucide-react'
import { lamaBridge } from '@/bridge/lama-bridge'
import { isOllamaRunning, getLocalOllamaModels, parseOllamaModel, type OllamaModelInfo } from '@/services/ollama'
import { DownloadManager, checkModelExists, formatBytes, formatTime, type DownloadProgress } from '@/services/huggingface'

interface ModelOption {
  id: string
  name: string
  size: string
  description: string
  requiresDownload: boolean
  apiKey?: boolean
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'openai-gpt-oss-20b',
    name: 'OpenAI GPT-OSS (20B)',
    size: '~16 GB',
    description: 'OpenAI\'s 21B model with MXFP4 quantization. Runs in 16GB RAM.',
    requiresDownload: true
  },
  {
    id: 'qwen2.5-coder-32b',
    name: 'Qwen2.5 Coder (32B)',
    size: '~20 GB',
    description: 'Top-tier code generation. Specialized for programming tasks.',
    requiresDownload: true
  },
  {
    id: 'llama-3.1-8b',
    name: 'Llama 3.1 (8B)',
    size: '4.7 GB',
    description: 'Meta\'s efficient model. Good for everyday use.',
    requiresDownload: true
  }
]

export function ModelOnboarding({ onComplete }: { onComplete: () => void }) {
  const handleComplete = useCallback(() => {
    // Use setTimeout to ensure this happens after the current render cycle
    setTimeout(() => {
      onComplete()
    }, 0)
  }, [onComplete])
  // NO AppModel in browser - everything via IPC
  // All operations via IPC - no AppModel in browser
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  const [selectedModel, setSelectedModel] = useState<string | null>(null) // Keep for backward compatibility
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadStatus, setDownloadStatus] = useState<DownloadProgress | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [ollamaAvailable, setOllamaAvailable] = useState(false)
  const [ollamaModels, setOllamaModels] = useState<OllamaModelInfo[]>([])
  const [showOllamaConsent, setShowOllamaConsent] = useState(false)
  const [loadingOllama, setLoadingOllama] = useState(true)
  const [modelLoadProgress, setModelLoadProgress] = useState<Map<string, number>>(new Map())
  const [loadingModels, setLoadingModels] = useState<Set<string>>(new Set())

  useEffect(() => {
    checkOllamaAvailability()
  }, [])
  
  const checkOllamaAvailability = async () => {
    setLoadingOllama(true)
    try {
      const running = await isOllamaRunning()
      console.log('[ModelOnboarding] Ollama running:', running)
      if (running) {
        const models = await getLocalOllamaModels()
        console.log('[ModelOnboarding] Raw Ollama models:', models)
        const parsedModels = models.map(parseOllamaModel)
        console.log('[ModelOnboarding] Parsed models:', parsedModels)
        setOllamaModels(parsedModels)
        setOllamaAvailable(true)
        console.log(`[ModelOnboarding] Found ${parsedModels.length} Ollama models:`, parsedModels.map(m => m.name))
      }
    } catch (error) {
      console.error('[ModelOnboarding] Failed to check Ollama:', error)
    } finally {
      setLoadingOllama(false)
    }
  }

  const toggleModelSelection = (modelId: string) => {
    const newSelection = new Set(selectedModels)
    if (newSelection.has(modelId)) {
      newSelection.delete(modelId)
    } else {
      newSelection.add(modelId)
    }
    setSelectedModels(newSelection)
  }

  const handleLoadSelectedModels = async () => {
    console.log('[ModelOnboarding] 🚀 handleLoadSelectedModels called, selected models:', selectedModels.size)
    if (selectedModels.size === 0) return

    const modelIds = Array.from(selectedModels)
    console.log('[ModelOnboarding] 🚀 Model IDs to load:', modelIds)

    // Load all selected Ollama models
    for (let i = 0; i < modelIds.length; i++) {
      const modelId = modelIds[i]
      console.log(`[ModelOnboarding] 🚀 Processing model ${i+1}/${modelIds.length}: ${modelId}`)
      const ollamaModel = ollamaModels.find(m => m.id === modelId)
      if (ollamaModel) {
        // Only complete on the last model
        const isLastModel = i === modelIds.length - 1
        console.log(`[ModelOnboarding] 🚀 Calling handleModelReady for ${modelId}, isLast: ${isLastModel}`)
        console.log(`[ModelOnboarding] 🚀 Ollama model details:`, ollamaModel)
        await handleModelReady(modelId, ollamaModel, isLastModel)
      } else {
        console.log(`[ModelOnboarding] ❌ No Ollama model found for ID: ${modelId}`)
      }
    }
  }

  const handleModelSelect = async (modelId: string) => {
    console.log('[ModelOnboarding] ⭐ handleModelSelect called with:', modelId)

    // Check if it's an Ollama model
    if (modelId.startsWith('ollama:')) {
      console.log('[ModelOnboarding] Ollama model detected:', modelId)
      setSelectedModel(modelId)
      setShowOllamaConsent(true)
      return
    }

    const model = MODEL_OPTIONS.find(m => m.id === modelId)
    if (!model) {
      console.log('[ModelOnboarding] ❌ Model not found in OPTIONS:', modelId)
      return
    }

    console.log('[ModelOnboarding] Found model:', model.name, 'requiresDownload:', model.requiresDownload)
    setSelectedModel(modelId)

    if (model.requiresDownload) {
      console.log('[ModelOnboarding] Model requires download, checking if it exists locally...')
      // Check if model weights already exist locally
      const exists = await checkModelExists(modelId)
      console.log('[ModelOnboarding] Model exists locally?', exists)

      if (exists) {
        console.log(`[ModelOnboarding] ${model.name} already downloaded, loading...`)
        handleModelReady(modelId)
        return
      }

      // Start real download from HuggingFace
      console.log('[ModelOnboarding] Starting download from HuggingFace...')
      setIsDownloading(true)
      setDownloadError(null)
      setDownloadStatus(null)
      
      try {
        await DownloadManager.startDownload(modelId, (progress: DownloadProgress) => {
          setDownloadProgress(progress.percentage)
          setDownloadStatus(progress)
          
          // Log detailed progress
          const speedMBps = (progress.speed / 1024 / 1024).toFixed(1)
          const eta = formatTime(progress.eta)
          console.log(`[ModelOnboarding] ${model.name}: ${progress.percentage.toFixed(1)}% - ${speedMBps} MB/s - ETA: ${eta}`)
        })
        
        console.log(`[ModelOnboarding] Successfully downloaded ${model.name}`)
        handleDownloadComplete(modelId)
      } catch (error) {
        console.error(`[ModelOnboarding] Download failed for ${model.name}:`, error)
        setDownloadError(error instanceof Error ? error.message : 'Download failed')
        setIsDownloading(false)
        setDownloadProgress(0)
        setDownloadStatus(null)
      }
    } else if (model.apiKey) {
      // For API models, we'd show an API key input
      // For now, just complete
      handleModelReady(modelId)
    }
  }
  
  // Remove the local checkModelExists - we're using the one from huggingface service

  const handleDownloadComplete = async (modelId: string) => {
    setIsDownloading(false)
    await handleModelReady(modelId)
  }

  const handleOllamaConsent = async (accepted: boolean) => {
    setShowOllamaConsent(false)
    
    if (!accepted || !selectedModel) {
      setSelectedModel(null)
      return
    }
    
    // Load the Ollama model
    const ollamaModel = ollamaModels.find(m => m.id === selectedModel)
    if (ollamaModel) {
      await handleModelReady(selectedModel, ollamaModel)
    }
  }

  const handleModelReady = async (modelId: string, ollamaModel?: OllamaModelInfo, shouldComplete: boolean = true) => {
    // Model configuration handled by Node.js via IPC
    console.log('[ModelOnboarding] 🎯 handleModelReady called')
    console.log('[ModelOnboarding] 🎯 Model ID:', modelId)
    console.log('[ModelOnboarding] 🎯 Ollama model:', ollamaModel?.displayName || 'none')
    console.log('[ModelOnboarding] 🎯 Should complete:', shouldComplete)

    // Track loading progress
    setLoadingModels(prev => new Set(prev).add(modelId))
    setModelLoadProgress(prev => new Map(prev).set(modelId, 0))

    // Simulate progress for UI
    setModelLoadProgress(prev => new Map(prev).set(modelId, 50))

    let modelSetSuccessfully = false
    try {
      // Save the selected model as default via IPC
      console.log(`[ModelOnboarding] 🎯 Calling lamaBridge.setDefaultModel(${modelId})`)
      const success = await lamaBridge.setDefaultModel(modelId)
      console.log(`[ModelOnboarding] 🎯 lamaBridge.setDefaultModel returned:`, success)

      if (success) {
        console.log(`[ModelOnboarding] ✅ Successfully set ${modelId} as default model`)
        console.log(`[ModelOnboarding] ✅ AI contact created, chats will be created when accessed`)
        modelSetSuccessfully = true
      } else {
        console.warn(`[ModelOnboarding] ⚠️ Failed to set ${modelId} as default model`)
      }
    } catch (error) {
      console.error('[ModelOnboarding] ❌ Error setting default model:', error)
    }

    // Complete loading
    setModelLoadProgress(prev => new Map(prev).set(modelId, 100))

    // Wait for loading animation to complete before calling handleComplete
    setTimeout(() => {
      setLoadingModels(prev => {
        const next = new Set(prev)
        next.delete(modelId)

        // If this was the last loading model and we should complete, do so after animation
        // Only complete if the model was set successfully
        if (next.size === 0 && shouldComplete && modelSetSuccessfully) {
          // Complete after a short delay for animation
          setTimeout(() => {
            handleComplete()
          }, 500) // Short delay for animation to complete
        }

        return next
      })
      setModelLoadProgress(prev => {
        const next = new Map(prev)
        next.delete(modelId)
        return next
      })
    }, 1500) // Increased from 1000ms to give more time for the loading animation
  }

  const skipSetup = () => {
    // Allow user to skip model selection and proceed without LLM
    handleComplete()
  }

  return (
    <div className="min-h-screen bg-background p-8 overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Welcome to LAMA</h1>
          <p className="text-xl text-muted-foreground">
            Let's set up your AI assistant. Choose a model to get started.
          </p>
        </div>

        {showOllamaConsent ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span>Use Ollama Model?</span>
              </CardTitle>
              <CardDescription>
                You're about to use a locally running Ollama model
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm">By using Ollama models, you acknowledge:</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>The model runs on your local machine via Ollama service</li>
                  <li>Performance depends on your hardware capabilities</li>
                  <li>No data is sent to external servers</li>
                  <li>Model responses are generated locally</li>
                </ul>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => handleOllamaConsent(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleOllamaConsent(true)}
                >
                  Accept and Use Model
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : !isDownloading ? (
          <>
            {/* Ollama Models Section */}
            {ollamaAvailable && ollamaModels.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Server className="h-5 w-5 text-green-500" />
                  <h2 className="text-xl font-semibold">Available Ollama Models</h2>
                  <span className="text-sm text-muted-foreground">
                    ({ollamaModels.length} models detected)
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {ollamaModels.map((model) => (
                    <Card 
                      key={model.id}
                      className={`transition-all hover:shadow-lg ${
                        selectedModels.has(model.id) ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedModels.has(model.id)}
                              onCheckedChange={() => toggleModelSelection(model.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-base">{model.displayName}</span>
                          </div>
                          <Check className="h-5 w-5 text-green-500" />
                        </CardTitle>
                        <CardDescription>
                          {model.size} • {model.parameterSize} • Local
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {model.description}
                        </p>
                        
                        {/* Loading progress */}
                        {loadingModels.has(model.id) && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span>Loading model...</span>
                              <span>{modelLoadProgress.get(model.id) || 0}%</span>
                            </div>
                            <Progress value={modelLoadProgress.get(model.id) || 0} className="h-2" />
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-1 mt-2">
                          {model.capabilities.includes('code') && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              Code
                            </span>
                          )}
                          {loadingModels.has(model.id) ? (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Loading
                            </span>
                          ) : (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                              Ready
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            
            {/* Download Models Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                {ollamaAvailable ? 'Or Download Additional Models' : 'Download Models'}
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
            {MODEL_OPTIONS.map((model) => (
              <Card 
                key={model.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedModel === model.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => handleModelSelect(model.id)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{model.name}</span>
                    {model.requiresDownload ? (
                      <Download className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Zap className="h-5 w-5 text-yellow-500" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    {model.size} • {model.requiresDownload ? 'Local' : 'Cloud'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {model.description}
                  </p>
                  {model.apiKey && (
                    <p className="text-xs text-yellow-600 mt-2">
                      Requires API key
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
              </div>
            </div>
          </>
        ) : (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Downloading Model</span>
              </CardTitle>
              <CardDescription>
                {downloadError ? 'Download failed - please try again' : 'Downloading from HuggingFace...'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {downloadError ? (
                <div className="text-red-500 text-sm p-4 bg-red-50 rounded-lg">
                  <strong>Error:</strong> {downloadError}
                </div>
              ) : (
                <>
                  <Progress value={downloadProgress} className="w-full" />
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>{downloadProgress.toFixed(1)}% complete</span>
                      {downloadStatus && (
                        <span>{formatBytes(downloadStatus.downloaded)} / {formatBytes(downloadStatus.total)}</span>
                      )}
                    </div>
                    {downloadStatus && (
                      <div className="flex justify-between">
                        <span>Speed: {formatBytes(downloadStatus.speed)}/s</span>
                        <span>ETA: {formatTime(downloadStatus.eta)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
              {downloadError && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDownloading(false)
                      setDownloadError(null)
                      setDownloadProgress(0)
                      setSelectedModel(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => selectedModel && handleModelSelect(selectedModel)}
                  >
                    Retry Download
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center gap-4 mt-8">
          {selectedModels.size > 0 && (
            <Button
              onClick={handleLoadSelectedModels}
              disabled={isDownloading || loadingModels.size > 0}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loadingModels.size > 0 ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading {loadingModels.size} Model{loadingModels.size > 1 ? 's' : ''}...
                </>
              ) : (
                `Load ${selectedModels.size} Selected Model${selectedModels.size > 1 ? 's' : ''}`
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={skipSetup}
            disabled={isDownloading}
          >
            Skip for now (add models later)
          </Button>
        </div>
      </div>
    </div>
  )
}