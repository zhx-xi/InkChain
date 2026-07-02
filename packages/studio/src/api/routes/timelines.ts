import { Hono } from "hono";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// ── Inline type definitions ──
// Schema validation is handled by @actalk/inkos-core CharacterTimelineFileSchema after the schema is promoted.
// For now, use simple runtime type checks.

interface TimelineEvent {
  id: string;
  timestamp: string;
  eventType: string;
  title: string;
  description: string;
  relatedCharacters: string[];
  chapter: number;
  importance: number;
  tags?: string[];
}

const VALID_EVENT_TYPES = ["plot", "character", "world"];

function isString(s: unknown): s is string {
  return typeof s === "string";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseTimelineEvent(raw: unknown): TimelineEvent | null {
  if (!isRecord(raw)) return null;

  const { id, timestamp, eventType, title, description, relatedCharacters, chapter, importance, tags } = raw;

  if (
    !isString(id) ||
    !isString(timestamp) ||
    !isString(eventType) ||
    !isString(title) ||
    typeof chapter !== "number" ||
    typeof importance !== "number"
  ) {
    return null;
  }

  const parsed: TimelineEvent = {
    id,
    timestamp,
    eventType,
    title,
    description: isString(description) ? description : "",
    relatedCharacters: Array.isArray(relatedCharacters)
      ? relatedCharacters.filter(isString)
      : [],
    chapter: Math.max(0, Math.floor(chapter)),
    importance: Math.max(1, Math.min(5, Math.floor(importance))),
  };

  if (Array.isArray(tags)) {
    const strTags = tags.filter(isString);
    if (strTags.length > 0) {
      parsed.tags = strTags;
    }
  }

  return parsed;
}

function parseTimelineEvents(raw: unknown): TimelineEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: TimelineEvent[] = [];
  for (const item of raw) {
    const parsed = parseTimelineEvent(item);
    if (parsed) events.push(parsed);
  }
  return events;
}

interface TimelineEventInput {
  timestamp: string;
  eventType: string;
  title: string;
  description?: string;
  relatedCharacters?: string[];
  chapter: number;
  importance: number;
  tags?: string[];
}

function parseTimelineEventInput(body: Record<string, unknown>): TimelineEventInput | null {
  const { timestamp, eventType, title, description, relatedCharacters, chapter, importance, tags } = body;

  if (!isString(timestamp) || !isString(eventType) || !isString(title)) {
    return null;
  }

  if (typeof chapter !== "number" || typeof importance !== "number") {
    return null;
  }

  const result: TimelineEventInput = {
    timestamp,
    eventType,
    title,
    description: isString(description) ? description : undefined,
    relatedCharacters: Array.isArray(relatedCharacters)
      ? relatedCharacters.filter(isString)
      : undefined,
    chapter: Math.max(0, Math.floor(chapter)),
    importance: Math.max(1, Math.min(5, Math.floor(importance))),
  };

  if (Array.isArray(tags)) {
    const strTags = tags.filter(isString);
    if (strTags.length > 0) {
      result.tags = strTags;
    }
  }

  return result;
}

interface PartialTimelineEventInput {
  timestamp?: string;
  eventType?: string;
  title?: string;
  description?: string;
  relatedCharacters?: string[];
  chapter?: number;
  importance?: number;
  tags?: string[];
}

function parsePartialTimelineEventInput(body: Record<string, unknown>): PartialTimelineEventInput | null {
  const { timestamp, eventType, title, description, relatedCharacters, chapter, importance, tags } = body;

  // At least one field must be provided
  if (
    timestamp === undefined &&
    eventType === undefined &&
    title === undefined &&
    description === undefined &&
    relatedCharacters === undefined &&
    chapter === undefined &&
    importance === undefined &&
    tags === undefined
  ) {
    return null;
  }

  if (timestamp !== undefined && !isString(timestamp)) return null;
  if (eventType !== undefined && !isString(eventType)) return null;
  if (title !== undefined && !isString(title)) return null;
  if (description !== undefined && !isString(description)) return null;
  if (relatedCharacters !== undefined && (!Array.isArray(relatedCharacters) || !relatedCharacters.every(isString))) return null;
  if (chapter !== undefined && typeof chapter !== "number") return null;
  if (importance !== undefined && typeof importance !== "number") return null;
  if (tags !== undefined && (!Array.isArray(tags) || !tags.every(isString))) return null;

  return {
    timestamp: isString(timestamp) ? timestamp : undefined,
    eventType: isString(eventType) ? eventType : undefined,
    title: isString(title) ? title : undefined,
    description: isString(description) ? description : undefined,
    relatedCharacters: Array.isArray(relatedCharacters) ? relatedCharacters.filter(isString) : undefined,
    chapter: typeof chapter === "number" ? Math.max(0, Math.floor(chapter)) : undefined,
    importance: typeof importance === "number" ? Math.max(1, Math.min(5, Math.floor(importance))) : undefined,
    tags: Array.isArray(tags) ? tags.filter(isString) : undefined,
  };
}

