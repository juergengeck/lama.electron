/**
 * Login/Deploy Component
 * Enter credentials to either login to existing instance or deploy new one
 * Security through obscurity - credentials determine the instance
 */

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, User, Lock } from 'lucide-react'
import initFlow from '../services/init-flow.ts.js'

interface LoginDeployProps {
  onLogin: (username: string, password: string) => Promise<void>
}

export function LoginDeploy({ onLogin }: LoginDeployProps) {
  // Demo user credentials prefilled
  const [username, setUsername] = useState('demo')
  const [password, setPassword] = useState('demo')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!username || !password) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      // Use the provided login function
      await onLogin(username, password)
      console.log('[LoginDeploy] Login successful')
    } catch (error: any) {
      console.error('[LoginDeploy] Login failed:', error)
      setError(error.message || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <Card className="w-full max-w-sm border-0 shadow-2xl">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold">LAMA</h1>
              <p className="text-xs text-gray-500 mt-2">
                Enter credentials to access or deploy
              </p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                  autoFocus
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !username || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                'Enter'
              )}
            </Button>
            
            {error && (
              <div className="mt-4 text-sm text-red-500 text-center">
                {error}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}