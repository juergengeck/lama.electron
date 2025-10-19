/**
 * Main IPC Controller (TypeScript Version)
 * Routes IPC messages to appropriate handlers
 */

import { ipcMain, BrowserWindow, IpcMainInvokeEvent, app } from 'electron';
import type { IPCHandler, IPCHandlerMap } from '../types/ipc.js';

// Import handlers (will be JS files initially, then migrated to TS)
import authHandlers from './handlers/auth.js';
import stateHandlers from './handlers/state.js';
import chatHandlers from './handlers/chat.js';
import iomHandlers from './handlers/iom.js';
import cryptoHandlers from './handlers/crypto.js';
import settingsHandlers from './handlers/settings.js';
import aiHandlers from './handlers/ai.js';
import attachmentHandlers from './handlers/attachments.js';
// @ts-ignore - JS file with named export
import { subjectHandlers } from './handlers/subjects.js';
import oneCoreHandlers from './handlers/one-core.js';
// @ts-ignore - JS file with named export
import { initializeDeviceHandlers } from './handlers/devices.js';
// @ts-ignore - JS file with named export
import { registerContactHandlers } from './handlers/contacts.js';
import * as topicHandlers from './handlers/topics.js';
import topicAnalysisHandlers from './handlers/topic-analysis.js';
import * as wordCloudSettingsHandlers from './handlers/word-cloud-settings.js';
import keywordDetailHandlers from './handlers/keyword-detail.js';
import auditHandlers from './handlers/audit.js';
import exportHandlers from './handlers/export.js';
import feedForwardHandlers from './handlers/feed-forward.js';
import { registerLlmConfigHandlers } from './handlers/llm-config.js';
// @ts-ignore - TS file with named export
import { proposalHandlers } from './handlers/proposals.js';
import mcpHandlers from './handlers/mcp.js';

// Node error type
interface NodeError extends Error {
  code?: string;
}

class IPCController {
  devices: any;
  public handlers: Map<string, IPCHandler>;
  public mainWindow: BrowserWindow | null;

  constructor() {
    this.handlers = new Map();
    this.mainWindow = null;
  }

  // Safe console methods that won't throw EPIPE errors
  private safeLog(...args: any[]): void {
    // Skip logging entirely if mainWindow is destroyed
    if (this.mainWindow && this.mainWindow?.isDestroyed()) {
      return;
    }

    try {
      console.log(...args);
    } catch (err: any) {
      // Ignore EPIPE errors when renderer disconnects
      if (err.code !== 'EPIPE' && !err.message?.includes('EPIPE')) {
        // Try to at least log to stderr if stdout fails
        try {
          process.stderr.write(`[IPC] Log failed: ${err.message}\n`);
        } catch {}
      }
    }
  }

  private safeError(...args: any[]): void {
    // Skip logging entirely if mainWindow is destroyed
    if (this.mainWindow && this.mainWindow?.isDestroyed()) {
      return;
    }

    try {
      console.error(...args);
    } catch (err: any) {
      // Ignore EPIPE errors
      if (err.code !== 'EPIPE' && !err.message?.includes('EPIPE')) {
        try {
          process.stderr.write(`[IPC] Error log failed: ${err.message}\n`);
        } catch {}
      }
    }
  }

  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    // Register all handlers
    this.registerHandlers();

