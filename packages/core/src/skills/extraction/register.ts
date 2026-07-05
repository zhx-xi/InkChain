// ── Extraction Skill Registry ──
//
// Loads all AI extraction skill manifests from the extraction/ directory
// and registers them as system-level skills (source="system").
// System skills are not visible to the user (filtered by listUserVisibleSkills())
// and participate only in context resolution for the AI pipeline.

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CapabilitySkillManifestSchema,
  type CapabilitySkillManifest,
} from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTRACTION_DIR = join(__dirname);

function loadJsonSkill(filePath: string): CapabilitySkillManifest {
  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  // All skills from the extraction/ directory are system skills,
  // regardless of what source is set in the JSON file.
  parsed.source = "system";
  return CapabilitySkillManifestSchema.parse(parsed);
}

/**
 * Load all extraction skills from the extraction/ directory.
 *
 * These skills are marked with source="system", which means:
 * - They are NOT listed in listUserVisibleSkills() (not shown in Skill UI).
 * - They are NOT editable by users.
 * - They ARE included in context resolution for the AI pipeline.
 */
export function loadExtractionSkills(): ReadonlyArray<CapabilitySkillManifest> {
  try {
    const files = readdirSync(EXTRACTION_DIR).filter(
      (f) => f.endsWith(".json") && f !== "content-extractor.json" && f !== "summarizer.json",
    );
    return files.map((f) => loadJsonSkill(join(EXTRACTION_DIR, f)));
  } catch {
    return [];
  }
}
