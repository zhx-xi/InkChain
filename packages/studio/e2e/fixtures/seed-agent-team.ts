import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const E2E_ROOT = resolve(__dirname, "../../", "test-project");
export const E2E_TEAM_PROJECT = "e2e-agent-team";

/**
 * Seeds agent team configuration data for E2E testing:
 *
 * - Writes `.inkos/agent-team.json` with 7 agents, some enabled, some disabled
 * - Writes a book project with a basic book.json
 * - Seeds an agent template for template-related tests
 */
export async function seedAgentTeam(): Promise<void> {
  const inkosDir = join(E2E_ROOT, ".inkos");
  await mkdir(inkosDir, { recursive: true });

  // ── Agent Team Config ──
  const agentTeamConfig = {
    schemaVersion: "1",
    agents: [
      { role: "writer", enabled: true },
      { role: "architect", enabled: true },
      { role: "planner", enabled: true },
      { role: "editor", enabled: false },
      { role: "auditor", enabled: true },
      { role: "observer", enabled: false },
      { role: "reviser", enabled: true },
    ],
    defaultModel: "gpt-4o",
    collaborationMode: "sequential" as const,
  };

  await writeFile(
    join(inkosDir, "agent-team.json"),
    JSON.stringify(agentTeamConfig, null, 2),
    "utf-8",
  );

  // ── Project book ──
  const bookDir = join(E2E_ROOT, "books", E2E_TEAM_PROJECT);
  await mkdir(bookDir, { recursive: true });

  const now = new Date("2026-07-04T00:00:00.000Z").toISOString();
  await writeFile(
    join(bookDir, "book.json"),
    JSON.stringify({
      id: E2E_TEAM_PROJECT,
      title: "E2E Agent Team 测试项目",
      platform: "webnovel",
      genre: "xianxia",
      status: "active",
      targetChapters: 20,
      chapterWordCount: 2000,
      language: "zh",
      createdAt: now,
      updatedAt: now,
    }, null, 2),
    "utf-8",
  );

  // ── Agent Template (pre-seeded for listing tests) ──
  const templates = [
    {
      id: "tmpl_e2e_001",
      name: "玄幻创作模板",
      description: "适合玄幻题材的 Agent 配置",
      preset: "xianxia",
      config: {
        agentsConfig: {
          writer: { role: "writer", enabled: true },
          architect: { role: "architect", enabled: true },
          planner: { role: "planner", enabled: true },
          editor: { role: "editor", enabled: true },
          auditor: { role: "auditor", enabled: true },
          observer: { role: "observer", enabled: true },
          reviser: { role: "reviser", enabled: true },
        },
      },
      createdAt: now,
      updatedAt: now,
    },
  ];

  await writeFile(
    join(inkosDir, "agent-templates.json"),
    JSON.stringify(templates, null, 2),
    "utf-8",
  );
}
