import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Users, UserPlus, Search, Circle, Bot, MessageSquare, Download, CheckCircle, User, Edit } from 'lucide-react'
import { useLama } from '@/hooks/useLama'
import { ProfileDialog } from './ProfileDialog'

interface ContactsViewProps {
  onNavigateToChat?: (topicId: string, contactName: string) => void
}

export function ContactsView({ onNavigateToChat }: ContactsViewProps) {
  const { bridge } = useLama()
  const [contacts, setContacts] = useState<any[]>([])
  const [ownerContact, setOwnerContact] = useState<any | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [creatingTopic, setCreatingTopic] = useState<string | null>(null)
  const [loadingModel, setLoadingModel] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [profileDialogRequired, setProfileDialogRequired] = useState(false)

  useEffect(() => {
    loadContacts()
    
    // Listen for contact updates
    const handleContactsUpdated = () => {
      console.log('[ContactsView] Contacts updated event received')
      loadContacts()
    }
    
    // Listen for IPC contact added events from Node.js
    const handleContactAdded = () => {
      console.log('[ContactsView] Contact added via IPC')
      loadContacts()
    }
    
    window.addEventListener('contacts:updated', handleContactsUpdated)
    
    // Listen for IPC events if in Electron
    if (window.electronAPI?.on) {
      window.electronAPI.on('contact:added', handleContactAdded)
    }
    
    // Also refresh contacts periodically
    const interval = setInterval(loadContacts, 5000)
    
    return () => {
      window.removeEventListener('contacts:updated', handleContactsUpdated)
      clearInterval(interval)
    }
  }, [bridge])

  const loadContacts = async () => {
    if (!bridge) return

    setLoading(true)
    try {
      // Get real contacts from AppModel
      const allContacts = await bridge.getContacts()
      console.log('[ContactsView] Loaded contacts:', allContacts)
      console.log('[ContactsView] Contact count:', allContacts?.length)
      allContacts?.forEach((c, i) => {
        console.log(`[ContactsView]   Contact ${i}: ${c.name || c.displayName} (${c.id?.substring(0, 8)}...) status=${c.status}`)
      })

      // Separate owner from other contacts
      const owner = (allContacts || []).find(c => c.status === 'owner')
      const nonOwnerContacts = (allContacts || []).filter(c => c.status !== 'owner')

      setOwnerContact(owner || null)

      // Enrich AI contacts with model information
      const enrichedContacts = await Promise.all(
        nonOwnerContacts.map(async (contact) => {
          if (contact.isAI) {
            try {
              // Get all models
              const models = await bridge.getAvailableModels()

              // Find the model for this AI contact by matching the contact name to model ID
              const contactModel = models.find(m =>
                m.id === contact.name ||
                m.name === contact.name ||
                contact.name?.includes(m.id) ||
                m.id?.includes(contact.name)
              )

              console.log(`[ContactsView] AI contact ${contact.name} matched to model:`, contactModel)

              // Merge model info into contact
              return {
                ...contact,
                modelInfo: contactModel
              }
            } catch (error) {
              console.error(`[ContactsView] Failed to get model info for ${contact.name}:`, error)
              return contact
            }
          }
          return contact
        })
      )

      setContacts(enrichedContacts)
    } finally {
      setLoading(false)
    }
  }

  const filteredContacts = contacts.filter(contact => {
    const name = contact.name || contact.displayName || ''
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-500'
      case 'connecting': return 'text-yellow-500'
      case 'disconnected': return 'text-gray-500'
      default: return 'text-gray-500'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected': return 'Online'
      case 'connecting': return 'Connecting...'
      case 'disconnected': return 'Offline'
      default: return 'Unknown'
    }
  }

  const handleMessageClick = async (contact: any) => {
    console.log('[ContactsView] Message clicked for contact:', contact)
    
    if (!bridge) {
      console.error('[ContactsView] Bridge not available')
      return
    }
    
    // Set loading state for this contact
    setCreatingTopic(contact.id)
    
    try {
      // Get or create topic for this contact
      const topicId = await bridge.getOrCreateTopicForContact(contact.id)
      
      if (topicId) {
        console.log('[ContactsView] Navigating to chat with topic:', topicId)
        // Call the navigation callback if provided, including contact name
        if (onNavigateToChat) {
          const contactName = contact.displayName || contact.name || 'Unknown'
          onNavigateToChat(topicId, contactName)
        } else {
          console.warn('[ContactsView] No navigation handler provided')
        }
      } else {
        console.error('[ContactsView] Failed to create topic for contact')
      }
    } catch (error) {
      console.error('[ContactsView] Error creating topic:', error)
    } finally {
      setCreatingTopic(null)
    }
  }

  const handleLoadModel = async (contact: any) => {
    if (!contact.modelInfo || !bridge) return

    setLoadingModel(contact.id)
    try {
      console.log(`[ContactsView] Loading model: ${contact.modelInfo.id}`)
      const success = await bridge.loadModel(contact.modelInfo.id)
      if (success) {
        // Reload contacts to update model status
        await loadContacts()
      }
    } catch (error) {
      console.error('[ContactsView] Failed to load model:', error)
    } finally {
      setLoadingModel(null)
    }
  }

  const handleAddContact = async () => {
    try {
      if (!window.electronAPI) {
        alert('Electron API not available')
        return
      }

      // Check if user has a PersonName set
      const nameCheck = await window.electronAPI.invoke('onecore:hasPersonName')

      if (!nameCheck.success || !nameCheck.hasName) {
        // No name set - show dialog as required
        console.log('[ContactsView] No PersonName set, showing required dialog')
        setProfileDialogRequired(true)
        setProfileDialogOpen(true)
        return
      }

      // Name is set, proceed with invitation
      await createInvitation()
    } catch (error: any) {
      console.error('[ContactsView] Failed to create invitation:', error)
      alert(error.message || 'Failed to create invitation')
    }
  }

  const createInvitation = async () => {
    try {
      // Use 'invitation:create' from devices handler (has better error handling)
      const result = await window.electronAPI.invoke('invitation:create')

      if (result.success && result.invitation) {
        // Copy invitation URL to clipboard
        await navigator.clipboard.writeText(result.invitation.url)
        alert('Invitation link copied to clipboard! Share it with your contact.')
      } else {
        alert(result.error || 'Failed to create invitation')
      }
    } catch (error: any) {
      console.error('[ContactsView] Failed to create invitation:', error)
      alert(error.message || 'Failed to create invitation')
    }
  }

  const handleProfileSaved = () => {
    // Reload contacts to get updated owner name
    loadContacts()

    // If this was required for adding a contact, proceed with invitation
    if (profileDialogRequired) {
      setProfileDialogRequired(false)
      createInvitation()
    }
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* My Profile Card */}
      {ownerContact && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>My Profile</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setProfileDialogRequired(false)
                  setProfileDialogOpen(true)
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback style={{ backgroundColor: ownerContact.color }}>
                  {(ownerContact.displayName || ownerContact.name || 'ME').substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{ownerContact.displayName || ownerContact.name || 'Set your name'}</p>
                <p className="text-sm text-muted-foreground">{ownerContact.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Add Contact */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Contacts</CardTitle>
            </div>
            <Button size="sm" onClick={handleAddContact}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contacts List */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="p-4 space-y-2 max-h-[calc(100vh-300px)]">
              {filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No contacts found</p>
                  <p className="text-sm mt-2">Add contacts to start messaging</p>
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <Card key={contact.id} className="hover:bg-accent transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar>
                            <AvatarFallback className={contact.isAI ? 'bg-purple-100 dark:bg-purple-900' : ''}>
                              {contact.isAI ? (
                                <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                              ) : (
                                (contact.displayName || contact.name || 'UN').substring(0, 2).toUpperCase()
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium truncate">{contact.displayName || contact.name || 'Unknown'}</span>
                              <Badge 
                                variant={contact.isAI ? "secondary" : "outline"} 
                                className="text-xs flex-shrink-0"
                              >
                                {contact.isAI ? 'AI' : 'P2P'}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <Circle className={`h-2 w-2 fill-current ${
                                contact.isAI
                                  ? (contact.modelInfo?.isLoaded ? 'text-green-500' : 'text-yellow-500')
                                  : getStatusColor(contact.status)
                              }`} />
                              <span className="text-xs text-muted-foreground truncate">
                                {contact.isAI
                                  ? (contact.modelInfo?.isLoaded ? 'Ready' : 'Not Loaded')
                                  : getStatusLabel(contact.status)}
                              </span>
                              {contact.lastSeen && !contact.isAI && (
                                <span className="text-xs text-muted-foreground">
                                  · Last seen {new Date(contact.lastSeen).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {/* Debug logging for button rendering */}
                          {contact.isAI && (() => {
                            console.log(`[ContactsView] Rendering buttons for ${contact.name}:`, {
                              isAI: contact.isAI,
                              hasModelInfo: !!contact.modelInfo,
                              modelType: contact.modelInfo?.modelType,
                              isLoaded: contact.modelInfo?.isLoaded
                            })
                            return null
                          })()}

                          {/* For AI contacts with local models that aren't loaded, show Load button */}
                          {contact.isAI && contact.modelInfo?.modelType === 'local' && !contact.modelInfo?.isLoaded && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleLoadModel(contact)
                              }}
                              disabled={loadingModel === contact.id}
                            >
                              {loadingModel === contact.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-1" />
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <Download className="h-3 w-3 mr-1" />
                                  Load Model
                                </>
                              )}
                            </Button>
                          )}
                          {/* For loaded models or remote API models, show Ready badge */}
                          {contact.isAI && (contact.modelInfo?.isLoaded || contact.modelInfo?.modelType === 'remote') && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Ready
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMessageClick(contact)}
                            disabled={creatingTopic === contact.id}
                          >
                            {creatingTopic === contact.id ? (
                              <>Creating chat...</>
                            ) : (
                              <>
                                <MessageSquare className="h-4 w-4 mr-1" />
                                Message
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Profile Dialog */}
      <ProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        currentName={ownerContact?.displayName || ownerContact?.name || ''}
        required={profileDialogRequired}
        onSave={handleProfileSaved}
      />
    </div>
  )
}