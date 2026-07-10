// ── Session Archive API Route ──
// Provides project-level session archive/unarchive, merge, and auto-archive operations.
//
// Routes (mounted at /api/v1/project):
//   GET    /sessions                           — List all sessions (optional ?status= filter)
//   GET    /sessions/:id                       — Get single session detail
//   POST   /sessions/:id/archive               — Archive a session (body: { reason?: string })
//   POST   /sessions/:id/unarchive             — Unarchive a session
//   POST   /sessions/archive/batch             — Batch archive sessions (body: { sessionIds: string[] })
//   POST   /sessions/:targetId/merge           — Merge sessions (body: { sourceId: string })
//   POST   /sessions/archive/auto              — Trigger auto-archive (body: { maxAgeDays?: number })

import { Hono } from "hono";
import {
  loadBookSession,
  listBookSessions,
  archiveBookSession,
  unarchiveBookSession,
  deleteBookSession,
  batchArchiveBookSessions,
  mergeBookSessions,
  autoArchiveStaleSessions,
  loadSessionTags,
} from "@actalk/inkchain-core";
import type { SessionTag } from "@actalk/inkchain-core";

/**
 * Transform a BookSessionSummary to a client-friendly SessionListItem.
 * Maps sessionId → id, adds date strings, and includes tags.
 */
function toSessionListItem(
  summary: {
    readonly sessionId: string;
    readonly title: string | null;
    readonly status: "active" | "archived";
    readonly messageCount: number;
    readonly archivedAt?: number;
    readonly createdAt: number;
    readonly updatedAt: number;
  },
  tags: SessionTag[],
) {
  return {
    id: summary.sessionId,
    title: summary.title ?? "（无标题）",
    status: summary.status,
    messageCount: summary.messageCount,
    archivedAt: summary.archivedAt != null ? new Date(summary.archivedAt).toISOString() : undefined,
    createdAt: new Date(summary.createdAt).toISOString(),
    updatedAt: new Date(summary.updatedAt).toISOString(),
    tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
  };
}

export function createSessionsRouter(getProjectRoot: () => string): Hono {
  const app = new Hono();

  // GET /sessions — list sessions, optional ?status=active|archived filter
  app.get("/sessions", async (c) => {
    try {
      const root = getProjectRoot();
      const statusQuery = c.req.query("status");
      const status = statusQuery === "active" || statusQuery === "archived"
        ? statusQuery
        : undefined;
      const summaries = await listBookSessions(root, undefined, status);

      // Load tags for all returned sessions
      const allTags = await loadSessionTags(root);
      const tagsBySession = allTags.tags ?? {};

      const sessions = summaries.map((s) =>
        toSessionListItem(s, tagsBySession[s.sessionId] ?? []),
      );

      return c.json({ sessions });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `获取会话列表失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // GET /sessions/:id — get single session detail
  app.get("/sessions/:id", async (c) => {
    try {
      const root = getProjectRoot();
      const sessionId = c.req.param("id");
      const session = await loadBookSession(root, sessionId);
      if (!session) {
        return c.json({ error: { code: "NOT_FOUND", message: `会话 ${sessionId} 不存在` } }, 404);
      }
      return c.json({ session });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `获取会话详情失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // POST /sessions/:id/archive — archive a session
  app.post("/sessions/:id/archive", async (c) => {
    try {
      const root = getProjectRoot();
      const sessionId = c.req.param("id");

      let body: { reason?: string } = {};
      try {
        body = await c.req.json() as { reason?: string };
      } catch {
        // No body is fine
      }

      const reason = typeof body.reason === "string" ? body.reason : undefined;
      const session = await archiveBookSession(root, sessionId, reason);
      if (!session) {
        return c.json({ error: { code: "NOT_FOUND", message: `会话 ${sessionId} 不存在` } }, 404);
      }
      return c.json({ session });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `归档会话失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // POST /sessions/:id/unarchive — unarchive a session
  app.post("/sessions/:id/unarchive", async (c) => {
    try {
      const root = getProjectRoot();
      const sessionId = c.req.param("id");
      const session = await unarchiveBookSession(root, sessionId);
      if (!session) {
        return c.json({ error: { code: "NOT_FOUND", message: `会话 ${sessionId} 不存在` } }, 404);
      }
      return c.json({ session });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `解档会话失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // DELETE /sessions/:id — permanently delete a session
  app.delete("/sessions/:id", async (c) => {
    try {
      const root = getProjectRoot();
      const sessionId = c.req.param("id");
      await deleteBookSession(root, sessionId);
      return c.json({ ok: true });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `永久删除会话失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // POST /sessions/archive/batch — batch archive sessions
  app.post("/sessions/archive/batch", async (c) => {
    try {
      const root = getProjectRoot();

      let body: { sessionIds?: unknown } = {};
      try {
        body = await c.req.json() as { sessionIds?: unknown };
      } catch {
        return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
      }

      if (!Array.isArray(body.sessionIds) || body.sessionIds.some((id: unknown) => typeof id !== "string")) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "sessionIds 必须是字符串数组" } }, 400);
      }

      const count = await batchArchiveBookSessions(root, body.sessionIds as string[]);
      return c.json({ archivedCount: count });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `批量归档失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // POST /sessions/:targetId/merge — merge source session into target
  app.post("/sessions/:targetId/merge", async (c) => {
    try {
      const root = getProjectRoot();
      const targetId = c.req.param("targetId");

      let body: { sourceId?: unknown } = {};
      try {
        body = await c.req.json() as { sourceId?: unknown };
      } catch {
        return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
      }

      if (typeof body.sourceId !== "string" || !body.sourceId.trim()) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "sourceId 必须是字符串" } }, 400);
      }

      if (body.sourceId === targetId) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "不能将会话合并到自身" } }, 400);
      }

      const session = await mergeBookSessions(root, targetId, body.sourceId);
      if (!session) {
        return c.json({ error: { code: "NOT_FOUND", message: "目标会话或源会话不存在" } }, 404);
      }
      return c.json({ session });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `合并会话失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  // POST /sessions/archive/auto — trigger auto-archive of stale sessions
  app.post("/sessions/archive/auto", async (c) => {
    try {
      const root = getProjectRoot();

      let body: { maxAgeDays?: unknown } = {};
      try {
        body = await c.req.json() as { maxAgeDays?: unknown };
      } catch {
        // No body is fine
      }

      const maxAgeDays = typeof body.maxAgeDays === "number" && body.maxAgeDays > 0
        ? body.maxAgeDays
        : 30;

      const count = await autoArchiveStaleSessions(root, maxAgeDays);
      return c.json({ archivedCount: count });
    } catch (e) {
      return c.json({
        error: { code: "INTERNAL_ERROR", message: `自动归档失败: ${e instanceof Error ? e.message : String(e)}` },
      }, 500);
    }
  });

  return app;
}
