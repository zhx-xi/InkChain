// ── Skill Config CRUD API (Issue #76 — Skill-3) ──
//
// Project-level Skill configuration management using the new SkillConfig JSON
// schema from @actalk/inkos-core. Stores files as `.inkos/skills/<id>.json` and
// merges them with builtin skills from the defaults package.
//
// Routes (mounted at /api/skills):
//   GET    /              — List all skills (project + builtin, ?category=)
//   GET    /:id           — Get a single merged skill
//   POST   /              — Create a project-level skill
//   PUT    /:id           — Update (or override) a project-level skill
//   DELETE /:id           — Delete project-level skill, revert to builtin if exists
//   PATCH  /:id/toggle    — Toggle enabled state
//
// All writes are validated with Zod schemas; validation errors return 400 with
// a flat error detail object.

import { Hono } from "hono";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  loadSkillConfigs,
  SkillConfigSchema,
  SkillConfigUpdateSchema,
  type SkillConfig,
  type SkillSource,
  type StoredSkillConfig,
} from "@actalk/inkos-core";
import { ApiError } from "../errors.js";

const PROJECT_SKILLS_DIR = ".inkos/skills";

export interface ApiSkillResponse {
  readonly config: SkillConfig;
  readonly source: SkillSource;
  readonly path?: string;
}

function projectSkillPath(root: string, id: string): string {
  return join(root, PROJECT_SKILLS_DIR, `${id}.json`);
}

function toApiSkill(stored: StoredSkillConfig): ApiSkillResponse {
  return {
    config: stored.config,
    source: stored.source,
    path: stored.source === "project" ? stored.path : undefined,
  };
}

async function loadMergedSkills(root: string): Promise<ReadonlyArray<StoredSkillConfig>> {
  const result = await loadSkillConfigs({ projectRoot: root });
  return result.skills;
}

async function loadProjectSkillFile(root: string, id: string): Promise<SkillConfig | null> {
  try {
    const raw = await readFile(projectSkillPath(root, id), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return SkillConfigSchema.parse(parsed);
  } catch (error) {
    if (
      typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { code?: unknown }).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

async function writeProjectSkill(root: string, config: SkillConfig): Promise<void> {
  const dir = join(root, PROJECT_SKILLS_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(projectSkillPath(root, config.id), JSON.stringify(config, null, 2), "utf-8");
}

async function deleteProjectSkillFile(root: string, id: string): Promise<boolean> {
  try {
    await access(projectSkillPath(root, id));
  } catch {
    return false;
  }
  await rm(projectSkillPath(root, id), { force: true });
  return true;
}

function validateSkillId(id: string): string {
  const parsed = SkillConfigSchema.shape.id.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(400, "INVALID_SKILL_ID", `Invalid skill id: ${id}`);
  }
  return parsed.data;
}

export function createSkillsRouter(root: string) {
  const router = new Hono();

  // GET /api/skills — list all skills with optional category filter
  router.get("/", async (c) => {
    const category = c.req.query("category");
    const skills = await loadMergedSkills(root);
    const filtered = category
      ? skills.filter((skill) => skill.config.category === category)
      : skills;
    return c.json({ skills: filtered.map(toApiSkill) });
  });

  // GET /api/skills/:id — get a single merged skill
  router.get("/:id", async (c) => {
    const id = validateSkillId(c.req.param("id"));
    const skills = await loadMergedSkills(root);
    const skill = skills.find((s) => s.config.id === id);
    if (!skill) {
      throw new ApiError(404, "SKILL_NOT_FOUND", `Skill not found: ${id}`);
    }
    return c.json({ skill: toApiSkill(skill) });
  });

  // POST /api/skills — create a new project-level skill
  router.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const parsed = SkillConfigSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Skill validation failed",
          details: parsed.error.flatten(),
        },
      }, 400);
    }

    const existing = await loadProjectSkillFile(root, parsed.data.id);
    if (existing) {
      throw new ApiError(409, "SKILL_ALREADY_EXISTS", `Skill already exists: ${parsed.data.id}`);
    }

    await writeProjectSkill(root, parsed.data);
    return c.json({ skill: toApiSkill({ config: parsed.data, source: "project", path: projectSkillPath(root, parsed.data.id) }) }, 201);
  });

  // PUT /api/skills/:id — update a project-level skill (creates override if builtin-only)
  router.put("/:id", async (c) => {
    const id = validateSkillId(c.req.param("id"));

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const parsed = SkillConfigUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Skill update validation failed",
          details: parsed.error.flatten(),
        },
      }, 400);
    }

    // Start from existing project skill, builtin skill, or a minimal stub.
    const mergedSkills = await loadMergedSkills(root);
    const existingStored = mergedSkills.find((s) => s.config.id === id);
    const baseConfig: SkillConfig = existingStored
      ? existingStored.config
      : { id, category: "utility", triggers: [], injection: { mode: "append", target: "system_prompt", priority: 50 }, params: {}, enabled: true, description: "", prompt: "" };

    const updated: SkillConfig = { ...baseConfig, ...parsed.data, id };
    await writeProjectSkill(root, updated);

    return c.json({
      skill: toApiSkill({ config: updated, source: "project", path: projectSkillPath(root, id) }),
    });
  });

  // DELETE /api/skills/:id — delete project-level skill, reverting to builtin if present
  router.delete("/:id", async (c) => {
    const id = validateSkillId(c.req.param("id"));
    const deleted = await deleteProjectSkillFile(root, id);
    if (!deleted) {
      // Check if a builtin skill exists; if not, it's truly not found.
      const skills = await loadMergedSkills(root);
      if (!skills.some((s) => s.config.id === id)) {
        throw new ApiError(404, "SKILL_NOT_FOUND", `Skill not found: ${id}`);
      }
    }
    return c.json({ ok: true, id, reverted: !deleted });
  });

  // PATCH /api/skills/:id/toggle — toggle enabled state
  router.patch("/:id/toggle", async (c) => {
    const id = validateSkillId(c.req.param("id"));

    const mergedSkills = await loadMergedSkills(root);
    const stored = mergedSkills.find((s) => s.config.id === id);
    if (!stored) {
      throw new ApiError(404, "SKILL_NOT_FOUND", `Skill not found: ${id}`);
    }

    const projectFile = await loadProjectSkillFile(root, id);
    const baseConfig = projectFile ?? stored.config;
    const updated: SkillConfig = { ...baseConfig, enabled: !baseConfig.enabled };
    await writeProjectSkill(root, updated);

    return c.json({
      skill: toApiSkill({ config: updated, source: "project", path: projectSkillPath(root, id) }),
    });
  });

  return router;
}
