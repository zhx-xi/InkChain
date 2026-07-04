// ── World CRUD API (Issue #77 — World-1 + Wrld-5) ──
//
// Manages open-world configurations stored as JSON files under
// `.inkos/worlds/<id>.json`.
//
// Routes (mounted at /api/worlds):
//   GET    /              — List worlds
//   GET    /:id           — Get world details (all 7 dimensions)
//   POST   /              — Create a world
//   PUT    /:id           — Update a world
//   DELETE /:id           — Delete a world
//   GET    /:id/search    — Search within a world (Wrld-5)
//   POST   /:id/references   — Add a cross-entity reference (Wrld-5)
//   DELETE /:id/references/:refId — Remove a reference (Wrld-5)

import { Hono } from "hono";
import {
  applyWorldUpdate,
  createWorld,
  deleteWorld,
  listWorlds,
  loadWorld,
  saveWorld,
  WorldConfigSchema,
  WorldConfigUpdateSchema,
  searchWorlds,
  deleteEntityWithRefCheck,
  addWorldReference,
  removeWorldReference,
  WorldReferenceCreateSchema,
  type WorldConfig,
} from "@actalk/inkos-core";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { ApiError } from "../errors.js";
import { isSafeBookId } from "../safety.js";

function validateWorldId(id: string): string {
  if (!/^[a-z0-9_-]+$/i.test(id)) {
    throw new ApiError(400, "INVALID_WORLD_ID", `Invalid world id: ${id}`);
  }
  return id;
}

