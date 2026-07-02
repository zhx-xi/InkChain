// ── Search API Route ──
// Provides full-text search across sessions (and optionally chapters/characters).
//
// Routes (mounted at /books):
//   GET /:id/search?q=:query        — Search within a book/project
//   GET /:id/search?q=:query&scope=session  — Scope-filtered search
//
// Returns: { results: SearchResult[] }

import { Hono } from "hono";
import {
  searchSessions,
  type SearchResult,
} from "@actalk/inkos-core";

/**
 * Create a Hono router for search endpoints.
 *
 * @param getProjectRoot - Thunk that resolves to the current project root path.
 */
export function createSearchRouter(getProjectRoot: () => string): Hono {
  const app = new Hono();

  // GET /:id/search — search within a book/project
  app.get("/:id/search", async (c) => {
    try {
      const root = getProjectRoot();
      const bookId = c.req.param("id");
      const query = c.req.query("q");
      const scope = c.req.query("scope");

      if (!query || query.trim().length === 0) {
        return c.json({ results: [] });
      }

      const results: SearchResult[] = await searchSessions(
        root,
        query.trim(),
        scope?.trim() || undefined,
      );

      return c.json({ results });
    } catch (e) {
      return c.json({
        error: {
          code: "SEARCH_ERROR",
          message: `搜索失败: ${e instanceof Error ? e.message : String(e)}`,
        },
      }, 500);
    }
  });

  return app;
}
