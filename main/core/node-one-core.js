/**
 * Node.js ONE.core Instance using one.leute.replicant template
 * Proper initialization following the template pattern
 */
// Polyfill WebSocket for Node.js environment
import { WebSocket } from 'ws';
global.WebSocket = WebSocket;
import path from 'path';
import { fileURLToPath } from 'url';
import AIAssistantModel from './ai-assistant-model.js';
import RefinioApiServer from '../api/refinio-api-server.js';
import TopicGroupManager from './topic-group-manager.js';
import TopicAnalysisModel from './one-ai/models/TopicAnalysisModel.js';
// Import ONE.core model classes at the top as singletons
// These will be instantiated after platform loading but importing them
// here prevents dynamic loading state corruption
import LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';
import ProfileModel from '@refinio/one.models/lib/models/Leute/ProfileModel.js';
import SomeoneModel from '@refinio/one.models/lib/models/Leute/SomeoneModel.js';
import GroupModel from '@refinio/one.models/lib/models/Leute/GroupModel.js';
import ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js';
import ConnectionsModel from '@refinio/one.models/lib/models/ConnectionsModel.js';
import TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js';
import { storeVersionObjectAsChange } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { BrowserWindow } from 'electron';
// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
class NodeOneCore {
  appStateModel;
  multiUserModel;
  localWsServer;
  instanceModule;
  aiAssistantModel;
  apiServer;
  topicGroupManager;
  federationGroup;
  onPairingStarted;
  onPairingFailed;
  getChannelInfos;
  author;
  substring;
  content;
  text;
  on;
  getDefaultModel;
  generateResponse;
  description;
  // Required properties from interface
  initialized;
  instanceName;
  ownerId;
  leuteModel;
  channelManager;
  topicModel;
  connectionsModel;
  settingsStore; // ONE.core settings management
  isReady;
  instanceId;
  localInstanceId;
  models;
  topicAnalysisModel;
  commServerModel;
  llmManager;
  llmObjectManager;
  // Additional properties
  oneAuth;
  grantedAccessPeers;
  quicTransport;
  email;
  contentSharing;
  federationAPI;
  aiMessageListener;
  peerMessageListener;
  aiPersonIds;
  directListenerStopFn;
  wss;
  replicantGroup;
  aiAssistant;
  quickReply;
  messageSyncInterval;
  accessRightsManager;
  initFailed;
  directSocketStopFn;
  constructor() {
    this.initialized = false;
    this.instanceName = ''; // Initialize as empty string instead of null
    this.ownerId = ''; // Will be properly set during initialization
    this.leuteModel = null; // Will be initialized during setup
    this.appStateModel = null;
    this.connectionsModel = null; // Will be initialized during setup
    this.channelManager = null; // Will be initialized during setup
    this.topicModel = null; // Will be initialized during setup
    this.settingsStore = null;
    this.multiUserModel = null;
    this.isReady = false;
    this.oneAuth = null; // Will be initialized during setup
    this.localWsServer = null;
    this.instanceModule = null; // Track the instance module
    this.aiAssistantModel = null; // Will be initialized after models are ready
    this.apiServer = null; // Refinio API server
    this.topicGroupManager = null; // Will be initialized after models are ready
    this.federationGroup = null; // Track federation group for access
    this.grantedAccessPeers = new Set(); // Track peers we've already granted access to
  }
  /**
   * Grant a peer access to our main profile and P2P channel
   * Centralized method to avoid duplication
   */
  async grantPeerAccess(remotePersonId, context = 'unknown') {
    if (!remotePersonId || !this.leuteModel) {
      console.warn(
        '[NodeOneCore] Cannot grant peer access - missing requirements'
      );
      return;
    }
    // Avoid duplicate grants
    if (this.grantedAccessPeers.has(remotePersonId)) {
      console.log(
        `[NodeOneCore] Already granted access to peer: ${String(remotePersonId).substring(0, 8)}`
      );
      return;
    }
    const { createAccess } = await import('@refinio/one.core/lib/access.js');
    const { SET_ACCESS_MODE } = await import(
      '@refinio/one.core/lib/storage-base-common.js'
    );
    const { calculateIdHashOfObj } = await import(
      '@refinio/one.core/lib/util/object.js'
    );
    console.log(
      `[NodeOneCore] Granting peer access (${context}):`,
      String(remotePersonId).substring(0, 8)
    );
    // 1. Grant access to our main profile only
    try {
      const me = await this.leuteModel.me();
      const mainProfile = await me.mainProfile();
      if (mainProfile && mainProfile.idHash) {
        await createAccess([
          {
            id: mainProfile.idHash,
            person: [remotePersonId],
            group: [],
            mode: SET_ACCESS_MODE.ADD,
          },
        ]);
        console.log('[NodeOneCore] ✅ Granted access to our main profile');
      }
    } catch (error) {
      console.warn(
        '[NodeOneCore] Failed to grant profile access:',
        error.message
      );
    }
    // 2. Grant access to P2P channel
    try {
      const myId = this.ownerId;
      const p2pChannelId =
        myId < remotePersonId
          ? `${myId}<->${remotePersonId}`
          : `${remotePersonId}<->${myId}`;
      const p2pChannelInfoHash = await calculateIdHashOfObj({
        $type$: 'ChannelInfo',
        id: p2pChannelId,
        owner: undefined, // P2P channels have no owner
      });
      await createAccess([
        {
          id: p2pChannelInfoHash,
          person: [remotePersonId],
          group: [],
          mode: SET_ACCESS_MODE.ADD,
        },
      ]);
      console.log('[NodeOneCore] ✅ Granted P2P channel access:', p2pChannelId);
    } catch (error) {
      console.warn(
        '[NodeOneCore] Failed to grant P2P channel access:',
        error.message
      );
    }
    // Mark this peer as having been granted access
    this.grantedAccessPeers.add(remotePersonId);
  }
  /**
   * Initialize Node.js ONE.core using the proper template
   */
  async initialize(username, password) {
    if (this.initialized) {
      console.log('[NodeOneCore] Already initialized');
      return {
        success: true,
        ownerId: this.ownerId,
        instanceName: this.instanceName,
      };
    }
    // Use different instance name for Node
    this.instanceName = `lama-node-${username}`;
    console.log(
      `[NodeOneCore] Initializing Node instance for browser user: ${username}`
    );
    // No patching needed - fixed in ONE.models source
    try {
      // ONE.core manages storage - we just specify the base directory
      const storageDir = path.join(process.cwd(), 'OneDB');
      // Initialize ONE.core instance with browser credentials
      await this.initOneCoreInstance(username, password, storageDir);
      // Set initialized before models so instance manager can work
      this.initialized = true;
      // Initialize models in proper order
      await this.initializeModels();
      console.log(`[NodeOneCore] Initialized successfully`);
      return {
        success: true,
        ownerId: this.ownerId,
        name: this.instanceName,
      };
    } catch (error) {
      console.error('[NodeOneCore] Initialization failed:', error);
      this.initialized = false;
      // Clean up on failure to allow retry
      await this.cleanup();
      return {
        success: false,
        error: error.message,
      };
    }
  }
  /**
   * Initialize ONE.core instance using SingleUserNoAuth (same as browser)
   */
  async initOneCoreInstance(username, password, directory) {
    // Ensure storage directory exists
    const fs = await import('fs');
    const oneDbPath = directory; // Define oneDbPath to match the parameter
    // ONE.core will manage its own internal storage structure
    // We just ensure the base directory exists
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
      console.log('[NodeOneCore] Created storage directory:', directory);
    }
    // Load Node.js platform FIRST - before any other ONE.core imports
    console.log('[NodeOneCore] Loading Node.js platform...');
    await import('@refinio/one.core/lib/system/load-nodejs.js');
    console.log('[NodeOneCore] ✅ Node.js platform loaded');
    // Now safe to import ONE.core modules
    const { closeInstance } = await import('@refinio/one.core/lib/instance.js');
    // Ensure clean slate - close any existing instance singleton
    try {
      closeInstance();
      console.log(
        '[NodeOneCore] Closed existing ONE.core singleton for clean init'
      );
    } catch (e) {
      // OK if there was no existing instance
    }
    // Import SingleUserNoAuth - same as browser and one.leute
    const { default: SingleUserNoAuth } = await import(
      '@refinio/one.models/lib/models/Authenticator/SingleUserNoAuth.js'
    );
    const { getInstanceOwnerIdHash } = await import(
      '@refinio/one.core/lib/instance.js'
    );
    // Use DIFFERENT email from browser to enable federation
    // ConnectionsModel won't connect instances with the same person ID
    const instanceName = `lama-node-${username}`;
    const email = `node-${username}@lama.local`; // Different email for federation to work
    console.log(
      '[NodeOneCore] Using SingleUserNoAuth pattern for Node instance:',
      email
    );
    // Import recipes following one.leute pattern
    const RecipesStable = (
      await import('@refinio/one.models/lib/recipes/recipes-stable.js')
    ).default;
    const RecipesExperimental = (
      await import('@refinio/one.models/lib/recipes/recipes-experimental.js')
    ).default;
    const { LamaRecipes } = await import('../recipes/index.js');
    const { StateEntryRecipe, AppStateJournalRecipe } = await import(
      '@refinio/refinio-api/dist/state/index.js'
    );
    // Import reverse maps
    const { ReverseMapsStable, ReverseMapsForIdObjectsStable } = await import(
      '@refinio/one.models/lib/recipes/reversemaps-stable.js'
    );
    const { ReverseMapsExperimental, ReverseMapsForIdObjectsExperimental } =
      await import(
        '@refinio/one.models/lib/recipes/reversemaps-experimental.js'
      );
    // Create SingleUserNoAuth instance - same pattern as one.leute
    const allRecipes = [
      ...RecipesStable,
      ...RecipesExperimental,
      ...(LamaRecipes || []),
      StateEntryRecipe,
      AppStateJournalRecipe,
    ];
    console.log(
      '[NodeOneCore] Creating SingleUserNoAuth with',
      allRecipes?.length,
      'recipes'
    );
    console.log(
      '[NodeOneCore] First 5 recipe names:',
      allRecipes.slice(0, 5).map((r) => r.name)
    );
    // Check specifically for Person recipe
    const personRecipe = allRecipes.find((r) => r.name === 'Person');
    console.log('[NodeOneCore] Person recipe found:', !!personRecipe);
    // Debug: Check for LLM recipe and its structure
    const llmRecipes = allRecipes.filter((r) => r.name === 'LLM');
    console.log('[NodeOneCore] Found', llmRecipes?.length, 'LLM recipe(s)');
    if (llmRecipes?.length > 0) {
      llmRecipes.forEach((recipe, index) => {
        const rules = recipe.rule;
        const idField = rules?.find((r) => r.isId === true);
        console.log(
          `[NodeOneCore] LLM Recipe #${index + 1} ID field:`,
          idField?.itemprop || 'NO ID FIELD'
        );
        console.log(
          `[NodeOneCore] LLM Recipe #${index + 1} has ${rules?.length || 0} rules`
        );
      });
    }
    console.log(
      '[NodeOneCore] LamaRecipes:',
      LamaRecipes?.map((r) => r.name).join(', ')
    );
    this.oneAuth = new SingleUserNoAuth({
      recipes: allRecipes,
      reverseMaps: new Map([
        ...(ReverseMapsStable || []),
        ...(ReverseMapsExperimental || []),
      ]),
      reverseMapsForIdObjects: new Map([
        ...(ReverseMapsForIdObjectsStable || []),
        ...(ReverseMapsForIdObjectsExperimental || []),
      ]),
      storageInitTimeout: 20000,
    });
    try {
      // Check if already registered
      console.log('[NodeOneCore] Checking if instance is registered...');
      console.log('[NodeOneCore] Current OneDB path:', oneDbPath);
      console.log('[NodeOneCore] Checking with credentials:', {
        email,
        instanceName,
      });

      // Wrap isRegistered() with timeout to prevent hanging
      const isRegisteredPromise = this.oneAuth.isRegistered();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('isRegistered() timed out after 5s')), 5000)
      );

      let isRegistered;
      try {
        isRegistered = await Promise.race([isRegisteredPromise, timeoutPromise]);
        console.log('[NodeOneCore] isRegistered() returned:', isRegistered);
      } catch (timeoutError) {
        console.warn('[NodeOneCore] isRegistered() timed out, assuming not registered');
        console.warn('[NodeOneCore] This is a known issue with ONE.core beta-3');
        isRegistered = false;
      }
      if (isRegistered) {
        console.log('[NodeOneCore] Instance already registered, logging in...');
        await this.oneAuth.login();
      } else {
        console.log(
          '[NodeOneCore] Instance not found as registered, calling register()'
        );
        console.log(
          '[NodeOneCore] Registering new instance with email:',
          email
        );
        await this.oneAuth.register({
          email: email,
          instanceName: instanceName,
          secret: password,
        });
      }
      // Get owner ID AFTER proper authentication
      this.ownerId = getInstanceOwnerIdHash();
      this.instanceName = instanceName;
      // Verify owner ID is available
      if (!this.ownerId) {
        throw new Error('Owner ID not available after authentication');
      }
      console.log('[NodeOneCore] ONE.core instance initialized successfully');
      console.log('[NodeOneCore] Owner ID:', this.ownerId);
      console.log('[NodeOneCore] Instance name:', this.instanceName);
      // After authentication, explicitly register our custom recipes with the runtime
      // This ensures they're available for storeVersionedObject calls
      const { addRecipeToRuntime, hasRecipe } = await import(
        '@refinio/one.core/lib/object-recipes.js'
      );
      // Register LamaRecipes
      for (const recipe of LamaRecipes) {
        if (!hasRecipe(recipe.name)) {
          console.log(`[NodeOneCore] Registering recipe: ${recipe.name}`);
          addRecipeToRuntime(recipe);
          // Debug: Verify the recipe was added correctly
          if (recipe.name === 'LLM') {
            const idField = recipe.rule?.find((r) => r.isId === true);
            console.log(
              `[NodeOneCore] LLM Recipe registered with ID field: ${idField?.itemprop}`
            );
          }
        }
      }
      // Register AppState recipes
      if (!hasRecipe(StateEntryRecipe.name)) {
        console.log(
          `[NodeOneCore] Registering recipe: ${StateEntryRecipe.name}`
        );
        addRecipeToRuntime(StateEntryRecipe);
      }
      if (!hasRecipe(AppStateJournalRecipe.name)) {
        console.log(
          `[NodeOneCore] Registering recipe: ${AppStateJournalRecipe.name}`
        );
        addRecipeToRuntime(AppStateJournalRecipe);
      }
    } catch (e) {
      console.error('[NodeOneCore] Authentication failed:', e);
      throw e;
    }
  }
  /**
   * Monitor pairing and CHUM transitions
   * ConnectionsModel handles the transition automatically
   */
  setupConnectionMonitoring() {
    console.log('[NodeOneCore] Setting up connection monitoring...');
    // Register pairing callbacks - must be done BEFORE init (like one.leute.replicant)
    if (this.connectionsModel?.pairing) {
      console.log('[NodeOneCore] Registering pairing event handlers...');
      this.connectionsModel.pairing.onPairingStarted?.((token) => {
        console.log(
          '[NodeOneCore] 🤝 PAIRING STARTED - Token:',
          token?.substring(0, 20) + '...'
        );
      });
      this.connectionsModel.pairing.onPairingFailed?.((error) => {
        console.log('[NodeOneCore] ❌ PAIRING FAILED:', error);
      });
      // Handle successful pairing - create Someone and Profile
      this.connectionsModel.pairing.onPairingSuccess(
        async (
          initiatedLocally,
          localPersonId,
          localInstanceId,
          remotePersonId,
          remoteInstanceId,
          token
        ) => {
          console.log('[NodeOneCore] ✅ PAIRING SUCCESS EVENT TRIGGERED');
          console.log(
            '[NodeOneCore] ═══════════════════════════════════════════'
          );
          console.log('[NodeOneCore] 📊 Pairing Details:');
          console.log('[NodeOneCore]   • Initiated locally:', initiatedLocally);
          console.log(
            '[NodeOneCore]   • Local person:',
            localPersonId?.substring(0, 8) || 'null'
          );
          console.log(
            '[NodeOneCore]   • Local instance:',
            localInstanceId?.substring(0, 8) || 'null'
          );
          console.log(
            '[NodeOneCore]   • Remote person:',
            remotePersonId?.substring(0, 8) || 'null'
          );
          console.log(
            '[NodeOneCore]   • Remote instance:',
            remoteInstanceId?.substring(0, 8) || 'null'
          );
          console.log(
            '[NodeOneCore] ═══════════════════════════════════════════'
          );
          console.log('[NodeOneCore] 🔧 Starting remote contact setup...');
          // CRITICAL: Establish trust first (like one.leute does)
          if (remotePersonId && this.leuteModel) {
            try {
              // Step 1: Trust establishment (must come first)
              console.log(
                '[NodeOneCore] 🔐 Step 1: Establishing trust with remote peer...'
              );
              const { completePairingTrust } = await import(
                './pairing-trust-handler.js'
              );
              const trustResult = await completePairingTrust({
                trust: this.leuteModel.trust,
                leuteModel: this.leuteModel,
                initiatedLocally,
                localPersonId,
                localInstanceId,
                remotePersonId,
                remoteInstanceId,
                token,
              });
              if (trustResult.success) {
                console.log('[NodeOneCore] ✅ Trust established successfully!');
              } else {
                console.warn(
                  '[NodeOneCore] ⚠️ Trust establishment had issues:',
                  trustResult
                );
              }
              // Step 2: Create address book entry
              console.log(
                '[NodeOneCore] 📁 Step 2: Creating address book entry...'
              );
              // Use the proper contact creation helper that uses ONE.models APIs
              const { handleNewConnection } = await import(
                './contact-creation-proper.js'
              );
              const someone = await handleNewConnection(
                remotePersonId,
                this.leuteModel
              );
              console.log(
                '[NodeOneCore] ✅ Address book entry created successfully!'
              );
              console.log(
                '[NodeOneCore]   • Someone ID:',
                someone?.idHash?.toString()?.substring(0, 8) || 'null'
              );
              // Step 3: Auto-create P2P topic for immediate messaging
              console.log(
                '[NodeOneCore] 💬 Step 3: Creating P2P topic for messaging...'
              );
              const { autoCreateP2PTopicAfterPairing } = await import(
                './p2p-topic-creator.js'
              );
              const topicRoom = await autoCreateP2PTopicAfterPairing({
                topicModel: this.topicModel,
                channelManager: this.channelManager,
                localPersonId,
                remotePersonId,
                initiatedLocally,
              });
              if (topicRoom) {
                console.log('[NodeOneCore] ✅ P2P topic ready for messaging!');
              } else {
                console.warn('[NodeOneCore] ⚠️ Could not create P2P topic');
              }
              // Log the profile info
              if (someone?.mainProfile) {
                try {
                  const profile =
                    typeof someone.mainProfile === 'function'
                      ? await someone.mainProfile()
                      : someone.mainProfile;
                  console.log(
                    '[NodeOneCore]   • Profile ID:',
                    profile?.idHash?.toString()?.substring(0, 8) || 'null'
                  );
                } catch (e) {
                  console.log('[NodeOneCore]   • Profile info not available');
                }
              }
              // Grant access to our profile
              console.log(
                '[NodeOneCore] 🔓 Granting mutual access permissions...'
              );
              await this.grantPeerAccess(remotePersonId, 'pairing');
              console.log('[NodeOneCore] ✅ Access permissions granted');
              console.log(
                '[NodeOneCore] ═══════════════════════════════════════════'
              );
              console.log(
                '[NodeOneCore] 🎉 PAIRING COMPLETE - Remote contact is ready!'
              );
            } catch (error) {
              console.error(
                '[NodeOneCore] ❌ Failed to create address book entry:',
                error
              );
              console.error('[NodeOneCore]    Error stack:', error.stack);
            }
          } else {
            console.log('[NodeOneCore] ⚠️ Cannot create contact:', {
              hasRemotePersonId: !!remotePersonId,
              hasLeuteModel: !!this.leuteModel,
            });
          }
          // ConnectionsModel will handle the transition to CHUM automatically
        }
      );
      console.log('[NodeOneCore] ✅ Pairing callbacks registered');
    } else {
      console.log('[NodeOneCore] ⚠️  Pairing module not available');
    }
  }
  /**
   * Initialize models in proper order following template
   */
  async initializeModels() {
    console.log('[NodeOneCore] Initializing models...');
    // Define commserver URL for external connections
    const commServerUrl = 'wss://comm10.dev.refinio.one';
    // Initialize object events (handle already initialized case)
    const { objectEvents } = await import(
      '@refinio/one.models/lib/misc/ObjectEventDispatcher.js'
    );
    try {
      await objectEvents.init();
      console.log('[NodeOneCore] ✅ ObjectEventDispatcher initialized');
      // TRACE: Log ALL objects received via CHUM to debug
      objectEvents.onNewVersion(async (result) => {
        const obj = result?.obj;
        // Commented out excessive logging - was creating 30+ logs during init
        // console.log('[NodeOneCore] 📨 OBJECT RECEIVED:', {
        //   type: obj.$type$,
        //   text: obj.text?.substring?.(0, 30),
        //   author: obj.author?.substring?.(0, 8),
        //   sender: obj.sender?.substring?.(0, 8)
        // })
        if (obj.$type$ === 'ChannelInfo') {
          console.log('[NodeOneCore] 📨 NODE: Received ChannelInfo via CHUM!', {
            channelId: obj.id,
            owner: obj.owner?.substring(0, 8),
          });
        }
        // Handle Profile objects received via CHUM
        if (obj.$type$ === 'Profile' && obj.personId) {
          console.log('[NodeOneCore] 📨 NODE: Received Profile via CHUM!', {
            personId: obj.personId?.substring(0, 8),
            name: obj.name || 'No name',
          });
          // Update the Someone object with this Profile using proper APIs
          if (this.leuteModel) {
            try {
              const { handleReceivedProfile } = await import(
                './contact-creation-proper.js'
              );
              await handleReceivedProfile(obj.personId, obj, this.leuteModel);
              console.log('[NodeOneCore] ✅ Handled received Profile data');
            } catch (error) {
              console.error(
                '[NodeOneCore] Failed to handle received Profile:',
                error
              );
            }
          }
        }
        // Handle TopicMessage objects received via CHUM
        if (obj.$type$ === 'TopicMessage') {
          console.log(
            '[NodeOneCore] 📨 NODE: Received TopicMessage via CHUM!',
            {
              text: obj.text?.substring(0, 50) || 'No text',
              author: obj.author?.substring(0, 8),
              timestamp: obj.creationTime,
            }
          );
          // Get the channel this message belongs to
          if (this.channelManager && this.topicModel) {
            try {
              // Find the channel this message belongs to
              const allChannels = await this.channelManager.getChannelInfos();
              // Notify UI about new message
              const windows = BrowserWindow.getAllWindows();
              // For each channel, check if this message belongs to it
              for (const channelInfo of allChannels) {
                const channelId = channelInfo.id;
                try {
                  const topicRoom =
                    await this.topicModel.enterTopicRoom(channelId);
                  if (topicRoom) {
                    // Check if this message is in this topic
                    const messages = await topicRoom.retrieveAllMessages();
                    const hasMessage = messages.some(
                      (msg) =>
                        msg.data?.text === obj.text &&
                        msg.data?.author === obj.author
                    );
                    if (hasMessage) {
                      console.log(
                        '[NodeOneCore] 📬 Message belongs to channel:',
                        channelId
                      );
                      // Send notification to UI
                      windows.forEach((window) => {
                        window.webContents.send('chat:newMessages', {
                          conversationId: channelId,
                          messages: [
                            {
                              id: obj.idHash || `msg-${Date.now()}`,
                              conversationId: channelId,
                              text: obj.text || '',
                              sender: obj.author,
                              timestamp: obj.creationTime
                                ? new Date(obj.creationTime).toISOString()
                                : new Date().toISOString(),
                              status: 'received',
                              isAI: false,
                            },
                          ],
                          source: 'chum-direct',
                        });
                      });
                      break; // Found the channel, stop searching
                    }
                  }
                } catch (e) {
                  // Not a topic channel, continue
                }
              }
            } catch (error) {
              console.error(
                '[NodeOneCore] Error processing TopicMessage:',
                error
              );
            }
          }
        }
      });
    } catch (error) {
      // If it's already initialized, that's fine
      if (error.message?.includes('already initialized')) {
        console.log(
          '[NodeOneCore] ObjectEventDispatcher already initialized, continuing...'
        );
      } else {
        throw error;
      }
    }
    // Initialize LeuteModel with commserver for external connections
    console.log('[NodeOneCore] About to initialize LeuteModel...');
    // Double-check owner ID is still available
    const { getInstanceOwnerIdHash: checkOwnerIdHash } = await import(
      '@refinio/one.core/lib/instance.js'
    );
    const currentOwnerId = checkOwnerIdHash();
    console.log(
      '[NodeOneCore] Current owner ID before LeuteModel init:',
      currentOwnerId
    );
    console.log(
      '[NodeOneCore] This.ownerId before LeuteModel init:',
      this.ownerId
    );
    if (!currentOwnerId) {
      throw new Error('Owner ID disappeared before LeuteModel initialization');
    }
    // Use the imported LeuteModel class - no dynamic import
    this.leuteModel = new LeuteModel(commServerUrl, true); // true = create everyone group
    this.leuteModel.appId = 'one.leute';
    console.log(
      '[NodeOneCore] LeuteModel created with appId: one.leute, calling init()...'
    );
    // Patch LeuteModel's createGroupInternal to handle frozen arrays
    const originalCreateGroupInternal =
      this.leuteModel.createGroupInternal.bind(this.leuteModel);
    this.leuteModel.createGroupInternal = async function (name, creationTime) {
      try {
        // Try the original method first
        return await originalCreateGroupInternal(name, creationTime);
      } catch (error) {
        if (error.message.includes('not extensible')) {
          console.log(
            '[NodeOneCore] Working around frozen groups array for group:',
            name
          );
          // Manually create the group and update the Leute object
          const group = await GroupModel.constructWithNewGroup(
            name,
            creationTime
          );
          const currentLeute = this.leute;
          if (currentLeute) {
            // Create a new Leute object with the updated group array
            // Filter out any null/undefined values and ensure we have valid hashes
            const existingGroups = (currentLeute.group || []).filter(
              (g) => g && typeof g === 'string'
            );
            const newGroups = [...existingGroups];
            // Only add the new group if it has a valid idHash
            if (group && group.idHash) {
              newGroups?.push(group.idHash);
            }
            const newLeute = {
              $type$: currentLeute.$type$,
              appId: currentLeute.appId || 'one.leute', // Ensure appId is present (recipe requires 'one.leute')
              me: currentLeute.me,
              other: currentLeute.other || [],
              group: newGroups, // Array of valid group hashes only
            };
            // Store the new version
            const result = await storeVersionObjectAsChange(newLeute);
            // Update the model's internal references
            this.leute = result?.obj;
            this.pLoadedVersion = result?.hash;
            console.log('[NodeOneCore] ✅ Added group via workaround:', name);
          }
          return group;
        } else {
          throw error;
        }
      }
    }.bind(this.leuteModel);

    // Patch LeuteModel's addSomeoneElse to handle frozen arrays
    const originalAddSomeoneElse =
      this.leuteModel.addSomeoneElse.bind(this.leuteModel);
    this.leuteModel.addSomeoneElse = async function (other) {
      try {
        // Try the original method first
        return await originalAddSomeoneElse(other);
      } catch (error) {
        if (
          error.message.includes('read only property') ||
          error.message.includes('not extensible')
        ) {
          console.log(
            '[NodeOneCore] Working around frozen other array for contact:',
            other?.toString().substring(0, 8)
          );
          const currentLeute = this.leute;
          if (currentLeute) {
            // Create a new Leute object with the updated other array
            const existingOthers = (currentLeute.other || []).filter(
              (o) => o && typeof o === 'string'
            );
            const newOthers = new Set(existingOthers);
            newOthers.add(other);
            const newLeute = {
              $type$: currentLeute.$type$,
              appId: currentLeute.appId || 'one.leute',
              me: currentLeute.me,
              other: [...newOthers],
              group: currentLeute.group || [],
            };
            // Store the new version
            const result = await storeVersionObjectAsChange(newLeute);
            // Update the model's internal references
            this.leute = result?.obj;
            this.pLoadedVersion = result?.hash;
            console.log(
              '[NodeOneCore] ✅ Added contact via workaround:',
              other?.toString().substring(0, 8)
            );
          }
          return;
        } else {
          throw error;
        }
      }
    }.bind(this.leuteModel);

    await this.leuteModel.init();
    console.log(
      '[NodeOneCore] ✅ LeuteModel initialized with commserver:',
      commServerUrl
    );
    // Set up listener for new profiles discovered through CHUM
    this.leuteModel.onProfileUpdate(async (profileIdHash) => {
      try {
        // Check if this is a new contact
        const allContacts = await this.leuteModel.others();
        console.log(
          `[NodeOneCore] Profile update detected, total contacts: ${allContacts?.length}`
        );
        // Notify browser about contact list changes
        const { BrowserWindow } = await import('electron');
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
          mainWindow?.webContents.send('contacts:updated', {
            count: allContacts?.length,
            profileIdHash,
          });
        }
      } catch (error) {
        console.error('[NodeOneCore] Error handling profile update:', error);
      }
    });
    // Now that LeuteModel is initialized, get the person ID (but keep instance owner ID)
    // And create/update our profile with a proper name
    try {
      const me = await this.leuteModel.me();
      if (me) {
        const personId = await me.mainIdentity();
        if (personId) {
          // DO NOT overwrite this.ownerId - it should remain the instance owner ID hash
          console.log('[NodeOneCore] Person ID from LeuteModel:', personId);
          console.log('[NodeOneCore] Keeping instance owner ID:', this.ownerId);
          // Create or update our profile with PersonName
          try {
            const profile = await me.mainProfile();
            // Check if we already have a PersonName
            const hasName = profile.personDescriptions?.some(
              (d) => d.$type$ === 'PersonName'
            );
            if (!hasName) {
              console.log('[NodeOneCore] Adding PersonName to our profile');
              // Extract username from email (e.g., "demo" from "node-demo@lama.local")
              let displayName = 'LAMA User';
              if (this.email) {
                const emailParts = this.email.split('@');
                const userPart = emailParts[0];
                // Remove "node-" prefix if present
                displayName = userPart.replace(/^node-/, '');
                // Capitalize first letter
                displayName =
                  displayName.charAt(0).toUpperCase() + displayName.slice(1);
              }
              // Add PersonName to profile
              profile.personDescriptions = profile.personDescriptions || [];
              profile.personDescriptions?.push({
                $type$: 'PersonName',
                name: displayName,
              });
              // Save the updated profile
              await profile.saveAndLoad();
              console.log(
                `[NodeOneCore] ✅ Profile updated with name: ${displayName}`
              );
            }
          } catch (profileError) {
            console.warn(
              '[NodeOneCore] Could not update profile with name:',
              profileError
            );
          }
        }
      }
    } catch (error) {
      console.error(
        '[NodeOneCore] Failed to get person ID from LeuteModel:',
        error
      );
    }
    // Initialize Content Sharing Manager for Browser<->Node sync
    // This creates and manages Access objects for content sharing
    const { default: ContentSharingManager } = await import(
      './content-sharing.js'
    );
    this.contentSharing = new ContentSharingManager(this);
    console.log('[NodeOneCore] ✅ Content Sharing Manager initialized');
    // Remove browser access - browser has no ONE instance
    // Initialize ChannelManager - needs leuteModel
    // Use the imported ChannelManager class - no dynamic import
    this.channelManager = new ChannelManager(this.leuteModel);
    await this.channelManager.init();
    console.log('[NodeOneCore] ✅ ChannelManager initialized');
    // Set up proper access rights using AccessRightsManager
    await this.setupProperAccessRights();
    // Set up federation-aware channel sync
    const { setupChannelSyncListeners } = await import(
      './federation-channel-sync.js'
    );
    setupChannelSyncListeners(
      this.channelManager,
      'Node',
      (channelId, messages) => {
        console.log('\n' + '='.repeat(60));
        console.log('📥 MESSAGE FLOW TRACE - NODE RECEIVED via CHUM');
        console.log('='.repeat(60));
        console.log(
          `[TRACE] 📨 NODE: Received ${messages?.length} messages in channel ${channelId}`
        );
        console.log(
          `[NodeOneCore] 📨 New messages in channel ${channelId}:`,
          messages?.length
        );
        // Log message details
        messages.forEach((msg, idx) => {
          console.log(`[TRACE] Message ${idx + 1}:`, {
            text: msg.text?.substring(0, 50),
            sender: msg.sender?.substring(0, 8),
            timestamp: msg.timestamp,
          });
        });
        // Check if this is an AI-enabled topic and respond if needed
        if (
          this.aiAssistantModel &&
          this.aiAssistantModel.isAITopic(channelId)
        ) {
          console.log(`[TRACE] 🤖 NODE: AI topic detected, processing...`);
          console.log(
            `[NodeOneCore] AI topic detected, processing messages...`
          );
          // AI response will be handled by AIMessageListener
        }
      }
    );
    console.log('[NodeOneCore] ✅ Federation channel sync listener registered');
    // Add more detailed CHUM data reception logging
    console.log(
      '[NodeOneCore] 🎯🎯🎯 NODE: Setting up detailed CHUM data reception logging'
    );
    this.channelManager.onUpdated(
      async (channelInfoIdHash, channelId, owner, time, data) => {
        // For P2P channels, check which channel we're receiving from
        const isP2P = channelId.includes('<->');
        console.log('[NodeOneCore] 🔔🔔🔔 NODE CHUM DATA RECEIVED!', {
          channelId,
          owner: owner?.substring(0, 8) || 'null',
          isP2P,
          dataLength: data?.length,
          timestamp: new Date(time).toISOString(),
          myOwnerId: this.ownerId?.substring(0, 8),
          isMyChannel: owner === this.ownerId,
        });
        if (isP2P && owner) {
          console.warn(
            '[NodeOneCore] ⚠️ P2P message received in OWNED channel! Owner:',
            String(owner).substring(0, 8)
          );
          console.warn(
            '[NodeOneCore] This suggests the peer is using owned channels for P2P'
          );
        }
        // Auto-create P2P topic if it doesn't exist when receiving messages
        if (isP2P && data?.length > 0) {
          console.log(
            '[NodeOneCore] 📨 P2P message received, ensuring topic exists...'
          );
          const { ensureP2PTopicForIncomingMessage } = await import(
            './p2p-topic-creator.js'
          );
          try {
            await ensureP2PTopicForIncomingMessage({
              topicModel: this.topicModel,
              channelManager: this.channelManager,
              leuteModel: this.leuteModel,
              channelId,
              message: data[0],
            });
          } catch (error) {
            console.error(
              '[NodeOneCore] Failed to ensure P2P topic:',
              error.message
            );
          }
        }
        // Log what's actually in the data
        if (data && data?.length > 0) {
          data.forEach((item, idx) => {
            // Check if item is a string (hash) or object
            if (typeof item === 'string') {
              console.log(
                `[NodeOneCore]   CHUM Data[${idx}]: HASH: ${String(item).substring(0, 16)}...`
              );
            } else {
              console.log(`[NodeOneCore]   CHUM Data[${idx}]:`, {
                type: item.$type$,
                content: item.content
                  ? item.content?.substring(0, 50) + '...'
                  : undefined,
                text: item.text
                  ? item.text?.substring(0, 50) + '...'
                  : undefined,
                author: item.author?.substring(0, 8),
                timestamp: item.creationTime,
              });
            }
          });
          // Check if this is a ChatMessage
          const chatMessages = data.filter((d) => d.$type$ === 'ChatMessage');
          if (chatMessages?.length > 0) {
            console.log(
              `[NodeOneCore] 💬 NODE RECEIVED ${chatMessages?.length} CHAT MESSAGES via CHUM!`
            );
            chatMessages.forEach((msg) => {
              console.log('[NodeOneCore]   Message:', {
                content: msg.content?.substring(0, 100),
                author: msg.author?.substring(0, 8),
              });
            });
            // Notify UI about new messages
            import('electron').then(({ BrowserWindow }) => {
              const windows = BrowserWindow.getAllWindows();
              windows.forEach((window) => {
                window.webContents.send('message:updated', {
                  conversationId: channelId,
                  source: 'chum-sync',
                });
              });
            });
          }
        }
      }
    );
    // Initialize TopicModel - needs channelManager and leuteModel
    // Use the imported TopicModel class - no dynamic import
    this.topicModel = new TopicModel(this.channelManager, this.leuteModel);
    await this.topicModel.init();
    console.log('[NodeOneCore] ✅ TopicModel initialized');

    // Initialize TopicAnalysisModel - needs channelManager and topicModel
    this.topicAnalysisModel = new TopicAnalysisModel(this.channelManager, this.topicModel);
    await this.topicAnalysisModel.init();
    console.log('[NodeOneCore] ✅ TopicAnalysisModel initialized');

    // Set up P2P channel access monitoring
    const { monitorP2PChannels } = await import('./p2p-channel-access.js');
    monitorP2PChannels(this.channelManager, this.leuteModel);
    console.log('[NodeOneCore] ✅ P2P channel access monitoring enabled');
    // TODO: Fix AppStateModel - AppStateJournal recipe needs to be versioned
    // Initialize AppStateModel for CRDT-based state journaling
    // const { AppStateModel } = await import('@refinio/refinio-api/dist/state/index.js')
    // // Pass the current ONE instance (oneAuth) to AppStateModel
    // this.appStateModel = new AppStateModel(this.oneAuth, 'nodejs')
    // await this.appStateModel.init(this.ownerId)
    // console.log('[NodeOneCore] ✅ AppStateModel initialized')
    // // Record initial Node.js state
    // await this.appStateModel.recordStateChange(
    //   'nodejs.initialized',
    //   true,
    //   false,
    //   { action: 'init', description: 'Node.js ONE.core instance initialized' }
    // )
    console.log(
      '[NodeOneCore] ⚠️  AppStateModel disabled - recipe issue needs fixing'
    );
    // Create contacts channel for CHUM sync
    await this.channelManager.createChannel('contacts');
    console.log('[NodeOneCore] ✅ Contacts channel created');
    // Create default topics (not just channels) on first initialization
    // Don't create default topics here - let AIAssistantModel handle them
    // when a model is selected to ensure proper AI participant setup
    console.log(
      '[NodeOneCore] Skipping default topic creation - will be created when AI model is selected'
    );
    // Initialize ConnectionsModel with commserver for external connections
    // ConnectionsModel will be imported later when needed
    // Skip MessageBus logging for now - focus on route registration
    // Note: Local browser-to-node sync will happen via IPC, not WebSocket
    // External connections still use commserver via ConnectionsModel
    // Create blacklist group for ConnectionsModel
    // Use the imported GroupModel class - no dynamic import
    let blacklistGroup;
    try {
      blacklistGroup =
        await GroupModel.constructFromLatestProfileVersionByGroupName(
          'blacklist'
        );
      console.log('[NodeOneCore] Using existing blacklist group');
    } catch {
      blacklistGroup = await this.leuteModel.createGroup('blacklist');
      console.log('[NodeOneCore] Created new blacklist group');
    }
    // Initialize Federation API for proper contact/endpoint management
    const { default: FederationAPI } = await import('./federation-api.js');
    this.federationAPI = new FederationAPI(this);
    // Note: Profile with OneInstanceEndpoint will be created on-the-fly
    // when the browser is invited (in node-provisioning.js)
    console.log('[NodeOneCore] Federation API initialized');
    // Create ConnectionsModel with standard configuration matching one.leute
    // Use the imported ConnectionsModel class - no dynamic import
    // ConnectionsModel configuration with separate sockets for pairing and CHUM
    // Port 8765: Pairing only (accepts unknown instances)
    // Port 8766: CHUM sync only (known instances only)
    this.connectionsModel = new ConnectionsModel(this.leuteModel, {
      commServerUrl,
      acceptIncomingConnections: true,
      // Configure multiple incoming connection methods
      incomingConnectionConfigurations: [
        // CommServer for external connections
        {
          type: 'commserver',
          url: commServerUrl,
          catchAll: true, // Handle all unknown connections
        },
        // Direct socket for local federation
        {
          type: 'socket',
          host: 'localhost',
          port: 8765,
          url: 'ws://localhost:8765',
          catchAll: true, // Accept all connections
        },
      ],
      acceptUnknownInstances: true, // Accept new instances via pairing
      acceptUnknownPersons: false, // Require pairing for new persons
      allowPairing: true, // Enable pairing protocol
      establishOutgoingConnections: true, // Auto-connect to discovered endpoints
      allowDebugRequests: true,
      pairingTokenExpirationDuration: 60000 * 15, // 15 minutes
      noImport: false,
      noExport: false,
    });
    console.log('[NodeOneCore] ConnectionsModel created:', {
      commServer: commServerUrl,
      directSocket: 'ws://localhost:8765', // Single port for pairing and CHUM
      acceptUnknownInstances: true, // Required for pairing
      acceptUnknownPersons: false,
      allowPairing: true,
    });
    console.log(
      '[NodeOneCore] Initializing ConnectionsModel with blacklist group...'
    );
    // Set up monitoring BEFORE init (like one.leute.replicant does)
    // This ensures callbacks are registered before any events can fire
    this.setupConnectionMonitoring();
    // Initialize with blacklist group (standard one.leute pattern)
    await this.connectionsModel.init(blacklistGroup);
    console.log(
      '[NodeOneCore] ✅ ConnectionsModel initialized with dual listeners'
    );
    console.log(
      '[NodeOneCore]   - CommServer:',
      commServerUrl,
      '(for pairing & external connections)'
    );
    console.log(
      '[NodeOneCore]   - Direct socket: ws://localhost:8765 (for browser-node federation)'
    );
    // Register CHUM protocol explicitly if needed
    if (this.connectionsModel['leuteConnectionsModule']) {
      console.log('[NodeOneCore] Checking CHUM protocol registration...');
      // CHUM should be auto-registered, but let's verify
      const protocols =
        this.connectionsModel[
          'leuteConnectionsModule'
        ].getRegisteredProtocols?.();
      if (protocols && !protocols.includes('chum')) {
        console.warn(
          '[NodeOneCore] CHUM protocol not registered, attempting manual registration...'
        );
        // CHUM is typically auto-registered by LeuteConnectionsModule
        // If not, there may be an issue with the module initialization
      } else if (protocols) {
        console.log(
          '[NodeOneCore] ✅ CHUM protocol is registered:',
          protocols.includes('chum')
        );
      }
      // Monitor for CHUM connections
      this.connectionsModel.onConnectionsChange(() => {
        const connections = this.connectionsModel.connectionsInfo();
        const chumConnections = connections.filter(
          (c) => c.protocolName === 'chum' && c.isConnected
        );
        if (chumConnections?.length > 0) {
          console.log(
            '[NodeOneCore] 🔄 Active CHUM connections:',
            chumConnections?.length
          );
          chumConnections.forEach((conn) => {
            console.log(
              '[NodeOneCore]   - CHUM with:',
              conn.remotePersonId?.substring(0, 8)
            );
          });
        }
      });
    }
    // Both listeners are now configured through incomingConnectionConfigurations
    // No need for manual listenForDirectConnections - ConnectionsModel handles both
    // Let ConnectionsModel handle all connection events internally
    // We don't need to manually manage connections - that's what caused the spare connection issue
    // Log pairing events
    if (
      this.connectionsModel.pairing &&
      typeof this.connectionsModel.pairing.onPairingSuccess?.on === 'function'
    ) {
      console.log('[NodeOneCore] Pairing module available');
      this.connectionsModel.pairing.onPairingSuccess.on(
        (
          initiatedLocally,
          localPersonId,
          localInstanceId,
          remotePersonId,
          remoteInstanceId,
          token
        ) => {
          console.log('[NodeOneCore] 🎉 Pairing SUCCESS!', {
            initiatedLocally,
            localPerson: localPersonId?.substring(0, 8),
            localInstance: localInstanceId?.substring(0, 8),
            remotePerson: remotePersonId?.substring(0, 8),
            remoteInstance: remoteInstanceId?.substring(0, 8),
            token: token?.substring(0, 8),
          });
        }
      );
    }
    // Debug: Check what CryptoApis are registered after init
    if (
      this.connectionsModel?.leuteConnectionsModule?.connectionRouteManager
        ?.catchAllRoutes
    ) {
      const catchAllRoutes =
        this.connectionsModel.leuteConnectionsModule.connectionRouteManager
          .catchAllRoutes;
      const registeredKeys = [...catchAllRoutes.keys()];
      console.log(
        '[NodeOneCore] Socket listener registered CryptoApi keys:',
        registeredKeys
      );
      console.log(
        '[NodeOneCore] Number of registered keys:',
        registeredKeys?.length
      );
      // Get our instance keys for comparison
      const { getInstanceOwnerIdHash } = await import(
        '@refinio/one.core/lib/instance.js'
      );
      const { getLocalInstanceOfPerson } = await import(
        '@refinio/one.models/lib/misc/instance.js'
      );
      const { getDefaultKeys } = await import(
        '@refinio/one.core/lib/keychain/keychain.js'
      );
      const { getObject } = await import(
        '@refinio/one.core/lib/storage-unversioned-objects.js'
      );
      const myPersonId = getInstanceOwnerIdHash();
      const instanceId = await getLocalInstanceOfPerson(myPersonId);
      const defaultInstanceKeys = await getDefaultKeys(instanceId);
      const instanceKeys = await getObject(defaultInstanceKeys);
      console.log(
        '[NodeOneCore] Our instance publicKey:',
        instanceKeys.publicKey
      );
      console.log(
        '[NodeOneCore] Is our key registered?:',
        registeredKeys.includes(instanceKeys.publicKey)
      );
    }
    // ConnectionsModel handles all connections - both local and external
    // It will manage WebSocket connections internally
    console.log(
      '[NodeOneCore] ✅ ConnectionsModel initialized and ready for connections'
    );
    // ConnectionsModel should automatically handle socket listener startup
    // Debug patching removed - was causing initialization crashes
    // Duplicate pairing handler removed - handled above in setupConnectionMonitoring()
    // Set up connection event monitoring
    this.connectionsModel.onConnectionsChange(() => {
      const connections = this.connectionsModel.connectionsInfo();
      console.log('[NodeOneCore] 🔄 Connections changed event fired!');
      console.log(
        '[NodeOneCore] Current connections count:',
        connections.length
      );
      // Log active CHUM connections
      for (const conn of connections) {
        if (conn.isConnected && conn.protocolName === 'chum') {
          console.log(
            '[NodeOneCore] CHUM connection active with:',
            conn.remotePersonId?.substring(0, 8)
          );
          // CHUM will sync based on existing Access objects
        }
      }
      // Log connection details for debugging
      console.log(
        '[NodeOneCore] Connection details:',
        connections.map((conn) => ({
          id: conn.id?.substring(0, 20) + '...',
          isConnected: conn.isConnected,
          remotePersonId: conn.remotePersonId?.substring(0, 8),
          protocolName: conn.protocolName,
        }))
      );
    });
    // Wait for commserver connection to establish
    console.log('[NodeOneCore] Waiting for commserver connection...');
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait longer for connection
    // Check if we're connected to commserver
    console.log('[NodeOneCore] Checking commserver connection status...');
    const connections = this.connectionsModel.connectionsInfo();
    console.log(
      '[NodeOneCore] Active connections after init:',
      connections.length
    );
    // Check if pairing is available
    if (this.connectionsModel.pairing) {
      console.log('[NodeOneCore] ✅ Pairing is available');
      // Skip test invitation to avoid any waiting room conflicts
      console.log(
        '[NodeOneCore] Skipping test invitation to keep waiting room clear for actual pairing'
      );
    } else {
      console.log('[NodeOneCore] ❌ Pairing not available');
    }
    // Check catch-all routes after init
    console.log('[NodeOneCore] Checking catch-all routes after init...');
    if (
      this.connectionsModel['leuteConnectionsModule']?.connectionRouteManager
        ?.catchAllRoutes
    ) {
      const catchAllCount =
        this.connectionsModel['leuteConnectionsModule'].connectionRouteManager
          .catchAllRoutes.size;
      console.log('[NodeOneCore] Catch-all routes registered:', catchAllCount);
      if (catchAllCount > 0) {
        console.log('[NodeOneCore] ✅ Pairing listener ready at commserver');
      }
    }
    // Check if commserver is connected
    if (this.connectionsModel.onlineState) {
      console.log('[NodeOneCore] ✅ Connected to commserver');
    } else {
      console.log(
        '[NodeOneCore] ⚠️ Not connected to commserver - invitations may not work!'
      );
    }
    // Check connection status
    console.log('[NodeOneCore] Active connections:', connections.length);
    // Log connection details for debugging
    for (const conn of connections) {
      if (conn.isConnected) {
        console.log(
          `[NodeOneCore] Connected to: ${conn.remotePersonId?.substring(0, 8)}... (${conn.protocolName})`
        );
      }
    }
    // Check if port 8765 is listening for internal federation
    try {
      const { default: net } = await import('net');
      const isListening = await new Promise((resolve) => {
        const socket = net.createConnection({ port: 8765, host: 'localhost' });
        socket.on('connect', () => {
          socket.end();
          resolve(true);
        });
        socket.on('error', () => {
          resolve(false);
        });
      });
      console.log('[NodeOneCore] Port 8765 listening:', isListening);
      // If not listening, try to start the direct socket route
      if (
        !isListening &&
        this.connectionsModel['leuteConnectionsModule']?.connectionRouteManager
      ) {
        console.log(
          '[NodeOneCore] Port 8765 not listening, starting direct socket route...'
        );
        const allRoutes =
          this.connectionsModel[
            'leuteConnectionsModule'
          ].connectionRouteManager.getAllRoutes();
        for (const route of allRoutes) {
          if (
            route.type === 'IncomingWebsocketRouteDirect' &&
            route.port === 8765 &&
            !route.active
          ) {
            console.log('[NodeOneCore] Starting direct socket route...');
            await route.start();
            console.log(
              '[NodeOneCore] ✅ Direct socket listener started on ws://localhost:8765'
            );
          }
        }
      }
    } catch (error) {
      console.log('[NodeOneCore] Could not check port 8765:', error.message);
    }
    // ConnectionsModel handles CommServer automatically with allowPairing: true
    // Pairing will transition to CHUM after successful handshake
    // Ensure CHUM protocol is registered and enabled
    console.log('[NodeOneCore] Ensuring CHUM protocol is available...');
    if (this.connectionsModel['leuteConnectionsModule']) {
      // CHUM should be auto-registered by ConnectionsModel
      const protocols =
        this.connectionsModel[
          'leuteConnectionsModule'
        ].getRegisteredProtocols?.();
      if (protocols) {
        console.log('[NodeOneCore] Available protocols:', protocols);
      }
    }
    console.log(
      '[NodeOneCore] ConnectionsModel initialized with CommServer and direct socket'
    );
    console.log('[NodeOneCore] ✅ ConnectionsModel initialized');
    // Set up listeners for connection events
    this.connectionsModel.onConnectionsChange(async () => {
      console.log('[NodeOneCore] 🔄 Connections changed event fired!');
      const connections = this.connectionsModel.connectionsInfo();
      console.log(
        '[NodeOneCore] Current connections count:',
        connections.length
      );
      console.log(
        '[NodeOneCore] Connection details:',
        JSON.stringify(
          connections.map((c) => ({
            id: c.id,
            isConnected: c.isConnected,
            remotePersonId: c.remotePersonId,
            protocolName: c.protocolName,
          })),
          null,
          2
        )
      );
      // Initialize content sharing for new CHUM connections
      for (const conn of connections) {
        if (
          conn.isConnected &&
          conn.protocolName === 'chum' &&
          conn.remotePersonId
        ) {
          console.log(
            `[NodeOneCore] CHUM connection detected with remote person: ${conn.remotePersonId?.substring(0, 8)}...`
          );
          // Grant the connected peer access to our profile and P2P channel
          await this.grantPeerAccess(conn.remotePersonId, 'chum-connection');
          // Contact discovery happens automatically through CHUM sync
          // LeuteModel will receive the peer's profile through CHUM and create the contact
          console.log(
            `[NodeOneCore] Contact will be discovered through CHUM sync`
          );
          // When a new CHUM connection is established, scan for groups
          // This ensures we create our channels for any groups we're part of
          if (this.topicGroupManager) {
            setTimeout(async () => {
              console.log(
                '[NodeOneCore] New CHUM connection - scanning for group channels...'
              );
              await this.topicGroupManager.scanAndEnsureGroupChannels();
            }, 2000); // Small delay to allow sync to complete
          }
        }
      }
    });
    // Set up message sync handling for AI responses
    await this.setupMessageSync();
    // Create channels for existing conversations so Node receives CHUM updates
    await this.createChannelsForExistingConversations();
    // Scan for group memberships and ensure we have channels
    if (this.topicGroupManager) {
      await this.topicGroupManager.scanAndEnsureGroupChannels();
      // Set up periodic scanning for new groups (every 30 seconds)
      setInterval(async () => {
        try {
          await this.topicGroupManager.scanAndEnsureGroupChannels();
        } catch (error) {
          console.error(
            '[NodeOneCore] Failed to scan for group channels:',
            error
          );
        }
      }, 30000);
    }
    // Set up AI contacts now that everything is initialized
    await this.setupAIContactsWhenReady();
    // Initialize Feed-Forward Manager
    // try {
    //   const feedForwardHandlers = await import('../ipc/handlers/feed-forward.js')
    //   feedForwardHandlers.default.initializeFeedForward(this)
    //   console.log('[NodeOneCore] ✅ Feed-Forward Manager initialized')
    // } catch (error) {
    //   console.error('[NodeOneCore] Failed to initialize Feed-Forward Manager:', error)
    // }
    console.log('[NodeOneCore] All models initialized successfully');
  }
  /**
   * Create channels for existing conversations so Node participates in CHUM sync
   */
  async createChannelsForExistingConversations() {
    console.log(
      '[NodeOneCore] Creating channels for existing conversations...'
    );
    if (!this.channelManager) {
      console.warn('[NodeOneCore] ChannelManager not available');
      return;
    }
    try {
      // Get existing conversations from state
      const { default: stateManager } = await import('../state/manager.js');
      const conversationsMap = stateManager.getState('conversations');
      if (conversationsMap && conversationsMap.size > 0) {
        console.log(
          `[NodeOneCore] Found ${conversationsMap.size} existing conversations`
        );
        for (const [id, conversation] of conversationsMap) {
          try {
            // Check if this is a P2P conversation (contains <->)
            const isP2P = id.includes('<->');
            // For P2P conversations, skip creating channels here
            // P2P channels are managed by TopicGroupManager.ensureP2PChannelsForPeer
            if (isP2P) {
              console.log(
                `[NodeOneCore] Skipping P2P channel creation for: ${id} (handled by TopicGroupManager)`
              );
              continue;
            }
            // For group chats, use our owner ID
            const channelOwner = this.ownerId;
            // Create a channel for each conversation
            // This ensures the Node instance receives CHUM updates for messages in these conversations
            await this.channelManager.createChannel(id, channelOwner);
            console.log(
              `[NodeOneCore] Created channel for conversation: ${id} (owner: ${channelOwner})`
            );
          } catch (error) {
            // Channel might already exist, that's fine
            if (!error.message?.includes('already exists')) {
              console.warn(
                `[NodeOneCore] Could not create channel for ${id}:`,
                error.message
              );
            }
          }
        }
      } else {
        console.log('[NodeOneCore] No existing conversations found');
      }
    } catch (error) {
      console.error(
        '[NodeOneCore] Error creating channels for existing conversations:',
        error
      );
    }
  }
  /**
   * Set up message sync - listen for user messages, process with AI, respond
   */
  async setupMessageSync() {
    console.log(
      '[NodeOneCore] Setting up event-based message sync for AI processing...'
    );
    if (!this.channelManager) {
      console.warn(
        '[NodeOneCore] ChannelManager not available for message sync'
      );
      return;
    }
    // Import and create the message listeners
    const AIMessageListener = await import('./ai-message-listener.js');
    const PeerMessageListener = await import('./peer-message-listener.js');
    const { default: llmManager } = await import('../services/llm-manager.js');
    // Create the AI message listener before AIAssistantModel
    this.aiMessageListener = new AIMessageListener.default(
      this.channelManager,
      llmManager // Use the actual LLM manager from main process
    );
    // Create the peer message listener for real-time UI updates
    this.peerMessageListener = new PeerMessageListener.default(
      this.channelManager,
      this.topicModel
    );
    // Initialize Topic Group Manager for proper group topics
    if (!this.topicGroupManager) {
      this.topicGroupManager = new TopicGroupManager(this);
      console.log('[NodeOneCore] ✅ Topic Group Manager initialized');
    }
    // Initialize AI Assistant Model to orchestrate everything
    if (!this.aiAssistantModel) {
      this.aiAssistantModel = new AIAssistantModel(this);
      // Pre-warm LLM connections early
      await this.aiAssistantModel.init();
      console.log(
        '[NodeOneCore] ✅ AI Assistant Model initialized with pre-warmed connections'
      );
      // Connect AIAssistantModel to the message listener
      this.aiMessageListener.setAIAssistantModel(this.aiAssistantModel);
      console.log(
        '[NodeOneCore] ✅ Connected AIAssistantModel to message listener'
      );
    }
    // Initialize Refinio API Server as part of this ONE.core instance
    if (!this.apiServer) {
      this.apiServer = new RefinioApiServer(this.aiAssistantModel);
      // The API server will use THIS instance, not create a new one
      await this.apiServer.start();
    }
    // Start the listeners
    this.aiMessageListener.start();
    // Start peer message listener and set required properties
    const { BrowserWindow } = await import('electron');
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      this.peerMessageListener.setMainWindow(mainWindow);
    }
    this.peerMessageListener.setOwnerId(this.ownerId);
    this.peerMessageListener.start();
    console.log(
      '[NodeOneCore] ✅ Event-based message sync set up for AI and peer message processing'
    );
  }
  /**
   * Send AI greeting message to a topic
   */
  async sendAIGreeting(topicRoom) {
    try {
      // Get LLM manager to find active model
      const { default: llmManager } = await import(
        '../services/llm-manager.js'
      );
      const models = this.llmManager?.getAvailableModels();
      // Use default model from llmManager
      const modelId = llmManager.defaultModelId;
      const defaultModel = llmManager.getDefaultModel();
      const modelName = defaultModel?.name || 'your AI assistant';
      // Create AI person ID for the greeting
      const aiPersonId = await this.getOrCreateAIPersonId(modelId, modelName);
      // Send greeting message as plain text
      // TopicRoom.sendMessage expects (text, author, channelOwner)
      const greetingText = `Hello! I'm ${modelName}. How can I help you today?`;
      await topicRoom.sendMessage(greetingText, aiPersonId, undefined);
      console.log(`[NodeOneCore] ✅ AI greeting sent from ${modelName}`);
    } catch (error) {
      console.error('[NodeOneCore] Failed to send AI greeting:', error);
    }
  }
  /**
   * Check if a message should be processed by AI
   */
  async shouldProcessMessage(message) {
    // Skip if it's an AI message (don't respond to ourselves)
    if (message.author && message.author.includes('ai-')) {
      return false;
    }
    // Skip if we already responded to this message
    // TODO: Implement proper tracking of processed messages
    return true;
  }
  /**
   * Process a user message with AI and send response
   */
  async processMessageWithAI(topicRoom, userMessage) {
    console.log('[NodeOneCore] Processing user message with AI...');
    try {
      // Get LLM manager from main process
      const { default: llmManager } = await import(
        '../services/llm-manager.js'
      );
      // Get AI response
      const response = await llmManager.generateResponse({
        messages: [
          {
            role: 'user',
            content: userMessage.content,
          },
        ],
        model: llmManager.defaultModelId,
      });
      if (response && response.content) {
        // Create AI person ID for the response
        const aiPersonId = await this.getOrCreateAIPersonId(
          llmManager.defaultModelId
        );
        // Send AI response to topic (will sync via CHUM to browser)
        await topicRoom.sendMessage(response.content, aiPersonId, this.ownerId);
        console.log('[NodeOneCore] ✅ AI response sent to topic');
      }
    } catch (error) {
      console.error('[NodeOneCore] Error processing message with AI:', error);
    }
  }
  /**
   * Set up AI assistant contacts for available models
   */
  async setupAIContacts() {
    console.log('[NodeOneCore] 🤖 Setting up AI assistant contacts...');
    try {
      // Get available AI models from LLM manager
      const { default: llmManager } = await import(
        '../services/llm-manager.js'
      );
      const { default: stateManager } = await import('../state/manager.js');
      // Check if user has already selected a model
      const savedModelId = stateManager.getState('ai.defaultModelId');
      if (!savedModelId) {
        console.log(
          '[NodeOneCore] No model selected yet, skipping AI contact creation'
        );
        return [];
      }
      const allModels = this.llmManager?.getAvailableModels();
      const initialModel = allModels.find((m) => m.id === savedModelId);
      if (!initialModel) {
        console.log('[NodeOneCore] Saved model not found:', savedModelId);
        return [];
      }
      console.log(
        `[NodeOneCore] Setting up saved AI model: ${initialModel.name}`
      );
      // Create ONE AI identity for the LAMA chat
      // The Hi chat will use this same AI but with a different context
      // Create the -private version for LAMA
      const lamaModel = {
        ...initialModel,
        id: initialModel.id + ':lama',
        name: initialModel.name.replace('-private', '') + '-private', // Ensure -private suffix
      };
      // Create the AI contact and store with full metadata
      const aiContacts = [];
      const { storeIdObject } = await import(
        '@refinio/one.core/lib/storage-versioned-objects.js'
      );
      const { createDefaultKeys, hasDefaultKeys } = await import(
        '@refinio/one.core/lib/keychain/keychain.js'
      );
      // Create LAMA contact person
      const lamaPersonData = {
        $type$: 'Person',
        email: `${lamaModel.id.replace(/[^a-zA-Z0-9]/g, '_')}@ai.local`,
        name: lamaModel.name,
      };
      const lamaResult = await storeIdObject(lamaPersonData);
      const lamaPersonId =
        typeof lamaResult === 'object' && lamaResult.idHash
          ? lamaResult.idHash
          : lamaResult;
      // Ensure keys exist
      if (!(await hasDefaultKeys(lamaPersonId))) {
        await createDefaultKeys(lamaPersonId);
      }
      // Store LAMA contact with full metadata
      const lamaContactInfo = {
        modelId: lamaModel.id,
        personId: lamaPersonId,
        name: lamaModel.name,
        isPrivate: true,
        chatId: 'lama',
      };
      this.aiAssistantModel?.aiContacts?.set(
        lamaModel.id,
        lamaContactInfo
      );
      aiContacts.push(lamaContactInfo);
      console.log(
        `[NodeOneCore] ✅ Created AI contact: ${lamaContactInfo.name}`
      );
      // Store for reference
      this.aiPersonIds = aiContacts;
      return aiContacts;
    } catch (error) {
      console.error('[NodeOneCore] Could not set up AI contacts:', error);
    }
  }
  /**
   * Get AI person ID for a model (delegates to AIContactManager)
   */
  async getOrCreateAIPersonId(modelId, displayName) {
    // Delegate to the AI Assistant Model
    return this.aiAssistantModel.createAIContact(modelId, displayName);
  }
  /**
   * OLD METHOD - TO BE REMOVED
   */
  async getOrCreateAIPersonId_OLD(modelId, displayName) {
    console.log(
      `[NodeOneCore] Getting/creating AI person for ${displayName} (${modelId})`
    );
    try {
      if (!this.leuteModel) {
        console.error('[NodeOneCore] LeuteModel not available');
        return null;
      }
      // Import required modules
      const { storeVersionedObject } = await import(
        '@refinio/one.core/lib/storage-versioned-objects.js'
      );
      const { createPersonIfNotExist } = await import(
        '@refinio/one.models/lib/misc/person.js'
      );
      // Create email for AI identity
      const email = `${modelId.replace(/[^a-zA-Z0-9]/g, '_')}@ai.local`;
      // Use createPersonIfNotExist - it's idempotent and content-addressed
      const result = await createPersonIfNotExist(email);
      const personId = result?.personId;
      if (result?.exists) {
        console.log(
          `[NodeOneCore] Using existing AI person for ${displayName}: ${String(personId).substring(0, 8)}...`
        );
      } else {
        console.log(
          `[NodeOneCore] Created new AI person for ${displayName}: ${String(personId).substring(0, 8)}...`
        );
      }
      // Get or create Someone wrapper for this person
      let someone = await this.leuteModel.getSomeone(personId);
      let someoneIdHash;
      if (!someone) {
        // Create profile and Someone wrapper for new person
        const myIdentity = await this.leuteModel.myMainIdentity();
        const newProfile = await ProfileModel.constructWithNewProfile(
          personId,
          myIdentity,
          'default'
        );
        await this.leuteModel.addProfile(newProfile.idHash);
        someone = await this.leuteModel.getSomeone(personId);
        if (!someone) {
          throw new Error('Failed to create Someone wrapper for AI person');
        }
        someoneIdHash = someone.idHash;
      } else {
        someoneIdHash = someone.idHash;
      }
      // Load the created Someone model
      const someoneModel =
        await SomeoneModel.constructFromLatestVersion(someoneIdHash);
      // Get the main profile of the Someone
      const profile = await someoneModel.mainProfile();
      // Add AI-specific information to the profile
      profile.personDescriptions = profile.personDescriptions || [];
      profile.personDescriptions?.push({
        $type$: 'PersonName',
        name: displayName,
      });
      profile.description = `${displayName} AI Assistant (${modelId})`;
      // Add communication endpoint
      profile.communicationEndpoints = profile.communicationEndpoints || [];
      profile.communicationEndpoints?.push({
        $type$: 'Email',
        email: email,
      });
      // Persist the changes
      await profile.saveAndLoad();
      console.log(
        `[NodeOneCore] ✅ AI contact ${displayName} ready with ID: ${String(personId).substring(0, 8)}...`
      );
      return personId;
    } catch (error) {
      console.error(
        `[NodeOneCore] Failed to create AI person for ${displayName}:`,
        error
      );
      // Fall back to simple hash
      const crypto = await import('crypto');
      return crypto
        .createHash('sha256')
        .update(`ai-assistant-${modelId}-${this.ownerId}`)
        .digest('hex');
    }
  }
  /**
   * Set up AI contacts after LLMManager is ready
   * This should be called from the main app after LLMManager.init()
   */
  async setupAIContactsWhenReady() {
    if (!this.initialized) {
      console.log(
        '[NodeOneCore] Cannot set up AI contacts - Node not initialized'
      );
      return;
    }
    try {
      await this.setupAIContacts();
    } catch (error) {
      console.error('[NodeOneCore] Failed to set up AI contacts:', error);
    }
  }
  // Removed setupBrowserAccess - browser has no ONE instance
  /**
   * Get current instance info
   */
  getInfo() {
    return {
      initialized: this.initialized,
      name: this.instanceName,
      ownerId: this.ownerId,
    };
  }
  /**
   * Get the ONE.core instance object
   * @returns {Object} The instance object or null if not initialized
   */
  getInstance() {
    if (!this.initialized || !this.instanceModule) {
      return null;
    }
    // Return the instance module's exports which contains the instance
    return this.instanceModule;
  }
  /**
   * Get instance credentials for browser pairing
   */
  async getCredentialsForBrowser() {
    if (!this.initialized) {
      throw new Error('Node.js instance not initialized');
    }
    const { SettingsStore } = await import(
      '@refinio/one.core/lib/system/settings-store.js'
    );
    const email = await SettingsStore.getItem('email');
    const instanceName = await SettingsStore.getItem('instance');
    if (!email) {
      throw new Error('No credentials found in Node.js instance');
    }
    return {
      email: email,
      nodeInstanceName: instanceName,
      // Browser should use same email but different instance name
      browserInstanceName: 'browser',
    };
  }
  /**
   * Set/get state and settings
   */
  async setState(key, value) {
    console.log(`[NodeOneCore] Setting state: ${key}`);
    // TODO: Use Settings datatype when available
    return true;
  }
  getState(key) {
    // TODO: Use Settings datatype when available
    return undefined;
  }
  async setSetting(key, value) {
    // TODO: Implement proper settings storage
    console.log(`[NodeOneCore] Setting: ${key} = ${value}`);
    return true;
  }
  async getSetting(key) {
    // TODO: Implement proper settings retrieval
    return undefined;
  }
  async getSettings(prefix) {
    // TODO: Implement proper settings retrieval
    return {};
  }
  /**
   * Handle known connections - start CHUM protocol
   */
  async handleKnownConnection(
    conn,
    localPersonId,
    localInstanceId,
    remotePersonId,
    remoteInstanceId,
    initiatedLocally,
    routeGroupId
  ) {
    console.log('[NodeOneCore] Starting CHUM protocol for known connection');
    const { startChumProtocol } = await import(
      '@refinio/one.models/lib/misc/ConnectionEstablishment/protocols/Chum.js'
    );
    const { OEvent } = await import('@refinio/one.models/lib/misc/OEvent.js');
    const onProtocolStart = new OEvent();
    await startChumProtocol(
      conn,
      localPersonId,
      localInstanceId,
      remotePersonId,
      remoteInstanceId,
      initiatedLocally,
      routeGroupId,
      onProtocolStart,
      false, // noImport
      false // noExport
    );
    console.log('[NodeOneCore] ✅ CHUM protocol started');
  }
  /**
   * Handle unknown connections - could be browser with different person ID
   */
  async handleUnknownConnection(
    conn,
    localPersonId,
    localInstanceId,
    remotePersonId,
    remoteInstanceId,
    initiatedLocally,
    routeGroupId
  ) {
    console.log(
      "[NodeOneCore] Handling unknown connection - checking if it's the browser"
    );
    // For now, accept and start CHUM if it's from localhost (browser)
    if (routeGroupId.includes('chum')) {
      await this.handleKnownConnection(
        conn,
        localPersonId,
        localInstanceId,
        remotePersonId,
        remoteInstanceId,
        initiatedLocally,
        routeGroupId
      );
    }
  }
  /**
   * Clean up instance to allow re-initialization
   */
  async cleanup() {
    console.log('[NodeOneCore] Cleaning up instance...');
    try {
      // Stop the AI message listener
      if (this.aiMessageListener) {
        this.aiMessageListener.stop();
        this.aiMessageListener = null;
      }
      // Stop direct connection listener
      if (this.directListenerStopFn) {
        await this.directListenerStopFn();
        this.directListenerStopFn = null;
      }
      // Close WebSocket server if running
      if (this.wss) {
        this.wss.close();
        this.wss = null;
      }
      // Shutdown ONE.core instance properly
      const { closeInstance } = await import(
        '@refinio/one.core/lib/instance.js'
      );
      closeInstance();
      // Reset all models and groups
      this.leuteModel = null;
      this.connectionsModel = null;
      this.channelManager = null;
      this.topicModel = null;
      this.oneAuth = null;
      this.federationGroup = null;
      this.replicantGroup = null;
      this.topicGroupManager = null;
      this.aiAssistant = null;
      this.quickReply = null;
      // Clear intervals
      if (this.messageSyncInterval) {
        clearInterval(this.messageSyncInterval);
        this.messageSyncInterval = null;
      }
      console.log('[NodeOneCore] Cleanup complete');
    } catch (error) {
      console.error('[NodeOneCore] Error during cleanup:', error);
    }
  }
  /**
   * Set up proper access rights using AccessRightsManager pattern
   */
  async setupProperAccessRights() {
    if (!this.channelManager || !this.leuteModel) {
      console.warn(
        '[NodeOneCore] ChannelManager or LeuteModel not available for access rights setup'
      );
      return;
    }
    try {
      // Create groups for access rights management
      const { default: GroupModel } = await import(
        '@refinio/one.models/lib/models/Leute/GroupModel.js'
      );
      const { default: LeuteModel } = await import(
        '@refinio/one.models/lib/models/Leute/LeuteModel.js'
      );
      const everyoneGroup = await LeuteModel.everyoneGroup();
      // Create federation group for instance-to-instance communication
      try {
        this.federationGroup =
          await GroupModel.constructFromLatestProfileVersionByGroupName(
            'federation'
          );
        console.log('[NodeOneCore] Using existing federation group');
      } catch {
        this.federationGroup = await this.leuteModel.createGroup('federation');
        console.log('[NodeOneCore] Created new federation group');
      }
      // Create replicant group for inter-instance sync
      try {
        this.replicantGroup =
          await GroupModel.constructFromLatestProfileVersionByGroupName(
            'replicant'
          );
        console.log('[NodeOneCore] Using existing replicant group');
      } catch {
        this.replicantGroup = await this.leuteModel.createGroup('replicant');
        console.log('[NodeOneCore] Created new replicant group');
      }
      // Initialize access rights manager with groups
      const { default: NodeAccessRightsManager } = await import(
        './access-rights-manager.js'
      );
      // ConnectionsModel already imported and used as this.connectionsModel
      this.accessRightsManager = new NodeAccessRightsManager(
        this.channelManager,
        this.connectionsModel,
        this.leuteModel
      );
      await this.accessRightsManager.init({
        everyone: everyoneGroup.groupIdHash,
        federation: this.federationGroup.groupIdHash,
        replicant: this.replicantGroup.groupIdHash,
      });
      console.log(
        '[NodeOneCore] ✅ Access rights manager initialized with proper groups'
      );
    } catch (error) {
      console.error('[NodeOneCore] Failed to setup access rights:', error);
      // Continue without proper access rights - basic functionality may still work
    }
  }
  // REMOVED: startDirectListener()
  // Direct WebSocket listener now handled by ConnectionsModel via socketConfig
  /**
   * Reset the singleton instance to clean state
   * Used when app data is cleared
   */
  reset() {
    // Reset all properties to initial state
    this.initialized = false;
    this.instanceName = null;
    this.ownerId = null;
    this.leuteModel = null;
    this.appStateModel = null;
    this.connectionsModel = null;
    this.channelManager = null;
    this.topicModel = null;
    this.localWsServer = null;
    this.instanceModule = null;
    this.aiAssistantModel = null;
    this.apiServer = null;
    this.topicGroupManager = null;
    this.federationGroup = null;
    this.replicantGroup = null;
    this.accessRightsManager = null;
    this.aiAssistant = null;
    this.quickReply = null;
    this.messageSyncInterval = null;
    this.aiMessageListener = null;
    this.initFailed = false;
    console.log('[NodeOneCore] Instance reset to clean state');
  }
  /**
   * Shutdown the instance properly
   */
  async shutdown() {
    console.log('[NodeOneCore] Shutting down...');
    // Stop message listeners
    if (this.aiMessageListener) {
      this.aiMessageListener.stop();
      this.aiMessageListener = null;
    }
    if (this.peerMessageListener) {
      this.peerMessageListener.stop();
      this.peerMessageListener = null;
    }
    // Stop direct WebSocket listener if running
    if (this.directSocketStopFn) {
      console.log('[NodeOneCore] Stopping direct WebSocket listener...');
      await this.directSocketStopFn();
      this.directSocketStopFn = null;
    }
    await this.cleanup();
    if (this.accessRightsManager) {
      await this.accessRightsManager.shutdown();
      this.accessRightsManager = undefined;
    }
    this.initialized = false;
    this.instanceName = null;
    this.ownerId = null;
    console.log('[NodeOneCore] Shutdown complete');
  }
}
// Singleton
const instance = new NodeOneCore();
export default instance;
export { instance };
