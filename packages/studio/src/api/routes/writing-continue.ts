// ── Writing Continue API Route (Issue #103 — P3-2) ──
//
// AI-assisted chapter continuation with World/Relation/Timeline/Foreshadowing context.
//
// Routes:
//   POST /api/v1/writing/continue — Generate continue candidates
//   POST /api/v1/writing/continue/preview — Preview context (no LLM call)
//   POST /api/v1/writing/continue/select — Confirm a selected candidate
//
// Route factory wraps the core writing-continue prompt builders and response
// parsers, adding LLM integration and context loading logic.

import { Hono } from "hono";
import {
  createLLMClient,
  chatCompletion,
  loadProjectConfig,
  loadWorld,
  buildContinueSystemPrompt,
  buildContinueUserPrompt,
  parseContinueResponse,
  checkConflict,
  hasBlockingConflicts,
  DEFAULT_CONTINUE_PARAMS,
  type ContinueWritingParams,
  type FullWritingContext,
  type WorldContext,
  type RelationContext,
  type TimelineContext,
  type ForeshadowingContext,
  type ContinueCandidate,
  type ConflictIssue,
} from "@actalk/inkos-core";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// ── Request body types ──

interface ContinueBody {
  /** Book ID */
  bookId: string;
  /** Current chapter number */
  chapterNumber: number;
  /** Previous chapter content */
  previousChapterContent?: string;
  /** Creativity 1-10 */
  creativity?: number;
  /** Target length in chars */
  length?: number;
  /** Style guidance */
  style?: string;
  /** User direction */
  userDirection?: string;
}

interface ContinueResponse {
  candidates: ContinueCandidate[];
  conflicts: ConflictIssue[];
  context: {
    /** How many world entities loaded */
    worldEntityCount: number;
    /** How many active relations */
    activeRelationCount: number;
    /** How many timeline events */
    timelineEventCount: number;
    /** How many active foreshadowing items */
    activeForeshadowingCount: number;
    /** How many runtime facts */
    runtimeFactCount: number;
  };
  /** Raw AI response (for debugging) */
  raw?: string;
}

// ── Helpers ──

function isNumberInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && !Number.isNaN(v) && v >= min && v <= max && Number.isInteger(v);
}

function parseContinueBody(raw: unknown): { ok: true; data: ContinueBody } | { ok: false; message: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, message: "请求体必须是 JSON 对象" };
  }
  const body = raw as Record<string, unknown>;

  if (typeof body.bookId !== "string" || !body.bookId.trim()) {
    return { ok: false, message: "bookId 是必填字符串" };
  }

  if (!isNumberInRange(body.chapterNumber, 1, 9999)) {
    return { ok: false, message: "chapterNumber 必须是 1-9999 的整数" };
  }

  if (body.creativity !== undefined && !isNumberInRange(body.creativity, 1, 10)) {
    return { ok: false, message: "creativity 必须是 1-10 的整数" };
  }

  if (body.length !== undefined && !isNumberInRange(body.length, 100, 20000)) {
    return { ok: false, message: "length 必须是 100-20000 的整数" };
  }

  if (body.style !== undefined && typeof body.style !== "string") {
    return { ok: false, message: "style 必须是字符串" };
  }

  if (body.userDirection !== undefined && typeof body.userDirection !== "string") {
    return { ok: false, message: "userDirection 必须是字符串" };
  }

  return {
    ok: true,
    data: {
      bookId: String(body.bookId).trim(),
      chapterNumber: Number(body.chapterNumber),
      previousChapterContent: typeof body.previousChapterContent === "string" ? body.previousChapterContent : undefined,
      creativity: typeof body.creativity === "number" ? body.creativity : undefined,
      length: typeof body.length === "number" ? body.length : undefined,
      style: typeof body.style === "string" ? body.style : undefined,
      userDirection: typeof body.userDirection === "string" ? body.userDirection : undefined,
    },
  };
}

// ── Context Loaders ──

async function loadBookChapterContent(root: string, bookId: string, chapterNumber: number): Promise<string> {
  const chaptersDir = join(root, "books", bookId, "chapters");
  const padded = String(chapterNumber).padStart(4, "0");
  try {
    const files = await readdir(chaptersDir);
    const match = files.find((f) => f.startsWith(`${padded}_`) && f.endsWith(".md"));
    if (match) {
      return await readFile(join(chaptersDir, match), "utf-8");
    }
  } catch {
    // chapter not found
  }
  return "";
}

