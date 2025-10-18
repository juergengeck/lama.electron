import { Bot, User } from 'lucide-react'

interface Participant {
  id: string
  name: string
  isAI: boolean
  color?: string
}

interface ParticipantAvatarsProps {
  participants: Participant[]
  maxDisplay?: number
  size?: 'sm' | 'md' | 'lg'
}

export function ParticipantAvatars({
  participants,
  maxDisplay = 5,
  size = 'sm'
}: ParticipantAvatarsProps) {

  if (participants.length === 0) {
    return null
  }

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  const displayedParticipants = participants.slice(0, maxDisplay)
  const remainingCount = participants.length - maxDisplay

  return (
    <div className="flex items-center">
      {displayedParticipants.map((participant, index) => (
        <div
          key={participant.id}
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center flex-shrink-0 border border-background`}
          title={participant.name}
          style={{
            marginLeft: index > 0 ? '-6px' : '0',
            backgroundColor: participant.color || (participant.isAI ? 'hsl(var(--primary) / 0.2)' : 'hsl(var(--muted))'),
            color: participant.color ? '#ffffff' : (participant.isAI ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))')
          }}
        >
          {participant.isAI ? (
            <Bot className={iconSizes[size]} />
          ) : (
            <User className={iconSizes[size]} />
          )}
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground text-xs font-medium border border-background`}
          style={{ marginLeft: '-6px' }}
          title={`${remainingCount} more participant${remainingCount > 1 ? 's' : ''}`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  )
}
