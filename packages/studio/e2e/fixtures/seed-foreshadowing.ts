import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
<<<<<<< HEAD
import { dataPath } from "@inkchain/inkchain-core";
=======
>>>>>>> origin/main

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Reuse the existing E2E book so the page doesn't 404 on book lookup
export const E2E_FORES_BOOK_ID = "e2e-volume-dnd";
export const E2E_ROOT = resolve(__dirname, "../../", "test-project");

export async function seedForeshadowing(): Promise<void> {
<<<<<<< HEAD
  const foreshadowingDir = dataPath(E2E_ROOT, "foreshadowing");
=======
  const foreshadowingDir = join(E2E_ROOT, ".inkos", "foreshadowing");
>>>>>>> origin/main
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
    {
      id: "fs-e2e-3",
      bookId: E2E_FORES_BOOK_ID,
      title: "神秘的预言",
      description: "长老说'天降异象，必有大事发生'",
      type: "情节伏笔",
      status: "paid_off",
      createdChapter: 1,
      lastMentionedChapter: 8,
      expectedPayoffChapter: 8,
      payoffChapter: 8,
      notes: "预言在第8章应验",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "fs-e2e-4",
      bookId: E2E_FORES_BOOK_ID,
      title: "失踪的师父",
      description: "主角师父在三年前神秘失踪",
      type: "角色伏笔",
      status: "active",
      createdChapter: 1,
      lastMentionedChapter: 5,
      expectedPayoffChapter: 20,
      payoffChapter: null,
      notes: "师父去向成谜",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "fs-e2e-5",
      bookId: E2E_FORES_BOOK_ID,
      title: "古墓钥匙",
      description: "祖传的钥匙能打开后山古墓",
      type: "物品伏笔",
      status: "abandoned",
      createdChapter: 3,
      lastMentionedChapter: 3,
      expectedPayoffChapter: null,
      payoffChapter: null,
      notes: "这条线已经废弃",
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

/** Delete all foreshadowing entries for the E2E book */
export async function clearForeshadowing(): Promise<void> {
<<<<<<< HEAD
  const foreshadowingDir = dataPath(E2E_ROOT, "foreshadowing");
=======
  const foreshadowingDir = join(E2E_ROOT, ".inkos", "foreshadowing");
>>>>>>> origin/main
  const { rm } = await import("node:fs/promises");
  await rm(foreshadowingDir, { recursive: true, force: true });
  await mkdir(foreshadowingDir, { recursive: true });
}