export function createWorldsRouter(root: string) {
  const router = new Hono();

  // GET /api/worlds — list all worlds
  router.get("/", async (c) => {
    const worlds = await listWorlds(root);
    return c.json({ worlds });
  });

  // GET /api/worlds/:id — get a single world
  router.get("/:id", async (c) => {
    const id = validateWorldId(c.req.param("id"));
    const world = await loadWorld(root, id);
    if (!world) {
      throw new ApiError(404, "WORLD_NOT_FOUND", `World not found: ${id}`);
    }
    return c.json({ world });
  });

  // POST /api/worlds — create a new world
  router.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const parsed = WorldConfigSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "World validation failed",
          details: parsed.error.flatten(),
        },
      }, 400);
    }

    const existing = await loadWorld(root, parsed.data.id);
    if (existing) {
      throw new ApiError(409, "WORLD_ALREADY_EXISTS", `World already exists: ${parsed.data.id}`);
    }

    await saveWorld(root, parsed.data);
    return c.json({ world: parsed.data }, 201);
  });

  // PUT /api/worlds/:id — update a world
  router.put("/:id", async (c) => {
    const id = validateWorldId(c.req.param("id"));

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const parsed = WorldConfigUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "World update validation failed",
          details: parsed.error.flatten(),
        },
      }, 400);
    }

    const existing = await loadWorld(root, id);
    if (!existing) {
      throw new ApiError(404, "WORLD_NOT_FOUND", `World not found: ${id}`);
    }

    const updated = applyWorldUpdate(existing, parsed.data);
    await saveWorld(root, updated);
    return c.json({ world: updated });
  });

  // DELETE /api/worlds/:id — delete a world
  router.delete("/:id", async (c) => {
    const id = validateWorldId(c.req.param("id"));
    const deleted = await deleteWorld(root, id);
    if (!deleted) {
      throw new ApiError(404, "WORLD_NOT_FOUND", `World not found: ${id}`);
    }
    return c.json({ ok: true, id });
  });

  // ── Wrld-5: Search ──

  // GET /api/worlds/:id/search?q=xxx&dimension=xxx — search within a world
  router.get("/:id/search", async (c) => {
    const id = validateWorldId(c.req.param("id"));
    const q = c.req.query("q") ?? "";
    const dimension = c.req.query("dimension");

    const world = await loadWorld(root, id);
    if (!world) {
      throw new ApiError(404, "WORLD_NOT_FOUND", `World not found: ${id}`);
    }

    const results = searchWorlds(world, q, dimension);
    return c.json({ results });
  });

  // ── Wrld-5: References ──

  // POST /api/worlds/:id/references — add a reference
  router.post("/:id/references", async (c) => {
    const id = validateWorldId(c.req.param("id"));

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const parsed = WorldReferenceCreateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Reference validation failed",
          details: parsed.error.flatten(),
        },
      }, 400);
    }

    const world = await loadWorld(root, id);
    if (!world) {
      throw new ApiError(404, "WORLD_NOT_FOUND", `World not found: ${id}`);
    }

    const updated = addWorldReference(world, parsed.data);
    await saveWorld(root, updated);
    return c.json({ world: updated }, 201);
  });

  // DELETE /api/worlds/:id/references/:refId — remove a reference
  router.delete("/:id/references/:refId", async (c) => {
    const id = validateWorldId(c.req.param("id"));
    const refId = c.req.param("refId");

    const world = await loadWorld(root, id);
    if (!world) {
      throw new ApiError(404, "WORLD_NOT_FOUND", `World not found: ${id}`);
    }

    const updated = removeWorldReference(world, refId);
    await saveWorld(root, updated);
    return c.json({ world: updated });
  });

  // ── P3-3: World Inheritance ──
  // POST /:id/inherit — copy world settings into a new world.
  router.post("/:id/inherit", async (c) => {
    const id = c.req.param("id");
    const root = c.var.root as string;
    const body = (await c.req.json().catch(() => ({}))) as { newId?: string; newTitle?: string };

    const world = await loadWorld(root, id);
    if (!world) throw new ApiError(404, "WORLD_NOT_FOUND", `World not found: ${id}`);

    const newId = body.newId ?? `${id}-derived-${Date.now().toString(36)}`;
    const newWorld = {
      ...world,
      id: newId,
      title: body.newTitle ?? `${world.title} (继承)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: world.history ? [...world.history] : [],
    };

    await saveWorld(root, newWorld);
    return c.json({ world: newWorld, message: `已从「${world.title}」继承创建新世界观` });
  });

  return router;
}

// ── Book-level World View (Issue #195) ──
//
// GET /api/books/:bookId/worlds -- list worlds associated with a book.
// Reads the book's worldId field and returns matching worlds.

export function createBookWorldsRouter(root: string) {
  const router = new Hono();

  router.get("/:bookId/worlds", async (c) => {
    const rawBookId = c.req.param("bookId");
    let bookId: string;
    try {
      bookId = decodeURIComponent(rawBookId);
    } catch {
      throw new ApiError(400, "INVALID_BOOK_ID", `Invalid book id: ${rawBookId}`);
    }
    if (!isSafeBookId(bookId)) {
      throw new ApiError(400, "INVALID_BOOK_ID", `Invalid book id: ${rawBookId}`);
    }

    const bookDir = join(root, "books", bookId);
    let bookRaw: string;
    try {
      bookRaw = await readFile(join(bookDir, "book.json"), "utf-8");
    } catch {
      throw new ApiError(404, "BOOK_NOT_FOUND", `Book not found: ${bookId}`);
    }

    const book = JSON.parse(bookRaw) as Record<string, unknown>;

    // Support both worldId (single) and worldIds (multiple)
    const ids: string[] = [];
    if (typeof book.worldId === "string" && book.worldId) {
      ids.push(book.worldId);
    }
    if (Array.isArray(book.worldIds)) {
      ids.push(...book.worldIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0));
    }

    if (ids.length === 0) {
      return c.json({ worlds: [] });
    }

    const uniqueIds = [...new Set(ids)];
    const worlds: WorldConfig[] = [];
    for (const id of uniqueIds) {
      const world = await loadWorld(root, id);
      if (world) worlds.push(world);
    }
    return c.json({ worlds });
  });

  // POST /:bookId/worlds-associate — Associate a world with a book
  router.post("/:bookId/worlds-associate", async (c) => {
    const rawBookId = c.req.param("bookId");
    let bookId: string;
    try {
      bookId = decodeURIComponent(rawBookId);
    } catch {
      throw new ApiError(400, "INVALID_BOOK_ID", `Invalid book id: ${rawBookId}`);
    }
    if (!isSafeBookId(bookId)) {
      throw new ApiError(400, "INVALID_BOOK_ID", `Invalid book id: ${rawBookId}`);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }
    const { worldId } = body as Record<string, unknown>;
    if (typeof worldId !== "string" || !worldId) {
      throw new ApiError(400, "INVALID_WORLD_ID", "worldId is required");
    }

    const { readFile, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const bookDir = join(root, "books", bookId);
    const bookPath = join(bookDir, "book.json");

    let bookRaw: string;
    try {
      bookRaw = await readFile(bookPath, "utf-8");
    } catch {
      throw new ApiError(404, "BOOK_NOT_FOUND", `Book not found: ${bookId}`);
    }

    const book = JSON.parse(bookRaw) as Record<string, unknown>;
    const worldIds: string[] = [];
    if (typeof book.worldId === "string" && book.worldId) worldIds.push(book.worldId);
    if (Array.isArray(book.worldIds)) worldIds.push(...book.worldIds.filter((id: unknown): id is string => typeof id === "string"));
    if (!worldIds.includes(worldId)) worldIds.push(worldId);

    book.worldIds = worldIds;
    await writeFile(bookPath, JSON.stringify(book, null, 2), "utf-8");
    return c.json({ ok: true, worldIds });
  });

  return router;
}
