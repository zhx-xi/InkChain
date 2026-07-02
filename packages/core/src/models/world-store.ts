// ── World Store (Issue #77 — World-1) ──
//
// File-system helpers for reading and writing WorldConfig JSON files under
// `.inkos/worlds/<id>.json`.

import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { WorldConfigSchema, type WorldConfig, type WorldConfigUpdate } from "./world-config.js";

const WORLDS_DIR = ".inkos/worlds";

function worldsDir(root: string): string {
  return join(root, WORLDS_DIR);
}

export function worldPath(root: string, id: string): string {
  if (!/^[a-z0-9_-]+$/i.test(id)) {
    throw new Error(`Invalid world id: ${id}`);
  }
  return join(worldsDir(root), `${id}.json`);
}

export async function listWorlds(root: string): Promise<WorldConfig[]> {
  const dir = worldsDir(root);
  let files: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    files = entries.filter((e) => e.isFile() && e.name.endsWith(".json")).map((e) => e.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const worlds: WorldConfig[] = [];
  for (const file of files.sort()) {
    const raw = await readFile(join(dir, file), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const id = file.replace(/\.json$/, "");
    worlds.push(WorldConfigSchema.parse({ ...(parsed as Record<string, unknown>), id }));
  }
  return worlds;
}

export async function loadWorld(root: string, id: string): Promise<WorldConfig | null> {
  try {
    const raw = await readFile(worldPath(root, id), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return WorldConfigSchema.parse({ ...(parsed as Record<string, unknown>), id });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function saveWorld(root: string, world: WorldConfig): Promise<void> {
  await mkdir(worldsDir(root), { recursive: true });
  await writeFile(worldPath(root, world.id), JSON.stringify(world, null, 2), "utf-8");
}

export async function deleteWorld(root: string, id: string): Promise<boolean> {
  try {
    await access(worldPath(root, id));
  } catch {
    return false;
  }
  await rm(worldPath(root, id), { force: true });
  return true;
}

export function applyWorldUpdate(base: WorldConfig, update: WorldConfigUpdate): WorldConfig {
  const now = new Date().toISOString();
  return {
    ...base,
    ...update,
    id: base.id,
    createdAt: base.createdAt,
    updatedAt: now,
  };
}

export function createWorld(id: string, name: string, description = ""): WorldConfig {
  const now = new Date().toISOString();
  return {
    id,
    name,
    description,
    createdAt: now,
    updatedAt: now,
    settings: [],
    roles: [],
    relations: [],
    regions: [],
    institutions: [],
    history: [],
    rules: [],
  };
}
