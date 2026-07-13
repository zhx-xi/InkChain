import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import {
  SessionTagsFileSchema,
  type SessionTag,
  type SessionTagsFile,
} from "./session-tags.js";

/**
 * Resolve the path to the session tags file within a project root.
 */
export function resolveSessionTagsPath(projectRoot: string): string {
  return join(projectRoot, ".inkos", "session-tags.json");
}

/**
 * Default empty session tags file.
 */
function defaultSessionTagsFile(): SessionTagsFile {
  return { tags: {}, version: 1 };
}

/**
 * Load the full session tags file from disk.
 * Returns the default structure if the file does not exist or is malformed.
 */
export async function loadSessionTags(projectRoot: string): Promise<SessionTagsFile> {
  try {
    const raw = await readFile(resolveSessionTagsPath(projectRoot), "utf-8");
    const parsed = JSON.parse(raw);
    const result = SessionTagsFileSchema.safeParse(parsed);
    if (result.success) return result.data;
    return defaultSessionTagsFile();
  } catch {
    return defaultSessionTagsFile();
  }
}

/**
 * Persist the full session tags file to disk.
 * Creates parent directories if needed.
 */
export async function persistSessionTags(
  projectRoot: string,
  data: SessionTagsFile,
): Promise<void> {
  const filePath = resolveSessionTagsPath(projectRoot);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Get all tags for a specific session.
 * Returns an empty array if the session has no tags.
 */
export async function getSessionTags(
  projectRoot: string,
  sessionId: string,
): Promise<SessionTag[]> {
  const data = await loadSessionTags(projectRoot);
  return data.tags[sessionId] ?? [];
}

/**
 * Add a tag to a session.
 * If the tag already exists (by id), its name and color are updated.
 * Returns the updated list of tags for the session.
 */
export async function addSessionTag(
  projectRoot: string,
  sessionId: string,
  tag: SessionTag,
): Promise<SessionTag[]> {
  const data = await loadSessionTags(projectRoot);
  const existing = data.tags[sessionId] ?? [];
  const idx = existing.findIndex((t) => t.id === tag.id);
  if (idx >= 0) {
    existing[idx] = tag;
  } else {
    existing.push(tag);
  }
  data.tags[sessionId] = existing;
  await persistSessionTags(projectRoot, data);
  return existing;
}

/**
 * Remove a tag from a session by tag id.
 * Returns the updated list of remaining tags.
 */
export async function removeSessionTag(
  projectRoot: string,
  sessionId: string,
  tagId: string,
): Promise<SessionTag[]> {
  const data = await loadSessionTags(projectRoot);
  const existing = data.tags[sessionId] ?? [];
  const updated = existing.filter((t) => t.id !== tagId);
  if (updated.length > 0) {
    data.tags[sessionId] = updated;
  } else {
    delete data.tags[sessionId];
  }
  await persistSessionTags(projectRoot, data);
  return updated;
}

/**
 * List all tags across the project with per-tag usage counts.
 * Tags of the same id are deduplicated (first occurrence's name/color wins).
 */
export async function listTagsByName(projectRoot: string): Promise<
  { tag: SessionTag; count: number }[]
> {
  const data = await loadSessionTags(projectRoot);
  const aggregated = new Map<string, { tag: SessionTag; count: number }>();

  for (const tags of Object.values(data.tags)) {
    for (const tag of tags) {
      const existing = aggregated.get(tag.id);
      if (existing) {
        existing.count += 1;
      } else {
        aggregated.set(tag.id, { tag, count: 1 });
      }
    }
  }

  return [...aggregated.values()].sort((a, b) => b.count - a.count);
}
