import { startStudioServer } from "./server.js";
import { resolve, join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const root = resolve(process.argv[2] ?? process.env.INKCHAIN_PROJECT_ROOT ?? process.cwd());
const port = parseInt(process.env.INKCHAIN_STUDIO_PORT ?? "4567", 10);

// Find studio package root (2 levels up from src/api/)
const studioRoot = resolve(__dirname, "../..");
const distDir = join(studioRoot, "dist");

// Auto-build frontend if dist/ doesn't exist. In CI, Vite handles frontend separately
// so we skip blocking — start the API immediately (static routes 404 until dist is built).
const staticDir = existsSync(join(distDir, "index.html")) ? distDir : undefined;

startStudioServer(root, port, { staticDir }).catch((e) => {
  console.error("Failed to start studio:", e);
  process.exit(1);
});
