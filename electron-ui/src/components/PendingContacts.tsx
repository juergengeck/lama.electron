/**
 * Pending Contacts Component
 * Displays and manages pending contact requests
 */

import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Switch } from './ui/switch'
import { Checkbox } from './ui/checkbox'
import { Avatar, AvatarFallback } from './ui/avatar'
import { ScrollArea } from './ui/scroll-area'
import { Badge } from './ui/badge'
import { Shield, MessageSquare, Phone, File, Eye, Clock, CheckCircle, XCircle } from 'lucide-react'

interface PendingContact {
  id: string
  displayInfo: {
    name: string
    personId: string
    instanceId: string
    capabilities: string[]
    publicKey: string
    issuer: string
    expiresAt: number
  }
  receivedAt: number
}

interface ContactOptions {
  nickname?: string
  groups?: string[]
  tags?: string[]
  notes?: string
  canMessage?: boolean
  canCall?: boolean
  canShareFiles?: boolean
  canSeePresence?: boolean
}

export function PendingContacts() {
  const [pendingContacts, setPendingContacts] = useState<PendingContact[]>([])
  const [selectedContact, setSelectedContact] = useState<PendingContact | null>(null)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Contact options for acceptance
  const [contactOptions, setContactOptions] = useState<ContactOptions>({
    canMessage: true,
    canCall: false,
    canShareFiles: false,
    canSeePresence: true
  })

  // Load pending contacts
  useEffect(() => {
    loadPendingContacts()
    
    // Listen for new pending contacts
    const handleNewPending = (data: any) => {
      loadPendingContacts()
    }
    
    const handleContactAccepted = (data: any) => {
      // Remove from pending list
      setPendingContacts(prev => prev.filter(c => c.id !== data.pendingId))
    }
    
    window.electronAPI?.on('contacts:pending:new', handleNewPending)
    window.electronAPI?.on('contacts:accepted', handleContactAccepted)
    
    return () => {
      window.electronAPI?.removeListener('contacts:pending:new', handleNewPending)
      window.electronAPI?.removeListener('contacts:accepted', handleContactAccepted)
    }
  }, [])

  const loadPendingContacts = async () => {
    try {
      const result = await window.electronAPI?.invoke('contacts:pending:list')
      if (result?.success) {
        setPendingContacts(result.pendingContacts || [])
      }
    } catch (error) {
      console.error('Failed to load pending contacts:', error)
    }
  }

  const handleReview = (contact: PendingContact) => {
    setSelectedContact(contact)
    setContactOptions({
      nickname: contact.displayInfo.name,
      canMessage: true,
      canCall: false,
      canShareFiles: false,
      canSeePresence: true
    })
    setReviewDialogOpen(true)
  }

  const handleAccept = async () => {
    if (!selectedContact) return
    
    setIsLoading(true)
    try {
      const result = await window.electronAPI?.invoke('contacts:pending:accept', selectedContact.id, contactOptions)
      if (result?.success) {
        setPendingContacts(prev => prev.filter(c => c.id !== selectedContact.id))
        setReviewDialogOpen(false)
        setSelectedContact(null)
      } else {
        console.error('Failed to accept contact:', result?.error)
      }
    } catch (error) {
      console.error('Failed to accept contact:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReject = async (reason?: string) => {
    if (!selectedContact) return
    
    setIsLoading(true)
    try {
      const result = await window.electronAPI?.invoke('contacts:pending:reject', selectedContact.id, reason || 'User rejected')
      if (result?.success) {
        setPendingContacts(prev => prev.filter(c => c.id !== selectedContact.id))
        setReviewDialogOpen(false)
        setSelectedContact(null)
      } else {
        console.error('Failed to reject contact:', result?.error)
      }
    } catch (error) {
      console.error('Failed to reject contact:', error)
    } finally {
      setIsLoading(false)
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

  if (pendingContacts.length === 0) {
    return null
  }

  return (
    <>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Pending Contact Requests
            <Badge variant="secondary">{pendingContacts.length}</Badge>
          </CardTitle>
          <CardDescription>
            Review and accept or reject contact requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {pendingContacts.map(contact => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {contact.displayInfo.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{contact.displayInfo.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatPersonId(contact.displayInfo.personId)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {getTimeAgo(contact.receivedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReview(contact)}
                  >
                    Review
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Contact Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Contact Request</DialogTitle>
            <DialogDescription>
              Review the contact details and configure permissions before accepting
            </DialogDescription>
          </DialogHeader>
          
          {selectedContact && (
            <div className="space-y-4">
              {/* Contact Info */}
              <div className="space-y-2">
                <h3 className="font-semibold">Contact Information</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-mono">{selectedContact.displayInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Person ID:</span>
                    <span className="font-mono text-xs">{formatPersonId(selectedContact.displayInfo.personId)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Instance ID:</span>
                    <span className="font-mono text-xs">{formatPersonId(selectedContact.displayInfo.instanceId)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capabilities:</span>
                    <div className="flex gap-1">
                      {selectedContact.displayInfo.capabilities.map(cap => (
                        <Badge key={cap} variant="secondary" className="text-xs">
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Nickname */}
              <div className="space-y-2">
                <Label htmlFor="nickname">Nickname (optional)</Label>
                <Input
                  id="nickname"
                  value={contactOptions.nickname || ''}
                  onChange={(e) => setContactOptions(prev => ({ ...prev, nickname: e.target.value }))}
                  placeholder="Enter a nickname for this contact"
                />
              </div>

              {/* Permissions */}
              <div className="space-y-2">
                <h3 className="font-semibold">Permissions</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      <Label htmlFor="can-message">Can send messages</Label>
                    </div>
                    <Switch
                      id="can-message"
                      checked={contactOptions.canMessage}
                      onCheckedChange={(checked) => setContactOptions(prev => ({ ...prev, canMessage: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <Label htmlFor="can-call">Can make calls</Label>
                    </div>
                    <Switch
                      id="can-call"
                      checked={contactOptions.canCall}
                      onCheckedChange={(checked) => setContactOptions(prev => ({ ...prev, canCall: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4" />
                      <Label htmlFor="can-share-files">Can share files</Label>
                    </div>
                    <Switch
                      id="can-share-files"
                      checked={contactOptions.canShareFiles}
                      onCheckedChange={(checked) => setContactOptions(prev => ({ ...prev, canShareFiles: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <Label htmlFor="can-see-presence">Can see presence</Label>
                    </div>
                    <Switch
                      id="can-see-presence"
                      checked={contactOptions.canSeePresence}
                      onCheckedChange={(checked) => setContactOptions(prev => ({ ...prev, canSeePresence: checked }))}
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  value={contactOptions.notes || ''}
                  onChange={(e) => setContactOptions(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any notes about this contact"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleReject()}
              disabled={isLoading}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={handleAccept}
              disabled={isLoading}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Accept Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}