async function loadBookRelations(root: string, bookId: string): Promise<CharacterRelation[]> {
  try {
    const relationsPath = join(root, "books", bookId, "story", "relations.json");
    const raw = await readFile(relationsPath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.relations) ? parsed.relations : Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadBookTimeline(root: string, bookId: string): Promise<TimelineEvent[]> {
  try {
    const timelinePath = join(root, "books", bookId, "story", "timeline.json");
    const raw = await readFile(timelinePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.events) ? parsed.events : Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadBookForeshadowing(root: string, bookId: string): Promise<Foreshadowing[]> {
  try {
    const foreshadowPath = join(root, "books", bookId, "story", "foreshadowing.json");
    const raw = await readFile(foreshadowPath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.foreshadowing) ? parsed.foreshadowing : Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadBookRuntimeFacts(root: string, bookId: string): Promise<CurrentStateFact[]> {
  try {
    const statePath = join(root, "books", bookId, "story", "current_state.json");
    const raw = await readFile(statePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.facts) ? parsed.facts : [];
  } catch {
    return [];
  }
}

async function loadBookChapterSummaries(root: string, bookId: string): Promise<string> {
  try {
    const summaryPath = join(root, "books", bookId, "story", "chapter_summaries.md");
    return await readFile(summaryPath, "utf-8");
  } catch {
    return "";
  }
}

// Note: These type imports are used in the function signatures above.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { CharacterRelation } from "@actalk/inkos-core";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { TimelineEvent } from "@actalk/inkos-core";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Foreshadowing } from "@actalk/inkos-core";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { CurrentStateFact } from "@actalk/inkos-core";

async function buildContinueContext(
  root: string,
  bookId: string,
  chapterNumber: number,
): Promise<{
  context: FullWritingContext;
  stats: { worldEntityCount: number; activeRelationCount: number; timelineEventCount: number; activeForeshadowingCount: number; runtimeFactCount: number };
}> {
  const projectConfig = await loadProjectConfig(root);
  let worldConfig = null;
  try {
    worldConfig = await loadWorld(root, bookId);
  } catch {
    // world not configured
  }

  const relations = await loadBookRelations(root, bookId);
  const activeRelations = relations.filter(
    (r) => r.validFromChapter <= chapterNumber &&
      (r.validUntilChapter === undefined || r.validUntilChapter >= chapterNumber)
  );

  const events = await loadBookTimeline(root, bookId);
  const relevantEvents = events.filter((e) => e.chapter <= chapterNumber);

  const foreshadowing = await loadBookForeshadowing(root, bookId);
  const activeForeshadowing = foreshadowing.filter(
    (f) => f.createdChapter <= chapterNumber && f.status === "active"
  );

  const runtimeFacts = await loadBookRuntimeFacts(root, bookId);
  const chapterSummaries = await loadBookChapterSummaries(root, bookId);

  const world: WorldContext = {
    config: worldConfig,
    referenceDimensions: worldConfig ? ["settings", "roles", "rules"] : [],
  };

  const relation: RelationContext = { relations, activeRelations };
  const timeline: TimelineContext = { events, relevantEvents };
  const foreshadowingCtx: ForeshadowingContext = { foreshadowing, activeForeshadowing };

  const context: FullWritingContext = {
    world,
    relation,
    timeline,
    foreshadowing: foreshadowingCtx,
    currentChapter: chapterNumber,
    chapterSummaries,
    runtimeFacts,
  };

  const stats = {
    worldEntityCount: worldConfig
      ? (worldConfig.settings?.length ?? 0) + (worldConfig.roles?.length ?? 0) + (worldConfig.rules?.length ?? 0)
      : 0,
    activeRelationCount: activeRelations.length,
    timelineEventCount: relevantEvents.length,
    activeForeshadowingCount: activeForeshadowing.length,
    runtimeFactCount: runtimeFacts.length,
  };

  return { context, stats };
}

// ── Route Factory ──

export function createWritingContinueRouter(root: string): Hono {
  const app = new Hono();

  /**
   * POST /api/v1/writing/continue
   * Generate continue candidates with full context.
   */
  app.post("/continue", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = parseContinueBody(raw);
    if (!parsed.ok) {
      return c.json({ error: parsed.message }, 400);
    }

    const { bookId, chapterNumber, previousChapterContent, creativity, length, style, userDirection } = parsed.data;

    // Build context
    const { context, stats } = await buildContinueContext(root, bookId, chapterNumber);

    // Load previous chapter content if not provided
    let prevContent = previousChapterContent ?? "";
    if (!prevContent && chapterNumber > 1) {
      prevContent = await loadBookChapterContent(root, bookId, chapterNumber - 1);
    }

    // Build params
    const params: ContinueWritingParams = {
      creativity: creativity ?? DEFAULT_CONTINUE_PARAMS.creativity,
      length: length ?? DEFAULT_CONTINUE_PARAMS.length,
      style: style ?? DEFAULT_CONTINUE_PARAMS.style,
      previousChapterContent: prevContent,
      userDirection,
    };

    // Build prompts
    const systemPrompt = buildContinueSystemPrompt(context);
    const userPrompt = buildContinueUserPrompt(params, context);

    // Load LLM config and call
    const projectConfig = await loadProjectConfig(root);
    const llmConfig = projectConfig.llm;
    if (!llmConfig) {
      return c.json({ error: "未配置 LLM，请在设置中配置 AI 模型" }, 400);
    }

    const client = createLLMClient(llmConfig);
    const response = await chatCompletion(client, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const rawText = response.content;
    const candidates = parseContinueResponse(rawText, rawText);

    // Run conflict detection
    const allConflicts: ConflictIssue[] = [];
    for (const candidate of candidates) {
      const conflicts = checkConflict(candidate.content, context);
      allConflicts.push(...conflicts);
    }

    const result: ContinueResponse = {
      candidates,
      conflicts: allConflicts,
      context: stats,
      raw: rawText.slice(0, 500), // Keep raw manageable
    };

    return c.json(result);
  });

  /**
   * POST /api/v1/writing/continue/preview
   * Preview context info without LLM call (for debugging).
   */
  app.post("/continue/preview", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = parseContinueBody(raw);
    if (!parsed.ok) {
      return c.json({ error: parsed.message }, 400);
    }

    const { bookId, chapterNumber } = parsed.data;
    const { context, stats } = await buildContinueContext(root, bookId, chapterNumber);

    return c.json({
      context: stats,
      worldName: context.world.config?.name ?? "未配置",
      hasWorld: context.world.config !== null,
      hasRelations: context.relation.activeRelations.length > 0,
      hasTimeline: context.timeline.relevantEvents.length > 0,
      hasForeshadowing: context.foreshadowing.activeForeshadowing.length > 0,
      hasRuntimeFacts: context.runtimeFacts.length > 0,
    });
  });

  return app;
}
