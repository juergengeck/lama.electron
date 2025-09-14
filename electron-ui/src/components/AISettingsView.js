import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { lamaBridge } from '@/bridge/lama-bridge';
import { Brain, Download, CheckCircle, Circle, Cpu, Zap, MessageSquare, Code, Key, AlertTriangle } from 'lucide-react';
export function AISettingsView() {
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingStates, setLoadingStates] = useState({});
    const [claudeApiKey, setClaudeApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [apiKeyStatus, setApiKeyStatus] = useState('unconfigured');
    useEffect(() => {
        loadModels();
        loadClaudeApiKey();
    }, []);
    const loadModels = async () => {
        try {
            setLoading(true);
            const modelList = await lamaBridge.getAvailableModels();
            setModels(modelList);
        }
        catch (error) {
            console.error('Failed to load models:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const handleLoadModel = async (modelId) => {
        setLoadingStates(prev => ({ ...prev, [modelId]: true }));
        try {
            const success = await lamaBridge.loadModel(modelId);
            if (success) {
                await loadModels(); // Refresh the list
            }
        }
        catch (error) {
            console.error('Failed to load model:', error);
        }
        finally {
            setLoadingStates(prev => ({ ...prev, [modelId]: false }));
        }
    };
    const handleSetDefault = async (modelId) => {
        try {
            const success = await lamaBridge.setDefaultModel(modelId);
            if (success) {
                await loadModels(); // Refresh the list
            }
        }
        catch (error) {
            console.error('Failed to set default model:', error);
        }
    };
    const loadClaudeApiKey = async () => {
        const storedKey = localStorage.getItem('claude_api_key');
        if (storedKey) {
            setClaudeApiKey(storedKey);
            setApiKeyStatus('valid');
        }
    };
    const handleSaveClaudeApiKey = async () => {
        if (!claudeApiKey) {
            setApiKeyStatus('invalid');
            return;
        }
        setApiKeyStatus('testing');
        try {
            // NO AppModel in browser - everything via IPC
  const appModel = null;
            if (appModel?.llmManager) {
                const isValid = await appModel.llmManager.testClaudeApiKey(claudeApiKey);
                if (isValid) {
                    await appModel.llmManager.setClaudeApiKey(claudeApiKey);
                    setApiKeyStatus('valid');
                    await loadModels(); // Refresh to show Claude models as available
                }
                else {
                    setApiKeyStatus('invalid');
                }
            }
        }
        catch (error) {
            console.error('Failed to save Claude API key:', error);
            setApiKeyStatus('invalid');
        }
    };
    const getProviderIcon = (provider) => {
        switch (provider.toLowerCase()) {
            case 'qwen': return _jsx(Brain, { className: "h-4 w-4" });
            case 'openai': return _jsx(Zap, { className: "h-4 w-4" });
            case 'anthropic': return _jsx(MessageSquare, { className: "h-4 w-4" });
            default: return _jsx(Cpu, { className: "h-4 w-4" });
        }
    };
    const getCapabilityIcon = (capability) => {
        switch (capability.toLowerCase()) {
            case 'coding': return _jsx(Code, { className: "h-3 w-3" });
            case 'reasoning': return _jsx(Brain, { className: "h-3 w-3" });
            case 'chat': return _jsx(MessageSquare, { className: "h-3 w-3" });
            default: return _jsx(Circle, { className: "h-3 w-3" });
        }
    };
    const formatSize = (size) => {
        if (size === 0)
            return 'API-based';
        if (size >= 1e9)
            return `${(size / 1e9).toFixed(1)}B params`;
        if (size >= 1e6)
            return `${(size / 1e6).toFixed(1)}M params`;
        return `${size} bytes`;
    };
    if (loading) {
        return (_jsxs(Card, { className: "h-full", children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center space-x-2", children: [_jsx(Brain, { className: "h-5 w-5" }), _jsx("span", { children: "AI Models" })] }) }), _jsx(CardContent, { children: _jsx("div", { className: "flex items-center justify-center py-8", children: _jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-primary" }) }) })] }));
    }
    return (_jsxs(Card, { className: "h-full", children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center space-x-2", children: [_jsx(Brain, { className: "h-5 w-5" }), _jsx("span", { children: "AI Models" })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Manage your local and cloud AI models" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "text-base flex items-center space-x-2", children: [_jsx(Key, { className: "h-4 w-4" }), _jsx("span", { children: "Claude API Configuration" })] }) }), _jsx(CardContent, { className: "space-y-4", children: _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "claude-api-key", children: "API Key" }), _jsxs("div", { className: "flex space-x-2", children: [_jsx(Input, { id: "claude-api-key", type: showApiKey ? "text" : "password", value: claudeApiKey, onChange: (e) => setClaudeApiKey(e.target.value), placeholder: "sk-ant-api...", className: "flex-1" }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setShowApiKey(!showApiKey), children: showApiKey ? "Hide" : "Show" }), _jsx(Button, { onClick: handleSaveClaudeApiKey, disabled: !claudeApiKey || apiKeyStatus === 'testing', children: apiKeyStatus === 'testing' ? "Testing..." : "Save" })] }), apiKeyStatus === 'valid' && (_jsxs(Alert, { className: "bg-green-500/10", children: [_jsx(CheckCircle, { className: "h-4 w-4 text-green-500" }), _jsx(AlertDescription, { className: "text-green-500", children: "API key is valid and Claude models are available" })] })), apiKeyStatus === 'invalid' && (_jsxs(Alert, { variant: "destructive", children: [_jsx(AlertTriangle, { className: "h-4 w-4" }), _jsx(AlertDescription, { children: "Invalid API key. Please check and try again." })] })), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["Get your API key from ", _jsx("a", { href: "https://console.anthropic.com", target: "_blank", rel: "noopener noreferrer", className: "underline", children: "console.anthropic.com" })] })] }) })] }), models.length === 0 ? (_jsxs("div", { className: "text-center py-8 text-muted-foreground", children: [_jsx(Brain, { className: "h-12 w-12 mx-auto mb-4 opacity-50" }), _jsx("p", { children: "No AI models configured" }), _jsx("p", { className: "text-sm", children: "Models will be added automatically on first use" })] })) : (_jsx("div", { className: "space-y-4", children: models.map((model) => (_jsxs("div", { className: "border rounded-lg p-4 space-y-3", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [getProviderIcon(model.provider), _jsx("h3", { className: "font-semibold", children: model.name }), model.isDefault && (_jsx(Badge, { variant: "default", className: "text-xs", children: "Default" }))] }), _jsx("p", { className: "text-sm text-muted-foreground", children: model.description })] }), _jsx("div", { className: "flex items-center space-x-2", children: model.isLoaded ? (_jsxs(Badge, { variant: "secondary", className: "flex items-center space-x-1", children: [_jsx(CheckCircle, { className: "h-3 w-3" }), _jsx("span", { children: "Loaded" })] })) : (_jsxs(Button, { size: "sm", variant: "outline", onClick: () => handleLoadModel(model.id), disabled: loadingStates[model.id], className: "flex items-center space-x-1", children: [_jsx(Download, { className: "h-3 w-3" }), _jsx("span", { children: loadingStates[model.id] ? 'Loading...' : 'Load' })] })) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-muted-foreground", children: "Provider:" }), _jsx("span", { className: "ml-2 capitalize", children: model.provider })] }), _jsxs("div", { children: [_jsx("span", { className: "text-muted-foreground", children: "Type:" }), _jsx("span", { className: "ml-2 capitalize", children: model.modelType })] }), _jsxs("div", { children: [_jsx("span", { className: "text-muted-foreground", children: "Size:" }), _jsx("span", { className: "ml-2", children: formatSize(model.size) })] }), _jsxs("div", { children: [_jsx("span", { className: "text-muted-foreground", children: "Context:" }), _jsxs("span", { className: "ml-2", children: [model.contextLength.toLocaleString(), " tokens"] })] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Capabilities:" }), _jsx("div", { className: "flex flex-wrap gap-2 mt-2", children: model.capabilities.map((capability) => (_jsxs(Badge, { variant: "outline", className: "text-xs flex items-center space-x-1", children: [getCapabilityIcon(capability), _jsx("span", { className: "capitalize", children: capability })] }, capability))) })] }), _jsxs("div", { className: "flex items-center justify-between pt-2", children: [_jsx("div", { className: "flex items-center space-x-2", children: !model.isDefault ? (_jsx(Button, { size: "sm", variant: "outline", onClick: () => handleSetDefault(model.id), className: "text-xs", children: "Set as Default" })) : (_jsx(Badge, { variant: "default", className: "text-xs", children: "Default Model" })) }), model.isLoaded && (_jsx(Badge, { variant: "secondary", className: "text-xs", children: "Ready for use" }))] })] }, model.id))) })), _jsxs("div", { className: "border-t pt-4", children: [_jsx("h4", { className: "font-medium mb-3", children: "Quick Actions" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => lamaBridge.getBestModelForTask('coding').then(console.log), className: "flex items-center space-x-2", children: [_jsx(Code, { className: "h-4 w-4" }), _jsx("span", { children: "Best for Coding" })] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => lamaBridge.getBestModelForTask('reasoning').then(console.log), className: "flex items-center space-x-2", children: [_jsx(Brain, { className: "h-4 w-4" }), _jsx("span", { children: "Best for Reasoning" })] })] })] })] })] }));
}
