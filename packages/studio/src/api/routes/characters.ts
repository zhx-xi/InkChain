// ── Character Tier Change Route ──
// Provides PATCH /:id/characters/:name/tier to move a character file
// between tier directories (character upgrade/downgrade).
// This is the glue between the Role Tiering and Relation Graph modules.

import { Hono } from "hono";
import { readFile, writeFile, mkdir, unlink, readdir, access } from "node:fs/promises";
import { join, resolve, relative } from "node:path";

// ── Canonical directory name mapping ──
// CharacterTier enum → canonical English directory name
const TIER_TO_DIR: Record<string, string> = {
  protagonist: "protagonist",
  supporting: "supporting",
  guest: "guest",
  one_shot: "one-shot",
  scene: "scene",
};

// All possible directory names a character file could be in
const ALL_TIER_DIRS = [
  "主角", "重要", "次要", "客串", "一次性",
  "protagonist", "supporting", "guest", "one-shot", "scene",
  "主要角色", "次要角色", "major", "minor",
];

// ── Search across all tier directories for a character file ──
async function findCharacterFile(
  bookDir: string,
  name: string,
): Promise<{ dir: string; fullPath: string } | null> {
  const rolesDir = join(bookDir, "story", "roles");
  for (const dir of ALL_TIER_DIRS) {
    const fullPath = join(rolesDir, dir, `${name}.md`);
    try {
      await readFile(fullPath, "utf-8");
      return { dir, fullPath };
    } catch {
      // Not in this directory — try next
    }
  }
  return null;
}

// ── Route factory ──

type BookDirFn = (bookId: string) => string;

