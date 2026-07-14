// ── Data Directory Configuration (Issue #598) ──
//
// Centralized data directory name for the project runtime data store.
// Phase A: Dual-directory compatibility — .inkchain/ preferred, .inkos/ as fallback.
// Phase B: Auto-migration from .inkos/ to .inkchain/.
//
// All runtime data (worlds, skills, personas, sessions, etc.) lives under this
// directory relative to the project root.

/** New data directory name (InkChain). */
export const DATA_DIR_NAME = ".inkchain";

/** Legacy data directory name (InkOS). */
export const LEGACY_DIR_NAME = ".inkos";

/**
 * Build a path: <root>/<DATA_DIR_NAME>/<subpath>.
 * Convert legacy .inkos paths to .inkchain dynamically.
 *
 * Example:
 *   dataPath(root, "worlds", "my-world.json") → <root>/.inkchain/worlds/my-world.json
 */
export function dataPath(root: string, ...segments: string[]): string {
    return join(root, DATA_DIR_NAME, ...segments);
}

/**
 * Migrate a legacy path reference (containing .inkos/) to use .inkchain/.
 * If the path doesn't contain .inkos, it's returned as-is.
 */
export function migratePath(path: string): string {
  return path.replaceAll(LEGACY_DIR_NAME, DATA_DIR_NAME);
}

/**
 * Update a constant string value like ".inkos/worlds" → ".inkchain/worlds".
 */
export function migrateDirConstant(constant: string): string {
  return constant.replace(LEGACY_DIR_NAME, DATA_DIR_NAME);
}
