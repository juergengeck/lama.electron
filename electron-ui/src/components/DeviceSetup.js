import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Device Setup Component
 * Handles registration of new devices and pairing
 */
import { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, } from './ui/dialog';
import { QrCode, Smartphone, Laptop, Monitor, Copy, Check, RefreshCw, AlertCircle, UserPlus, Wifi, Share } from 'lucide-react';
export function DeviceSetup() {
    const [isOpen, setIsOpen] = useState(false);
    const [deviceInfo, setDeviceInfo] = useState({
        name: '',
        platform: 'ios',
        type: 'mobile'
    });
    const [currentInvitation, setCurrentInvitation] = useState(null);
    const [isCreatingInvitation, setIsCreatingInvitation] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [step, setStep] = useState('form');
    const platformIcons = {
        ios: _jsx(Smartphone, { className: "h-4 w-4" }),
        android: _jsx(Smartphone, { className: "h-4 w-4" }),
        windows: _jsx(Laptop, { className: "h-4 w-4" }),
        macos: _jsx(Monitor, { className: "h-4 w-4" }),
        linux: _jsx(Monitor, { className: "h-4 w-4" }),
        web: _jsx(Monitor, { className: "h-4 w-4" })
    };
    const handleRegisterDevice = async () => {
        if (!deviceInfo.name.trim()) {
            setError('Please enter a device name');
            return;
        }
        setIsRegistering(true);
        setError(null);
        try {
            console.log('[DeviceSetup] Registering device:', deviceInfo);
            // Register device first
            const result = await window.electronAPI.registerDevice(deviceInfo);
            if (!result.success) {
                throw new Error(result.error || 'Failed to register device');
            }
            console.log('[DeviceSetup] Device registered:', result.device);
            // Create invitation for the new device
            await createInvitation();
        }
        catch (error) {
            console.error('[DeviceSetup] Failed to register device:', error);
            setError(error.message);
        }
        finally {
            setIsRegistering(false);
        }
    };
    const createInvitation = async () => {
        setIsCreatingInvitation(true);
        setError(null);
        try {
            console.log('[DeviceSetup] Creating invitation...');
            const result = await window.electronAPI.createInvitation();
            if (!result.success) {
                throw new Error(result.error || 'Failed to create invitation');
            }
            console.log('[DeviceSetup] Invitation created:', result.invitation);
            const invitation = {
                url: result.invitation.url,
                token: result.invitation.token,
                publicKey: result.invitation.publicKey,
                expiresAt: new Date(result.invitation.expiresAt)
            };
            setCurrentInvitation(invitation);
            setStep('invitation');
        }
        catch (error) {
            console.error('[DeviceSetup] Failed to create invitation:', error);
            setError(error.message);
        }
        finally {
            setIsCreatingInvitation(false);
        }
    };
    const copyInvitationLink = async () => {
        if (!currentInvitation)
            return;
        try {
            await navigator.clipboard.writeText(currentInvitation.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch (error) {
            console.error('[DeviceSetup] Failed to copy invitation link:', error);
        }
    };
    const handleClose = () => {
        setIsOpen(false);
        setStep('form');
        setCurrentInvitation(null);
        setError(null);
        setCopied(false);
        setDeviceInfo({
            name: '',
            platform: 'ios',
            type: 'mobile'
        });
    };
    const handlePlatformChange = (platform) => {
        const platformValue = platform;
        setDeviceInfo(prev => ({
            ...prev,
            platform: platformValue,
            type: getPlatformType(platformValue)
        }));
    };
    const getPlatformType = (platform) => {
        switch (platform) {
            case 'ios':
            case 'android':
                return 'mobile';
            case 'windows':
            case 'macos':
            case 'linux':
                return 'desktop';
            case 'web':
                return 'browser';
            default:
                return 'mobile';
        }
    };
    return (_jsxs(Dialog, { open: isOpen, onOpenChange: setIsOpen, children: [_jsx(DialogTrigger, { asChild: true, children: _jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(UserPlus, { className: "h-4 w-4 mr-2" }), "Add Device"] }) }), _jsxs(DialogContent, { className: "sm:max-w-md", children: [step === 'form' && (_jsxs(_Fragment, { children: [_jsxs(DialogHeader, { children: [_jsxs(DialogTitle, { className: "flex items-center gap-2", children: [_jsx(UserPlus, { className: "h-5 w-5" }), "Add New Device"] }), _jsx(DialogDescription, { children: "Register a new device to sync your LAMA messages and settings across multiple devices." })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "device-name", children: "Device Name" }), _jsx(Input, { id: "device-name", placeholder: "e.g., My iPhone, Work Laptop", value: deviceInfo.name, onChange: (e) => setDeviceInfo(prev => ({ ...prev, name: e.target.value })) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "platform", children: "Platform" }), _jsxs(Select, { onValueChange: handlePlatformChange, defaultValue: deviceInfo.platform, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "ios", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Smartphone, { className: "h-4 w-4" }), "iOS (iPhone/iPad)"] }) }), _jsx(SelectItem, { value: "android", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Smartphone, { className: "h-4 w-4" }), "Android"] }) }), _jsx(SelectItem, { value: "windows", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Laptop, { className: "h-4 w-4" }), "Windows"] }) }), _jsx(SelectItem, { value: "macos", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Monitor, { className: "h-4 w-4" }), "macOS"] }) }), _jsx(SelectItem, { value: "linux", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Monitor, { className: "h-4 w-4" }), "Linux"] }) }), _jsx(SelectItem, { value: "web", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Monitor, { className: "h-4 w-4" }), "Web Browser"] }) })] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [platformIcons[deviceInfo.platform], _jsx(Badge, { variant: "outline", children: deviceInfo.type }), _jsx(Badge, { variant: "secondary", children: deviceInfo.platform })] }), error && (_jsxs(Alert, { children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsx(AlertDescription, { children: error })] }))] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: handleClose, children: "Cancel" }), _jsx(Button, { onClick: handleRegisterDevice, disabled: isRegistering || !deviceInfo.name.trim(), children: isRegistering ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "h-4 w-4 mr-2 animate-spin" }), "Registering..."] })) : (_jsxs(_Fragment, { children: [_jsx(UserPlus, { className: "h-4 w-4 mr-2" }), "Register Device"] })) })] })] })), step === 'invitation' && currentInvitation && (_jsxs(_Fragment, { children: [_jsxs(DialogHeader, { children: [_jsxs(DialogTitle, { className: "flex items-center gap-2", children: [_jsx(Wifi, { className: "h-5 w-5" }), "Device Pairing Invitation"] }), _jsx(DialogDescription, { children: "Use this invitation link to pair your new device with this LAMA instance." })] }), _jsxs("div", { className: "space-y-4", children: [_jsx(Card, { children: _jsx(CardContent, { className: "pt-4", children: _jsxs("div", { className: "text-center space-y-4", children: [_jsx("div", { className: "w-32 h-32 mx-auto bg-gray-100 rounded-lg flex items-center justify-center", children: _jsx(QrCode, { className: "h-16 w-16 text-gray-400" }) }), _jsx("p", { className: "text-sm text-muted-foreground", children: "QR Code for easy pairing (coming soon)" })] }) }) }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Invitation Link" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { value: currentInvitation.url, readOnly: true, className: "font-mono text-xs" }), _jsx(Button, { variant: "outline", size: "icon", onClick: copyInvitationLink, children: copied ? _jsx(Check, { className: "h-4 w-4" }) : _jsx(Copy, { className: "h-4 w-4" }) })] }), copied && (_jsx("p", { className: "text-sm text-green-600", children: "Link copied to clipboard!" }))] }), _jsxs(Alert, { children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsx(AlertDescription, { children: "This invitation expires in 15 minutes. Share it securely with your other device." })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: handleClose, children: "Done" }), _jsxs(Button, { onClick: copyInvitationLink, children: [_jsx(Share, { className: "h-4 w-4 mr-2" }), "Share Link"] })] })] }))] })] }));
}
