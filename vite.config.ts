import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig(({ mode }) => ({
  plugins: [crx({ manifest })],
  define: {
    __DEBUG__: JSON.stringify(mode !== 'production'),
  },
  build: {
    target: 'chrome110',
    emptyOutDir: true,
    outDir: 'dist',
    sourcemap: mode !== 'production',
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
}));
