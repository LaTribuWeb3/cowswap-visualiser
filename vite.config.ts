import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    root: 'src/ui',
  build: {
    outDir: '../../dist/ui',
    emptyOutDir: true,
    sourcemap: true
  },
  esbuild: {
    sourcemap: true
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV || 'development'),
    'process.env.RPC_URL': JSON.stringify(env.RPC_URL || ''),
    'process.env.PAIR_API_TOKEN': JSON.stringify(env.PAIR_API_TOKEN || ''),
    'process.env.COW_API_URL': JSON.stringify(env.COW_API_URL || 'https://api.cow.fi'),
    'process.env.COW_API_KEY': JSON.stringify(env.COW_API_KEY || '')
  },
  optimizeDeps: {
    esbuildOptions: {
      sourcemap: true
    }
  },
  server: {
    port: 3000,
    host: true,
    open: true
  },
  preview: {
    port: 3000,
    host: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
  }
})

