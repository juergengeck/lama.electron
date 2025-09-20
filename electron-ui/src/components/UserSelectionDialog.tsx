import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { User, Search, Loader2 } from 'lucide-react'

interface Contact {
  id: string
  name: string
  personId?: string
  isConnected?: boolean
  canMessage?: boolean
}

interface UserSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (selectedUserIds: string[]) => void
  title?: string
  description?: string
  excludeUserIds?: string[]
}

export function UserSelectionDialog({
  open,
  onOpenChange,
  onSubmit,
  title = "Add Users",
  description = "Select users to add to the conversation",
  excludeUserIds = []
}: UserSelectionDialogProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])

  // Load contacts when dialog opens
  useEffect(() => {
    if (open) {
      loadContacts()
      setSelectedUserIds([])
      setSearchQuery('')
    }
  }, [open])

  const loadContacts = async () => {
    setLoading(true)
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available')
      }

      const result = await window.electronAPI.invoke('contacts:list')
      if (!result.success) {
        throw new Error(result.error || 'Failed to load contacts')
      }

      // Transform contacts to UI format and filter out excluded users
      const contactList = (result.contacts || [])
        .filter((contact: any) => {
          // Exclude users already in the conversation
          const userId = contact.personId || contact.id
          return !excludeUserIds.includes(userId)
        })
        .map((contact: any) => ({
          id: contact.id,
          name: contact.name || `Contact ${contact.id.substring(0, 8)}...`,
          personId: contact.personId,
          isConnected: contact.isConnected || false,
          canMessage: contact.canMessage !== false // Default to true if not specified
        }))

      setContacts(contactList)
      console.log('[UserSelectionDialog] Loaded contacts:', contactList.length)
    } catch (error) {
      console.error('[UserSelectionDialog] Failed to load contacts:', error)
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  // Filter contacts based on search query
  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleUserToggle = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSubmit = () => {
    if (selectedUserIds.length === 0) {
      return
    }

    // Use personId if available, otherwise use contact id
    const participantIds = selectedUserIds.map(userId => {
      const contact = contacts.find(c => c.id === userId)
      return contact?.personId || userId
    })

    onSubmit(participantIds)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Contact list */}
          <ScrollArea className="h-64 border rounded-md">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Loading contacts...</span>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <User className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">
                  {searchQuery ? 'No matching contacts found' : 'No contacts available'}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => handleUserToggle(contact.id)}
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(contact.id)}
                      onCheckedChange={() => handleUserToggle(contact.id)}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{contact.name}</span>
                      </div>

                      <div className="flex items-center space-x-2 mt-1">
                        {contact.isConnected && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                            Connected
                          </span>
                        )}
                        {!contact.canMessage && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">
                            Limited
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected count */}
          {selectedUserIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedUserIds.length} user{selectedUserIds.length === 1 ? '' : 's'} selected
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedUserIds.length === 0}
          >
            Add {selectedUserIds.length > 0 ? `${selectedUserIds.length} ` : ''}User{selectedUserIds.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}