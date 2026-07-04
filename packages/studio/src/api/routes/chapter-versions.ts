// ── Chapter Versions API Route (Issue #235) ──
//
// Routes (mounted at /api/v1/books):
//   GET /:id/chapters/:num/versions — List chapter versions
//   GET /:id/chapters/:num/versions/:timestamp — Load a specific version
//   POST /:id/chapters/:num/versions/:timestamp/restore — Restore a version

import { Hono } from "hono";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import {
  snapshotChapterVersion,
  listChapterVersions,
  loadChapterVersion,
  getChapterVersionSummary,
} from "@actalk/inkos-core";
import { ApiError } from "../errors.js";
import { isSafeBookId } from "../safety.js";

export function createChapterVersionsRouter(
  bookDir: (id: string) => string,
): Hono {
  const router = new Hono();

  // GET /:id/chapters/:num/versions — List version history
  router.get("/:id/chapters/:num/versions", async (c) => {
    const id = c.req.param("id");
    if (!isSafeBookId(id)) throw new ApiError(400, "INVALID_BOOK_ID", `Invalid book id: "${id}"`);

    const chapterNum = parseInt(c.req.param("num"), 10);
    if (!Number.isInteger(chapterNum) || chapterNum < 0) {
      throw new ApiError(400, "INVALID_CHAPTER", `Invalid chapter number`);
    }

    const dir = bookDir(id);
    const versions = await listChapterVersions(dir, chapterNum);
    return c.json({ versions, chapterNum });
  });

  // GET /:id/chapters/:num/versions/:timestamp — Load specific version content
  router.get("/:id/chapters/:num/versions/:timestamp", async (c) => {
    const id = c.req.param("id");
    if (!isSafeBookId(id)) throw new ApiError(400, "INVALID_BOOK_ID", `Invalid book id: "${id}"`);

    const chapterNum = parseInt(c.req.param("num"), 10);
    if (!Number.isInteger(chapterNum) || chapterNum < 0) {
      throw new ApiError(400, "INVALID_CHAPTER", `Invalid chapter number`);
    }

    const timestamp = c.req.param("timestamp");
    if (!timestamp) throw new ApiError(400, "INVALID_TIMESTAMP", "Missing timestamp");

    const dir = bookDir(id);
    const content = await loadChapterVersion(dir, chapterNum, timestamp);
    if (content === null) {
      throw new ApiError(404, "VERSION_NOT_FOUND", `Version ${timestamp} not found`);
    }

    return c.json({ content, chapterNum, timestamp });
  });

  // POST /:id/chapters/:num/versions/snapshot — Manually create a snapshot
  router.post("/:id/chapters/:num/versions/snapshot", async (c) => {
    const id = c.req.param("id");
    if (!isSafeBookId(id)) throw new ApiError(400, "INVALID_BOOK_ID", `Invalid book id: "${id}"`);

    const chapterNum = parseInt(c.req.param("num"), 10);
    if (!Number.isInteger(chapterNum) || chapterNum < 0) {
      throw new ApiError(400, "INVALID_CHAPTER", `Invalid chapter number`);
    }

    const dir = bookDir(id);
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

    const currentContent = await readFile(join(chaptersDir, chapterFile), "utf-8");
    const timestamp = await snapshotChapterVersion(dir, chapterNum, currentContent);
    if (!timestamp) {
      throw new ApiError(500, "SNAPSHOT_FAILED", "创建快照失败");
    }

    return c.json({
      ok: true,
      chapterNum,
      timestamp,
    });
  });

  // POST /:id/chapters/:num/versions/:timestamp/restore — Restore a version
  router.post("/:id/chapters/:num/versions/:timestamp/restore", async (c) => {
    const id = c.req.param("id");
    if (!isSafeBookId(id)) throw new ApiError(400, "INVALID_BOOK_ID", `Invalid book id: "${id}"`);

    const chapterNum = parseInt(c.req.param("num"), 10);
    if (!Number.isInteger(chapterNum) || chapterNum < 0) {
      throw new ApiError(400, "INVALID_CHAPTER", `Invalid chapter number`);
    }

    const timestamp = c.req.param("timestamp");
    if (!timestamp) throw new ApiError(400, "INVALID_TIMESTAMP", "Missing timestamp");

    const dir = bookDir(id);

    // 1. Load the version content
    const versionContent = await loadChapterVersion(dir, chapterNum, timestamp);
    if (versionContent === null) {
      throw new ApiError(404, "VERSION_NOT_FOUND", `Version ${timestamp} not found`);
    }

    // 2. Find the current chapter file
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

    // 3. Snapshot current content before restoring
    const currentContent = await readFile(join(chaptersDir, chapterFile), "utf-8");
    await snapshotChapterVersion(dir, chapterNum, currentContent, versionContent);

    // 4. Write restored content
    await writeFile(join(chaptersDir, chapterFile), versionContent, "utf-8");

    return c.json({
      ok: true,
      chapterNum,
      restoredTimestamp: timestamp,
      wordCount: versionContent.length,
    });
  });

  return router;
}
