// ── Persona Config Loader ──
// Loads persona configurations with a 3-level priority:
// 1. Project-level:  {projectRoot}/.inkos/personas/<agent>.md
// 2. Built-in:       packages/core/src/personas/<agent>.md
// 3. Hardcoded:      DEFAULT_PERSONAS in defaults.ts
//
// Follows the same pattern as readGenreProfile / listAvailableGenres
// in agents/rules-reader.ts.

import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AgentRoleEnum,
  parsePersonaConfig,
  type AgentRole,
  type PersonaConfig,
  type PersonaSummary,
} from "../models/persona-config.js";
import { getDefaultPersona } from "./defaults.js";
import { serializePersonaConfig } from "../models/persona-config.js";
import { DATA_DIR_NAME } from "../utils/data-directory.js";

/** Directory where built-in persona files are stored. */
const BUILTIN_PERSONAS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/personas",
);

/** Relative path from project root to the project-level personas directory. */
const PROJECT_PERSONAS_RELATIVE = `${DATA_DIR_NAME}/personas`;

async function tryReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

// ── Public API ──

/**
 * Load a persona configuration for the given agent role.
 *
 * Lookup order:
 * 1. Project-level:  {projectRoot}/.inkos/personas/{agentRole}.md
 * 2. Built-in:       packages/core/src/personas/{agentRole}.md
 * 3. Hardcoded:      DEFAULT_PERSONAS[{agentRole}]
 *
 * Project-level and built-in files use YAML frontmatter + Markdown body format.
 * Hardcoded defaults are plain PersonaConfig objects (no file read).
 *
 * @returns The merged PersonaConfig with resolved fields.
 */
export async function readPersonaConfig(
  projectRoot: string,
  agentRole: AgentRole,
): Promise<PersonaConfig> {
  const projectPath = join(projectRoot, PROJECT_PERSONAS_RELATIVE, `${agentRole}.md`);
  const builtinPath = join(BUILTIN_PERSONAS_DIR, `${agentRole}.md`);

  // Level 1: Project-level file
  const projectRaw = await tryReadFile(projectPath);
  if (projectRaw) {
    try {
      const parsed = parsePersonaConfig(projectRaw);
      return parsed.config;
    } catch {
      // Malformed project-level file — fall through to built-in
    }
  }

  // Level 2: Built-in file
  const builtinRaw = await tryReadFile(builtinPath);
  if (builtinRaw) {
    try {
      const parsed = parsePersonaConfig(builtinRaw);
      return parsed.config;
    } catch {
      // Malformed built-in file — fall through to hardcoded default
    }
  }

  // Level 3: Hardcoded default
  return getDefaultPersona(agentRole);
}

/**
 * List all available persona configurations across all sources.
 *
 * Returns an array of PersonaSummary sorted by agent role.
 * Project-level entries override built-in entries with the same role.
 * All 7 agent roles are always present (falling back to hardcoded defaults).
 */
export async function listAvailablePersonas(
  projectRoot: string,
): Promise<ReadonlyArray<PersonaSummary>> {
  const results = new Map<string, PersonaSummary>();

  // Built-in personas first (lower priority)
  try {
    const builtinFiles = await readdir(BUILTIN_PERSONAS_DIR);
    for (const file of builtinFiles) {
      if (!file.endsWith(".md")) continue;
      const role = file.replace(/\.md$/, "");
      const parsed = AgentRoleEnum.safeParse(role);
      if (!parsed.success) continue;
      const raw = await tryReadFile(join(BUILTIN_PERSONAS_DIR, file));
      if (!raw) continue;
      try {
        const { config } = parsePersonaConfig(raw);
        results.set(role, {
          agentRole: parsed.data,
          displayName: config.displayName,
          source: "builtin",
        });
      } catch {
        // Skip malformed files
      }
    }
  } catch {
    // No built-in personas directory
  }

  // Project-level personas (higher priority, overrides built-in)
  const projectDir = join(projectRoot, PROJECT_PERSONAS_RELATIVE);
  try {
    const projectFiles = await readdir(projectDir);
    for (const file of projectFiles) {
      if (!file.endsWith(".md")) continue;
      const role = file.replace(/\.md$/, "");
      const parsed = AgentRoleEnum.safeParse(role);
      if (!parsed.success) continue;
      const raw = await tryReadFile(join(projectDir, file));
      if (!raw) continue;
      try {
        const { config } = parsePersonaConfig(raw);
        results.set(role, {
          agentRole: parsed.data,
          displayName: config.displayName,
          source: "project",
        });
      } catch {
        // Skip malformed files
      }
    }
  } catch {
    // No project-level personas directory
  }

  // Ensure all 7 roles are present (hardcoded defaults as fallback)
  const allRoles = AgentRoleEnum.options as readonly AgentRole[];
  for (const role of allRoles) {
    if (!results.has(role)) {
      const defaultConfig = getDefaultPersona(role);
      results.set(role, {
        agentRole: role,
        displayName: defaultConfig.displayName,
        source: "default",
      });
    }
  }

  return [...results.values()].sort((a, b) =>
    a.agentRole.localeCompare(b.agentRole),
  );
}

/**
 * Ensure the project-level personas directory exists.
 * Creates {projectRoot}/.inkos/personas/ if it doesn't exist.
 */
export async function ensurePersonasDir(projectRoot: string): Promise<string> {
  const dir = join(projectRoot, PROJECT_PERSONAS_RELATIVE);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Save a persona configuration to the project-level directory.
 * Writes as YAML frontmatter + Markdown body format.
 */
export async function savePersonaConfig(
  projectRoot: string,
  config: PersonaConfig,
  body: string,
): Promise<void> {
  const content = serializePersonaConfig(config, body);
  const dir = await ensurePersonasDir(projectRoot);
  const filePath = join(dir, `${config.agentRole}.md`);
  await writeFile(filePath, content, "utf-8");
}
