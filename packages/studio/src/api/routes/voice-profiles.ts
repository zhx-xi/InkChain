// ── Voice Profile API Route (C3-1) ──
// Provides CRUD operations for character voice profiles.
// Data is stored as a single JSON file: {projectRoot}/.inkos/voice-profiles.json
//
// Routes (mounted at /api/v1/project):
//   GET    /voice-profiles                  — List all voice profiles
//   GET    /voice-profiles/:characterId     — Get profile for a character
//   PUT    /voice-profiles/:characterId     — Create/update profile
//   DELETE /voice-profiles/:characterId     — Delete a profile
//   GET    /voice-profiles/presets          — List preset names
//   GET    /voice-profiles/presets/:presetId — Get preset details

import { Hono } from "hono";
import {
  loadVoiceProfiles,
  getVoiceProfile,
  saveVoiceProfile,
  deleteVoiceProfile,
  listVoicePresets,
  getVoicePreset,
  CharacterVoiceProfileSchema,
} from "@actalk/inkos-core";

export function createVoiceProfilesRouter(getProjectRoot: () => string): Hono {
  const app = new Hono();

  // GET /voice-profiles — List all voice profiles
  app.get("/voice-profiles", async (c) => {
    try {
      const root = getProjectRoot();
      const data = await loadVoiceProfiles(root);
      const profilesList = Object.entries(data.profiles).map(([characterId, profile]) => ({
        characterId,
        speechStyle: profile.speechStyle,
        tone: profile.tone,
        personality: profile.personality,
        updatedAt: profile.updatedAt,
      }));
      return c.json({ profiles: profilesList, version: data.version });
    } catch (e) {
      return c.json({
        error: {
          code: "INTERNAL_ERROR",
          message: `获取声线档案列表失败: ${e instanceof Error ? e.message : String(e)}`,
        },
      }, 500);
    }
  });

  // GET /voice-profiles/presets — List preset names
  // MUST be registered before the :characterId param route
  app.get("/voice-profiles/presets", async (c) => {
    try {
      const presetIds = await listVoicePresets();
      const presets = presetIds.map((id) => ({
        id,
        name: presetLabel(id),
      }));
      return c.json({ presets });
    } catch (e) {
      return c.json({
        error: {
          code: "INTERNAL_ERROR",
          message: `获取声线预设列表失败: ${e instanceof Error ? e.message : String(e)}`,
        },
      }, 500);
    }
  });

  // GET /voice-profiles/presets/:presetId — Get preset details
  app.get("/voice-profiles/presets/:presetId", async (c) => {
    try {
      const presetId = c.req.param("presetId");
      const preset = await getVoicePreset(presetId);
      if (!preset) {
        return c.json({
          error: { code: "NOT_FOUND", message: `声线预设 "${presetId}" 不存在` },
        }, 404);
      }
      return c.json({ preset: { id: presetId, ...preset } });
    } catch (e) {
      return c.json({
        error: {
          code: "INTERNAL_ERROR",
          message: `获取声线预设失败: ${e instanceof Error ? e.message : String(e)}`,
        },
      }, 500);
    }
  });

  // GET /voice-profiles/:characterId — Get profile for a character
  app.get("/voice-profiles/:characterId", async (c) => {
    try {
      const characterId = c.req.param("characterId");
      const root = getProjectRoot();
      const profile = await getVoiceProfile(root, characterId);
      if (!profile) {
        return c.json({
          error: { code: "NOT_FOUND", message: `角色 "${characterId}" 的声线档案不存在` },
        }, 404);
      }
      return c.json({ profile });
    } catch (e) {
      return c.json({
        error: {
          code: "INTERNAL_ERROR",
          message: `获取声线档案失败: ${e instanceof Error ? e.message : String(e)}`,
        },
      }, 500);
    }
  });

  // PUT /voice-profiles/:characterId — Create/update profile
  app.put("/voice-profiles/:characterId", async (c) => {
    try {
      const characterId = c.req.param("characterId");
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
      }

      // Merge with defaults via VoiceProfileSchema
      const now = Date.now();
      const bodyRecord = body as Record<string, unknown>;
      const parsed = CharacterVoiceProfileSchema.safeParse({
        characterId,
        speechStyle: bodyRecord.speechStyle ?? "现代口语",
        personality: bodyRecord.personality ?? [],
        catchphrases: bodyRecord.catchphrases ?? [],
        tone: bodyRecord.tone ?? "温和",
        vocabulary: bodyRecord.vocabulary ?? [],
        avoidance: bodyRecord.avoidance ?? [],
        sampleDialogues: bodyRecord.sampleDialogues ?? [],
        updatedAt: now,
      });

      if (!parsed.success) {
        return c.json({
          error: {
            code: "VALIDATION_ERROR",
            message: "声线档案数据校验失败",
            details: parsed.error.flatten(),
          },
        }, 400);
      }

      const root = getProjectRoot();
      const saved = await saveVoiceProfile(root, characterId, parsed.data);
      return c.json({ profile: saved });
    } catch (e) {
      return c.json({
        error: {
          code: "INTERNAL_ERROR",
          message: `保存声线档案失败: ${e instanceof Error ? e.message : String(e)}`,
        },
      }, 500);
    }
  });

  // DELETE /voice-profiles/:characterId — Delete a profile
  app.delete("/voice-profiles/:characterId", async (c) => {
    try {
      const characterId = c.req.param("characterId");
      const root = getProjectRoot();
      const deleted = await deleteVoiceProfile(root, characterId);
      if (!deleted) {
        return c.json({
          error: { code: "NOT_FOUND", message: `角色 "${characterId}" 的声线档案不存在` },
        }, 404);
      }
      return c.json({ deleted: true, characterId });
    } catch (e) {
      return c.json({
        error: {
          code: "INTERNAL_ERROR",
          message: `删除声线档案失败: ${e instanceof Error ? e.message : String(e)}`,
        },
      }, 500);
    }
  });

  return app;
}

// ── Helpers ──

function presetLabel(presetId: string): string {
  const labels: Record<string, string> = {
    "ancient-scholar": "古代书生",
    "modern-youth": "现代青年",
    "martial-hero": "江湖豪侠",
    "court-noble": "宫中贵人",
  };
  return labels[presetId] ?? presetId;
}
