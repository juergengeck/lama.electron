/**
 * MediaViewer - Gallery view for media attachments with Subject tagging
 * 
 * This component provides a visual browser for media files with Subject-based
 * organization and tagging. It's the foundation for emergent memory patterns.
 */

import React, { useState, useEffect, useMemo } from 'react'
import { Search, Filter, Grid, List, Tag, Plus, X, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MessageAttachment, BlobDescriptor } from '@/types/attachments'
import { attachmentService } from '@/services/attachments/AttachmentService'
import { createAttachmentView } from '@/components/attachments/AttachmentViewFactory'
import { formatFileSize, getAttachmentType } from '@/types/attachments'

/**
 * Subject tag with metadata
 */
export interface Subject {
  name: string
  count: number // Usage count (demand)
  lastUsed: Date
  createdBy?: string // LLM contact or human
  confidence?: number // AI confidence in auto-tagging
}

/**
 * Media item with Subjects
 */
export interface MediaItem {
  attachment: MessageAttachment
  descriptor?: BlobDescriptor
  subjects: Subject[]
  addedAt: Date
  addedBy: string // Contact ID
  conversationId?: string
}

interface MediaViewerProps {
  items?: MediaItem[]
  onItemClick?: (item: MediaItem) => void
  onSubjectClick?: (subject: string) => void
  onAddSubject?: (itemHash: string, subject: string) => void
  onRemoveSubject?: (itemHash: string, subject: string) => void
  llmContactId?: string // Current LLM contact viewing
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  items = [],
  onItemClick,
  onSubjectClick,
  onAddSubject,
  onRemoveSubject,
  llmContactId
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'alphabetical'>('recent')
  const [showAddSubject, setShowAddSubject] = useState<string | null>(null)
  const [newSubject, setNewSubject] = useState('')
  
  // Extract all unique subjects with counts (demand tracking)
  const allSubjects = useMemo(() => {
    const subjectMap = new Map<string, Subject>()
    
    items.forEach(item => {
      item.subjects.forEach(subject => {
        const existing = subjectMap.get(subject.name)
        if (existing) {
          existing.count += 1
          if (subject.lastUsed > existing.lastUsed) {
            existing.lastUsed = subject.lastUsed
          }
        } else {
          subjectMap.set(subject.name, { ...subject })
        }
      })
    })
    
    return Array.from(subjectMap.values()).sort((a, b) => {
      if (sortBy === 'popular') return b.count - a.count
      if (sortBy === 'alphabetical') return a.name.localeCompare(b.name)
      return b.lastUsed.getTime() - a.lastUsed.getTime()
    })
  }, [items, sortBy])
  
