/**
 * Refinio API Server Integration
 * 
 * This module embeds the refinio.api server into the Electron main process,
 * providing a QUIC-based API that can be accessed by refinio.cli or other clients.
 */

import { getQuicTransport } from '../../packages/one.core/lib/system/quic-transport.js'
import { QuicVCServer } from '../../packages/refinio.api/dist/server/QuicVCServer.js'
import { InstanceAuthManager } from '../../packages/refinio.api/dist/auth/InstanceAuthManager.js'
import { ObjectHandler } from '../../packages/refinio.api/dist/handlers/ObjectHandler.js'
import { RecipeHandler } from '../../packages/refinio.api/dist/handlers/RecipeHandler.js'
import { AIHandler } from './handlers/AIHandler.js'
import path from 'path'
import { app } from 'electron'
import nodeOneCore from '../core/node-one-core.js'

class RefinioApiServer {
  constructor(aiAssistantModel = null) {
    this.server = null
    this.instance = null
    this.config = null
    this.aiAssistantModel = aiAssistantModel
    this.aiHandler = null
  }

  /**
   * Initialize and start the API server
   * Uses the existing Node instance if available
   */
  async start() {
    console.log('[RefinioAPI] Starting API server...')
    
    // Check if Node instance is already initialized
    const nodeInfo = nodeOneCore.getInfo()
    
    if (!nodeInfo.initialized) {
      console.log('[RefinioAPI] Node instance not initialized, waiting for provisioning')
      return false
    }

    // Get QUIC transport
    const quicTransport = getQuicTransport()
    if (!quicTransport) {
      console.log('[RefinioAPI] QUIC transport not available')
      return false
    }

    try {
      // Use the existing Node instance
      this.instance = nodeOneCore.getInstance()
      
      // Create auth manager using the existing instance
      const authManager = new InstanceAuthManager(this.instance)
      
      // Initialize handlers with the existing instance
      const objectHandler = new ObjectHandler()
      await objectHandler.initialize(this.instance)
      
      const recipeHandler = new RecipeHandler()
      await recipeHandler.initialize(this.instance)
      
      // Initialize AI handler if AI assistant is available
      if (this.aiAssistantModel) {
        this.aiHandler = new AIHandler(nodeOneCore, this.aiAssistantModel)
      }
      
      // Create QUIC server using the existing instance
      this.server = new QuicVCServer({
        instance: this.instance,
        quicTransport,
        authManager,
        handlers: {
          object: objectHandler,
          recipe: recipeHandler,
          ...(this.aiHandler ? { ai: this.aiHandler } : {})
        },
        config: {
          port: 9876, // Different from WebSocket port 8765
          host: 'localhost'
        }
      })
      
      await this.server.start()
      
      console.log('[RefinioAPI] ✅ API server started on port 9876')
      console.log('[RefinioAPI] Using existing Node instance:', nodeInfo.instanceName)
      console.log('[RefinioAPI] Owner:', nodeInfo.ownerId)
      
      if (this.aiHandler) {
        console.log('[RefinioAPI] AI handler integrated - AI endpoints available')
      }
      
      // Register API endpoints for LAMA-specific operations
      await this.registerLamaEndpoints()
      
      return true
    } catch (error) {
      console.error('[RefinioAPI] Failed to start API server:', error)
      return false
    }
  }

  /**
   * Set AI Assistant Model after initialization
   */
  setAIAssistantModel(aiAssistantModel) {
    this.aiAssistantModel = aiAssistantModel
    
    // Reinitialize AI handler if server is running
    if (this.server && aiAssistantModel) {
      this.aiHandler = new AIHandler(nodeOneCore, aiAssistantModel)
      console.log('[RefinioAPI] AI handler updated with new AI assistant model')
    }
  }

  /**
   * Register LAMA-specific API endpoints
   */
  async registerLamaEndpoints() {
    if (!this.server) return
    
    console.log('[RefinioAPI] Registering LAMA endpoints...')
    
    // Add custom handlers for LAMA operations
    // These will be accessible via refinio.cli
    
    // Example: Chat operations
    this.server.addHandler('chat', {
      list: async () => {
        // Return list of conversations
        const channels = await nodeOneCore.channelManager?.getChannels()
        return channels || []
      },
      
      create: async (params) => {
        // Create new conversation
        const { name, participants } = params
        return await nodeOneCore.channelManager?.createChannel(name, participants)
      },
      
      send: async (params) => {
        // Send message
        const { channelId, message } = params
        return await nodeOneCore.channelManager?.sendMessage(channelId, message)
      }
    })
    
    // Example: Contact operations
    this.server.addHandler('contacts', {
      list: async () => {
        const contacts = await nodeOneCore.leuteModel?.listContacts()
        return contacts || []
      },
      
      add: async (params) => {
        const { email, name } = params
        return await nodeOneCore.leuteModel?.addContact(email, name)
      }
    })
    
    // Example: AI operations
    this.server.addHandler('ai', {
      models: async () => {
        // Return available AI models
        return nodeOneCore.llmManager?.getAvailableModels() || []
      },
      
      complete: async (params) => {
        const { model, prompt } = params
        return await nodeOneCore.llmManager?.complete(model, prompt)
      }
    })
    
    console.log('[RefinioAPI] ✅ LAMA endpoints registered')
  }

  /**
   * Stop the API server
   */
  async stop() {
    if (this.server) {
      console.log('[RefinioAPI] Stopping API server...')
      await this.server.stop()
      this.server = null
      this.instance = null
      console.log('[RefinioAPI] ✅ API server stopped')
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      running: !!this.server,
      port: this.config?.server?.port,
      host: this.config?.server?.host,
      instance: this.instance?.name
    }
  }
}

// Export singleton instance
export default RefinioApiServer