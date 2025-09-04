/**
 * Filesystem MCP Server
 * Provides file system access tools similar to Claude Code's capabilities
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
export class FilesystemMCPServer {
    constructor(basePath = '/Users/gecko/src/lama.electron') {
        Object.defineProperty(this, "server", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "basePath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.basePath = basePath;
        this.server = new Server({
            name: 'lama-filesystem',
            version: '1.0.0'
        }, {
            capabilities: {
                tools: {}
            }
        });
        this.setupTools();
    }
    setupTools() {
        // Read file tool
        this.server.setRequestHandler('tools/list', async () => ({
            tools: [
                {
                    name: 'read_file',
                    description: 'Read the contents of a file',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            path: {
                                type: 'string',
                                description: 'Path to the file to read'
                            },
                            encoding: {
                                type: 'string',
                                description: 'File encoding (default: utf8)',
                                default: 'utf8'
                            }
                        },
                        required: ['path']
                    }
                },
                {
                    name: 'write_file',
                    description: 'Write content to a file',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            path: {
                                type: 'string',
                                description: 'Path to the file to write'
                            },
                            content: {
                                type: 'string',
                                description: 'Content to write to the file'
                            }
                        },
                        required: ['path', 'content']
                    }
                },
                {
                    name: 'list_directory',
                    description: 'List files and directories in a given path',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            path: {
                                type: 'string',
                                description: 'Directory path to list'
                            },
                            recursive: {
                                type: 'boolean',
                                description: 'List recursively',
                                default: false
                            }
                        },
                        required: ['path']
                    }
                },
                {
                    name: 'search_files',
                    description: 'Search for files using glob patterns',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            pattern: {
                                type: 'string',
                                description: 'Glob pattern to search for files'
                            },
                            basePath: {
                                type: 'string',
                                description: 'Base path for search',
                                default: '.'
                            }
                        },
                        required: ['pattern']
                    }
                },
                {
                    name: 'grep_files',
                    description: 'Search file contents using regular expressions',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            pattern: {
                                type: 'string',
                                description: 'Regular expression pattern to search'
                            },
                            path: {
                                type: 'string',
                                description: 'Path to search in'
                            },
                            filePattern: {
                                type: 'string',
                                description: 'File pattern to search (e.g., *.ts)',
                                default: '*'
                            }
                        },
                        required: ['pattern', 'path']
                    }
                },
                {
                    name: 'edit_file',
                    description: 'Edit a file by replacing text',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            path: {
                                type: 'string',
                                description: 'Path to the file to edit'
                            },
                            search: {
                                type: 'string',
                                description: 'Text to search for'
                            },
                            replace: {
                                type: 'string',
                                description: 'Text to replace with'
                            },
                            all: {
                                type: 'boolean',
                                description: 'Replace all occurrences',
                                default: false
                            }
                        },
                        required: ['path', 'search', 'replace']
                    }
                }
            ]
        }));
        // Handle tool execution
        this.server.setRequestHandler('tools/call', async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'read_file':
                        return await this.readFile(args.path, args.encoding);
                    case 'write_file':
                        return await this.writeFile(args.path, args.content);
                    case 'list_directory':
                        return await this.listDirectory(args.path, args.recursive);
                    case 'search_files':
                        return await this.searchFiles(args.pattern, args.basePath);
                    case 'grep_files':
                        return await this.grepFiles(args.pattern, args.path, args.filePattern);
                    case 'edit_file':
                        return await this.editFile(args.path, args.search, args.replace, args.all);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error.message}`
                        }
                    ]
                };
            }
        });
    }
    async readFile(filePath, encoding = 'utf8') {
        const fullPath = path.resolve(this.basePath, filePath);
        const content = await fs.readFile(fullPath, encoding);
        return {
            content: [
                {
                    type: 'text',
                    text: content
                }
            ]
        };
    }
    async writeFile(filePath, content) {
        const fullPath = path.resolve(this.basePath, filePath);
        await fs.writeFile(fullPath, content, 'utf8');
        return {
            content: [
                {
                    type: 'text',
                    text: `File written successfully: ${filePath}`
                }
            ]
        };
    }
    async listDirectory(dirPath, recursive = false) {
        const fullPath = path.resolve(this.basePath, dirPath);
        if (recursive) {
            const files = await glob('**/*', { cwd: fullPath });
            return {
                content: [
                    {
                        type: 'text',
                        text: files.join('\n')
                    }
                ]
            };
        }
        else {
            const entries = await fs.readdir(fullPath, { withFileTypes: true });
            const formatted = entries.map(entry => {
                const type = entry.isDirectory() ? '[DIR]' : '[FILE]';
                return `${type} ${entry.name}`;
            });
            return {
                content: [
                    {
                        type: 'text',
                        text: formatted.join('\n')
                    }
                ]
            };
        }
    }
    async searchFiles(pattern, basePath = '.') {
        const fullPath = path.resolve(this.basePath, basePath);
        const files = await glob(pattern, { cwd: fullPath });
        return {
            content: [
                {
                    type: 'text',
                    text: files.length > 0 ? files.join('\n') : 'No files found'
                }
            ]
        };
    }
    async grepFiles(pattern, searchPath, filePattern = '*') {
        const fullPath = path.resolve(this.basePath, searchPath);
        const files = await glob(filePattern, { cwd: fullPath });
        const regex = new RegExp(pattern, 'gi');
        const results = [];
        for (const file of files) {
            const filePath = path.join(fullPath, file);
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    if (regex.test(line)) {
                        results.push(`${file}:${index + 1}: ${line.trim()}`);
                    }
                });
            }
            catch (error) {
                // Skip files that can't be read
            }
        }
        return {
            content: [
                {
                    type: 'text',
                    text: results.length > 0 ? results.join('\n') : 'No matches found'
                }
            ]
        };
    }
    async editFile(filePath, search, replace, all = false) {
        const fullPath = path.resolve(this.basePath, filePath);
        let content = await fs.readFile(fullPath, 'utf8');
        if (all) {
            content = content.replaceAll(search, replace);
        }
        else {
            content = content.replace(search, replace);
        }
        await fs.writeFile(fullPath, content, 'utf8');
        return {
            content: [
                {
                    type: 'text',
                    text: `File edited successfully: ${filePath}`
                }
            ]
        };
    }
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.log('Filesystem MCP Server started');
    }
}
// Start server if run directly
if (require.main === module) {
    const server = new FilesystemMCPServer();
    server.start();
}
