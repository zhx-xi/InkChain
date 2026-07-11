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
import { createHash } from "node:crypto";
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

export type AuditMode = "rule" | "ai";

export interface ChapterAuditResult {
  chapterNumber: number;
  status: AuditStatus;
  issues: AuditIssue[];
  lastAuditedAt?: string;
  approvedAt?: string;
  /** SHA-256 hash of chapter content at time of audit — used for cache validation */
  contentHash?: string;
  /** Audit mechanism: "rule" (rule-based, fast) or "ai" (AI/deep, thorough) */
  mode?: AuditMode;
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
  // Support two formats:
  //   1. chapter_index.json with { chapters: [...] } (wrapped format)
  //   2. chapters/index.json as a plain array (matching StateManager.loadChapterIndex)
  const chapterIndexPath = join(root, "books", bookId, "chapter_index.json");
  const chaptersIndexPath = join(root, "books", bookId, "chapters", "index.json");

  // Try chapter_index.json first (wrapped format)
  const indexRaw = await readFile(chapterIndexPath, "utf-8").catch(() => null);
  if (indexRaw) {
    const index = JSON.parse(indexRaw) as Record<string, unknown>;
    if (index.chapters && Array.isArray(index.chapters)) {
      return (index.chapters as Array<{ number: number; title?: string }>).map((ch) => ({
        number: ch.number,
        title: ch.title ?? `第${ch.number}章`,
      }));
    }
  }

  // Try chapters/index.json (supports both plain array and { chapters: [...] })
  const chIndexRaw = await readFile(chaptersIndexPath, "utf-8").catch(() => null);
  if (chIndexRaw) {
    const parsed = JSON.parse(chIndexRaw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((ch: unknown) => typeof ch === "object" && ch !== null && typeof (ch as Record<string, unknown>).number === "number")
        .map((ch) => ({
          number: (ch as { number: number; title?: string }).number,
          title: (ch as { number: number; title?: string }).title ?? `第${(ch as { number: number }).number}章`,
        }));
    }
    if (parsed && typeof parsed === "object" && "chapters" in (parsed as Record<string, unknown>) && Array.isArray((parsed as Record<string, unknown>).chapters)) {
      return ((parsed as { chapters: Array<{ number: number; title?: string }> }).chapters).map((ch) => ({
        number: ch.number,
        title: ch.title ?? `第${ch.number}章`,
      }));
    }
  }

  // Fallback: read chapter markdown files from the directory
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

// ── 章节内容哈希（缓存验签） ──

async function getChapterContentHash(root: string, bookId: string, chapterNumber: number): Promise<string | null> {
  const chaptersDir = join(root, "books", bookId, "chapters");
  let files: string[];
  try {
    files = await readdir(chaptersDir);
  } catch {
    return null;
  }

  // Find the chapter file matching this chapter number
  const chFile = files.find((f) => {
    const match = f.match(/^(\d{4})_(.+)\.md$/);
    return match && Number.parseInt(match[1], 10) === chapterNumber;
  });

  if (!chFile) return null;

  try {
    const content = await readFile(join(chaptersDir, chFile), "utf-8");
    return createHash("sha256").update(content, "utf-8").digest("hex");
  } catch {
    return null;
  }
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

    // Parse audit mode from query: "rule" (default) or "ai" (deep audit)
    const mode: AuditMode = c.req.query("mode") === "ai" ? "ai" : "rule";

    // Cache check: if same content hash exists and mode matches, return cached result
    const contentHash = await getChapterContentHash(root, bookId, chapterNumber);
    if (!mode || mode === "rule") {
      const existing = await readChapterAudit(root, bookId, chapterNumber);
      if (existing && existing.contentHash && contentHash && existing.contentHash === contentHash && existing.mode === mode) {
        return c.json({ audit: { ...existing, cached: true } });
      }
    }

    // Run audit (mock for now, should use real auditor agent)
    const result = runMockAudit(chapterNumber);
    result.contentHash = contentHash ?? undefined;
    result.mode = mode;

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

    // Parse audit mode from query
    const mode: AuditMode = c.req.query("mode") === "ai" ? "ai" : "rule";

    // Cache check for rule mode
    const contentHash = await getChapterContentHash(root, bookId, chapterNumber);
    if (mode === "rule") {
      const existing = await readChapterAudit(root, bookId, chapterNumber);
      if (existing && existing.contentHash && contentHash && existing.contentHash === contentHash && existing.mode === mode) {
        return c.json({ audit: { ...existing, cached: true } });
      }
    }

    const result = runMockAudit(chapterNumber);
    result.contentHash = contentHash ?? undefined;
    result.mode = mode;
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
      // Cache check for batch audits
      const contentHash = await getChapterContentHash(root, bookId, chapterNumber);
      const existingCache = await readChapterAudit(root, bookId, chapterNumber);
      if (existingCache && existingCache.contentHash && contentHash && existingCache.contentHash === contentHash) {
        results.push({ chapterNumber: existingCache.chapterNumber, status: existingCache.status });
        continue;
      }

      const result = runMockAudit(chapterNumber);
      result.contentHash = contentHash ?? undefined;
      result.mode = "rule";
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

  // POST /:bookId/chapters/:chapterNumber/audit/fix — 一键修复审计问题
  // Returns suggested fixes for the frontend preview dialog.
  // @todo AI integration: replace mock suggestions with real AI-generated fixes
  router.post("/:bookId/chapters/:chapterNumber/audit/fix", async (c) => {
    const bookId = c.req.param("bookId");
    const chapterNumberStr = c.req.param("chapterNumber");
    const chapterNumber = Number.parseInt(chapterNumberStr, 10);

    if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
      throw new ApiError(400, "INVALID_CHAPTER_NUMBER", `Invalid chapter number: ${chapterNumberStr}`);
    }

    // Check if audit result exists
    const existing = await readChapterAudit(root, bookId, chapterNumber);
    if (!existing || existing.issues.length === 0) {
      throw new ApiError(404, "NO_ISSUES", `No audit issues found for chapter ${chapterNumber}. Run audit first.`);
    }

    // 读取章节内容
    const chaptersDir = join(root, "books", bookId, "chapters");
    const padded = String(chapterNumber).padStart(4, "0");
    let files: string[];
    try {
      files = await readdir(chaptersDir);
    } catch {
      throw new ApiError(404, "CHAPTERS_DIR_NOT_FOUND", "章节目录不存在");
    }

    const chapterFile = files.find((f) => f.startsWith(`${padded}_`) && f.endsWith(".md"));
    if (!chapterFile) {
      throw new ApiError(404, "CHAPTER_NOT_FOUND", `Chapter ${chapterNumber} file not found`);
    }

    const originalContent = await readFile(join(chaptersDir, chapterFile), "utf-8");

    // Mock fix: 基于问题生成修复建议
    // @todo AI integration: call AI agent to generate contextual fixes per issue
    const fixSuggestions = existing.issues.map((issue) => {
      return {
        type: issue.type,
        severity: issue.severity,
        description: issue.description,
        location: issue.location,
        suggestion: `修复「${issue.description}」：优化相关段落文本`,
        original: issue.location ? `（${issue.location} 处内容）` : "（全文段落）",
        replacement: `[已修复] ${issue.description} —— 根据审计建议自动修正`,
      };
    });

    return c.json({
      chapterNumber,
      suggestions: fixSuggestions,
      originalContent: originalContent.substring(0, 500), // 预览前500字符
    });
  });

