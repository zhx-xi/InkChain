// ── Scene Role CRUD routes ──
// Scene roles are simplified character profiles bound to specific chapters.
// They are stored as markdown files under roles/scene/<name>.md with YAML
// frontmatter containing structured metadata (description, relatedChapters).

import { Hono } from "hono";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join, resolve, relative } from "node:path";

import {
  SceneRoleSchema,
  CreateSceneRoleSchema,
  UpdateSceneRoleSchema,
  type SceneRole,
  type CreateSceneRole,
  type UpdateSceneRole,
} from "@inkchain/inkchain-core";

// ── Helpers ──

/** Build the on-disk path for a scene role file: story/roles/scene/<name>.md */
function sceneRolePath(bookDir: string, name: string): string {
  return resolve(join(bookDir, "story", "roles", "scene", `${name}.md`));
}

/** Ensure the directory for scene role files exists. */
async function ensureSceneDir(bookDir: string): Promise<void> {
  await mkdir(join(bookDir, "story", "roles", "scene"), { recursive: true });
}

/** Parse YAML frontmatter from a markdown file body. */
function parseFrontmatter(text: string): { readonly data: Record<string, unknown>; readonly body: string } {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, body: text.trim() };

  const data: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)/);
    if (kv) {
      // Try JSON parse for array values, otherwise string
      const val = kv[2].trim();
      try {
        data[kv[1]] = JSON.parse(val);
      } catch {
        data[kv[1]] = val;
      }
    }
  }
  return { data, body: match[2].trim() };
}

/** Serialize data to YAML frontmatter + body. */
function toFrontmatter(data: Record<string, unknown>, body: string): string {
  const yamlLines = Object.entries(data)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${JSON.stringify(v)}`;
      return `${k}: ${v}`;
    });
  return `---\n${yamlLines.join("\n")}\n---\n\n${body}`;
}

/** Load a scene role from its markdown file. Returns null if not found. */
async function loadSceneRole(bookDir: string, name: string): Promise<SceneRole | null> {
  try {
    const raw = await readFile(sceneRolePath(bookDir, name), "utf-8");
    const { data } = parseFrontmatter(raw);
    return SceneRoleSchema.parse({
      ...data,
      name, // always use filename as canonical name
    });
  } catch {
    return null;
  }
}

/** Write a scene role to its markdown file. */
async function saveSceneRole(bookDir: string, role: SceneRole): Promise<void> {
  await ensureSceneDir(bookDir);
  const now = new Date().toISOString();
  const updated = { ...role, updatedAt: now, createdAt: role.createdAt || now };
  const content = toFrontmatter(
    {
      description: updated.description,
      relatedChapters: updated.relatedChapters,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    },
    `# ${updated.name}\n\n${updated.description}`,
  );
  await writeFile(sceneRolePath(bookDir, updated.name), content, "utf-8");
}

/** List all scene roles in the book's roles/scene/ directory. */
async function listSceneRoles(bookDir: string): Promise<SceneRole[]> {
  const { readdir } = await import("node:fs/promises");
  try {
    const files = (await readdir(join(bookDir, "story", "roles", "scene")))
      .filter((f: string) => f.endsWith(".md"))
      .map((f: string) => f.replace(/\.md$/, ""));
    const roles: SceneRole[] = [];
    for (const name of files) {
      const role = await loadSceneRole(bookDir, name);
      if (role) roles.push(role);
    }
    return roles;
  } catch {
    return [];
  }
}

// ── Router ──

type BookDirFn = (bookId: string) => string;

export function createSceneRolesRouter(getBookDir: BookDirFn): Hono {
  const app = new Hono();

  // ── GET /:id/scene-roles ───────────────────────────────────────────
  // List scene roles, optionally filtered by ?chapter=N.
  app.get("/:id/scene-roles", async (c) => {
    const id = c.req.param("id");
    const chapter = c.req.query("chapter");
    const bookDir = getBookDir(id);
    let roles = await listSceneRoles(bookDir);

    if (chapter) {
      const cn = parseInt(chapter, 10);
      if (!isNaN(cn)) {
        roles = roles.filter((r) => r.relatedChapters.includes(cn));
      }
    }

    return c.json({ sceneRoles: roles });
  });

  // ── POST /:id/scene-roles ──────────────────────────────────────────
  // Create a new scene role.
  app.post("/:id/scene-roles", async (c) => {
    const id = c.req.param("id");
    const bookDir = getBookDir(id);
    const body = CreateSceneRoleSchema.safeParse(await c.req.json());

    if (!body.success) {
      return c.json({ error: body.error.issues.map((i) => i.message).join("; ") }, 400);
    }

    const { name, description, relatedChapters } = body.data;

    // Check for duplicate name.
    const existing = await loadSceneRole(bookDir, name);
    if (existing) {
      return c.json({ error: `场景角色"${name}"已存在` }, 409);
    }

    const now = new Date().toISOString();
    const role: SceneRole = {
      name,
      description: description ?? "",
      relatedChapters: relatedChapters ?? [],
      createdAt: now,
      updatedAt: now,
    };

    await saveSceneRole(bookDir, role);
    return c.json({ sceneRole: role }, 201);
  });

  // ── PUT /:id/scene-roles/:name ─────────────────────────────────────
  // Update an existing scene role.
  app.put("/:id/scene-roles/:name", async (c) => {
    const id = c.req.param("id");
    const name = c.req.param("name");
    const bookDir = getBookDir(id);

    const existing = await loadSceneRole(bookDir, name);
    if (!existing) {
      return c.json({ error: `场景角色"${name}"不存在` }, 404);
    }

    const body = UpdateSceneRoleSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: body.error.issues.map((i) => i.message).join("; ") }, 400);
    }

    const merged: SceneRole = {
      ...existing,
      ...body.data,
      updatedAt: new Date().toISOString(),
    };

    await saveSceneRole(bookDir, merged);
    return c.json({ sceneRole: merged });
  });

  // ── DELETE /:id/scene-roles/:name ──────────────────────────────────
  // Delete a scene role.
  app.delete("/:id/scene-roles/:name", async (c) => {
    const id = c.req.param("id");
    const name = c.req.param("name");
    const bookDir = getBookDir(id);

    const existing = await loadSceneRole(bookDir, name);
    if (!existing) {
      return c.json({ error: `场景角色"${name}"不存在` }, 404);
    }

    try {
      await unlink(sceneRolePath(bookDir, name));
    } catch {
      return c.json({ error: "删除文件失败" }, 500);
    }

    return c.json({ ok: true });
  });

  return app;
}
