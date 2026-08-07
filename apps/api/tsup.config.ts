import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // @clinic/shared ships as TypeScript source with no build step of its own,
  // so it must be inlined here rather than left as an external node_modules import.
  noExternal: ['@clinic/shared'],
  // Prisma's generated client relies on native query engine binaries — never bundle it.
  external: ['@prisma/client'],
});
