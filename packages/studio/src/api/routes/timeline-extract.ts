// ── AI Timeline Extraction Route (Issue #211 — AI自动导入提取) ──
//
// Routes (mounted at /api/v1/books):
//   POST /:id/chapters/:chapterNum/extract/timeline — Extract timeline events from chapter text

import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  loadProjectConfig,
  extractTimelineEvents,
} from "@actalk/inkos-core";
import { ApiError } from "../errors.js";
import { isSafeBookId } from "../safety.js";

export function createTimelineExtractRouter(
  bookDir: (id: string) => string,
  root: string,
): Hono {
  const router = new Hono();

  // POST /:id/chapters/:chapterNum/extract/timeline
  router.post("/:id/chapters/:chapterNum/extract/timeline", async (c) => {
    const id = c.req.param("id");
    const chapterNumStr = c.req.param("chapterNum");

    if (!isSafeBookId(id)) {
      throw new ApiError(400, "INVALID_BOOK_ID", `Invalid book id: "${id}"`);
    }

    const chapterNum = Number(chapterNumStr);
    if (!Number.isInteger(chapterNum) || chapterNum < 0) {
      throw new ApiError(400, "INVALID_CHAPTER", `Invalid chapter number: "${chapterNumStr}"`);
    }

    const dir = bookDir(id);

    // Load project config for LLM settings — use project root, not book dir
    const config = await loadProjectConfig(root, { consumer: "studio", requireApiKey: false });

    // Read chapter file
    const padded = String(chapterNum).padStart(4, "0");
    const chaptersDir = join(dir, "chapters");
    const { readdir } = await import("node:fs/promises");
    let files: string[];
    try {
      files = await readdir(chaptersDir);
    } catch {
      throw new ApiError(404, "CHAPTERS_DIR_NOT_FOUND", "章节目录不存在");
    }

    const chapterFile = files.find((f) => f.startsWith(`${padded}_`) && f.endsWith(".md"));
    if (!chapterFile) {
      throw new ApiError(404, "CHAPTER_NOT_FOUND", `第 ${chapterNum} 章文件未找到`);
    }

    const text = await readFile(join(chaptersDir, chapterFile), "utf-8");

    try {
      const result = await extractTimelineEvents(text, chapterNum, { llm: config.llm });
      return c.json({
        events: result.events,
        raw: result.raw.substring(0, 500),
        chapter: chapterNum,
      });
    } catch (err) {
      return c.json({
        error: {
          code: "EXTRACT_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      }, 500);
    }
  });

  return router;
}
