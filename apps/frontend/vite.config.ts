/// <reference types="vitest" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@qr-menu/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  envDir: path.resolve(__dirname, '../..'),
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 4096,
  },
  test: {
    environment: 'happy-dom',
  },
});