interface CharacterTimelineFile {
  events: TimelineEvent[];
  version: number;
}

const TIMELINES_FILE = "story/state/character_timelines.json";

async function loadTimelines(bookDir: string): Promise<CharacterTimelineFile> {
  try {
    const raw = await readFile(join(bookDir, TIMELINES_FILE), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const events = parseTimelineEvents(parsed.events);
    const version = isRecord(parsed) && typeof parsed.version === "number" ? parsed.version : 1;
    return { events, version };
  } catch {
    return { events: [], version: 1 };
  }
}

async function saveTimelines(bookDir: string, data: CharacterTimelineFile): Promise<void> {
  const dir = join(bookDir, "story", "state");
  await mkdir(dir, { recursive: true });
  await writeFile(join(bookDir, TIMELINES_FILE), JSON.stringify(data, null, 2), "utf-8");
}

// ── Route factory ──

export function createTimelinesRouter(bookDir: (id: string) => string) {
  const router = new Hono();

  // GET /:id/timelines — list all timeline events, with optional filtering
  router.get("/:id/timelines", async (c) => {
    const id = c.req.param("id");
    const dir = bookDir(id);
    const data = await loadTimelines(dir);

    let events = data.events;

    // Filter by character
    const characterFilter = c.req.query("character");
    if (characterFilter) {
      events = events.filter((e) =>
        e.relatedCharacters.some((ch) => ch.toLowerCase().includes(characterFilter.toLowerCase())),
      );
    }

    // Filter by chapter
    const chapterFilter = c.req.query("chapter");
    if (chapterFilter) {
      const chapterNum = parseInt(chapterFilter, 10);
      if (!isNaN(chapterNum)) {
        events = events.filter((e) => e.chapter === chapterNum);
      }
    }

    return c.json({ events });
  });

  // GET /:id/timelines/:eventId — get a single event
  router.get("/:id/timelines/:eventId", async (c) => {
    const id = c.req.param("id");
    const eventId = c.req.param("eventId");
    const dir = bookDir(id);

    const data = await loadTimelines(dir);
    const event = data.events.find((e) => e.id === eventId);
    if (!event) {
      return c.json({ error: { code: "NOT_FOUND", message: `时间线事件 ${eventId} 不存在` } }, 404);
    }

    return c.json({ event });
  });

  // POST /:id/timelines — create a new timeline event
  router.post("/:id/timelines", async (c) => {
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

    const input = parseTimelineEventInput(body);
    if (!input) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "校验失败：timestamp、eventType、title、chapter、importance 均为必填字段" } }, 400);
    }

    const now = new Date().toISOString();
    const data = await loadTimelines(dir);

    const event: TimelineEvent = {
      id: randomUUID(),
      timestamp: input.timestamp,
      eventType: input.eventType,
      title: input.title,
      description: input.description ?? "",
      relatedCharacters: input.relatedCharacters ?? [],
      chapter: input.chapter,
      importance: input.importance,
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
    };

    data.events.push(event);
    await saveTimelines(dir, data);
    return c.json({ event }, 201);
  });

  // PUT /:id/timelines/:eventId — update a timeline event
  router.put("/:id/timelines/:eventId", async (c) => {
    const id = c.req.param("id");
    const eventId = c.req.param("eventId");
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

    const input = parsePartialTimelineEventInput(body);
    if (!input) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "校验失败" } }, 400);
    }

    const data = await loadTimelines(dir);
    const idx = data.events.findIndex((e) => e.id === eventId);
    if (idx === -1) {
      return c.json({ error: { code: "NOT_FOUND", message: `时间线事件 ${eventId} 不存在` } }, 404);
    }

    const existing = data.events[idx];
    data.events[idx] = {
      id: eventId,
      timestamp: input.timestamp ?? existing.timestamp,
      eventType: input.eventType ?? existing.eventType,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      relatedCharacters: input.relatedCharacters ?? existing.relatedCharacters,
      chapter: input.chapter ?? existing.chapter,
      importance: input.importance ?? existing.importance,
      ...(input.tags !== undefined ? { tags: input.tags } : existing.tags !== undefined ? { tags: existing.tags } : {}),
    };

    await saveTimelines(dir, data);
    return c.json({ event: data.events[idx] });
  });

  // DELETE /:id/timelines/:eventId — delete a timeline event
  router.delete("/:id/timelines/:eventId", async (c) => {
    const id = c.req.param("id");
    const eventId = c.req.param("eventId");
    const dir = bookDir(id);

    const data = await loadTimelines(dir);
    const idx = data.events.findIndex((e) => e.id === eventId);
    if (idx === -1) {
      return c.json({ error: { code: "NOT_FOUND", message: `时间线事件 ${eventId} 不存在` } }, 404);
    }

    data.events.splice(idx, 1);
    await saveTimelines(dir, data);
    return c.json({ deleted: true });
  });

  return router;
}
