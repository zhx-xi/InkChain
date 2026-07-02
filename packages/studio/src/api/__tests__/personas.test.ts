import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createPersonasRouter } from "../routes/personas.js";
import { AgentRoleEnum } from "@actalk/inkos-core";

// ── Helpers ──

function createTmpProjectRoot(): string {
  const dir = join(tmpdir(), `inkos-test-personas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  return dir;
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function writePersonaFile(projectRoot: string, role: string, config: Record<string, unknown>, body = ""): Promise<void> {
  const personasDir = join(projectRoot, ".inkos", "personas");
  await ensureDir(personasDir);
  const frontmatter = Object.entries(config)
    .map(([key, value]) => `${key}: ${JSON.stringify(typeof value === "string" ? value : value)}`)
    .join("\n");
  const content = `---\n${frontmatter}\n---\n${body}`;
  await writeFile(join(personasDir, `${role}.md`), content, "utf-8");
}

// ── Tests ──

describe("Personas CRUD API", () => {
  let projectRoot: string;
  let router: ReturnType<typeof createPersonasRouter>;

  beforeEach(() => {
    projectRoot = createTmpProjectRoot();
    router = createPersonasRouter(() => projectRoot);
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  describe("GET /personas", () => {
    it("should return all 7 agent personas", async () => {
      const res = await router.request("/personas");
      expect(res.status).toBe(200);
      const body = await res.json() as { personas: { agentRole: string; displayName: string; source: string }[] };
      expect(body.personas).toHaveLength(7);
      expect(body.personas.map((p) => p.agentRole).sort()).toEqual([
        "architect", "auditor", "editor", "observer", "planner", "reviser", "writer",
      ]);
    });

    it("should show project-level persona as project source", async () => {
      await writePersonaFile(projectRoot, "writer", {
        agentRole: "writer",
        displayName: "自定义 Writer",
        personalityTraits: ["custom"],
      });

      const res = await router.request("/personas");
      expect(res.status).toBe(200);
      const body = await res.json() as { personas: { agentRole: string; source: string }[] };
      const writer = body.personas.find((p) => p.agentRole === "writer");
      expect(writer?.source).toBe("project");
    });
  });

  describe("GET /personas/:agentId", () => {
    it("should return merged config for a valid agent role", async () => {
      const res = await router.request("/personas/writer");
      expect(res.status).toBe(200);
      const body = await res.json() as { persona: { agentRole: string; displayName: string } };
      expect(body.persona.agentRole).toBe("writer");
      expect(body.persona.displayName).toBeTruthy();
    });

    it("should return 400 for invalid agent role", async () => {
      const res = await router.request("/personas/invalid-role");
      expect(res.status).toBe(400);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe("INVALID_AGENT_ROLE");
    });
  });

  describe("PUT /personas/:agentId", () => {
    it("should update persona config successfully", async () => {
      const res = await router.request("/personas/writer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "热血 Writer",
          personalityTraits: ["热血", "直白"],
          freeTextDetails: "这是一个自定义的 writer 配置",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { persona: { displayName: string; personalityTraits: string[] } };
      expect(body.persona.displayName).toBe("热血 Writer");
      expect(body.persona.personalityTraits).toEqual(["热血", "直白"]);

      // Verify persistence
      const filePath = join(projectRoot, ".inkos", "personas", "writer.md");
      const saved = await readFile(filePath, "utf-8");
      expect(saved).toContain("热血 Writer");
      expect(saved).toContain("这是一个自定义的 writer 配置");
    });

    it("should return 400 for invalid payload", async () => {
      const res = await router.request("/personas/writer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "" }), // empty displayName violates min(1)
      });

      expect(res.status).toBe(400);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for invalid agent role", async () => {
      const res = await router.request("/personas/bad-role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Test" }),
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 for non-JSON body", async () => {
      const res = await router.request("/personas/writer", {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: "not-json",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /personas/:agentId", () => {
    it("should delete project-level config and restore default", async () => {
      // First, create a project-level config
      await writePersonaFile(projectRoot, "writer", {
        agentRole: "writer",
        displayName: "临时 Writer",
        personalityTraits: ["temp"],
      });

      // Verify it exists
      let filePath = join(projectRoot, ".inkos", "personas", "writer.md");
      let exists = await readFile(filePath, "utf-8").then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Delete it
      const res = await router.request("/personas/writer", { method: "DELETE" });
      expect(res.status).toBe(200);
      const body = await res.json() as { deleted: boolean; persona: { displayName: string } };
      expect(body.deleted).toBe(true);

      // File should be removed
      exists = await readFile(filePath, "utf-8").then(() => true).catch(() => false);
      expect(exists).toBe(false);

      // Config should fall back to default
      expect(body.persona.displayName).toBeTruthy();
    });
  });

  describe("GET /personas/presets", () => {
    it("should return empty presets list when no presets exist", async () => {
      const res = await router.request("/personas/presets");
      expect(res.status).toBe(200);
      const body = await res.json() as { presets: unknown[] };
      expect(body.presets).toEqual([]);
    });

    it("should support genre filter", async () => {
      const res = await router.request("/personas/presets?genre=奇幻");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /personas/presets/:presetId", () => {
    it("should return 404 for non-existent preset", async () => {
      const res = await router.request("/personas/presets/nonexistent");
      expect(res.status).toBe(404);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /personas/:agentId/apply", () => {
    it("should return 400 when presetId is missing", async () => {
      const res = await router.request("/personas/writer/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent preset", async () => {
      const res = await router.request("/personas/writer/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: "nonexistent" }),
      });
      expect(res.status).toBe(404);
    });

    it("should return 400 for invalid agent role", async () => {
      const res = await router.request("/personas/bad-role/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: "test" }),
      });
      expect(res.status).toBe(400);
    });
  });
});
