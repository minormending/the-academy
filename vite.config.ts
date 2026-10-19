import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { sourceStats } from './src/devdocs/charts/sourceStats.ts';
import { checkDocs, lineCount, repoFiles } from './src/devdocs/check.mjs';

// Three pages share one build: the game (index.html), the guidebook (guide.html, docs/GUIDE.md)
// and the developer docs (devdocs.html, docs/DEVDOCS.md). A relative base lets the static build run
// from any path, e.g. GitHub Pages at https://<user>.github.io/the-academy/.

/**
 * Developer docs only (docs/DEVDOCS.md). Two virtual modules that only devdocs.html imports, so the game
 * bundle never sees them and the page never ships the source:
 *  - "virtual:devdocs-source": folder sizes and imports between src/ folders (module-graph, content-counts),
 *    a few hundred bytes computed from src/**\/*.ts when the module loads;
 *  - "virtual:devdocs-files": line counts of every repo text file, so the dev page can check that each
 *    data-src link exists and its #L line is in range (imported in dev only).
 * On `vite build` it also checks every section fragment against src/devdocs/CONTRACT.md: problems are
 * warnings, or errors with DEVDOCS_STRICT=1.
 */
function devdocsSource(): Plugin {
  const SOURCE = 'virtual:devdocs-source';
  const FILES = 'virtual:devdocs-files';
  const root = __dirname;
  return {
    name: 'devdocs-source',
    resolveId: (id) => (id === SOURCE || id === FILES ? `\0${id}` : undefined),
    load(id) {
      if (id === `\0${SOURCE}`) {
        const files = Object.entries(repoFiles(root))
          .filter(([p]) => p.startsWith('src/') && p.endsWith('.ts'))
          .map(([path, text]) => ({ path, text }));
        return `export default ${JSON.stringify(sourceStats(files))};`;
      }
      if (id === `\0${FILES}`) {
        const lines = Object.fromEntries(Object.entries(repoFiles(root)).map(([p, t]) => [p, lineCount(t)]));
        return `export default ${JSON.stringify(lines)};`;
      }
      return undefined;
    },
    configureServer(server) {
      // A file added or removed changes the line-count table; edits to .ts files change the source stats.
      // Drop the cached modules so the next page load recomputes them.
      const refresh = (file: string) => {
        for (const id of [`\0${SOURCE}`, `\0${FILES}`]) {
          const mod = server.moduleGraph.getModuleById(id);
          if (mod && (id.endsWith(FILES) || file.endsWith('.ts'))) server.moduleGraph.invalidateModule(mod);
        }
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
      server.watcher.on('change', refresh);
    },
    buildStart() {
      if (this.meta.watchMode) return;
      const problems = checkDocs(root);
      if (!problems.length) return;
      const text = `${problems.length} problem(s) in src/devdocs/sections:\n${problems.map((p) => `  ${p.file}: ${p.message}`).join('\n')}`;
      if (process.env.DEVDOCS_STRICT === '1') this.error(text);
      else this.warn(text);
    },
  };
}

export default defineConfig({
  base: './',
  server: { port: 5199 },
  plugins: [devdocsSource()],
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
