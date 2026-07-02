// ── Persona Version History ──
// Provides automatic version snapshotting and restoration for Persona configs.
// Pattern: each time a persona is saved, the previous config is snapshotted
// to `.inkos/persona-versions/<agentRole>/<rev>.json`.
// Maximum 20 versions retained per persona.
//
// See: Issue #95 (Per-10: Persona A/B 对比测试)

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PersonaConfig, AgentRole } from "../models/persona-config.js";
import { PersonaConfigSchema } from "../models/persona-config.js";

// ── Constants ──

const VERSIONS_DIR_RELATIVE = ".inkos/persona-versions";
const VERSION_KEEP = 20;

// ── Types ──

export interface PersonaVersionMeta {
  rev: number;
  timestamp: string;
  agentRole: string;
}

// ── Path Helpers ──

function versionsDir(projectRoot: string, agentRole: string): string {
  return join(projectRoot, VERSIONS_DIR_RELATIVE, agentRole);
}

function versionPath(projectRoot: string, agentRole: string, rev: number): string {
  return join(versionsDir(projectRoot, agentRole), `${rev}.json`);
}

// ── Core Functions ──

/**
 * Snapshot the current persona config before it is overwritten.
 * @returns The revision number that was created, or 0 if no snapshot was taken.
 */
export async function snapshotPersonaVersion(
  projectRoot: string,
  agentRole: string,
  currentConfig: PersonaConfig,
  newConfig?: PersonaConfig,
): Promise<number> {
  // Skip snapshot if content is identical (or no current config)
  if (newConfig && JSON.stringify(currentConfig) === JSON.stringify(newConfig)) {
    return 0;
  }

  const verDir = versionsDir(projectRoot, agentRole);
  await mkdir(verDir, { recursive: true });

  // Determine next revision number
  let maxRev = 0;
  try {
    const files = await readdir(verDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const num = Number(file.replace(".json", ""));
        if (!Number.isNaN(num) && num > maxRev) maxRev = num;
      }
    }
  } catch {
    // Directory just created, no files yet
  }

  const rev = maxRev + 1;
  const version: PersonaVersionMeta & { config: PersonaConfig } = {
    rev,
    timestamp: new Date().toISOString(),
    agentRole,
    config: currentConfig,
  };

  await writeFile(
    versionPath(projectRoot, agentRole, rev),
    JSON.stringify(version, null, 2),
    "utf-8",
  );

  // Prune old versions
  await pruneVersions(projectRoot, agentRole);

  return rev;
}

/**
 * List all versions for a given persona agent role.
 * Returns newest first.
 */
export async function listPersonaVersions(
  projectRoot: string,
  agentRole: string,
): Promise<PersonaVersionMeta[]> {
  const verDir = versionsDir(projectRoot, agentRole);
  let files: string[];
  try {
    files = await readdir(verDir);
  } catch {
    return [];
  }

  const versions: PersonaVersionMeta[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(verDir, file), "utf-8");
      const parsed = JSON.parse(raw) as PersonaVersionMeta;
      if (parsed.rev !== undefined) versions.push(parsed);
    } catch {
      // Skip corrupt version files
    }
  }

  versions.sort((a, b) => b.rev - a.rev);
  return versions;
}

/**
 * Load a specific persona version by revision number.
 * Returns the full PersonaConfig or null if not found / corrupt.
 */
export async function loadPersonaVersion(
  projectRoot: string,
  agentRole: string,
  rev: number,
): Promise<{ config: PersonaConfig } | null> {
  try {
    const raw = await readFile(versionPath(projectRoot, agentRole, rev), "utf-8");
    const parsed = JSON.parse(raw) as { config: PersonaConfig };
    return { config: PersonaConfigSchema.parse(parsed.config) };
  } catch {
    return null;
  }
}

/**
 * Restore a persona to a specific version.
 * The current config is snapshotted first, then the version's config is returned for saving.
 * @returns The restored PersonaConfig to be saved by the caller.
 */
export async function restorePersonaVersion(
  projectRoot: string,
  agentRole: string,
  rev: number,
): Promise<PersonaConfig | null> {
  const versionData = await loadPersonaVersion(projectRoot, agentRole, rev);
  if (!versionData) return null;

  // Snapshot current config before restoring
  const current = await loadCurrentPersonaConfig(projectRoot, agentRole);
  if (current) {
    await snapshotPersonaVersion(projectRoot, agentRole, current, versionData.config);
  }

  return versionData.config;
}

/**
 * Load the current persona config from the file system.
 * Used internally to snapshot before restore.
 */
async function loadCurrentPersonaConfig(
  projectRoot: string,
  agentRole: string,
): Promise<PersonaConfig | null> {
  try {
    const { readPersonaConfig } = await import("./loader.js");
    return await readPersonaConfig(projectRoot, agentRole as AgentRole);
  } catch {
    return null;
  }
}

// ── Pruning ──

async function pruneVersions(projectRoot: string, agentRole: string): Promise<void> {
  const verDir = versionsDir(projectRoot, agentRole);
  let files: string[];
  try {
    files = await readdir(verDir);
  } catch {
    return;
  }

  const revs: number[] = [];
  for (const file of files) {
    if (file.endsWith(".json")) {
      const num = Number(file.replace(".json", ""));
      if (!Number.isNaN(num)) revs.push(num);
    }
  }

  revs.sort((a, b) => a - b);
  if (revs.length <= VERSION_KEEP) return;

  const toRemove = revs.slice(0, revs.length - VERSION_KEEP);
  for (const old of toRemove) {
    await rm(versionPath(projectRoot, agentRole, old), { force: true });
  }
}
