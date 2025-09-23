import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Zap, Check, Loader2, Server, AlertTriangle } from 'lucide-react';
import { lamaBridge } from '@/bridge/lama-bridge';
import { isOllamaRunning, getLocalOllamaModels, parseOllamaModel } from '@/services/ollama';
import { DownloadManager, checkModelExists, formatBytes, formatTime } from '@/services/huggingface';
const MODEL_OPTIONS = [
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
];
export function ModelOnboarding({ onComplete }) {
    const handleComplete = useCallback(() => {
        // Use setTimeout to ensure this happens after the current render cycle
        setTimeout(() => {
            onComplete();
        }, 0);
    }, [onComplete]);
    // NO AppModel in browser - everything via IPC
    const appModel = null;
    const [selectedModels, setSelectedModels] = useState(new Set());
    const [selectedModel, setSelectedModel] = useState(null); // Keep for backward compatibility
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadStatus, setDownloadStatus] = useState(null);
    const [downloadError, setDownloadError] = useState(null);
    const [apiKey, setApiKey] = useState('');
    const [ollamaAvailable, setOllamaAvailable] = useState(false);
    const [ollamaModels, setOllamaModels] = useState([]);
    const [showOllamaConsent, setShowOllamaConsent] = useState(false);
    const [loadingOllama, setLoadingOllama] = useState(true);
    const [modelLoadProgress, setModelLoadProgress] = useState(new Map());
    const [loadingModels, setLoadingModels] = useState(new Set());
    useEffect(() => {
        checkOllamaAvailability();
    }, []);
    const checkOllamaAvailability = async () => {
        setLoadingOllama(true);
        try {
            const running = await isOllamaRunning();
            
            if (running) {
                const models = await getLocalOllamaModels();
                const parsedModels = models.map(parseOllamaModel);
                setOllamaModels(parsedModels);
                setOllamaAvailable(true);
                
                if (parsedModels.length > 0) {
                    console.log(`[ModelOnboarding] Found ${parsedModels.length} Ollama models available`);
                } else {
                    console.log('[ModelOnboarding] Ollama is running but no models are installed');
                }
            } else {
                // Ollama not running - this is normal, not an error
                setOllamaAvailable(false);
                setOllamaModels([]);
            }
        }
        catch (error) {
            // Only log unexpected errors
            console.error('[ModelOnboarding] Unexpected error checking Ollama:', error);
            setOllamaAvailable(false);
            setOllamaModels([]);
        }
        finally {
            setLoadingOllama(false);
        }
    };
    const toggleModelSelection = (modelId) => {
        // Only allow single selection for initial setup
        const newSelection = new Set();
        if (!selectedModels.has(modelId)) {
            // Clear previous selections and add only this one
            newSelection.add(modelId);
        }
        // If already selected, clicking again deselects it
        setSelectedModels(newSelection);
    };
    const handleLoadSelectedModels = async () => {
        if (selectedModels.size === 0)
            return;
        // Only allow loading one model for initial setup
        const modelId = Array.from(selectedModels)[0];
        const ollamaModel = ollamaModels.find(m => m.id === modelId);
        if (ollamaModel) {
            await handleModelReady(modelId, ollamaModel, true);
        }
    };
    const handleModelSelect = async (modelId) => {
        // Check if it's an Ollama model
        if (modelId.startsWith('ollama:')) {
            setSelectedModel(modelId);
            setShowOllamaConsent(true);
            return;
        }
        const model = MODEL_OPTIONS.find(m => m.id === modelId);
        if (!model)
            return;
        setSelectedModel(modelId);
        if (model.requiresDownload) {
            // Check if model weights already exist locally
            if (await checkModelExists(modelId)) {
                console.log(`[ModelOnboarding] ${model.name} already downloaded, loading...`);
                handleModelReady(modelId);
                return;
            }
            // Start real download from HuggingFace
            setIsDownloading(true);
            setDownloadError(null);
            setDownloadStatus(null);
            try {
                await DownloadManager.startDownload(modelId, (progress) => {
                    setDownloadProgress(progress.percentage);
                    setDownloadStatus(progress);
                    // Log detailed progress
                    const speedMBps = (progress.speed / 1024 / 1024).toFixed(1);
                    const eta = formatTime(progress.eta);
                    console.log(`[ModelOnboarding] ${model.name}: ${progress.percentage.toFixed(1)}% - ${speedMBps} MB/s - ETA: ${eta}`);
                });
                console.log(`[ModelOnboarding] Successfully downloaded ${model.name}`);
                handleDownloadComplete(modelId);
            }
            catch (error) {
                console.error(`[ModelOnboarding] Download failed for ${model.name}:`, error);
                setDownloadError(error instanceof Error ? error.message : 'Download failed');
                setIsDownloading(false);
                setDownloadProgress(0);
                setDownloadStatus(null);
            }
        }
        else if (model.apiKey) {
            // For API models, we'd show an API key input
            // For now, just complete
            handleModelReady(modelId);
        }
    };
    // Remove the local checkModelExists - we're using the one from huggingface service
    const handleDownloadComplete = async (modelId) => {
        setIsDownloading(false);
        await handleModelReady(modelId);
    };
    const handleOllamaConsent = async (accepted) => {
        setShowOllamaConsent(false);
        if (!accepted || !selectedModel) {
            setSelectedModel(null);
            return;
        }
        // Load the Ollama model
        const ollamaModel = ollamaModels.find(m => m.id === selectedModel);
        if (ollamaModel) {
            await handleModelReady(selectedModel, ollamaModel);
        }
    };
    const handleModelReady = async (modelId, ollamaModel, shouldComplete = true) => {
        // Add the model to LLMManager
        if (appModel?.llmManager) {
            let modelConfig;
            if (ollamaModel) {
                // Ollama model configuration
                modelConfig = {
                    id: modelId,
                    name: ollamaModel.displayName,
                    provider: 'ollama',
                    modelType: ollamaModel.capabilities.includes('code') ? 'code' : 'chat',
                    capabilities: ollamaModel.capabilities,
                    contextLength: ollamaModel.contextLength,
                    parameters: {
                        modelName: ollamaModel.name,
                        endpoint: 'http://localhost:11434',
                        temperature: 0.7,
                        maxTokens: 2048
                    },
                    $type$: 'LLM',
                    $v$: 1
                };
            }
            else {
                // Regular model configuration
                const config = MODEL_OPTIONS.find(m => m.id === modelId);
                if (!config)
                    return;
                modelConfig = {
                    id: modelId,
                    name: config.name,
                    provider: 'local',
                    modelType: modelId.includes('coder') ? 'code' : 'chat',
                    capabilities: modelId.includes('coder')
                        ? ['chat', 'completion', 'code', 'code-completion']
                        : ['chat', 'completion'],
                    contextLength: 8192,
                    parameters: {
                        modelPath: `/models/${modelId}`,
                        temperature: 0.7,
                        maxTokens: 2048
                    },
                    $type$: 'LLM',
                    $v$: 1
                };
            }
            // Track loading progress
            setLoadingModels(prev => new Set(prev).add(modelId));
            setModelLoadProgress(prev => new Map(prev).set(modelId, 0));
            await appModel.llmManager.addModel(modelConfig);
            // Set as default and load the model with progress tracking
            setModelLoadProgress(prev => new Map(prev).set(modelId, 50));
            await appModel.llmManager.setDefaultModel(modelId);
            // Complete loading
            setModelLoadProgress(prev => new Map(prev).set(modelId, 100));
            // Wait for loading animation to complete before calling handleComplete
            setTimeout(() => {
                setLoadingModels(prev => {
                    const next = new Set(prev);
                    next.delete(modelId);
                    // If this was the last loading model and we should complete, do so after animation
                    if (next.size === 0 && shouldComplete) {
                        setTimeout(() => {
                            handleComplete();
                        }, 500); // Give a bit more time for the UI to update
                    }
                    return next;
                });
                setModelLoadProgress(prev => {
                    const next = new Map(prev);
                    next.delete(modelId);
                    return next;
                });
            }, 1500); // Increased from 1000ms to give more time for the loading animation
            // Log which model is being set
            if (ollamaModel) {
                console.log(`[ModelOnboarding] Setting Ollama ${ollamaModel.displayName} as model`);
            }
            else if (modelId === 'openai-gpt-oss-20b') {
                console.log('[ModelOnboarding] Setting OpenAI GPT-OSS-20B as primary model');
            }
            else {
                console.log(`[ModelOnboarding] Setting ${modelConfig.name} as model`);
            }
            await appModel.llmManager.loadModel(modelId);
        }
        else if (shouldComplete) {
            // If no llmManager, still complete if requested
            handleComplete();
        }
    };
    const skipSetup = () => {
        // User can add models later from settings
        handleComplete();
    };
    return (_jsx("div", { className: "min-h-screen bg-background p-8 overflow-y-auto", children: _jsxs("div", { className: "max-w-4xl w-full mx-auto", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("h1", { className: "text-4xl font-bold mb-4", children: "Welcome to LAMA" }), _jsx("p", { className: "text-xl text-muted-foreground", children: "Let's set up your AI assistant. Choose ONE model to get started." }), _jsx("p", { className: "text-sm text-muted-foreground mt-2", children: "You can add more models later in Settings → AI Models" })] }), !loadingOllama && !ollamaAvailable && (_jsxs(Card, { className: "mb-6 border-amber-200 bg-amber-50", children: [_jsxs(CardContent, { className: "flex items-start gap-3 pt-6", children: [_jsx(AlertTriangle, { className: "h-5 w-5 text-amber-600 mt-0.5" }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "font-medium text-amber-900", children: "Ollama is not running" }), _jsx("p", { className: "text-sm text-amber-700 mt-1", children: "To use local AI models, start Ollama with: ollama serve" }), _jsx("p", { className: "text-sm text-amber-600 mt-2", children: "You can still use cloud-based models or continue without a model." })] })] })] })), showOllamaConsent ? (_jsxs(Card, { className: "max-w-2xl mx-auto", children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center space-x-2", children: [_jsx(AlertTriangle, { className: "h-5 w-5 text-yellow-500" }), _jsx("span", { children: "Use Ollama Model?" })] }), _jsx(CardDescription, { children: "You're about to use a locally running Ollama model" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "bg-muted p-4 rounded-lg space-y-2", children: [_jsx("p", { className: "text-sm", children: "By using Ollama models, you acknowledge:" }), _jsxs("ul", { className: "text-sm space-y-1 ml-4 list-disc", children: [_jsx("li", { children: "The model runs on your local machine via Ollama service" }), _jsx("li", { children: "Performance depends on your hardware capabilities" }), _jsx("li", { children: "No data is sent to external servers" }), _jsx("li", { children: "Model responses are generated locally" })] })] }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx(Button, { variant: "outline", onClick: () => handleOllamaConsent(false), children: "Cancel" }), _jsx(Button, { onClick: () => handleOllamaConsent(true), children: "Accept and Use Model" })] })] })] })) : !isDownloading ? (_jsxs(_Fragment, { children: [ollamaAvailable && ollamaModels.length > 0 && (_jsxs("div", { className: "mb-8", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Server, { className: "h-5 w-5 text-green-500" }), _jsx("h2", { className: "text-xl font-semibold", children: "Available Ollama Models" }), _jsxs("span", { className: "text-sm text-muted-foreground", children: ["(", ollamaModels.length, " models detected)"] })] }), _jsx("div", { className: "grid gap-4 md:grid-cols-3", children: ollamaModels.map((model) => (_jsxs(Card, { className: `transition-all hover:shadow-lg ${selectedModels.has(model.id) ? 'ring-2 ring-primary' : ''}`, children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Checkbox, { checked: selectedModels.has(model.id), onCheckedChange: () => toggleModelSelection(model.id), onClick: (e) => e.stopPropagation() }), _jsx("span", { className: "text-base", children: model.displayName })] }), _jsx(Check, { className: "h-5 w-5 text-green-500" })] }), _jsxs(CardDescription, { children: [model.size, " \u2022 ", model.parameterSize, " \u2022 Local"] })] }), _jsxs(CardContent, { children: [_jsx("p", { className: "text-sm text-muted-foreground", children: model.description }), loadingModels.has(model.id) && (_jsxs("div", { className: "mt-3", children: [_jsxs("div", { className: "flex items-center justify-between text-sm mb-2", children: [_jsx("span", { children: "Loading model..." }), _jsxs("span", { children: [modelLoadProgress.get(model.id) || 0, "%"] })] }), _jsx(Progress, { value: modelLoadProgress.get(model.id) || 0, className: "h-2" })] })), _jsxs("div", { className: "flex flex-wrap gap-1 mt-2", children: [model.capabilities.includes('code') && (_jsx("span", { className: "text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded", children: "Code" })), loadingModels.has(model.id) ? (_jsxs("span", { className: "text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded flex items-center gap-1", children: [_jsx(Loader2, { className: "h-3 w-3 animate-spin" }), "Loading"] })) : (_jsx("span", { className: "text-xs bg-green-100 text-green-700 px-2 py-1 rounded", children: "Ready" }))] })] })] }, model.id))) })] })), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold mb-4", children: ollamaAvailable ? 'Or Download Additional Models' : 'Download Models' }), _jsx("div", { className: "grid gap-4 md:grid-cols-3", children: MODEL_OPTIONS.map((model) => (_jsxs(Card, { className: `cursor-pointer transition-all hover:shadow-lg ${selectedModel === model.id ? 'ring-2 ring-primary' : ''}`, onClick: () => handleModelSelect(model.id), children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center justify-between", children: [_jsx("span", { children: model.name }), model.requiresDownload ? (_jsx(Download, { className: "h-5 w-5 text-muted-foreground" })) : (_jsx(Zap, { className: "h-5 w-5 text-yellow-500" }))] }), _jsxs(CardDescription, { children: [model.size, " \u2022 ", model.requiresDownload ? 'Local' : 'Cloud'] })] }), _jsxs(CardContent, { children: [_jsx("p", { className: "text-sm text-muted-foreground", children: model.description }), model.apiKey && (_jsx("p", { className: "text-xs text-yellow-600 mt-2", children: "Requires API key" }))] })] }, model.id))) })] })] })) : (_jsxs(Card, { className: "max-w-2xl mx-auto", children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center space-x-2", children: [_jsx(Loader2, { className: "h-5 w-5 animate-spin" }), _jsx("span", { children: "Downloading Model" })] }), _jsx(CardDescription, { children: downloadError ? 'Download failed - please try again' : 'Downloading from HuggingFace...' })] }), _jsxs(CardContent, { className: "space-y-4", children: [downloadError ? (_jsxs("div", { className: "text-red-500 text-sm p-4 bg-red-50 rounded-lg", children: [_jsx("strong", { children: "Error:" }), " ", downloadError] })) : (_jsxs(_Fragment, { children: [_jsx(Progress, { value: downloadProgress, className: "w-full" }), _jsxs("div", { className: "text-sm text-muted-foreground space-y-1", children: [_jsxs("div", { className: "flex justify-between", children: [_jsxs("span", { children: [downloadProgress.toFixed(1), "% complete"] }), downloadStatus && (_jsxs("span", { children: [formatBytes(downloadStatus.downloaded), " / ", formatBytes(downloadStatus.total)] }))] }), downloadStatus && (_jsxs("div", { className: "flex justify-between", children: [_jsxs("span", { children: ["Speed: ", formatBytes(downloadStatus.speed), "/s"] }), _jsxs("span", { children: ["ETA: ", formatTime(downloadStatus.eta)] })] }))] })] })), downloadError && (_jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "outline", onClick: () => {
                                                setIsDownloading(false);
                                                setDownloadError(null);
                                                setDownloadProgress(0);
                                                setSelectedModel(null);
                                            }, children: "Cancel" }), _jsx(Button, { onClick: () => selectedModel && handleModelSelect(selectedModel), children: "Retry Download" })] }))] })] })), _jsxs("div", { className: "flex justify-center gap-4 mt-8", children: [selectedModels.size > 0 && (_jsx(Button, { onClick: handleLoadSelectedModels, disabled: isDownloading || loadingModels.size > 0, size: "lg", className: "bg-primary text-primary-foreground hover:bg-primary/90", children: loadingModels.size > 0 ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }), "Loading ", loadingModels.size, " Model", loadingModels.size > 1 ? 's' : '', "..."] })) : (`Load ${selectedModels.size} Selected Model${selectedModels.size > 1 ? 's' : ''}`) })), _jsx(Button, { variant: "ghost", onClick: skipSetup, disabled: isDownloading, children: "Skip for now (add models later)" })] })] }) }));
}