    this.safeLog('[IPCController] Initialized with handlers');
  }

  private registerHandlers(): void {
    // Debug handler for browser logs
    this.handle('debug:log', async (event: IpcMainInvokeEvent, message: string) => {
      console.log('[BROWSER DEBUG]', message);
      return { success: true };
    });

    // Authentication handlers
    this.handle('auth:login', authHandlers.login);
    this.handle('auth:register', authHandlers.register);
    this.handle('auth:logout', authHandlers.logout);
    this.handle('auth:check', authHandlers.checkAuth);

    // State handlers
    this.handle('state:get', stateHandlers.getState);
    this.handle('state:set', stateHandlers.setState);
    this.handle('state:subscribe', stateHandlers.subscribe);

    // Chat handlers
    this.handle('chat:initializeDefaultChats', chatHandlers.initializeDefaultChats);
    this.handle('chat:sendMessage', chatHandlers.sendMessage);
    this.handle('chat:getMessages', chatHandlers.getMessages);
    this.handle('chat:createConversation', chatHandlers.createConversation);
    this.handle('chat:getConversations', chatHandlers.getConversations);
    this.handle('chat:getCurrentUser', chatHandlers.getCurrentUser);
    this.handle('chat:addParticipants', chatHandlers.addParticipants);
    this.handle('chat:clearConversation', chatHandlers.clearConversation);
    this.handle('chat:uiReady', chatHandlers.uiReady);
    this.handle('chat:editMessage', chatHandlers.editMessage);
    this.handle('chat:deleteMessage', chatHandlers.deleteMessage);
    this.handle('chat:getMessageHistory', chatHandlers.getMessageHistory);
    this.handle('chat:exportMessageCredential', chatHandlers.exportMessageCredential);
    this.handle('chat:verifyMessageAssertion', chatHandlers.verifyMessageAssertion);

    // Audit handlers
    this.handle('audit:generateQR', auditHandlers.generateQR);
    this.handle('audit:createAttestation', auditHandlers.createAttestation);
    this.handle('audit:getAttestations', auditHandlers.getAttestations);
    this.handle('audit:exportTopic', auditHandlers.exportTopic);
    this.handle('audit:verifyAttestation', auditHandlers.verifyAttestation);

    // Test handler to manually trigger message updates
    this.handle('test:triggerMessageUpdate', async (event: IpcMainInvokeEvent, { conversationId }: any) => {
      console.log('[TEST] Manually triggering message update for:', conversationId);
      const testData = {
        conversationId: conversationId || 'test-conversation',
        messages: [{
          id: 'test-msg-' + Date.now(),
          conversationId: conversationId || 'test-conversation',
          text: 'Test message triggered at ' + new Date().toISOString(),
          sender: 'test-sender',
          timestamp: new Date().toISOString(),
          status: 'received',
          isAI: false
        }]
      };
      console.log('[TEST] Sending chat:newMessages event with data:', testData);
      this.sendUpdate('chat:newMessages', testData);
      return { success: true, data: testData };
    });

    // IOM handlers (refactored - now delegates to one.models)
    this.handle('iom:getInstances', iomHandlers.getIOMInstances);
    this.handle('iom:getConnectionStatus', iomHandlers.getConnectionStatus);
    this.handle('iom:createPairingInvitation', iomHandlers.createPairingInvitation);
    this.handle('iom:acceptPairingInvitation', iomHandlers.acceptPairingInvitation);

    // Crypto handlers
    this.handle('crypto:getKeys', cryptoHandlers.getKeys);
    this.handle('crypto:getCertificates', cryptoHandlers.getCertificates);
    this.handle('crypto:export', cryptoHandlers.exportCryptoObject);

    // Settings handlers
    this.handle('settings:get', settingsHandlers.getSetting);
    this.handle('settings:set', settingsHandlers.setSetting);
    this.handle('settings:getAll', settingsHandlers.getSettings);
    this.handle('settings:syncIoM', settingsHandlers.syncIoMSettings);
    this.handle('settings:subscribe', settingsHandlers.subscribeToSettings);
    this.handle('settings:getConfig', settingsHandlers.getInstanceConfig);

    // AI/LLM handlers
    this.handle('ai:chat', aiHandlers.chat);
    this.handle('ai:getModels', aiHandlers.getModels);
    this.handle('ai:setDefaultModel', aiHandlers.setDefaultModel);
    this.handle('ai:setApiKey', aiHandlers.setApiKey);
    this.handle('ai:getTools', aiHandlers.getTools);
    this.handle('ai:executeTool', aiHandlers.executeTool);
    this.handle('ai:initialize', aiHandlers.initializeLLM);
    this.handle('ai:initializeLLM', aiHandlers.initializeLLM); // Alias for UI compatibility
    this.handle('ai:getOrCreateContact', aiHandlers.getOrCreateContact);
    this.handle('ai:discoverClaudeModels', aiHandlers.discoverClaudeModels);
    this.handle('ai:debugTools', aiHandlers.debugTools);
    this.handle('llm:testApiKey', aiHandlers.testApiKey);
    this.handle('ai:ensureDefaultChats', aiHandlers['ai:ensureDefaultChats']);
    this.handle('ai:getDefaultModel', aiHandlers['ai:getDefaultModel']);

    // LLM Configuration handlers (network Ollama support)
    registerLlmConfigHandlers();

    // Legacy alias for UI compatibility
    this.handle('llm:getConfig', async (event: IpcMainInvokeEvent, params: any) => {
      const { handleGetOllamaConfig } = await import('./handlers/llm-config.js');
      return handleGetOllamaConfig(event, params || {});
    });

    // Attachment handlers
    this.handle('attachment:store', attachmentHandlers.storeAttachment);
    this.handle('attachment:get', attachmentHandlers.getAttachment);
    this.handle('attachment:getMetadata', attachmentHandlers.getAttachmentMetadata);
    this.handle('attachment:storeMultiple', attachmentHandlers.storeAttachments);

    // Subject handlers
    this.handle('subjects:create', subjectHandlers['subjects:create']);
    this.handle('subjects:attach', subjectHandlers['subjects:attach']);
    this.handle('subjects:getForContent', subjectHandlers['subjects:getForContent']);
    this.handle('subjects:getAll', subjectHandlers['subjects:getAll']);
    this.handle('subjects:search', subjectHandlers['subjects:search']);
    this.handle('subjects:getResonance', subjectHandlers['subjects:getResonance']);
    this.handle('subjects:extract', subjectHandlers['subjects:extract']);

    // Topic Analysis handlers
    this.handle('topicAnalysis:analyzeMessages', topicAnalysisHandlers.analyzeMessages);
    this.handle('topicAnalysis:getSubjects', topicAnalysisHandlers.getSubjects);
    this.handle('topicAnalysis:getSummary', topicAnalysisHandlers.getSummary);
    this.handle('topicAnalysis:updateSummary', topicAnalysisHandlers.updateSummary);
    this.handle('topicAnalysis:extractKeywords', topicAnalysisHandlers.extractKeywords);
    this.handle('topicAnalysis:mergeSubjects', topicAnalysisHandlers.mergeSubjects);
    this.handle('topicAnalysis:extractRealtimeKeywords', topicAnalysisHandlers.extractRealtimeKeywords);
    this.handle('topicAnalysis:extractConversationKeywords', topicAnalysisHandlers.extractConversationKeywords);
    this.handle('topicAnalysis:getKeywords', topicAnalysisHandlers.getKeywords);

    // Word Cloud Settings handlers
    this.handle('wordCloudSettings:getSettings', wordCloudSettingsHandlers.getWordCloudSettings);
    this.handle('wordCloudSettings:updateSettings', wordCloudSettingsHandlers.updateWordCloudSettings);
    this.handle('wordCloudSettings:resetSettings', wordCloudSettingsHandlers.resetWordCloudSettings);

    // Keyword Detail handlers
    this.handle('keywordDetail:getKeywordDetails', keywordDetailHandlers.getKeywordDetails);
    this.handle('keywordDetail:updateKeywordAccessState', keywordDetailHandlers.updateKeywordAccessState);

    // Proposal handlers
    this.handle('proposals:getForTopic', proposalHandlers['proposals:getForTopic']);
    this.handle('proposals:updateConfig', proposalHandlers['proposals:updateConfig']);
    this.handle('proposals:getConfig', proposalHandlers['proposals:getConfig']);
    this.handle('proposals:dismiss', proposalHandlers['proposals:dismiss']);
    this.handle('proposals:share', proposalHandlers['proposals:share']);

    // MCP handlers
    this.handle('mcp:listServers', mcpHandlers.listServers);
    this.handle('mcp:addServer', mcpHandlers.addServer);
    this.handle('mcp:updateServer', mcpHandlers.updateServer);
    this.handle('mcp:removeServer', mcpHandlers.removeServer);

    // Export handlers
    this.handle('export:file', exportHandlers.exportFile);
    this.handle('export:fileAuto', exportHandlers.exportFileAuto);
    this.handle('export:message', exportHandlers.exportMessage);
    this.handle('export:htmlWithMicrodata', exportHandlers.exportHtmlWithMicrodata);

    // Feed-Forward handlers
    this.handle('feedForward:createSupply', feedForwardHandlers['feedForward:createSupply']);
    this.handle('feedForward:createDemand', feedForwardHandlers['feedForward:createDemand']);
    this.handle('feedForward:matchSupplyDemand', feedForwardHandlers['feedForward:matchSupplyDemand']);
    this.handle('feedForward:updateTrust', feedForwardHandlers['feedForward:updateTrust']);
    this.handle('feedForward:getCorpusStream', feedForwardHandlers['feedForward:getCorpusStream']);
    this.handle('feedForward:enableSharing', feedForwardHandlers['feedForward:enableSharing']);
    this.handle('feedForward:getTrustScore', feedForwardHandlers['feedForward:getTrustScore']);

    // ONE.core handlers
    this.handle('onecore:initializeNode', oneCoreHandlers.initializeNode);
    this.handle('onecore:restartNode', oneCoreHandlers.restartNode);
    this.handle('onecore:createLocalInvite', oneCoreHandlers.createLocalInvite);
    this.handle('onecore:createBrowserPairingInvite', oneCoreHandlers.createBrowserPairingInvite);
    this.handle('onecore:getBrowserPairingInvite', oneCoreHandlers.getBrowserPairingInvite);
    this.handle('onecore:createNetworkInvite', oneCoreHandlers.createNetworkInvite);
    this.handle('onecore:listInvites', oneCoreHandlers.listInvites);
    this.handle('onecore:revokeInvite', oneCoreHandlers.revokeInvite);
    this.handle('onecore:getNodeStatus', oneCoreHandlers.getNodeStatus);
    this.handle('onecore:setNodeState', oneCoreHandlers.setNodeState);
    this.handle('onecore:getNodeState', oneCoreHandlers.getNodeState);
    this.handle('onecore:getNodeConfig', oneCoreHandlers.getNodeConfig);
    this.handle('onecore:testSettingsReplication', oneCoreHandlers.testSettingsReplication);
    this.handle('onecore:syncConnectionSettings', oneCoreHandlers.syncConnectionSettings);
    this.handle('onecore:getCredentialsStatus', oneCoreHandlers.getCredentialsStatus);
    this.handle('onecore:getContacts', oneCoreHandlers.getContacts);
    this.handle('onecore:getPeerList', oneCoreHandlers.getPeerList);
    this.handle('onecore:getOrCreateTopicForContact', topicHandlers.getOrCreateTopicForContact);
    this.handle('onecore:secureStore', oneCoreHandlers.secureStore);
    this.handle('onecore:secureRetrieve', oneCoreHandlers.secureRetrieve);
    this.handle('onecore:clearStorage', oneCoreHandlers.clearStorage);
    this.handle('onecore:hasPersonName', oneCoreHandlers.hasPersonName);
    this.handle('onecore:setPersonName', oneCoreHandlers.setPersonName);
    this.handle('onecore:updateMood', oneCoreHandlers.updateMood);

    // Topic feedback handler
    this.handle('topics:recordFeedback', topicHandlers.recordSubjectFeedback);

    // Debug handler for owner ID comparison
    this.handle('debug', (event: IpcMainInvokeEvent, data: any) => {
      if (data.type === 'browser-owner-id') {
        console.log('[DEBUG] Browser Owner ID received:', data.ownerId);
        console.log('[DEBUG] Timestamp:', data.timestamp);
      } else {
        console.log('[DEBUG]', data);
      }
    });

    // Device handlers
    initializeDeviceHandlers();

    // Contact handlers
    registerContactHandlers();

    // Note: app:clearData is handled in lama-electron-shadcn.js

    // Action handlers (user-initiated actions)
    this.handle('action:init', this.handleAction('init'));
    this.handle('action:login', this.handleAction('login'));
    this.handle('action:logout', this.handleAction('logout'));
    this.handle('action:sendMessage', this.handleAction('sendMessage'));

    // Query handlers (request state)
    this.handle('query:getState', this.handleQuery('getState'));
    this.handle('query:getConversation', this.handleQuery('getConversation'));
    this.handle('query:getMessages', this.handleQuery('getMessages'));
  }

  private handle(channel: string, handler: IPCHandler): void {
    // Remove any existing handler
    if (this.handlers.has(channel)) {
      ipcMain.removeHandler(channel);
    }

    // Register new handler with error handling
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: any[]) => {
      try {
        this.safeLog(`[IPC] Handling: ${channel}`, args);
        const result: any = await handler(event, ...args);
        // Don't double-wrap if handler already returns success/error format
        if (result && typeof result === 'object' && 'success' in result) {
          return result;
        }
        return { success: true, data: result };
      } catch (error) {
        this.safeError(`[IPC] Error in ${channel}:`, error);
        return {
          success: false,
          error: (error as Error).message || 'Unknown error'
        };
      }
    });

    (this.handlers as any)?.set(channel, handler);
  }

  // Generic action handler wrapper
  private handleAction(actionType: string): IPCHandler {
    return async (event: IpcMainInvokeEvent, payload: any) => {
      this.safeLog(`[IPC] Action: ${actionType}`, payload);

      // Process action based on type
      switch (actionType) {
        case 'init':
          // Platform is already initialized in main process
          return { initialized: true, platform: 'electron' };
        case 'login':
          return await authHandlers.login(event, payload);
        case 'logout':
          return await authHandlers.logout(event);
        case 'sendMessage':
          return await chatHandlers.sendMessage(event, payload);
        default:
          throw new Error(`Unknown action: ${actionType}`);
      }
    };
  }

  // Generic query handler wrapper
  private handleQuery(queryType: string): IPCHandler {
    return async (event: IpcMainInvokeEvent, params: any) => {
      this.safeLog(`[IPC] Query: ${queryType}`, params);

      switch (queryType) {
        case 'getState':
          return await stateHandlers.getState(event, params);
        case 'getConversation':
          return await chatHandlers.getConversation(event, params);
        case 'getMessages':
          return await chatHandlers.getMessages(event, params);
        default:
          throw new Error(`Unknown query: ${queryType}`);
      }
    };
  }

  // Send update to renderer
  sendUpdate(channel: string, data: any): void {
    if (this.mainWindow && !this.mainWindow?.isDestroyed()) {
      this.mainWindow?.webContents.send(channel, data);
    }
  }

  // Forward console logs to renderer
  sendLogToRenderer(level: string, ...args: any[]): void {
    if (this.mainWindow && !this.mainWindow?.isDestroyed()) {
      this.mainWindow?.webContents.send('update:mainProcessLog', {
        level,
        message: args.join(' '),
        timestamp: Date.now()
      });
    }
  }

  // Broadcast state change to renderer
  broadcastStateChange(path: string, newValue: any): void {
    this.sendUpdate('update:stateChanged', {
      path,
      value: newValue,
      timestamp: Date.now()
    });
  }

  async handleClearData(): Promise<{ success: boolean; error?: string }> {
    try {
      this.safeLog('[IPCController] Clearing app data...');

      const fs: any = await import('fs');
      const path: any = await import('path');

      // Clear device manager contacts
      const { default: deviceManager } = await import('../core/device-manager.js');
      deviceManager.devices.clear();
      await deviceManager.saveDevices();

      // Clear ALL ONE.core storage
      const storageDirs = [
        path.join(process.cwd(), 'OneDB')
      ];

      for (const dir of storageDirs) {
        try {
          await fs.promises.rm(dir, { recursive: true, force: true });
          this.safeLog(`[IPCController] Cleared storage: ${dir}`);
        } catch (error) {
          // Directory might not exist, which is fine
          if (error.code !== 'ENOENT') {
            this.safeError(`[IPCController] Error clearing ${dir}:`, error);
          }
        }
      }

      // Clear any cached state
      const { default: stateManager } = await import('../state/manager.js');
      stateManager.clearState();

      // Properly shutdown Node ONE.core instance
      const { default: nodeOneCore } = await import('../core/node-one-core.js');

      if (nodeOneCore.initialized) {
        this.safeLog('[IPCController] Shutting down Node ONE.core instance...');
        await nodeOneCore.shutdown();
        this.safeLog('[IPCController] Node ONE.core instance shut down');
      }

      this.safeLog('[IPCController] App data cleared, ready for fresh start');

      return { success: true };

    } catch (error) {
      this.safeError('[IPCController] Failed to clear app data:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  shutdown(): void {
    // Remove all handlers
    this.handlers.forEach((handler: any, channel: any) => {
      ipcMain.removeHandler(channel);
    });
    this.handlers.clear();

    this.safeLog('[IPCController] Shutdown complete');
  }
}

export default new IPCController();