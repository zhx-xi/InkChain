// ── Persona CRUD API Route ──
// Provides project-level persona config CRUD operations.
// Persona files are stored in {projectRoot}/.inkos/personas/ as YAML frontmatter + Markdown body.
//
// Routes (mounted at /api/v1/project):
//   GET    /personas                      — List all persona summaries
//   GET    /personas/:agentId             — Get persona config for a specific agent role
//   PUT    /personas/:agentId             — Update persona config
//   POST   /personas/:agentId             — Create persona config (overwrite)
//   DELETE /personas/:agentId             — Reset persona to default
//   GET    /personas/presets              — List available presets (optional ?genre= filter)
//   GET    /personas/presets/:presetId    — Get preset detail
//   POST   /personas/:agentId/apply       — Apply a preset to a specific agent

import { Hono } from "hono";
import { readFile, readdir, mkdir, writeFile, rm, unlink } from "node:fs/promises";
import { join } from "node:path";

import {
  AgentRoleEnum,
  PersonaConfigSchema,
  PersonaConfigUpdateSchema,
  readPersonaConfig,
  listAvailablePersonas,
  ensurePersonasDir,
  savePersonaConfig,
  getDefaultPersona,
  parsePersonaConfig,
  serializePersonaConfig,
  type AgentRole,
  type PersonaConfig,
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
    const parsed = JSON.parse(raw);
    return {
      id: parsed.id ?? presetId,
      name: parsed.name ?? "",
      description: parsed.description ?? "",
      genre: parsed.genre,
      source: "builtin",
      personas: parsed.personas as Record<string, PersonaConfig>,
      version: parsed.version ?? 1,
    };
  } catch {
    return null;
  }
}

async function loadProjectPresetDetail(projectRoot: string, presetId: string): Promise<PresetDetail | null> {
  try {
    const raw = await readFile(join(projectRoot, PROJECT_PRESETS_RELATIVE, `${presetId}.json`), "utf-8");
    const parsed = JSON.parse(raw);
    return {
      id: parsed.id ?? presetId,
      name: parsed.name ?? "",
      description: parsed.description ?? "",
      genre: parsed.genre,
      source: "project",
      personas: parsed.personas as Record<string, PersonaConfig>,
      version: parsed.version ?? 1,
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

export function createPersonasRouter(getProjectRoot: () => string): Hono {
  const app = new Hono();

  // GET /personas — List all persona summaries
  app.get("/personas", async (c) => {
    try {
      const root = getProjectRoot();
      const summaries = await listAvailablePersonas(root);
      return c.json({ personas: summaries });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `获取 Persona 列表失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // ── Preset routes (static paths first, before :agentId params) ──

  // GET /personas/presets — list available presets (optional ?genre= filter)
  app.get("/personas/presets", async (c) => {
    const root = getProjectRoot();
    const genre = c.req.query("genre");
    const genreFilter = genre?.trim() || undefined;

    const [builtinPresets, projectPresets] = await Promise.all([
      listBuiltinPresets(genreFilter),
      listProjectPresets(root, genreFilter),
    ]);

    // Project-level presets come first
    return c.json({ presets: [...projectPresets, ...builtinPresets] });
  });

  // GET /personas/presets/:presetId — get preset detail
  app.get("/personas/presets/:presetId", async (c) => {
    const root = getProjectRoot();
    const presetId = c.req.param("presetId");

    // Check project-level first, then built-in
    const projectPreset = await loadProjectPresetDetail(root, presetId);
    if (projectPreset) {
      return c.json({ preset: projectPreset });
    }

    const builtinPreset = await loadBuiltinPresetDetail(presetId);
    if (builtinPreset) {
      return c.json({ preset: builtinPreset });
    }

    return c.json({ error: { code: "NOT_FOUND", message: `预设 ${presetId} 不存在` } }, 404);
  });

  // GET /personas/:agentId — Get persona config for a specific agent role
  app.get("/personas/:agentId", async (c) => {
    const agentId = c.req.param("agentId");
    let role: AgentRole;
    try {
      role = parseAgentRoleParam(agentId);
    } catch (error) {
      return c.json({
        error: { code: "INVALID_AGENT_ROLE", message: (error as Error).message },
      }, 400);
    }

    try {
      const root = getProjectRoot();
      const config = await readPersonaConfig(root, role);

      // Also read the raw file content for the body
      const projectDir = join(root, ".inkos", "personas");
      const body = await readFile(join(projectDir, `${role}.md`), "utf-8")
        .then((raw) => {
          const parsedFile = parsePersonaConfig(raw);
          return parsedFile.body;
        })
        .catch(() => config.freeTextDetails ?? "");

      return c.json({ config, body });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `获取 Persona 配置失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // PUT /personas/:agentId — Update persona config
  app.put("/personas/:agentId", async (c) => {
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
    const root = getProjectRoot();
    const current = await readPersonaConfig(root, role);
    const updated: PersonaConfig = {
      ...current,
      ...parsed.data,
      agentRole: role, // agentRole is immutable
    };

    // Save with the free text body (or empty if not provided)
    const bodyText = typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).freeTextDetails as string ?? updated.freeTextDetails ?? ""
      : "";
    await savePersonaConfig(root, updated, bodyText);

    return c.json({ persona: updated });
  });

  // POST /personas/:agentId — Create/reset persona config
  app.post("/personas/:agentId", async (c) => {
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

    const bodyRecord = body as Record<string, unknown>;
    const configRaw = bodyRecord.config as Record<string, unknown> | undefined;
    const freeTextBody = typeof bodyRecord.body === "string" ? bodyRecord.body : "";

    const root = getProjectRoot();
    const defaultConfig = getDefaultPersona(role);
    const mergedConfig = configRaw
      ? { ...defaultConfig, ...configRaw, agentRole: role }
      : { ...defaultConfig, agentRole: role };

    const parsedConfig = PersonaConfigSchema.safeParse(mergedConfig);
    if (!parsedConfig.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: `Persona 配置验证失败: ${parsedConfig.error.message}`,
          details: parsedConfig.error.issues,
        },
      }, 400);
    }

    await savePersonaConfig(root, parsedConfig.data, freeTextBody);
    return c.json({ ok: true, config: parsedConfig.data });
  });

  // DELETE /personas/:agentId — delete project-level config, restore to default
  app.delete("/personas/:agentId", async (c) => {
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
    const root = getProjectRoot();
    const personasDir = join(root, ".inkos", "personas");
    try {
      await rm(join(personasDir, `${role}.md`), { force: true });
    } catch {
      // File didn't exist — that's fine
    }

    const restored = await readPersonaConfig(root, role);
    return c.json({ persona: restored, deleted: true });
  });

  // POST /personas/:agentId/apply — apply a preset to a specific agent
  app.post("/personas/:agentId/apply", async (c) => {
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

    const root = getProjectRoot();
    const presetId = (body as Record<string, unknown>).presetId;
    if (!presetId || typeof presetId !== "string") {
      return c.json({ error: { code: "MISSING_PRESET_ID", message: "请求体中缺少 presetId" } }, 400);
    }

    // Load preset (project-level first, then built-in)
    let preset = await loadProjectPresetDetail(root, presetId);
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

    await savePersonaConfig(root, presetPersona, presetPersona.freeTextDetails ?? "");
    const updated = await readPersonaConfig(root, role);
    return c.json({ persona: updated, appliedFromPreset: presetId });
  });

  return app;
}
