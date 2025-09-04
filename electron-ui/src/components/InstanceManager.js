import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Instance and Device Manager
 * Shows the current Node.js instance alongside connected devices
 * Allows device-specific settings and management
 */
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Server, Smartphone, Laptop, Monitor, Wifi, WifiOff, Settings, UserPlus, Trash2, RefreshCw, CheckCircle, AlertCircle, Info, Network } from 'lucide-react';
export function InstanceManager() {
    const [instanceInfo, setInstanceInfo] = useState(null);
    const [devices, setDevices] = useState([]);
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const loadInstanceInfo = async () => {
        try {
            console.log('[InstanceManager] Loading instance info...');
            const result = await window.electronAPI.getInstanceInfo();
            if (result.success) {
                setInstanceInfo(result.instance);
                console.log('[InstanceManager] Instance info loaded:', result.instance);
            }
            else {
                setError(result.error || 'Failed to load instance info');
            }
        }
        catch (error) {
            console.error('[InstanceManager] Failed to load instance info:', error);
            setError('Failed to connect to Node.js instance');
        }
    };
    const loadDevices = async () => {
        try {
            console.log('[InstanceManager] Loading devices...');
            const result = await window.electronAPI.getDevices();
            if (result.success) {
                setDevices(result.devices || []);
                console.log('[InstanceManager] Devices loaded:', result.devices);
            }
            else {
                console.log('[InstanceManager] No devices found or error:', result.error);
            }
        }
        catch (error) {
            console.error('[InstanceManager] Failed to load devices:', error);
        }
    };
    const loadConnections = async () => {
        try {
            console.log('[InstanceManager] Loading connections...');
            const result = await window.electronAPI.getConnectionsInfo();
            if (result.success) {
                const formattedConnections = (result.connections || []).map((conn) => ({
                    id: conn.id || `conn-${Math.random()}`,
                    personId: conn.personId || '',
                    name: conn.name || 'Unknown',
                    status: conn.isConnected ? 'connected' : 'disconnected',
                    type: conn.type === 'direct' ? 'direct' : 'relay',
                    endpoint: conn.endpoint,
                    lastSeen: new Date(conn.lastSeen || Date.now())
                }));
                setConnections(formattedConnections);
                console.log('[InstanceManager] Connections loaded:', formattedConnections);
            }
            else {
                console.log('[InstanceManager] No connections found or error:', result.error);
            }
        }
        catch (error) {
            console.error('[InstanceManager] Failed to load connections:', error);
        }
    };
    const loadData = async () => {
        setLoading(true);
        setError(null);
        await Promise.all([
            loadInstanceInfo(),
            loadDevices(),
            loadConnections()
        ]);
        setLoading(false);
    };
    useEffect(() => {
        loadData();
        // Refresh data periodically
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    }, []);
    const getDeviceIcon = (platform, type) => {
        switch (platform.toLowerCase()) {
            case 'ios':
                return _jsx(Smartphone, { className: "h-4 w-4" });
            case 'android':
                return _jsx(Smartphone, { className: "h-4 w-4" });
            case 'windows':
                return _jsx(Laptop, { className: "h-4 w-4" });
            case 'macos':
                return _jsx(Monitor, { className: "h-4 w-4" });
            case 'linux':
                return _jsx(Monitor, { className: "h-4 w-4" });
            case 'nodejs':
                return _jsx(Server, { className: "h-4 w-4" });
            default:
                return _jsx(Monitor, { className: "h-4 w-4" });
        }
    };
    const getStatusBadge = (status, initialized) => {
        if (status === 'connected' || initialized) {
            return _jsxs(Badge, { variant: "default", className: "bg-green-500", children: [_jsx(CheckCircle, { className: "h-3 w-3 mr-1" }), "Connected"] });
        }
        else if (status === 'pairing') {
            return _jsxs(Badge, { variant: "secondary", children: [_jsx(RefreshCw, { className: "h-3 w-3 mr-1" }), "Pairing"] });
        }
        else {
            return _jsxs(Badge, { variant: "destructive", children: [_jsx(AlertCircle, { className: "h-3 w-3 mr-1" }), "Disconnected"] });
        }
    };
    if (loading) {
        return (_jsx(Card, { children: _jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(RefreshCw, { className: "h-5 w-5 animate-spin" }), "Loading Instance Information..."] }) }) }));
    }
    if (error && !instanceInfo) {
        return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2 text-red-600", children: [_jsx(AlertCircle, { className: "h-5 w-5" }), "Error Loading Instance"] }) }), _jsxs(CardContent, { children: [_jsx("p", { className: "text-sm text-muted-foreground mb-4", children: error }), _jsxs(Button, { onClick: loadData, variant: "outline", size: "sm", children: [_jsx(RefreshCw, { className: "h-4 w-4 mr-2" }), "Retry"] })] })] }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [instanceInfo && (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Server, { className: "h-5 w-5" }), "This Instance (Hub)"] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [getDeviceIcon(instanceInfo.platform, instanceInfo.type), _jsxs("div", { children: [_jsx("h3", { className: "font-medium", children: instanceInfo.name }), _jsxs("p", { className: "text-sm text-muted-foreground", children: [instanceInfo.platform, " \u2022 ", instanceInfo.role, " \u2022 ", instanceInfo.type] })] })] }), getStatusBadge('connected', instanceInfo.initialized)] }), _jsxs("div", { className: "grid grid-cols-2 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-muted-foreground", children: "Instance ID:" }), _jsx("p", { className: "font-mono text-xs break-all", children: instanceInfo.id })] }), _jsxs("div", { children: [_jsx("span", { className: "text-muted-foreground", children: "Connected Devices:" }), _jsx("p", { children: devices.length })] })] }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium mb-2", children: "Capabilities" }), _jsxs("div", { className: "flex gap-2 flex-wrap", children: [instanceInfo.capabilities.network?.enabled && (_jsxs(Badge, { variant: "outline", children: [_jsx(Network, { className: "h-3 w-3 mr-1" }), "Network"] })), instanceInfo.capabilities.storage?.enabled && (_jsxs(Badge, { variant: "outline", children: [_jsx(Server, { className: "h-3 w-3 mr-1" }), "Storage"] })), instanceInfo.capabilities.llm?.enabled && (_jsxs(Badge, { variant: "outline", children: [_jsx(Info, { className: "h-3 w-3 mr-1" }), "AI/LLM"] }))] })] }), _jsx(Separator, {}), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: loadData, children: [_jsx(RefreshCw, { className: "h-4 w-4 mr-2" }), "Refresh"] }), _jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(Settings, { className: "h-4 w-4 mr-2" }), "Settings"] })] })] })] })), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Smartphone, { className: "h-5 w-5" }), "Connected Devices (", devices.length, ")"] }), _jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(UserPlus, { className: "h-4 w-4 mr-2" }), "Add Device"] })] }) }), _jsx(CardContent, { children: devices.length === 0 ? (_jsxs("div", { className: "text-center py-6 text-muted-foreground", children: [_jsx(Smartphone, { className: "h-8 w-8 mx-auto mb-2 opacity-50" }), _jsx("p", { children: "No devices connected" }), _jsx("p", { className: "text-sm", children: "Add a device to start syncing across multiple devices" })] })) : (_jsx("div", { className: "space-y-3", children: devices.map((device) => (_jsxs("div", { className: "flex items-center justify-between p-3 border rounded-lg", children: [_jsxs("div", { className: "flex items-center gap-3", children: [getDeviceIcon(device.platform, device.type), _jsxs("div", { children: [_jsx("h4", { className: "font-medium", children: device.name }), _jsxs("p", { className: "text-sm text-muted-foreground", children: [device.platform, " \u2022 Last seen: ", device.lastSeen.toLocaleString()] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [getStatusBadge(device.status), _jsx(Button, { variant: "ghost", size: "sm", children: _jsx(Settings, { className: "h-4 w-4" }) }), _jsx(Button, { variant: "ghost", size: "sm", children: _jsx(Trash2, { className: "h-4 w-4 text-red-500" }) })] })] }, device.id))) })) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Wifi, { className: "h-5 w-5" }), "Active Connections (", connections.length, ")"] }) }), _jsx(CardContent, { children: connections.length === 0 ? (_jsxs("div", { className: "text-center py-6 text-muted-foreground", children: [_jsx(WifiOff, { className: "h-8 w-8 mx-auto mb-2 opacity-50" }), _jsx("p", { children: "No active connections" }), _jsx("p", { className: "text-sm", children: "Connect with other LAMA users to start chatting" })] })) : (_jsx("div", { className: "space-y-3", children: connections.map((connection) => (_jsxs("div", { className: "flex items-center justify-between p-3 border rounded-lg", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium", children: connection.name.substring(0, 2).toUpperCase() }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium", children: connection.name }), _jsxs("p", { className: "text-sm text-muted-foreground", children: [connection.type, " connection \u2022 Last seen: ", connection.lastSeen.toLocaleString()] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [getStatusBadge(connection.status), _jsx(Badge, { variant: "secondary", className: "text-xs", children: connection.type })] })] }, connection.id))) })) })] })] }));
}
