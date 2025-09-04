import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Instances View - Shows connected devices/instances
 * Similar to one.leute's InstancesSettingsView
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Monitor, Smartphone, Tablet, HardDrive, AlertCircle, MoreVertical, CheckCircle, XCircle, Plus, Copy, User } from 'lucide-react';
export default function InstancesView() {
    const [browserInstance, setBrowserInstance] = useState(null);
    const [nodeInstance, setNodeInstance] = useState(null);
    const [myDevices, setMyDevices] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copiedInvite, setCopiedInvite] = useState(false);
    const [inviteType, setInviteType] = useState('device');
    const [nodeReady, setNodeReady] = useState(false);
    useEffect(() => {
        loadInstances();
        // Listen for instance updates via CHUM sync
        const handleChumSync = (event) => {
            if (event.detail?.type === 'ConnectionInfo') {
                loadInstances();
            }
        };
        window.addEventListener('chum:sync', handleChumSync);
        return () => window.removeEventListener('chum:sync', handleChumSync);
    }, []);
    const checkNodeReadiness = async () => {
        if (!window.electronAPI) {
            setNodeReady(false);
            return;
        }
        try {
            // Check if Node.js instance is ready for invitations
            const result = await window.electronAPI.invoke('devices:getInstanceInfo');
            console.log('[InstancesView] Node readiness check result:', result);
            // Check if node is initialized and has pairing capability
            if (result?.success && result.nodeInitialized && result.hasPairing) {
                console.log('[InstancesView] Node is ready for pairing invitations');
                setNodeReady(true);
            }
            else {
                console.log('[InstancesView] Node not ready:', {
                    success: result?.success,
                    nodeInitialized: result?.nodeInitialized,
                    hasPairing: result?.hasPairing
                });
                setNodeReady(false);
            }
        }
        catch (error) {
            console.log('[InstancesView] Node readiness check failed:', error);
            setNodeReady(false);
        }
    };
    const loadInstances = async () => {
        try {
            // Get browser instance info (this renderer)
            const browserInfo = {
                id: 'browser-' + (window.lamaBridge?.appModel?.leuteModel?.myMainIdentity?.() || 'instance'),
                personId: window.lamaBridge?.appModel?.leuteModel?.myMainIdentity?.() || 'browser-instance',
                name: 'Browser UI',
                platform: 'browser',
                role: 'client',
                isLocal: true,
                isConnected: true,
                trusted: true,
                lastSeen: new Date(),
                capabilities: {
                    network: false, // Browser can't do direct networking
                    storage: true, // Has IndexedDB for sparse storage
                    llm: false // No direct LLM access
                }
            };
            setBrowserInstance(browserInfo);
            // Get Node.js instance info
            const nodeInfo = await window.lamaBridge.getInstanceInfo();
            if (nodeInfo.success && nodeInfo.instance) {
                setNodeInstance({
                    id: nodeInfo.instance.id,
                    personId: nodeInfo.instance.id,
                    name: nodeInfo.instance.name || 'Node.js Hub',
                    platform: 'nodejs',
                    role: 'hub',
                    isLocal: true,
                    isConnected: nodeInfo.instance.initialized || false,
                    trusted: true,
                    lastSeen: new Date(),
                    capabilities: nodeInfo.instance.capabilities || {
                        network: true, // Node.js handles networking
                        storage: true, // Archive storage
                        llm: true // LLM management
                    }
                });
            }
            // Get contacts - show Node.js owner even if browser ONE.core isn't initialized
            try {
                const chumContacts = [];
                // Always try to get Node.js instance info first
                const nodeInfo = await window.electronAPI?.invoke('devices:getInstanceInfo');
                if (nodeInfo?.success && nodeInfo.ownerId) {
                    chumContacts.push({
                        id: `nodejs-owner-${nodeInfo.ownerId}`,
                        personId: nodeInfo.ownerId,
                        name: `${nodeInfo.instanceName || 'Node.js Hub'} (Owner)`,
                        platform: 'nodejs',
                        role: 'hub',
                        isLocal: true,
                        isConnected: true,
                        trusted: true,
                        lastSeen: new Date(),
                        capabilities: {}
                    });
                    console.log('[InstancesView] Added Node.js owner:', nodeInfo.instanceName);
                }
                // If browser ONE.core is initialized, add synced contacts via CHUM
                if (window.appModel?.leuteModel) {
                    const others = await window.appModel.leuteModel.others();
                    console.log(`[InstancesView] Found ${others.length} contacts in browser LeuteModel (via CHUM)`);
                    // Add other contacts synced via CHUM
                    for (const someone of others) {
                        try {
                            const personId = await someone.mainIdentity();
                            const profile = await someone.mainProfile();
                            // Skip if this is the same as Node.js owner (avoid duplicates)
                            if (personId === nodeInfo?.ownerId) {
                                continue;
                            }
                            chumContacts.push({
                                id: `contact-${personId}`,
                                personId: personId,
                                name: profile?.nickname || `Contact ${personId.substring(0, 8)}`,
                                platform: 'external',
                                role: 'contact',
                                isLocal: false,
                                isConnected: true,
                                trusted: true,
                                lastSeen: new Date(),
                                capabilities: {}
                            });
                        }
                        catch (error) {
                            console.warn('[InstancesView] Error processing contact:', error);
                        }
                    }
                    console.log(`[InstancesView] Added ${others.length} CHUM-synced contacts`);
                }
                else {
                    console.log('[InstancesView] Browser ONE.core not initialized, showing Node.js owner only');
                }
                setContacts(chumContacts);
                console.log(`[InstancesView] Set ${chumContacts.length} total contacts`);
            }
            catch (error) {
                console.error('[InstancesView] Error getting contacts:', error);
            }
            // TODO: Get actual my devices from connections model
            setMyDevices([]);
            // Check if Node.js instance is ready for invitations
            await checkNodeReadiness();
        }
        catch (error) {
            console.error('[InstancesView] Error loading instances:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const handleCreateInvitation = async () => {
        try {
            console.log('[InstancesView] Creating invitation...');
            // Create invitation in Node.js ONE.core instance via IPC
            const result = await window.electronAPI?.invoke('iom:createPairingInvitation');
            console.log('[InstancesView] Full invitation result:', JSON.stringify(result, null, 2));
            if (result?.success && result.invitation) {
                // The invitation URL already includes the token
                const inviteText = result.invitation.url;
                console.log('[InstancesView] Invitation URL to copy:', inviteText);
                console.log('[InstancesView] Invitation token:', result.invitation.token);
                await navigator.clipboard.writeText(inviteText);
                setCopiedInvite(true);
                setTimeout(() => setCopiedInvite(false), 3000);
                console.log('[InstancesView] ONE.core invitation copied to clipboard');
            }
            else {
                console.error('[InstancesView] Failed to create ONE.core invitation:', result?.error || result);
                alert('Failed to create invitation: ' + (result?.error || 'Unknown error'));
            }
        }
        catch (error) {
            console.error('[InstancesView] Error creating ONE.core invitation:', error);
            alert('Error creating invitation: ' + error.message);
        }
    };
    const getPlatformIcon = (platform) => {
        switch (platform) {
            case 'browser':
                return _jsx(Monitor, { className: "h-4 w-4" });
            case 'mobile':
                return _jsx(Smartphone, { className: "h-4 w-4" });
            case 'desktop':
                return _jsx(Monitor, { className: "h-4 w-4" });
            case 'nodejs':
                return _jsx(HardDrive, { className: "h-4 w-4" });
            case 'tablet':
                return _jsx(Tablet, { className: "h-4 w-4" });
            default:
                return _jsx(AlertCircle, { className: "h-4 w-4" });
        }
    };
    const getRoleBadgeVariant = (role) => {
        switch (role) {
            case 'hub':
                return 'default';
            case 'client':
                return 'secondary';
            default:
                return 'outline';
        }
    };
    if (loading) {
        return (_jsx(Card, { children: _jsx(CardContent, { className: "p-6", children: _jsx("p", { className: "text-muted-foreground", children: "Loading instances..." }) }) }));
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium mb-2", children: "Local Instances" }), _jsx(Card, { children: _jsxs(CardContent, { className: "p-0", children: [browserInstance && (_jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "p-2 bg-blue-500/10 rounded-lg", children: getPlatformIcon(browserInstance.platform) }), _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: browserInstance.name }), _jsx("div", { className: "text-xs text-muted-foreground", children: "Renderer Process" }), _jsxs("div", { className: "flex items-center gap-2 mt-2", children: [_jsx(Badge, { variant: getRoleBadgeVariant(browserInstance.role), children: browserInstance.role }), _jsx(Badge, { variant: "outline", children: browserInstance.platform }), browserInstance.capabilities?.storage && (_jsx(Badge, { variant: "secondary", children: "Sparse Storage" }))] })] })] }), _jsx(CheckCircle, { className: "h-5 w-5 text-green-500" })] }) })), _jsx(Separator, {}), nodeInstance && (_jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "p-2 bg-primary/10 rounded-lg", children: getPlatformIcon(nodeInstance.platform) }), _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: nodeInstance.name }), _jsxs("div", { className: "text-xs text-muted-foreground", children: ["Main Process - ", nodeInstance.id?.substring(0, 12), "..."] }), _jsxs("div", { className: "flex items-center gap-2 mt-2", children: [_jsx(Badge, { variant: getRoleBadgeVariant(nodeInstance.role), children: nodeInstance.role }), _jsx(Badge, { variant: "outline", children: nodeInstance.platform }), nodeInstance.capabilities?.network && (_jsx(Badge, { variant: "secondary", children: "Network" })), nodeInstance.capabilities?.storage && (_jsx(Badge, { variant: "secondary", children: "Archive Storage" })), nodeInstance.capabilities?.llm && (_jsx(Badge, { variant: "secondary", children: "LLM" }))] })] })] }), nodeInstance.isConnected ? (_jsx(CheckCircle, { className: "h-5 w-5 text-green-500" })) : (_jsx(XCircle, { className: "h-5 w-5 text-gray-400" }))] }) }))] }) })] }), _jsx(Separator, {}), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("h3", { className: "text-sm font-medium", children: ["My Devices (", myDevices.length, ")"] }), _jsxs(Button, { size: "sm", onClick: () => {
                                    setInviteType('device');
                                    handleCreateInvitation();
                                }, className: "gap-2", children: [_jsx(Plus, { className: "h-3 w-3" }), "Add Device"] })] }), myDevices.length === 0 ? (_jsx(Card, { children: _jsx(CardContent, { className: "p-6 text-center", children: _jsx("p", { className: "text-muted-foreground", children: "No additional devices. Add your phone, tablet, or other devices to your Internet of Me." }) }) })) : (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: myDevices.map((device, index) => (_jsxs("div", { children: [_jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: `p-2 rounded-lg ${device.isConnected ? 'bg-green-500/10' : 'bg-gray-500/10'}`, children: getPlatformIcon(device.platform) }), _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: device.name }), _jsx("div", { className: "text-xs text-muted-foreground", children: device.personId ? `${device.personId.substring(0, 12)}...` : 'No ID' }), _jsxs("div", { className: "text-xs text-muted-foreground mt-1", children: ["Last seen: ", device.lastSeen.toLocaleString()] }), _jsxs("div", { className: "flex items-center gap-2 mt-2", children: [_jsx(Badge, { variant: "outline", children: device.platform }), _jsx(Badge, { variant: "secondary", children: "My Device" }), device.isConnected && (_jsx(Badge, { variant: "default", children: "Connected" }))] })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [device.isConnected ? (_jsx(CheckCircle, { className: "h-5 w-5 text-green-500" })) : (_jsx(XCircle, { className: "h-5 w-5 text-gray-400" })), _jsx(Button, { variant: "ghost", size: "icon", children: _jsx(MoreVertical, { className: "h-4 w-4" }) })] })] }) }), index < myDevices.length - 1 && _jsx(Separator, {})] }, device.id))) }) }))] }), _jsx(Separator, {}), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("h3", { className: "text-sm font-medium", children: ["NodeJS Contacts (", contacts.length, ")"] }), nodeReady ? (_jsx(Button, { size: "sm", onClick: () => {
                                    handleCreateInvitation();
                                }, className: "gap-2", children: copiedInvite ? (_jsxs(_Fragment, { children: [_jsx(Copy, { className: "h-3 w-3" }), "Copied!"] })) : (_jsxs(_Fragment, { children: [_jsx(User, { className: "h-3 w-3" }), "Add Contact"] })) })) : null] }), contacts.length === 0 ? (_jsx(Card, { children: _jsx(CardContent, { className: "p-6 text-center", children: _jsx("p", { className: "text-muted-foreground", children: "No contacts yet. Share your invitation link to connect with other users." }) }) })) : (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: contacts.map((contact, index) => (_jsxs("div", { children: [_jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: `p-2 rounded-lg ${contact.isConnected ? 'bg-blue-500/10' : 'bg-gray-500/10'}`, children: _jsx(User, { className: "h-4 w-4" }) }), _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: contact.name }), _jsx("div", { className: "text-xs text-muted-foreground", children: contact.personId ? `${contact.personId.substring(0, 12)}...` : 'No ID' }), _jsxs("div", { className: "text-xs text-muted-foreground mt-1", children: ["Last seen: ", contact.lastSeen.toLocaleString()] }), _jsxs("div", { className: "flex items-center gap-2 mt-2", children: [contact.trusted && (_jsx(Badge, { variant: "secondary", children: "Trusted" })), contact.isConnected && (_jsx(Badge, { variant: "default", children: "Connected" }))] })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [contact.isConnected ? (_jsx(CheckCircle, { className: "h-5 w-5 text-green-500" })) : (_jsx(XCircle, { className: "h-5 w-5 text-gray-400" })), _jsx(Button, { variant: "ghost", size: "icon", children: _jsx(MoreVertical, { className: "h-4 w-4" }) })] })] }) }), index < contacts.length - 1 && _jsx(Separator, {})] }, contact.id))) }) }))] })] }));
}
