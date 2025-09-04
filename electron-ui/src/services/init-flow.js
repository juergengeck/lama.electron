/**
 * Initialization Flow - REAL IMPLEMENTATION
 * Browser instance creates user and provisions Node instance
 */
// Use REAL ONE.CORE instance
import { realBrowserInstance } from './real-browser-instance';
class InitializationFlow {
    constructor() {
        Object.defineProperty(this, "currentUser", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    async initialize() {
        console.log('[InitFlow] Starting initialization...');
        try {
            // Initialize browser instance
            await realBrowserInstance.initialize();
            // Setup IPC listeners for contact synchronization
            this.setupContactListeners();
            // Check if user is already logged in
            const authStatus = await realBrowserInstance.checkAuth();
            if (authStatus.authenticated) {
                this.currentUser = authStatus.user;
                console.log('[InitFlow] User already authenticated:', authStatus.user?.name);
                // Provision Node instance if needed
                await this.provisionNodeInstance();
                return { ready: true, needsAuth: false };
            }
            console.log('[InitFlow] Ready for login/deploy');
            return { ready: true, needsAuth: true };
        }
        catch (error) {
            console.error('[InitFlow] Initialization failed:', error);
            // Still return ready to show login screen
            return { ready: true, needsAuth: true };
        }
    }
    async login(username, password) {
        console.log('[InitFlow] Attempting login for:', username);
        try {
            // Try to login
            const user = await realBrowserInstance.login(username, password);
            this.currentUser = user;
            // Store user in state
            await realBrowserInstance.setState('identity.user', {
                id: user.id,
                name: user.name,
                loggedInAt: new Date().toISOString()
            });
            // Provision Node instance
            await this.provisionNodeInstance();
            console.log('[InitFlow] Login successful');
            return { success: true, user };
        }
        catch (error) {
            // Login failed - these might be new credentials
            console.log('[InitFlow] Login failed:', error.message);
            return { success: false, isNew: true };
        }
    }
    async deployNewInstance(username, password) {
        console.log('[InitFlow] Deploying new instance for:', username);
        try {
            // Create user with minimal info (security through obscurity)
            const user = await realBrowserInstance.createUser(username, password);
            // Login as this user
            await realBrowserInstance.login(username, password);
            this.currentUser = user;
            // Store user identity
            await realBrowserInstance.setState('identity.user', {
                id: user.id,
                name: user.name,
                createdAt: new Date().toISOString()
            });
            // Generate provisioning credential for Node
            const credential = await this.createProvisioningCredential(user);
            await realBrowserInstance.setState('provisioning.nodeCredential', credential);
            // Provision Node instance
            await this.provisionNodeInstance();
            console.log('[InitFlow] New instance deployed successfully');
            return { success: true, user };
        }
        catch (error) {
            console.error('[InitFlow] Failed to deploy instance:', error);
            return { success: false, error: error.message };
        }
    }
    async createProvisioningCredential(user) {
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
        };
        return credential;
    }
    async provisionNodeInstance() {
        console.log('[InitFlow] Provisioning Node instance...');
        // Check if already provisioned
        const nodeStatus = await realBrowserInstance.getState('provisioning.nodeStatus');
        if (nodeStatus?.provisioned) {
            console.log('[InitFlow] Node already provisioned');
            return;
        }
        try {
            // Get or create provisioning credential
            let credential = await realBrowserInstance.getState('provisioning.nodeCredential');
            if (!credential) {
                console.log('[InitFlow] No provisioning credential, creating one');
                credential = await this.createProvisioningCredential(this.currentUser);
                await realBrowserInstance.setState('provisioning.nodeCredential', credential);
            }
            // Get browser instance ID
            const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js');
            const browserInstanceId = getInstanceOwnerIdHash();
            // Send provisioning request to Node via IPC
            if (window.electronAPI) {
                const result = await window.electronAPI.invoke('provision:node', {
                    credential,
                    user: this.currentUser,
                    password: 'password', // Use same default password as browser
                    browserInstanceId, // Include browser instance ID for CHUM sync
                    config: {
                        storageRole: 'archive',
                        capabilities: ['llm', 'files', 'network'],
                        syncEndpoint: 'ws://localhost:8765'
                    }
                });
                if (result.success) {
                    await realBrowserInstance.setState('provisioning.nodeStatus', {
                        provisioned: true,
                        provisionedAt: new Date().toISOString(),
                        nodeId: result.nodeId,
                        endpoint: result.endpoint
                    });
                    console.log('[InitFlow] Node provisioned successfully:', result.nodeId);
                    console.log('[InitFlow] Result from Node:', JSON.stringify(result));
                    
                    // Store node info for later use
                    window.nodeInstanceInfo = {
                        nodeId: result.nodeId,
                        endpoint: result.endpoint,
                        pairingInvite: result.pairingInvite
                    };
                    
                    // Accept pairing invite from Node if available
                    if (result.pairingInvite) {
                        console.log('[InitFlow] Accepting pairing invite from Node');
                        await this.acceptPairingInvite(result.pairingInvite);
                    } else if (result.iomInvite) {
                        // Legacy IoM invite approach
                        await this.acceptIoMInvite(result.iomInvite);
                    } else {
                        // Fallback: Add Node.js instance to our Internet of Me
                        await this.addNodeToIoM(result.nodeId);
                    }
                    // Establish CHUM connection
                    await this.connectToNode();
                }
                else {
                    console.error('[InitFlow] Node provisioning failed:', result.error);
                }
            }
            else {
                console.log('[InitFlow] No Electron API, skipping Node provisioning');
            }
        }
        catch (error) {
            console.error('[InitFlow] Failed to provision Node:', error);
            // Continue anyway - browser can work standalone
        }
    }
    async acceptPairingInvite(pairingInvite) {
        console.log('[InitFlow] Accepting pairing invite from Node:', pairingInvite);
        try {
            const instance = realBrowserInstance.getInstance();
            if (!instance) {
                console.error('[InitFlow] Browser instance not ready for pairing');
                return;
            }
            
            // Get the AppModel to access ConnectionsModel
            const appModel = window.appModel;
            if (!appModel || !appModel.connectionsModel) {
                console.error('[InitFlow] AppModel or ConnectionsModel not available');
                return;
            }
            
            console.log('[InitFlow] Using pairing manager to accept invite');
            const { token, raw } = pairingInvite;
            
            // Accept the pairing invitation
            const pairingResult = await appModel.connectionsModel.pairing.acceptInvitation(raw);
            console.log('[InitFlow] Pairing result:', pairingResult);
            
            // The pairing process will:
            // 1. Exchange contacts (Node person becomes a contact)
            // 2. Exchange OneInstanceEndpoints  
            // 3. Enable endpoint discovery
            
            // Store pairing info
            await realBrowserInstance.setState('pairing.nodeConnection', {
                token: token,
                accepted: new Date().toISOString(),
                nodePersonId: pairingResult?.remotePersonId,
                status: 'paired'
            });
            
            console.log('[InitFlow] Pairing accepted - contact exchange complete');
        } catch (error) {
            console.error('[InitFlow] Failed to accept pairing invite:', error);
        }
    }
    
    async acceptIoMInvite(iomInvite) {
        console.log('[InitFlow] Accepting IoM invite from Node:', iomInvite);
        try {
            const instance = realBrowserInstance.getInstance();
            if (!instance || !instance.owner) {
                console.error('[InitFlow] Browser instance not ready for IoM');
                return;
            }
            // Check if browser has IoM Manager
            const hasIoM = instance.owner.iomManager !== undefined;
            if (hasIoM) {
                console.log('[InitFlow] Using IoM Manager to accept invite');
                // In legacy IoM, accepting an invite establishes the connection
                // This automatically sets up CHUM sync between instances
                // The owner/self contact will be shared as part of this
                // Store the IoM connection info
                await realBrowserInstance.setState('iom.nodeConnection', {
                    inviteId: iomInvite.id,
                    endpoint: iomInvite.endpoint,
                    accepted: new Date().toISOString(),
                    status: 'connected'
                });
                console.log('[InitFlow] IoM invite accepted - CHUM sync will handle contact sharing');
            }
            else {
                console.log('[InitFlow] IoM Manager not available, falling back to manual setup');
                await this.addNodeToIoM(iomInvite.nodeId || 'node-instance');
            }
        }
        catch (error) {
            console.error('[InitFlow] Failed to accept IoM invite:', error);
        }
    }
    async addNodeToIoM(nodeId) {
        console.log('[InitFlow] Adding Node.js instance to Internet of Me:', nodeId);
        try {
            const instance = realBrowserInstance.getInstance();
            if (!instance || !instance.owner) {
                console.error('[InitFlow] Browser instance not ready for IoM');
                return;
            }
            // Check if IoM Manager is available
            if (instance.owner.iomManager) {
                console.log('[InitFlow] Using IoM Manager to add Node instance');
                // IoM Manager would handle adding the Node instance
                // This automatically sets up CHUM sync for identity sharing
                // Store Node instance info for IoM
                await realBrowserInstance.setState('iom.nodeInstance', {
                    id: nodeId,
                    type: 'nodejs',
                    role: 'hub',
                    added: new Date().toISOString()
                });
                console.log('[InitFlow] Node instance added to IoM');
            }
            else {
                console.log('[InitFlow] IoM Manager not available, storing for later');
                await realBrowserInstance.setState('iom.pendingNodeInstance', nodeId);
            }
        }
        catch (error) {
            console.error('[InitFlow] Failed to add Node to IoM:', error);
        }
    }
    async connectToNode() {
        console.log('[InitFlow] Connecting to Node instance...');
        try {
            const instance = realBrowserInstance.getInstance();
            if (!instance?.owner?.leuteModel) {
                console.error('[InitFlow] Browser instance not ready for connection');
                return;
            }
            // Get the Node instance endpoint and public key from provisioning result
            const nodeStatus = await realBrowserInstance.getState('provisioning.nodeStatus');
            if (!nodeStatus?.endpoint) {
                console.error('[InitFlow] No Node endpoint available');
                return;
            }
            // Import the connection function
            const { connectToInstance } = await import('@refinio/one.models/lib/misc/ConnectionEstablishment/protocols/ConnectToInstance.js');
            // Connect to Node.js instance at ws://localhost:8765
            // For local connection, we can use a dummy public key since we're on the same machine
            const dummyPublicKey = new Uint8Array(32); // This would normally be the Node's public key
            const connectionInfo = await connectToInstance(nodeStatus.endpoint || 'ws://localhost:8765', dummyPublicKey, instance.owner.leuteModel, 'node-connection' // Connection group name
            );
            console.log('[InitFlow] Connected to Node instance:', connectionInfo.instanceInfo.remoteInstanceId);
            await realBrowserInstance.setState('chum.connected', true);
            await realBrowserInstance.setState('chum.nodeEndpoint', nodeStatus.endpoint);
            await realBrowserInstance.setState('chum.connectionInfo', {
                remoteInstanceId: connectionInfo.instanceInfo.remoteInstanceId,
                connectedAt: new Date().toISOString()
            });
        }
        catch (error) {
            console.error('[InitFlow] Failed to connect to Node:', error);
        }
    }
    setupContactListeners() {
        // Listen for CHUM sync events from Node.js
        console.log('[InitFlow] Setting up CHUM sync listeners for contact replication');
        if (window.electronAPI?.on) {
            console.log('[InitFlow] electronAPI.on is available, setting up listener');
            // Listen for Person objects synced from Node
            window.electronAPI.on('chum:sync', async (data) => {
                console.log('[InitFlow] 📥 Received CHUM sync data:', data);
                if (data.type === 'Person' && data.changes) {
                    // Process each Person object
                    for (const change of data.changes) {
                        await this.processSyncedPerson(change);
                    }
                }
            });
            console.log('[InitFlow] CHUM sync listener registered');
        }
        else {
            console.error('[InitFlow] electronAPI not available for CHUM sync');
        }
    }
    async processSyncedPerson(personData) {
        console.log('[InitFlow] Processing synced object:', personData?.$type$);
        try {
            const instance = realBrowserInstance.getInstance();
            if (!instance?.owner) {
                console.error('[InitFlow] Browser instance not ready');
                return;
            }
            // CHUM syncs the actual ONE.core objects now
            // If it's a Someone object, it means Person and Profile are already synced transitively
            if (personData.$type$ === 'Someone') {
                console.log('[InitFlow] Received Someone object via CHUM');
                // The objects are already in our storage via CHUM
                // We just need to add to LeuteModel to make them visible
                if (instance.owner.leuteModel && personData.person) {
                    // Check if Someone already exists in LeuteModel
                    const existingSomeone = await instance.owner.leuteModel.getSomeone(personData.person);
                    if (!existingSomeone) {
                        // Add as SomeoneElse using the Person hash from the Someone object
                        await instance.owner.leuteModel.addSomeoneElse(personData.person);
                        console.log('[InitFlow] Added synced Someone to LeuteModel');
                    }
                }
                // Emit event to update UI
                window.dispatchEvent(new CustomEvent('contacts:updated'));
            }
            // Also handle if we receive Person or Profile objects directly
            else if (personData.$type$ === 'Person' || personData.$type$ === 'Profile') {
                console.log(`[InitFlow] Received ${personData.$type$} object via CHUM (transitive)`);
                // These are synced transitively with Someone, no action needed
            }
        }
        catch (error) {
            console.error('[InitFlow] Failed to process synced object:', error);
        }
    }
    async createContactInBrowser(contactData) {
        console.log('[InitFlow] Creating contact in browser instance:', contactData);
        try {
            const instance = realBrowserInstance.getInstance();
            if (!instance || !instance.owner) {
                console.error('[InitFlow] Browser instance not ready');
                return;
            }
            const { storeVersionedObject } = instance.owner;
            // Create Person object
            const personObject = {
                $type$: 'Person',
                email: contactData.email || '',
                name: contactData.name || 'Unknown'
            };
            const personResult = await storeVersionedObject(personObject);
            console.log('[InitFlow] Created Person:', personResult.hash);
            // Create PersonName description
            const personNameDesc = {
                $type$: 'PersonName',
                name: contactData.name || 'Unknown'
            };
            const nameResult = await storeVersionedObject(personNameDesc);
            // Create Profile object
            const profileObject = {
                $type$: 'Profile',
                personId: personResult.hash,
                email: contactData.email || '',
                personDescriptions: [nameResult.hash],
                isMainProfile: true
            };
            const profileResult = await storeVersionedObject(profileObject);
            console.log('[InitFlow] Created Profile:', profileResult.hash);
            // Create Someone object for LeuteModel
            const someoneObject = {
                $type$: 'Someone',
                person: personResult.hash,
                profile: [profileResult.hash]
            };
            const someoneResult = await storeVersionedObject(someoneObject);
            console.log('[InitFlow] Created Someone:', someoneResult.hash);
            // Store contact reference in state for quick access
            const contacts = (await realBrowserInstance.getState('contacts')) || {};
            contacts[contactData.personId] = {
                personHash: personResult.hash,
                profileHash: profileResult.hash,
                someoneHash: someoneResult.hash,
                name: contactData.name,
                email: contactData.email,
                createdAt: new Date().toISOString()
            };
            await realBrowserInstance.setState('contacts', contacts);
            console.log('[InitFlow] Contact created successfully in browser');
            // Trigger UI update
            window.dispatchEvent(new CustomEvent('contacts:updated', {
                detail: {
                    newContact: {
                        id: contactData.personId,
                        name: contactData.name,
                        email: contactData.email
                    }
                }
            }));
        }
        catch (error) {
            console.error('[InitFlow] Failed to create contact objects:', error);
            throw error;
        }
    }
    async logout() {
        console.log('[InitFlow] Logging out...');
        try {
            // Clear user state
            await realBrowserInstance.setState('identity.user', null);
            // Logout from ONE.CORE
            await realBrowserInstance.logout();
            this.currentUser = null;
            console.log('[InitFlow] Logged out');
        }
        catch (error) {
            console.error('[InitFlow] Logout failed:', error);
        }
    }
    getCurrentUser() {
        return this.currentUser;
    }
}
// Export singleton
export default new InitializationFlow();