export function createCharactersRouter(getBookDir: BookDirFn): Hono {
  const app = new Hono();

  // PATCH /:id/characters/:name/tier — Change a character's tier
  // Body: { tier: "protagonist" | "supporting" | "guest" | "one_shot" | "scene" }
  app.patch("/:id/characters/:name/tier", async (c) => {
    const id = c.req.param("id");
    const name = c.req.param("name");
    const bookDir = getBookDir(id);

    // Validate body
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    const bodyRecord = body as Record<string, unknown>;
    const targetTier = bodyRecord.tier;

    const validTiers = ["protagonist", "supporting", "guest", "one_shot", "scene"];
    if (!validTiers.includes(targetTier as string)) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: `tier 必须是以下值之一: ${validTiers.join(", ")}`,
        },
      }, 400);
    }

    const targetDirName = TIER_TO_DIR[targetTier as string];
    if (!targetDirName) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: `未知层级: ${targetTier}` } }, 400);
    }

    // Find the character file in any tier directory
    const found = await findCharacterFile(bookDir, name);
    if (!found) {
      return c.json({ error: { code: "NOT_FOUND", message: `角色"${name}"不存在` } }, 404);
    }

    // If already in correct tier, no-op
    if (found.dir === targetDirName) {
      return c.json({
        ok: true,
        name,
        tier: targetTier,
        message: "角色已在此层级",
      });
    }

    // Check if character already exists in target tier
    const targetPath = join(bookDir, "story", "roles", targetDirName, `${name}.md`);
    try {
      await readFile(targetPath, "utf-8");
      return c.json({ error: { code: "CONFLICT", message: `角色"${name}"在目标层级中已存在` } }, 409);
    } catch {
      // Target doesn't exist — good, proceed with move
    }

    try {
      // Read current file
      const content = await readFile(found.fullPath, "utf-8");

      // Ensure target directory exists
      await mkdir(join(bookDir, "story", "roles", targetDirName), { recursive: true });

      // Write to new tier directory
      await writeFile(targetPath, content, "utf-8");

      // Delete from old tier directory
      await unlink(found.fullPath);

      return c.json({
        ok: true,
        name,
        previousTier: found.dir,
        tier: targetTier,
      });
    } catch (e) {
      return c.json({
        error: {
          code: "INTERNAL_ERROR",
          message: `移动角色文件失败: ${e instanceof Error ? e.message : String(e)}`,
        },
      }, 500);
    }
  });

  // GET /:id/characters — List all characters with their tier info
  app.get("/:id/characters", async (c) => {
    const id = c.req.param("id");
    const bookDir = getBookDir(id);
    const rolesDir = join(bookDir, "story", "roles");

    try {
      const characters: Array<{ name: string; tier: string }> = [];

      for (const dir of ALL_TIER_DIRS) {
        const dirPath = join(rolesDir, dir);
        try {
          const files = await readdir(dirPath);
          for (const file of files) {
            if (file.endsWith(".md")) {
              const name = file.replace(/\.md$/, "");
              characters.push({ name, tier: dir });
            }
          }
        } catch {
          // Directory doesn't exist — skip
        }
      }

      return c.json({ characters });
    } catch (e) {
      return c.json({
        error: {
          code: "INTERNAL_ERROR",
          message: `读取角色列表失败: ${e instanceof Error ? e.message : String(e)}`,
        },
      }, 500);
    }
  });

  // GET /:id/consistency — cross-module data consistency check
  // Validates: character file references in relations, volume references in chapters
  app.get("/:id/consistency", async (c) => {
    const id = c.req.param("id");
    const bookDir = getBookDir(id);

    const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

    // Check 1: All role references in relations point to existing character files
    try {
      const relationsRaw = await readFile(
        join(bookDir, "story", "state", "relations.json"), "utf-8",
      ).catch(() => "{}");
      const relationsData = JSON.parse(relationsRaw);
      const relations = relationsData.relations ?? [];

      // Build set of existing character files
      const existingChars = new Set<string>();
      const rolesDir = join(bookDir, "story", "roles");
      for (const dir of ALL_TIER_DIRS) {
        try {
          const files = await readdir(join(rolesDir, dir));
          for (const f of files) {
            if (f.endsWith(".md")) {
              existingChars.add(`roles/${dir}/${f}`);
            }
          }
        } catch { /* directory doesn't exist */ }
      }

      let brokenRefs = 0;
      for (const rel of relations) {
        if (!existingChars.has(rel.sourceRoleId)) brokenRefs++;
        if (!existingChars.has(rel.targetRoleId)) brokenRefs++;
      }

      checks.push({
        name: "角色文件引用",
        passed: brokenRefs === 0,
        detail: brokenRefs === 0
          ? `${relations.length} 条关系全部引用了存在的角色文件`
          : `${brokenRefs} 个角色引用指向不存在的角色文件`,
      });
    } catch (e) {
      checks.push({
        name: "角色文件引用",
        passed: false,
        detail: `检查失败: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    // Check 2: Volume references in chapters point to existing volumes
    try {
      const volumesRaw = await readFile(
        join(bookDir, "story", "state", "volumes.json"), "utf-8",
      ).catch(() => "{}");
      const volumesData = JSON.parse(volumesRaw);
      const existingVolumeIds = new Set(
        (volumesData.volumes ?? []).map((v: { id: string }) => v.id),
      );

      const chaptersRaw = await readFile(
        join(bookDir, "story", "chapters", "index.json"), "utf-8",
      ).catch(() => "{}");
      const chaptersData = JSON.parse(chaptersRaw);

      let brokenVolRefs = 0;
      for (const ch of (chaptersData.chapters ?? [])) {
        if (ch.volumeId && !existingVolumeIds.has(ch.volumeId)) {
          brokenVolRefs++;
        }
      }

      checks.push({
        name: "章节分卷引用",
        passed: brokenVolRefs === 0,
        detail: brokenVolRefs === 0
          ? `${(chaptersData.chapters ?? []).length} 个章节中所有分卷引用有效`
          : `${brokenVolRefs} 个章节引用了不存在的分卷`,
      });
    } catch (e) {
      checks.push({
        name: "章节分卷引用",
        passed: false,
        detail: `检查失败: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    // Check 3: Relations JSON schema version compatibility
    try {
      const relationsRaw = await readFile(
        join(bookDir, "story", "state", "relations.json"), "utf-8",
      ).catch(() => '{"schemaVersion": "1", "relations": []}');
      const relData = JSON.parse(relationsRaw);
      const versionOk = relData.schemaVersion === "1";

      checks.push({
        name: "关系数据格式",
        passed: versionOk,
        detail: versionOk
          ? `schemaVersion=${relData.schemaVersion} (兼容)`
          : `不兼容的 schemaVersion: ${relData.schemaVersion}`,
      });
    } catch (e) {
      checks.push({
        name: "关系数据格式",
        passed: false,
        detail: `检查失败: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    return c.json({
      ok: checks.every((c) => c.passed),
      checks,
    });
  });

  return app;
}
