import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import { fileURLToPath } from 'node:url';
import manifest from './src/manifest';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// 根据环境变量决定输出目录
const isRelease = process.env.RELEASE === 'true';
const outDir = isRelease ? resolve(__dirname, 'dist') : '/Users/yangdanping/Applications/Chrome Apps.localized/element_blocker';

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
      overlay: false,
    },
  },
  build: {
    outDir,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
      },
    },
  },
});
