/**
 * Feed-Forward Manager
 * Main orchestrator for Supply/Demand matching and trust-based knowledge sharing
 */

import { EventEmitter } from 'events'
import crypto from 'crypto'

interface FeedForwardManagerOptions {
  nodeOneCore: any
  keywordExtractor?: any
  trustManager?: any
}

class FeedForwardManager extends EventEmitter {
  private nodeOneCore: any
  private keywordExtractor: any
  private trustManager: any
  private supplyCache: Map<string, any> = new Map()
  private demandCache: Map<string, any> = new Map()
  private initialized: boolean = false

  constructor(options: FeedForwardManagerOptions) {
    super()
    this.nodeOneCore = options.nodeOneCore
    this.keywordExtractor = options.keywordExtractor
    this.trustManager = options.trustManager
  }

  /**
   * Initialize the feed-forward manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    console.log('[FeedForwardManager] Initializing...')

    // Validate dependencies
    if (!this.nodeOneCore) {
      throw new Error('NodeOneCore is required')
    }

    if (!this.keywordExtractor) {
      // Import the existing keyword extractor
      const { default: RealTimeKeywordExtractor } = await import('@lama/core/one-ai/services/RealTimeKeywordExtractor.js')
      this.keywordExtractor = new RealTimeKeywordExtractor()
    }

    if (!this.trustManager) {
      // Import the existing trust manager
      const { default: ContactTrustManager } = await import('../contact-trust-manager.js')
      this.trustManager = new ContactTrustManager(this.nodeOneCore)
    }

    this.initialized = true
    console.log('[FeedForwardManager] Initialized successfully')
  }

  /**
   * Create a Supply object from conversation keywords
   */
  async createSupply(params: {
    keywords: string[]
    contextLevel: number
    conversationId: string
    metadata?: any
  }): Promise<{ success: boolean; supplyHash?: string; keywordHashes?: string[]; error?: string }> {
    try {
      await this.initialize()

      // Validate parameters
      if (!params.keywords || !Array.isArray(params.keywords) || params.keywords.length === 0) {
        return { success: false, error: 'Keywords are required and must be a non-empty array' }
      }

      if (params.keywords.length > 20) {
        return { success: false, error: 'Maximum 20 keywords allowed' }
      }

      if (!params.contextLevel || params.contextLevel < 1 || params.contextLevel > 5) {
        return { success: false, error: 'Context level must be between 1 and 5' }
      }

      if (!params.conversationId) {
        return { success: false, error: 'Conversation ID is required' }
      }

      // Get current user
      const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
      const creatorId = getInstanceOwnerIdHash()
      if (!creatorId) {
        return { success: false, error: 'User not authenticated' }
      }

      // Hash keywords using SHA-256
      const keywordHashes = params.keywords.map(keyword => {
        return crypto.createHash('sha256').update(keyword.toLowerCase().trim()).digest('hex')
      })

      // Get creator's trust score
      const trustScore = await this.getTrustScoreForParticipant(creatorId)

      // Generate unique ID for the Supply
      const supplyId = crypto.randomUUID()

      // Create Supply object
      const supply = {
        $type$: 'Supply',
        id: supplyId,
        keywords: keywordHashes,
        contextLevel: params.contextLevel,
        conversationId: params.conversationId,
        creatorId: creatorId,
        trustScore: trustScore.score,
        created: Date.now(),
        metadata: params.metadata || {},
        isRecursive: false
      }

      // Store in ONE.core (cast to any to bypass TypeScript type checking for now)
      const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
      const result = await storeVersionedObject(supply as any)
      const supplyHash = result.hash

      // Cache locally for fast matching
      this.supplyCache.set(supplyHash, supply)

      console.log('[FeedForwardManager] Supply created:', {
        supplyHash,
        keywords: params.keywords,
        keywordHashes: keywordHashes.slice(0, 3), // Log first 3 for debugging
        contextLevel: params.contextLevel
      })

      this.emit('supply-created', {
        supplyHash,
        supply,
        originalKeywords: params.keywords
      })

      return {
        success: true,
        supplyHash,
        keywordHashes
      }

    } catch (error) {
      console.error('[FeedForwardManager] Error creating supply:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating supply'
      }
    }
  }

