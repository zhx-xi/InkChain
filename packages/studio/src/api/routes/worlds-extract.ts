// ── World Extraction Route (Wrld-7: AI导入提取MVP) ──
// Rule-based world extraction from raw TXT/MD text — no LLM call needed.
//
// Routes (mounted at /api/v1/books/:id/worlds/extract):
//   POST /:id/worlds/extract     — Extract world from raw text body

import { Hono } from "hono";
import {
  extractWorldFromText,
  summarizeExtraction,
  type ExtractResult,
} from "@actalk/inkchain-core";
import { ApiError } from "../errors.js";
import { isSafeBookId } from "../safety.js";

export function createWorldsExtractRouter(
  bookDir: (id: string) => string,
): Hono {
  const router = new Hono();

  // ── POST /:bookId/worlds/extract — Extract world from text ──

  // ── POST /:bookId/worlds/ai-extract-from-book — Extract world from book content ──
  // Reads first N chapters and setting files, concatenates them, and runs extractWorldFromText.

  router.post("/:id/worlds/ai-extract-from-book", async (c) => {
    const id = c.req.param("id");

    if (!isSafeBookId(id)) {
      throw new ApiError(400, "INVALID_BOOK_ID", `Invalid book id: "${id}"`);
    }

    const dir = bookDir(id);
    const { access, readdir, readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");

    // Verify the book exists
    try {
      await access(join(dir, "book.json"));
    } catch {
      throw new ApiError(404, "BOOK_NOT_FOUND", `Book not found: ${id}`);
    }

    let textParts: string[] = [];

    // 1. Prefer reading setting files (.md) from settings/ directory first
    const settingsDir = join(dir, "settings");
    try {
      await access(settingsDir);
      const settingsFiles = await readdir(settingsDir);
      const mdFiles = settingsFiles.filter((f) => f.endsWith(".md") && !f.startsWith("."));
      for (const file of mdFiles) {
        const content = await readFile(join(settingsDir, file), "utf-8");
        textParts.push(`## ${file}\n\n${content}`);
      }
    } catch {
      // No settings directory — fine
    }

    // 2. Supplement with chapter text (if fewer than 5 chapters read from settings)
    const maxChapters: number = 5;
    const chaptersDir = join(dir, "chapters");
    try {
      const chapterFiles = await readdir(chaptersDir);
      const sortedChapters = chapterFiles
        .filter((f) => f.endsWith(".md") && /^\d{4}/.test(f))
        .sort();

      const toRead = Math.min(sortedChapters.length, maxChapters);
      for (let i = 0; i < toRead; i++) {
        const content = await readFile(join(chaptersDir, sortedChapters[i]), "utf-8");
        textParts.push(`## 第 ${i + 1} 章\n\n${content}`);
      }
    } catch {
      // No chapters directory — continue with settings files only
    }

    const text = textParts.join("\n\n---\n\n");
    if (!text.trim()) {
      throw new ApiError(400, "NO_CONTENT", "本书暂无章节或设定文件可提取");
    }

    const result: ExtractResult = extractWorldFromText(text);
    const summary = summarizeExtraction(result);

    return c.json({
      world: result.world,
      entities: result.entities,
      sections: result.sections,
      summary,
      textLength: text.length,
      chaptersRead: textParts.length,
    });
  });

  router.post("/:id/worlds/extract", async (c) => {
    const id = c.req.param("id");

    if (!isSafeBookId(id)) {
      throw new ApiError(400, "INVALID_BOOK_ID", `Invalid book id: "${id}"`);
    }

    // Verify the book exists
    const dir = bookDir(id);
    const { access } = await import("node:fs/promises");
    const { join } = await import("node:path");
    try {
      await access(join(dir, "book.json"));
    } catch {
      throw new ApiError(404, "BOOK_NOT_FOUND", `Book not found: ${id}`);
    }

    let text: string;
    const contentType = c.req.header("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      // File upload path
      const formData = await c.req.formData();
      const file = formData.get("file");
      if (!file || typeof file === "string") {
        throw new ApiError(400, "NO_FILE", "请上传 TXT 或 Markdown 文件");
      }
      text = await (file as Blob).text();
    } else if (contentType.includes("application/json")) {
      // JSON body with text field
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
      }
      const rawText = (body as Record<string, unknown>).text;
      if (typeof rawText !== "string" || !rawText.trim()) {
        throw new ApiError(400, "NO_TEXT", "请求体必须包含非空的 text 字段");
      }
      text = rawText;
    } else {
      // Plain text body
      text = await c.req.text();
      if (!text.trim()) {
        throw new ApiError(400, "NO_TEXT", "请求体不能为空，请提供 TXT 或 Markdown 文本");
      }
    }

    const result: ExtractResult = extractWorldFromText(text);
    const summary = summarizeExtraction(result);

    return c.json({
      world: result.world,
      entities: result.entities,
      sections: result.sections,
      summary,
      textLength: text.length,
    });
  });

  return router;
}
