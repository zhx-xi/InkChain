import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import { mkdirSync, writeFileSync } from "fs";

/**
 * Rebuild @actalk/inkchain-core before E2E tests start.
 *
 * The E2E API server (tsx watch src/api/index.ts) imports core via the pnpm
 * workspace symlink, which resolves to packages/core/dist/index.js — the
 * compiled output, not the TypeScript source.  If dist/ is stale the server
 * runs old code regardless of what the TypeScript sources say, causing
 * otherwise-correct agent logic (e.g. the terminalToolResultTail guard) to be
 * silently absent at runtime.
 *
 * Rebuilding here ensures the dist is always fresh before tests run.
 */
export default function globalSetup(): void {
  const thisFile = fileURLToPath(import.meta.url);
  // From packages/studio/e2e: ../ = studio, ../../ = packages, ../../../ = the
  // worktree/workspace root (where pnpm-workspace.yaml lives). A fourth ../ would
  // point at the .worktrees parent, where the --filter matches nothing and the
  // build silently no-ops, leaving core dist stale (agent stub absent at runtime).
  const workspaceRoot = path.resolve(path.dirname(thisFile), "../../../");

  // Ensure test-project/ exists with inkchain.json so API's /api/v1/project
  // doesn't return 500 (which would block the entire App behind the
  // "project config loading" gate).
  const testProjectDir = path.resolve(path.dirname(thisFile), "../test-project");
  mkdirSync(testProjectDir, { recursive: true });
  writeFileSync(
    path.join(testProjectDir, "inkchain.json"),
    JSON.stringify({
      name: "E2E Test Project",
      version: "0.1.0",
      language: "zh",
      llm: {
        provider: "openai",
        service: "custom",
        configSource: "env",
        baseUrl: "http://localhost:11434/v1",
        apiKey: "",
        model: "gpt-4o-mini",
        temperature: 0.7,
        thinkingBudget: 0,
        apiFormat: "chat",
        stream: true,
      },
    }, null, 2),
    "utf-8",
  );

  try {
    execSync("pnpm --filter @actalk/inkchain-core build", {
      cwd: workspaceRoot,
      stdio: "inherit",
    });
  } catch {
    console.warn("[global-setup] Core build failed (dist may be stale), proceeding anyway");
  }
}
