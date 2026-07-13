// ── Skill Config CRUD API (Issue #76 — Skill-3) ──
//
// Project-level Skill configuration management using the new SkillConfig JSON
// schema from @actalk/inkchain-core. Stores files as `.inkos/skills/<id>.json` and
// merges them with builtin skills from the defaults package.
//
// Version History (Issue #96 — Skill-9):
//   Before each overwrite, the current file is snapshotted to
//   `.inkos/skills-versions/<id>/<rev>.json` where rev is an auto-incrementing
//   integer. A version index file tracks the metadata.
//
// Routes (mounted at /api/skills):
//   GET    /                         — List all skills (project + builtin, ?category=)
//   GET    /:id                      — Get a single merged skill
//   POST   /                         — Create a project-level skill
//   PUT    /:id                      — Update (or override) a project-level skill
//   DELETE /:id                      — Delete project-level skill, revert to builtin if exists
//   PATCH  /:id/toggle               — Toggle enabled state
//   GET    /:id/versions             — List version history for a project skill
//   GET    /:id/versions/:rev/diff   — Get version diff (current vs specified rev)
//   POST   /:id/versions/:rev/restore — Restore a specific version

import { Hono } from "hono";
import { access, mkdir, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  loadSkillConfigs,
  SkillConfigSchema,
  SkillConfigUpdateSchema,
  IndexManager,
  type SkillConfig,
  type SkillSource,
  type StoredSkillConfig,
} from "@actalk/inkchain-core";
import { ApiError } from "../errors.js";

const PROJECT_SKILLS_DIR = ".inkos/skills";
const SKILL_VERSIONS_DIR = ".inkos/skills-versions";
const VERSION_KEEP = 20; // max versions to retain

export interface ApiSkillResponse {
  readonly config: SkillConfig;
  readonly source: SkillSource;
  readonly path?: string;
}

function projectSkillPath(root: string, id: string): string {
  return join(root, PROJECT_SKILLS_DIR, `${id}.json`);
}

function skillVersionsDir(root: string, id: string): string {
  return join(root, SKILL_VERSIONS_DIR, id);
}

function skillVersionPath(root: string, id: string, rev: number): string {
  return join(skillVersionsDir(root, id), `${rev}.json`);
}

interface SkillVersionMeta {
  rev: number;
  timestamp: string;
  id: string;
}

/**
 * Snapshot the current skill file before it is overwritten.
 * Reads the current file, and if it differs from the new config, saves it as a new version.
 */
async function snapshotBeforeWrite(root: string, newConfig: SkillConfig): Promise<void> {
  const current = await loadProjectSkillFile(root, newConfig.id);
  if (!current) return; // First write — no snapshot needed

  // Skip snapshot if content is identical
  if (JSON.stringify(current) === JSON.stringify(newConfig)) return;

  const verDir = skillVersionsDir(root, newConfig.id);
  await mkdir(verDir, { recursive: true });

  // Determine next revision number
  let maxRev = 0;
  try {
    const files = await readdir(verDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const num = Number(file.replace(".json", ""));
        if (!Number.isNaN(num) && num > maxRev) maxRev = num;
      }
    }
  } catch {
    // Directory just created, no files yet
  }

  const rev = maxRev + 1;
  const version: SkillVersionMeta & { config: SkillConfig } = {
    rev,
    timestamp: new Date().toISOString(),
    id: newConfig.id,
    config: current,
  };

  await writeFile(skillVersionPath(root, newConfig.id, rev), JSON.stringify(version, null, 2), "utf-8");

  // Prune old versions
  await pruneVersions(root, newConfig.id);
}

async function pruneVersions(root: string, id: string): Promise<void> {
  const verDir = skillVersionsDir(root, id);
  let files: string[];
  try {
    files = await readdir(verDir);
  } catch {
    return;
  }

  const revs: number[] = [];
  for (const file of files) {
    if (file.endsWith(".json")) {
      const num = Number(file.replace(".json", ""));
      if (!Number.isNaN(num)) revs.push(num);
    }
  }

  revs.sort((a, b) => a - b);
  if (revs.length <= VERSION_KEEP) return;

  const toRemove = revs.slice(0, revs.length - VERSION_KEEP);
  for (const old of toRemove) {
    await rm(skillVersionPath(root, id, old), { force: true });
  }
}

