import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Settings, User, Shield, Globe, Cpu, HardDrive, Save, RefreshCw, LogOut, Brain, Download, CheckCircle, Circle, Zap, MessageSquare, Code, Key, AlertTriangle, Trash2, Database, Hash, Clock, Package, Eye, ChevronDown, ChevronRight, Copy, FileText } from 'lucide-react';
import { lamaBridge } from '@/bridge/lama-bridge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import InstancesView from './InstancesView';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/alert-dialog";
export function SettingsView({ onLogout, onNavigate }) {
    const [models, setModels] = useState([]);
    const [loadingModels, setLoadingModels] = useState(true);
    const [loadingStates, setLoadingStates] = useState({});
    const [claudeApiKey, setClaudeApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [apiKeyStatus, setApiKeyStatus] = useState('unconfigured');
    // System objects state
    const [systemObjects, setSystemObjects] = useState({
        keys: [],
        metadata: [],
        crdt: []
    });
    const [expandedSections, setExpandedSections] = useState({});
    const [loadingSystemObjects, setLoadingSystemObjects] = useState(false);
    const [settings, setSettings] = useState({
        profile: {
            name: 'Test User',
            id: 'user-1',
            publicKey: '0x1234...abcd'
        },
        network: {
            relayServer: 'wss://comm10.dev.refinio.one',
            port: 443, // WSS default port
            udpPort: 8080, // For P2P UDP connections
            enableP2P: true,
            enableRelay: true,
            eddaDomain: localStorage.getItem('edda-domain') || 'edda.dev.refinio.one'
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
    });
    const [hasChanges, setHasChanges] = useState(false);
    useEffect(() => {
        loadModels();
        loadClaudeApiKey();
        loadSystemObjects();
        // Handle navigation to specific section
        const scrollToSection = sessionStorage.getItem('settings-scroll-to');
        if (scrollToSection === 'system-objects') {
            // Clear the navigation flag
            sessionStorage.removeItem('settings-scroll-to');
            // Expand the system objects sections and scroll to it
            setExpandedSections({
                keys: true,
                metadata: true,
                crdt: true
            });
            // Scroll after a short delay to allow DOM to update
            setTimeout(() => {
                const systemObjectsElement = document.getElementById('system-objects-section');
                if (systemObjectsElement) {
                    systemObjectsElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }, 100);
        }
    }, []);
    const loadModels = async () => {
        try {
            setLoadingModels(true);
            const modelList = await lamaBridge.getAvailableModels();
            setModels(modelList);
        }
        catch (error) {
            console.error('Failed to load models:', error);
        }
        finally {
            setLoadingModels(false);
        }
    };
    const handleLoadModel = async (modelId) => {
        setLoadingStates(prev => ({ ...prev, [modelId]: true }));
        try {
            const success = await lamaBridge.loadModel(modelId);
            if (success) {
                await loadModels();
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
                await loadModels();
            }
        }
        catch (error) {
            console.error('Failed to set default model:', error);
        }
    };
    const loadSystemObjects = async () => {
        setLoadingSystemObjects(true);
        try {
            // Fetch real keys and certificates from IPC handlers
            const [keysResult, certsResult] = await Promise.all([
                window.electronAPI?.invoke('crypto:getKeys'),
                window.electronAPI?.invoke('crypto:getCertificates')
            ]);
            const keys = [];
            const certificates = [];
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
                    });
                });
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
                    });
                });
            }
            // Add certificates to keys array (they're both crypto objects)
            const allCryptoObjects = [...keys, ...certificates];
            // Get app model for metadata and CRDT objects
            const appModel = lamaBridge.getAppModel();
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
            };
            setSystemObjects(mockSystemObjects);
        }
        catch (error) {
            console.error('Failed to load system objects:', error);
        }
        finally {
            setLoadingSystemObjects(false);
        }
    };
    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // Could add toast notification here
    };
    const formatBytes = (bytes) => {
        if (bytes < 1024)
            return bytes + ' B';
        if (bytes < 1024 * 1024)
            return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024)
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    };
    const formatTimeAgo = (date) => {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60)
            return `${seconds}s ago`;
        if (seconds < 3600)
            return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400)
            return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };
    const exportCryptoObject = async (obj) => {
        try {
            // Determine if it's a key or certificate based on metadata
            const isKey = obj.metadata?.algorithm && obj.metadata?.isPrivate !== undefined;
            const type = isKey ? 'key' : 'certificate';
            const result = await window.electronAPI?.invoke('crypto:export', {
                type,
                id: obj.id,
                format: 'pem'
            });
            if (result?.success && result.data) {
                // Create a download link
                const blob = new Blob([result.data.data], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.data.filename || `${obj.id}.pem`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                // Show success message
                console.log(`Exported ${type}: ${obj.id}`);
            }
        }
        catch (error) {
            console.error('Failed to export crypto object:', error);
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
            const appModel = lamaBridge.getAppModel();
            if (appModel?.llmManager) {
                const isValid = await appModel.llmManager.testClaudeApiKey(claudeApiKey);
                if (isValid) {
                    await appModel.llmManager.setClaudeApiKey(claudeApiKey);
                    setApiKeyStatus('valid');
                    await loadModels();
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
    const handleSave = () => {
        console.log('Saving settings:', settings);
        setHasChanges(false);
        // TODO: Persist settings
    };
    const updateSetting = (category, key, value) => {
        setSettings(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [key]: value
            }
        }));
        setHasChanges(true);
    };
    return (_jsxs("div", { className: "h-full flex flex-col", children: [_jsx(Card, { className: "mb-4", children: _jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Settings, { className: "h-5 w-5 text-primary" }), _jsx(CardTitle, { children: "Settings" })] }), hasChanges && (_jsxs(Button, { onClick: handleSave, size: "sm", children: [_jsx(Save, { className: "h-4 w-4 mr-2" }), "Save Changes"] }))] }) }) }), _jsx(ScrollArea, { className: "flex-1", children: _jsxs("div", { className: "space-y-4", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(User, { className: "h-4 w-4" }), _jsx(CardTitle, { className: "text-lg", children: "Profile" })] }), _jsx(CardDescription, { children: "Manage your identity and keys" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { children: "Display Name" }), _jsx(Input, { value: settings.profile.name, onChange: (e) => updateSetting('profile', 'name', e.target.value) })] }), _jsxs("div", { children: [_jsx(Label, { children: "Identity ID" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Input, { value: settings.profile.id, disabled: true }), _jsx(Button, { variant: "outline", size: "sm", children: "Copy" })] })] }), _jsxs("div", { children: [_jsx(Label, { children: "Public Key" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("code", { className: "text-xs bg-muted p-2 rounded flex-1", children: settings.profile.publicKey }), _jsx(Button, { variant: "outline", size: "sm", children: "Export" })] })] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Globe, { className: "h-4 w-4" }), _jsx(CardTitle, { className: "text-lg", children: "Network & Connections" })] }), _jsx(CardDescription, { children: "P2P connections and device pairing" })] }), _jsxs(CardContent, { className: "space-y-6", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Globe, { className: "h-4 w-4" }), _jsx("h3", { className: "font-medium", children: "Invitation Domain" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "edda-domain", children: "Edda Domain for Invitations" }), _jsxs("div", { className: "flex space-x-2", children: [_jsx(Input, { id: "edda-domain", type: "text", value: settings.network.eddaDomain, onChange: (e) => {
                                                                        const newDomain = e.target.value;
                                                                        setSettings(prev => ({
                                                                            ...prev,
                                                                            network: { ...prev.network, eddaDomain: newDomain }
                                                                        }));
                                                                        setHasChanges(true);
                                                                    }, placeholder: "edda.dev.refinio.one", className: "font-mono text-sm" }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => {
                                                                        // Save the domain to localStorage
                                                                        if (settings.network.eddaDomain) {
                                                                            localStorage.setItem('edda-domain', settings.network.eddaDomain);
                                                                        }
                                                                        else {
                                                                            localStorage.removeItem('edda-domain');
                                                                        }
                                                                        setHasChanges(false);
                                                                    }, disabled: !hasChanges, children: [_jsx(Save, { className: "h-4 w-4 mr-1" }), "Save"] })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "This domain will be used in invitation URLs. Use 'edda.dev.refinio.one' for development or 'edda.one' for production." })] })] }), _jsx(Separator, {}), _jsx(InstancesView, {})] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Brain, { className: "h-4 w-4" }), _jsx(CardTitle, { className: "text-lg", children: "AI Contacts" })] }), _jsx(CardDescription, { children: "Configure AI assistants as contacts" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Claude API Key" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Input, { type: showApiKey ? "text" : "password", value: claudeApiKey, onChange: (e) => setClaudeApiKey(e.target.value), placeholder: "sk-ant-..." }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setShowApiKey(!showApiKey), children: showApiKey ? 'Hide' : 'Show' }), _jsx(Button, { size: "sm", onClick: handleSaveClaudeApiKey, disabled: apiKeyStatus === 'testing', children: apiKeyStatus === 'testing' ? 'Testing...' : 'Save' })] }), apiKeyStatus === 'valid' && (_jsx("p", { className: "text-xs text-green-500", children: "\u2713 API key is valid" })), apiKeyStatus === 'invalid' && (_jsx("p", { className: "text-xs text-red-500", children: "\u2717 Invalid API key" }))] }), _jsx(Separator, {}), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "AI Assistant Contacts" }), loadingModels ? (_jsx("div", { className: "flex items-center justify-center py-4", children: _jsx("div", { className: "animate-spin rounded-full h-6 w-6 border-b-2 border-primary" }) })) : models.length === 0 ? (_jsxs(Alert, { children: [_jsx(AlertTriangle, { className: "h-4 w-4" }), _jsx(AlertDescription, { children: "No AI contacts configured. Add API keys above to enable AI assistants." })] })) : (_jsx("div", { className: "space-y-2", children: models.map((model) => (_jsxs("div", { className: "border rounded-lg p-3 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [getProviderIcon(model.provider), _jsx("span", { className: "font-medium", children: model.name }), _jsxs("span", { className: "text-xs text-muted-foreground", children: ["(", model.name.toLowerCase(), "@ai.local)"] }), model.isLoaded && (_jsxs(Badge, { variant: "outline", className: "text-xs", children: [_jsx(CheckCircle, { className: "h-3 w-3 mr-1" }), "Active"] }))] }), _jsxs("div", { className: "flex items-center space-x-2", children: [!model.isLoaded && (_jsx(Button, { size: "sm", variant: "outline", onClick: () => handleLoadModel(model.id), disabled: loadingStates[model.id], children: loadingStates[model.id] ? (_jsx("div", { className: "animate-spin rounded-full h-3 w-3 border-b-2 border-primary" })) : (_jsxs(_Fragment, { children: [_jsx(Cpu, { className: "h-3 w-3 mr-1" }), "Load Model"] })) })), model.isLoaded && (_jsxs(Button, { size: "sm", variant: "ghost", onClick: () => console.log('Open chat with', model.name), children: [_jsx(MessageSquare, { className: "h-3 w-3 mr-1" }), "Chat"] }))] })] }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [model.description, " \u2022 Chat with this AI assistant in your contacts"] }), _jsxs("div", { className: "flex items-center space-x-4 text-xs", children: [_jsx("span", { children: formatSize(model.size) }), _jsx("span", { children: "\u00B7" }), _jsxs("span", { children: [model.contextLength, " token context"] }), model.capabilities.length > 0 && (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u00B7" }), _jsx("div", { className: "flex items-center space-x-1", children: model.capabilities.map((cap) => (_jsxs(Badge, { variant: "secondary", className: "text-xs py-0", children: [getCapabilityIcon(cap), _jsx("span", { className: "ml-1", children: cap })] }, cap))) })] }))] })] }, model.id))) }))] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Shield, { className: "h-4 w-4" }), _jsx(CardTitle, { className: "text-lg", children: "Privacy" })] }), _jsx(CardDescription, { children: "Security and data preferences" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { children: "Auto-encrypt Messages" }), _jsx(Button, { variant: settings.privacy.autoEncrypt ? "default" : "outline", size: "sm", onClick: () => updateSetting('privacy', 'autoEncrypt', !settings.privacy.autoEncrypt), children: settings.privacy.autoEncrypt ? 'Enabled' : 'Disabled' })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { children: "Save Chat History" }), _jsx(Button, { variant: settings.privacy.saveHistory ? "default" : "outline", size: "sm", onClick: () => updateSetting('privacy', 'saveHistory', !settings.privacy.saveHistory), children: settings.privacy.saveHistory ? 'Enabled' : 'Disabled' })] }), _jsx(Separator, {}), _jsx("div", { className: "pt-2 space-y-2", children: _jsxs(AlertDialog, { children: [_jsx(AlertDialogTrigger, { asChild: true, children: _jsxs(Button, { variant: "destructive", className: "w-full", children: [_jsx(Trash2, { className: "h-4 w-4 mr-2" }), "Reset All App Data"] }) }), _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "Are you absolutely sure?" }), _jsxs(AlertDialogDescription, { className: "space-y-2", children: [_jsx("p", { children: "This action cannot be undone. This will permanently delete:" }), _jsxs("ul", { className: "list-disc list-inside space-y-1 text-sm", children: [_jsx("li", { children: "All chat history and messages" }), _jsx("li", { children: "All contacts and connections" }), _jsx("li", { children: "All settings and preferences" }), _jsx("li", { children: "All locally stored AI models" }), _jsx("li", { children: "Your identity and keys" })] }), _jsx("p", { className: "font-semibold text-red-500", children: "You will need to create a new identity or restore from backup after this operation." })] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: "Cancel" }), _jsx(AlertDialogAction, { className: "bg-red-600 hover:bg-red-700", onClick: async () => {
                                                                            try {
                                                                                // Clear browser-side data first
                                                                                console.log('Clearing browser-side data...');
                                                                                // Clear localStorage and sessionStorage
                                                                                localStorage.clear();
                                                                                sessionStorage.clear();
                                                                                // Clear IndexedDB databases
                                                                                if ('indexedDB' in window) {
                                                                                    try {
                                                                                        const databases = await indexedDB.databases();
                                                                                        for (const db of databases) {
                                                                                            if (db.name) {
                                                                                                await indexedDB.deleteDatabase(db.name);
                                                                                                console.log(`Deleted IndexedDB database: ${db.name}`);
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                    catch (e) {
                                                                                        console.error('Error clearing IndexedDB:', e);
                                                                                    }
                                                                                }
                                                                                // Clear service worker caches if any
                                                                                if ('caches' in window) {
                                                                                    try {
                                                                                        const cacheNames = await caches.keys();
                                                                                        await Promise.all(cacheNames.map(name => caches.delete(name)));
                                                                                    }
                                                                                    catch (e) {
                                                                                        console.error('Error clearing caches:', e);
                                                                                    }
                                                                                }
                                                                                // Clear cache in the bridge
                                                                                try {
                                                                                    lamaBridge.clearConversation('default');
                                                                                }
                                                                                catch (e) {
                                                                                    console.error('Error clearing bridge cache:', e);
                                                                                }
                                                                                // If we have access to Electron API, request full data clear
                                                                                // This will handle filesystem cleanup and reload the app
                                                                                if (window.electronAPI?.clearAppData) {
                                                                                    console.log('Requesting main process to clear all app data...');
                                                                                    const result = await window.electronAPI.clearAppData();
                                                                                    if (result?.success) {
                                                                                        console.log('App data cleared successfully, app will reload...');
                                                                                        // The main process will reload the window
                                                                                    }
                                                                                    else {
                                                                                        console.error('Failed to clear app data:', result?.error);
                                                                                        // Still reload to apply browser-side changes
                                                                                        window.location.href = '/';
                                                                                    }
                                                                                }
                                                                                else {
                                                                                    // No Electron API available, just reload after clearing browser data
                                                                                    console.log('No Electron API, reloading after browser cleanup...');
                                                                                    window.location.href = '/';
                                                                                }
                                                                            }
                                                                            catch (error) {
                                                                                console.error('Failed to reset app data:', error);
                                                                                alert('Failed to reset app data completely. Some data may have been cleared. Please restart the app.');
                                                                                // Try to reload anyway
                                                                                window.location.href = '/';
                                                                            }
                                                                        }, children: "Delete Everything" })] })] })] }) })] })] }), _jsxs(Card, { id: "system-objects-section", children: [_jsxs(CardHeader, { children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Package, { className: "h-4 w-4" }), _jsx(CardTitle, { className: "text-lg", children: "System Objects" })] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: loadSystemObjects, disabled: loadingSystemObjects, children: [loadingSystemObjects ? (_jsx("div", { className: "animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-2" })) : (_jsx(RefreshCw, { className: "h-3 w-3 mr-2" })), "Refresh"] })] }), _jsx(CardDescription, { children: "View cryptographic keys, metadata indexes, and CRDT state" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "border rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-between p-3 cursor-pointer hover:bg-accent/50", onClick: () => toggleSection('keys'), children: [_jsxs("div", { className: "flex items-center space-x-2", children: [expandedSections.keys ? _jsx(ChevronDown, { className: "h-4 w-4" }) : _jsx(ChevronRight, { className: "h-4 w-4" }), _jsx(Key, { className: "h-4 w-4 text-orange-500" }), _jsx("span", { className: "font-medium", children: "Keys & Certificates" }), _jsx(Badge, { variant: "secondary", children: systemObjects.keys.length })] }), _jsx(Eye, { className: "h-4 w-4 text-muted-foreground" })] }), expandedSections.keys && (_jsx("div", { className: "border-t", children: systemObjects.keys.map((obj) => (_jsxs("div", { className: "p-3 border-b last:border-b-0 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Hash, { className: "h-3 w-3 text-muted-foreground" }), _jsx("span", { className: "font-medium text-sm", children: obj.type })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Badge, { variant: "outline", className: "text-xs", children: formatBytes(obj.size) }), obj.metadata?.isPrivate !== undefined && (_jsx(Badge, { variant: obj.metadata.isPrivate ? "destructive" : "secondary", className: "text-xs", children: obj.metadata.isPrivate ? "Private" : "Public" })), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => copyToClipboard(obj.hash), title: "Copy fingerprint", children: _jsx(Copy, { className: "h-3 w-3" }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => exportCryptoObject(obj), title: "Export", children: _jsx(Download, { className: "h-3 w-3" }) })] })] }), _jsxs("div", { className: "text-xs text-muted-foreground space-y-1", children: [_jsx("div", { className: "flex items-center space-x-4", children: _jsxs("span", { children: ["Hash: ", _jsx("code", { className: "bg-muted px-1 rounded", children: obj.hash })] }) }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("span", { children: ["Created: ", formatTimeAgo(obj.created)] }), _jsxs("span", { children: ["Modified: ", formatTimeAgo(obj.lastModified)] })] }), obj.metadata && (_jsxs("div", { className: "flex items-center space-x-2 text-xs", children: [_jsx(FileText, { className: "h-3 w-3" }), Object.entries(obj.metadata).map(([key, value]) => (_jsxs(Badge, { variant: "secondary", className: "text-xs", children: [key, ": ", String(value)] }, key)))] }))] })] }, obj.id))) }))] }), _jsxs("div", { className: "border rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-between p-3 cursor-pointer hover:bg-accent/50", onClick: () => toggleSection('metadata'), children: [_jsxs("div", { className: "flex items-center space-x-2", children: [expandedSections.metadata ? _jsx(ChevronDown, { className: "h-4 w-4" }) : _jsx(ChevronRight, { className: "h-4 w-4" }), _jsx(Database, { className: "h-4 w-4 text-blue-500" }), _jsx("span", { className: "font-medium", children: "Metadata & Indexes" }), _jsx(Badge, { variant: "secondary", children: systemObjects.metadata.length })] }), _jsx(Eye, { className: "h-4 w-4 text-muted-foreground" })] }), expandedSections.metadata && (_jsx("div", { className: "border-t", children: systemObjects.metadata.map((obj) => (_jsxs("div", { className: "p-3 border-b last:border-b-0 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Database, { className: "h-3 w-3 text-muted-foreground" }), _jsx("span", { className: "font-medium text-sm", children: obj.type })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Badge, { variant: "outline", className: "text-xs", children: formatBytes(obj.size) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => copyToClipboard(obj.hash), children: _jsx(Copy, { className: "h-3 w-3" }) })] })] }), _jsxs("div", { className: "text-xs text-muted-foreground space-y-1", children: [_jsx("div", { className: "flex items-center space-x-4", children: _jsxs("span", { children: ["Hash: ", _jsx("code", { className: "bg-muted px-1 rounded", children: obj.hash })] }) }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("span", { children: ["Created: ", formatTimeAgo(obj.created)] }), _jsxs("span", { children: ["Modified: ", formatTimeAgo(obj.lastModified)] })] }), obj.metadata && (_jsxs("div", { className: "flex items-center space-x-2 text-xs", children: [_jsx(FileText, { className: "h-3 w-3" }), Object.entries(obj.metadata).map(([key, value]) => (_jsxs(Badge, { variant: "secondary", className: "text-xs", children: [key, ": ", String(value)] }, key)))] }))] })] }, obj.id))) }))] }), _jsxs("div", { className: "border rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-between p-3 cursor-pointer hover:bg-accent/50", onClick: () => toggleSection('crdt'), children: [_jsxs("div", { className: "flex items-center space-x-2", children: [expandedSections.crdt ? _jsx(ChevronDown, { className: "h-4 w-4" }) : _jsx(ChevronRight, { className: "h-4 w-4" }), _jsx(Clock, { className: "h-4 w-4 text-green-500" }), _jsx("span", { className: "font-medium", children: "CRDT State" }), _jsx(Badge, { variant: "secondary", children: systemObjects.crdt.length })] }), _jsx(Eye, { className: "h-4 w-4 text-muted-foreground" })] }), expandedSections.crdt && (_jsx("div", { className: "border-t", children: systemObjects.crdt.map((obj) => (_jsxs("div", { className: "p-3 border-b last:border-b-0 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Clock, { className: "h-3 w-3 text-muted-foreground" }), _jsx("span", { className: "font-medium text-sm", children: obj.type })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Badge, { variant: "outline", className: "text-xs", children: formatBytes(obj.size) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => copyToClipboard(obj.hash), children: _jsx(Copy, { className: "h-3 w-3" }) })] })] }), _jsxs("div", { className: "text-xs text-muted-foreground space-y-1", children: [_jsx("div", { className: "flex items-center space-x-4", children: _jsxs("span", { children: ["Hash: ", _jsx("code", { className: "bg-muted px-1 rounded", children: obj.hash })] }) }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("span", { children: ["Created: ", formatTimeAgo(obj.created)] }), _jsxs("span", { children: ["Modified: ", formatTimeAgo(obj.lastModified)] })] }), obj.metadata && (_jsxs("div", { className: "flex items-center space-x-2 text-xs", children: [_jsx(FileText, { className: "h-3 w-3" }), Object.entries(obj.metadata).map(([key, value]) => (_jsxs(Badge, { variant: "secondary", className: "text-xs", children: [key, ": ", String(value)] }, key)))] }))] })] }, obj.id))) }))] }), loadingSystemObjects && (_jsxs("div", { className: "flex items-center justify-center py-4", children: [_jsx("div", { className: "animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2" }), _jsx("span", { className: "text-sm text-muted-foreground", children: "Loading system objects..." })] }))] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(HardDrive, { className: "h-4 w-4" }), _jsx(CardTitle, { className: "text-lg", children: "Storage" })] }) }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-muted-foreground", children: "Messages" }), _jsx("span", { children: "124 MB" })] }), _jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-muted-foreground", children: "Media" }), _jsx("span", { children: "89 MB" })] }), _jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-muted-foreground", children: "AI Models" }), _jsx("span", { children: "4.2 GB" })] }), _jsx(Separator, {}), _jsxs("div", { className: "flex justify-between text-sm font-medium", children: [_jsx("span", { children: "Total" }), _jsx("span", { children: "4.4 GB" })] })] }) })] }), onLogout && (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(User, { className: "h-4 w-4" }), _jsx(CardTitle, { className: "text-lg", children: "Account" })] }) }), _jsx(CardContent, { children: _jsxs(Button, { variant: "outline", className: "w-full", onClick: onLogout, children: [_jsx(LogOut, { className: "h-4 w-4 mr-2" }), "Logout"] }) })] }))] }) })] }));
}
