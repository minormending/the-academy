import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Three pages share one build: the game (index.html), the guidebook (guide.html, docs/GUIDE.md)
// and the developer docs (devdocs.html, docs/DEVDOCS.md). A relative base lets the static build run
// from any path, e.g. GitHub Pages at https://<user>.github.io/the-academy/.
export default defineConfig({
  base: './',
  server: { port: 5199 },
  build: {
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        guide: resolve(__dirname, 'guide.html'),
        devdocs: resolve(__dirname, 'devdocs.html'),
      },
      // Phaser rarely changes between releases; a separate chunk keeps it cached across game updates.
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
