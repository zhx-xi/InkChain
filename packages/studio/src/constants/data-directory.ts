// ── Data Directory Migration (Issue #598) ──
//
// Phase A: Dual-directory compatibility — prefer .inkchain/, fallback to .inkos/
// Phase B: Auto-migration — copy .inkos/ → .inkchain/ on first access
//
// Usage:
//   import { DATA_DIR, resolveDataDir } from "../constants/data-directory.js";
//   const root = await resolveDataDir(projectRoot);
//   const filePath = join(root, DATA_DIR, "worlds", "xxx.json");

import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { constants } from "node:fs";

/** New data directory name. */
export const DATA_DIR_NAME = ".inkchain";

/** Legacy data directory name (for backward compatibility). */
export const LEGACY_DIR_NAME = ".inkos";

/** Marker file written after successful migration. */
const MIGRATION_MARKER = ".migrated-to-inkchain";

/**
 * Resolve the effective data directory name for a project root.
 *
 * Phase A logic:
 * 1. If `.inkchain/` exists → return `.inkchain`
 * 2. If `.inkos/` exists and `.inkchain/` does not → trigger Phase B auto-migration
 * 3. Neither exists → default to `.inkchain` (new projects)
 */
export async function resolveDataDirName(root: string): Promise<string> {
  const [inkchainExists, inkosExists] = await Promise.all([
    dirExists(join(root, DATA_DIR_NAME)),
    dirExists(join(root, LEGACY_DIR_NAME)),
  ]);

  if (inkchainExists) return DATA_DIR_NAME;
  if (inkosExists) {
    // Phase B: Auto-migrate .inkos/ → .inkchain/
    await migrateLegacyDataDir(root);
    return DATA_DIR_NAME;
  }
  return DATA_DIR_NAME;
}

/**
 * Legacy: simple synchronous check (for server startup where await is inconvenient).
 * Returns the data dir name synchronously based on disk state at call time.
 */
export function resolveDataDirNameSync(root: string): string {
  const { existsSync } = require("node:fs") as typeof import("node:fs");
  if (existsSync(join(root, DATA_DIR_NAME))) return DATA_DIR_NAME;
  if (existsSync(join(root, LEGACY_DIR_NAME))) return LEGACY_DIR_NAME;
  return DATA_DIR_NAME;
}

/**
 * Phase B: Copy all contents from .inkos/ to .inkchain/,
 * then write a migration marker file.
 */
async function migrateLegacyDataDir(root: string): Promise<void> {
  const src = join(root, LEGACY_DIR_NAME);
  const dst = join(root, DATA_DIR_NAME);

  // Check if migration already completed (marker exists)
  const markerPath = join(root, MIGRATION_MARKER);
  try {
    await access(markerPath, constants.F_OK);
    // Migration already done, just return
    return;
  } catch {
    // No marker — proceed
  }

  // Check if dst partially exists
  const dstExists = await dirExists(dst);
  if (dstExists) {
    // .inkchain/ already exists but no marker — skip migration (user may have created it)
    return;
  }

  // Copy recursively
  await copyDir(src, dst);

  // Write migration marker
  await writeFile(markerPath, JSON.stringify({
    migratedAt: new Date().toISOString(),
    from: LEGACY_DIR_NAME,
    to: DATA_DIR_NAME,
  }, null, 2), "utf-8");
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    await access(dir, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src: string, dst: string): Promise<void> {
  await mkdir(dst, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const dstPath = join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, dstPath);
    } else {
      const content = await readFile(srcPath);
      await writeFile(dstPath, content);
    }
  }
}
