// ── Chapter Version History ──
// Provides automatic version snapshotting and restoration for chapter content.
// Pattern: each time a chapter is saved, the previous content is snapshotted
// to `story/state/chapter_versions/<chapterNum>/<timestamp>.md`.
// Maximum 20 versions retained per chapter.
//
// See: Issue #235 (Git管理章节版本控制+编辑履历)

import { mkdir, readdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";

// ── Constants ──

const VERSIONS_DIR_RELATIVE = join("story", "state", "chapter_versions");
const VERSION_KEEP = 20;

// ── Types ──

export interface ChapterVersionMeta {
  readonly timestamp: string;
  readonly chapterNum: number;
  readonly wordCount: number;
  readonly label?: string;
}

// ── Path Helpers ──

function versionsDir(bookDir: string, chapterNum: number): string {
  return join(bookDir, VERSIONS_DIR_RELATIVE, String(chapterNum));
}

function versionPath(bookDir: string, chapterNum: number, timestamp: string): string {
  return join(versionsDir(bookDir, chapterNum), `${timestamp}.md`);
}

// ── Core Functions ──

/**
 * Snapshot the current chapter content before it is overwritten.
 * @returns The timestamp string of the created snapshot, or null if identical content.
 */
export async function snapshotChapterVersion(
  bookDir: string,
  chapterNum: number,
  currentContent: string,
  newContent?: string,
): Promise<string | null> {
  // Skip snapshot if content is identical
  if (newContent !== undefined && currentContent === newContent) {
    return null;
  }

  const verDir = versionsDir(bookDir, chapterNum);
  await mkdir(verDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshot = `---\nversion_timestamp: ${timestamp}\nchapter_number: ${chapterNum}\nword_count: ${currentContent.length}\n---\n\n${currentContent}`;

  await writeFile(versionPath(bookDir, chapterNum, timestamp), snapshot, "utf-8");

  // Prune old versions
  await pruneChapterVersions(bookDir, chapterNum);

  return timestamp;
}

/**
 * List all versions for a given chapter.
 * Returns newest first.
 */
export async function listChapterVersions(
  bookDir: string,
  chapterNum: number,
): Promise<ChapterVersionMeta[]> {
  const verDir = versionsDir(bookDir, chapterNum);
  let files: string[];
  try {
    files = await readdir(verDir);
  } catch {
    return [];
  }

  const versions: ChapterVersionMeta[] = [];
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const timestamp = file.replace(/\.md$/, "");
    try {
      const filePath = join(verDir, file);
      const fileStat = await stat(filePath);
      // Parse word count from frontmatter
      const content = await readFile(filePath, "utf-8");
      const wordCount = content.length;
      versions.push({
        timestamp,
        chapterNum,
        wordCount,
      });
    } catch {
      // Skip corrupt version files
    }
  }

  versions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return versions;
}

/**
 * Load a specific chapter version by timestamp.
 * Returns the content or null if not found.
 */
export async function loadChapterVersion(
  bookDir: string,
  chapterNum: number,
  timestamp: string,
): Promise<string | null> {
  try {
    const raw = await readFile(versionPath(bookDir, chapterNum, timestamp), "utf-8");
    // Strip frontmatter (between --- markers)
    const match = raw.match(/^---[\s\S]*?---\n\n([\s\S]*)$/);
    return match ? match[1] : raw;
  } catch {
    return null;
  }
}

/**
 * Get available disk-versions summary for chapter edit history.
 */
export async function getChapterVersionSummary(
  bookDir: string,
  chapterNum: number,
): Promise<{ snapshotCount: number; latestSnapshot: string | null }> {
  const versions = await listChapterVersions(bookDir, chapterNum);
  return {
    snapshotCount: versions.length,
    latestSnapshot: versions.length > 0 ? versions[0].timestamp : null,
  };
}

// ── Pruning ──

async function pruneChapterVersions(bookDir: string, chapterNum: number): Promise<void> {
  const verDir = versionsDir(bookDir, chapterNum);
  let files: string[];
  try {
    files = await readdir(verDir);
  } catch {
    return;
  }

  const timestamps: string[] = [];
  for (const file of files) {
    if (file.endsWith(".md")) {
      timestamps.push(file.replace(/\.md$/, ""));
    }
  }

  timestamps.sort();
  if (timestamps.length <= VERSION_KEEP) return;

  const toRemove = timestamps.slice(0, timestamps.length - VERSION_KEEP);
  for (const old of toRemove) {
    await rm(versionPath(bookDir, chapterNum, old), { force: true });
  }
}
