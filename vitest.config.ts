import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Match the app's tsconfig (`jsx: "react-jsx"`) so .tsx tests don't
  // need to `import React` at the top of every file.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    // Per-file `// @vitest-environment jsdom` pragma opts UI tests into
    // a DOM; engine tests stay on node for speed.
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
})
