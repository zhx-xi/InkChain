// ── Foreshadowing CRUD API (Issue #84 — E2-1) ──
//
// Routes (mounted at /api/foreshadowing):
//   GET    /              — List all foreshadowing (with optional ?status= / ?type= filters)
//   GET    /forgotten     — List forgotten entries (with optional ?threshold=N)
//   GET    /:id           — Get a single foreshadowing entry
//   POST   /              — Create a new foreshadowing entry
//   PUT    /:id           — Update a foreshadowing entry
//   DELETE /:id           — Delete a foreshadowing entry
//   POST   /:id/payoff    — Mark a foreshadowing as paid off at a given chapter

import { Hono } from "hono";
import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  ForeshadowingSchema,
  ForeshadowingCreateSchema,
  ForeshadowingUpdateSchema,
  ForeshadowingTypeEnum,
  ForeshadowingStatusEnum,
  findForgottenForeshadowing,
  type Foreshadowing,
} from "@actalk/inkchain-core";
import { ApiError } from "../errors.js";

const FS_DIR = ".inkos/foreshadowing";

function entryPath(root: string, id: string): string {
  return join(root, FS_DIR, `${id}.json`);
}

async function readEntry(root: string, id: string): Promise<Foreshadowing | null> {
  try {
    const raw = await readFile(entryPath(root, id), "utf-8");
    return ForeshadowingSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (
      typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { code?: unknown }).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

async function writeEntry(root: string, entry: Foreshadowing): Promise<void> {
  const dir = join(root, FS_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(entryPath(root, entry.id), JSON.stringify(entry, null, 2), "utf-8");
}

async function listEntries(root: string): Promise<Foreshadowing[]> {
  const dir = join(root, FS_DIR);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const entries: Foreshadowing[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(dir, file), "utf-8");
      const entry = ForeshadowingSchema.parse(JSON.parse(raw));
      entries.push(entry);
    } catch {
      // Skip malformed entries
      continue;
    }
  }
  return entries.sort((a, b) => a.createdChapter - b.createdChapter);
}

export function createForeshadowingRouter(root: string) {
  const router = new Hono();

  // GET /api/foreshadowing — list all entries with optional filters
  router.get("/", async (c) => {
    const entries = await listEntries(root);
    const bookId = c.req.query("bookId") as string | undefined;
    const status = c.req.query("status") as string | undefined;
    const type = c.req.query("type") as string | undefined;
    const currentChapterStr = c.req.query("currentChapter") as string | undefined;
    const forgetThresholdStr = c.req.query("forgetThreshold") as string | undefined;

    let filtered = entries;
    if (bookId) {
      filtered = filtered.filter((e) => e.bookId === bookId);
    }
    if (status && ForeshadowingStatusEnum.safeParse(status).success) {
      filtered = filtered.filter((e) => e.status === status);
    }
    if (type && ForeshadowingTypeEnum.safeParse(type).success) {
      filtered = filtered.filter((e) => e.type === type);
    }

    const currentChapter = currentChapterStr ? Number(currentChapterStr) : undefined;
    const forgetThreshold = forgetThresholdStr ? Number(forgetThresholdStr) : undefined;

    const forgotten = currentChapter
      ? new Set(
          findForgottenForeshadowing(
            filtered,
            currentChapter,
            forgetThreshold ?? 10,
          ).map((f) => f.foreshadowingId),
        )
      : new Set<string>();

    return c.json({
      foreshadowing: filtered.map((e) => ({
        ...e,
        _forgotten: forgotten.has(e.id),
      })),
      total: filtered.length,
      currentChapter: currentChapter ?? null,
    });
  });

  // GET /api/foreshadowing/forgotten — list forgotten entries
  router.get("/forgotten", async (c) => {
    const entries = await listEntries(root);
    const bookId = c.req.query("bookId") as string | undefined;
    const currentChapter = Number(c.req.query("currentChapter") ?? "0");
    const threshold = Number(c.req.query("threshold") ?? "10");
    return c.json({ forgotten: findForgottenForeshadowing(entries, currentChapter, threshold) });
  });

  // GET /api/foreshadowing/:id — single entry
  router.get("/:id", async (c) => {
    const id = c.req.param("id");
    const entry = await readEntry(root, id);
    if (!entry) {
      throw new ApiError(404, "FORESHADOWING_NOT_FOUND", `Foreshadowing not found: ${id}`);
    }
    return c.json({ foreshadowing: entry });
  });

  // POST /api/foreshadowing — create
  router.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    // Support both full and minimal create
    const parsed = ForeshadowingCreateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Foreshadowing validation failed",
          details: parsed.error.flatten(),
        },
      }, 400);
    }

    const existing = await readEntry(root, parsed.data.id);
    if (existing) {
      throw new ApiError(409, "FORESHADOWING_ALREADY_EXISTS", `Foreshadowing already exists: ${parsed.data.id}`);
    }

    await writeEntry(root, parsed.data);
    return c.json({ foreshadowing: parsed.data }, 201);
  });

  // PUT /api/foreshadowing/:id — update
  router.put("/:id", async (c) => {
    const id = c.req.param("id");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const parsed = ForeshadowingUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Foreshadowing update validation failed",
          details: parsed.error.flatten(),
        },
      }, 400);
    }

    const existing = await readEntry(root, id);
    if (!existing) {
      throw new ApiError(404, "FORESHADOWING_NOT_FOUND", `Foreshadowing not found: ${id}`);
    }

    const updated: Foreshadowing = { ...existing, ...parsed.data, id };
    await writeEntry(root, updated);
    return c.json({ foreshadowing: updated });
  });

  // DELETE /api/foreshadowing/:id — delete
  router.delete("/:id", async (c) => {
    const id = c.req.param("id");
    try {
      await rm(entryPath(root, id), { force: true });
    } catch {
      // ignore
    }
    return c.json({ ok: true, id });
  });

  // POST /api/foreshadowing/:id/payoff — mark paid off
  router.post("/:id/payoff", async (c) => {
    const id = c.req.param("id");
    let body: { payoffChapter?: number } = {};
    try {
      body = await c.req.json();
    } catch {
      // Default to 0
    }

    const existing = await readEntry(root, id);
    if (!existing) {
      throw new ApiError(404, "FORESHADOWING_NOT_FOUND", `Foreshadowing not found: ${id}`);
    }

    const updated: Foreshadowing = {
      ...existing,
      status: "paid_off",
      payoffChapter: body.payoffChapter ?? existing.lastMentionedChapter,
    };
    await writeEntry(root, updated);
    return c.json({ foreshadowing: updated });
  });

  return router;
}
