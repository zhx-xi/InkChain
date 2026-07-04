import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Reuse the existing E2E book so the page doesn't 404 on book lookup
export const E2E_FORES_BOOK_ID = "e2e-volume-dnd";
export const E2E_ROOT = resolve(__dirname, "../../../..", "test-project");

export async function seedForeshadowing(): Promise<void> {
  const foreshadowingDir = join(E2E_ROOT, ".inkos", "foreshadowing");
  await mkdir(foreshadowingDir, { recursive: true });

  const now = new Date("2026-07-04T00:00:00.000Z").toISOString();

  const entries = [
    {
      id: "fs-e2e-1",
      bookId: E2E_FORES_BOOK_ID,
      title: "神秘戒指",
      description: "主角在第一章获得的戒指，实则隐藏着上古力量",
      type: "物品伏笔",
      status: "active",
      createdChapter: 1,
      lastMentionedChapter: 3,
      expectedPayoffChapter: 10,
      payoffChapter: null,
      notes: "戒指的来历将在中卷揭晓",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "fs-e2e-2",
      bookId: E2E_FORES_BOOK_ID,
      title: "门口的石像",
      description: "村口石像的眼睛在月圆之夜会发光",
      type: "设定伏笔",
      status: "active",
      createdChapter: 2,
      lastMentionedChapter: 2,
      expectedPayoffChapter: null,
      payoffChapter: null,
      notes: "",
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const entry of entries) {
    await writeFile(
      join(foreshadowingDir, `${entry.id}.json`),
      JSON.stringify(entry, null, 2),
      "utf-8",
    );
  }
}