  // POST /:bookId/chapters/:chapterNumber/audit/fix/apply — 应用修复（Issue #412）
  // Applies the fix suggestions approved by the user in the preview dialog.
  // @todo AI integration: replace mock write with real AI-generated content patching
  router.post("/:bookId/chapters/:chapterNumber/audit/fix/apply", async (c) => {
    const bookId = c.req.param("bookId");
    const chapterNumberStr = c.req.param("chapterNumber");
    const chapterNumber = Number.parseInt(chapterNumberStr, 10);

    if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
      throw new ApiError(400, "INVALID_CHAPTER_NUMBER", `Invalid chapter number: ${chapterNumberStr}`);
    }

    // Parse suggestions from request body
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    if (typeof body !== "object" || body === null || !("suggestions" in body)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Request body must contain a 'suggestions' array");
    }

    const raw = body as Record<string, unknown>;
    if (!Array.isArray(raw.suggestions)) {
      throw new ApiError(400, "VALIDATION_ERROR", "'suggestions' must be an array");
    }

    // Validate audit result exists
    const existing = await readChapterAudit(root, bookId, chapterNumber);
    if (!existing) {
      throw new ApiError(404, "AUDIT_NOT_FOUND", `No audit found for chapter ${chapterNumber}. Run audit first.`);
    }

    // Read chapter file to apply fixes
    const chaptersDir = join(root, "books", bookId, "chapters");
    const padded = String(chapterNumber).padStart(4, "0");
    let files: string[];
    try {
      files = await readdir(chaptersDir);
    } catch {
      throw new ApiError(404, "CHAPTERS_DIR_NOT_FOUND", "章节目录不存在");
    }

    const chapterFile = files.find((f) => f.startsWith(`${padded}_`) && f.endsWith(".md"));
    if (!chapterFile) {
      throw new ApiError(404, "CHAPTER_NOT_FOUND", `Chapter ${chapterNumber} file not found`);
    }

    const chapterContent = await readFile(join(chaptersDir, chapterFile), "utf-8");

    // Mock apply: append a fix summary comment to the end of the chapter file
    // @todo AI integration: replace with contextual content patching per suggestion
    const fixSummary = raw.suggestions
      .map((s: { description?: string }, i: number) => `#${i + 1} ${s.description ?? ""}`)
      .join("\n");

    const updatedContent = `${chapterContent}\n\n<!-- 审计修复记录（${new Date().toISOString()}）-->\n${fixSummary}`;

    await writeFile(join(chaptersDir, chapterFile), updatedContent, "utf-8");

    // Mark audit as approved after fix is applied
    const approved: ChapterAuditResult = {
      ...existing,
      status: "approved",
      approvedAt: new Date().toISOString(),
    };
    await writeChapterAudit(root, bookId, approved);

    return c.json({
      chapterNumber,
      message: `已对第 ${chapterNumber} 章应用 ${raw.suggestions.length} 项修复`,
      fixCount: raw.suggestions.length,
    });
  });

  return router;
}
