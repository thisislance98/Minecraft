import { defineConfig } from 'vite';
import GodModePlugin from './god-mode-vite-plugin.js';
import AutoVersionBumpPlugin from './auto-version-plugin.js';

export default defineConfig({
  plugins: [GodModePlugin(), AutoVersionBumpPlugin()],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    port: 3000,
    open: true
  }
});
