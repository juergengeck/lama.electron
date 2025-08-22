/**
 * Shell Execution MCP Server
 * Provides shell command execution capabilities
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export class ShellMCPServer {
  private server: Server
  private runningProcesses: Map<string, any> = new Map()
  
  constructor() {
    this.server = new Server({
      name: 'lama-shell',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    })
    
    this.setupTools()
  }
  
  private setupTools() {
    this.server.setRequestHandler('tools/list', async () => ({
      tools: [
        {
          name: 'execute_command',
          description: 'Execute a shell command and return the output',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The shell command to execute'
              },
              cwd: {
                type: 'string',
                description: 'Working directory for the command',
                default: process.cwd()
              },
              timeout: {
                type: 'number',
                description: 'Command timeout in milliseconds',
                default: 30000
              }
            },
            required: ['command']
          }
        },
        {
          name: 'run_background_task',
          description: 'Run a command in the background',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The shell command to run in background'
              },
              taskId: {
                type: 'string',
                description: 'Unique ID for this background task'
              },
              cwd: {
                type: 'string',
                description: 'Working directory',
                default: process.cwd()
              }
            },
            required: ['command', 'taskId']
          }
        },
        {
          name: 'check_background_task',
          description: 'Check the status and output of a background task',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'string',
                description: 'The task ID to check'
              }
            },
            required: ['taskId']
          }
        },
        {
          name: 'kill_background_task',
          description: 'Kill a running background task',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'string',
                description: 'The task ID to kill'
              }
            },
            required: ['taskId']
          }
        },
        {
          name: 'get_environment',
          description: 'Get environment variables',
          inputSchema: {
            type: 'object',
            properties: {
              variables: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific variables to get (empty for all)'
              }
            }
          }
        },
        {
          name: 'which_command',
          description: 'Find the location of a command',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'Command to locate'
              }
            },
            required: ['command']
          }
        }
      ]
    }))
    
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params
      
      try {
        switch (name) {
          case 'execute_command':
            return await this.executeCommand(args.command, args.cwd, args.timeout)
            
          case 'run_background_task':
            return await this.runBackgroundTask(args.command, args.taskId, args.cwd)
            
          case 'check_background_task':
            return await this.checkBackgroundTask(args.taskId)
            
          case 'kill_background_task':
            return await this.killBackgroundTask(args.taskId)
            
          case 'get_environment':
            return await this.getEnvironment(args.variables)
            
          case 'which_command':
            return await this.whichCommand(args.command)
            
          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ]
        }
      }
    })
  }
  
  private async executeCommand(command: string, cwd?: string, timeout = 30000) {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd || process.cwd(),
        timeout
      })
      
      return {
        content: [
          {
            type: 'text',
            text: stdout || stderr || 'Command executed successfully with no output'
          }
        ]
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Command failed: ${error.message}\nStderr: ${error.stderr}\nStdout: ${error.stdout}`
          }
        ]
      }
    }
  }
  
  private async runBackgroundTask(command: string, taskId: string, cwd?: string) {
    if (this.runningProcesses.has(taskId)) {
      return {
        content: [
          {
            type: 'text',
            text: `Task ${taskId} is already running`
          }
        ]
      }
    }
    
    const [cmd, ...args] = command.split(' ')
    const process = spawn(cmd, args, {
      cwd: cwd || process.cwd(),
      shell: true
    })
    
    const taskData = {
      process,
      output: [],
      error: [],
      status: 'running'
    }
    
    process.stdout.on('data', (data) => {
      taskData.output.push(data.toString())
    })
    
    process.stderr.on('data', (data) => {
      taskData.error.push(data.toString())
    })
    
    process.on('exit', (code) => {
      taskData.status = code === 0 ? 'completed' : 'failed'
    })
    
    this.runningProcesses.set(taskId, taskData)
    
    return {
      content: [
        {
          type: 'text',
          text: `Background task ${taskId} started`
        }
      ]
    }
  }
  
  private async checkBackgroundTask(taskId: string) {
    const task = this.runningProcesses.get(taskId)
    
    if (!task) {
      return {
        content: [
          {
            type: 'text',
            text: `No task found with ID: ${taskId}`
          }
        ]
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: task.status,
            output: task.output.join(''),
            error: task.error.join('')
          }, null, 2)
        }
      ]
    }
  }
  
  private async killBackgroundTask(taskId: string) {
    const task = this.runningProcesses.get(taskId)
    
    if (!task) {
      return {
        content: [
          {
            type: 'text',
            text: `No task found with ID: ${taskId}`
          }
        ]
      }
    }
    
    task.process.kill()
    this.runningProcesses.delete(taskId)
    
    return {
      content: [
        {
          type: 'text',
          text: `Task ${taskId} killed`
        }
      ]
    }
  }
  
  private async getEnvironment(variables?: string[]) {
    const env = variables && variables.length > 0
      ? Object.fromEntries(variables.map(v => [v, process.env[v]]))
      : process.env
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(env, null, 2)
        }
      ]
    }
  }
  
  private async whichCommand(command: string) {
    try {
      const { stdout } = await execAsync(`which ${command}`)
      return {
        content: [
          {
            type: 'text',
            text: stdout.trim()
          }
        ]
      }
    } catch {
      return {
        content: [
          {
            type: 'text',
            text: `Command not found: ${command}`
          }
        ]
      }
    }
  }
  
  async start() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.log('Shell MCP Server started')
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new ShellMCPServer()
  server.start()
}