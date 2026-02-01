import { defineConfig } from 'vite';
// import GodModePlugin from './god-mode-vite-plugin.js';
// import AutoVersionBumpPlugin from './auto-version-plugin.js';

export default defineConfig({
  plugins: [],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  esbuild: {
    keepNames: true
  },
  server: {
    port: 3000,
    open: false,
    hmr: false,
    allowedHosts: true,
    headers: {
      // Allow Firebase Auth popup to work properly
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'credentialless'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:2567',
        changeOrigin: true,
        ws: true
      }
    },
    watch: {
      ignored: ['**/server/**', '**/scripts/**', '**/.agent/**']
    }
  }
});
