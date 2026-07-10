// ── Consistency Check API (Issue #93 — AI-3) ──
//
// Routes (mounted at /api/consistency):
//   POST /check — Run consistency check on a chapter

import { Hono } from "hono";
import { checkConsistency } from "@actalk/inkchain-core";
import { loadWorld } from "@actalk/inkchain-core";
import { ApiError } from "../errors.js";

export function createConsistencyRouter(root: string) {
  const router = new Hono();

  // POST /api/consistency/check — run consistency check
  router.post("/check", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const { worldId, chapter, characterProfiles, previousChapters } = body as {
      worldId?: string;
      chapter: { id: string; title: string; text: string; characters: string[] };
      characterProfiles?: Array<{ id: string; name: string; traits: string[]; role: string; description: string }>;
      previousChapters?: Array<{ id: string; title: string; text: string; characters: string[] }>;
    };

    if (!chapter || !chapter.text) {
      throw new ApiError(400, "NO_CHAPTER", "Chapter with text is required");
    }

    // Load world if worldId provided
    let world;
    if (worldId) {
      world = await loadWorld(root, worldId);
      if (!world) {
        throw new ApiError(404, "WORLD_NOT_FOUND", `World not found: ${worldId}`);
      }
    } else {
      const { WorldConfigSchema } = await import("@actalk/inkchain-core");
      world = WorldConfigSchema.parse({
        id: "empty",
        name: "Empty World",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const report = checkConsistency({
      world,
      chapter,
      previousChapters: previousChapters ?? [],
      characterProfiles: characterProfiles ?? [],
    });

    return c.json({ report });
  });

  return router;
}
