/**
 * Contact Trust Status Component
 * Shows trust level and allows user to accept/reject discovered contacts
 */

import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Avatar, AvatarFallback } from './ui/avatar'
import { ScrollArea } from './ui/scroll-area'
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldOff,
  UserCheck,
  UserX,
  Clock,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'

interface Contact {
  personId: string
  name: string
  trustLevel: 'discovered' | 'pending' | 'accepted' | 'trusted' | 'blocked'
  discoverySource: string
  discoveredAt: number
  acceptedAt?: number
  isConnected: boolean
  canMessage: boolean
  canSync: boolean
  vcHash?: string
}

export function ContactTrustStatus() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadContacts()
    
    // Listen for contact discovery events
    const handleContactDiscovered = (data: any) => {
      loadContacts()
    }
    
    const handleContactAccepted = (data: any) => {
      loadContacts()
    }
    
    window.electronAPI?.on('contact-discovered', handleContactDiscovered)
    window.electronAPI?.on('contact-accepted-by-peer', handleContactAccepted)
    
    return () => {
      window.electronAPI?.removeListener('contact-discovered', handleContactDiscovered)
      window.electronAPI?.removeListener('contact-accepted-by-peer', handleContactAccepted)
    }
  }, [])

  const loadContacts = async () => {
    try {
      // Get all contacts with their trust status
      const result = await window.electronAPI?.invoke('contacts:list-with-trust')
      if (result?.success) {
        setContacts(result.contacts || [])
      }
    } catch (error) {
      console.error('Failed to load contacts:', error)
    }
  }

  const handleAcceptContact = async (personId: string) => {
    setIsLoading(true)
    try {
      const result = await window.electronAPI?.invoke('contacts:accept', personId, {
        canMessage: true,
        canShareChannels: true,
        canSyncData: true,
        canSeePresence: true
      })
      if (result?.success) {
        await loadContacts()
      }
    } catch (error) {
      console.error('Failed to accept contact:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBlockContact = async (personId: string) => {
    setIsLoading(true)
    try {
      const result = await window.electronAPI?.invoke('contacts:block', personId, 'User blocked')
      if (result?.success) {
        await loadContacts()
      }
    } catch (error) {
      console.error('Failed to block contact:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getTrustIcon = (trustLevel: string) => {
    switch (trustLevel) {
      case 'discovered':
        return <Shield className="h-4 w-4 text-yellow-500" />
      case 'pending':
        return <ShieldAlert className="h-4 w-4 text-orange-500" />
      case 'accepted':
        return <ShieldCheck className="h-4 w-4 text-green-500" />
      case 'trusted':
        return <ShieldCheck className="h-4 w-4 text-blue-500" />
      case 'blocked':
        return <ShieldOff className="h-4 w-4 text-red-500" />
      default:
        return <Shield className="h-4 w-4 text-gray-500" />
    }
  }

  const getTrustBadgeVariant = (trustLevel: string) => {
    switch (trustLevel) {
      case 'discovered':
        return 'secondary'
      case 'accepted':
        return 'default'
      case 'trusted':
        return 'default'
      case 'blocked':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const formatPersonId = (id: string) => {
    return id.substring(0, 8) + '...' + id.substring(id.length - 8)
  }

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  // Group contacts by trust level
  const discoveredContacts = contacts.filter(c => c.trustLevel === 'discovered')
  const acceptedContacts = contacts.filter(c => c.trustLevel === 'accepted' || c.trustLevel === 'trusted')
  const blockedContacts = contacts.filter(c => c.trustLevel === 'blocked')

  return (
    <div className="space-y-4">
      {/* Discovered Contacts */}
      {discoveredContacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Discovered Contacts
              <Badge variant="secondary">{discoveredContacts.length}</Badge>
            </CardTitle>
            <CardDescription>
              Contacts discovered via QUIC-VC that need your approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {discoveredContacts.map(contact => (
                  <div
                    key={contact.personId}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {contact.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{contact.name}</span>
                          {getTrustIcon(contact.trustLevel)}
                          {contact.isConnected ? (
                            <Wifi className="h-3 w-3 text-green-500" />
                          ) : (
                            <WifiOff className="h-3 w-3 text-gray-400" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatPersonId(contact.personId)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {contact.discoverySource}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {getTimeAgo(contact.discoveredAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBlockContact(contact.personId)}
                        disabled={isLoading}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAcceptContact(contact.personId)}
                        disabled={isLoading}
                      >
                        <UserCheck className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Accepted Contacts */}
      {acceptedContacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Accepted Contacts
              <Badge>{acceptedContacts.length}</Badge>
            </CardTitle>
            <CardDescription>
              Contacts you can communicate and sync with
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {acceptedContacts.map(contact => (
                  <div
                    key={contact.personId}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {contact.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{contact.name}</span>
                          {getTrustIcon(contact.trustLevel)}
                          {contact.isConnected ? (
                            <Wifi className="h-3 w-3 text-green-500" />
                          ) : (
                            <WifiOff className="h-3 w-3 text-gray-400" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatPersonId(contact.personId)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={getTrustBadgeVariant(contact.trustLevel)} className="text-xs">
                            {contact.trustLevel}
                          </Badge>
                          {contact.canMessage && (
                            <Badge variant="outline" className="text-xs">
                              Messages
                            </Badge>
                          )}
                          {contact.canSync && (
                            <Badge variant="outline" className="text-xs">
                              Sync
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {contact.acceptedAt && (
                        <span>
                          Accepted {getTimeAgo(contact.acceptedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Blocked Contacts */}
      {blockedContacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Blocked Contacts
              <Badge variant="destructive">{blockedContacts.length}</Badge>
            </CardTitle>
            <CardDescription>
              Contacts you have blocked from communication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {blockedContacts.map(contact => (
                <div
                  key={contact.personId}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {contact.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium line-through">{contact.name}</span>
                        {getTrustIcon(contact.trustLevel)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatPersonId(contact.personId)}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAcceptContact(contact.personId)}
                    disabled={isLoading}
                  >
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}