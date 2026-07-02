// ── Timeline API Route ──
// Uses @actalk/inkos-core Zod schemas for validation.
//
// Routes (mounted at /api/v1/books):
//   GET    /:id/timelines           — List all events (optional ?character=&chapter= filters)
//   GET    /:id/timelines/:eventId  — Get single event
//   POST   /:id/timelines           — Create event
//   PUT    /:id/timelines/:eventId  — Update event
//   DELETE /:id/timelines/:eventId  — Delete event

import { Hono } from "hono";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  TimelineEventSchema,
  CharacterTimelineFileSchema,
  type TimelineEvent,
} from "@actalk/inkos-core";

const TIMELINES_FILE = "story/state/character_timelines.json";

async function loadTimelines(bookDir: string): Promise<{ events: TimelineEvent[]; version: number }> {
  try {
    const raw = await readFile(join(bookDir, TIMELINES_FILE), "utf-8");
    const parsed = JSON.parse(raw);
    const result = CharacterTimelineFileSchema.safeParse(parsed);
    if (result.success) return result.data;
    return { events: [], version: 1 };
  } catch {
    return { events: [], version: 1 };
  }
}

async function saveTimelines(bookDir: string, data: { events: TimelineEvent[]; version: number }): Promise<void> {
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

    // Use TimelineEventSchema but allow missing id (generated server-side)
    const inputResult = TimelineEventSchema.omit({ id: true }).safeParse(body);
    if (!inputResult.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "校验失败",
          details: inputResult.error.flatten(),
        },
      }, 400);
    }

    const data = await loadTimelines(dir);
    const event: TimelineEvent = {
      id: randomUUID(),
      ...inputResult.data,
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

    // Use partial schema for updates
    const inputResult = TimelineEventSchema.partial().safeParse(body);
    if (!inputResult.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "校验失败",
          details: inputResult.error.flatten(),
        },
      }, 400);
    }

    const data = await loadTimelines(dir);
    const idx = data.events.findIndex((e) => e.id === eventId);
    if (idx === -1) {
      return c.json({ error: { code: "NOT_FOUND", message: `时间线事件 ${eventId} 不存在` } }, 404);
    }

    data.events[idx] = {
      ...data.events[idx],
      ...inputResult.data,
      id: eventId, // id is immutable
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
