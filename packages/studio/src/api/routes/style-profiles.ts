// ── Style Profiles API (Issue #92 — AI-2) ──
//
// Routes (mounted at /api/style-profiles):
//   GET    /              — List saved style profiles
//   GET    /:id           — Get a style profile
//   POST   /              — Create/save a style profile
//   DELETE /:id           — Delete a style profile
//   POST   /:id/analyze   — Auto-analyze text into a style profile

import { Hono } from "hono";
import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { learnStyle, summarizeStyleProfile, serializeStyleProfile, type EnhancedStyleProfile } from "@actalk/inkchain-core";
import { ApiError } from "../errors.js";
import { DATA_DIR_NAME } from "../../constants/data-directory.js";

const PROFILES_DIR = `${DATA_DIR_NAME}/style-profiles`;

function profilesDir(root: string): string {
  return join(root, PROFILES_DIR);
}

function profilePath(root: string, id: string): string {
  return join(profilesDir(root), `${id}.json`);
}

async function listProfiles(root: string): Promise<string[]> {
  const dir = profilesDir(root);
  try {
    const entries = await readdir(dir);
    return entries.filter((e) => e.endsWith(".json")).map((e) => e.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

async function loadProfile(root: string, id: string): Promise<EnhancedStyleProfile | null> {
  try {
    const raw = await readFile(profilePath(root, id), "utf-8");
    return JSON.parse(raw) as EnhancedStyleProfile;
  } catch {
    return null;
  }
}

async function saveProfile(root: string, id: string, profile: EnhancedStyleProfile): Promise<void> {
  await mkdir(profilesDir(root), { recursive: true });
  await writeFile(profilePath(root, id), JSON.stringify(profile, null, 2), "utf-8");
}

export function createStyleProfilesRouter(root: string) {
  const router = new Hono();

  // GET /api/style-profiles — list profiles
  router.get("/", async (c) => {
    const ids = await listProfiles(root);
    const profiles: EnhancedStyleProfile[] = [];
    for (const id of ids) {
      const p = await loadProfile(root, id);
      if (p) profiles.push(p);
    }
    return c.json({ profiles });
  });

  // GET /api/style-profiles/:id — get a profile
  router.get("/:id", async (c) => {
    const id = c.req.param("id");
    const profile = await loadProfile(root, id);
    if (!profile) {
      throw new ApiError(404, "PROFILE_NOT_FOUND", `Style profile not found: ${id}`);
    }
    return c.json({ profile });
  });

  // POST /api/style-profiles — save a profile
  router.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const { id, texts, language, config } = body as {
      id?: string;
      texts: string[];
      language?: "zh" | "en";
      config?: Record<string, unknown>;
    };

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      throw new ApiError(400, "NO_TEXT", "At least one text sample is required");
    }

    const profileId = id ?? `profile-${Date.now()}`;
    const lang = language ?? "zh";

    const profile = learnStyle(texts, lang, {
      sampleSize: texts.length,
      includeDialogue: true,
      includeTone: true,
    });

    const serialized = serializeStyleProfile(profile);
    const summary = summarizeStyleProfile(profile);

    await saveProfile(root, profileId, { ...serialized, autoAnalyzed: true, language: lang } as EnhancedStyleProfile);

    return c.json({
      profile: { ...serialized, id: profileId, autoAnalyzed: true, language: lang },
      summary,
    }, 201);
  });

  // POST /api/style-profiles/:id/analyze — analyze text without saving
  router.post("/:id/analyze", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const { texts, language } = body as { texts: string[]; language?: "zh" | "en" };

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      throw new ApiError(400, "NO_TEXT", "At least one text sample is required");
    }

    const profile = learnStyle(texts, language ?? "zh");
    const constraints = profileToConstraints(profile);

    return c.json({
      profile: {
        ...profile,
        id: c.req.param("id"),
      },
      constraints,
      summary: summarizeStyleProfile(profile),
    });
  });

  // DELETE /api/style-profiles/:id — delete a profile
  router.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const path = profilePath(root, id);
    if (!existsSync(path)) {
      throw new ApiError(404, "PROFILE_NOT_FOUND", `Style profile not found: ${id}`);
    }
    await rm(path, { force: true });
    return c.json({ ok: true, id });
  });

  return router;
}

// Re-export for convenience
function profileToConstraints(profile: EnhancedStyleProfile) {
  const { formatStyleConstraintsSection } = require("@actalk/inkchain-core");
  return formatStyleConstraintsSection(
    (require("@actalk/inkchain-core") as any).profileToConstraints?.(profile) ?? [],
    profile.language ?? "zh",
  );
}
