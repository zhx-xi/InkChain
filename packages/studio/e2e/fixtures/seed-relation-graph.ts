import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const E2E_ROOT = resolve(__dirname, "../../../..", "test-project");
export const E2E_BOOK_ID = "e2e-volume-dnd";

export async function seedRelationGraph(): Promise<void> {
  const stateDir = join(E2E_ROOT, "books", E2E_BOOK_ID, "story", "state");
  await mkdir(stateDir, { recursive: true });

  const now = new Date("2026-07-04T00:00:00.000Z").toISOString();

  // Seed relations.json for the book
  const relations = {
    schemaVersion: "1",
    relations: [
      {
        id: "rel-1",
        sourceRoleId: "char-1",
        targetRoleId: "char-2",
        relationType: "师徒",
        label: "师父",
        intensity: 5,
        bidirectional: false,
        isForgotten: false,
        description: "叶辰拜青云真人为师，学习修仙之道",
        validFromChapter: 1,
        validToChapter: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "rel-2",
        sourceRoleId: "char-1",
        targetRoleId: "char-3",
        relationType: "敌对",
        label: "宿敌",
        intensity: 4,
        bidirectional: true,
        isForgotten: false,
        description: "叶辰与魔子为宿命之敌",
        validFromChapter: 3,
        validToChapter: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "rel-3",
        sourceRoleId: "char-2",
        targetRoleId: "char-4",
        relationType: "友谊",
        label: "师兄弟",
        intensity: 3,
        bidirectional: false,
        isForgotten: false,
        description: "青云真人与药王谷谷主为多年好友",
        validFromChapter: 1,
        validToChapter: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "rel-4",
        sourceRoleId: "char-3",
        targetRoleId: "char-5",
        relationType: "忠诚",
        label: "部下",
        intensity: 3,
        bidirectional: false,
        isForgotten: false,
        description: "魔子的忠实部下",
        validFromChapter: 3,
        validToChapter: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "rel-5",
        sourceRoleId: "char-1",
        targetRoleId: "char-4",
        relationType: "友谊",
        label: "忘年交",
        intensity: 2,
        bidirectional: true,
        isForgotten: false,
        description: "",
        validFromChapter: 5,
        validToChapter: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };

  await writeFile(
    join(stateDir, "relations.json"),
    JSON.stringify(relations, null, 2),
    "utf-8",
  );
}
