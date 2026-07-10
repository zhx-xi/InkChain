// ── Persona Preset API Routes (Per-6) ──
// Provides persona preset listing, applying, and saving functionality.
//
// Routes:
//   GET    /api/v1/project/presets           — List all presets (built-in + project)
//   GET    /api/v1/project/presets/:id       — Get a single preset's full config
//   POST   /api/v1/project/presets/:id/apply — Apply a preset to all 7 agents
//   POST   /api/v1/project/presets           — Save current config as a new preset
//   DELETE /api/v1/project/presets/:id       — Delete a project-level preset

import { Hono } from "hono";
import {
  listAllPresets,
  loadPreset,
  applyPreset,
  saveAsPreset,
  deletePreset,
  type PersonaConfig,
  type AgentRole,
} from "@actalk/inkchain-core";
import type { PersonaConfig as PC } from "@actalk/inkchain-core/models/persona-config.js";

// ── Route factory ──

export function createPresetsRouter(getProjectRoot: () => string): Hono {
  const app = new Hono();

  // GET /presets — List all presets
  app.get("/presets", async (c) => {
    try {
      const root = getProjectRoot();
      const presets = await listAllPresets(root);
      return c.json({ presets });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `获取预设列表失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // GET /presets/:id — Get full preset data
  app.get("/presets/:id", async (c) => {
    const presetId = c.req.param("id");
    try {
      const root = getProjectRoot();
      const preset = await loadPreset(root, presetId);
      if (!preset) {
        return c.json({ error: { code: "NOT_FOUND", message: `预设 '${presetId}' 未找到` } }, 404);
      }
      return c.json({ preset });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `获取预设失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // POST /presets/:id/apply — Apply a preset
  app.post("/presets/:id/apply", async (c) => {
    const presetId = c.req.param("id");
    try {
      const root = getProjectRoot();
      const ok = await applyPreset(root, presetId);
      if (!ok) {
        return c.json({ error: { code: "NOT_FOUND", message: `预设 '${presetId}' 未找到或应用失败` } }, 404);
      }
      return c.json({ ok: true, message: `预设 '${presetId}' 已应用到所有 Agent` });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `应用预设失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // POST /presets — Save current config as a new preset
  app.post("/presets", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    const bodyRecord = body as Record<string, unknown>;
    const name = typeof bodyRecord.name === "string" ? bodyRecord.name.trim() : "";
    const description = typeof bodyRecord.description === "string" ? bodyRecord.description.trim() : "";
    const personasRaw = bodyRecord.personas as Record<string, unknown> | undefined;

    if (!name) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "预设名称不能为空" } }, 400);
    }
    if (!personasRaw || typeof personasRaw !== "object") {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "缺少 personas 字段" } }, 400);
    }

    try {
      const root = getProjectRoot();
      const presetId = await saveAsPreset(root, name, description, personasRaw as Record<AgentRole, PersonaConfig>);
      return c.json({ ok: true, presetId, message: `预设 '${name}' 已保存` });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `保存预设失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // DELETE /presets/:id — Delete a project-level preset
  app.delete("/presets/:id", async (c) => {
    const presetId = c.req.param("id");
    try {
      const root = getProjectRoot();
      const ok = await deletePreset(root, presetId);
      if (!ok) {
        return c.json({ error: { code: "NOT_FOUND", message: `预设 '${presetId}' 不存在或不是项目级别预设` } }, 404);
      }
      return c.json({ ok: true, message: `预设 '${presetId}' 已删除` });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `删除预设失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  return app;
}
