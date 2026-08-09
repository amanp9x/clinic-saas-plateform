import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    // Test files share one real Postgres database (no per-file schema isolation). Some files
    // (auth.test.ts) reset shared tables between tests — running files in parallel would race
    // against other files' rows. The suite is small enough that sequential execution is cheap.
    fileParallelism: false,
  },
});
