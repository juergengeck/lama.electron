/**
 * MCP Server Configuration Recipes
 * Stores MCP server configurations as versioned ONE.core objects
 */

/**
 * MCPServer - Configuration for an MCP server
 * Versioned object with name as ID property
 */
export const MCPServerRecipe = {
  $type$: 'Recipe',
  name: 'MCPServer',
  rule: [
    {
      itemprop: 'name',
      isId: true,  // Name is the unique identifier
      itemtype: { type: 'string' }
    },
    {
      itemprop: 'command',
      itemtype: { type: 'string' }
    },
    {
      itemprop: 'args',
      itemtype: {
        type: 'array',
        item: {
          type: 'string'
          // No rules needed for primitive types
        }
      }
    },
    {
      itemprop: 'description',
      itemtype: { type: 'string' }
    },
    {
      itemprop: 'enabled',
      itemtype: { type: 'boolean' }
    },
    {
      itemprop: 'createdAt',
      itemtype: { type: 'number' }
    },
    {
      itemprop: 'updatedAt',
      itemtype: { type: 'number' }
    }
  ]
};

/**
 * MCPServerConfig - User's MCP configuration object
 * Stores references to all configured MCP servers
 * Versioned object with userEmail as ID
 */
export const MCPServerConfigRecipe = {
  $type$: 'Recipe',
  name: 'MCPServerConfig',
  rule: [
    {
      itemprop: 'userEmail',
      isId: true,  // User email is the unique identifier
      itemtype: { type: 'string' }
    },
    {
      itemprop: 'servers',
      itemtype: {
        type: 'bag',
        item: {
          type: 'referenceToId',
          allowedTypes: new Set(['MCPServer'])
          // No rules needed for reference types
        }
      }
    },
    {
      itemprop: 'updatedAt',
      itemtype: { type: 'number' }
    }
  ]
};

export const MCPRecipes = [
  MCPServerRecipe,
  MCPServerConfigRecipe
];
