import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// From packages/studio/e2e/fixtures, going up 4 levels reaches the worktree root,
// then down into test-project.
export const E2E_ROOT = resolve(__dirname, "../../", "test-project");
export const E2E_BOOK_ID = "e2e-volume-dnd";

// Fixed volume IDs for reproducible test assertions
export const VOLUME_1_ID = "vol-1-id";
export const VOLUME_2_ID = "vol-2-id";

export async function seedVolumeDnd(): Promise<void> {
  const bookDir = join(E2E_ROOT, "books", E2E_BOOK_ID);
  const chaptersDir = join(bookDir, "chapters");
  const storyChaptersDir = join(bookDir, "story", "chapters");
  const stateDir = join(bookDir, "story", "state");

  const now = new Date("2026-07-04T00:00:00.000Z").toISOString();

  // book.json — minimal BookConfig required by StateManager.loadBookConfig
  await mkdir(bookDir, { recursive: true });
  await writeFile(
    join(bookDir, "book.json"),
    JSON.stringify(
      {
        id: E2E_BOOK_ID,
        title: "E2E 分卷拖拽测试",
        platform: "webnovel",
        genre: "xianxia",
        status: "active",
        targetChapters: 10,
        chapterWordCount: 2000,
        language: "zh",
        createdAt: now,
        updatedAt: now,
      },
      null,
      2,
    ),
    "utf-8",
  );

  // chapters/index.json — used by StateManager.loadChapterIndex (GET /books/:id)
  // Chapters 1-2: unassigned; Chapter 3: in Vol-2; Chapters 4-5: in Vol-1
  await mkdir(chaptersDir, { recursive: true });
  await writeFile(
    join(chaptersDir, "index.json"),
    JSON.stringify(
      [
        { number: 1, title: "第一章", status: "drafted", wordCount: 1200, createdAt: now, updatedAt: now, volumeId: null, auditIssues: [], lengthWarnings: [] },
        { number: 2, title: "第二章", status: "drafted", wordCount: 1500, createdAt: now, updatedAt: now, volumeId: null, auditIssues: [], lengthWarnings: [] },
        { number: 3, title: "第三章", status: "drafted", wordCount: 1800, createdAt: now, updatedAt: now, volumeId: VOLUME_2_ID, auditIssues: [], lengthWarnings: [] },
        { number: 4, title: "第四章", status: "approved", wordCount: 2000, createdAt: now, updatedAt: now, volumeId: VOLUME_1_ID, auditIssues: [], lengthWarnings: [] },
        { number: 5, title: "第五章", status: "drafted", wordCount: 900, createdAt: now, updatedAt: now, volumeId: VOLUME_1_ID, auditIssues: [], lengthWarnings: [] },
      ],
      null,
      2,
    ),
    "utf-8",
  );

  // story/chapters/index.json — used by the volumes route's PATCH handler
  await mkdir(storyChaptersDir, { recursive: true });
  await writeFile(
    join(storyChaptersDir, "index.json"),
    JSON.stringify(
      { chapters: [
        { number: 1, title: "第一章", status: "drafted", wordCount: 1200, createdAt: now, updatedAt: now, volumeId: null },
        { number: 2, title: "第二章", status: "drafted", wordCount: 1500, createdAt: now, updatedAt: now, volumeId: null },
        { number: 3, title: "第三章", status: "drafted", wordCount: 1800, createdAt: now, updatedAt: now, volumeId: VOLUME_2_ID },
        { number: 4, title: "第四章", status: "approved", wordCount: 2000, createdAt: now, updatedAt: now, volumeId: VOLUME_1_ID },
        { number: 5, title: "第五章", status: "drafted", wordCount: 900, createdAt: now, updatedAt: now, volumeId: VOLUME_1_ID },
      ]},
      null,
      2,
    ),
    "utf-8",
  );

  // story/state/volumes.json — for GET /books/:id/volumes and PATCH /books/:id/chapters/:num/volume
  await mkdir(stateDir, { recursive: true });
  await writeFile(
    join(stateDir, "volumes.json"),
    JSON.stringify(
      {
        schemaVersion: "1",
        volumes: [
          {
            id: VOLUME_1_ID,
            title: "第一卷 · 筑基篇",
            description: "主角踏上修仙之路",
            status: "active",
            order: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: VOLUME_2_ID,
            title: "第二卷 · 历练篇",
            description: "主角在外历练成长",
            status: "draft",
            order: 1,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
      null,
      2,
    ),
    "utf-8",
  );
}
