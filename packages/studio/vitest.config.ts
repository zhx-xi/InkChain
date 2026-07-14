import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      // Subpath aliases must precede the bare package alias: a string alias also
      // matches `<key>/...`, so the bare entry would otherwise swallow these.
      // The app/build resolves these subpaths via core's package.json "exports"
      // (browser-safe, zod-only); tests resolve them to source like the bare pkg.
      "@inkchain/inkchain-core/interactive-film/evaluator": resolve(__dirname, "../core/src/interactive-film/evaluator.ts"),
      "@inkchain/inkchain-core/interactive-film/graph-schema": resolve(__dirname, "../core/src/interactive-film/graph-schema.ts"),
      "@inkchain/inkchain-core/models/persona-config.js": resolve(__dirname, "../core/src/models/persona-config.ts"),
      "@inkchain/inkchain-core/models/foreshadowing.js": resolve(__dirname, "../core/src/models/foreshadowing.ts"),
      "@inkchain/inkchain-core/models/skill-config.js": resolve(__dirname, "../core/src/models/skill-config.ts"),
      "@inkchain/inkchain-core/models/world-config.js": resolve(__dirname, "../core/src/models/world-config.ts"),
      "@inkchain/inkchain-core": resolve(__dirname, "../core/src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    fileParallelism: false,
    // server.ts is large enough that first-load esbuild transforms can exceed
    // Vitest's default 5s timeout on a cold full-suite run.
    testTimeout: 30_000,
  },
});
