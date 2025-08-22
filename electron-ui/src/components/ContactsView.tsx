import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Users, UserPlus, Search, Circle, Bot, MessageSquare } from 'lucide-react'
import { useLama } from '@/hooks/useLama'

interface ContactsViewProps {
  onNavigateToChat?: (topicId: string, contactName: string) => void
}

export function ContactsView({ onNavigateToChat }: ContactsViewProps) {
  const { bridge } = useLama()
  const [contacts, setContacts] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [creatingTopic, setCreatingTopic] = useState<string | null>(null)

  useEffect(() => {
    loadContacts()
    // Refresh contacts periodically
    const interval = setInterval(loadContacts, 5000)
    return () => clearInterval(interval)
  }, [bridge])

  const loadContacts = async () => {
    if (!bridge) return
    
    setLoading(true)
    try {
      // Get real contacts from AppModel
      const allContacts = await bridge.getContacts()
      setContacts(allContacts || [])
    } finally {
      setLoading(false)
    }
  }

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Search and Add Contact */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Contacts</CardTitle>
            </div>
            <Button size="sm">
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
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
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
                            <AvatarFallback>
                              {contact.isAI ? (
                                <Bot className="h-5 w-5" />
                              ) : (
                                contact.name.substring(0, 2).toUpperCase()
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{contact.displayName || contact.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {contact.isAI ? 'AI' : 'P2P'}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <Circle className={`h-2 w-2 fill-current ${getStatusColor(contact.status)}`} />
                              <span className="text-xs text-muted-foreground">
                                {getStatusLabel(contact.status)}
                              </span>
                              {contact.lastSeen && (
                                <span className="text-xs text-muted-foreground">
                                  · Last seen {new Date(contact.lastSeen).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
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
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}