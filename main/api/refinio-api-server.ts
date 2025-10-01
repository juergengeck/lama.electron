/**
 * Refinio API Server Integration
 *
 * This module embeds the refinio.api server into the Electron main process,
 * providing a QUIC-based API that can be accessed by refinio.cli or other clients.
 */

import QuicTransport from '../core/quic-transport.js'
import { QuicVCServer } from '../../packages/refinio.api/dist/server/QuicVCServer.js'
import { InstanceAuthManager } from '../../packages/refinio.api/dist/auth/InstanceAuthManager.js'
import { ObjectHandler } from '../../packages/refinio.api/dist/handlers/ObjectHandler.js'
import { RecipeHandler } from '../../packages/refinio.api/dist/handlers/RecipeHandler.js'
import { AIHandler } from './handlers/AIHandler.js'
import path from 'path'
import electron from 'electron'
const { app } = electron
import nodeOneCore from '../core/node-one-core.js'

interface NodeInfo {
  initialized: boolean
  instanceName?: string
  ownerId?: string
}

interface ServerConfig {
  port: number
  host: string
}


interface Instance {
  name?: string
  [key: string]: any
}

interface ServerStatus {
  running: boolean
  port?: number
  host?: string
  instance?: string
}

interface AIAssistantModel {
  [key: string]: any
}

interface ChatHandler {
  list: () => Promise<any[]>
  create: (params: { name: string; participants: any[] }) => Promise<any>
  send: (params: { channelId: string; message: string }) => Promise<any>
}

interface ContactsHandler {
  list: () => Promise<any[]>
  add: (params: { email: string; name: string }) => Promise<any>
}

interface AIHandlerEndpoints {
  models: () => Promise<any[]>
  complete: (params: { model: string; prompt: string }) => Promise<any>
}


class RefinioApiServer {
  public server: any | null
  public instance: Instance | null
  public config: any | null
  public aiAssistantModel: AIAssistantModel | null
  public aiHandler: AIHandler | null

