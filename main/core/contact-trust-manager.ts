/**
 * Contact Trust Manager
 * 
 * Manages trust levels and verifiable credentials for contacts.
 * All discovered peers are stored as contacts immediately, but with
 * different trust levels and source VCs.
 */

import { EventEmitter } from 'events'
import crypto from 'crypto'

class ContactTrustManager extends EventEmitter {
  public nodeOneCore: any;
  public TRUST_LEVELS: any;

  DISCOVERY_SOURCES: any;
  privateSignKey: any;
  nickname: any;
  groups: any;
  tags: any;
  notes: any;
  canMessage: any;
  canShareChannels: any;
  canCall: any;
  canShareFiles: any;
  canSeePresence: any;
  Person: any;
  ProfileModel: any;
  OneInstanceEndpoint: any;
  SomeoneModel: any;
  constructor(nodeOneCore: any) {

    super()
    this.nodeOneCore = nodeOneCore
    
    // Trust levels define what operations are allowed
    this.TRUST_LEVELS = {
      DISCOVERED: 'discovered',     // Found via discovery, no user action
      PENDING: 'pending',           // User notified, awaiting decision  
      ACCEPTED: 'accepted',         // User accepted the contact
      TRUSTED: 'trusted',           // Enhanced trust (e.g., verified in person)
      BLOCKED: 'blocked'            // User blocked the contact
}
    
    // Source types for VCs
    this.DISCOVERY_SOURCES = {
      QUIC_VC: 'quic-vc-discovery',
      COMMSERVER: 'commserver-discovery',
      QR_CODE: 'qr-code-scan',
      INVITATION: 'invitation-link',
      MANUAL: 'manual-entry'
    }
  }

