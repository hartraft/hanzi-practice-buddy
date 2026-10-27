import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: 'public',
  worker: {
    format: 'es'
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false
  },
  server: {
    host: '0.0.0.0'
  }
});
