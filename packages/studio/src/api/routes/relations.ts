import { Hono } from "hono";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  CharacterRelationSchema,
  CreateRelationSchema,
  RelationsFileSchema,
  type CharacterRelation,
  type RelationsFile,
} from "@actalk/inkos-core";

// ── Helpers ──

const RELATIONS_FILE = "story/state/relations.json";

async function loadRelations(bookDir: string): Promise<RelationsFile> {
  try {
    const raw = await readFile(join(bookDir, RELATIONS_FILE), "utf-8");
    return RelationsFileSchema.parse(JSON.parse(raw));
  } catch {
    // File doesn't exist or is corrupt — return empty state
    return { schemaVersion: "1", relations: [] };
  }
}

async function saveRelations(bookDir: string, data: RelationsFile): Promise<void> {
  const dir = join(bookDir, "story", "state");
  await mkdir(dir, { recursive: true });
  await writeFile(join(bookDir, RELATIONS_FILE), JSON.stringify(data, null, 2), "utf-8");
}

// ── Route factory ──

export function createRelationsRouter(bookDir: (id: string) => string) {
  const router = new Hono();

  // GET /:id/relations — list all relations, optionally filtered by character
  router.get("/:id/relations", async (c) => {
    const id = c.req.param("id");
    const characterId = c.req.query("character");
    const dir = bookDir(id);

    const data = await loadRelations(dir);
    let relations = data.relations;

    if (characterId) {
      relations = relations.filter(
        (r) => r.sourceRoleId === characterId || r.targetRoleId === characterId,
      );
    }

    return c.json({ relations });
  });

  // POST /:id/relations — create a new relation
  router.post("/:id/relations", async (c) => {
    const id = c.req.param("id");
    const dir = bookDir(id);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    const parsed = CreateRelationSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "校验失败",
          details: parsed.error.flatten(),
        },
      }, 400);
    }

    const now = new Date().toISOString();
    const relation: CharacterRelation = {
      ...parsed.data,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    const data = await loadRelations(dir);
    data.relations.push(relation);
    await saveRelations(dir, data);

    return c.json({ relation }, 201);
  });

  // PUT /:id/relations/:relationId — update a relation
  router.put("/:id/relations/:relationId", async (c) => {
    const id = c.req.param("id");
    const relationId = c.req.param("relationId");
    const dir = bookDir(id);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    // Validate body as a partial relation
    const parsed = CharacterRelationSchema.partial().safeParse(body);
    if (!parsed.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "校验失败",
          details: parsed.error.flatten(),
        },
      }, 400);
    }

    const data = await loadRelations(dir);
    const idx = data.relations.findIndex((r) => r.id === relationId);
    if (idx === -1) {
      return c.json({ error: { code: "NOT_FOUND", message: `关系 ${relationId} 不存在` } }, 404);
    }

    data.relations[idx] = {
      ...data.relations[idx],
      ...parsed.data,
      id: relationId, // id is immutable
      updatedAt: new Date().toISOString(),
    };
    await saveRelations(dir, data);

    return c.json({ relation: data.relations[idx] });
  });

  // DELETE /:id/relations/:relationId — delete a relation
  router.delete("/:id/relations/:relationId", async (c) => {
    const id = c.req.param("id");
    const relationId = c.req.param("relationId");
    const dir = bookDir(id);

    const data = await loadRelations(dir);
    const idx = data.relations.findIndex((r) => r.id === relationId);
    if (idx === -1) {
      return c.json({ error: { code: "NOT_FOUND", message: `关系 ${relationId} 不存在` } }, 404);
    }

    data.relations.splice(idx, 1);
    await saveRelations(dir, data);

    return c.json({ deleted: true });
  });

  return router;
}
