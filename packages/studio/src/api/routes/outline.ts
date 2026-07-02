import { Hono } from "hono";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  ChapterOutlineSchema,
  OutlineFileSchema,
  planChapters,
  type ChapterPlan,
  type ChapterOutline,
  type OutlineFile,
} from "@actalk/inkos-core";

const OUTLINE_FILE = "story/state/outline.json";

// ── Helpers ──

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function loadOutlineFile(bookDir: string): Promise<OutlineFile> {
  try {
    const raw = await readFile(join(bookDir, OUTLINE_FILE), "utf-8");
    const parsed = JSON.parse(raw);
    return OutlineFileSchema.parse(parsed);
  } catch {
    // Return a minimal default outline; updatedAt set to 0 signals "no outline yet".
    return {
      bookId: "",
      chapters: [],
      version: 1,
      updatedAt: 0,
    };
  }
}

async function saveOutlineFile(bookDir: string, outline: OutlineFile): Promise<void> {
  const dir = join(bookDir, "story", "state");
  await mkdir(dir, { recursive: true });
  outline.updatedAt = Date.now();
  await writeFile(join(bookDir, OUTLINE_FILE), JSON.stringify(outline, null, 2), "utf-8");
}

// ── Route factory ──

export function createOutlineRouter(bookDir: (id: string) => string) {
  const router = new Hono();

  // GET /:id/outline — get full outline
  router.get("/:id/outline", async (c) => {
    const id = c.req.param("id");
    const dir = bookDir(id);
    const outline = await loadOutlineFile(dir);
    // Persist bookId if not set
    if (!outline.bookId) {
      outline.bookId = id;
      await saveOutlineFile(dir, outline);
    }
    return c.json({ outline });
  });

  // PUT /:id/outline — replace full outline
  router.put("/:id/outline", async (c) => {
    const id = c.req.param("id");
    const dir = bookDir(id);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    if (!isRecord(body) || !Array.isArray(body.chapters)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "请求体需要包含 chapters 数组" } }, 400);
    }

    // Parse and validate each chapter
    const chapters: ChapterOutline[] = [];
    for (const raw of body.chapters) {
      const parsed = ChapterOutlineSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({
          error: {
            code: "VALIDATION_ERROR",
            message: `章节校验失败: ${parsed.error.message}`,
          },
        }, 400);
      }
      chapters.push(parsed.data);
    }

    const existing = await loadOutlineFile(dir);
    const outline: OutlineFile = {
      bookId: id,
      chapters,
      version: existing.version + 1,
      updatedAt: Date.now(),
    };

    await saveOutlineFile(dir, outline);
    return c.json({ outline });
  });

  // PATCH /:id/outline/chapters/:number — update single chapter
  router.patch("/:id/outline/chapters/:number", async (c) => {
    const id = c.req.param("id");
    const chapterNumber = parseInt(c.req.param("number"), 10);
    const dir = bookDir(id);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    if (!isRecord(body)) {
      return c.json({ error: { code: "INVALID_BODY", message: "请求体必须是对象" } }, 400);
    }

    const outline = await loadOutlineFile(dir);
    const idx = outline.chapters.findIndex((ch) => ch.number === chapterNumber);
    if (idx === -1) {
      return c.json({ error: { code: "NOT_FOUND", message: `章节 ${chapterNumber} 不存在` } }, 404);
    }

    // Merge partial update with existing chapter data
    const merged = { ...outline.chapters[idx], ...body, number: chapterNumber };
    const parsed = ChapterOutlineSchema.safeParse(merged);
    if (!parsed.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: `章节校验失败: ${parsed.error.message}`,
        },
      }, 400);
    }

    outline.chapters[idx] = parsed.data;
    outline.version += 1;
    await saveOutlineFile(dir, outline);
    return c.json({ chapter: parsed.data });
  });

  // POST /:id/outline/chapters — add new chapter
  router.post("/:id/outline/chapters", async (c) => {
    const id = c.req.param("id");
    const dir = bookDir(id);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    if (!isRecord(body)) {
      return c.json({ error: { code: "INVALID_BODY", message: "请求体必须是对象" } }, 400);
    }

    const outline = await loadOutlineFile(dir);

    // Auto-assign chapter number if not given
    const nextNumber = body.number !== undefined && typeof body.number === "number"
      ? Math.max(1, Math.floor(body.number))
      : (outline.chapters.reduce((max, ch) => Math.max(max, ch.number), 0) + 1);

    const merged = { ...body, number: nextNumber };
    const parsed = ChapterOutlineSchema.safeParse(merged);
    if (!parsed.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: `章节校验失败: ${parsed.error.message}`,
        },
      }, 400);
    }

    // Check for duplicate chapter number
    if (outline.chapters.some((ch) => ch.number === nextNumber)) {
      return c.json({
        error: {
          code: "CONFLICT",
          message: `章节 ${nextNumber} 已存在`,
        },
      }, 409);
    }

    outline.chapters.push(parsed.data);
    outline.chapters.sort((a, b) => a.number - b.number);
    outline.version += 1;
    await saveOutlineFile(dir, outline);
    return c.json({ chapter: parsed.data }, 201);
  });

  // DELETE /:id/outline/chapters/:number — remove chapter
  router.delete("/:id/outline/chapters/:number", async (c) => {
    const id = c.req.param("id");
    const chapterNumber = parseInt(c.req.param("number"), 10);
    const dir = bookDir(id);

    const outline = await loadOutlineFile(dir);
    const idx = outline.chapters.findIndex((ch) => ch.number === chapterNumber);
    if (idx === -1) {
      return c.json({ error: { code: "NOT_FOUND", message: `章节 ${chapterNumber} 不存在` } }, 404);
    }

    outline.chapters.splice(idx, 1);
    outline.version += 1;
    await saveOutlineFile(dir, outline);
    return c.json({ deleted: true });
  });

  // POST /:id/outline/reorder — reorder chapters
  router.post("/:id/outline/reorder", async (c) => {
    const id = c.req.param("id");
    const dir = bookDir(id);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    if (!isRecord(body) || !Array.isArray(body.order)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "请求体需要包含 order: number[]" } }, 400);
    }

    const order = (body.order as unknown[]).map((n) => {
      if (typeof n !== "number" || !Number.isInteger(n) || n < 1) {
        throw new Error("order 数组中的每个元素必须是正整数");
      }
      return n;
    });

    const outline = await loadOutlineFile(dir);
    const chapterMap = new Map(outline.chapters.map((ch) => [ch.number, ch]));

    // Validate all requested chapters exist
    for (const num of order) {
      if (!chapterMap.has(num)) {
        return c.json({
          error: { code: "NOT_FOUND", message: `章节 ${num} 不存在` },
        }, 404);
      }
    }

    // Reorder: assign new sequential numbers based on input order
    const reordered: ChapterOutline[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < order.length; i++) {
      const oldNum = order[i];
      if (seen.has(oldNum)) {
        return c.json({
          error: { code: "VALIDATION_ERROR", message: `章节 ${oldNum} 在 order 中重复出现` },
        }, 400);
      }
      seen.add(oldNum);
      const chapter = { ...chapterMap.get(oldNum)!, number: i + 1 };
      reordered.push(chapter);
    }

    // Append chapters not in the order list
    const remaining = outline.chapters
      .filter((ch) => !seen.has(ch.number))
      .map((ch, i) => ({ ...ch, number: order.length + i + 1 }));

    const all = [...reordered, ...remaining];
    all.sort((a, b) => a.number - b.number);

    outline.chapters = all;
    outline.version += 1;
    await saveOutlineFile(dir, outline);
    return c.json({ chapters: all });
  });

  // POST /:id/outline/plan-chapters — rule-based AI chapter planning
  router.post("/:id/outline/plan-chapters", async (c) => {
    const id = c.req.param("id");

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    if (!isRecord(body)) {
      return c.json({ error: { code: "INVALID_BODY", message: "请求体必须是对象" } }, 400);
    }

    const chapterCount =
      typeof body.chapterCount === "number" && Number.isInteger(body.chapterCount) && body.chapterCount > 0
        ? body.chapterCount
        : 10;

    // Load existing outline for context
    const dir = bookDir(id);
    const outline = await loadOutlineFile(dir);

    const existingChapters = outline.chapters.map((ch) => ({
      number: ch.number,
      title: ch.title,
      summary: ch.summary,
    }));

    const plans: ChapterPlan[] = planChapters({
      chapterCount,
      outline: { chapters: existingChapters },
    });

    return c.json({ plans });
  });

  return router;
}
