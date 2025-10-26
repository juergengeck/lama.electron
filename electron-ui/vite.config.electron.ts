import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'force-node-modules',
      enforce: 'pre',
      resolveId(id) {
        // Force Node.js built-ins to be external
        const builtins = ['util', 'fs', 'path', 'crypto', 'stream', 'buffer', 'events', 'os', 'child_process', 'net', 'tls', 'dns', 'http', 'https'];
        if (builtins.includes(id)) {
          return { id, external: true, moduleSideEffects: false };
        }
        // Handle electron module - don't try to stub it
        if (id === 'electron') {
          return { id, external: true, moduleSideEffects: false };
        }
        return null;
      },
      load(id) {
        // Provide empty stub for electron that doesn't overwrite window.electronAPI
        if (id === 'electron') {
          return 'export default {}';
        }
        return null;
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@lib': path.resolve(__dirname, './src/lib'),
      // Force all one.core imports to use the same instance
      '@refinio/one.core': path.resolve(__dirname, './node_modules/@refinio/one.core')
    },
    // CRITICAL: Use Node.js module resolution, not browser
    conditions: ['node'],
    browserField: false,
    mainFields: ['main'],
    preferBuiltins: true,
    extensions: ['.js', '.ts', '.tsx', '.jsx', '.json', '.node']
  },
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  },
  optimizeDeps: {
    include: ['tweetnacl'],  // Include real tweetnacl, not polyfill
    exclude: [
      'electron',
      '@refinio/one.core',
      '@refinio/one.models'
    ],
    esbuildOptions: {
      platform: 'node',
      target: 'node18'
    }
  },
  build: {
    target: 'node18',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      external: [
        'electron',
        '@refinio/one.core',
        '@refinio/one.models',
        // Don't externalize Node built-ins - we have them available
      ],
      output: {
        format: 'es'
      }
    }
  },
  ssr: {
    // Tell Vite this is for Node.js/Electron
    noExternal: true,
    target: 'node'
  },
  server: {
    port: 5173,
    open: false
  }
})