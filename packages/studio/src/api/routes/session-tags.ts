// ── Session Tags API Route ──
// Provides CRUD operations for session-level tags, persisted in
// {projectRoot}/.inkos/session-tags.json.
//
// Routes (mounted at /api/v1/project):
//   GET    /session-tags              — List all tags with usage counts
//   GET    /session-tags/colors       — Get available color presets
//   GET    /session-tags/:sessionId   — Get tags for a session
//   POST   /session-tags/:sessionId   — Add tag to session { name, color }
//   DELETE /session-tags/:sessionId/:tagId — Remove tag from session

import { Hono } from "hono";
import {
  TAG_COLORS,
  SessionTagSchema,
  loadSessionTags,
  getSessionTags,
  addSessionTag,
  removeSessionTag,
  listTagsByName,
} from "@actalk/inkchain-core";
import { randomUUID } from "node:crypto";

/**
 * Create a Hono router for session tags endpoints.
 *
 * @param getProjectRoot - Thunk that resolves to the current project root path.
 */
export function createSessionTagsRouter(getProjectRoot: () => string): Hono {
  const app = new Hono();

  // GET /session-tags — List all tags with usage counts
  app.get("/session-tags", async (c) => {
    try {
      const root = getProjectRoot();
      const tags = await listTagsByName(root);
      return c.json({ tags });
    } catch (e) {
      return c.json({
        error: {
          code: "INTERNAL_ERROR",
          message: `获取标签列表失败: ${e instanceof Error ? e.message : String(e)}`,
        },
      }, 500);
    }
  });

  // GET /session-tags/colors — Get available color presets
  app.get("/session-tags/colors", async (c) => {
    return c.json({ colors: TAG_COLORS });
  });

  // GET /session-tags/:sessionId — Get tags for a session
  app.get("/session-tags/:sessionId", async (c) => {
    try {
      const root = getProjectRoot();
      const sessionId = c.req.param("sessionId");
      const tags = await getSessionTags(root, sessionId);
      return c.json({ tags });
    } catch (e) {
      return c.json({
        error: {
          code: "INTERNAL_ERROR",
          message: `获取会话标签失败: ${e instanceof Error ? e.message : String(e)}`,
        },
      }, 500);
    }
  });

  // POST /session-tags/:sessionId — Add tag to session
  app.post("/session-tags/:sessionId", async (c) => {
    try {
      const root = getProjectRoot();
      const sessionId = c.req.param("sessionId");

      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
      }

      const bodyRecord = body as Record<string, unknown>;
      const name = typeof bodyRecord.name === "string" && bodyRecord.name.trim().length > 0
        ? bodyRecord.name.trim()
        : null;
      const color = typeof bodyRecord.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(bodyRecord.color)
        ? bodyRecord.color
        : null;

      if (!name) {
        return c.json({
          error: { code: "VALIDATION_ERROR", message: "标签名称 (name) 不能为空" },
        }, 400);
      }
      if (!color) {
        return c.json({
          error: { code: "VALIDATION_ERROR", message: "标签颜色 (color) 必须是有效的十六进制颜色值 (e.g. #FF6B6B)" },
        }, 400);
      }

      // Generate a stable tag id from the name (lowercased, hyphens)
      const tagId = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u4e00-\u9fff-]/g, "");
      const tag = { id: tagId || randomUUID(), name, color };

      // Validate with SessionTagSchema
      const parsed = SessionTagSchema.safeParse(tag);
      if (!parsed.success) {
        return c.json({
          error: {
            code: "VALIDATION_ERROR",
            message: "标签数据校验失败",
            details: parsed.error.flatten(),
          },
        }, 400);
      }

      const updatedTags = await addSessionTag(root, sessionId, parsed.data);
      return c.json({ tags: updatedTags });
    } catch (e) {
      return c.json({
        error: {
          code: "INTERNAL_ERROR",
          message: `添加标签失败: ${e instanceof Error ? e.message : String(e)}`,
        },
      }, 500);
    }
  });

  // DELETE /session-tags/:sessionId/:tagId — Remove tag from session
  app.delete("/session-tags/:sessionId/:tagId", async (c) => {
    try {
      const root = getProjectRoot();
      const sessionId = c.req.param("sessionId");
      const tagId = c.req.param("tagId");

      const updatedTags = await removeSessionTag(root, sessionId, tagId);
      return c.json({ tags: updatedTags });
    } catch (e) {
      return c.json({
        error: {
          code: "INTERNAL_ERROR",
          message: `删除标签失败: ${e instanceof Error ? e.message : String(e)}`,
        },
      }, 500);
    }
  });

  return app;
}
