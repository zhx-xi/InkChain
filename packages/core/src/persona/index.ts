// ── Persona Module ──
// Re-exports all persona-related functionality.

export { DEFAULT_PERSONAS, getDefaultPersona, getAllDefaultPersonas } from "./defaults.js";
export {
  readPersonaConfig,
  listAvailablePersonas,
  ensurePersonasDir,
  savePersonaConfig,
} from "./loader.js";
export type { PersonaSummary } from "../models/persona-config.js";
export {
  listBuiltinPresets,
  getBuiltinPreset,
  listAllPresets,
  loadPreset,
  applyPreset,
  saveAsPreset,
  deletePreset,
  type PresetSummary,
  type PresetSource,
} from "./presets.js";
export {
  snapshotPersonaVersion,
  listPersonaVersions,
  loadPersonaVersion,
  restorePersonaVersion,
  type PersonaVersionMeta,
} from "./version-history.js";
export {
  comparePersonaConfigs,
  summarizePersonaDiff,
  type PersonaDiff,
  type FieldDiff,
  type ArrayDiff,
  type NestedFieldDiff,
  type BehaviorConstraintDiff,
} from "./compare.js";