  /**
   * Create a Demand object for requesting knowledge
   */
  async createDemand(params: {
    keywords: string[]
    urgency: number
    context: string
    criteria?: any
    expires?: number
    maxResults?: number
  }): Promise<{ success: boolean; demandHash?: string; error?: string }> {
    try {
      await this.initialize()

      // Validate parameters
      if (!params.keywords || !Array.isArray(params.keywords) || params.keywords.length === 0) {
        return { success: false, error: 'Keywords are required and must be a non-empty array' }
      }

      if (params.keywords.length > 10) {
        return { success: false, error: 'Maximum 10 keywords allowed for demands' }
      }

      if (!params.urgency || params.urgency < 1 || params.urgency > 10) {
        return { success: false, error: 'Urgency must be between 1 and 10' }
      }

      if (!params.context || params.context.length > 500) {
        return { success: false, error: 'Context is required and must be <= 500 characters' }
      }

      if (params.expires && params.expires <= Date.now()) {
        return { success: false, error: 'Expiration time must be in the future' }
      }

      // Get current user
      const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
      const requesterId = getInstanceOwnerIdHash()
      if (!requesterId) {
        return { success: false, error: 'User not authenticated' }
      }

      // Hash keywords
      const keywordHashes = params.keywords.map(keyword => {
        return crypto.createHash('sha256').update(keyword.toLowerCase().trim()).digest('hex')
      })

      // Generate unique ID for the Demand
      const demandId = crypto.randomUUID()

      // Create Demand object
      const demand = {
        $type$: 'Demand',
        id: demandId,
        keywords: keywordHashes,
        urgency: params.urgency,
        context: params.context,
        criteria: params.criteria || {},
        requesterId: requesterId,
        created: Date.now(),
        expires: params.expires,
        maxResults: params.maxResults
      }

      // Store in ONE.core (cast to any to bypass TypeScript type checking for now)
      const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
      const result = await storeVersionedObject(demand as any)
      const demandHash = result.hash

      // Cache locally
      this.demandCache.set(demandHash, demand)

      console.log('[FeedForwardManager] Demand created:', {
        demandHash,
        keywords: params.keywords,
        urgency: params.urgency
      })

      this.emit('demand-created', {
        demandHash,
        demand,
        originalKeywords: params.keywords
      })

      return {
        success: true,
        demandHash
      }

    } catch (error) {
      console.error('[FeedForwardManager] Error creating demand:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating demand'
      }
    }
  }

