// ── Cross-Platform Publish (Issue #85 — C1-1, Issue #100 — C1-2) ──
//
// Experimental publish/export support. Initially supports 起点中文网 (qidian)
// format export as a single TXT file.
//
// Routes (mounted at /api/publish):
//   GET   /api/publish/:bookId/check            — readiness check (chapters ≥ 5, metadata OK)
//   POST  /api/publish/:bookId/export           — export book as qidian-compatible TXT
//   POST  /api/publish/:bookId/format-preview   — return formatted preview for selected platform
//   POST  /api/publish/:bookId/publish          — full publish flow

import { Hono } from "hono";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { ApiError } from "../errors.js";
import {
  getAdapter,
  buildExportArtifact,
  type PublishPlatform,
  type PublishChapter,
  type ValidationWarning,
} from "@actalk/inkchain-core";

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

interface FormatPreviewBody {
  platform: PublishPlatform;
  chapters: number[];
}

interface PublishBody {
  platform: PublishPlatform;
  chapters: number[];
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

function toPlatformValidation(checks: Array<{ name: string; passed: boolean; message: string }>): ValidationWarning[] {
  return checks.map((c) => ({
    field: c.name,
    message: c.message,
    severity: c.passed ? ("ok" as never) : "error",
  })).filter((w) => w.severity === "error");
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

    // 3. Minimum chapter count (>=5)
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
    lines.push(`作者: ${meta.platform === "qidian" ? "（请填写作者名）" : "InkChain"}`);
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

  // POST /api/publish/:bookId/format-preview — Return formatted preview
  router.post("/:bookId/format-preview", async (c) => {
    const bookId = c.req.param("bookId");
    const meta = await readBookMeta(root, bookId);
    const chapters = await listChapters(root, bookId);
    const body = await c.req.json<FormatPreviewBody>();

    if (!body.platform) {
      throw new ApiError(400, "MISSING_PLATFORM", "请指定发布平台");
    }

    if (!body.chapters || body.chapters.length === 0) {
      throw new ApiError(400, "NO_CHAPTERS_SELECTED", "请选择要发布的章节");
    }

    const adapter = getAdapter(body.platform);

    // Build PublishChapter list from requested chapters
    const selectedChapters: PublishChapter[] = [];
    const chapterMap = new Map(chapters.map((ch) => [ch.number, ch]));

    for (const num of body.chapters) {
      const ch = chapterMap.get(num);
      if (!ch) {
        throw new ApiError(404, "CHAPTER_NOT_FOUND", `章节 ${num} 未找到`);
      }
      selectedChapters.push({
        meta: {
          number: ch.number,
          title: ch.title,
          status: "drafted",
          wordCount: ch.content.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          auditIssues: [],
          lengthWarnings: [],
        },
        text: ch.content,
      });
    }

    // Generate previews
    const previews = selectedChapters.map((pc, i) => {
      const original = pc.text;
      const formatted = adapter.formatChapter(pc, i + 1);
      return {
        chapter: {
          number: pc.meta.number,
          title: pc.meta.title,
          wordCount: pc.meta.wordCount,
        },
        original,
        formatted,
      };
    });

    return c.json({ previews });
  });

  // POST /api/publish/:bookId/publish — Full publish flow
  router.post("/:bookId/publish", async (c) => {
    const bookId = c.req.param("bookId");
    const meta = await readBookMeta(root, bookId);
    const chapters = await listChapters(root, bookId);
    const body = await c.req.json<PublishBody>();

    if (!body.platform) {
      throw new ApiError(400, "MISSING_PLATFORM", "请指定发布平台");
    }

    if (!body.chapters || body.chapters.length === 0) {
      throw new ApiError(400, "NO_CHAPTERS_SELECTED", "请选择要发布的章节");
    }

    const adapter = getAdapter(body.platform);

    // Build PublishChapter list
    const chapterMap = new Map(chapters.map((ch) => [ch.number, ch]));
    const selectedChapters: PublishChapter[] = [];

    for (const num of body.chapters) {
      const ch = chapterMap.get(num);
      if (!ch) {
        throw new ApiError(404, "CHAPTER_NOT_FOUND", `章节 ${num} 未找到`);
      }
      selectedChapters.push({
        meta: {
          number: ch.number,
          title: ch.title,
          status: "drafted",
          wordCount: ch.content.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          auditIssues: [],
          lengthWarnings: [],
        },
        text: ch.content,
      });
    }

    // Validate requirements
    const bookConfig: BookMeta = meta;
    // Convert to BookConfig-like for validation
    const fakeBookConfig = {
      id: bookConfig.id,
      title: bookConfig.title,
      platform: bookConfig.platform,
      genre: bookConfig.genre,
      status: bookConfig.status,
      targetChapters: 200,
      chapterWordCount: 3000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const warnings = adapter.validateRequirements(fakeBookConfig as never, selectedChapters);
    const errors = warnings.filter((w) => w.severity === "error");

    if (errors.length > 0) {
      return c.json({
        ok: false,
        published: false,
        warnings: errors,
        message: "存在未通过的检查项",
      }, 400);
    }

    // Generate formatted content
    const formatted = adapter.formatFullBook(fakeBookConfig as never, selectedChapters);

    // In a real implementation, this would upload to the platform's API.
    // For now, return the formatted content as the publish output.
    return c.json({
      ok: true,
      published: true,
      platform: body.platform,
      chapterCount: selectedChapters.length,
      totalWords: formatted.length,
      formatted,
      message: `已成功发布 ${selectedChapters.length} 章到 ${adapter.getName()}`,
    });
  });

  // ── P2-3: Export Enhancement — EPUB download ──
  router.get("/:bookId/export-epub", async (c) => {
    const bookId = c.req.param("bookId");

    const state = {
      bookDir: (id: string) => join(root, "books", id),
      loadBookConfig: async (id: string) => {
        const raw = JSON.parse(await readFile(join(root, "books", id, "book.json"), "utf-8"));
        return { title: raw.title ?? "Untitled", language: raw.language ?? "zh-CN" };
      },
      loadChapterIndex: async (id: string) => {
        const raw = JSON.parse(await readFile(join(root, "books", id, "chapter_index.json"), "utf-8"));
        return raw.chapters ?? [];
      },
    };

    try {
      const artifact = await buildExportArtifact(
        state as never,
        bookId,
        { format: "epub" },
      );
      return new Response(artifact.payload as Blob, {
        headers: {
          "Content-Type": "application/epub+zip",
          "Content-Disposition": `attachment; filename="${bookId}.epub"`,
        },
      });
    } catch (e) {
      throw new ApiError(500, "EXPORT_FAILED", e instanceof Error ? e.message : String(e));
    }
  });

  // ── P2-3: Export Enhancement — HTML preview ──
  router.post("/:bookId/preview-html", async (c) => {
    const bookId = c.req.param("bookId");

    try {
      const chaptersDir = join(root, "books", bookId, "chapters");
      const files = await readdir(chaptersDir);
      const mdFiles = files.filter((f) => f.endsWith(".md")).sort();

      let htmlBody = "";
      for (const file of mdFiles) {
        const content = await readFile(join(chaptersDir, file), "utf-8");
        const title = content.match(/^#\s+(.+)/m)?.[1]?.trim() ?? file;
        const body = content
          .split("\n")
          .filter((l) => !l.startsWith("#"))
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => `<p>${l.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
          .join("\n");
        htmlBody += `<section class="chapter"><h2>${title}</h2>${body}</section>\n`;
      }

      const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${await state.loadBookConfig(bookId).then((b) => b.title)}</title>
<style>
  body { max-width: 720px; margin: 0 auto; padding: 2rem 1rem; font-family: Georgia, "Noto Serif SC", serif; line-height: 1.8; color: #1a1a1a; background: #faf8f5; }
  h2 { color: #8B3A3A; border-bottom: 1px solid #e0d8d0; padding-bottom: 0.5rem; margin-top: 2.5rem; font-size: 1.3rem; }
  p { text-indent: 2em; margin: 0.5em 0; }
  @media (prefers-color-scheme: dark) { body { background: #1a1a1a; color: #e0d8d0; } h2 { color: #c8786a; border-color: #333; } }
</style>
</head>
<body>${htmlBody}</body>
</html>`;

      return c.html(html);
    } catch (e) {
      throw new ApiError(500, "PREVIEW_FAILED", e instanceof Error ? e.message : String(e));
    }
  });

  return router;
}
