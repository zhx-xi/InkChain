// ── 章节审计 Dashboard API (Issue #329) ──
//
// Routes (mounted at /api/books):
//   GET   /:bookId/audit                        — 获取所有章节审计状态
//   POST  /:bookId/chapters/:chapterNumber/audit  — 触发审计
//   POST  /:bookId/chapters/:chapterNumber/audit/approve — 批准审计结果
//   POST  /:bookId/chapters/:chapterNumber/audit/reaudit — 重新审计

import { Hono } from "hono";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { ApiError } from "../errors.js";

// ── 审计数据类型 ──

export interface AuditIssue {
  type: "continuity" | "logic" | "character" | "style" | "pacing" | "grammar" | "other";
  severity: "info" | "warning" | "error";
  description: string;
  chapterNumber: number;
  location?: string;
}

export type AuditStatus = "pending" | "pass" | "warn" | "fail" | "approved";

export interface ChapterAuditResult {
  chapterNumber: number;
  status: AuditStatus;
  issues: AuditIssue[];
  lastAuditedAt?: string;
  approvedAt?: string;
}

// ── 持久化 ──

function auditDir(root: string, bookId: string): string {
  return join(root, ".inkos", "books", bookId, "audit");
}

function chapterAuditPath(root: string, bookId: string, chapterNumber: number): string {
  return join(auditDir(root, bookId), `chapter-${chapterNumber}.json`);
}

function auditIndexPath(root: string, bookId: string): string {
  return join(auditDir(root, bookId), "index.json");
}

async function ensureAuditDir(root: string, bookId: string): Promise<void> {
  await mkdir(auditDir(root, bookId), { recursive: true });
}

async function readChapterAudit(
  root: string,
  bookId: string,
  chapterNumber: number,
): Promise<ChapterAuditResult | null> {
  try {
    const raw = await readFile(chapterAuditPath(root, bookId, chapterNumber), "utf-8");
    return JSON.parse(raw) as ChapterAuditResult;
  } catch {
    return null;
  }
}

async function writeChapterAudit(
  root: string,
  bookId: string,
  result: ChapterAuditResult,
): Promise<void> {
  await ensureAuditDir(root, bookId);
  await writeFile(
    chapterAuditPath(root, bookId, result.chapterNumber),
    JSON.stringify(result, null, 2),
    "utf-8",
  );
}

async function listChapterAudits(
  root: string,
  bookId: string,
): Promise<ChapterAuditResult[]> {
  const dir = auditDir(root, bookId);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const results: ChapterAuditResult[] = [];
  for (const file of files) {
    if (!file.startsWith("chapter-") || !file.endsWith(".json")) continue;
    if (file === "index.json") continue;
    try {
      const raw = await readFile(join(dir, file), "utf-8");
      const result = JSON.parse(raw) as ChapterAuditResult;
      results.push(result);
    } catch {
      // skip malformed entries
    }
  }
  return results.sort((a, b) => a.chapterNumber - b.chapterNumber);
}

async function writeAuditIndex(
  root: string,
  bookId: string,
  results: ChapterAuditResult[],
): Promise<void> {
  await ensureAuditDir(root, bookId);
  await writeFile(
    auditIndexPath(root, bookId),
    JSON.stringify({ chapters: results, updatedAt: new Date().toISOString() }, null, 2),
    "utf-8",
  );
}

async function loadChaptersList(root: string, bookId: string): Promise<Array<{ number: number; title: string }>> {
  const indexRaw = await readFile(join(root, "books", bookId, "chapter_index.json"), "utf-8").catch(() => null);
  if (indexRaw) {
    const index = JSON.parse(indexRaw) as { chapters?: Array<{ number: number; title?: string }> };
    if (index.chapters) {
      return index.chapters.map((ch) => ({ number: ch.number, title: ch.title ?? `第${ch.number}章` }));
    }
  }

  // Fallback: read chapter files from the directory
  const chaptersDir = join(root, "books", bookId, "chapters");
  let files: string[];
  try {
    files = await readdir(chaptersDir);
  } catch {
    return [];
  }

  return files
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const match = f.match(/^(\d{4})_(.+)\.md$/);
      if (match) {
        return { number: Number.parseInt(match[1], 10), title: match[2] ?? `第${match[1]}章` };
      }
      return null;
    })
    .filter((ch): ch is { number: number; title: string } => ch !== null)
    .sort((a, b) => a.number - b.number);
}

