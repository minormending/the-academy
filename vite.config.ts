import { defineConfig } from 'vite';
export default defineConfig({
  server: { port: 5199 },
  build: {
    chunkSizeWarningLimit: 4000,
    // Phaser rarely changes between releases; a separate chunk keeps it cached across game updates.
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
});
