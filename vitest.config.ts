import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests run in plain Node. Phaser touches `window` at import time, so every `import 'phaser'`
// resolves to a small stub (tests/support/phaser-stub.ts) that is enough for the data, VFX-registration
// and pure-system modules to load. Anything that needs a real scene belongs in the browser, not here.
export default defineConfig({
  resolve: {
    alias: { phaser: fileURLToPath(new URL('./tests/support/phaser-stub.ts', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
    setupFiles: ['tests/support/setup.ts'],
  },
});
