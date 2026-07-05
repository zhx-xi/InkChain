// ── Seed data for chapter-volume E2E tests (Issue #377) ──
// Provides 25 chapters for pagination testing + volumes for volume management.

import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const E2E_ROOT = resolve(__dirname, "../../../..", "test-project");
export const E2E_BOOK_ID = "e2e-chapter-volume";
export const VOL_1_ID = "ch-vol-1";
export const VOL_2_ID = "ch-vol-2";

export async function seedChapterVolume(): Promise<void> {
  const bookDir = join(E2E_ROOT, "books", E2E_BOOK_ID);
  const chaptersDir = join(bookDir, "chapters");
  const storyChaptersDir = join(bookDir, "story", "chapters");
  const stateDir = join(bookDir, "story", "state");

  const now = new Date("2026-07-05T00:00:00.000Z").toISOString();

  // book.json
  await mkdir(bookDir, { recursive: true });
  await writeFile(
    join(bookDir, "book.json"),
    JSON.stringify({
      id: E2E_BOOK_ID, title: "E2E 章节分卷测试", platform: "webnovel",
      genre: "fantasy", status: "active", targetChapters: 30,
      chapterWordCount: 2000, language: "zh", createdAt: now, updatedAt: now,
    }, null, 2), "utf-8",
  );

  // Generate 25 chapters for pagination
  const chapters = Array.from({ length: 25 }, (_, i) => {
    const num = i + 1;
    const volId = num <= 5 ? null : (num <= 15 ? VOL_1_ID : VOL_2_ID);
    return {
      number: num,
      title: `第${String(num).padStart(2, "0")}章`,
      status: "drafted",
      wordCount: 1000 + num * 50,
      createdAt: now,
      updatedAt: now,
      volumeId: volId,
      auditIssues: [],
      lengthWarnings: [],
    };
  });

  // chapters/index.json
  await mkdir(chaptersDir, { recursive: true });
  await writeFile(join(chaptersDir, "index.json"), JSON.stringify(chapters, null, 2), "utf-8");

  // story/chapters/index.json
  await mkdir(storyChaptersDir, { recursive: true });
  await writeFile(join(storyChaptersDir, "index.json"), JSON.stringify({
    chapters: chapters.map((c) => ({
      number: c.number, title: c.title, status: c.status,
      wordCount: c.wordCount, createdAt: c.createdAt, updatedAt: c.updatedAt, volumeId: c.volumeId,
    })),
  }, null, 2), "utf-8");

  // story/state/volumes.json
  await mkdir(stateDir, { recursive: true });
  await writeFile(join(stateDir, "volumes.json"), JSON.stringify({
    schemaVersion: "1",
    volumes: [
      { id: VOL_1_ID, title: "第一卷 · 序章", description: "故事开端", status: "active", order: 0, createdAt: now, updatedAt: now },
      { id: VOL_2_ID, title: "第二卷 · 发展", description: "故事发展", status: "draft", order: 1, createdAt: now, updatedAt: now },
    ],
  }, null, 2), "utf-8");
}
