// Session B audit test config. Run from the repo root:
//   npx vitest run --config audit/tests/B-vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['audit/tests/B-*.test.ts'],
    testTimeout: 20000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '../..') },
  },
})
