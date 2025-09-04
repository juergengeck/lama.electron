import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Monitor, Tablet, Trash2, Plus, Wifi, WifiOff, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
export const DeviceManager = () => {
    const [devices, setDevices] = useState([]);
    const [newDeviceName, setNewDeviceName] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [currentInvite, setCurrentInvite] = useState(null);
    const [copiedInvite, setCopiedInvite] = useState(false);
    // Load devices on mount
    useEffect(() => {
        loadDevices();
        // Refresh every 5 seconds to update connection status
        const interval = setInterval(loadDevices, 5000);
        return () => clearInterval(interval);
    }, []);
    const loadDevices = async () => {
        try {
            const result = await window.api.invoke('devices:list');
            if (result.success) {
                setDevices(result.devices);
            }
        }
        catch (error) {
            console.error('Failed to load devices:', error);
        }
    };
    const registerNewDevice = async () => {
        if (!newDeviceName.trim()) {
            toast.error('Please enter a device name');
            return;
        }
        setIsRegistering(true);
        try {
            const result = await window.api.invoke('devices:register', {
                name: newDeviceName.trim(),
                platform: 'unknown' // Will be determined when device connects
            });
            if (result.success) {
                setCurrentInvite({
                    id: result.invite.id,
                    url: result.invite.url || `ws://localhost:8765/invite/${result.invite.id}`
                });
                setNewDeviceName('');
                await loadDevices();
                toast.success(`Device "${result.device.name}" registered successfully`);
            }
            else {
                toast.error(result.error || 'Failed to register device');
            }
        }
        catch (error) {
            console.error('Device registration error:', error);
            toast.error('Failed to register device');
        }
        finally {
            setIsRegistering(false);
        }
    };
    const removeDevice = async (deviceId) => {
        try {
            const result = await window.api.invoke('devices:remove', deviceId);
            if (result.success) {
                await loadDevices();
                toast.success('Device removed');
            }
            else {
                toast.error('Failed to remove device');
            }
        }
        catch (error) {
            console.error('Failed to remove device:', error);
            toast.error('Failed to remove device');
        }
    };
    const copyInviteUrl = () => {
        if (currentInvite) {
            navigator.clipboard.writeText(currentInvite.url);
            setCopiedInvite(true);
            toast.success('Invite URL copied to clipboard');
            setTimeout(() => {
                setCopiedInvite(false);
                setCurrentInvite(null);
            }, 3000);
        }
    };
    const getDeviceIcon = (platform) => {
        switch (platform?.toLowerCase()) {
            case 'mobile':
            case 'ios':
            case 'android':
                return _jsx(Smartphone, { className: "h-5 w-5" });
            case 'tablet':
            case 'ipad':
                return _jsx(Tablet, { className: "h-5 w-5" });
            default:
                return _jsx(Monitor, { className: "h-5 w-5" });
        }
    };
    const getStatusBadge = (status) => {
        switch (status) {
            case 'connected':
                return (_jsxs(Badge, { className: "bg-green-500/10 text-green-500 border-green-500/20", children: [_jsx(Wifi, { className: "h-3 w-3 mr-1" }), "Connected"] }));
            case 'disconnected':
                return (_jsxs(Badge, { className: "bg-gray-500/10 text-gray-500 border-gray-500/20", children: [_jsx(WifiOff, { className: "h-3 w-3 mr-1" }), "Disconnected"] }));
            case 'pending':
                return (_jsx(Badge, { className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", children: "Pending" }));
            default:
                return null;
        }
    };
    return (_jsxs(Card, { className: "bg-card/50 backdrop-blur", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Device Management" }), _jsx(CardDescription, { children: "Manage devices connected to your LAMA hub" })] }), _jsxs(CardContent, { className: "space-y-6", children: [_jsxs("div", { className: "space-y-4", children: [_jsx(Label, { children: "Register New Device" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { placeholder: "Enter device name...", value: newDeviceName, onChange: (e) => setNewDeviceName(e.target.value), onKeyDown: (e) => e.key === 'Enter' && registerNewDevice(), disabled: isRegistering }), _jsxs(Button, { onClick: registerNewDevice, disabled: isRegistering || !newDeviceName.trim(), children: [_jsx(Plus, { className: "h-4 w-4 mr-2" }), "Register"] })] })] }), currentInvite && (_jsxs("div", { className: "p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2", children: [_jsx("p", { className: "text-sm font-medium", children: "Device Invite Created" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("code", { className: "flex-1 p-2 bg-background/50 rounded text-xs break-all", children: currentInvite.url }), _jsx(Button, { size: "sm", variant: "outline", onClick: copyInviteUrl, children: copiedInvite ? (_jsxs(_Fragment, { children: [_jsx(CheckCircle, { className: "h-4 w-4 mr-2" }), "Copied!"] })) : (_jsxs(_Fragment, { children: [_jsx(Copy, { className: "h-4 w-4 mr-2" }), "Copy"] })) })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Use this invite URL on the new device to connect it to your hub" })] })), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Registered Devices" }), devices.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground py-4 text-center", children: "No devices registered yet" })) : (_jsx("div", { className: "space-y-2", children: devices.map((device) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-background/50 rounded-lg border", children: [_jsxs("div", { className: "flex items-center gap-3", children: [getDeviceIcon(device.platform), _jsxs("div", { children: [_jsx("p", { className: "font-medium", children: device.name }), _jsx("p", { className: "text-xs text-muted-foreground", children: device.browserInstanceName })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [getStatusBadge(device.status), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => removeDevice(device.id), children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }, device.id))) }))] }), _jsxs("div", { className: "p-3 bg-muted/50 rounded-lg", children: [_jsxs("p", { className: "text-xs text-muted-foreground", children: [_jsx("strong", { children: "Hub Address:" }), " ws://localhost:8765"] }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "Other devices on your network can connect to this hub using the invite system" })] })] })] }));
};
