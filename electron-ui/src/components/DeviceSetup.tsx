/**
 * Device Setup Component
 * Handles registration of new devices and pairing
 */

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
import {
  QrCode,
  Smartphone,
  Laptop,
  Tablet,
  Monitor,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  UserPlus,
  Wifi,
  Share
} from 'lucide-react'

interface DeviceInfo {
  name: string
  platform: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'web'
  type: 'mobile' | 'desktop' | 'tablet' | 'browser'
}

interface PairingInvitation {
  url: string
  token: string
  publicKey: string
  expiresAt: Date
}

export function DeviceSetup() {
  const [isOpen, setIsOpen] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    name: '',
    platform: 'ios',
    type: 'mobile'
  })
  const [currentInvitation, setCurrentInvitation] = useState<PairingInvitation | null>(null)
  const [isCreatingInvitation, setIsCreatingInvitation] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [step, setStep] = useState<'form' | 'invitation'>('form')

  const platformIcons = {
    ios: <Smartphone className="h-4 w-4" />,
    android: <Smartphone className="h-4 w-4" />,
    windows: <Laptop className="h-4 w-4" />,
    macos: <Monitor className="h-4 w-4" />,
    linux: <Monitor className="h-4 w-4" />,
    web: <Monitor className="h-4 w-4" />
  }

  const handleRegisterDevice = async () => {
    if (!deviceInfo.name.trim()) {
      setError('Please enter a device name')
      return
    }

    setIsRegistering(true)
    setError(null)

    try {
      console.log('[DeviceSetup] Registering device:', deviceInfo)
      
      // Register device first
      const result = await window.electronAPI.registerDevice(deviceInfo)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to register device')
      }
      
      console.log('[DeviceSetup] Device registered:', result.device)
      
      // Create invitation for the new device
      await createInvitation()
      
    } catch (error) {
      console.error('[DeviceSetup] Failed to register device:', error)
      setError(error.message)
    } finally {
      setIsRegistering(false)
    }
  }

  const createInvitation = async () => {
    setIsCreatingInvitation(true)
    setError(null)
    
    try {
      console.log('[DeviceSetup] Creating invitation...')
      
      const result = await window.electronAPI.createInvitation()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create invitation')
      }
      
      console.log('[DeviceSetup] Invitation created:', result.invitation)
      
      const invitation: PairingInvitation = {
        url: result.invitation.url,
        token: result.invitation.token,
        publicKey: result.invitation.publicKey,
        expiresAt: new Date(result.invitation.expiresAt)
      }
      
      setCurrentInvitation(invitation)
      setStep('invitation')
      
    } catch (error) {
      console.error('[DeviceSetup] Failed to create invitation:', error)
      setError(error.message)
    } finally {
      setIsCreatingInvitation(false)
    }
  }

  const copyInvitationLink = async () => {
    if (!currentInvitation) return
    
    try {
      await navigator.clipboard.writeText(currentInvitation.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('[DeviceSetup] Failed to copy invitation link:', error)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setStep('form')
    setCurrentInvitation(null)
    setError(null)
    setCopied(false)
    setDeviceInfo({
      name: '',
      platform: 'ios',
      type: 'mobile'
    })
  }

  const handlePlatformChange = (platform: string) => {
    const platformValue = platform as DeviceInfo['platform']
    setDeviceInfo(prev => ({
      ...prev,
      platform: platformValue,
      type: getPlatformType(platformValue)
    }))
  }

  const getPlatformType = (platform: DeviceInfo['platform']): DeviceInfo['type'] => {
    switch (platform) {
      case 'ios':
      case 'android':
        return 'mobile'
      case 'windows':
      case 'macos':
      case 'linux':
        return 'desktop'
      case 'web':
        return 'browser'
      default:
        return 'mobile'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Device
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add New Device
              </DialogTitle>
              <DialogDescription>
                Register a new device to sync your LAMA messages and settings across multiple devices.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="device-name">Device Name</Label>
                <Input
                  id="device-name"
                  placeholder="e.g., My iPhone, Work Laptop"
                  value={deviceInfo.name}
                  onChange={(e) => setDeviceInfo(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select onValueChange={handlePlatformChange} defaultValue={deviceInfo.platform}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ios">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        iOS (iPhone/iPad)
                      </div>
                    </SelectItem>
                    <SelectItem value="android">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        Android
                      </div>
                    </SelectItem>
                    <SelectItem value="windows">
                      <div className="flex items-center gap-2">
                        <Laptop className="h-4 w-4" />
                        Windows
                      </div>
                    </SelectItem>
                    <SelectItem value="macos">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        macOS
                      </div>
                    </SelectItem>
                    <SelectItem value="linux">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        Linux
                      </div>
                    </SelectItem>
                    <SelectItem value="web">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        Web Browser
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                {platformIcons[deviceInfo.platform]}
                <Badge variant="outline">{deviceInfo.type}</Badge>
                <Badge variant="secondary">{deviceInfo.platform}</Badge>
              </div>
              
              {error && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button 
                onClick={handleRegisterDevice} 
                disabled={isRegistering || !deviceInfo.name.trim()}
              >
                {isRegistering ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Register Device
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
        
        {step === 'invitation' && currentInvitation && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Device Pairing Invitation
              </DialogTitle>
              <DialogDescription>
                Use this invitation link to pair your new device with this LAMA instance.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center space-y-4">
                    <div className="w-32 h-32 mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                      <QrCode className="h-16 w-16 text-gray-400" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      QR Code for easy pairing (coming soon)
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <div className="space-y-2">
                <Label>Invitation Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={currentInvitation.url}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={copyInvitationLink}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {copied && (
                  <p className="text-sm text-green-600">Link copied to clipboard!</p>
                )}
              </div>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This invitation expires in 15 minutes. Share it securely with your other device.
                </AlertDescription>
              </Alert>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Done</Button>
              <Button onClick={copyInvitationLink}>
                <Share className="h-4 w-4 mr-2" />
                Share Link
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}