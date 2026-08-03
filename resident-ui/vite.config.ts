import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
      '/admin.html': { target: 'http://localhost:3000', changeOrigin: true },
      '/responder.html': { target: 'http://localhost:3000', changeOrigin: true },
      '/app.js': { target: 'http://localhost:3000', changeOrigin: true },
      '/mobile-ui.css': { target: 'http://localhost:3000', changeOrigin: true },
      '/critical.css': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../frontend/resident-dist'),
    emptyOutDir: true,
  },
});
