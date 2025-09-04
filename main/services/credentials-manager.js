/**
 * Verifiable Credentials Manager
 * Handles creation, validation, and management of verifiable credentials
 * for peer-to-peer settings authorization
 */

import crypto from 'crypto';
import nodeOneCore from '../core/node-one-core.js';

class CredentialsManager {
  constructor() {
    this.trustedCredentials = new Map()
    this.ownCredentials = new Map()
    this.authorityLevels = {
      'settings.connections': 'DEVICE_ADMIN',
      'settings.network': 'DEVICE_ADMIN', 
      'settings.appearance': 'USER',
      'settings.notifications': 'USER',
      'settings.security': 'OWNER',
      'settings.credentials': 'OWNER'
    }
  }

  /**
   * Create a verifiable credential for settings authorization
   */
  async createSettingsCredential(subject, authority, settingsScope, expiryHours = 24) {
    const issuanceDate = new Date()
    const expirationDate = new Date(issuanceDate.getTime() + (expiryHours * 60 * 60 * 1000))
    
    const credential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://lama.one/credentials/v1'
      ],
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', 'LAMASettingsCredential'],
      issuer: this.getOwnInstanceId(),
      issuanceDate: issuanceDate.toISOString(),
      expirationDate: expirationDate.toISOString(),
      credentialSubject: {
        id: subject.instanceId,
        name: subject.name,
        platform: subject.platform,
        authority: authority,
        permissions: {
          scope: settingsScope, // e.g., ['settings.connections', 'settings.network']
          actions: this.getPermittedActions(authority, settingsScope)
        }
      },
      proof: null // Will be added by signing
    }

    // Sign the credential
    const signature = await this.signCredential(credential)
    credential.proof = {
      type: 'Ed25519Signature2020',
      created: issuanceDate.toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: `${this.getOwnInstanceId()}#key-1`,
      signature: signature
    }

    // Store our own credential
    this.ownCredentials.set(credential.id, credential)
    
    console.log(`[CredentialsManager] Created settings credential for ${subject.name} with ${authority} authority`)
    
    return credential
  }

  /**
   * Validate a verifiable credential for settings operations
   */
  async validateCredential(credential, requestedAction, settingsKey) {
    try {
      // Basic structure validation
      if (!credential || !credential.credentialSubject || !credential.proof) {
        return { valid: false, reason: 'Invalid credential structure' }
      }

      // Check expiration
      const now = new Date()
      const expiry = new Date(credential.expirationDate)
      if (expiry < now) {
        return { valid: false, reason: 'Credential expired' }
      }

      // Verify signature
      const signatureValid = await this.verifyCredentialSignature(credential)
      if (!signatureValid) {
        return { valid: false, reason: 'Invalid signature' }
      }

      // Check authority for the specific setting
      const requiredAuthority = this.authorityLevels[settingsKey]
      const credentialAuthority = credential.credentialSubject.authority

      if (!this.hasRequiredAuthority(credentialAuthority, requiredAuthority)) {
        return { 
          valid: false, 
          reason: `Insufficient authority: ${credentialAuthority} < ${requiredAuthority}` 
        }
      }

      // Check scope permissions
      const permissions = credential.credentialSubject.permissions
      if (!permissions.scope.includes(settingsKey)) {
        return { valid: false, reason: 'Setting not in credential scope' }
      }

      if (!permissions.actions.includes(requestedAction)) {
        return { valid: false, reason: 'Action not permitted by credential' }
      }

      // Check trust (is issuer in our trusted list?)
      const issuerTrusted = this.isTrustedIssuer(credential.issuer)
      if (!issuerTrusted) {
        return { valid: false, reason: 'Untrusted credential issuer' }
      }

      return { 
        valid: true, 
        subject: credential.credentialSubject,
        authority: credentialAuthority 
      }

    } catch (error) {
      console.error('[CredentialsManager] Error validating credential:', error)
      return { valid: false, reason: 'Validation error' }
    }
  }

  /**
   * Add a trusted credential issuer
   */
  addTrustedIssuer(instanceId, publicKey, trustLevel = 'DEVICE_ADMIN') {
    this.trustedCredentials.set(instanceId, {
      publicKey,
      trustLevel,
      addedAt: new Date().toISOString()
    })
    
    console.log(`[CredentialsManager] Added trusted issuer: ${instanceId} with ${trustLevel} trust`)
  }

  /**
   * Check if an issuer is trusted
   */
  isTrustedIssuer(instanceId) {
    // Always trust ourselves
    if (instanceId === this.getOwnInstanceId()) {
      return true
    }
    
    // Check trusted issuers list
    return this.trustedCredentials.has(instanceId)
  }

  /**
   * Get permitted actions for authority level and scope
   */
  getPermittedActions(authority, settingsScope) {
    const actions = new Set()

    // All authorities can read
    actions.add('read')
    actions.add('subscribe')

    // USER and above can modify user settings
    if (this.hasRequiredAuthority(authority, 'USER')) {
      if (settingsScope.some(s => s.startsWith('settings.appearance') || s.startsWith('settings.notifications'))) {
        actions.add('write')
        actions.add('update')
      }
    }

    // DEVICE_ADMIN and above can modify device settings
    if (this.hasRequiredAuthority(authority, 'DEVICE_ADMIN')) {
      if (settingsScope.some(s => s.startsWith('settings.connections') || s.startsWith('settings.network'))) {
        actions.add('write')
        actions.add('update')
        actions.add('sync')
      }
    }

    // OWNER can modify any settings
    if (this.hasRequiredAuthority(authority, 'OWNER')) {
      actions.add('write')
      actions.add('update')
      actions.add('delete')
      actions.add('sync')
      actions.add('manage_credentials')
    }

    return Array.from(actions)
  }

  /**
   * Check if authority level is sufficient
   */
  hasRequiredAuthority(currentAuthority, requiredAuthority) {
    const authorityHierarchy = {
      'USER': 1,
      'DEVICE_ADMIN': 2,
      'OWNER': 3
    }

    const currentLevel = authorityHierarchy[currentAuthority] || 0
    const requiredLevel = authorityHierarchy[requiredAuthority] || 0

    return currentLevel >= requiredLevel
  }

  /**
   * Sign a credential (simplified - in production use proper cryptographic signing)
   */
  async signCredential(credential) {
    // Create a deterministic hash of the credential content
    const credentialContent = JSON.stringify({
      ...credential,
      proof: undefined // Exclude proof from signing
    })
    
    const hash = crypto.createHash('sha256').update(credentialContent).digest('hex')
    
    // In production, this would use the instance's private key
    // For now, create a signature based on our instance ID and content
    const instanceId = this.getOwnInstanceId()
    const signature = crypto
      .createHmac('sha256', instanceId)
      .update(hash)
      .digest('hex')
    
    return signature
  }

  /**
   * Verify credential signature
   */
  async verifyCredentialSignature(credential) {
    try {
      const credentialContent = JSON.stringify({
        ...credential,
        proof: undefined
      })
      
      const hash = crypto.createHash('sha256').update(credentialContent).digest('hex')
      
      // Get issuer's verification method (in production, this would be their public key)
      const expectedSignature = crypto
        .createHmac('sha256', credential.issuer)
        .update(hash)
        .digest('hex')
      
      return expectedSignature === credential.proof.signature
    } catch (error) {
      console.error('[CredentialsManager] Signature verification failed:', error)
      return false
    }
  }

  /**
   * Get our own instance ID (placeholder - should get from NodeOneCore)
   */
  getOwnInstanceId() {
    return nodeOneCore.ownerId || 'unknown-instance'
  }

  /**
   * Create bootstrap credentials for initial trust establishment
   */
  async createBootstrapCredentials() {
    const ownInstanceId = this.getOwnInstanceId()
    
    // Create a self-signed owner credential
    const ownerCredential = await this.createSettingsCredential(
      {
        instanceId: ownInstanceId,
        name: 'Owner Instance',
        platform: 'nodejs'
      },
      'OWNER',
      Object.keys(this.authorityLevels),
      24 * 30 // 30 days
    )

    // Trust ourselves as owner
    this.addTrustedIssuer(ownInstanceId, 'self-signed', 'OWNER')

    console.log('[CredentialsManager] Bootstrap credentials created')
    
    return ownerCredential
  }

  /**
   * Get all stored credentials
   */
  getAllCredentials() {
    return {
      own: Array.from(this.ownCredentials.values()),
      trusted: Array.from(this.trustedCredentials.entries()).map(([id, data]) => ({
        instanceId: id,
        ...data
      }))
    }
  }
}

// Singleton
export default new CredentialsManager()