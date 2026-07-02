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
} from "@actalk/inkos-core";
import { ApiError } from "../errors.js";
import { isSafeBookId } from "../safety.js";

export function createWorldsExtractRouter(
  bookDir: (id: string) => string,
): Hono {
  const router = new Hono();

  // ── POST /:bookId/worlds/extract — Extract world from text ──

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