// ── 模拟审计引擎（生产环境应接入真实审计代理） ──

function runMockAudit(chapterNumber: number): ChapterAuditResult {
  const random = Math.random();
  let status: AuditStatus;
  const issues: AuditIssue[] = [];

  if (random < 0.4) {
    status = "pass";
  } else if (random < 0.7) {
    status = "warn";
    issues.push({
      type: "style",
      severity: "warning",
      description: "部分段落风格不一致，建议统一润色",
      chapterNumber,
      location: "第2-3段",
    });
  } else {
    status = "fail";
    issues.push(
      {
        type: "continuity",
        severity: "error",
        description: "与前章存在剧情矛盾",
        chapterNumber,
        location: "第5段",
      },
      {
        type: "grammar",
        severity: "warning",
        description: "存在语法错误或不通顺的句子",
        chapterNumber,
        location: "第8行",
      },
      {
        type: "character",
        severity: "info",
        description: "角色对话风格偏离设定",
        chapterNumber,
        location: "第10段",
      },
    );
  }

  return {
    chapterNumber,
    status,
    issues,
    lastAuditedAt: new Date().toISOString(),
  };
}

// ── Router ──

export function createAuditRouter(root: string) {
  const router = new Hono();

  // GET /api/books/:bookId/audit — 获取所有章节审计状态
  router.get("/:bookId/audit", async (c) => {
    const bookId = c.req.param("bookId");
    const chapters = await loadChaptersList(root, bookId);
    const auditResults = await listChapterAudits(root, bookId);

    // Build a map of chapter number -> audit result
    const auditMap = new Map(auditResults.map((r) => [r.chapterNumber, r]));

    // Merge audit results with chapter list
    const merged = chapters.map((ch) => {
      const audit = auditMap.get(ch.number);
      return {
        chapterNumber: ch.number,
        title: ch.title,
        status: audit?.status ?? "pending",
        issues: audit?.issues ?? [],
        lastAuditedAt: audit?.lastAuditedAt ?? null,
        approvedAt: audit?.approvedAt ?? null,
      };
    });

    // Also include chapters that have audit results but are not in the chapter index
    for (const audit of auditResults) {
      if (!auditMap.has(audit.chapterNumber)) {
        // This shouldn't happen, but handle gracefully
      }
    }

    const totalChapters = merged.length;
    const auditedChapters = auditResults.length;
    const passedChapters = auditResults.filter((r) => r.status === "pass" || r.status === "approved").length;
    const warnChapters = auditResults.filter((r) => r.status === "warn").length;
    const failedChapters = auditResults.filter((r) => r.status === "fail").length;

    return c.json({
      chapters: merged,
      summary: {
        totalChapters,
        auditedChapters,
        passedChapters,
        warnChapters,
        failedChapters,
      },
    });
  });

  // POST /api/books/:bookId/chapters/:chapterNumber/audit — 触发审计
  router.post("/:bookId/chapters/:chapterNumber/audit", async (c) => {
    const bookId = c.req.param("bookId");
    const chapterNumberStr = c.req.param("chapterNumber");
    const chapterNumber = Number.parseInt(chapterNumberStr, 10);

    if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
      throw new ApiError(400, "INVALID_CHAPTER_NUMBER", `Invalid chapter number: ${chapterNumberStr}`);
    }

    // Check if the chapter exists
    const chapters = await loadChaptersList(root, bookId);
    const chapterExists = chapters.some((ch) => ch.number === chapterNumber);
    if (!chapterExists) {
      throw new ApiError(404, "CHAPTER_NOT_FOUND", `Chapter ${chapterNumber} not found`);
    }

    // Run audit (mock for now, should use real auditor agent)
    const result = runMockAudit(chapterNumber);

    // Persist
    await writeChapterAudit(root, bookId, result);

    return c.json({ audit: result });
  });

  // POST /api/books/:bookId/chapters/:chapterNumber/audit/approve — 批准审计结果
  router.post("/:bookId/chapters/:chapterNumber/audit/approve", async (c) => {
    const bookId = c.req.param("bookId");
    const chapterNumberStr = c.req.param("chapterNumber");
    const chapterNumber = Number.parseInt(chapterNumberStr, 10);

    if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
      throw new ApiError(400, "INVALID_CHAPTER_NUMBER", `Invalid chapter number: ${chapterNumberStr}`);
    }

    const existing = await readChapterAudit(root, bookId, chapterNumber);
    if (!existing) {
      throw new ApiError(404, "AUDIT_NOT_FOUND", `No audit found for chapter ${chapterNumber}. Run audit first.`);
    }

    const approved: ChapterAuditResult = {
      ...existing,
      status: "approved",
      approvedAt: new Date().toISOString(),
    };

    await writeChapterAudit(root, bookId, approved);
    return c.json({ audit: approved });
  });

  // POST /api/books/:bookId/chapters/:chapterNumber/audit/reaudit — 重新审计
  router.post("/:bookId/chapters/:chapterNumber/audit/reaudit", async (c) => {
    const bookId = c.req.param("bookId");
    const chapterNumberStr = c.req.param("chapterNumber");
    const chapterNumber = Number.parseInt(chapterNumberStr, 10);

    if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
      throw new ApiError(400, "INVALID_CHAPTER_NUMBER", `Invalid chapter number: ${chapterNumberStr}`);
    }

    const result = runMockAudit(chapterNumber);
    await writeChapterAudit(root, bookId, result);
    return c.json({ audit: result });
  });

  // POST /api/books/:bookId/chapters/audit/batch — 批量审计 (Issue #365)
  router.post("/:bookId/chapters/audit/batch", async (c) => {
    const bookId = c.req.param("bookId");

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效 JSON" } }, 400);
    }

    if (typeof body !== "object" || body === null) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "请求体必须是 JSON 对象" } }, 400);
    }

    const raw = body as Record<string, unknown>;
    const chapterNumbersRaw = raw.chapterNumbers;

    if (!Array.isArray(chapterNumbersRaw) || chapterNumbersRaw.length === 0) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "chapterNumbers 必须是包含章节序号的非空数组" } }, 400);
    }

    const chapterNumbers = chapterNumbersRaw
      .map((n) => (typeof n === "number" ? n : Number.parseInt(String(n), 10)))
      .filter((n) => Number.isInteger(n) && n > 0);

    if (chapterNumbers.length === 0) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "未提供有效的章节序号" } }, 400);
    }

    // Validate chapters exist
    const chapters = await loadChaptersList(root, bookId);
    const validChapters = chapterNumbers.filter((num) => chapters.some((ch) => ch.number === num));

    if (validChapters.length === 0) {
      return c.json({ error: { code: "CHAPTERS_NOT_FOUND", message: "指定的章节不存在" } }, 404);
    }

    // Run audit for each valid chapter
    const results: Array<{ chapterNumber: number; status: AuditStatus }> = [];
    for (const chapterNumber of validChapters) {
      const result = runMockAudit(chapterNumber);
      await writeChapterAudit(root, bookId, result);
      results.push({ chapterNumber: result.chapterNumber, status: result.status });
    }

    return c.json({
      batchSize: results.length,
      totalRequested: chapterNumbers.length,
      skipped: chapterNumbers.length - validChapters.length,
      results,
    });
  });

  return router;
}
