// ── Voice Profile Store (C3-1) ──
// File-system backed store for character voice profiles.
// Data is stored as a single JSON file: {projectRoot}/.inkos/voice-profiles.json

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import {
  VoiceProfileSchema,
  VoiceProfilesFileSchema,
  VOICE_PRESETS,
  type VoiceProfile,
  type VoiceProfilesFile,
} from "../models/voice-profile.js";

// ── Path Resolution ──

export function resolveVoiceProfilesPath(projectRoot: string): string {
  return join(projectRoot, ".inkos", "voice-profiles.json");
}

// ── Internal Helpers ──

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function readVoiceProfilesFile(projectRoot: string): Promise<VoiceProfilesFile> {
  const filePath = resolveVoiceProfilesPath(projectRoot);
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const result = VoiceProfilesFileSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    // If the file is malformed, return an empty file
    return { profiles: {}, version: 1 };
  } catch {
    return { profiles: {}, version: 1 };
  }
}

async function writeVoiceProfilesFile(projectRoot: string, data: VoiceProfilesFile): Promise<void> {
  const filePath = resolveVoiceProfilesPath(projectRoot);
  await ensureDir(filePath);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ── Public API ──

/**
 * Load all voice profiles from the project's voice-profiles.json file.
 * Returns an empty file structure if the file does not exist or is malformed.
 */
export async function loadVoiceProfiles(projectRoot: string): Promise<VoiceProfilesFile> {
  return readVoiceProfilesFile(projectRoot);
}

/**
 * Get the voice profile for a specific character by characterId.
 * Returns null if no profile exists for that character.
 */
export async function getVoiceProfile(
  projectRoot: string,
  characterId: string,
): Promise<VoiceProfile | null> {
  const data = await readVoiceProfilesFile(projectRoot);
  const profile = data.profiles[characterId];
  if (!profile) return null;
  return profile;
}

/**
 * Create or update a voice profile for a character.
 * Returns the saved profile.
 */
export async function saveVoiceProfile(
  projectRoot: string,
  characterId: string,
  profile: VoiceProfile,
): Promise<VoiceProfile> {
  // Ensure the profile has the correct characterId and updatedAt
  const now = Date.now();
  const updatedProfile: VoiceProfile = {
    ...profile,
    characterId,
    updatedAt: now,
  };

  // Validate
  const parsed = VoiceProfileSchema.parse(updatedProfile);

  const data = await readVoiceProfilesFile(projectRoot);
  data.profiles[characterId] = parsed;
  await writeVoiceProfilesFile(projectRoot, data);

  return parsed;
}

/**
 * Delete the voice profile for a character.
 * Returns true if a profile was deleted, false if it did not exist.
 */
export async function deleteVoiceProfile(
  projectRoot: string,
  characterId: string,
): Promise<boolean> {
  const data = await readVoiceProfilesFile(projectRoot);
  if (!data.profiles[characterId]) return false;
  delete data.profiles[characterId];
  await writeVoiceProfilesFile(projectRoot, data);
  return true;
}

/**
 * List all available voice preset IDs (keys of VOICE_PRESETS).
 */
export async function listVoicePresets(): Promise<string[]> {
  return Object.keys(VOICE_PRESETS);
}

/**
 * Get a voice preset by its presetId.
 * Returns null if the preset does not exist.
 */
export async function getVoicePreset(
  presetId: string,
): Promise<Partial<VoiceProfile> | null> {
  const preset = VOICE_PRESETS[presetId];
  if (!preset) return null;
  return { ...preset };
}
