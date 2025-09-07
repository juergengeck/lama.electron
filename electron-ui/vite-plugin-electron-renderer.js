// Plugin to handle Node.js modules in Electron renderer
export function electronRenderer() {
  const nodeBuiltins = [
    'fs', 'fs/promises',
    'path', 
    'util',
    'crypto',
    'stream',
    'buffer',
    'events',
    'os',
    'child_process',
    'net',
    'tls',
    'dns',
    'http',
    'https',
    'zlib',
    'querystring',
    'url',
    'assert',
    'constants',
    'process'
  ];

  return {
    name: 'electron-renderer',
    enforce: 'pre',
    
    config(config, { command }) {
      // Only apply in dev mode
      if (command === 'serve') {
        config.optimizeDeps = config.optimizeDeps || {};
        config.optimizeDeps.exclude = [
          ...(config.optimizeDeps.exclude || []),
          ...nodeBuiltins
        ];
      }
      
      // For build mode
      if (command === 'build') {
        config.build = config.build || {};
        config.build.rollupOptions = config.build.rollupOptions || {};
        config.build.rollupOptions.external = [
          ...(config.build.rollupOptions.external || []),
          ...nodeBuiltins,
          'electron'
        ];
      }
      
      return config;
    },
    
    resolveId(id) {
      // Handle @id/ prefixed modules (Vite's internal resolution)
      if (id.startsWith('/@id/')) {
        const moduleName = id.slice(5);
        if (nodeBuiltins.includes(moduleName)) {
          // Return the @id/ prefixed path so our load() hook can handle it
          return id;
        }
      }
      
      // Handle node: prefixed modules
      if (id.startsWith('node:')) {
        const actualId = id.slice(5);
        if (nodeBuiltins.includes(actualId)) {
          return actualId;
        }
      }
      
      // Handle bare node built-ins
      if (nodeBuiltins.includes(id)) {
        return id;
      }
      
      // Force ws to use the Node.js version
      if (id === 'ws') {
        return 'ws';
      }
      
      return null;
    },
    
    load(id) {
      // Handle @id/ prefixed requests from Vite
      if (id.startsWith('/@id/')) {
        const moduleName = id.slice(5); // Remove /@id/ prefix
        if (nodeBuiltins.includes(moduleName)) {
          // Special handling for util module
          if (moduleName === 'util') {
            return `
              const util = window.require ? window.require('util') : {};
              export default util;
              export const { 
                promisify, 
                deprecate, 
                inherits, 
                inspect, 
                format, 
                debuglog,
                isArray,
                isBoolean,
                isNull,
                isNullOrUndefined,
                isNumber,
                isString,
                isSymbol,
                isUndefined,
                isRegExp,
                isObject,
                isDate,
                isError,
                isFunction,
                isPrimitive,
                isBuffer
              } = util;
              // TextEncoder and TextDecoder are globals in Node.js, not part of util
              export const TextEncoder = globalThis.TextEncoder || window.TextEncoder;
              export const TextDecoder = globalThis.TextDecoder || window.TextDecoder;
            `;
          }
          
          // Return a virtual module that uses window.require
          return `
            const nodeModule = window.require ? window.require('${moduleName}') : {};
            export default nodeModule;
            const keys = Object.keys(nodeModule);
            keys.forEach(key => {
              if (typeof nodeModule[key] !== 'undefined') {
                exports[key] = nodeModule[key];
              }
            });
          `;
        }
      }
      
      // Handle direct module requests
      if (nodeBuiltins.includes(id)) {
        // Special handling for util module
        if (id === 'util') {
          return `
            const util = window.require ? window.require('util') : {};
            export default util;
            export const { 
              promisify, 
              deprecate, 
              inherits, 
              inspect, 
              format, 
              debuglog,
              isArray,
              isBoolean,
              isNull,
              isNullOrUndefined,
              isNumber,
              isString,
              isSymbol,
              isUndefined,
              isRegExp,
              isObject,
              isDate,
              isError,
              isFunction,
              isPrimitive,
              isBuffer
            } = util;
            // TextEncoder and TextDecoder are globals in Node.js, not part of util
            export const TextEncoder = globalThis.TextEncoder || window.TextEncoder;
            export const TextDecoder = globalThis.TextDecoder || window.TextDecoder;
          `;
        }
        
        return `
          const nodeModule = window.require ? window.require('${id}') : {};
          export default nodeModule;
          const keys = Object.keys(nodeModule);
          keys.forEach(key => {
            if (typeof nodeModule[key] !== 'undefined') {
              exports[key] = nodeModule[key];
            }
          });
        `;
      }
      
      return null;
    },
    
    transform(code, id) {
      // Skip non-JS files
      if (!/\.(js|ts|jsx|tsx|mjs)$/.test(id)) {
        return null;
      }
      
      let transformed = code;
      
      // Handle @refinio/one.core specific issues
      if (id.includes('node_modules/@refinio/one.core')) {
        // Fix promisify imports
        transformed = transformed.replace(
          /import\s+{\s*promisify\s*}\s+from\s+['"]util['"]/g,
          "const { promisify } = window.require('util')"
        );
        
        // Fix other util imports
        transformed = transformed.replace(
          /import\s+util\s+from\s+['"]util['"]/g,
          "const util = window.require('util')"
        );
        
        // Fix destructuring with 'as' keyword in require statements
        transformed = transformed.replace(
          /const\s+{\s*(\w+)\s+as\s+(\w+)\s*}\s*=\s*window\.require\(['"](\w+)['"]\)/g,
          "const $2 = window.require('$3').$1"
        );
      }
      
      // Replace dynamic imports of node modules
      nodeBuiltins.forEach(module => {
        const patterns = [
          // import module from 'module'
          new RegExp(`import\\s+(\\w+)\\s+from\\s+['"]${module}['"]`, 'g'),
          // import { something } from 'module'
          new RegExp(`import\\s+{([^}]+)}\\s+from\\s+['"]${module}['"]`, 'g'),
          // import * as module from 'module'
          new RegExp(`import\\s+\\*\\s+as\\s+(\\w+)\\s+from\\s+['"]${module}['"]`, 'g')
        ];
        
        patterns.forEach((pattern, index) => {
          transformed = transformed.replace(pattern, (match, capture) => {
            if (index === 0) {
              // Default import
              return `const ${capture} = window.require('${module}')`;
            } else if (index === 1) {
              // Named imports - handle 'as' keyword
              const imports = capture.split(',').map(imp => imp.trim());
              const processedImports = imports.map(imp => {
                if (imp.includes(' as ')) {
                  const [original, alias] = imp.split(' as ').map(s => s.trim());
                  return `${alias}: ${original}`;
                }
                return imp;
              });
              
              // Check if any imports have 'as'
              if (imports.some(imp => imp.includes(' as '))) {
                // Create individual const declarations for aliased imports
                const declarations = imports.map(imp => {
                  if (imp.includes(' as ')) {
                    const [original, alias] = imp.split(' as ').map(s => s.trim());
                    return `const ${alias} = window.require('${module}').${original}`;
                  } else {
                    return `const { ${imp} } = window.require('${module}')`;
                  }
                });
                return declarations.join(';\n');
              } else {
                // No aliases, use destructuring
                return `const {${capture}} = window.require('${module}')`;
              }
            } else {
              // Namespace import
              return `const ${capture} = window.require('${module}')`;
            }
          });
        });
      });
      
      if (transformed !== code) {
        return {
          code: transformed,
          map: null
        };
      }
      
      return null;
    }
  };
}