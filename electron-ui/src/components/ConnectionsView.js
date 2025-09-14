import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserPlus, Link, Copy, Check, Circle, RefreshCw, Wifi, WifiOff, Shield, AlertTriangle, Loader2, ExternalLink, Network } from 'lucide-react';
import { lamaBridge } from '@/bridge/lama-bridge';
import { QRCodeSVG } from 'qrcode.react';
export function ConnectionsView({ onNavigateToChat } = {}) {
    const [connections, setConnections] = useState([]);
    const [isCreatingInvitation, setIsCreatingInvitation] = useState(false);
    const [currentInvitation, setCurrentInvitation] = useState(null);
    const [showInviteDialog, setShowInviteDialog] = useState(false);
    const [showAcceptDialog, setShowAcceptDialog] = useState(false);
    const [invitationUrl, setInvitationUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [networkStatus, setNetworkStatus] = useState('offline');
    const [commServerUrl, setCommServerUrl] = useState('');
    const [error, setError] = useState(null);
    // NO AppModel in browser - everything via IPC
  const appModel = null;
    // Get edda domain from settings with fallback
    const getEddaDomain = () => {
        // Check if user has configured a custom domain
        const customDomain = localStorage.getItem('edda-domain');
        if (customDomain) {
            return customDomain;
        }
        // Fallback to environment-based domain detection
        const eddaDomains = {
            development: 'edda.dev.refinio.one',
            production: 'edda.one'
        };
        // Detect environment - in Electron, check if we're in development
        const isDevelopment = window.electronAPI?.isDevelopment ||
            process.env.NODE_ENV === 'development' ||
            window.location.hostname === 'localhost';
        return isDevelopment ? eddaDomains.development : eddaDomains.production;
    };
    // Load connections and network status
    useEffect(() => {
        loadConnections();
        checkNetworkStatus();
        // Set up event listeners if available
        if (appModel?.transportManager) {
            const handleConnectionEstablished = async (connectionInfo) => {
                console.log('[ConnectionsView] Connection established, auto-closing invite dialog and navigating to chat');
                // Auto-close the invite dialog when a new connection is established
                setShowInviteDialog(false);
                setCurrentInvitation(null);
                setCopied(false);
                // Load connections to get the latest
                await loadConnections();
                // Try to navigate to chat with the new contact
                if (onNavigateToChat && connectionInfo) {
                    try {
                        // Get the person ID from the connection info
                        const personId = connectionInfo.personId || connectionInfo.id;
                        if (personId) {
                            // Get or create topic for this contact
                            const topicId = await lamaBridge.getOrCreateTopicForContact(personId);
                            if (topicId) {
                                // Get contact name from connection info or use default
                                const contactName = connectionInfo.name ||
                                    connectionInfo.displayName ||
                                    `Contact ${personId.toString().substring(0, 8)}`;
                                console.log('[ConnectionsView] Navigating to chat with new contact:', contactName);
                                onNavigateToChat(topicId, contactName);
                            }
                        }
                    }
                    catch (error) {
                        console.error('[ConnectionsView] Failed to navigate to chat:', error);
                    }
                }
            };
            const handleConnectionClosed = () => {
                loadConnections();
            };
            // Subscribe to events
            appModel.transportManager.onConnectionEstablished.listen(handleConnectionEstablished);
            appModel.transportManager.onConnectionClosed.listen(handleConnectionClosed);
            // Cleanup
            return () => {
                // Unsubscribe from events
            };
        }
        console.log('[ConnectionsView] Setting up CHUM sync listeners...');
        // Listen for CHUM sync events from main process
        const handleChumSync = (data) => {
            console.log('[ConnectionsView] Received CHUM sync data:', data);
            if (data.type === 'Settings' && Array.isArray(data.changes)) {
                data.changes.forEach((settingsObject) => {
                    if (settingsObject.category === 'connections') {
                        console.log('[ConnectionsView] Processing connections settings from CHUM sync');
                        processConnectionsSettings(settingsObject.data);
                    }
                });
            }
        };
        // Register CHUM sync listener
        const unsubscribe = window.electronAPI?.on?.('chum:sync', handleChumSync);
        // Initial load and periodic updates (fallback)
        loadConnections();
        checkNetworkStatus();
        const interval = setInterval(() => {
            checkNetworkStatus(); // Keep network status polling
        }, 10000);
        return () => {
            clearInterval(interval);
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []);
    const processConnectionsSettings = (settingsData) => {
        try {
            console.log('[ConnectionsView] Processing connections settings:', settingsData);
            // Process contacts (Person objects) if available
            if (settingsData.contacts && Array.isArray(settingsData.contacts)) {
                const formattedConnections = settingsData.contacts.map((person) => ({
                    id: person.connectionId || person.id || `conn-${Math.random()}`,
                    personId: person.id || '',
                    name: person.name || 'Unknown Contact',
                    status: 'connected', // Person objects mean they're connected
                    type: person.platform === 'browser' ? 'direct' : 'relay',
                    endpoint: person.email || '',
                    lastSeen: new Date(person.connectedAt || person.pairedAt || Date.now()),
                    trustLevel: person.trusted ? 'full' : 'partial'
                }));
                setConnections(formattedConnections);
                console.log(`[ConnectionsView] Updated ${formattedConnections.length} contacts from CHUM sync`);
                return;
            }
            // Fallback to connections array if no contacts
            if (settingsData.connections && Array.isArray(settingsData.connections)) {
                const formattedConnections = settingsData.connections.map((conn) => ({
                    id: conn.id || `conn-${Math.random()}`,
                    personId: conn.personId || '',
                    name: conn.name || 'Unknown',
                    status: conn.isConnected ? 'connected' : 'disconnected',
                    type: conn.type === 'direct' ? 'direct' : 'relay',
                    endpoint: conn.endpoint,
                    lastSeen: new Date(conn.lastSeen || Date.now()),
                    trustLevel: conn.trusted ? 'full' : 'partial'
                }));
                setConnections(formattedConnections);
                console.log(`[ConnectionsView] Updated connections from CHUM sync: ${formattedConnections.length} connections`);
            }
        }
        catch (error) {
            console.error('[ConnectionsView] Error processing CHUM sync connections:', error);
        }
    };
    const loadConnections = async () => {
        // Connections data will come via CHUM sync events
        // This method is kept for manual refresh if needed
        console.log('[ConnectionsView] Waiting for connections data via CHUM sync...');
    };
    const checkNetworkStatus = async () => {
        try {
            if (!appModel?.connections) {
                setNetworkStatus('offline');
                return;
            }
            // Check if ConnectionsModel has online connections
            // ConnectionsModel doesn't have isOnline method, check connections instead
            const connectionsInfo = appModel.connections.connectionsInfo?.() || [];
            const hasActiveConnections = Array.isArray(connectionsInfo) && connectionsInfo.length > 0;
            // Check if transport is actually connected
            const transport = appModel.transportManager?.getTransport?.('COMM_SERVER');
            const isTransportConnected = transport?.isAvailable?.() || false;
            setNetworkStatus(hasActiveConnections || isTransportConnected ? 'online' : 'offline');
            // Get CommServer URL from the transport config
            const commServerUrl = appModel.transportManager?.commServerUrl || 'wss://comm10.dev.refinio.one';
            setCommServerUrl(commServerUrl);
        }
        catch (error) {
            console.error('[ConnectionsView] Failed to check network status:', error);
            setNetworkStatus('offline');
        }
    };
    const createInvitation = async () => {
        setIsCreatingInvitation(true);
        setError(null);
        try {
            // Check if user is logged in first
            if (!appModel?.leuteModel) {
                throw new Error('Please log in first before creating invitations');
            }
            console.log('[ConnectionsView] Requesting invitation from Node.js instance via IPC...');
            // Request invitation from Node.js instance via IPC
            const result = await window.electronAPI.createInvitation();
            if (!result.success) {
                throw new Error(result.error || 'Failed to create invitation');
            }
            console.log('[ConnectionsView] Received invitation from Node.js:', result.invitation);
            // Use the invitation data from Node.js instance
            const invitation = {
                url: result.invitation.url,
                token: result.invitation.token,
                publicKey: result.invitation.publicKey,
                expiresAt: new Date(result.invitation.expiresAt)
            };
            setCurrentInvitation(invitation);
            setShowInviteDialog(true);
        }
        catch (error) {
            console.error('[ConnectionsView] Failed to create invitation:', error);
            // Provide more helpful error messages
            let errorMessage = 'Failed to create invitation';
            if (error instanceof Error) {
                if (error.message.includes('promisePlugin')) {
                    errorMessage = 'Network connection not established. Please wait for connection to initialize.';
                }
                else {
                    errorMessage = error.message;
                }
            }
            setError(errorMessage);
        }
        finally {
            setIsCreatingInvitation(false);
        }
    };
    const acceptInvitation = async () => {
        if (!invitationUrl) {
            setError('Please enter an invitation URL');
            return;
        }
        setIsRefreshing(true);
        setError(null);
        try {
            // Call the Node.js handler to accept the invitation
            const result = await window.electronAPI.invoke('iom:acceptPairingInvitation', invitationUrl);
            if (result.success) {
                console.log('[ConnectionsView] Invitation accepted successfully');
                // Close dialog and refresh connections
                setShowAcceptDialog(false);
                setInvitationUrl('');
                await loadConnections();
            }
            else {
                setError(result.error || 'Failed to accept invitation');
            }
        }
        catch (error) {
            console.error('[ConnectionsView] Failed to accept invitation:', error);
            setError(error.message || 'Failed to accept invitation');
        }
        finally {
            setIsRefreshing(false);
        }
    };
    const copyToClipboard = useCallback(async (text) => {
        try {
            // Use browser clipboard API (works in Electron renderer)
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch (error) {
            console.error('Failed to copy:', error);
            // Fallback: try selecting and copying the text
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
            catch (fallbackError) {
                console.error('Fallback copy also failed:', fallbackError);
            }
        }
    }, []);
    const refreshConnections = async () => {
        setIsRefreshing(true);
        await loadConnections();
        await checkNetworkStatus();
        setIsRefreshing(false);
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'connected': return 'text-green-500';
            case 'disconnected': return 'text-gray-500';
            default: return 'text-gray-500';
        }
    };
    return (_jsxs("div", { className: "h-full flex flex-col space-y-4", children: [_jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [networkStatus === 'online' ? (_jsx(Wifi, { className: "h-5 w-5 text-green-500" })) : (_jsx(WifiOff, { className: "h-5 w-5 text-gray-500" })), _jsx("span", { className: "font-medium", children: networkStatus === 'online' ? 'Connected' : 'Offline' })] }), _jsxs("div", { className: "text-sm text-muted-foreground", children: ["Relay: ", commServerUrl] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: refreshConnections, disabled: isRefreshing, children: [_jsx(RefreshCw, { className: `h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}` }), "Refresh"] }), _jsxs(Button, { size: "sm", onClick: () => setShowAcceptDialog(true), children: [_jsx(Link, { className: "h-4 w-4 mr-2" }), "Accept Invite"] }), _jsxs(Button, { size: "sm", onClick: createInvitation, disabled: isCreatingInvitation, children: [isCreatingInvitation ? (_jsx(Loader2, { className: "h-4 w-4 mr-2 animate-spin" })) : (_jsx(UserPlus, { className: "h-4 w-4 mr-2" })), "Create Invite"] })] })] }) }) }), error && (_jsxs(Alert, { variant: "destructive", children: [_jsx(AlertTriangle, { className: "h-4 w-4" }), _jsx(AlertDescription, { children: error })] })), _jsxs(Tabs, { defaultValue: "active", className: "flex-1 flex flex-col", children: [_jsxs(TabsList, { className: "grid w-full grid-cols-3", children: [_jsxs(TabsTrigger, { value: "active", children: ["Active (", connections.filter(c => c.status === 'connected').length, ")"] }), _jsxs(TabsTrigger, { value: "pending", children: ["Pending (", connections.filter(c => c.status === 'disconnected').length, ")"] }), _jsxs(TabsTrigger, { value: "all", children: ["All (", connections.length, ")"] })] }), _jsx(TabsContent, { value: "active", className: "flex-1 mt-4", children: _jsx(ConnectionsList, { connections: connections.filter(c => c.status === 'connected'), onRefresh: refreshConnections }) }), _jsx(TabsContent, { value: "pending", className: "flex-1 mt-4", children: _jsx(ConnectionsList, { connections: connections.filter(c => c.status === 'disconnected'), onRefresh: refreshConnections }) }), _jsx(TabsContent, { value: "all", className: "flex-1 mt-4", children: _jsx(ConnectionsList, { connections: connections, onRefresh: refreshConnections }) })] }), _jsx(Dialog, { open: showInviteDialog, onOpenChange: setShowInviteDialog, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Share Invitation" }), _jsx(DialogDescription, { children: "Share this invitation link or QR code to connect with another device. This invitation creates a secure peer-to-peer connection." })] }), currentInvitation && (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "flex justify-center p-4 bg-white rounded-lg border", children: _jsx(QRCodeSVG, { value: currentInvitation.url, size: 200 }) }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Invitation URL" }), _jsxs("div", { className: "flex space-x-2", children: [_jsx(Input, { value: currentInvitation.url, readOnly: true, className: "text-xs font-mono" }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => copyToClipboard(currentInvitation.url), children: copied ? _jsx(Check, { className: "h-4 w-4" }) : _jsx(Copy, { className: "h-4 w-4" }) })] })] }), _jsxs("div", { className: "text-xs text-muted-foreground space-y-1", children: [_jsxs("div", { children: ["Domain: ", getEddaDomain()] }), _jsxs("div", { children: ["Token: ", currentInvitation.token.substring(0, 16), "..."] }), _jsxs("div", { children: ["Public Key: ", currentInvitation.publicKey.substring(0, 16), "..."] }), _jsxs("div", { children: ["Expires: ", currentInvitation.expiresAt.toLocaleTimeString()] })] }), _jsxs("div", { className: "text-sm bg-blue-50 p-3 rounded-lg", children: [_jsx("p", { className: "font-medium mb-1", children: "How to connect:" }), _jsxs("ol", { className: "list-decimal list-inside space-y-1 text-xs", children: [_jsx("li", { children: "Share this QR code or URL with the other person" }), _jsx("li", { children: "They scan the QR code or paste the URL in their app" }), _jsx("li", { children: "Connection will be established automatically" })] })] })] })), _jsx(DialogFooter, { children: _jsx(Button, { variant: "outline", onClick: () => setShowInviteDialog(false), children: "Close" }) })] }) }), _jsx(Dialog, { open: showAcceptDialog, onOpenChange: setShowAcceptDialog, children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Accept Invitation" }), _jsx(DialogDescription, { children: "Paste the invitation URL to connect with another device" })] }), _jsx("div", { className: "space-y-4", children: _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Invitation URL" }), _jsx(Input, { placeholder: "https://...", value: invitationUrl, onChange: (e) => setInvitationUrl(e.target.value) })] }) }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setShowAcceptDialog(false), children: "Cancel" }), _jsxs(Button, { onClick: acceptInvitation, disabled: !invitationUrl || isRefreshing, children: [isRefreshing ? (_jsx(Loader2, { className: "h-4 w-4 mr-2 animate-spin" })) : null, "Accept"] })] })] }) })] }));
}
// Connections List Component
function ConnectionsList({ connections, onRefresh }) {
    if (connections.length === 0) {
        return (_jsx(Card, { className: "h-full flex items-center justify-center", children: _jsxs(CardContent, { className: "text-center py-8", children: [_jsx(Network, { className: "h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" }), _jsx("p", { className: "text-muted-foreground", children: "No connections" }), _jsx("p", { className: "text-sm text-muted-foreground mt-2", children: "Create an invitation to connect with other devices" })] }) }));
    }
    return (_jsx(Card, { className: "h-full", children: _jsx(ScrollArea, { className: "h-full", children: _jsx(CardContent, { className: "p-4 space-y-2", children: connections.map((connection) => (_jsx(Card, { className: "hover:bg-accent transition-colors", children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(Circle, { className: `h-2 w-2 fill-current ${connection.status === 'connected' ? 'text-green-500' : 'text-gray-500'}` }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "font-medium", children: connection.name }), _jsx(Badge, { variant: "outline", className: "text-xs", children: connection.type === 'direct' ? 'P2P' : 'Relay' }), connection.trustLevel === 'full' && (_jsx(Shield, { className: "h-3 w-3 text-green-500" }))] }), _jsxs("div", { className: "text-xs text-muted-foreground mt-1", children: [connection.endpoint || connection.personId.substring(0, 8), "..."] }), _jsxs("div", { className: "text-xs text-muted-foreground", children: ["Last seen: ", connection.lastSeen.toLocaleTimeString()] })] })] }), _jsx("div", { className: "flex items-center space-x-2", children: _jsx(Button, { variant: "ghost", size: "sm", children: _jsx(ExternalLink, { className: "h-4 w-4" }) }) })] }) }) }, connection.id))) }) }) }));
}
