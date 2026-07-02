// ── Cross-Platform Publish (Issue #85 — C1-1) ──
//
// Experimental publish/export support. Initially supports 起点中文网 (qidian)
// format export as a single TXT file.
//
// Routes (mounted at /api/publish):
//   GET  /api/publish/:bookId/check   — readiness check (chapters ≥ 5, metadata OK)
//   POST /api/publish/:bookId/export   — export book as qidian-compatible TXT

import { Hono } from "hono";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { ApiError } from "../errors.js";

interface BookMeta {
  id: string;
  title: string;
  platform: string;
  genre: string;
  status: string;
}

interface PublishCheckResult {
  ready: boolean;
  checks: Array<{ name: string; passed: boolean; message: string }>;
}

interface ChapterItem {
  number: number;
  title: string;
  content: string;
}

function safeDir(root: string, bookId: string): string {
  if (!/^[a-z0-9_-]+$/i.test(bookId)) {
    throw new ApiError(400, "INVALID_BOOK_ID", `Invalid book id: ${bookId}`);
  }
  return join(root, ".inkos", "books", bookId);
}

async function readBookMeta(root: string, bookId: string): Promise<BookMeta> {
  const dir = safeDir(root, bookId);
  const metaPath = join(dir, "book.json");
  try {
    const raw = await readFile(metaPath, "utf-8");
    return JSON.parse(raw) as BookMeta;
  } catch {
    throw new ApiError(404, "BOOK_NOT_FOUND", `Book not found: ${bookId}`);
  }
}

async function listChapters(root: string, bookId: string): Promise<ChapterItem[]> {
  const dir = safeDir(root, bookId);
  const chaptersDir = join(dir, "chapters");

  if (!existsSync(chaptersDir)) {
    return [];
  }

  const entries = await readdir(chaptersDir, { withFileTypes: true });
  const chapterFiles = entries
    .filter((e) => e.isFile() && /^\d+\.json$/.test(e.name))
    .sort((a, b) => {
      const na = parseInt(a.name, 10);
      const nb = parseInt(b.name, 10);
      return na - nb;
    });

  const chapters: ChapterItem[] = [];
  for (const file of chapterFiles) {
    const raw = await readFile(join(chaptersDir, file.name), "utf-8");
    const data = JSON.parse(raw);
    chapters.push({
      number: data.number ?? parseInt(file.name, 10),
      title: data.title ?? `第${file.name.replace(/\.json$/, "")}章`,
      content: data.content ?? "",
    });
  }

  return chapters;
}

export function createPublishRouter(root: string) {
  const router = new Hono();

  // GET /api/publish/:bookId/check — readiness check
  router.get("/:bookId/check", async (c) => {
    const bookId = c.req.param("bookId");
    const meta = await readBookMeta(root, bookId);
    const chapters = await listChapters(root, bookId);

    const checks: PublishCheckResult["checks"] = [];

    // 1. Book has a title
    checks.push({
      name: "书名",
      passed: Boolean(meta.title && meta.title.length >= 2),
      message: meta.title ? `书名: ${meta.title}` : "请设置书名",
    });

    // 2. Book has a genre
    checks.push({
      name: "题材",
      passed: Boolean(meta.genre && meta.genre.length >= 2),
      message: meta.genre ? `题材: ${meta.genre}` : "请设置题材",
    });

    // 3. Minimum chapter count (≥5)
    checks.push({
      name: "章节数",
      passed: chapters.length >= 5,
      message: `当前 ${chapters.length} 章${chapters.length < 5 ? `，还需 ${5 - chapters.length} 章` : ""}`,
    });

    // 4. Total word count
    const totalWords = chapters.reduce((sum, ch) => sum + ch.content.length, 0);
    checks.push({
      name: "总字数",
      passed: totalWords >= 10000,
      message: `当前约 ${totalWords} 字${totalWords < 10000 ? `，还需约 ${10000 - totalWords} 字` : ""}`,
    });

    // 5. Platform compatibility
    checks.push({
      name: "平台兼容性",
      passed: meta.platform === "qidian" || meta.platform === "other",
      message: meta.platform === "qidian" ? "起点中文网" : `当前平台: ${meta.platform}，将导出为通用格式`,
    });

    const ready = checks.every((c) => c.passed);

    return c.json({ ready, checks, meta: { title: meta.title, totalChapters: chapters.length, totalWords } });
  });

  // POST /api/publish/:bookId/export — export as qidian-compatible TXT
  router.post("/:bookId/export", async (c) => {
    const bookId = c.req.param("bookId");
    const meta = await readBookMeta(root, bookId);
    const chapters = await listChapters(root, bookId);

    if (chapters.length === 0) {
      throw new ApiError(400, "NO_CHAPTERS", "No chapters to export");
    }

    // Build qidian-compatible TXT content
    const lines: string[] = [];
    lines.push(meta.title);
    lines.push(`作者: ${meta.platform === "qidian" ? "（请填写作者名）" : "InkOS"}`);
    lines.push(`题材: ${meta.genre}`);
    lines.push(`总字数: ${chapters.reduce((sum, ch) => sum + ch.content.length, 0)}`);
    lines.push("");
    lines.push("=".repeat(40));
    lines.push("");

    for (const ch of chapters) {
      const cleanTitle = ch.title || `第${ch.number}章`;
      lines.push(`第${ch.number}章 ${cleanTitle}`);
      lines.push("");
      lines.push(ch.content || "（本章内容为空）");
      lines.push("");
      lines.push("-".repeat(30));
      lines.push("");
    }

    const content = lines.join("\r\n");
    const filename = `${meta.title}_export_${Date.now()}.txt`;

    // Return the exported content and metadata
    return c.json({
      ok: true,
      filename,
      content,
      contentType: "text/plain; charset=utf-8",
      chapterCount: chapters.length,
      totalWords: content.length,
    });
  });

  return router;
}
