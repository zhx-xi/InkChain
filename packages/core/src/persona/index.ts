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