async function listVersions(root: string, id: string): Promise<SkillVersionMeta[]> {
  const verDir = skillVersionsDir(root, id);
  let files: string[];
  try {
    files = await readdir(verDir);
  } catch {
    return [];
  }

  const versions: SkillVersionMeta[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(verDir, file), "utf-8");
      const parsed = JSON.parse(raw) as SkillVersionMeta;
      if (parsed.rev !== undefined) versions.push(parsed);
    } catch {
      // Skip corrupt version files
    }
  }

  versions.sort((a, b) => b.rev - a.rev); // newest first
  return versions;
}

async function loadVersion(root: string, id: string, rev: number): Promise<SkillConfig | null> {
  try {
    const raw = await readFile(skillVersionPath(root, id, rev), "utf-8");
    const parsed = JSON.parse(raw) as { config: SkillConfig };
    return SkillConfigSchema.parse(parsed.config);
  } catch {
    return null;
  }
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

function skillConfigParser(raw: string): SkillConfig {
  return SkillConfigSchema.parse(JSON.parse(raw));
}

async function loadProjectSkillFile(root: string, id: string): Promise<SkillConfig | null> {
  const idx = IndexManager.getInstance();
  return idx.get<SkillConfig>(root, PROJECT_SKILLS_DIR, id, skillConfigParser);
}

async function writeProjectSkill(root: string, config: SkillConfig): Promise<void> {
  // Snapshot current version before overwriting
  await snapshotBeforeWrite(root, config);

  const idx = IndexManager.getInstance();
  await idx.set(root, PROJECT_SKILLS_DIR, config.id, config);
}

async function deleteProjectSkillFile(root: string, id: string): Promise<boolean> {
  const path = projectSkillPath(root, id);
  try {
    await access(path);
  } catch {
    return false;
  }
  await rm(path, { force: true });
  IndexManager.getInstance().evict(PROJECT_SKILLS_DIR, id);
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

    // For builtin skills, write only the minimal enabled flag override.
    // Keep the original source so the frontend retains the builtin getDisplayDescription path.
    const originalSource = stored.source;
    const projectFile = await loadProjectSkillFile(root, id);
    const baseConfig = projectFile ?? stored.config;
    const updated: SkillConfig = { ...baseConfig, enabled: !baseConfig.enabled };
    await writeProjectSkill(root, updated);

    return c.json({
      skill: toApiSkill({ config: updated, source: originalSource, path: projectSkillPath(root, id) }),
    });
  });

  // GET /api/skills/:id/versions — list version history
  router.get("/:id/versions", async (c) => {
    const id = validateSkillId(c.req.param("id"));
    const versions = await listVersions(root, id);
    return c.json({ versions });
  });

  // GET /api/skills/:id/versions/:rev — get a specific version
  router.get("/:id/versions/:rev", async (c) => {
    const id = validateSkillId(c.req.param("id"));
    const rev = parseInt(c.req.param("rev"), 10);
    if (Number.isNaN(rev) || rev < 1) {
      throw new ApiError(400, "INVALID_REV", "Revision must be a positive integer");
    }

    const config = await loadVersion(root, id, rev);
    if (!config) {
      throw new ApiError(404, "VERSION_NOT_FOUND", `Version ${rev} not found for skill: ${id}`);
    }
    return c.json({ version: { rev, config } });
  });

  // POST /api/skills/:id/versions/:rev/restore — restore a version
  router.post("/:id/versions/:rev/restore", async (c) => {
    const id = validateSkillId(c.req.param("id"));
    const rev = parseInt(c.req.param("rev"), 10);
    if (Number.isNaN(rev) || rev < 1) {
      throw new ApiError(400, "INVALID_REV", "Revision must be a positive integer");
    }

    const config = await loadVersion(root, id, rev);
    if (!config) {
      throw new ApiError(404, "VERSION_NOT_FOUND", `Version ${rev} not found for skill: ${id}`);
    }

    // Restore: overwrite current with the version's config
    await writeProjectSkill(root, config);

    return c.json({
      skill: toApiSkill({ config, source: "project", path: projectSkillPath(root, id) }),
    });
  });

  return router;
}
