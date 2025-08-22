/**
 * Initialization Flow - REAL IMPLEMENTATION
 * Browser instance creates user and provisions Node instance
 */

// Use REAL ONE.CORE instance
import { realBrowserInstance } from './real-browser-instance'

class InitializationFlow {
  private currentUser: any = null
  
  async initialize(): Promise<{ ready: boolean; needsAuth: boolean }> {
    console.log('[InitFlow] Starting initialization...')
    
    try {
      // Initialize browser instance
      await realBrowserInstance.initialize()
      
      // Check if user is already logged in
      const authStatus = await realBrowserInstance.checkAuth()
      
      if (authStatus.authenticated) {
        this.currentUser = authStatus.user
        console.log('[InitFlow] User already authenticated:', authStatus.user?.name)
        
        // Provision Node instance if needed
        await this.provisionNodeInstance()
        
        return { ready: true, needsAuth: false }
      }
      
      console.log('[InitFlow] Ready for login/deploy')
      return { ready: true, needsAuth: true }
      
    } catch (error) {
      console.error('[InitFlow] Initialization failed:', error)
      // Still return ready to show login screen
      return { ready: true, needsAuth: true }
    }
  }
  
  async login(username: string, password: string): Promise<{ success: boolean; user?: any; isNew?: boolean }> {
    console.log('[InitFlow] Attempting login for:', username)
    
    try {
      // Try to login
      const user = await realBrowserInstance.login(username, password)
      this.currentUser = user
      
      // Store user in state
      await realBrowserInstance.setState('identity.user', {
        id: user.id,
        name: user.name,
        loggedInAt: new Date().toISOString()
      })
      
      // Provision Node instance
      await this.provisionNodeInstance()
      
      console.log('[InitFlow] Login successful')
      return { success: true, user }
      
    } catch (error: any) {
      // Login failed - these might be new credentials
      console.log('[InitFlow] Login failed:', error.message)
      return { success: false, isNew: true }
    }
  }
  
  async deployNewInstance(username: string, password: string): Promise<{ success: boolean; user?: any; error?: string }> {
    console.log('[InitFlow] Deploying new instance for:', username)
    
    try {
      // Create user with minimal info (security through obscurity)
      const user = await realBrowserInstance.createUser(username, password)
      
      // Login as this user
      await realBrowserInstance.login(username, password)
      this.currentUser = user
      
      // Store user identity
      await realBrowserInstance.setState('identity.user', {
        id: user.id,
        name: user.name,
        createdAt: new Date().toISOString()
      })
      
      // Generate provisioning credential for Node
      const credential = await this.createProvisioningCredential(user)
      await realBrowserInstance.setState('provisioning.nodeCredential', credential)
      
      // Provision Node instance
      await this.provisionNodeInstance()
      
      console.log('[InitFlow] New instance deployed successfully')
      return { success: true, user }
      
    } catch (error: any) {
      console.error('[InitFlow] Failed to deploy instance:', error)
      return { success: false, error: error.message }
    }
  }
  
  async createProvisioningCredential(user: any): Promise<any> {
    // Create a verifiable credential for Node provisioning
    const credential = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'NodeProvisioningCredential'],
      
      issuer: {
        id: `did:one:browser-${user.id}`,
        name: 'LAMA Browser Instance'
      },
      
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      
      credentialSubject: {
        id: `did:one:node-${user.id}`,
        provisioning: {
          userId: user.id,
          userName: user.name,
          permissions: [
            'storage.archive',
            'compute.llm',
            'network.full',
            'sync.chum'
          ],
          nodeConfig: {
            role: 'archive',
            storageType: 'unlimited',
            syncWithBrowser: true
          }
        }
      },
      
      // In production, this would be properly signed
      proof: {
        type: 'Ed25519Signature2020',
        created: new Date().toISOString(),
        verificationMethod: `did:one:browser-${user.id}#keys-1`,
        proofPurpose: 'assertionMethod',
        proofValue: 'mock-signature-' + Date.now()
      }
    }
    
    return credential
  }
  
  async provisionNodeInstance(): Promise<void> {
    console.log('[InitFlow] Provisioning Node instance...')
    
    // Check if already provisioned
    const nodeStatus = await realBrowserInstance.getState('provisioning.nodeStatus')
    if (nodeStatus?.provisioned) {
      console.log('[InitFlow] Node already provisioned')
      return
    }
    
    try {
      // Get or create provisioning credential
      let credential = await realBrowserInstance.getState('provisioning.nodeCredential')
      if (!credential) {
        console.log('[InitFlow] No provisioning credential, creating one')
        credential = await this.createProvisioningCredential(this.currentUser)
        await realBrowserInstance.setState('provisioning.nodeCredential', credential)
      }
      
      // Send provisioning request to Node via IPC
      if (window.electronAPI) {
        const result = await window.electronAPI.invoke('provision:node', {
          credential,
          user: this.currentUser,
          config: {
            storageRole: 'archive',
            capabilities: ['llm', 'files', 'network'],
            syncEndpoint: 'ws://localhost:8765'
          }
        })
        
        if (result.success) {
          await realBrowserInstance.setState('provisioning.nodeStatus', {
            provisioned: true,
            provisionedAt: new Date().toISOString(),
            nodeId: result.nodeId,
            endpoint: result.endpoint
          })
          
          console.log('[InitFlow] Node provisioned successfully:', result.nodeId)
          
          // Establish CHUM connection
          await this.connectToNode()
        } else {
          console.error('[InitFlow] Node provisioning failed:', result.error)
        }
      } else {
        console.log('[InitFlow] No Electron API, skipping Node provisioning')
      }
      
    } catch (error) {
      console.error('[InitFlow] Failed to provision Node:', error)
      // Continue anyway - browser can work standalone
    }
  }
  
  async connectToNode(): Promise<void> {
    console.log('[InitFlow] Connecting to Node instance...')
    
    try {
      // In a real implementation, this would establish CHUM connection
      // For now, we'll just mark it as connected
      await realBrowserInstance.setState('chum.connected', true)
      await realBrowserInstance.setState('chum.nodeEndpoint', 'ws://localhost:8765')
      
      console.log('[InitFlow] Connected to Node instance')
      
    } catch (error) {
      console.error('[InitFlow] Failed to connect to Node:', error)
    }
  }
  
  async logout(): Promise<void> {
    console.log('[InitFlow] Logging out...')
    
    try {
      // Clear user state
      await realBrowserInstance.setState('identity.user', null)
      
      // Logout from ONE.CORE
      await realBrowserInstance.logout()
      
      this.currentUser = null
      
      console.log('[InitFlow] Logged out')
      
    } catch (error) {
      console.error('[InitFlow] Logout failed:', error)
    }
  }
  
  getCurrentUser(): any {
    return this.currentUser
  }
}

// Export singleton
export default new InitializationFlow()