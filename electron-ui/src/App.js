import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
// import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatLayout } from '@/components/ChatLayout';
import { JournalView } from '@/components/JournalView';
import { ContactsView } from '@/components/ContactsView';
import { SettingsView } from '@/components/SettingsView';
import { DataDashboard } from '@/components/DataDashboard';
import { LoginDeploy } from '@/components/LoginDeploy';
import { ModelOnboarding } from '@/components/ModelOnboarding';
import { MessageSquare, BookOpen, Users, Settings, Loader2, Network, BarChart3 } from 'lucide-react';
import { useLamaInit } from '@/hooks/useLamaInit';
import { lamaBridge } from '@/bridge/lama-bridge';
function App() {
    const [activeTab, setActiveTab] = useState('chats');
    const [selectedConversationId, setSelectedConversationId] = useState(undefined);
    const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
        // Check if user has completed onboarding before
        return localStorage.getItem('lama-onboarding-completed') === 'true';
    });
    const { isInitialized, isAuthenticated, isLoading, login, logout, error } = useLamaInit();
    const appModel = lamaBridge.getAppModel();
    // Listen for navigation from Electron menu
    useEffect(() => {
        const handleNavigate = (_event, tab) => {
            setActiveTab(tab);
        };
        // Check if we're in Electron environment
        if (window.electronAPI && 'on' in window.electronAPI) {
            window.electronAPI.on('navigate', handleNavigate);
            return () => {
                // Only call off if it exists
                if ('off' in window.electronAPI) {
                    window.electronAPI.off('navigate', handleNavigate);
                }
            };
        }
    }, []);
    // Show loading screen while initializing
    if (isLoading && !isInitialized) {
        return (_jsx("div", { className: "flex h-screen items-center justify-center bg-background", children: _jsxs("div", { className: "text-center", children: [_jsx(Loader2, { className: "h-12 w-12 animate-spin text-primary mx-auto mb-4" }), _jsx("h2", { className: "text-2xl font-bold mb-2", children: "Initializing LAMA Desktop" }), _jsx("p", { className: "text-muted-foreground", children: "Setting up encryption and local storage..." }), error && (_jsxs("div", { className: "mt-4 text-red-500", children: ["Error: ", error.message] }))] }) }));
    }
    // Show login/deploy screen if not authenticated
    // Security through obscurity - credentials deploy or access instances
    if (!isAuthenticated) {
        return _jsx(LoginDeploy, { onLogin: login });
    }
    // Check if we need to show model onboarding
    // Only show onboarding if:
    // 1. User has never completed it before AND
    // 2. No models are configured
    const hasModels = (appModel?.llmManager?.getModels()?.length ?? 0) > 0;
    const shouldShowOnboarding = !hasCompletedOnboarding && !hasModels;
    if (shouldShowOnboarding) {
        return _jsx(ModelOnboarding, { onComplete: () => {
                localStorage.setItem('lama-onboarding-completed', 'true');
                setHasCompletedOnboarding(true);
            } });
    }
    const tabs = [
        { id: 'chats', label: 'Chats', icon: MessageSquare },
        { id: 'journal', label: 'Journal', icon: BookOpen },
        { id: 'contacts', label: 'Contacts', icon: Users },
        { id: 'data', label: 'Data', icon: BarChart3 },
        { id: 'hierarchy', label: 'Storage', icon: Network },
        { id: 'settings', label: null, icon: Settings }, // No label for settings, just icon
    ];
    const handleNavigate = (tab, conversationId, section) => {
        setActiveTab(tab);
        if (conversationId) {
            setSelectedConversationId(conversationId);
        }
        // Store navigation context for settings
        if (tab === 'settings' && section) {
            // We'll pass this to SettingsView
            sessionStorage.setItem('settings-scroll-to', section);
        }
    };
    const renderContent = () => {
        switch (activeTab) {
            case 'chats':
                return _jsx(ChatLayout, { selectedConversationId: selectedConversationId });
            case 'journal':
                return _jsx(JournalView, {});
            case 'contacts':
                return _jsx(ContactsView, { onNavigateToChat: (topicId, contactName) => {
                        // Add or update the conversation in localStorage
                        const savedConversations = localStorage.getItem('lama-conversations');
                        let conversations = [];
                        try {
                            if (savedConversations) {
                                conversations = JSON.parse(savedConversations);
                            }
                        }
                        catch (e) {
                            console.error('Failed to parse saved conversations:', e);
                        }
                        // Check if conversation already exists
                        const existingConv = conversations.find((c) => c.id === topicId);
                        if (!existingConv) {
                            // Create new conversation entry
                            const newConversation = {
                                id: topicId,
                                name: `Chat with ${contactName}`,
                                type: 'direct',
                                lastMessage: null,
                                lastMessageTime: new Date().toISOString(),
                                modelName: null // No AI model for person-to-person chat
                            };
                            // Add to beginning of list
                            conversations.unshift(newConversation);
                            localStorage.setItem('lama-conversations', JSON.stringify(conversations));
                            console.log('[App] Created new conversation for contact:', contactName);
                        }
                        // Navigate to chat
                        setSelectedConversationId(topicId);
                        setActiveTab('chats');
                    } });
            case 'data':
                return _jsx(DataDashboard, { onNavigate: handleNavigate });
            case 'hierarchy':
                return _jsx(DataDashboard, { showHierarchyView: true, onNavigate: handleNavigate });
            case 'settings':
                return _jsx(SettingsView, { onLogout: logout, onNavigate: handleNavigate });
            default:
                return _jsx(ChatLayout, {});
        }
    };
    return (_jsxs("div", { className: "flex flex-col h-screen bg-background text-foreground", children: [_jsx("div", { className: "border-b bg-card", children: _jsxs("div", { className: "flex items-center justify-between px-6 py-3", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("h1", { className: "text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent", children: "LAMA" }), _jsx("div", { className: "h-6 w-px bg-border" })] }), _jsxs("div", { className: "flex items-center justify-between flex-1", children: [_jsx("div", { className: "flex items-center space-x-2", children: tabs.filter(tab => tab.id !== 'settings').map((tab) => {
                                        const Icon = tab.icon;
                                        return (_jsxs(Button, { variant: activeTab === tab.id ? 'default' : 'ghost', size: "sm", onClick: () => setActiveTab(tab.id), className: "flex items-center space-x-2", children: [_jsx(Icon, { className: "h-4 w-4" }), tab.label && _jsx("span", { children: tab.label })] }, tab.id));
                                    }) }), _jsx("div", { className: "flex items-center space-x-2", children: tabs.filter(tab => tab.id === 'settings').map((tab) => {
                                        const Icon = tab.icon;
                                        return (_jsxs(Button, { variant: activeTab === tab.id ? 'default' : 'ghost', size: "sm", onClick: () => setActiveTab(tab.id), className: "flex items-center space-x-2", children: [_jsx(Icon, { className: "h-4 w-4" }), tab.label && _jsx("span", { children: tab.label })] }, tab.id));
                                    }) })] })] }) }), _jsx("div", { className: "flex-1 overflow-hidden p-6", children: renderContent() }), _jsx("div", { className: "border-t bg-card px-6 py-2", children: _jsxs("div", { className: "flex items-center justify-between text-xs text-muted-foreground", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("span", { children: "LAMA Desktop v1.0.0" }), _jsx("span", { children: "\u00B7" }), _jsx("span", { children: "Browser: Sparse Storage" }), _jsx("span", { children: "\u00B7" }), _jsx("span", { children: "Node: Archive Storage" }), _jsx("span", { children: "\u00B7" }), _jsx("span", { children: "CHUM: Connected" })] }), _jsx("div", { className: "flex items-center space-x-4", children: _jsxs("span", { children: ["Identity: ", isAuthenticated ? 'Active' : 'None'] }) })] }) })] }));
}
export default App;
