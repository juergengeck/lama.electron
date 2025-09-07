import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageView } from './MessageView'
import { AppStateJournal } from './AppStateJournal'
import { type Message } from '@/bridge/lama-bridge'
import { BookOpen, FileText, Activity, Shield, Database } from 'lucide-react'

export function JournalView() {
  const [activeTab, setActiveTab] = useState('personal')
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
      <CardContent className="flex-1 flex flex-col p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="personal" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Personal
            </TabsTrigger>
            <TabsTrigger value="state" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              App State
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Sync
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="personal" className="flex-1 flex flex-col mt-0 -mx-4">
            <MessageView
              messages={entries}
              currentUserId="user-1"
              onSendMessage={handleAddEntry}
              placeholder="Write your thoughts..."
              showSender={false}
              loading={loading}
            />
          </TabsContent>
          
          <TabsContent value="state" className="flex-1 mt-0">
            <AppStateJournal />
          </TabsContent>
          
          <TabsContent value="security" className="flex-1 mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Security Journal</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Security events and access logs will appear here</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="data" className="flex-1 mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Data Sync Journal</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">CHUM synchronization events will appear here</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}