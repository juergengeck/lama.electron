import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User } from 'lucide-react'

interface ProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName?: string
  required?: boolean
  onSave?: () => void
}

export function ProfileDialog({
  open,
  onOpenChange,
  currentName = '',
  required = false,
  onSave
}: ProfileDialogProps) {
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(currentName)
  }, [currentName])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name cannot be empty')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const result = await window.electronAPI.invoke('onecore:setPersonName', { name: name.trim() })

      if (result.success) {
        console.log('[ProfileDialog] PersonName saved successfully')
        onOpenChange(false)
        if (onSave) {
          onSave()
        }
      } else {
        setError(result.error || 'Failed to save name')
      }
    } catch (err: any) {
      console.error('[ProfileDialog] Error saving PersonName:', err)
      setError(err.message || 'Failed to save name')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (!required) {
      setError(null)
      setName(currentName)
      onOpenChange(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <Dialog open={open} onOpenChange={required ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <User className="h-5 w-5 text-primary" />
            <DialogTitle>
              {currentName ? 'Edit Profile' : 'Set Your Name'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {required
              ? 'Please set your name before creating connections. This name will be shared with your contacts.'
              : 'Update your profile name. This name will be shared with your contacts.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              disabled={saving}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          {!required && (
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
