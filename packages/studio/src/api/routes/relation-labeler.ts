// ── AI Relation Labeling Route (Issue #99 — R-15) ──
// Provides rule-based AI relation type suggestions from character profiles.
//
// Routes:
//   POST /:id/suggest-relations              — Get relation suggestions for character pairs
//   POST /:id/suggest-relations/accept        — Accept a suggestion → create relation
//   POST /:id/suggest-relations/dismiss       — Dismiss a suggestion

import { Hono } from "hono";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  suggestRelations,
  toExistingRelationType,
  SUGGESTED_RELATION_LABELS,
  CharacterRelationSchema,
  RelationsFileSchema,
  RelationType,
  type RelationSuggestion,
  type CharacterProfileForLabeling,
  type CharacterRelation,
  type RelationsFile,
} from "@inkchain/inkchain-core";

// ── Constants ──

const RELATIONS_FILE = "story/state/relations.json";
const ROLES_DIR = "roles";

// ── Helpers ──

async function loadRelations(bookDir: string): Promise<RelationsFile> {
  try {
    const raw = await readFile(join(bookDir, RELATIONS_FILE), "utf-8");
    return RelationsFileSchema.parse(JSON.parse(raw));
  } catch {
    return { schemaVersion: "1", relations: [] };
  }
}

async function saveRelations(bookDir: string, data: RelationsFile): Promise<void> {
  const dir = join(bookDir, "story", "state");
  await mkdir(dir, { recursive: true });
  await writeFile(join(bookDir, RELATIONS_FILE), JSON.stringify(data, null, 2), "utf-8");
}

/** Load character profiles for relation labeling */
async function loadCharactersForLabeling(bookDir: string): Promise<CharacterProfileForLabeling[]> {
  const characters: CharacterProfileForLabeling[] = [];

  // Scan roles directory for character files
  const { readdir, readFile: fsReadFile } = await import("node:fs/promises");
  const roleBase = join(bookDir, ROLES_DIR);

  let files: string[];
  try {
    files = await readdir(roleBase, { recursive: true });
  } catch {
    return [];
  }

  // Filter for markdown files (character cards)
  const mdFiles = files.filter((f) => f.endsWith(".md")).slice(0, 50); // limit to 50 chars

  for (const file of mdFiles) {
    try {
      const content = await fsReadFile(join(roleBase, file), "utf-8");
      const lines = content.split("\n");

      // Parse name from frontmatter or first heading
      const nameLine = lines.find((l) => l.startsWith("# ") || l.startsWith("## "));
      const name = nameLine ? nameLine.replace(/^#+ /, "").trim() : file.replace(/\.md$/, "");

      // Extract description (first paragraph after frontmatter / heading)
      const descLines: string[] = [];
      let inFrontmatter = lines[0]?.startsWith("---") ?? false;
      let inDescription = false;
      for (const line of lines) {
        if (line.startsWith("---")) {
          if (inFrontmatter) { inFrontmatter = false; continue; }
          inFrontmatter = true; continue;
        }
        if (inFrontmatter) continue;
        if (line.startsWith("#") && !inDescription) { inDescription = true; continue; }
        if (inDescription && line.trim().length > 0) {
          descLines.push(line.trim());
          if (descLines.length >= 5) break;
        }
      }

      // Extract dialogue snippets (lines with quotes)
      const dialogues = lines
        .filter((l) => l.includes("“") || l.includes("「") || l.includes("\""))
        .slice(0, 10);

      const id = file.replace(/\.md$/, "").replace(/[/\\]/g, "-");

      characters.push({
        id,
        name,
        description: descLines.join("\n"),
        dialogues,
      });
    } catch {
      // Skip files that can't be read
    }
  }

  return characters;
}

// ── Route factory ──

export function createRelationLabelerRouter(
  bookDir: (id: string) => string,
): Hono {
  const router = new Hono();

  // ── POST /:id/suggest-relations — Get relation suggestions ──

  router.post("/:id/suggest-relations", async (c) => {
    const id = c.req.param("id");
    const dir = bookDir(id);

    // Load existing relations to avoid re-suggesting
    const relationsFile = await loadRelations(dir);

    // Load character profiles
    const characters = await loadCharactersForLabeling(dir);

    if (characters.length < 2) {
      return c.json({
        suggestions: [],
        message: "至少需要 2 个角色才能进行关系标注建议（当前检测到 " + characters.length + " 个角色）",
      });
    }

    // Run rule-based labeling
    const result = suggestRelations({
      characters,
      existingRelations: relationsFile.relations,
    });

    return c.json({
      suggestions: result.suggestions,
      totalCharacterPairs: (characters.length * (characters.length - 1)) / 2,
      analyzedCharacters: characters.length,
    });
  });

  // ── POST /:id/suggest-relations/accept — Accept a suggestion ──

  router.post("/:id/suggest-relations/accept", async (c) => {
    const id = c.req.param("id");
    const dir = bookDir(id);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    const rawSuggestion = (body as Record<string, unknown>).suggestion;
    if (!rawSuggestion || typeof rawSuggestion !== "object") {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "suggestion 不能为空" } }, 400);
    }

    const s = rawSuggestion as Record<string, unknown>;
    const sourceId = String(s.sourceId ?? "");
    const targetId = String(s.targetId ?? "");
    const suggestedRelation = String(s.suggestedRelation ?? "");
    const evidence = String(s.evidence ?? "");

    if (!sourceId || !targetId || !suggestedRelation) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "sourceId、targetId 和 suggestedRelation 不能为空" } }, 400);
    }

    // Validate suggestion type
    const relationType = toExistingRelationType(
      suggestedRelation as Parameters<typeof toExistingRelationType>[0],
    );

    const now = new Date().toISOString();
    const data = await loadRelations(dir);

    // Check for duplicate
    const exists = data.relations.some(
      (r) =>
        (r.sourceRoleId === sourceId && r.targetRoleId === targetId) ||
        (r.sourceRoleId === targetId && r.targetRoleId === sourceId),
    );

    if (exists) {
      return c.json({ error: { code: "DUPLICATE", message: "这两个角色之间已存在关系" } }, 409);
    }

    const newRelation: CharacterRelation = {
      id: randomUUID(),
      sourceRoleId: sourceId,
      targetRoleId: targetId,
      relationType,
      description: `[AI 标注] ${SUGGESTED_RELATION_LABELS[suggestedRelation as keyof typeof SUGGESTED_RELATION_LABELS] ?? suggestedRelation}: ${evidence.slice(0, 200)}`,
      validFromChapter: 1,
      intensity: 3,
      createdAt: now,
      updatedAt: now,
    };

    const parsed = CharacterRelationSchema.safeParse(newRelation);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: `关系数据校验失败: ${parsed.error.message}` } }, 400);
    }

    data.relations.push(parsed.data);
    await saveRelations(dir, data);

    return c.json({
      accepted: true,
      relation: parsed.data,
      totalRelations: data.relations.length,
    });
  });

  // ── POST /:id/suggest-relations/dismiss — Dismiss a suggestion ──

  router.post("/:id/suggest-relations/dismiss", async (c) => {
    return c.json({ dismissed: true });
  });

  return router;
}
