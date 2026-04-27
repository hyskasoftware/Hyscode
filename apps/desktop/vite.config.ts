import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@hyscode/extension-host': path.resolve(__dirname, '../../packages/extension-host/src'),
      '@hyscode/extension-api': path.resolve(__dirname, '../../packages/extension-api/src'),
      '@hyscode/lsp-client': path.resolve(__dirname, '../../packages/lsp-client/src'),
      '@hyscode/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@hyscode/ai-providers': path.resolve(__dirname, '../../packages/ai-providers/src'),
      '@hyscode/agent-harness': path.resolve(__dirname, '../../packages/agent-harness/src'),
      '@hyscode/mcp-client': path.resolve(__dirname, '../../packages/mcp-client/src'),
      '@hyscode/skills': path.resolve(__dirname, '../../packages/skills/src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      ignored: ['**/src-tauri/**', '**/tsc_output.txt', '**/*.txt', '**/*.log'],
    },
  },
});
