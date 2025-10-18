/**
 * Memory MCP Tools
 * Provides LAMA with access to its own conversation history
 *
 * IMPORTANT: These tools only work for -private models (LAMA)
 * They provide access to the LAMA topic which serves as the AI's memory
 */

export class MemoryTools {
  constructor(nodeOneCore) {
    this.nodeOneCore = nodeOneCore
  }

  /**
   * Get tool definitions for MCP
   */
  getToolDefinitions() {
    return [
      {
        name: 'memory:search',
        description: 'Search your own conversation history (LAMA topic) for relevant past discussions. Use this to recall what you\'ve learned.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query - keywords or concepts to find in your memory'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of messages to return (default: 10)',
              default: 10
            }
          },
          required: ['query']
        }
      },
      {
        name: 'memory:recent',
        description: 'Get your most recent memories (messages from LAMA topic). Use this to recall recent learnings.',
        inputSchema: {
          type: 'object',
          properties: {
            count: {
              type: 'number',
              description: 'Number of recent messages to retrieve (default: 20)',
              default: 20
            }
          }
        }
      },
      {
        name: 'memory:subjects',
        description: 'Get subjects and themes you\'ve learned about across all conversations. Shows what topics you have context for.',
        inputSchema: {
          type: 'object',
          properties: {
            topicId: {
              type: 'string',
              description: 'Optional: Get subjects for a specific topic (default: all topics)'
            }
          }
        }
      }
    ]
  }

  /**
   * Execute a memory tool
   * @param {string} toolName - Name of the tool to execute
   * @param {object} params - Tool parameters
   * @param {object} context - Execution context (topicId, personId, isPrivateModel)
   * @returns {object} MCP-formatted result
   */
  async executeTool(toolName, params, context) {
    // Memory tools are scoped to topics the model participates in
    // Access control is enforced by the topic system itself

    switch (toolName) {
      case 'memory:search':
        return await this.searchMemory(params.query, params.limit || 10)

      case 'memory:recent':
        return await this.getRecentMemory(params.count || 20)

      case 'memory:subjects':
        return await this.getSubjects(params.topicId)

      default:
        return {
          content: [{
            type: 'text',
            text: `Unknown memory tool: ${toolName}`
          }],
          isError: true
        }
    }
  }

  /**
   * Search LAMA topic for relevant messages
   */
  async searchMemory(query, limit) {
    try {
      console.log(`[MemoryTools] Searching memory for: "${query}"`)

      // Enter LAMA topic room
      const topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom('lama')
      const allMessages = await topicRoom.retrieveAllMessages()

      // Simple keyword search (could be enhanced with semantic search later)
      const queryLower = query.toLowerCase()
      const matches = allMessages
        .filter(msg => {
          const text = msg.data?.text || msg.text || ''
          return text.toLowerCase().includes(queryLower)
        })
        .slice(-limit) // Most recent matches

      if (matches.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No memories found matching "${query}"`
          }]
        }
      }

      // Format results
      const results = matches.map((msg, idx) => {
        const text = msg.data?.text || msg.text || ''
        const timestamp = msg.data?.timestamp || msg.timestamp || 'unknown'
        return `[${idx + 1}] ${timestamp}\n${text}\n`
      }).join('\n---\n\n')

      return {
        content: [{
          type: 'text',
          text: `Found ${matches.length} relevant memories:\n\n${results}`
        }]
      }
    } catch (error) {
      console.error('[MemoryTools] Search failed:', error)
      return {
        content: [{
          type: 'text',
          text: `Memory search failed: ${error.message}`
        }],
        isError: true
      }
    }
  }

  /**
   * Get recent messages from LAMA topic
   */
  async getRecentMemory(count) {
    try {
      console.log(`[MemoryTools] Getting ${count} recent memories`)

      const topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom('lama')
      const allMessages = await topicRoom.retrieveAllMessages()

      // Get most recent messages
      const recent = allMessages.slice(-count)

      if (recent.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No memories yet - this is the beginning of your memory.'
          }]
        }
      }

      // Format results
      const results = recent.map((msg, idx) => {
        const text = msg.data?.text || msg.text || ''
        const timestamp = msg.data?.timestamp || msg.timestamp || 'unknown'
        const sender = msg.data?.sender || msg.author
        const isUser = !this.nodeOneCore.aiAssistantModel?.isAIPerson(sender)
        const role = isUser ? 'User' : 'You'

        return `[${idx + 1}] ${timestamp} - ${role}:\n${text}\n`
      }).join('\n---\n\n')

      return {
        content: [{
          type: 'text',
          text: `Your ${recent.length} most recent memories:\n\n${results}`
        }]
      }
    } catch (error) {
      console.error('[MemoryTools] Recent memory retrieval failed:', error)
      return {
        content: [{
          type: 'text',
          text: `Failed to retrieve recent memories: ${error.message}`
        }],
        isError: true
      }
    }
  }

  /**
   * Get subjects/themes from topic analysis
   */
  async getSubjects(topicId) {
    try {
      const topicAnalysisModel = this.nodeOneCore.topicAnalysisModel

      if (!topicAnalysisModel) {
        return {
          content: [{
            type: 'text',
            text: 'Topic analysis not available - cannot retrieve subjects'
          }],
          isError: true
        }
      }

      let subjects
      if (topicId) {
        console.log(`[MemoryTools] Getting subjects for topic: ${topicId}`)
        subjects = await topicAnalysisModel.getSubjects(topicId)
      } else {
        console.log(`[MemoryTools] Getting all subjects across conversations`)
        // Get all topics and aggregate subjects
        const allChannels = await this.nodeOneCore.channelManager.getMatchingChannelInfos()
        const allSubjects = []

        for (const channel of allChannels) {
          try {
            const topicSubjects = await topicAnalysisModel.getSubjects(channel.id)
            allSubjects.push(...topicSubjects)
          } catch (e) {
            // Skip topics without subjects
          }
        }

        subjects = allSubjects
      }

      if (!subjects || subjects.length === 0) {
        return {
          content: [{
            type: 'text',
            text: topicId
              ? `No subjects found for topic ${topicId}`
              : 'No subjects learned yet across any conversations'
          }]
        }
      }

      // Format subjects with their keywords
      const activeSubjects = subjects.filter(s => !s.archived)
      const formatted = activeSubjects.map((subject, idx) => {
        const keywords = subject.keywords?.join(', ') || 'no keywords'
        const desc = subject.description || 'no description'
        return `[${idx + 1}] ${subject.keywordCombination || subject.name}\n   Keywords: ${keywords}\n   ${desc}`
      }).join('\n\n')

      return {
        content: [{
          type: 'text',
          text: `You have context for ${activeSubjects.length} subjects:\n\n${formatted}`
        }]
      }
    } catch (error) {
      console.error('[MemoryTools] Subject retrieval failed:', error)
      return {
        content: [{
          type: 'text',
          text: `Failed to retrieve subjects: ${error.message}`
        }],
        isError: true
      }
    }
  }
}

export default MemoryTools
