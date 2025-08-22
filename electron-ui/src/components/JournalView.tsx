import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageView } from './MessageView'
import { type Message } from '@/bridge/lama-bridge'
import { BookOpen } from 'lucide-react'

export function JournalView() {
  const [entries, setEntries] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Load journal entries (which are just messages to self)
    loadJournalEntries()
  }, [])

  const loadJournalEntries = async () => {
    setLoading(true)
    try {
      // Mock data for now - will be replaced with real journal entries
      const mockEntries: Message[] = [
        {
          id: 'journal-1',
          senderId: 'user-1',
          content: 'Started working on the LAMA Electron app today. The architecture is coming together nicely.',
          timestamp: new Date(Date.now() - 86400000),
          encrypted: true
        },
        {
          id: 'journal-2',
          senderId: 'user-1', 
          content: 'Implemented the chat interface with shadcn/ui components. The UI looks clean and modern.',
          timestamp: new Date(Date.now() - 43200000),
          encrypted: true
        },
        {
          id: 'journal-3',
          senderId: 'user-1',
          content: 'Need to integrate the P2P networking layer next. UDP sockets are set up in the main process.',
          timestamp: new Date(Date.now() - 3600000),
          encrypted: true
        }
      ]
      setEntries(mockEntries)
    } finally {
      setLoading(false)
    }
  }

  const handleAddEntry = async (content: string) => {
    const newEntry: Message = {
      id: `journal-${Date.now()}`,
      senderId: 'user-1',
      content,
      timestamp: new Date(),
      encrypted: true
    }
    setEntries(prev => [...prev, newEntry])
    // TODO: Save to persistent storage
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center space-x-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <CardTitle>Journal</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <MessageView
          messages={entries}
          currentUserId="user-1"
          onSendMessage={handleAddEntry}
          placeholder="Write your thoughts..."
          showSender={false}
          loading={loading}
        />
      </CardContent>
    </Card>
  )
}