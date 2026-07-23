import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', exclude: ['e2e/**', 'node_modules/**', 'dist/**'] },
  server: { port: 5173, proxy: { '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') } } },
  build: { sourcemap: true, rollupOptions: { output: { manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom'], motion: ['framer-motion'], query: ['@tanstack/react-query'], three: ['three', '@react-three/fiber', '@react-three/drei'] } } } }
});