  /**
   * Create a discovery VC when a new peer is discovered
   */
  async createDiscoveryVC(credential: any, peerId: any, discoverySource: any): Promise<any> {
    const { getInstanceIdHash, getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
    const { getDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js')
    
    const instanceId = getInstanceIdHash()
    const myPersonId = getInstanceOwnerIdHash()
    if (!myPersonId) {
      throw new Error('No person ID available')
    }
    const keys = await getDefaultKeys(myPersonId)
    
    // Create a discovery VC that records how we found this contact
    const discoveryVC = {
      $type$: 'DiscoveryVerifiableCredential',
      
      // Who discovered whom
      issuer: myPersonId,
      subject: credential.subject, // The discovered person
      
      // Discovery metadata
      discovery: {
        source: discoverySource,
        timestamp: Date.now(),
        peerId: peerId,
        
        // Original credential we received
        originalCredential: credential,
        
        // Network information at discovery time
        networkInfo: {
          instanceId: credential.instanceId,
          instanceName: credential.instanceName,
          capabilities: credential.capabilities || []
        }
      },
      
      // Initial trust level
      trust: {
        level: this.TRUST_LEVELS.DISCOVERED,
        userReviewed: false,
        autoAccepted: false
      },
      
      // Communication permissions (restrictive by default)
      permissions: {
        canReceiveMessages: true,  // Can receive messages from them
        canSendMessages: false,     // Can't send until accepted
        canShareChannels: false,    // Can't share channels until accepted
        canSyncData: false,         // No CHUM sync until accepted
        canMakeCall: false,
        canShareFiles: false,
        canSeePresence: false
      },
      
      // Validity
      issuedAt: Date.now(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days for discovery VCs
      
      // Unique ID for this VC
      vcId: crypto.randomBytes(16).toString('hex')
    }
    
    // Sign the discovery VC
    const { sign } = await import('@refinio/one.core/lib/crypto/sign.js')
    const signature = await sign(new TextEncoder().encode(JSON.stringify(discoveryVC)), (keys as any).privateSignKey)
    
    return {
      ...discoveryVC,
      signature: signature
    }
  }

  /**
   * Create an acceptance VC when user accepts a contact
   */
  async createAcceptanceVC(personId: any, options = {}): Promise<unknown> {
    const { getInstanceIdHash, getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
    const { getDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js')
    
    const instanceId = getInstanceIdHash()
    const myPersonId = getInstanceOwnerIdHash()
    if (!myPersonId) {
      throw new Error('No person ID available')
    }
    const keys = await getDefaultKeys(myPersonId)
    
    // Create acceptance VC that supersedes the discovery VC
    const acceptanceVC = {
      $type$: 'AcceptanceVerifiableCredential',
      
      issuer: myPersonId,
      subject: personId,
      
      // Acceptance details
      acceptance: {
        timestamp: Date.now(),
        userAction: 'accepted',
        
        // Optional user-provided metadata
        nickname: (options as any).nickname,
        groups: (options as any).groups || [],
        tags: (options as any).tags || [],
        notes: (options as any).notes
      },
      
      // Updated trust level
      trust: {
        level: this.TRUST_LEVELS.ACCEPTED,
        userReviewed: true,
        acceptedAt: Date.now()
      },
      
      // Enhanced permissions after acceptance
      permissions: {
        canReceiveMessages: true,
        canSendMessages: (options as any).canMessage !== false,
        canShareChannels: (options as any).canShareChannels !== false,
        canSyncData: true, // Enable CHUM sync
        canMakeCall: (options as any).canCall || false,
        canShareFiles: (options as any).canShareFiles || false,
        canSeePresence: (options as any).canSeePresence !== false
      },
      
      // Reference to the discovery VC this supersedes
      supersedes: (options as any).discoveryVCId,
      
      // Validity (longer for accepted contacts)
      issuedAt: Date.now(),
      expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
      revocable: true,
      
      vcId: crypto.randomBytes(16).toString('hex')
    }
    
    // Sign the acceptance VC
    const { sign } = await import('@refinio/one.core/lib/crypto/sign.js')
    const signature = await sign(new TextEncoder().encode(JSON.stringify(acceptanceVC)), (keys as any).privateSignKey)
    
    return {
      ...acceptanceVC,
      signature: signature
    }
  }

  /**
   * Store a contact with its discovery VC
   */
  async storeContactWithVC(credential: any, discoveryVC: any): Promise<any> {
    const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
    const { storeUnversionedObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js')

    // Create Person object - no need to import Person recipe, it's built-in
    const person = {
      $type$: 'Person' as const,
      name: credential.instanceName || 'Unknown',
      email: `${credential.subject?.substring(0, 8)}@quic-vc.local`
    }

    const personHash = await storeVersionedObject(person)
    
    // Store the discovery VC
    const vcHash = await storeUnversionedObject(discoveryVC)
    
    // Create Profile with endpoint information
    const ProfileModel = (await import('@refinio/one.models/lib/models/Leute/ProfileModel.js')).default

    // Store Keys objects first
    const { storeUnversionedObject: storeKeys } = await import('@refinio/one.core/lib/storage-unversioned-objects.js')
    const personKeysObj = {
      $type$: 'Keys' as const,
      owner: credential.subject,
      publicSignKey: credential.publicKey,
      publicKey: credential.publicKey // Using same key for both for now
    }
    const personKeysResult = await storeKeys(personKeysObj)

    // Create OneInstanceEndpoint - no import needed, it's a standard type
    const endpoint = {
      $type$: 'OneInstanceEndpoint' as const,
      personId: credential.subject,
      instanceId: credential.instanceId,
      personKeys: personKeysResult.hash,
      instanceKeys: personKeysResult.hash // Using same keys for both
    }
    
    // Create profile with trust metadata
    const profile = await ProfileModel.constructWithNewProfile(
      credential.subject,
      this.nodeOneCore.ownerId,
      'discovered-contact',
      [endpoint],
      [credential.publicKey]
    )
    
    // Store the Person object first
    const personResult = await storeVersionedObject(person as any)
    const personIdHash = (personResult as any)?.idHash || personResult

    // Create Someone object with trust VC reference
    const SomeoneModel = (await import('@refinio/one.models/lib/models/Leute/SomeoneModel.js')).default

    const someone = await SomeoneModel.constructWithNewSomeone(personIdHash, this.nodeOneCore?.leuteModel)
    
    // Add to contacts (but with limited permissions due to trust level)
    if (this.nodeOneCore.leuteModel) {
      await this.nodeOneCore.leuteModel.addSomeoneElse(someone.idHash)
      
      console.log('[ContactTrustManager] Contact stored with discovery VC:', {
        personId: credential.subject,
        trustLevel: this.TRUST_LEVELS.DISCOVERED,
        vcHash: vcHash
      })
    }
    
    return {
      personHash: personHash,
      someoneHash: someone.idHash,
      profileHash: profile.idHash,
      vcHash: vcHash,
      person: person,
      profile: profile,
      someone: someone,
      discoveryVC: discoveryVC
    }
  }

  /**
   * Check if communication is allowed with a contact based on trust
   */
  async canCommunicateWith(personId: any, operation = 'message'): Promise<unknown> {
    // Get the contact's trust VCs
    const trustVCs = await this.getContactTrustVCs(personId)
    
    if (!trustVCs || trustVCs.length === 0) {
      return false // No trust VCs, no communication
    }
    
    // Find the most recent valid VC
    const validVC = this.getMostRecentValidVC(trustVCs)
    
    if (!validVC) {
      return false // No valid VC
    }
    
    // Check permissions based on operation
    switch (operation) {
      case 'message':
        return validVC.permissions?.canSendMessages || false
      case 'receive':
        return validVC.permissions?.canReceiveMessages !== false
      case 'sync':
        return validVC.permissions?.canSyncData || false
      case 'channel':
        return validVC.permissions?.canShareChannels || false
      case 'call':
        return validVC.permissions?.canMakeCall || false
      case 'file':
        return validVC.permissions?.canShareFiles || false
      case 'presence':
        return validVC.permissions?.canSeePresence || false
      default:
        return false
    }
  }

  /**
   * Get trust VCs for a contact
   */
  async getContactTrustVCs(personId: any): Promise<any> {
    // This would query ONE.core storage for VCs related to this person
    // For now, return from a cache or storage query
    
    // TODO: Implement actual storage query
    console.log('[ContactTrustManager] Getting trust VCs for:', personId)
    
    return []
  }

  /**
   * Get the most recent valid VC from a list
   */
  getMostRecentValidVC(vcs: any): any {
    const now = Date.now()
    
    // Filter valid VCs and sort by issuedAt
    const validVCs = vcs
      .filter((vc: any) => {
        // Check if expired
        if (vc.expiresAt && vc.expiresAt < now) {
          return false
        }
        
        // Check if revoked
        if (vc.revoked) {
          return false
        }
        
        return true
      })
      .sort((a: any, b: any) => b.issuedAt - a.issuedAt)
    
    return validVCs[0] || null
  }

  /**
   * Update contact trust level when user accepts
   */
  async acceptContact(personId: any, options = {}): Promise<unknown> {
    console.log('[ContactTrustManager] Accepting contact:', personId)
    
    // Create acceptance VC
    const acceptanceVC = await this.createAcceptanceVC(personId, options)
    
    // Store the acceptance VC
    const { storeUnversionedObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js')
    const vcHash = await storeUnversionedObject(acceptanceVC as any)
    
    // Update the Someone object with new trust level
    // TODO: Update the actual Someone object in storage
    
    console.log('[ContactTrustManager] Contact accepted with VC:', vcHash)
    
    // Emit event for UI updates
    this.emit('contact-accepted', {
      personId: personId,
      acceptanceVC: acceptanceVC,
      vcHash: vcHash
    })
    
    return {
      success: true,
      vcHash: vcHash,
      acceptanceVC: acceptanceVC
    }
  }

  /**
   * Get trust level for a specific contact
   */
  async getContactTrustLevel(personId: any): Promise<any> {
    // Get the contact's trust VCs
    const trustVCs = await this.getContactTrustVCs(personId)
    
    if (!trustVCs || trustVCs.length === 0) {
      return this.TRUST_LEVELS.DISCOVERED // Default for new contacts
    }
    
    // Find the most recent valid VC
    const validVC = this.getMostRecentValidVC(trustVCs)
    
    if (!validVC) {
      return this.TRUST_LEVELS.DISCOVERED
    }
    
    return validVC.trust?.level || this.TRUST_LEVELS.DISCOVERED
  }
  
  /**
   * Get contacts by trust level
   */
  async getContactsByTrustLevel(trustLevel: any): Promise<any> {
    if (!this.nodeOneCore.leuteModel) {
      return []
    }
    
    const allContacts = await this.nodeOneCore.leuteModel.getSomeoneElseList()
    
    // Filter by trust level
    // TODO: Actually check trust VCs for each contact
    
    return allContacts
  }

  /**
   * Get pending contacts (discovered but not yet accepted)
   */
  async getPendingContacts(): Promise<any> {
    return this.getContactsByTrustLevel(this.TRUST_LEVELS.DISCOVERED)
  }

  /**
   * Block a contact
   */
  async blockContact(personId: any, reason: any): Promise<any> {
    console.log('[ContactTrustManager] Blocking contact:', personId, reason)
    
    // Create a block VC
    const blockVC = await this.createBlockVC(personId, reason)
    
    // Store it
    const { storeUnversionedObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js')
    const vcHash = await storeUnversionedObject(blockVC)
    
    this.emit('contact-blocked', {
      personId: personId,
      reason: reason,
      vcHash: vcHash
    })
    
    return {
      success: true,
      vcHash: vcHash
    }
  }

  /**
   * Create a block VC
   */
  async createBlockVC(personId: any, reason: any): Promise<any> {
    const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
    const { getDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js')
    
    const myPersonId = getInstanceOwnerIdHash()
    const keys = await getDefaultKeys(myPersonId!)
    
    const blockVC = {
      $type$: 'BlockVerifiableCredential',
      issuer: myPersonId,
      subject: personId,
      
      block: {
        timestamp: Date.now(),
        reason: reason
      },
      
      trust: {
        level: this.TRUST_LEVELS.BLOCKED,
        blockedAt: Date.now()
      },
      
      // No permissions when blocked
      permissions: {
        canReceiveMessages: false,
        canSendMessages: false,
        canShareChannels: false,
        canSyncData: false,
        canMakeCall: false,
        canShareFiles: false,
        canSeePresence: false
      },
      
      issuedAt: Date.now(),
      vcId: crypto.randomBytes(16).toString('hex')
    }
    
    // Sign it
    const { sign } = await import('@refinio/one.core/lib/crypto/sign.js')
    const signature = await sign(new TextEncoder().encode(JSON.stringify(blockVC)), (keys as any).privateSignKey)
    
    return {
      ...blockVC,
      signature: signature
    }
  }
}

export default ContactTrustManager;