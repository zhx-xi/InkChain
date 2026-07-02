// ── Persona Module ──
// Re-exports all persona-related functionality.

export { DEFAULT_PERSONAS, getDefaultPersona, getAllDefaultPersonas } from "./defaults.js";
export {
  readPersonaConfig,
  listAvailablePersonas,
  ensurePersonasDir,
  savePersonaConfig,
  type PersonaSummary,
} from "./loader.js";
