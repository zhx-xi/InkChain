import { Hono } from "hono";
import { computeWritingStats } from "@actalk/inkos-core";
import type { StateManager } from "@actalk/inkos-core";

/**
 * Writing stats API route.
 * GET /api/v1/books/:id/stats — returns writing stats & word count trend.
 */
export function createStatsRouter(
  bookDir: (bookId: string) => string,
  state: StateManager,
): Hono {
  const router = new Hono<{ Variables: { bookDir: string } }>();

  router.get("/:id/stats", async (c) => {
    const bookId = c.req.param("id");
    const chapters = await state.loadChapterIndex(bookId);
    const stats = computeWritingStats(bookId, chapters);
    return c.json(stats);
  });

  return router;
}
