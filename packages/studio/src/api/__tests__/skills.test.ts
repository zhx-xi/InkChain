import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStudioServer } from "../server.js";

async function writeSkill(root: string, id: string, data: Record<string, unknown>): Promise<void> {
  const dir = join(root, ".inkos", "skills");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${id}.json`), JSON.stringify({ id, ...data }), "utf-8");
}

describe("SkillConfig CRUD API (Issue #76)", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "inkos-skills-crud-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("GET /api/skills lists project skills", async () => {
    await writeSkill(root, "style-imitation", {
      category: "writing",
      description: "Imitate a reference style.",
      enabled: true,
    });
    await writeSkill(root, "plot-check", {
      category: "analysis",
      description: "Check plot holes.",
      enabled: false,
    });

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/skills");
    expect(res.status).toBe(200);
    const json = await res.json() as { skills: Array<{ config: { id: string; category: string; enabled: boolean }; source: string }> };
    expect(json.skills).toHaveLength(2);
    expect(json.skills.map((s) => s.config.id).sort()).toEqual(["plot-check", "style-imitation"]);
    expect(json.skills.every((s) => s.source === "project")).toBe(true);
  });

  it("GET /api/skills filters by category", async () => {
    await writeSkill(root, "style-imitation", { category: "writing" });
    await writeSkill(root, "plot-check", { category: "analysis" });

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/skills?category=writing");
    expect(res.status).toBe(200);
    const json = await res.json() as { skills: Array<{ config: { id: string } }> };
    expect(json.skills.map((s) => s.config.id)).toEqual(["style-imitation"]);
  });

  it("GET /api/skills/:id returns a merged skill", async () => {
    await writeSkill(root, "style-imitation", { category: "writing", enabled: true });

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/skills/style-imitation");
    expect(res.status).toBe(200);
    const json = await res.json() as { skill: { config: { id: string }; source: string } };
    expect(json.skill.config.id).toBe("style-imitation");
    expect(json.skill.source).toBe("project");
  });

  it("GET /api/skills/:id returns 404 for unknown skill", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/skills/unknown-skill");
    expect(res.status).toBe(404);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe("SKILL_NOT_FOUND");
  });

  it("POST /api/skills creates a project skill with Zod defaults", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "new-skill",
        category: "world",
        description: "A world-building helper.",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { skill: { config: { id: string; category: string; enabled: boolean } } };
    expect(json.skill.config.id).toBe("new-skill");
    expect(json.skill.config.category).toBe("world");
    expect(json.skill.config.enabled).toBe(true);

    const saved = await readFile(join(root, ".inkos", "skills", "new-skill.json"), "utf-8");
    const parsed = JSON.parse(saved);
    expect(parsed.id).toBe("new-skill");
    expect(parsed.category).toBe("world");
  });

  it("POST /api/skills rejects invalid body with Zod details", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "BadId", category: "magic" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string; details: unknown } };
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.details).toBeDefined();
  });

  it("POST /api/skills rejects duplicate id", async () => {
    await writeSkill(root, "existing-skill", { category: "writing" });
    const app = createStudioServer({} as never, root);

    const res = await app.request("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "existing-skill", category: "analysis" }),
    });

    expect(res.status).toBe(409);
  });

  it("PUT /api/skills/:id updates an existing project skill", async () => {
    await writeSkill(root, "update-skill", { category: "writing", enabled: true, description: "Before" });
    const app = createStudioServer({} as never, root);

    const res = await app.request("/api/skills/update-skill", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "After", enabled: false }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { skill: { config: { description: string; enabled: boolean } } };
    expect(json.skill.config.description).toBe("After");
    expect(json.skill.config.enabled).toBe(false);

    const saved = JSON.parse(await readFile(join(root, ".inkos", "skills", "update-skill.json"), "utf-8"));
    expect(saved.description).toBe("After");
    expect(saved.enabled).toBe(false);
  });

  it("PUT /api/skills/:id can create a project override for a builtin-only skill", async () => {
    // No project file exists; the PUT should create one based on a minimal stub.
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/skills/brand-new-skill", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "character", description: "Created via PUT" }),
    });

    expect(res.status).toBe(200);
    const saved = JSON.parse(await readFile(join(root, ".inkos", "skills", "brand-new-skill.json"), "utf-8"));
    expect(saved.id).toBe("brand-new-skill");
    expect(saved.category).toBe("character");
  });

  it("PATCH /api/skills/:id/toggle flips enabled state", async () => {
    await writeSkill(root, "toggle-skill", { category: "utility", enabled: true });
    const app = createStudioServer({} as never, root);

    const res = await app.request("/api/skills/toggle-skill/toggle", { method: "PATCH" });
    expect(res.status).toBe(200);
    const json = await res.json() as { skill: { config: { enabled: boolean } } };
    expect(json.skill.config.enabled).toBe(false);

    const saved = JSON.parse(await readFile(join(root, ".inkos", "skills", "toggle-skill.json"), "utf-8"));
    expect(saved.enabled).toBe(false);
  });

  it("DELETE /api/skills/:id removes a project skill", async () => {
    await writeSkill(root, "delete-skill", { category: "writing" });
    const app = createStudioServer({} as never, root);

    const res = await app.request("/api/skills/delete-skill", { method: "DELETE" });
    expect(res.status).toBe(200);

    const list = await app.request("/api/skills");
    const json = await list.json() as { skills: Array<{ config: { id: string } }> };
    expect(json.skills.map((s) => s.config.id)).not.toContain("delete-skill");
  });
});