  /**
   * Find Supply objects that match a Demand
   */
  async matchSupplyDemand(params: {
    demandHash: string
    minTrust?: number
    limit?: number
  }): Promise<{ success: boolean; matches?: any[]; error?: string }> {
    try {
      await this.initialize()

      const minTrust = params.minTrust || 0.3
      const limit = params.limit || 10

      // Validate parameters
      if (!params.demandHash) {
        return { success: false, error: 'Demand hash is required' }
      }

      if (minTrust < 0 || minTrust > 1) {
        return { success: false, error: 'Min trust must be between 0 and 1' }
      }

      if (limit < 1 || limit > 100) {
        return { success: false, error: 'Limit must be between 1 and 100' }
      }

      // Get demand object
      let demand = this.demandCache.get(params.demandHash)
      if (!demand) {
        // Try to load from storage
        try {
          const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
          const { ensureIdHash } = await import('@refinio/one.core/lib/util/type-checks.js')
          const demandResult = await getObjectByIdHash(ensureIdHash(params.demandHash))
          demand = demandResult.obj
          if (demand) {
            this.demandCache.set(params.demandHash, demand)
          }
        } catch (error) {
          return { success: false, error: 'Demand not found' }
        }
      }

      if (!demand) {
        return { success: false, error: 'Demand not found' }
      }

      // Find matching Supply objects
      const matches = []

      // For now, search in cache - later we'll implement proper storage queries
      for (const [supplyHash, supply] of this.supplyCache.entries()) {
        // Skip if trust score too low
        if (supply.trustScore < minTrust) {
          continue
        }

        // Calculate keyword overlap
        const matchedKeywords = supply.keywords.filter((hash: string) =>
          demand.keywords.includes(hash)
        )

        if (matchedKeywords.length === 0) {
          continue
        }

        // Calculate match score based on keyword overlap
        const overlapRatio = matchedKeywords.length / Math.max(supply.keywords.length, demand.keywords.length)
        const matchScore = overlapRatio

        // Weight by trust score
        const trustWeight = supply.trustScore * matchScore

        matches.push({
          supplyHash,
          matchScore,
          trustWeight,
          matchedKeywords,
          conversationId: supply.conversationId
        })
      }

      // Sort by trust-weighted score and limit results
      matches.sort((a, b) => b.trustWeight - a.trustWeight)
      const limitedMatches = matches.slice(0, limit)

      // Create match records
      for (const match of limitedMatches) {
        const matchRecord = {
          $type$: 'SupplyDemandMatch',
          demandHash: params.demandHash,
          supplyHash: match.supplyHash,
          matchScore: match.matchScore,
          matchedKeywords: match.matchedKeywords,
          trustWeight: match.trustWeight,
          created: Date.now()
        }

        // Store match record (cast to any to bypass TypeScript type checking for now)
        const { storeUnversionedObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js')
        await storeUnversionedObject(matchRecord as any)
      }

      console.log('[FeedForwardManager] Found matches:', {
        demandHash: params.demandHash,
        matchCount: limitedMatches.length,
        totalSupplies: this.supplyCache.size
      })

      return {
        success: true,
        matches: limitedMatches
      }

    } catch (error) {
      console.error('[FeedForwardManager] Error matching supply/demand:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error matching supply/demand'
      }
    }
  }

  /**
   * Get or calculate trust score for a participant
   */
  private async getTrustScoreForParticipant(participantId: string): Promise<{ score: number; components: any }> {
    try {
      // Try to get existing trust score
      const existingScore = await this.getTrustScore(participantId)
      if (existingScore.score !== undefined) {
        return existingScore
      }

      // Calculate initial trust score for new participant
      const components = await this.calculateTrustComponents(participantId)
      const score = this.calculateOverallTrustScore(components)

      // Store the trust score
      await this.storeTrustScore(participantId, score, components)

      return { score, components }

    } catch (error) {
      console.error('[FeedForwardManager] Error getting trust score:', error)
      // Return default trust score for new users
      return {
        score: 0.5,
        components: {
          identityVerification: 0.5,
          historicalAccuracy: 0.5,
          peerEndorsements: 0.0,
          activityConsistency: 0.5,
          accountAge: 0.0
        }
      }
    }
  }

  /**
   * Get trust score for a participant
   */
  async getTrustScore(participantId: string): Promise<{ score: number; components: any; history: any[] }> {
    try {
      // Query for existing TrustScore object
      // For now, return default - later implement storage query
      return {
        score: 0.5,
        components: {
          identityVerification: 0.5,
          historicalAccuracy: 0.5,
          peerEndorsements: 0.0,
          activityConsistency: 0.5,
          accountAge: 0.0
        },
        history: []
      }
    } catch (error) {
      console.error('[FeedForwardManager] Error getting trust score:', error)
      throw error
    }
  }

  /**
   * Calculate trust score components for a participant
   */
  private async calculateTrustComponents(participantId: string): Promise<any> {
    // Implementation will follow the trust algorithm from research.md
    const components = {
      identityVerification: 0.5, // Has verified identity?
      historicalAccuracy: 0.5,   // Past information quality
      peerEndorsements: 0.0,     // Other users' trust
      activityConsistency: 0.5,  // Regular, non-spam behavior
      accountAge: 0.0            // Time in network
    }

    // TODO: Implement actual trust calculation logic
    // For now, return defaults for new users

    return components
  }

  /**
   * Calculate overall trust score from components
   */
  private calculateOverallTrustScore(components: any): number {
    // Weighted algorithm from research.md
    return (
      0.3 * components.identityVerification +
      0.2 * components.historicalAccuracy +
      0.2 * components.peerEndorsements +
      0.2 * components.activityConsistency +
      0.1 * components.accountAge
    )
  }

  /**
   * Store trust score in ONE.core
   */
  private async storeTrustScore(participantId: string, score: number, components: any): Promise<void> {
    const trustScore = {
      $type$: 'TrustScore',
      participantId,
      score,
      components,
      history: [],
      lastUpdated: Date.now(),
      endorsers: []
    }

    const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
    await storeVersionedObject(trustScore as any)
  }

  /**
   * Update trust score for a participant
   */
  async updateTrust(params: {
    participantId: string
    adjustment: number
    reason: string
    evidence?: any
  }): Promise<{ success: boolean; newScore?: number; components?: any; error?: string }> {
    try {
      await this.initialize()

      // Validate parameters
      if (!params.participantId) {
        return { success: false, error: 'Participant ID is required' }
      }

      if (params.adjustment < -0.1 || params.adjustment > 0.1) {
        return { success: false, error: 'Adjustment must be between -0.1 and 0.1' }
      }

      if (!params.reason) {
        return { success: false, error: 'Reason is required' }
      }

      // Get current trust score
      const currentTrust = await this.getTrustScore(params.participantId)

      // Apply adjustment
      const newScore = Math.max(0, Math.min(1, currentTrust.score + params.adjustment))

      // Update components proportionally
      const components = { ...currentTrust.components }
      // For now, apply adjustment to historicalAccuracy
      components.historicalAccuracy = Math.max(0, Math.min(1,
        components.historicalAccuracy + params.adjustment
      ))

      // Recalculate overall score
      const recalculatedScore = this.calculateOverallTrustScore(components)

      // Add to history
      const historyEntry = {
        timestamp: Date.now(),
        change: params.adjustment,
        reason: params.reason,
        evidence: params.evidence
      }

      // Store updated trust score
      const updatedTrustScore = {
        $type$: 'TrustScore',
        participantId: params.participantId,
        score: recalculatedScore,
        components,
        history: [...currentTrust.history, historyEntry],
        lastUpdated: Date.now(),
        endorsers: []
      }

      const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
      await storeVersionedObject(updatedTrustScore as any)

      console.log('[FeedForwardManager] Trust updated:', {
        participantId: params.participantId,
        oldScore: currentTrust.score,
        newScore: recalculatedScore,
        adjustment: params.adjustment,
        reason: params.reason
      })

      this.emit('trust-updated', {
        participantId: params.participantId,
        oldScore: currentTrust.score,
        newScore: recalculatedScore,
        components
      })

      return {
        success: true,
        newScore: recalculatedScore,
        components
      }

    } catch (error) {
      console.error('[FeedForwardManager] Error updating trust:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error updating trust'
      }
    }
  }

  /**
   * Enable or disable sharing for a conversation
   */
  async enableSharing(params: {
    conversationId: string
    enabled: boolean
    retroactive?: boolean
  }): Promise<{ success: boolean; previousState?: boolean; error?: string }> {
    try {
      await this.initialize()

      // Validate parameters
      if (!params.conversationId) {
        return { success: false, error: 'Conversation ID is required' }
      }

      if (typeof params.enabled !== 'boolean') {
        return { success: false, error: 'Enabled must be a boolean' }
      }

      // For now, we'll implement this as a simple storage operation
      // In a full implementation, this would update Topic objects

      const previousState = false // TODO: Get actual previous state

      console.log('[FeedForwardManager] Sharing setting updated:', {
        conversationId: params.conversationId,
        enabled: params.enabled,
        retroactive: params.retroactive,
        previousState
      })

      this.emit('sharing-updated', {
        conversationId: params.conversationId,
        enabled: params.enabled,
        previousState
      })

      return {
        success: true,
        previousState
      }

    } catch (error) {
      console.error('[FeedForwardManager] Error updating sharing:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error updating sharing'
      }
    }
  }

  /**
   * Get training corpus stream
   */
  async getCorpusStream(params: {
    since?: number
    minQuality?: number
    keywords?: string[]
  }): Promise<{ success: boolean; entries?: any[]; hasMore?: boolean; nextCursor?: string; error?: string }> {
    try {
      await this.initialize()

      // Validate parameters
      if (params.minQuality && (params.minQuality < 0 || params.minQuality > 1)) {
        return { success: false, error: 'Min quality must be between 0 and 1' }
      }

      if (params.since && params.since < 0) {
        return { success: false, error: 'Since timestamp must be non-negative' }
      }

      // For now, return empty entries - full implementation will query corpus
      const entries: any[] = []
      const hasMore = false
      const nextCursor = 'end'

      console.log('[FeedForwardManager] Corpus stream requested:', {
        since: params.since,
        minQuality: params.minQuality,
        keywords: params.keywords?.length || 0
      })

      return {
        success: true,
        entries,
        hasMore,
        nextCursor
      }

    } catch (error) {
      console.error('[FeedForwardManager] Error getting corpus stream:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting corpus stream'
      }
    }
  }
}

export default FeedForwardManager