  // Filter items based on search and selected subjects
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Text search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = item.attachment.name?.toLowerCase().includes(query)
        const matchesSubject = item.subjects.some(s => 
          s.name.toLowerCase().includes(query)
        )
        if (!matchesName && !matchesSubject) return false
      }
      
      // Subject filter (items must have ALL selected subjects)
      if (selectedSubjects.size > 0) {
        const itemSubjects = new Set(item.subjects.map(s => s.name))
        for (const selected of selectedSubjects) {
          if (!itemSubjects.has(selected)) return false
        }
      }
      
      return true
    })
  }, [items, searchQuery, selectedSubjects])
  
  // Handle subject selection for filtering
  const toggleSubjectFilter = (subject: string) => {
    const newSelection = new Set(selectedSubjects)
    if (newSelection.has(subject)) {
      newSelection.delete(subject)
    } else {
      newSelection.add(subject)
    }
    setSelectedSubjects(newSelection)
  }
  
  // Handle adding new subject to item
  const handleAddSubject = (itemHash: string) => {
    if (newSubject.trim() && onAddSubject) {
      // Format as hashtag if not already
      const subject = newSubject.startsWith('#') 
        ? newSubject.slice(1) 
        : newSubject
      onAddSubject(itemHash, subject.toLowerCase().trim())
      setNewSubject('')
      setShowAddSubject(null)
    }
  }
  
  // Subject resonance indicator (demand/supply)
  const getSubjectResonance = (subject: Subject): 'high' | 'medium' | 'low' => {
    const maxCount = Math.max(...allSubjects.map(s => s.count))
    const ratio = subject.count / maxCount
    if (ratio > 0.6) return 'high'
    if (ratio > 0.3) return 'medium'
    return 'low'
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b space-y-4">
        {/* Search and View Controls */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search media and subjects..."
              className="pl-9"
            />
          </div>
          
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="popular">Popular</SelectItem>
              <SelectItem value="alphabetical">A-Z</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex gap-1 border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Subject Filter Cloud */}
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Filter by Subjects ({selectedSubjects.size} active)
          </div>
          <div className="flex flex-wrap gap-2">
            {allSubjects.slice(0, 20).map(subject => {
              const resonance = getSubjectResonance(subject)
              const isSelected = selectedSubjects.has(subject.name)
              
              return (
                <Badge
                  key={subject.name}
                  variant={isSelected ? 'default' : 'outline'}
                  className={`cursor-pointer transition-all ${
                    resonance === 'high' ? 'border-green-500' :
                    resonance === 'medium' ? 'border-yellow-500' :
                    'border-gray-500'
                  }`}
                  onClick={() => toggleSubjectFilter(subject.name)}
                >
                  <Hash className="h-3 w-3 mr-1" />
                  {subject.name}
                  <span className="ml-1 text-xs opacity-60">
                    {subject.count}
                  </span>
                </Badge>
              )
            })}
          </div>
        </div>
        
        {/* Stats */}
        <div className="text-sm text-muted-foreground">
          {filteredItems.length} items
          {selectedSubjects.size > 0 && ` matching ${selectedSubjects.size} subjects`}
          {llmContactId && ` • Viewing as ${llmContactId}`}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredItems.map(item => (
              <div
                key={item.attachment.hash}
                className="group relative border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => onItemClick?.(item)}
              >
                {/* Media Preview */}
                <div className="aspect-square bg-muted flex items-center justify-center">
                  {createAttachmentView(item.attachment, item.descriptor, {
                    mode: 'thumbnail',
                    showMetadata: false,
                    maxWidth: 200,
                    maxHeight: 200
                  })}
                </div>
                
                {/* Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-white text-xs truncate">
                    {item.attachment.name}
                  </div>
                  <div className="text-white/60 text-xs">
                    {formatFileSize(item.attachment.size || 0)}
                  </div>
                </div>
                
                {/* Subjects */}
                <div className="p-2 space-y-1">
                  <div className="flex flex-wrap gap-1">
                    {item.subjects.slice(0, 3).map(subject => (
                      <Badge
                        key={subject.name}
                        variant="secondary"
                        className="text-xs cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSubjectClick?.(subject.name)
                        }}
                      >
                        #{subject.name}
                      </Badge>
                    ))}
                    {item.subjects.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{item.subjects.length - 3}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Add Subject Button */}
                  {showAddSubject === item.attachment.hash ? (
                    <div className="flex gap-1">
                      <Input
                        value={newSubject}
                        onChange={(e) => setNewSubject(e.target.value)}
                        placeholder="Add subject..."
                        className="h-6 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddSubject(item.attachment.hash)
                          }
                          if (e.key === 'Escape') {
                            setShowAddSubject(null)
                            setNewSubject('')
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowAddSubject(null)
                          setNewSubject('')
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs w-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowAddSubject(item.attachment.hash)
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Subject
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map(item => (
              <div
                key={item.attachment.hash}
                className="flex items-center gap-4 p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => onItemClick?.(item)}
              >
                {/* Thumbnail */}
                <div className="w-16 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
                  {createAttachmentView(item.attachment, item.descriptor, {
                    mode: 'compact',
                    showMetadata: false
                  })}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {item.attachment.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {getAttachmentType(item.attachment.mimeType || '')} • 
                    {formatFileSize(item.attachment.size || 0)} • 
                    {item.addedAt.toLocaleDateString()}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.subjects.map(subject => (
                      <Badge
                        key={subject.name}
                        variant="secondary"
                        className="text-xs cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSubjectClick?.(subject.name)
                        }}
                      >
                        #{subject.name}
                        {subject.confidence && (
                          <span className="ml-1 opacity-60">
                            {Math.round(subject.confidence * 100)}%
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {/* Actions */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowAddSubject(item.attachment.hash)
                  }}
                >
                  <Tag className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}