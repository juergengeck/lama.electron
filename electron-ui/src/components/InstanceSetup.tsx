/**
 * Instance Setup Component
 * Asks user for Node.js instance name and initializes both ONE.core instances
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface InstanceSetupProps {
  onComplete: (nodeInstance: string, browserInstance: string) => void
}

export function InstanceSetup({ onComplete }: InstanceSetupProps) {
  const [instanceName, setInstanceName] = useState('')
  const [password, setPassword] = useState('')
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')

  const handleSetup = async () => {
    if (!instanceName.trim() || !password.trim()) {
      setError('Please provide both instance name and password')
      return
    }

    setIsInitializing(true)
    setError(null)
    
    try {
      // Node.js instance name as provided
      const nodeName = instanceName.trim()
      // Browser instance with -ui suffix
      const browserName = `${nodeName}-ui`
      
      setStatus('Initializing Node.js ONE.core instance...')
      
      // Initialize Node.js ONE.core
      if (window.electronAPI) {
        const nodeResult = await window.electronAPI.invoke('onecore:initializeNode', {
          name: nodeName,
          password
        })
        
        if (!nodeResult.success) {
          throw new Error(nodeResult.error || 'Failed to initialize Node instance')
        }
        
        console.log('[InstanceSetup] Node initialized:', nodeResult)
      }
      
      setStatus('Initializing Browser ONE.core instance...')
      
      // Initialize Browser ONE.core
      const { realBrowserInstance } = await import('@/services/real-browser-instance')
      await realBrowserInstance.initialize()
      
      // Login or create browser instance
      try {
        await realBrowserInstance.login(browserName, password)
        console.log('[InstanceSetup] Browser logged in as:', browserName)
      } catch (error) {
        // If login fails, create new
        await realBrowserInstance.createPerson(browserName, password)
        console.log('[InstanceSetup] Browser created new identity:', browserName)
      }
      
      setStatus('Setting up Internet of Me connection...')
      
      // Create invite from Node and accept in Browser
      if (window.electronAPI) {
        const inviteResult = await window.electronAPI.invoke('onecore:createLocalInvite', {
          name: browserName,
          description: `Browser UI for ${nodeName}`
        })
        
        if (inviteResult.success && inviteResult.invite) {
          console.log('[InstanceSetup] Direct connection invite created:', inviteResult.invite)
          
          // Direct connection handling is done automatically by CHUM
          console.log('[InstanceSetup] Direct connection established via CHUM!')
        }
      }
      
      setStatus('Setup complete!')
      
      // Notify parent component
      setTimeout(() => {
        onComplete(nodeName, browserName)
      }, 1000)
      
    } catch (error: any) {
      console.error('[InstanceSetup] Setup failed:', error)
      setError(error.message || 'Setup failed')
      setIsInitializing(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>LAMA Setup</CardTitle>
          <CardDescription>
            Initialize your ONE.core instances for secure, decentralized messaging
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instance-name">Instance Name</Label>
            <Input
              id="instance-name"
              placeholder="e.g., gecko"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              disabled={isInitializing}
            />
            <p className="text-xs text-muted-foreground">
              Node.js: {instanceName || '...'} | Browser: {instanceName ? `${instanceName}-ui` : '...'}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Strong password for both instances"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isInitializing}
              onKeyDown={(e) => e.key === 'Enter' && handleSetup()}
            />
          </div>
          
          {error && (
            <div className="text-sm text-red-500">
              {error}
            </div>
          )}
          
          {status && isInitializing && (
            <div className="text-sm text-muted-foreground">
              {status}
            </div>
          )}
          
          <Button 
            onClick={handleSetup} 
            disabled={isInitializing || !instanceName.trim() || !password.trim()}
            className="w-full"
          >
            {isInitializing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              'Initialize Instances'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}