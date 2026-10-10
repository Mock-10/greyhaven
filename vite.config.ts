import { defineConfig } from 'vitest/config';

// The game is a static site served from https://<user>.github.io/greyhaven/, so every asset path
// is relative to this base. Dev and preview use the same base so asset paths are tested the same way.
export default defineConfig({
  base: '/greyhaven/',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
