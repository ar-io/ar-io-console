import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';

// Read package.json for version
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')
);

export default defineConfig({
  base: './', // Relative paths for Arweave subpath compatibility
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(packageJson.version),
    // Use date only (not full timestamp) to avoid cache-busting on every build
    'import.meta.env.BUILD_TIME': JSON.stringify(new Date().toISOString().split('T')[0]),
  },
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Essential polyfills for multi-chain unified app (based on actual errors seen)
      include: ['buffer', 'crypto', 'stream', 'os', 'util', 'process', 'fs'],
      protocolImports: true,
    }),
    // Service worker for Browse Data verification feature
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/features/browse/service-worker',
      filename: 'service-worker.ts',
      injectManifest: {
        globPatterns: [],
        injectionPoint: undefined,
        rollupFormat: 'iife',
      },
      injectRegister: null,
      manifest: false,
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: [
      '@privy-io/react-auth',
      '@walletconnect/ethereum-provider',
      '@walletconnect/modal',
      '@walletconnect/sign-client',
      '@walletconnect/utils',
      '@walletconnect/environment',
      '@walletconnect/jsonrpc-utils',
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
    // Source maps disabled by default for smaller builds (~50MB savings)
    // Enable with: VITE_SOURCEMAPS=true (used by build:staging)
    sourcemap: process.env.VITE_SOURCEMAPS === 'true',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    // Note: Manual chunk splitting removed because wayfinder packages have
    // complex circular dependencies with @ar.io/sdk that cause initialization
    // errors when split into separate chunks. Letting Rollup handle chunking
    // automatically avoids these issues (same approach as wayfinder-app).
  },
});