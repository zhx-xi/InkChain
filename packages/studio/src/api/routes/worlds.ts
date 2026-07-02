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
import { ApiError } from "../errors.js";

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

  return router;
}