  constructor(aiAssistantModel: AIAssistantModel | null = null) {
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
  async start(): Promise<boolean> {
    console.log('[RefinioAPI] Starting API server...')

    // Check if Node instance is already initialized
    const nodeInfo: NodeInfo = nodeOneCore.getInfo()

    if (!nodeInfo.initialized) {
      console.log('[RefinioAPI] Node instance not initialized, waiting for provisioning')
      return false
    }

    // Get QUIC transport
    const quicTransport = new QuicTransport(nodeOneCore as any)

    try {
      // Use the existing Node instance
      this.instance = nodeOneCore.getInstance()

      if (!this.instance) {
        console.log('[RefinioAPI] Node instance not available')
        return false
      }

      // Create auth manager using the existing instance
      const authManager = new InstanceAuthManager()

      // Initialize handlers with the existing instance
      const objectHandler = new ObjectHandler(nodeOneCore as any)
      const recipeHandler = new RecipeHandler()

      // Initialize AI handler if AI assistant is available
      if (this.aiAssistantModel) {
        this.aiHandler = new AIHandler(nodeOneCore as any, this.aiAssistantModel as any)
      }

      // Create QUIC server using the existing instance
      const serverOptions = {
        instance: this.instance,
        quicTransport,
        authManager,
        handlers: {
          object: objectHandler,
          recipe: recipeHandler,
          ...(this.aiHandler ? { ai: this.aiHandler } : {})
        },
        config: {
          port: 9876,
          host: 'localhost'
        }
      }

      this.server = new QuicVCServer(serverOptions as any)

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
    } catch (error: unknown) {
      console.error('[RefinioAPI] Failed to start API server:', error)
      return false
    }
  }

  /**
   * Set AI Assistant Model after initialization
   */
  setAIAssistantModel(aiAssistantModel: AIAssistantModel): void {
    this.aiAssistantModel = aiAssistantModel

    // Reinitialize AI handler if server is running
    if (this.server && aiAssistantModel) {
      this.aiHandler = new AIHandler(nodeOneCore as any, aiAssistantModel as any)
      console.log('[RefinioAPI] AI handler updated with new AI assistant model')
    }
  }

  /**
   * Register LAMA-specific API endpoints
   */
  async registerLamaEndpoints(): Promise<void> {
    if (!this.server) return

    console.log('[RefinioAPI] Registering LAMA endpoints...')

    // Add custom handlers for LAMA operations
    // These will be accessible via refinio.cli

    // Example: Chat operations
    const chatHandler: ChatHandler = {
      list: async (): Promise<any[]> => {
        // Return list of conversations from TopicModel
        if (!nodeOneCore.topicModel) {
          return []
        }

        try {
          // Get all topics like the IPC handler does
          const topicRooms = await (nodeOneCore.topicModel as any).getActiveTopicRooms()
          return topicRooms.map((room: any) => ({
            id: room.topic?.name,
            name: room.topic?.name || 'Untitled',
            participants: room.participants || [],
            lastActivity: room.lastActivity || Date.now()
          }))
        } catch (error: unknown) {
          console.error('[RefinioAPI] Error listing conversations:', error)
          return []
        }
      },

      create: async (params: { name: string; participants: any[] }): Promise<any> => {
        // Create new conversation using TopicModel
        const { name, participants } = params

        if (!nodeOneCore.topicModel) {
          return { success: false, error: 'TopicModel not initialized' }
        }

        try {
          // Create topic similar to IPC handler
          const topicRoom = await nodeOneCore.topicModel.enterTopicRoom(name)

          return {
            success: true,
            data: {
              id: topicRoom.topic?.name,
              name: topicRoom.topic?.name,
              participants
            }
          }
        } catch (error) {
          console.error('[RefinioAPI] Error creating conversation:', error)
          return { success: false, error: (error as Error).message }
        }
      },

      send: async (params: { channelId: string; message: string }): Promise<any> => {
        // Send message using TopicModel
        const { channelId, message } = params

        if (!nodeOneCore.topicModel) {
          return { success: false, error: 'TopicModel not initialized' }
        }

        try {
          // Send message similar to IPC handler
          const topicRoom = await nodeOneCore.topicModel.enterTopicRoom(channelId)
          if (!topicRoom) {
            return { success: false, error: 'Topic not found' }
          }

          await topicRoom.sendMessage(message, nodeOneCore.ownerId)

          return { success: true }
        } catch (error) {
          console.error('[RefinioAPI] Error sending message:', error)
          return { success: false, error: (error as Error).message }
        }
      }
    }

    this.server.addHandler('chat', chatHandler)

    // Example: Contact operations
    const contactsHandler: ContactsHandler = {
      list: async (): Promise<any[]> => {
        // Get contacts using LeuteModel.others() method
        if (!nodeOneCore.leuteModel) {
          return []
        }

        try {
          const someoneObjects = await nodeOneCore.leuteModel.others()
          const contacts = []

          for (const someone of someoneObjects) {
            const personId = await someone.mainIdentity()
            if (!personId) continue

            const profiles = await someone.profiles()
            const profile = profiles?.[0]
            const personDescriptions = (profile as any)?.personDescriptions || []
            const personName = personDescriptions.find((d: any) => d.$type$ === 'PersonName')
            const displayName = personName?.name || (profile as any)?.name || `Contact ${String(personId).substring(0, 8)}`

            contacts.push({
              id: personId,
              personId,
              name: displayName,
              isAI: false
            })
          }

          // Add AI contacts if available
          if (nodeOneCore.aiAssistantModel) {
            const aiContacts = nodeOneCore.aiAssistantModel.getAllContacts()
            for (const aiContact of aiContacts) {
              contacts.push({
                id: aiContact.personId,
                personId: aiContact.personId,
                name: aiContact.name,
                isAI: true,
                modelId: aiContact.modelId
              })
            }
          }

          return contacts
        } catch (error: unknown) {
          console.error('[RefinioAPI] Error listing contacts:', error)
          return []
        }
      },

      add: async (params: { email: string; name: string }): Promise<any> => {
        const { email, name } = params

        if (!nodeOneCore.leuteModel) {
          return { success: false, error: 'LeuteModel not initialized' }
        }

        try {
          // TODO: Proper contact creation requires implementing the full contact creation flow
          // For now, return an error since the API signature doesn't match
          return {
            success: false,
            error: 'Contact creation not implemented - requires personId, not email/name'
          }
        } catch (error) {
          console.error('[RefinioAPI] Error adding contact:', error)
          return { success: false, error: (error as Error).message }
        }
      }
    }

    this.server.addHandler('contacts', contactsHandler)

    // Example: AI operations
    const aiHandlerEndpoints: AIHandlerEndpoints = {
      models: async (): Promise<any[]> => {
        // Return available AI models
        return nodeOneCore.llmManager?.getAvailableModels() || []
      },

      complete: async (params: { model: string; prompt: string }): Promise<any> => {
        const { model, prompt } = params
        return await nodeOneCore.llmManager?.complete(model, prompt)
      }
    }

    this.server.addHandler('ai', aiHandlerEndpoints)

    console.log('[RefinioAPI] ✅ LAMA endpoints registered')
  }

  /**
   * Stop the API server
   */
  async stop(): Promise<void> {
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
  getStatus(): ServerStatus {
    return {
      running: !!this.server,
      port: this.config?.server?.port,
      host: this.config?.server?.host,
      instance: this.instance?.name
    }
  }
}

// Export singleton instance
export default RefinioApiServer;