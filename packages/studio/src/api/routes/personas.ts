// ── Persona CRUD API Route ──
// Provides project-level persona config CRUD operations.
// Persona files are stored in {projectRoot}/.inkos/personas/ as YAML frontmatter + Markdown body.
//
// Routes:
//   GET    /api/v1/project/personas           — List all persona summaries
//   GET    /api/v1/project/personas/:role      — Get persona config for a specific agent role
//   PUT    /api/v1/project/personas/:role      — Update persona config
//   POST   /api/v1/project/personas/:role      — Create persona config (or overwrite)
//   DELETE /api/v1/project/personas/:role      — Reset persona to default

import { Hono } from "hono";
import {
  readPersonaConfig,
  listAvailablePersonas,
  savePersonaConfig,
  PersonaConfigSchema,
  AgentRoleEnum,
  serializePersonaConfig,
  parsePersonaConfig,
  getDefaultPersona,
  type PersonaSummary,
  type AgentRole,
  type PersonaConfig,
} from "@actalk/inkos-core";
import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

// ── Route factory ──

export function createPersonasRouter(getProjectRoot: () => string): Hono {
  const app = new Hono();

  // GET /personas — List all persona summaries
  app.get("/personas", async (c) => {
    try {
      const root = getProjectRoot();
      const summaries: PersonaSummary[] = await listAvailablePersonas(root) as PersonaSummary[];
      return c.json({ personas: summaries });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `获取 Persona 列表失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // GET /personas/:role — Get persona config for a specific agent role
  app.get("/personas/:role", async (c) => {
    const roleParam = c.req.param("role");
    const parsed = AgentRoleEnum.safeParse(roleParam);
    if (!parsed.success) {
      return c.json({
        error: { code: "INVALID_ROLE", message: `无效的 Agent 角色: ${roleParam}` },
      }, 400);
    }

    try {
      const root = getProjectRoot();
      const config = await readPersonaConfig(root, parsed.data);

      // Also read the raw file content for the body
      const projectDir = join(root, ".inkos", "personas");
      const body = await readFile(join(projectDir, `${parsed.data}.md`), "utf-8")
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

  // PUT /personas/:role — Update persona config
  app.put("/personas/:role", async (c) => {
    const roleParam = c.req.param("role");
    const parsed = AgentRoleEnum.safeParse(roleParam);
    if (!parsed.success) {
      return c.json({
        error: { code: "INVALID_ROLE", message: `无效的 Agent 角色: ${roleParam}` },
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

    if (!configRaw) {
      return c.json({
        error: { code: "VALIDATION_ERROR", message: "请求体缺少 config 字段" },
      }, 400);
    }

    // Merge agentRole into config
    const mergedConfig = { ...configRaw, agentRole: parsed.data };
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

    try {
      const root = getProjectRoot();
      await savePersonaConfig(root, parsedConfig.data, freeTextBody);
      return c.json({ ok: true, config: parsedConfig.data });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `保存 Persona 配置失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // POST /personas/:role — Create/reset persona config
  app.post("/personas/:role", async (c) => {
    const roleParam = c.req.param("role");
    const parsed = AgentRoleEnum.safeParse(roleParam);
    if (!parsed.success) {
      return c.json({
        error: { code: "INVALID_ROLE", message: `无效的 Agent 角色: ${roleParam}` },
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

    const defaultConfig = getDefaultPersona(parsed.data);
    const mergedConfig = configRaw
      ? { ...defaultConfig, ...configRaw, agentRole: parsed.data }
      : { ...defaultConfig, agentRole: parsed.data };

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

    try {
      const root = getProjectRoot();
      await savePersonaConfig(root, parsedConfig.data, freeTextBody);
      return c.json({ ok: true, config: parsedConfig.data });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `创建 Persona 配置失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // DELETE /personas/:role — Reset persona to default (delete project-level file)
  app.delete("/personas/:role", async (c) => {
    const roleParam = c.req.param("role");
    const parsed = AgentRoleEnum.safeParse(roleParam);
    if (!parsed.success) {
      return c.json({
        error: { code: "INVALID_ROLE", message: `无效的 Agent 角色: ${roleParam}` },
      }, 400);
    }

    try {
      const root = getProjectRoot();
      const filePath = join(root, ".inkos", "personas", `${parsed.data}.md`);
      await unlink(filePath).catch(() => {
        // File not found — that's fine, means already using default
      });
      return c.json({ ok: true, message: `Persona ${parsed.data} 已重置为默认配置` });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `重置 Persona 配置失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  return app;
}
