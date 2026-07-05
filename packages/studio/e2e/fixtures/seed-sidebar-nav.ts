// ── Seed data for sidebar navigation E2E tests (Issue #378) ──
// Provides a single book with typical metadata for sidebar navigation testing.

import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const E2E_ROOT = resolve(__dirname, "../../../..", "test-project");
export const E2E_BOOK_ID = "e2e-sidebar-nav";

export async function seedSidebarNav(): Promise<void> {
  const bookDir = join(E2E_ROOT, "books", E2E_BOOK_ID);
  const chaptersDir = join(bookDir, "chapters");
  const now = new Date("2026-07-05T00:00:00.000Z").toISOString();

  await mkdir(bookDir, { recursive: true });
  await writeFile(
    join(bookDir, "book.json"),
    JSON.stringify({
      id: E2E_BOOK_ID, title: "E2E 侧边栏导航测试", platform: "webnovel",
      genre: "xianxia", status: "active", targetChapters: 10,
      chapterWordCount: 2000, language: "zh", createdAt: now, updatedAt: now,
    }, null, 2), "utf-8",
  );

  await mkdir(chaptersDir, { recursive: true });
  await writeFile(
    join(chaptersDir, "index.json"),
    JSON.stringify(
      Array.from({ length: 3 }, (_, i) => ({
        number: i + 1,
        title: `第${String(i + 1).padStart(2, "0")}章`,
        status: "drafted",
        wordCount: 1000,
        createdAt: now,
        updatedAt: now,
        volumeId: null,
        auditIssues: [],
        lengthWarnings: [],
      })),
      null, 2,
    ),
    "utf-8",
  );
}
