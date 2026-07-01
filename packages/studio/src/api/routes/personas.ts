// ── Persona CRUD API ──
// Project-level persona configuration management.
// Routes are registered under /api/v1/personas.

import { Hono } from "hono";
import { readFile, readdir, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

import {
  AgentRoleEnum,
  PersonaConfigSchema,
  PersonaConfigUpdateSchema,
  PersonaPresetSchema,
  readPersonaConfig,
  listAvailablePersonas,
  ensurePersonasDir,
  savePersonaConfig,
  getDefaultPersona,
  getAllDefaultPersonas,
  parsePersonaConfig,
  serializePersonaConfig,
  type AgentRole,
  type PersonaConfig,
  type PersonaPreset,
} from "@actalk/inkos-core";

// ── Presets ──

/** Directory for built-in presets within the core package. */
let BUILTIN_PRESETS_DIR: string | null = null;
try {
  BUILTIN_PRESETS_DIR = new URL("../../../../core/src/personas/presets", import.meta.url).pathname;
} catch {
  // import.meta.url may not be available in all environments (e.g. vitest)
  BUILTIN_PRESETS_DIR = null;
}

/** Relative path from project root for project-level presets. */
const PROJECT_PRESETS_RELATIVE = ".inkos/presets";

// ── Helpers ──

function parseAgentRoleParam(raw: string): AgentRole {
  const parsed = AgentRoleEnum.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid agent role: "${raw}". Must be one of: ${AgentRoleEnum.options.join(", ")}`);
  }
  return parsed.data;
}

interface PresetSummary {
  id: string;
  name: string;
  description: string;
  genre?: string;
  source: "builtin" | "project";
}

interface PresetDetail {
  id: string;
  name: string;
  description: string;
  genre?: string;
  source: "builtin" | "project";
  personas: Record<string, PersonaConfig>;
  version: number;
}

async function listBuiltinPresets(genreFilter?: string): Promise<PresetSummary[]> {
  if (!BUILTIN_PRESETS_DIR) return [];
  try {
    const files = await readdir(BUILTIN_PRESETS_DIR);
    const presets: PresetSummary[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(BUILTIN_PRESETS_DIR, file), "utf-8");
        const data = JSON.parse(raw);
        const preset: PresetSummary = {
          id: data.id ?? file.replace(/\.json$/, ""),
          name: data.name ?? "",
          description: data.description ?? "",
          genre: data.genre,
          source: "builtin",
        };
        if (!genreFilter || preset.genre === genreFilter) {
          presets.push(preset);
        }
      } catch {
        // Skip malformed preset files
      }
    }
    return presets;
  } catch {
    // No built-in presets directory
    return [];
  }
}

async function listProjectPresets(projectRoot: string, genreFilter?: string): Promise<PresetSummary[]> {
  const dir = join(projectRoot, PROJECT_PRESETS_RELATIVE);
  try {
    const files = await readdir(dir);
    const presets: PresetSummary[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(dir, file), "utf-8");
        const data = JSON.parse(raw);
        const preset: PresetSummary = {
          id: data.id ?? file.replace(/\.json$/, ""),
          name: data.name ?? "",
          description: data.description ?? "",
          genre: data.genre,
          source: "project",
        };
        if (!genreFilter || preset.genre === genreFilter) {
          presets.push(preset);
        }
      } catch {
        // Skip malformed preset files
      }
    }
    return presets;
  } catch {
    // No project-level presets directory
    return [];
  }
}

async function loadBuiltinPresetDetail(presetId: string): Promise<PresetDetail | null> {
  if (!BUILTIN_PRESETS_DIR) return null;
  try {
    const raw = await readFile(join(BUILTIN_PRESETS_DIR, `${presetId}.json`), "utf-8");
    const parsed = PersonaPresetSchema.parse(JSON.parse(raw));
    return {
      id: parsed.id,
      name: parsed.name,
      description: parsed.description,
      genre: (JSON.parse(raw) as Record<string, unknown>).genre as string | undefined,
      source: "builtin",
      personas: parsed.personas as Record<string, PersonaConfig>,
      version: parsed.version,
    };
  } catch {
    return null;
  }
}

async function loadProjectPresetDetail(projectRoot: string, presetId: string): Promise<PresetDetail | null> {
  try {
    const raw = await readFile(join(projectRoot, PROJECT_PRESETS_RELATIVE, `${presetId}.json`), "utf-8");
    const parsed = PersonaPresetSchema.parse(JSON.parse(raw));
    return {
      id: parsed.id,
      name: parsed.name,
      description: parsed.description,
      genre: (JSON.parse(raw) as Record<string, unknown>).genre as string | undefined,
      source: "project",
      personas: parsed.personas as Record<string, PersonaConfig>,
      version: parsed.version,
    };
  } catch {
    return null;
  }
}

async function applyPresetToProject(projectRoot: string, preset: PresetDetail): Promise<void> {
  await ensurePersonasDir(projectRoot);
  for (const [roleStr, config] of Object.entries(preset.personas)) {
    await savePersonaConfig(projectRoot, config, config.freeTextDetails ?? "");
  }
}

// ── Route factory ──

export function createPersonasRouter(projectRoot: string) {
  const router = new Hono();

  // GET /personas — list all available persona summaries
  router.get("/personas", async (c) => {
    const summaries = await listAvailablePersonas(projectRoot);
    return c.json({ personas: summaries });
  });

  // ── Preset routes (static paths first, before :agentId params) ──

  // GET /personas/presets — list available presets (optional ?genre= filter)
  router.get("/personas/presets", async (c) => {
    const genre = c.req.query("genre");
    const genreFilter = genre?.trim() || undefined;

    const [builtinPresets, projectPresets] = await Promise.all([
      listBuiltinPresets(genreFilter),
      listProjectPresets(projectRoot, genreFilter),
    ]);

    // Project-level presets come first
    return c.json({ presets: [...projectPresets, ...builtinPresets] });
  });

  // GET /personas/presets/:presetId — get preset detail
  router.get("/personas/presets/:presetId", async (c) => {
    const presetId = c.req.param("presetId");

    // Check project-level first, then built-in
    const projectPreset = await loadProjectPresetDetail(projectRoot, presetId);
    if (projectPreset) {
      return c.json({ preset: projectPreset });
    }

    const builtinPreset = await loadBuiltinPresetDetail(presetId);
    if (builtinPreset) {
      return c.json({ preset: builtinPreset });
    }

    return c.json({ error: { code: "NOT_FOUND", message: `预设 ${presetId} 不存在` } }, 404);
  });

  // ── Agent-specific routes ──

  // GET /personas/:agentId — get merged config for a specific agent
  router.get("/personas/:agentId", async (c) => {
    const agentId = c.req.param("agentId");
    let role: AgentRole;
    try {
      role = parseAgentRoleParam(agentId);
    } catch (error) {
      return c.json({
        error: { code: "INVALID_AGENT_ROLE", message: (error as Error).message },
      }, 400);
    }
    const config = await readPersonaConfig(projectRoot, role);
    return c.json({ persona: config });
  });

  // PUT /personas/:agentId — update persona config for a specific agent
  router.put("/personas/:agentId", async (c) => {
    const agentId = c.req.param("agentId");
    let role: AgentRole;
    try {
      role = parseAgentRoleParam(agentId);
    } catch (error) {
      return c.json({
        error: { code: "INVALID_AGENT_ROLE", message: (error as Error).message },
      }, 400);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    // Validate with PersonaConfigUpdateSchema (partial)
    const parsed = PersonaConfigUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Persona 配置校验失败",
          details: parsed.error.flatten(),
        },
      }, 400);
    }

    // Merge: load current config, apply updates
    const current = await readPersonaConfig(projectRoot, role);
    const updated: PersonaConfig = {
      ...current,
      ...parsed.data,
      agentRole: role, // agentRole is immutable
    };

    // Save with the free text body (or empty if not provided)
    const bodyText = typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).freeTextDetails as string ?? updated.freeTextDetails ?? ""
      : "";
    await savePersonaConfig(projectRoot, updated, bodyText);

    return c.json({ persona: updated });
  });

  // DELETE /personas/:agentId — delete project-level config, restore to default
  router.delete("/personas/:agentId", async (c) => {
    const agentId = c.req.param("agentId");
    let role: AgentRole;
    try {
      role = parseAgentRoleParam(agentId);
    } catch (error) {
      return c.json({
        error: { code: "INVALID_AGENT_ROLE", message: (error as Error).message },
      }, 400);
    }

    // Delete project-level file. After deletion, readPersonaConfig will fall back to built-in/default.
    const personasDir = join(projectRoot, ".inkos", "personas");
    try {
      await rm(join(personasDir, `${role}.md`), { force: true });
    } catch {
      // File didn't exist — that's fine
    }

    const restored = await readPersonaConfig(projectRoot, role);
    return c.json({ persona: restored, deleted: true });
  });

  // POST /personas/:agentId/apply — apply a preset to a specific agent
  router.post("/personas/:agentId/apply", async (c) => {
    const agentId = c.req.param("agentId");
    let role: AgentRole;
    try {
      role = parseAgentRoleParam(agentId);
    } catch (error) {
      return c.json({
        error: { code: "INVALID_AGENT_ROLE", message: (error as Error).message },
      }, 400);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    const presetId = (body as Record<string, unknown>).presetId;
    if (!presetId || typeof presetId !== "string") {
      return c.json({ error: { code: "MISSING_PRESET_ID", message: "请求体中缺少 presetId" } }, 400);
    }

    // Load preset (project-level first, then built-in)
    let preset = await loadProjectPresetDetail(projectRoot, presetId);
    if (!preset) {
      preset = await loadBuiltinPresetDetail(presetId);
    }
    if (!preset) {
      return c.json({ error: { code: "NOT_FOUND", message: `预设 ${presetId} 不存在` } }, 404);
    }

    // Apply the preset's persona for this specific agent role
    const presetPersona = preset.personas[role];
    if (!presetPersona) {
      return c.json({
        error: { code: "PRESET_MISSING_AGENT", message: `预设 ${presetId} 不包含角色 ${role} 的配置` },
      }, 400);
    }

    await savePersonaConfig(projectRoot, presetPersona, presetPersona.freeTextDetails ?? "");
    const updated = await readPersonaConfig(projectRoot, role);
    return c.json({ persona: updated, appliedFromPreset: presetId });
  });

  return router;
}
