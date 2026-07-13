// ── World Store (Issue #77 — World-1) ──
//
// File-system helpers for reading and writing WorldConfig JSON files under
// `.inkos/worlds/<id>.json`.

import { access, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { WorldConfigSchema, type WorldConfig, type WorldConfigUpdate, type WorldSearchResult, type WorldReference, type WorldReferenceCreate, WORLD_DIMENSION_KEYS, worldSearch, checkReferenceBeforeDelete } from "./world-config.js";
import { IndexManager } from "../state/index-manager.js";
import { DATA_DIR_NAME } from "../utils/data-directory.js";

const WORLDS_DIR = `${DATA_DIR_NAME}/worlds`;

function worldsDir(root: string): string {
  return join(root, WORLDS_DIR);
}

function worldParser(raw: string): WorldConfig {
  return WorldConfigSchema.parse(JSON.parse(raw));
}

export function worldPath(root: string, id: string): string {
  if (!/^[a-z0-9_-]+$/i.test(id)) {
    throw new Error(`Invalid world id: ${id}`);
  }
  return join(worldsDir(root), `${id}.json`);
}

export async function listWorlds(root: string): Promise<WorldConfig[]> {
  const idx = IndexManager.getInstance();
  return idx.list<WorldConfig>(root, WORLDS_DIR, worldParser);
}

export async function loadWorld(root: string, id: string): Promise<WorldConfig | null> {
  const idx = IndexManager.getInstance();
  return idx.get<WorldConfig>(root, WORLDS_DIR, id, worldParser);
}

export async function saveWorld(root: string, world: WorldConfig): Promise<void> {
  const idx = IndexManager.getInstance();
  await idx.set(root, WORLDS_DIR, world.id, world);
}

export async function deleteWorld(root: string, id: string): Promise<boolean> {
  const idx = IndexManager.getInstance();
  const worldPathStr = worldPath(root, id);
  try {
    await access(worldPathStr);
  } catch {
    return false;
  }
  await rm(worldPathStr, { force: true });
  idx.evict(root, WORLDS_DIR, id);
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
    references: [],
  };
}

// ── Search & Reference (Wrld-5) ──

export function searchWorlds(
  world: WorldConfig,
  query: string,
  dimension?: string,
): WorldSearchResult[] {
  return worldSearch(world, query, dimension);
}

export function deleteEntityWithRefCheck(
  world: WorldConfig,
  dimension: string,
  entityId: string,
): { updated: WorldConfig; refs: ReturnType<typeof checkReferenceBeforeDelete> } {
  const refs = checkReferenceBeforeDelete(world, dimension, entityId);
  const updated = {
    ...world,
    [dimension]: ((world as unknown as Record<string, unknown[]>)[dimension] ?? []).filter(
      (e: unknown) => (e as Record<string, unknown>).id !== entityId,
    ),
  } as WorldConfig;

  // Also remove references pointing to this entity
  updated.references = updated.references?.filter(
    (ref: WorldReference) =>
      !(ref.sourceId === entityId && ref.sourceDimension === dimension) &&
      !(ref.targetId === entityId && ref.targetDimension === dimension),
  ) ?? [];

  return { updated, refs };
}

export function addWorldReference(
  world: WorldConfig,
  ref: WorldReferenceCreate,
): WorldConfig {
  const newRef: WorldReference = {
    ...ref,
    id: `ref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  };
  return {
    ...world,
    references: [...(world.references ?? []), newRef],
  };
}

export function removeWorldReference(
  world: WorldConfig,
  refId: string,
): WorldConfig {
  return {
    ...world,
    references: (world.references ?? []).filter((r) => r.id !== refId),
  };
}
