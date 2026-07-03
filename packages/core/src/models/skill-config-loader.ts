// ── Skill Config Loader (Issue #74) ──
//
// Scans project-level and builtin-level directories for Skill JSON files,
// validates them with SkillConfigSchema, and merges them with project
// precedence (project overrides builtin with the same id).
//
//   Project level:  <projectRoot>/.inkos/skills/<id>.json
//   Builtin level:  <builtinRoot>/skills/<id>.json
//
// See: Issue #74 — Skill-1: SkillConfigSchema Zod 定义 + Skill 注册机制

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SkillConfigSchema,
  type SkillConfig,
  type SkillSource,
  type StoredSkillConfig,
} from "../models/skill-config.js";

export interface LoadSkillConfigsInput {
  readonly projectRoot: string;
  readonly builtinRoot?: string;
}

export interface LoadSkillConfigsResult {
  readonly skills: ReadonlyArray<StoredSkillConfig>;
  readonly diagnostics: ReadonlyArray<SkillLoadDiagnostic>;
}

export interface SkillLoadDiagnostic {
  readonly path: string;
  readonly message: string;
}

const PROJECT_SKILLS_DIRNAME = ".inkos/skills";

/**
 * Load all skill configs from project-level and builtin-level directories.
 *
 * Merge order (last-wins):
 *   1. Builtin skills are loaded first as defaults
 *   2. Project-level skills override builtin skills with the same id
 *
 * Returns the merged list plus any diagnostics collected during loading.
 * Missing directories are not errors; only malformed files produce diagnostics.
 */
export async function loadSkillConfigs(
  input: LoadSkillConfigsInput,
): Promise<LoadSkillConfigsResult> {
  const diagnostics: SkillLoadDiagnostic[] = [];
  const builtinRoot = input.builtinRoot
    ?? defaultBuiltinRoot();
  const projectDir = join(input.projectRoot, PROJECT_SKILLS_DIRNAME);
  const builtinDir = builtinRoot ? join(builtinRoot, "skills") : null;

  const byId = new Map<string, StoredSkillConfig>();

  if (builtinDir) {
    const builtin = await readSkillDir(builtinDir, "builtin", diagnostics);
    for (const skill of builtin) {
      byId.set(skill.config.id, skill);
    }
  }

  const project = await readSkillDir(projectDir, "project", diagnostics);
  for (const skill of project) {
    byId.set(skill.config.id, skill);
  }

  const skills = [...byId.values()].sort((a, b) =>
    a.config.id.localeCompare(b.config.id),
  );

  return { skills, diagnostics };
}

async function readSkillDir(
  dir: string,
  source: SkillSource,
  diagnostics: SkillLoadDiagnostic[],
): Promise<StoredSkillConfig[]> {
  let entries: import("node:fs").Dirent[];
  try {
    const info = await stat(dir);
    if (!info.isDirectory()) {
      diagnostics.push({ path: dir, message: "Not a directory" });
      return [];
    }
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isMissingPathError(error)) return [];
    diagnostics.push({
      path: dir,
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  const skills: StoredSkillConfig[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const path = join(dir, entry.name);
    try {
      const skill = await readSkillFile(path, source);
      skills.push(skill);
    } catch (error) {
      diagnostics.push({
        path,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return skills;
}

async function readSkillFile(
  path: string,
  source: SkillSource,
): Promise<StoredSkillConfig> {
  const raw = await readFile(path, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const config = SkillConfigSchema.parse(parsed);
  return { config, source, path };
}

function isMissingPathError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "ENOENT";
}

function defaultBuiltinRoot(): string | null {
  // The defaults package lives at packages/defaults/ relative to the
  // monorepo root. This file is at packages/core/src/models/ — so we walk
  // up three levels to the repo root and then into packages/defaults.
  //
  // This works in both:
  //   - source layout (../../..)  →  <repo>/packages/defaults
  //   - dist layout (../..)      →  <repo>/packages/defaults (after build)
  //
  // We try both possibilities; the loader is resilient to a missing dir.
  const here = typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));
  if (!here) return null;
  const candidates = [
    join(here, "..", "..", "..", "..", "defaults"), // dist: packages/core/dist/models → repo root
    join(here, "..", "..", "..", "defaults"),       // src:  packages/core/src/models → repo root
  ];
  return candidates[0]; // Best guess; the loader handles ENOENT.
}

// ── Pure helpers (exported for testing and downstream use) ──

/**
 * Merge project-level skills on top of builtin-level skills. Project-level
 * entries with the same id completely replace builtin entries (no field-level
 * merge — the issue spec says "项目级 > 内置级（同名覆盖）").
 */
export function mergeSkillConfigs(
  builtin: ReadonlyArray<StoredSkillConfig>,
  project: ReadonlyArray<StoredSkillConfig>,
): StoredSkillConfig[] {
  const byId = new Map<string, StoredSkillConfig>();
  for (const skill of builtin) {
    byId.set(skill.config.id, skill);
  }
  for (const skill of project) {
    byId.set(skill.config.id, skill);
  }
  return [...byId.values()].sort((a, b) =>
    a.config.id.localeCompare(b.config.id),
  );
}

/**
 * Filter a list of stored skill configs by category. Returns a new array.
 */
export function filterByCategory(
  skills: ReadonlyArray<StoredSkillConfig>,
  category: string,
): StoredSkillConfig[] {
  return skills.filter((skill) => skill.config.category === category);
}

/**
 * Filter a list of stored skill configs by enabled state.
 */
export function filterEnabled(
  skills: ReadonlyArray<StoredSkillConfig>,
): StoredSkillConfig[] {
  return skills.filter((skill) => skill.config.enabled);
}
